package com.rosterriddles.rosterriddles.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.model.Game;

public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findAllByUserId(Long userId);
    
}
