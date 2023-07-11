package com.rosterriddles.rosterriddles.domain.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.api.repository.AuthenticationConfirmationTokenRepository;
import com.rosterriddles.rosterriddles.domain.model.AuthenticationConfirmationToken;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class AuthenticationConfirmationTokenService {

    private final AuthenticationConfirmationTokenRepository repository;

    public void saveToken(AuthenticationConfirmationToken token) {
        repository.save(token);
    }

    public Optional<AuthenticationConfirmationToken> getToken(String token) {
        return repository.findByToken(token);
    }

    public int setConfirmedAt(String token) {
        return repository.updateConfirmedAt(
                token, LocalDateTime.now());
    }
}
