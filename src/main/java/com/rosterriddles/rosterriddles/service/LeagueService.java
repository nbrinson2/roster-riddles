package com.rosterriddles.rosterriddles.service;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.entity.League;
import com.rosterriddles.rosterriddles.repository.LeagueRepository;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class LeagueService {
   private final LeagueRepository leagueRepository;

   public League getLeagueById(Long id) {
      return leagueRepository.findById(id)
            .orElseThrow(() -> new IllegalStateException("League with id " + id + " not found"));
   }
}
