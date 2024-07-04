package com.rosterriddles.rosterriddles.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rosterriddles.rosterriddles.domain.dto.GameCreateRequest;
import com.rosterriddles.rosterriddles.domain.dto.GameUpdateRequest;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.GameType;
import com.rosterriddles.rosterriddles.domain.entity.League;
import com.rosterriddles.rosterriddles.domain.entity.User;
import com.rosterriddles.rosterriddles.domain.enums.GameStatus;
import com.rosterriddles.rosterriddles.repository.GameRepository;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class GameService {

    private final GameRepository gameRepository;
    private final UserService userService;
    private final LeagueService leagueService;
    private final GameTypeService gameTypeService;

    public Game getGameById(Long id) {
        Optional<Game> game = gameRepository.findById(id);

        if (game.isPresent()) {
            return game.get();
        } else {
            throw new IllegalStateException("Game with id " + id + " not found");
        }
    }

    public List<Game> getGamesByUserId(Long userId) {
        List<Game> games = gameRepository.findAllByUserId(userId);
        return games;
    }

    @Transactional
    public Game updateGame(GameUpdateRequest request, Long id) {
        if (request.getStatus() == null || request.getTimesViewedActiveRoster() == null
                || request.getNumberOfGuesses() == null
                || request.getUserId() == null || request.getLeagueId() == null || request.getGameTypeId() == null) {
            throw new IllegalStateException("All fields must be filled out");
        }

        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Game with id " + id + " not found"));
        
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
        return game;
    }

    @Transactional
    public Game createGame(GameCreateRequest request) {
        User user = userService.loadUserById(Long.valueOf(request.getUserId()));
        League league = leagueService.getLeagueById(Long.valueOf(request.getLeagueId()));
        GameType gameType = gameTypeService.getGameTypeById(Long.valueOf(request.getGameTypeId()));
        List<Game> inProcessGames = gameRepository.findAllInProcessByUserId(request.getUserId()).orElse(null);
        if (inProcessGames != null && inProcessGames.size() > 0) {
            clearInProcessGames(inProcessGames);
        }
        Game game = new Game(
                LocalDateTime.now(),
                GameStatus.IN_PROCESS,
                0,
                0,
                user,
                league,
                gameType);
        gameRepository.save(game);
        return game;
    }

    private void clearInProcessGames(List<Game> games) {
        for (Game game : games) {
            System.out.println("Abandoning game with id " + game.getId());
            game.setStatus(GameStatus.ABANDONED);
            game.setEndTime(LocalDateTime.now());
            gameRepository.save(game);
        }
    }
}
