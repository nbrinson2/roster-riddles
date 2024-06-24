package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.dto.UserResponse;
import com.rosterriddles.rosterriddles.domain.dto.UserStatisticsResponse;
import com.rosterriddles.rosterriddles.domain.dto.UserUpdateRequest;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.User;
import com.rosterriddles.rosterriddles.service.GameService;
import com.rosterriddles.rosterriddles.service.UserService;
import com.rosterriddles.rosterriddles.service.UserStatisticsService;

import lombok.AllArgsConstructor;

import java.util.List;

import org.springframework.http.ResponseEntity;

@CrossOrigin(origins = {"http://localhost:4200"})
@RestController
@AllArgsConstructor
@RequestMapping(path = "api/v1/users")
public class UserController {

    private final UserService userService;
    private final GameService gameService;
    private final UserStatisticsService userStatisticsService;

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        User user = userService.loadUserById(id);
        UserResponse response = UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .timesClickedNewGame(user.getTimesClickedNewGame())
                .build();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserUpdateRequest request) {
        User user = userService.updateUser(request, id);
        UserResponse response = UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .timesClickedNewGame(user.getTimesClickedNewGame())
                .build();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<UserStatisticsResponse> getUserStats(@PathVariable Long id) {
        List<Game> games = gameService.getGamesByUserId(id);
        UserStatisticsResponse response = userStatisticsService.getUserStatistics(id, games);

        return ResponseEntity.ok(response);
    }
}
