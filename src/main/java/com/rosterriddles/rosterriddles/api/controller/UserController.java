package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.model.Game;
import com.rosterriddles.rosterriddles.domain.model.User;
import com.rosterriddles.rosterriddles.domain.model.UserResponse;
import com.rosterriddles.rosterriddles.domain.model.UserStatistics;
import com.rosterriddles.rosterriddles.domain.model.UserUpdateRequest;
import com.rosterriddles.rosterriddles.domain.service.GameService;
import com.rosterriddles.rosterriddles.domain.service.UserService;

import lombok.AllArgsConstructor;

import java.util.List;

import org.springframework.http.ResponseEntity;

@RestController
@AllArgsConstructor
@RequestMapping(path = "api/v1/users")
public class UserController {

    private final UserService userService;
    private final GameService gameService;

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        User user = userService.loadUserById(id);
        UserResponse response = new UserResponse(
                String.valueOf(user.getId()),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserUpdateRequest request) {
        User user = userService.updateUser(request, id);
        UserResponse response = new UserResponse(
                String.valueOf(user.getId()),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<UserStatistics> getUserStats(@PathVariable Long id) {
        List<Game> games = gameService.getGamesByUserId(id);
        UserStatistics stats = new UserStatistics(id, games);

        return ResponseEntity.ok(stats);
    }
}
