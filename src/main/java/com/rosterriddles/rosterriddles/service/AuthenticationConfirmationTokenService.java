package com.rosterriddles.rosterriddles.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.entity.AuthenticationConfirmationToken;
import com.rosterriddles.rosterriddles.repository.AuthenticationConfirmationTokenRepository;

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
