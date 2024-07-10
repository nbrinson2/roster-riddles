package com.rosterriddles.rosterriddles.service;

import com.rosterriddles.rosterriddles.domain.dto.BaseballPlayerRequest;
import com.rosterriddles.rosterriddles.domain.dto.GuessRequest;
import com.rosterriddles.rosterriddles.domain.dto.PlayerRequest;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.Guess;
import com.rosterriddles.rosterriddles.domain.entity.League;
import com.rosterriddles.rosterriddles.domain.entity.Player;
import com.rosterriddles.rosterriddles.domain.entity.BaseballPlayer;
import com.rosterriddles.rosterriddles.repository.GuessRepository;
import com.rosterriddles.rosterriddles.repository.BaseballPlayerRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class GuessService {

   private static final Logger logger = LoggerFactory.getLogger(GuessService.class);

   @Autowired
   private GuessRepository guessRepository;

   @Autowired
   private BaseballPlayerRepository baseballPlayerRepository;

   @Autowired
   private GameService gameService;

   public List<Guess> getAllGuesses() {
      return guessRepository.findAll();
   }

   public Guess getGuessById(Long id) {
      return guessRepository.findById(id).orElse(null);
   }

   @Transactional
   public Guess createGuess(Long gameId, GuessRequest request) {
      logger.info("Creating guess for game with id: {}", gameId);
      Game game = gameService.getGameById(gameId);
      int guessNumber = guessRepository.findAllByGameId(gameId).size() + 1;

      Player player = createPlayerFromRequest(request.getPlayer(), game.getLeague());
      player = savePlayer(player);

      Guess guess = new Guess(
            game,
            guessNumber,
            player,
            request.getIsCorrect(),
            game.getLeague(),
            LocalDateTime.now(),
            null);
      Guess savedGuess = guessRepository.save(guess);
      logger.info("Guess created with id: {}", savedGuess.getId());
      return savedGuess;
   }

   public Guess updateGuess(Long id, Guess guessDetails) {
      return guessRepository.findById(id).map(guess -> {
         guess.setGame(guessDetails.getGame());
         guess.setGuessNumber(guessDetails.getGuessNumber());
         guess.setGuessedPlayer(guessDetails.getGuessedPlayer());
         guess.setCorrect(guessDetails.isCorrect());
         guess.setLeague(guessDetails.getLeague());
         guess.setTimestamp(guessDetails.getTimestamp());
         guess.setRosterLink(guessDetails.getRosterLink());
         return guessRepository.save(guess);
      }).orElse(null);
   }

   private Player createPlayerFromRequest(PlayerRequest playerRequest, League league) {
      if (playerRequest instanceof BaseballPlayerRequest) {
         BaseballPlayerRequest baseballRequest = (BaseballPlayerRequest) playerRequest;
         logger.info("Creating baseball player: {}", baseballRequest);
         return new BaseballPlayer(
               baseballRequest.getName(),
               baseballRequest.getTeam(),
               baseballRequest.getCountryOfBirth(),
               baseballRequest.getAge(),
               league,
               baseballRequest.getBattingHand(),
               baseballRequest.getThrowingHand(),
               baseballRequest.getLeagueDivision(),
               baseballRequest.getPosition());
      } else {
         throw new IllegalArgumentException("Unsupported player type");
      }
   }

   private Player savePlayer(Player player) {
      if (player instanceof BaseballPlayer) {
         logger.info("Saving baseball player: {}", player);
         return baseballPlayerRepository.save((BaseballPlayer) player);
      } else {
         throw new IllegalArgumentException("Unsupported player type");
      }
   }
}
