package com.rosterriddles.rosterriddles.domain.mapper;

import com.rosterriddles.rosterriddles.domain.dto.GameResponse;
import com.rosterriddles.rosterriddles.domain.entity.Game;

public class GameResponseMapper {
   public static GameResponse mapToGameResponse(Game game) {
      return GameResponse.builder()
            .id(game.getId())
            .status(game.getStatus())
            .timesViewedActiveRoster(game.getTimesViewedActiveRoster())
            .numberOfGuesses(game.getNumberOfGuesses())
            .userId(game.getUser().getId())
            .leagueId(game.getLeague().getId())
            .gameTypeId(game.getGameType().getId())
            .build();
   }
}
