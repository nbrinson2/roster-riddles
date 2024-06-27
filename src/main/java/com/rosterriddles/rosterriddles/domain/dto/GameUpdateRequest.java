package com.rosterriddles.rosterriddles.domain.dto;

import com.rosterriddles.rosterriddles.domain.entity.GameType;
import com.rosterriddles.rosterriddles.domain.entity.League;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class GameUpdateRequest {
    private final String status;
    private final String timesViewedActiveRoster;
    private final String numberOfGuesses;
    private final String userId;
    private final League league;
    private final GameType gameType;
}
