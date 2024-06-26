package com.rosterriddles.rosterriddles.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.GameType;

public interface GameTypeRepository extends JpaRepository<GameType, Long>{
   
}
