package com.rosterriddles.rosterriddles.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class UserResponse {

    @JsonProperty("id")
    private final Long id;

    @JsonProperty("first_name")
    private final String firstName;

    @JsonProperty("last_name")
    private final String lastName;

    @JsonProperty("email")
    private final String email;

    @JsonProperty("created_at")
    private final LocalDateTime createdAt;

    @JsonProperty("total_games_played")
    private final int totalGamesPlayed;

    @JsonProperty("games_won")
    private final int gamesWon;

    @JsonProperty("games_lost")
    private final int gamesLost;

    @JsonProperty("total_guesses_made")
    private final int totalGuessesMade;

    @JsonProperty("total_roster_link_clicks")
    private final int totalRosterLinkClicks;

    @JsonProperty("last_active")
    private final LocalDateTime lastActive;

    @JsonProperty("user_role")
    private final String userRole;

    @JsonProperty("locked")
    private final Boolean locked;

    @JsonProperty("enabled")
    private final Boolean enabled;

    @JsonProperty("times_clicked_new_game")
    private final int timesClickedNewGame;

    @JsonProperty("current_streak")
    private final int currentStreak;

    @JsonProperty("max_streak")
    private final int maxStreak;

    @JsonProperty("win_percentage")
    private final double winPercentage;

    @JsonProperty("avg_number_of_guesses_per_game")
    private final double avgNumberOfGuessesPerGame;

    @JsonProperty("times_viewed_active_roster")
    private final int timesViewedActiveRoster;
}
