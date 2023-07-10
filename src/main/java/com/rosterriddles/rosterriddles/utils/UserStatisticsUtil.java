package com.rosterriddles.rosterriddles.utils;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import com.rosterriddles.rosterriddles.domain.model.Game;

public class UserStatisticsUtil {

    public static int calculateCurrentStreak(List<Game> games) {
        return 0;
    }

    public static int calculateMaxStreak(List<Game> games) {
        List<Game> sortedGames = games.stream()
                .sorted(Comparator.comparing(Game::getCreatedAt).reversed())
                .collect(Collectors.toList());
        int streak = 0;
        for (Game game : sortedGames) {
            if (game.getStatus() == GameStatus.WIN) {
                streak++;
            } else {
                streak = 0;
            }
        }
        
        return streak;
    }

    public static int calculateTotalWins(List<Game> games) {
        return 0;
    }

    public static int calculateTotalLosses(List<Game> games) {
        return 0;
    }

    public static double calculateWinPercentage(List<Game> games) {
        return 0;
    }

    public static double calculateAvgNumberOfGuessesPerGame(List<Game> games) {
        return 0;
    }

    public static int calculateTimesViewedActiveRoster(List<Game> games) {
        return 0;
    }

    public static int calculateTimesClickedNewGame(List<Game> games) {
        return 0;
    }
}
