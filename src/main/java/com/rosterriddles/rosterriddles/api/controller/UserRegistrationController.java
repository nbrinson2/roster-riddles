package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.model.UserRegistrationRequest;
import com.rosterriddles.rosterriddles.domain.service.UserRegistrationService;

import lombok.AllArgsConstructor;

@RestController
@RequestMapping(path = "api/v1/registration")
@AllArgsConstructor
public class UserRegistrationController {

    private final UserRegistrationService userRegistrationService;

    @PostMapping
    public String register(@RequestBody UserRegistrationRequest request) {
        return userRegistrationService.register(request);
    }

    @GetMapping(path = "confirm")
    public String confirm(@RequestParam("token") String token) {
        return userRegistrationService.confirmToken(token);
    }
}
