package com.rosterriddles.rosterriddles.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class PlayerResponse {

   @JsonProperty("id")
   private final Long id;
}
