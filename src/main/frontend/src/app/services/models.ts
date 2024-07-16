import { EndResultMessage, InputPlaceHolderText } from "../home/util/util";
import { PlayerAttr, PlayerAttrColor, UiPlayer } from "../models/models";

export interface GameData {
  headers: Header[];
  guessablePlayers: UiPlayer[];
  selectedPlayers: UiPlayer[];
  playerToGuess: UiPlayer;
  endResultText: EndResultMessage;
  endOfGame: boolean;
  isSearchDisabled: boolean;
  searchInputPlaceHolderText: string;
  numberOfGuesses: number;
  showNewGameButton: boolean;
  timesViewedActiveRoster: number;
}

export interface Header {
  name: string;
  colSpan: number;
  class: string;
}

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

 export interface GameUpdateRequest {
  status: string;
  timesViewedActiveRoster: number;
  numberOfGuesses: number;
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
  IN_PROCESS = 'IN_PROCESS',
  ABANDONED = 'ABANDONED',
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

export enum LeagueType {
  NHL = 'NHL',
  NBA = 'NBA',
  NFL = 'NFL',
  MLB = 'MLB',
}

export interface League {
  id: number;
  leagueName: LeagueType;
}

export interface GuessCreateRequest {
  player: BaseballPlayerRequest;
  isCorrect: boolean;
  colorMap: string;
}

export interface BaseballPlayerRequest extends PlayerRequest {
  team: string;
  position: string;
  battingHand: string;
  throwingHand: string;
  leagueDivision: string;
}

export interface PlayerRequest {
  type: PlayerType;
  name: string;
  age: number;
  countryOfBirth: string;
}

export enum PlayerType {
  BASEBALL = 'baseballPlayer',
}

export interface GuessResponse {
  id: number;
  game_id: number;
  guess_number: number;
  guessed_player_id: number;
  correct: boolean;
  league_id: number;
  timestamp: string;
  roster_link?: string;
  color_map: string;
}

export interface Guess {
  id: number;
  gameId: number;
  guessNumber: number;
  guessedPlayerId: number;
  correct: boolean;
  leagueId: number;
  timestamp: Date;
  rosterLink?: string;
  colorMap: Map<PlayerAttr, PlayerAttrColor>;
}

export interface Player {
  id: number;
  name: string;
  team: string;
  position: string;
  age: number;
  countryOfBirth: string;
}
