package com.rosterriddles.rosterriddles.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.Game;

public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findAllByUserId(Long userId);
    
}
