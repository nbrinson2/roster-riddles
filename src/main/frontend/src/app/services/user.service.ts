import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment';
import { AuthenticationService } from './authentication.service';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  statistics: UserStatistics;
}

export interface UserStatistics {
  currentStreak: number;
  maxStreak: number;
  totalWins: number;
  totalLosses: number;
  winPercentage: number;
  avgNumberOfGuessesPerGame: number;
  timesViewedActiveRoster: number;
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
    const response = this.http.get<User>(reqUrl, {headers});
    return response;
  }
}
