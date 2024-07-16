package com.rosterriddles.rosterriddles.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class GuessResponse {

   @JsonProperty("id")
   private final Long id;

   @JsonProperty("game_id")
   private final Long gameId;

   @JsonProperty("guess_number")
   private final int guessNumber;

   @JsonProperty("guessed_player_id")
   private final Long guessedPlayerId;

   @JsonProperty("correct")
   private final boolean correct;

   @JsonProperty("league_id")
   private final Long leagueId;

   @JsonProperty("timestamp")
   private final LocalDateTime timestamp;

   @JsonProperty("roster_link")
   private final String rosterLink;

   @JsonProperty("color_map")
   private final String colorMap;
}
