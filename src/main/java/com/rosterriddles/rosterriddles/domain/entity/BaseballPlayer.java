package com.rosterriddles.rosterriddles.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@Entity
@Table(name = "baseball_players")
public class BaseballPlayer extends Player {

   @Column(nullable = false, length = 10)
   private String team;

   @Column(nullable = false, length = 10)
   private String battingHand;

   @Column(nullable = false, length = 10)
   private String throwingHand;

   @Column(nullable = false, length = 50)
   private String leagueDivision;

   @Column(nullable = false, length = 50)
   private String position;

   public BaseballPlayer(String name, String team, String countryOfBirth, int age, League league,
         String battingHand, String throwingHand, String leagueDivision, String position) {
      super(name, countryOfBirth, age, league);
      this.team = team;
      this.battingHand = battingHand;
      this.throwingHand = throwingHand;
      this.leagueDivision = leagueDivision;
      this.position = position;
   }
}
