package com.rosterriddles.rosterriddles.domain.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.api.repository.ConfirmationTokenRepository;
import com.rosterriddles.rosterriddles.domain.model.ConfirmationToken;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class ConfirmationTokenService {

    private final ConfirmationTokenRepository repository;

    public void saveToken(ConfirmationToken token) {
        repository.save(token);
    }

    public Optional<ConfirmationToken> getToken(String token) {
        return repository.findByToken(token);
    }

    public int setConfirmedAt(String token) {
        return repository.updateConfirmedAt(
                token, LocalDateTime.now());
    }
}
