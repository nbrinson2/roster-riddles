package com.rosterriddles.rosterriddles.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.FootballPlayer;

public interface FootballPlayerRepository extends JpaRepository<FootballPlayer, Long>{
    
}
