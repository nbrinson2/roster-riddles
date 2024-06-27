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
import com.rosterriddles.rosterriddles.domain.mapper.UserResponseMapper;
import com.rosterriddles.rosterriddles.service.GameService;
import com.rosterriddles.rosterriddles.service.UserService;

import lombok.AllArgsConstructor;

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
        UserResponse response = UserResponseMapper.mapToUserResponse(user, gameService);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserUpdateRequest request) {
        User user = userService.updateUser(request, id);
        UserResponse response = UserResponseMapper.mapToUserResponse(user, gameService);
        return ResponseEntity.ok(response);
    }
}
