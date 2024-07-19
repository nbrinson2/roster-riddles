package com.rosterriddles.rosterriddles.domain.dto;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class GameCreateRequest {
    private final Long userId;
    private final Long leagueId;
    private final Long gameTypeId;
    private final PlayerRequest playerToGuess;
}
