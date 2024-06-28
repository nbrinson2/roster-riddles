package com.rosterriddles.rosterriddles.domain.dto;

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
    private final Integer timesViewedActiveRoster;
    private final Integer numberOfGuesses;
    private final Long userId;
    private final Integer leagueId;
    private final Integer gameTypeId;
}
