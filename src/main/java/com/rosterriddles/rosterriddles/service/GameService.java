package com.rosterriddles.rosterriddles.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rosterriddles.rosterriddles.domain.dto.GameCreateRequest;
import com.rosterriddles.rosterriddles.domain.dto.GameUpdateRequest;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.GameType;
import com.rosterriddles.rosterriddles.domain.entity.League;
import com.rosterriddles.rosterriddles.domain.entity.Player;
import com.rosterriddles.rosterriddles.domain.entity.User;
import com.rosterriddles.rosterriddles.domain.enums.GameStatus;
import com.rosterriddles.rosterriddles.repository.GameRepository;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class GameService {

    private static final Logger logger = LoggerFactory.getLogger(GameService.class);

    private final GameRepository gameRepository;
    private final UserService userService;
    private final LeagueService leagueService;
    private final GameTypeService gameTypeService;
    private final PlayerService playerService;

    public Game getGameById(Long id) {
        logger.info("Fetching game by id: {}", id);
        Optional<Game> game = gameRepository.findById(id);

        if (game.isPresent()) {
            logger.info("Game found with id: {}", id);
            return game.get();
        } else {
            logger.error("Game with id {} not found", id);
            throw new IllegalStateException("Game with id " + id + " not found");
        }
    }

    public List<Game> getGamesByUserId(Long userId) {
        logger.info("Fetching games for user id: {}", userId);
        List<Game> games = gameRepository.findAllByUserId(userId);
        logger.info("Found {} games for user id: {}", games.size(), userId);
        return games;
    }

    @Transactional
    public Game updateGame(GameUpdateRequest request, Long id) {
        logger.info("Updating game with id: {}", id);
        if (request.getStatus() == null || request.getTimesViewedActiveRoster() == null
                || request.getNumberOfGuesses() == null
                || request.getUserId() == null || request.getLeagueId() == null || request.getGameTypeId() == null) {
            logger.error("Invalid game update request: {}", request);
            throw new IllegalStateException("All fields must be filled out");
        }

        Game game = gameRepository.findById(id)
                .orElseThrow(() -> {
                    logger.error("Game with id {} not found", id);
                    return new IllegalStateException("Game with id " + id + " not found");
                });

        GameStatus status = GameStatus.valueOf(request.getStatus());
        game.setStatus(status);

        if (status == GameStatus.ABANDONED || status == GameStatus.WIN || status == GameStatus.LOSS) {
            game.setEndTime(LocalDateTime.now());
        }

        game.setTimesViewedActiveRoster(request.getTimesViewedActiveRoster());
        game.setNumberOfGuesses(request.getNumberOfGuesses());

        User user = userService.loadUserById(request.getUserId());
        game.setUser(user);

        League league = leagueService.getLeagueById(Long.valueOf(request.getLeagueId()));
        game.setLeague(league);

        GameType gameType = gameTypeService.getGameTypeById(Long.valueOf(request.getGameTypeId()));
        game.setGameType(gameType);

        gameRepository.save(game);
        logger.info("Game updated successfully with id: {}, status: {}", id, game.getStatus());
        return game;
    }

    @Transactional
    public Game createGame(GameCreateRequest request) {
        logger.info("Creating a new game for user id: {}", request.getUserId());
        User user = userService.loadUserById(Long.valueOf(request.getUserId()));
        League league = leagueService.getLeagueById(Long.valueOf(request.getLeagueId()));
        Player playerToGuess = playerService.createPlayerFromRequest(request.getPlayerToGuess(), league);
        GameType gameType = gameTypeService.getGameTypeById(Long.valueOf(request.getGameTypeId()));
        List<Game> inProcessGames = gameRepository.findAllInProcessByUserId(request.getUserId()).orElse(null);
        
        if (inProcessGames != null && !inProcessGames.isEmpty()) {
            logger.info("Found {} in-process games for user id: {}. Clearing them.", inProcessGames.size(), request.getUserId());
            clearInProcessGames(inProcessGames);
        }
        
        Game game = new Game(
                LocalDateTime.now(),
                GameStatus.IN_PROCESS,
                0,
                0,
                0,
                playerToGuess,
                user,
                league,
                gameType);
        gameRepository.save(game);
        logger.info("Game created successfully with id: {}", game.getId());
        return game;
    }

    private void clearInProcessGames(List<Game> games) {
        for (Game game : games) {
            logger.info("Abandoning game with id {}", game.getId());
            game.setStatus(GameStatus.ABANDONED);
            game.setEndTime(LocalDateTime.now());
            gameRepository.save(game);
        }
    }
}
