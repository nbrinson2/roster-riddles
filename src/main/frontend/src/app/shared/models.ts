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

export interface AttrHeader {
  name: string;
  colSpan: number;
  class: string;
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
