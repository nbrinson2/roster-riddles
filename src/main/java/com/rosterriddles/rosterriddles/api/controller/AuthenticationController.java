package com.rosterriddles.rosterriddles.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.domain.model.AuthenticationRequest;
import com.rosterriddles.rosterriddles.domain.model.AuthenticationResponse;
import com.rosterriddles.rosterriddles.domain.model.UserRegistrationRequest;
import com.rosterriddles.rosterriddles.domain.model.UserRegistrationResponse;
import com.rosterriddles.rosterriddles.domain.service.AuthenticationService;

@CrossOrigin(origins = {"http://localhost:4200"})
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthenticationController {

  private final AuthenticationService service;

  @PostMapping("/register")
  public ResponseEntity<UserRegistrationResponse> register(
      @RequestBody UserRegistrationRequest request) {
    return ResponseEntity.ok(service.register(request));
  }

  @PostMapping("/login")
  public ResponseEntity<AuthenticationResponse> authenticate(
      @RequestBody AuthenticationRequest request) {
    return ResponseEntity.ok(service.authenticate(request));
  }

  @GetMapping("/confirm")
  public String confirm(@RequestParam("token") String token) {
    return service.confirmToken(token);
  }

}
