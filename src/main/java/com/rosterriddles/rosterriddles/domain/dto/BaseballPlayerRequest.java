package com.rosterriddles.rosterriddles.domain.dto;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class BaseballPlayerRequest extends PlayerRequest {
	private String team;
   private String battingHand;
   private String throwingHand;
   private String leagueDivision;
   private String position;

   public BaseballPlayerRequest(String name, int age, String countryOfBirth, String team, String battingHand, String throwingHand, String leagueDivision, String position) {
      super(name, age, countryOfBirth);
      this.team = team;
      this.battingHand = battingHand;
      this.throwingHand = throwingHand;
      this.leagueDivision = leagueDivision;
      this.position = position;
  }
}
