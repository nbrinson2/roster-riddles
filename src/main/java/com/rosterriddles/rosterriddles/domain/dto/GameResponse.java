package com.rosterriddles.rosterriddles.domain.dto;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class GameResponse {
    private final String id;
    private final String createdAt;
    private final String status;
    private final String timesViewedRoster;
    private final String numberOfGuesses;
    private final String userId;
}
