package com.rosterriddles.rosterriddles.domain.model;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class GameCreateResponse {
    private final String id;
    private final String createdAt;
    private final String status;
    private final String timesViewedRoster;
    private final String numberOfGuesses;
    private final String userId;
}
