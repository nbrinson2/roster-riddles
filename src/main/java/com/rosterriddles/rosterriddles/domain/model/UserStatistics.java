package com.rosterriddles.rosterriddles.domain.model;

import com.rosterriddles.rosterriddles.utils.UserStatisticsUtil;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class UserStatistics {

    private Long userId;

    private int currentStreak;
    private int maxStreak;
    private int totalWins;
    private int totalLosses;
    private double winPercentage;
    private double avgNumberOfGuessesPerGame;
    private int timesViewedActiveRoster;
    private int timesClickedNewGame;

    public UserStatistics(Long userId, List<Game> games) {
        this.userId = userId;
        this.currentStreak = UserStatisticsUtil.calculateCurrentStreak(games);
        this.maxStreak = UserStatisticsUtil.calculateMaxStreak(games);
        this.totalWins = UserStatisticsUtil.calculateTotalWins(games);
        this.totalLosses = UserStatisticsUtil.calculateTotalLosses(games);
        this.winPercentage = UserStatisticsUtil.calculateWinPercentage(games);
        this.avgNumberOfGuessesPerGame = UserStatisticsUtil.calculateAvgNumberOfGuessesPerGame(games);
        this.timesViewedActiveRoster = UserStatisticsUtil.calculateTimesViewedActiveRoster(games);
        this.timesClickedNewGame = UserStatisticsUtil.calculateTimesClickedNewGame(games);
    }
}
