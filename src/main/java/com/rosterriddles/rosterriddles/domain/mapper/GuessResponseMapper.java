package com.rosterriddles.rosterriddles.domain.mapper;

import com.rosterriddles.rosterriddles.domain.dto.GuessResponse;
import com.rosterriddles.rosterriddles.domain.entity.Guess;

public class GuessResponseMapper {
   public static GuessResponse mapToGuessResponse(Guess guess) {
      return GuessResponse.builder()
            .id(guess.getId())
            .gameId(guess.getGame().getId())
            .guessNumber(guess.getGuessNumber())
            .guessedPlayerId(guess.getGuessedPlayer().getId())
            .build();
   }
}
