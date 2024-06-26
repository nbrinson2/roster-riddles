package com.rosterriddles.rosterriddles.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rosterriddles.rosterriddles.domain.dto.AuthenticationRequest;
import com.rosterriddles.rosterriddles.domain.dto.AuthenticationResponse;
import com.rosterriddles.rosterriddles.domain.dto.UserRegistrationRequest;
import com.rosterriddles.rosterriddles.domain.dto.UserRegistrationResponse;
import com.rosterriddles.rosterriddles.domain.dto.UserResponse;
import com.rosterriddles.rosterriddles.domain.dto.UserStatisticsResponse;
import com.rosterriddles.rosterriddles.domain.entity.AuthenticationConfirmationToken;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.Token;
import com.rosterriddles.rosterriddles.domain.entity.User;
import com.rosterriddles.rosterriddles.domain.enums.GameStatus;
import com.rosterriddles.rosterriddles.domain.enums.TokenType;
import com.rosterriddles.rosterriddles.domain.enums.UserRole;
import com.rosterriddles.rosterriddles.repository.TokenRepository;
import com.rosterriddles.rosterriddles.repository.UserRepository;
import com.rosterriddles.rosterriddles.utils.EmailSender;
import com.rosterriddles.rosterriddles.utils.EmailUtil;
import com.rosterriddles.rosterriddles.utils.EmailValidator;
import com.rosterriddles.rosterriddles.utils.LandingPageUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private static final Logger LOG = LoggerFactory.getLogger(AuthenticationService.class);

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final JwtService jwtService;
    private final AuthenticationConfirmationTokenService confirmationTokenService;
    private final AuthenticationManager authenticationManager;
    private final EmailValidator emailValidator;
    private final EmailSender emailSender;
    private final UserService userService;
    private final UserStatisticsService userStatisticsService;
    private final GameService gameService;
    private final PasswordEncoder encoder;

    private final static String INVALID_EMAIL_MSG = "Invalid email : %s";
    private final static String EMAIL_EXISTS_MSG = "Email %s already exists";
    private final static String USER_NOT_ENABLED = "User %s not enabled";
    private final static String EMAIL_LINK = "http://localhost:7070/api/v1/auth/confirm?token=%s";

    public UserRegistrationResponse register(UserRegistrationRequest request) {

        boolean isEmailValid = emailValidator.test(request.getEmail());
        if (!isEmailValid) {
            throw new IllegalStateException(String.format(INVALID_EMAIL_MSG, request.getEmail()));
        }
        Optional<User> existingUser = userRepository.findByEmail(request.getEmail());

        if (existingUser.isPresent()) {
            if (existingUser.get().getEnabled()) {
                throw new IllegalStateException(String.format(EMAIL_EXISTS_MSG, request.getEmail()));
            } else {
                throw new IllegalStateException(String.format(USER_NOT_ENABLED, request.getFirstName()));
            }
        }

        User user = new User(
                request.getFirstName(),
                request.getLastName(),
                request.getEmail(),
                encoder.encode(request.getPassword()),
                UserRole.USER);

        User saveduser = userRepository.save(user);
        boolean success = saveduser != null;

        String jwtToken = jwtService.generateToken(user);

        saveUserToken(saveduser, jwtToken);

        this.sendConfirmationEmail(saveduser);

        return UserRegistrationResponse.builder()
                .success(success)
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        User user = this.userService.loadUserByUsername(request.getEmail());
        LOG.debug("Authenticating user : " + user.getEmail());

        if (!user.isEnabled()) {
            this.sendConfirmationEmail(user);
        }

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()));

        String jwtToken = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        UserResponse userResponse = mapToUserResponse(user);

        revokeAllUserTokens(user);
        saveUserToken(user, jwtToken);
        return AuthenticationResponse.builder()
                .accessToken(jwtToken)
                .refreshToken(refreshToken)
                .user(userResponse)
                .build();
    }

    public String confirmToken(String token) {
        LOG.debug("Confirming token");
        AuthenticationConfirmationToken confirmationToken = confirmationTokenService
                .getToken(token)
                .orElseThrow(() -> new IllegalStateException("token not found"));

        if (confirmationToken.getConfirmedAt() != null) {
            throw new IllegalStateException("email already confirmed");
        }

        LocalDateTime expiredAt = confirmationToken.getExpiresAt();

        if (expiredAt.isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("token expired");
        }

        confirmationTokenService.setConfirmedAt(token);
        userService.enableUser(
                confirmationToken.getUser().getEmail());
        return LandingPageUtil.getConfirmationPage("http://localhost:4200");
    }

    public void refreshToken(
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {
        final String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        final String refreshToken;
        final String userEmail;
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return;
        }
        refreshToken = authHeader.substring(7);
        userEmail = jwtService.extractUsername(refreshToken);
        if (userEmail != null) {
            var user = this.userService.loadUserByUsername(userEmail);
            if (jwtService.isTokenValid(refreshToken, user)) {
                var accessToken = jwtService.generateToken(user);
                revokeAllUserTokens(user);
                saveUserToken(user, accessToken);
                var authResponse = AuthenticationResponse.builder()
                        .accessToken(accessToken)
                        .refreshToken(refreshToken)
                        .build();
                new ObjectMapper().writeValue(response.getOutputStream(), authResponse);
            }
        }
    }

    private UserResponse mapToUserResponse(User user) {
        List<Game> games = gameService.getGamesByUserId(user.getId());
        int totalGamesPlayed = games.size();
        int gamesWon = (int) games.stream().filter(game -> game.getStatus().equals(GameStatus.WIN)).count();
        int gamesLost = (int) games.stream().filter(game -> game.getStatus().equals(GameStatus.LOSS)).count();
        int totalGuessesMade = games.stream().mapToInt(Game::getNumberOfGuesses).sum();
        int totalRosterLinkClicks = user.getTotalRosterLinkClicks();
        int currentStreak = getCurrentStreak(games);
        int maxStreak = getMaxWinStreak(games);
    
        double winPercentage = totalGamesPlayed > 0 ? (double) gamesWon / totalGamesPlayed : 0;
        double avgNumberOfGuessesPerGame = totalGamesPlayed > 0 ? (double) totalGuessesMade / totalGamesPlayed : 0;
    
        System.out.println("gamesWon: " + gamesWon);
        System.out.println("totalGamesPlayed: " + totalGamesPlayed);
        System.out.println("winPercentage: " + winPercentage);
        System.out.println("avgNumberOfGuessesPerGame: " + avgNumberOfGuessesPerGame);
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .createdAt(user.getCreatedAt())
                .totalGamesPlayed(totalGamesPlayed)
                .gamesWon(gamesWon)
                .gamesLost(gamesLost)
                .totalGuessesMade(totalGuessesMade)
                .totalRosterLinkClicks(totalRosterLinkClicks)
                .lastActive(user.getLastActive())
                .userRole(user.getUserRole().name())
                .locked(user.getLocked())
                .enabled(user.getEnabled())
                .timesClickedNewGame(user.getTimesClickedNewGame())
                .currentStreak(currentStreak)
                .maxStreak(maxStreak)
                .winPercentage(winPercentage)
                .avgNumberOfGuessesPerGame(avgNumberOfGuessesPerGame)
                .timesViewedActiveRoster(totalRosterLinkClicks)
                .build();
    }
    

    private int getCurrentStreak(List<Game> games) {
        games.sort(Comparator.comparing(Game::getEndTime).reversed());

        int currentStreak = 0;

        for (Game game : games) {
            if (game.getStatus().equals(GameStatus.WIN)) {
                currentStreak++;
            } else {
                break; // Stop counting when the first non-win status is encountered
            }
        }

        return currentStreak;
    }

    private static int getMaxWinStreak(List<Game> games) {
        // Sort games by end time in ascending order (oldest first)
        games.sort(Comparator.comparing(Game::getEndTime));

        int maxStreak = 0;
        int currentStreak = 0;

        for (Game game : games) {
            if (game.getStatus().equals(GameStatus.WIN)) {
                currentStreak++;
                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                }
            } else {
                currentStreak = 0;
            }
        }

        return maxStreak;
    }

    private void sendConfirmationEmail(User user) {
        String token = UUID.randomUUID().toString();

        AuthenticationConfirmationToken confirmationToken = new AuthenticationConfirmationToken(
                token,
                LocalDateTime.now(),
                LocalDateTime.now().plusMinutes(15),
                null,
                user);
        confirmationTokenService.saveToken(confirmationToken);

        String link = String.format(EMAIL_LINK, token);
        emailSender.send(user.getEmail(), EmailUtil.buildEmail(user.getFirstName(), link));
    }

    private void saveUserToken(User user, String jwtToken) {
        Token token = Token.builder()
                .user(user)
                .token(jwtToken)
                .tokenType(TokenType.BEARER)
                .expired(false)
                .revoked(false)
                .build();
        tokenRepository.save(token);
    }

    private void revokeAllUserTokens(User user) {
        List<Token> validUserTokens = tokenRepository.findAllValidTokenByUser(user.getId());
        if (validUserTokens.isEmpty())
            return;
        validUserTokens.forEach(token -> {
            token.setExpired(true);
            token.setRevoked(true);
        });
        tokenRepository.saveAll(validUserTokens);
    }
}
