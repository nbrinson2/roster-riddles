package com.rosterriddles.rosterriddles.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.BaseballPlayer;

public interface BaseballPlayerRepository extends JpaRepository<BaseballPlayer, Long>{
   
}
