package com.rosterriddles.rosterriddles.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.rosterriddles.rosterriddles.domain.enums.GameStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class GameResponse {

    @JsonProperty("id")
    private final Long id;

    @JsonProperty("start_time")
    private final LocalDateTime startTime;

    @JsonProperty("end_time")
    private final LocalDateTime endTime;

    @JsonProperty("status")
    private final GameStatus status;

    @JsonProperty("remaining_guesses")
    private final int remainingGuesses;

    @JsonProperty("number_of_guesses")
    private final int numberOfGuesses;

    @JsonProperty("times_viewed_active_roster")
    private final int timesViewedActiveRoster;

    @JsonProperty("user_id")
    private final Long userId;

    @JsonProperty("league_id")
    private final Long leagueId;

    @JsonProperty("game_type_id")
    private final Long gameTypeId;
}
