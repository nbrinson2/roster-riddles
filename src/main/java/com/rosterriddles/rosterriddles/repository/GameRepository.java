package com.rosterriddles.rosterriddles.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rosterriddles.rosterriddles.domain.entity.Game;

public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findAllByUserId(Long userId);

    @Query("SELECT g " +
            "FROM Game g " +
            "WHERE g.user.id = :userId " +
            "AND g.status = 'IN_PROCESS' " +
            "ORDER BY g.startTime DESC")
    Optional<List<Game>> findAllInProcessByUserId(
            @Param("userId") Long userId);
}
