package com.rosterriddles.rosterriddles.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthenticationResponse {

  @JsonProperty("access_token")
  private String accessToken;

  @JsonProperty("refresh_token")
  private String refreshToken;
  
  @JsonProperty("user_id")
  private String userId;
  
  @JsonProperty("first_name")
  private String firstName;
  
  @JsonProperty("last_name")
  private String lastName;
  
  @JsonProperty("email")
  private String email;

  @JsonProperty("statistics")
  private UserStatisticsResponse statistics;
}
