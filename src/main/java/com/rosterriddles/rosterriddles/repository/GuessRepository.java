package com.rosterriddles.rosterriddles.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.Guess;

public interface GuessRepository extends JpaRepository<Guess, Long>{
   List<Guess> findAllByGameId(Long gameId);
}
