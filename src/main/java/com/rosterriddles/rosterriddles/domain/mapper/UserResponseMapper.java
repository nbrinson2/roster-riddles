package com.rosterriddles.rosterriddles.domain.mapper;

import java.util.Comparator;
import java.util.List;

import com.rosterriddles.rosterriddles.domain.dto.UserResponse;
import com.rosterriddles.rosterriddles.domain.entity.Game;
import com.rosterriddles.rosterriddles.domain.entity.User;
import com.rosterriddles.rosterriddles.domain.enums.GameStatus;
import com.rosterriddles.rosterriddles.service.GameService;

public class UserResponseMapper {
       public static UserResponse mapToUserResponse(User user, GameService gameService) {
        List<Game> games = gameService.getGamesByUserId(user.getId());
        int totalGamesPlayed = games.size();
        int gamesWon = (int) games.stream().filter(game -> game.getStatus().equals(GameStatus.WIN)).count();
        int gamesLost = (int) games.stream().filter(game -> game.getStatus().equals(GameStatus.LOSS)).count();
        int totalGuessesMade = games.stream().mapToInt(Game::getNumberOfGuesses).sum();
        int totalRosterLinkClicks = user.getTotalRosterLinkClicks();
        int currentStreak = getCurrentStreak(games);
        int maxStreak = getMaxWinStreak(games);
    
        double winPercentage = totalGamesPlayed > 0 ? (double) gamesWon / totalGamesPlayed : 0;
        double avgNumberOfGuessesPerGame = totalGamesPlayed > 0 ? (double) totalGuessesMade / totalGamesPlayed : 0;
    
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .createdAt(user.getCreatedAt())
                .totalGamesPlayed(totalGamesPlayed)
                .gamesWon(gamesWon)
                .gamesLost(gamesLost)
                .totalGuessesMade(totalGuessesMade)
                .totalRosterLinkClicks(totalRosterLinkClicks)
                .lastActive(user.getLastActive())
                .userRole(user.getUserRole().name())
                .locked(user.getLocked())
                .enabled(user.getEnabled())
                .timesClickedNewGame(user.getTimesClickedNewGame())
                .currentStreak(currentStreak)
                .maxStreak(maxStreak)
                .winPercentage(winPercentage)
                .avgNumberOfGuessesPerGame(avgNumberOfGuessesPerGame)
                .timesViewedActiveRoster(totalRosterLinkClicks)
                .build();
    }
    
    private static int getCurrentStreak(List<Game> games) {
        games.sort(Comparator.comparing(Game::getEndTime).reversed());

        int currentStreak = 0;

        for (Game game : games) {
            if (game.getStatus().equals(GameStatus.WIN)) {
                currentStreak++;
            } else {
                break; // Stop counting when the first non-win status is encountered
            }
        }

        return currentStreak;
    }

    private static int getMaxWinStreak(List<Game> games) {
        // Sort games by end time in ascending order (oldest first)
        games.sort(Comparator.comparing(Game::getEndTime));

        int maxStreak = 0;
        int currentStreak = 0;

        for (Game game : games) {
            if (game.getStatus().equals(GameStatus.WIN)) {
                currentStreak++;
                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                }
            } else {
                currentStreak = 0;
            }
        }

        return maxStreak;
    }

}
