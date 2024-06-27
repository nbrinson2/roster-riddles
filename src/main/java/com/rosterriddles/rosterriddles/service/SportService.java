package com.rosterriddles.rosterriddles.service;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.entity.Sport;
import com.rosterriddles.rosterriddles.repository.SportRepository;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class SportService {
   private final SportRepository sportRepository;

   public Sport getSportById(Long id) {
      return sportRepository.findById(id)
            .orElseThrow(() -> new IllegalStateException("Sport with id " + id + " not found"));
   }
}
