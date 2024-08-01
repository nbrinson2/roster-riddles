import { UserResponse } from '../authentication/authentication-models'
import { User } from '../shared/models/models'

export function transformUserResponse(response: UserResponse): User {
  return {
    id: response.id,
    firstName: response.first_name,
    lastName: response.last_name,
    email: response.email,
    createdAt: new Date(response.created_at),
    userRole: response.user_role,
    locked: response.locked,
    enabled: response.enabled,
    lastActive: new Date(response.last_active),
    statistics: {
      totalGamesPlayed: response.total_games_played,
      gamesWon: response.games_won,
      gamesLost: response.games_lost,
      totalGuessesMade: response.total_guesses_made,
      totalRosterLinkClicks: response.total_roster_link_clicks,
      timesClickedNewGame: response.times_clicked_new_game,
      currentStreak: response.current_streak,
      maxStreak: response.max_streak,
      winPercentage: response.win_percentage,
      avgNumberOfGuessesPerGame: response.avg_number_of_guesses_per_game,
      timesViewedActiveRoster: response.total_roster_link_clicks,
    },
  }
}
