package com.rosterriddles.rosterriddles.domain.dto;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class GuessRequest {
   private final PlayerRequest player;
   private final Boolean isCorrect;
   private final String colorMap;
}
