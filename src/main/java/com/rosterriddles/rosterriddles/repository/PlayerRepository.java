package com.rosterriddles.rosterriddles.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.Player;

public interface PlayerRepository extends JpaRepository<Player, Long>{
   
}
