import { MlbPlayerAttr, PlayerAttrColor, MlbPlayer } from "../shared/mlb-models";
import { AttrHeader } from "../shared/models";
import { EndResultMessage } from "./constants";

export interface GameData {
  headers: AttrHeader[];
  guessablePlayers: MlbPlayer[];
  selectedPlayers: MlbPlayer[];
  playerToGuess: MlbPlayer;
  endResultText: EndResultMessage;
  endOfGame: boolean;
  isSearchDisabled: boolean;
  searchInputPlaceHolderText: string;
  numberOfGuesses: number;
  showNewGameButton: boolean;
  timesViewedActiveRoster: number;
}
 
 export interface GameCreateRequest {
    userId: number;
    leagueId: number;
    gameTypeId: number;
    playerToGuess: BaseballPlayerRequest;
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
  colorMap: Map<MlbPlayerAttr, PlayerAttrColor>;
}

// To be used when individual game statistics are implemented
export interface Player {
  id: number;
  name: string;
  team: string;
  position: string;
  age: number;
  countryOfBirth: string;
}
