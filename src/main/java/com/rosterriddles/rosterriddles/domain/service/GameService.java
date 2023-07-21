package com.rosterriddles.rosterriddles.domain.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rosterriddles.rosterriddles.api.repository.GameRepository;
import com.rosterriddles.rosterriddles.domain.model.Game;
import com.rosterriddles.rosterriddles.domain.model.GameUpdateRequest;
import com.rosterriddles.rosterriddles.domain.model.User;
import com.rosterriddles.rosterriddles.utils.GameStatus;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class GameService {

    private final GameRepository gameRepository;
    private final UserService userService;

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
        Optional<Game> gameOptional = gameRepository.findById(id);

        if (gameOptional.isPresent()) {
            Game existingGame = gameOptional.get();
            existingGame.setNumberOfGuesses(Integer.valueOf(request.getNumberOfGuesses()));
            existingGame.setStatus(GameStatus.valueOf(request.getStatus().toUpperCase()));
            existingGame.setTimesViewedActiveRoster(Integer.valueOf(request.getTimesViewedActiveRoster()));
            gameRepository.save(existingGame);
            return existingGame;
        } else {
            throw new IllegalStateException("Game with id " + id + " not found");
        }
    }

    @Transactional
    public Game createGame(GameUpdateRequest request) {
        User user = userService.loadUserById(Long.valueOf(request.getUserId()));
        Game game = new Game(
                LocalDateTime.now(),
                GameStatus.valueOf(request.getStatus().toUpperCase()),
                Integer.valueOf(request.getTimesViewedActiveRoster()),
                Integer.valueOf(request.getNumberOfGuesses()),
                user
        );
        gameRepository.save(game);
        return game;
    }
}
