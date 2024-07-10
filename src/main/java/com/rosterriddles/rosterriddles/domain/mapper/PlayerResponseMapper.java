package com.rosterriddles.rosterriddles.domain.mapper;

import com.rosterriddles.rosterriddles.domain.dto.PlayerResponse;
import com.rosterriddles.rosterriddles.domain.entity.Player;

public class PlayerResponseMapper {
   public static PlayerResponse mapToPlayerResponse(Player player) {
      return PlayerResponse.builder()
            .id(player.getId())
            .build();
   }
}
