package com.rosterriddles.rosterriddles.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.dto.BaseballPlayerRequest;
import com.rosterriddles.rosterriddles.domain.dto.PlayerRequest;
import com.rosterriddles.rosterriddles.domain.entity.BaseballPlayer;
import com.rosterriddles.rosterriddles.domain.entity.League;
import com.rosterriddles.rosterriddles.domain.entity.Player;
import com.rosterriddles.rosterriddles.repository.BaseballPlayerRepository;

@Service
public class PlayerService {

   private static final Logger logger = LoggerFactory.getLogger(PlayerService.class);

   @Autowired
   private BaseballPlayerRepository baseballPlayerRepository;

   public Player savePlayer(Player player) {
      if (player instanceof BaseballPlayer) {
         logger.info("Saving baseball player: {}", player);
         Player savedPlayer = baseballPlayerRepository.save((BaseballPlayer) player);
         logger.info("Baseball player saved with ID: {}", savedPlayer.getId());
         return savedPlayer;
      } else {
         logger.error("Unsupported player type: {}", player.getClass().getName());
         throw new IllegalArgumentException("Unsupported player type");
      }
   }

   public Player createPlayerFromRequest(PlayerRequest playerRequest, League league) {
      if (playerRequest instanceof BaseballPlayerRequest) {
         BaseballPlayerRequest baseballRequest = (BaseballPlayerRequest) playerRequest;
         logger.info("Creating baseball player from request: {}", baseballRequest);
         BaseballPlayer playerToSave = new BaseballPlayer(
               baseballRequest.getName(),
               baseballRequest.getTeam(),
               baseballRequest.getCountryOfBirth(),
               baseballRequest.getAge(),
               league,
               baseballRequest.getBattingHand(),
               baseballRequest.getThrowingHand(),
               baseballRequest.getLeagueDivision(),
               baseballRequest.getPosition());
         logger.debug("Baseball player entity created: {}", playerToSave);
         BaseballPlayer player = baseballPlayerRepository.save(playerToSave);
         logger.info("Baseball player created and saved with ID: {}", player.getId());
         return player;
      } else {
         logger.error("Unsupported player request type: {}", playerRequest.getClass().getName());
         throw new IllegalArgumentException("Unsupported player type");
      }
   }

}
