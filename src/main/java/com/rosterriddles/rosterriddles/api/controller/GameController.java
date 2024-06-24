package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.dto.GameCreateResponse;
import com.rosterriddles.rosterriddles.domain.dto.GameUpdateRequest;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.service.GameService;

import lombok.AllArgsConstructor;

@CrossOrigin(origins = {"http://localhost:4200"})
@RestController
@RequestMapping(path = "api/v1/games")
@AllArgsConstructor
public class GameController {
    
    private final GameService gameService;

    @GetMapping("/{id}")
    public ResponseEntity<Game> getGame(@PathVariable Long id) {
        Game game = gameService.getGameById(id);

        return ResponseEntity.ok(game);
    }

    @PostMapping("/{id}")
    public ResponseEntity<Game> updateGame(@PathVariable Long id, @RequestBody GameUpdateRequest request) {
        Game game = gameService.updateGame(request, id);
        return ResponseEntity.ok(game);
    }

    @PostMapping
    public ResponseEntity<GameCreateResponse> createGame(@RequestBody GameUpdateRequest request) {
        Game newGame = gameService.createGame(request);
        GameCreateResponse response = new GameCreateResponse(
            newGame.getId().toString(),
            newGame.getStartTime().toString(),
            newGame.getStatus().toString(),
            String.valueOf(newGame.getTimesViewedActiveRoster()),
            String.valueOf(newGame.getNumberOfGuesses()),
            newGame.getUser().getId().toString()
        );
        return ResponseEntity.ok(response);
    }
}
