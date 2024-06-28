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
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Game with id " + id + " not found"));
        League league = leagueService.getLeagueById(Long.valueOf(request.getLeagueId()));
        GameType gameType = gameTypeService.getGameTypeById(Long.valueOf(request.getGameTypeId()));
        User user = userService.loadUserById(request.getUserId());
        game.setStatus(GameStatus.valueOf(request.getStatus()));
        game.setTimesViewedActiveRoster(request.getTimesViewedActiveRoster());
        game.setNumberOfGuesses(request.getNumberOfGuesses());
        game.setUser(user);
        game.setLeague(league);
        game.setGameType(gameType);
        gameRepository.save(game);
        return game;
    }

    @Transactional
    public Game createGame(GameCreateRequest request) {
        User user = userService.loadUserById(Long.valueOf(request.getUserId()));
        League league = leagueService.getLeagueById(Long.valueOf(request.getLeagueId()));
        GameType gameType = gameTypeService.getGameTypeById(Long.valueOf(request.getGameTypeId()));
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
}
