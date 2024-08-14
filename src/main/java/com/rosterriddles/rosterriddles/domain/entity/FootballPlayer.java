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
@Table(name = "football_players")
public class FootballPlayer extends Player {

  @Column(nullable = false, length = 10)
  private String team;

  @Column(nullable = false, length = 10)
  private Integer jerseyNumber;

  @Column(nullable = false, length = 255)
  private String college;

  @Column(nullable = false, length = 10)
  private Integer draftYear;

  @Column(nullable = false, length = 50)
  private String leagueDivision;

  @Column(nullable = false, length = 50)
  private String position;

  public FootballPlayer(String name, int age, League league, String team, Integer jerseyNumber,
      String college, Integer draftYear, String leagueDivision, String position) {
    super(name, age, league);
    this.team = team;
    this.jerseyNumber = jerseyNumber;
    this.college = college;
    this.draftYear = draftYear;
    this.leagueDivision = leagueDivision;
    this.position = position;
  }
}
