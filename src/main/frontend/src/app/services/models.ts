export interface UserStatistics {
   totalGamesPlayed: number;
   currentStreak: number;
   maxStreak: number;
   gamesWon: number;
   gamesLost: number;
   winPercentage: number;
   totalGuessesMade: number;
   avgNumberOfGuessesPerGame: number;
   timesViewedActiveRoster: number;
   totalRosterLinkClicks: number;
   timesClickedNewGame: number;
 }
 
 export interface User {
   id: number;
   firstName: string;
   lastName: string;
   email: string;
   createdAt: Date;
   userRole: string;
   locked: boolean;
   enabled: boolean;
   lastActive: Date;
   statistics: UserStatistics;
 }
 
 export interface GameCreateRequest {
    userId: number;
    leagueId: number;
    gameTypeId: number;
 }

 export interface Game {
  id: number;
  startTime: Date;
  endTime: Date | null;
  status: GameStatus;
  remainingGuesses: number;
  numberOfGuesses: number;
  timesViewedActiveRoster: number;
  userId: number;
  leagueId: number;
  gameTypeId: number;
}

export enum GameStatus {
  WIN = 'WIN',
  LOSS = 'LOSS',
  IN_PROGRESS = 'IN_PROGRESS',
}

export interface GameResponse {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  remaining_guesses: number;
  number_of_guesses: number;
  times_viewed_active_roster: number;
  user_id: number;
  league_id: number;
  game_type_id: number;
}