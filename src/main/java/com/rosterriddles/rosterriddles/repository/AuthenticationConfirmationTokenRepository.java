package com.rosterriddles.rosterriddles.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.rosterriddles.rosterriddles.domain.entity.AuthenticationConfirmationToken;

public interface AuthenticationConfirmationTokenRepository extends JpaRepository<AuthenticationConfirmationToken, Long> {

    Optional<AuthenticationConfirmationToken> findByToken(String token);

    @Transactional
    @Modifying
    @Query("UPDATE AuthenticationConfirmationToken c " +
            "SET c.confirmedAt = ?2 " +
            "WHERE c.token = ?1")
    int updateConfirmedAt(String token,
            LocalDateTime confirmedAt);
}
