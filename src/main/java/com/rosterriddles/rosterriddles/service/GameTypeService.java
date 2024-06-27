package com.rosterriddles.rosterriddles.service;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.entity.GameType;
import com.rosterriddles.rosterriddles.repository.GameTypeRepository;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class GameTypeService {
   private final GameTypeRepository gameTypeRepository;

   public GameType getGameTypeById(Long id) {
      return gameTypeRepository.findById(id)
            .orElseThrow(() -> new IllegalStateException("GameType with id " + id + " not found"));
   }
}
