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
 