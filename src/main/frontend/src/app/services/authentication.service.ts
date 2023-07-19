import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from 'src/environment';
import { AuthHeader, LoginResponse, RegisterResponse, UserLoginRequest, UserRegisterRequest } from '../authentication/authentication-models';
import { User } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private readonly baseUrl = environment.baseUrl;
  private readonly registerEndpoint = '/auth/register';
  private readonly loginEndpoint = '/auth/login';
  private token = '';

  constructor(private http: HttpClient) { }

  public register(request: UserRegisterRequest): Observable<RegisterResponse> {
    const reqUrl = `${this.baseUrl}${this.registerEndpoint}`;
    return this.http.post<RegisterResponse>(reqUrl, request);
  }

  public login(request: UserLoginRequest): Observable<User> {
    const reqUrl = `${this.baseUrl}${this.loginEndpoint}`;
    return this.http.post<LoginResponse>(reqUrl, request).pipe(
      map(data => {
        const user: User = {
          id: data.user_id,
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          statistics: {
            userId: data.statistics.user_id,
            currentStreak: data.statistics.current_streak,
            maxStreak: data.statistics.max_streak,
            totalWins: data.statistics.total_wins,
            totalLosses: data.statistics.total_losses,
            winPercentage: data.statistics.win_percentage,
            avgNumberOfGuessesPerGame: data.statistics.avg_number_of_guesses_per_game,
            timesViewedActiveRoster: data.statistics.times_viewed_active_roster,
            timesClickedNewGame: data.statistics.times_clicked_new_game,
          }
        };
        this.token = data.access_token;

        return user;
      })
    );
  }

  public getHeaders() {
    return { 'Authorization': 'Bearer ' + this.token };
  }
}
