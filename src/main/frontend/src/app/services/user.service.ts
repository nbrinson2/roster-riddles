import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environment';
import { AuthenticationService } from './authentication.service';

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


export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  totalGamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalGuessesMade: number;
  correctGuesses: number;
  incorrectGuesses: number;
  totalHintsUsed: number;
  totalRosterLinkClicks: number;
  totalPoints: number;
  lastActive: string;
  userRole: string;
  locked: boolean;
  enabled: boolean;
  timesClickedNewGame: number;
}


@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = environment.baseUrl;
  private readonly userEndpoint = '/user';
  private user?: User;

  constructor(private http: HttpClient, private auth: AuthenticationService) { }

  public getUser(): Observable<User> {
    const headers = this.auth.getHeaders();
    const reqUrl = `${this.baseUrl}${this.userEndpoint}`;
    
    return this.http.get<UserResponse>(reqUrl, { headers }).pipe(
      map(response => this.transformUserResponse(response))
    );
  }

  private transformUserResponse(response: UserResponse): User {
    return {
      id: response.id,
      firstName: response.firstName,
      lastName: response.lastName,
      email: response.email,
      createdAt: new Date(response.createdAt),
      userRole: response.userRole,
      locked: response.locked,
      enabled: response.enabled,
      lastActive: new Date(response.lastActive),
      statistics: {
        totalGamesPlayed: response.totalGamesPlayed,
        gamesWon: response.gamesWon,
        gamesLost: response.gamesLost,
        totalGuessesMade: response.totalGuessesMade,
        totalRosterLinkClicks: response.totalRosterLinkClicks,
        timesClickedNewGame: response.timesClickedNewGame,
        currentStreak: 0,
        maxStreak: 0,
        winPercentage: 0,
        avgNumberOfGuessesPerGame: 0,
        timesViewedActiveRoster: 0
      }
    };
  }
}
