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
public class UserStatisticsResponse {

    @JsonProperty("user_id")
    private Long userId;

    @JsonProperty("current_streak")
    private int currentStreak;

    @JsonProperty("max_streak")
    private int maxStreak;

    @JsonProperty("total_wins")
    private int totalWins;

    @JsonProperty("total_losses")
    private int totalLosses;

    @JsonProperty("win_percentage")
    private double winPercentage;

    @JsonProperty("avg_number_of_guesses_per_game")
    private double avgNumberOfGuessesPerGame;

    @JsonProperty("times_viewed_active_roster")
    private int timesViewedActiveRoster;

    @JsonProperty("times_clicked_new_game")
    private int timesClickedNewGame;
}
