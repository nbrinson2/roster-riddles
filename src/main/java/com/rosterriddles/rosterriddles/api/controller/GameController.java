package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.dto.GameCreateRequest;
import com.rosterriddles.rosterriddles.domain.dto.GameResponse;
import com.rosterriddles.rosterriddles.domain.dto.GameUpdateRequest;
import com.rosterriddles.rosterriddles.domain.dto.GuessRequest;
import com.rosterriddles.rosterriddles.domain.dto.GuessResponse;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.Guess;
import com.rosterriddles.rosterriddles.domain.mapper.GameResponseMapper;
import com.rosterriddles.rosterriddles.domain.mapper.GuessResponseMapper;
import com.rosterriddles.rosterriddles.service.GameService;
import com.rosterriddles.rosterriddles.service.GuessService;

import lombok.AllArgsConstructor;

@CrossOrigin(origins = { "http://localhost:4200" })
@RestController
@RequestMapping(path = "api/v1/games")
@AllArgsConstructor
public class GameController {

    private final GameService gameService;
    private final GuessService guessService;

    @GetMapping("/{id}")
    public ResponseEntity<Game> getGame(@PathVariable Long id) {
        Game game = gameService.getGameById(id);

        return ResponseEntity.ok(game);
    }

    @PostMapping("/{id}")
    public ResponseEntity<GameResponse> updateGame(@PathVariable Long id, @RequestBody GameUpdateRequest request) {
        Game game = gameService.updateGame(request, id);
        GameResponse response = GameResponseMapper.mapToGameResponse(game);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<GameResponse> createGame(@RequestBody GameCreateRequest request) {
        Game newGame = gameService.createGame(request);
        GameResponse response = GameResponseMapper.mapToGameResponse(newGame);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/guesses")
    public ResponseEntity<GuessResponse> createGuess(@RequestBody GuessRequest request, @PathVariable Long id) {
        Guess guess = guessService.createGuess(id, request);
        GuessResponse response = GuessResponseMapper.mapToGuessResponse(guess);
        return ResponseEntity.ok(response);
    }
}
