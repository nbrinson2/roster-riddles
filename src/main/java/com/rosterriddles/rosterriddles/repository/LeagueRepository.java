package com.rosterriddles.rosterriddles.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.League;

public interface LeagueRepository extends JpaRepository<League, Long> {
   
}
