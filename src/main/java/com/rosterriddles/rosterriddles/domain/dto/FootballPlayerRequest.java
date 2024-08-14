package com.rosterriddles.rosterriddles.domain.dto;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class FootballPlayerRequest extends PlayerRequest {
    private String team;
    private Integer jerseyNumber;
    private String college;
    private Integer draftYear;
    private String leagueDivision;
    private String position;

    public FootballPlayerRequest(String name, int age, String team, Integer jerseyNumber, String college, Integer draftYear,
            String leagueDivision, String position) {
        super(name, age);
        this.team = team;
        this.jerseyNumber = jerseyNumber;
        this.college = college;
        this.draftYear = draftYear;
        this.leagueDivision = leagueDivision;
        this.position = position;
    }
}
