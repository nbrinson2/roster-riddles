package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.dto.UserResponse;
import com.rosterriddles.rosterriddles.domain.dto.UserUpdateRequest;
import com.rosterriddles.rosterriddles.domain.entity.User;
import com.rosterriddles.rosterriddles.service.UserService;

import lombok.AllArgsConstructor;

import org.springframework.http.ResponseEntity;

@RestController
@AllArgsConstructor
@RequestMapping(path = "api/v1/users")
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        User user = userService.loadUserById(id);
        UserResponse response = mapToUserResponse(user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserUpdateRequest request) {
        User user = userService.updateUser(request, id);
        UserResponse response = mapToUserResponse(user);
        return ResponseEntity.ok(response);
    }

    private UserResponse mapToUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .createdAt(user.getCreatedAt())
                .totalGamesPlayed(user.getTotalGamesPlayed())
                .gamesWon(user.getGamesWon())
                .gamesLost(user.getGamesLost())
                .totalGuessesMade(user.getTotalGuessesMade())
                .totalRosterLinkClicks(user.getTotalRosterLinkClicks())
                .lastActive(user.getLastActive())
                .userRole(user.getUserRole().name())
                .locked(user.getLocked())
                .enabled(user.getEnabled())
                .timesClickedNewGame(user.getTimesClickedNewGame())
                .build();
    }

}
