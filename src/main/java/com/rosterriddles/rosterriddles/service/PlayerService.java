package com.rosterriddles.rosterriddles.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.dto.BaseballPlayerRequest;
import com.rosterriddles.rosterriddles.domain.dto.FootballPlayerRequest;
import com.rosterriddles.rosterriddles.domain.dto.PlayerRequest;
import com.rosterriddles.rosterriddles.domain.entity.BaseballPlayer;
import com.rosterriddles.rosterriddles.domain.entity.FootballPlayer;
import com.rosterriddles.rosterriddles.domain.entity.League;
import com.rosterriddles.rosterriddles.domain.entity.Player;
import com.rosterriddles.rosterriddles.repository.BaseballPlayerRepository;
import com.rosterriddles.rosterriddles.repository.FootballPlayerRepository;

@Service
public class PlayerService {

  private static final Logger logger = LoggerFactory.getLogger(PlayerService.class);

  @Autowired
  private BaseballPlayerRepository baseballPlayerRepository;

  @Autowired
  private FootballPlayerRepository footballPlayerRepository;

  public Player savePlayer(Player player) {
    if (player instanceof BaseballPlayer) {
      logger.info("Saving baseball player: {}", player);
      Player savedPlayer = baseballPlayerRepository.save((BaseballPlayer) player);
      logger.info("Baseball player saved with ID: {}", savedPlayer.getId());
      return savedPlayer;
    } else if (player instanceof FootballPlayer) {
      logger.info("Saving football player: {}", player);
      Player savedPlayer = footballPlayerRepository.save((FootballPlayer) player);
      logger.info("Football player saved with ID: {}", savedPlayer.getId());
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
    } else if (playerRequest instanceof FootballPlayerRequest) {
      FootballPlayerRequest footballRequest = (FootballPlayerRequest) playerRequest;
      logger.info("Creating football player from request: {}", footballRequest);
      FootballPlayer playerToSave = new FootballPlayer(
          footballRequest.getName(),
          footballRequest.getAge(),
          league,
          footballRequest.getTeam(),
          footballRequest.getJerseyNumber(),
          footballRequest.getCollege(),
          footballRequest.getDraftYear(),
          footballRequest.getLeagueDivision(),
          footballRequest.getPosition());
      logger.debug("Football player entity created: {}", playerToSave);
      FootballPlayer player = footballPlayerRepository.save(playerToSave);
      logger.info("Football player created and saved with ID: {}", player.getId());
      return player;
    } else {
      logger.error("Unsupported player request type: {}", playerRequest.getClass().getName());
      throw new IllegalArgumentException("Unsupported player type");
    }
  }

}
