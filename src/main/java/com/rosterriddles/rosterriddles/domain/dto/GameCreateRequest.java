package com.rosterriddles.rosterriddles.domain.dto;

import com.rosterriddles.rosterriddles.domain.entity.GameType;
import com.rosterriddles.rosterriddles.domain.entity.Sport;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class GameCreateRequest {
    private final String userId;
    private final Sport sport;
    private final GameType gameType;
}
