package com.rosterriddles.rosterriddles.service;

import java.text.DecimalFormat;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.domain.dto.UserStatisticsResponse;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.enums.GameStatus;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class UserStatisticsService {

    private final UserService userService;

    public UserStatisticsResponse getUserStatistics(Long userId, List<Game> games) {
        UserStatisticsResponse response = UserStatisticsResponse.builder()
                .userId(userId)
                .currentStreak(calculateCurrentStreak(games))
                .maxStreak(calculateMaxStreak(games))
                .totalWins(calculateTotalWins(games))
                .totalLosses(calculateTotalLosses(games))
                .winPercentage(calculateWinPercentage(games))
                .avgNumberOfGuessesPerGame(calculateAvgNumberOfGuessesPerGame(games))
                .timesViewedActiveRoster(calculateTimesViewedActiveRoster(games))
                .timesClickedNewGame(getTimesClickedNewGame(userId))
                .build();
        return response;
    }

    private int calculateCurrentStreak(List<Game> games) {
        List<Game> sortedGames = games.stream()
                .sorted(Comparator.comparing(Game::getStartTime).reversed())
                .collect(Collectors.toList());
        int streak = 0;
        for (Game game : sortedGames) {
            if (game.getStatus() == GameStatus.WIN) {
                streak++;
                continue;
            }
            break;
        }

        return streak;
    }

    private int calculateMaxStreak(List<Game> games) {
        List<Game> sortedGames = games.stream()
                .sorted(Comparator.comparing(Game::getStartTime))
                .collect(Collectors.toList());
        int streak = 0;
        int maxStreak = 0;
        for (Game game : sortedGames) {
            if (game.getStatus() != GameStatus.WIN) {
                streak = 0;
                continue;
            }

            streak++;
            if (streak > maxStreak) {
                maxStreak = streak;
            }
        }
        return maxStreak;
    }

    private int calculateTotalWins(List<Game> games) {
        int wins = (int) games.stream()
                .filter(game -> game.getStatus() == GameStatus.WIN).count();
        return wins;
    }

    private int calculateTotalLosses(List<Game> games) {
        int losses = (int) games.stream()
                .filter(game -> game.getStatus() == GameStatus.LOSS).count();
        return losses;
    }

    private double calculateWinPercentage(List<Game> games) {
        int count = games.size();
        if (count == 0) {
            return 0;
        }
        int wins = (int) games.stream()
                .filter(game -> game.getStatus() == GameStatus.WIN).count();
        double winPercentage = (double) wins / count;
        DecimalFormat df = new DecimalFormat("#.##");

        return Double.valueOf(df.format(winPercentage));
    }

    private double calculateAvgNumberOfGuessesPerGame(List<Game> games) {
        int count = games.size();
        if (count == 0) {
            return 0;
        }
        int totalGuesses = games.stream()
                .mapToInt(Game::getNumberOfGuesses)
                .sum();
        return totalGuesses / count;
    }

    private int calculateTimesViewedActiveRoster(List<Game> games) {
        int totalTimesViewedActiveRoster = games.stream()
                .mapToInt(Game::getTimesViewedActiveRoster)
                .sum();
        return totalTimesViewedActiveRoster;
    }

    private int getTimesClickedNewGame(Long userId) {
        return userService.loadUserById(userId).getTimesClickedNewGame();
    }
}
