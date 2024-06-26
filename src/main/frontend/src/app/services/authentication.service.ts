import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from 'src/environment';
import { AuthHeader, LoginResponse, RegisterResponse, UserLoginRequest, UserRegisterRequest, UserResponse } from '../authentication/authentication-models';
import { User } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private readonly baseUrl = environment.baseUrl;
  private readonly registerEndpoint = '/auth/register';
  private readonly loginEndpoint = '/auth/login';
  private token = '';
  private user: User | null = null;

  constructor(private http: HttpClient) { }

  public register(request: UserRegisterRequest): Observable<RegisterResponse> {
    const reqUrl = `${this.baseUrl}${this.registerEndpoint}`;
    return this.http.post<RegisterResponse>(reqUrl, request);
  }

  public login(request: UserLoginRequest): Observable<User> {
    const reqUrl = `${this.baseUrl}${this.loginEndpoint}`;
    return this.http.post<LoginResponse>(reqUrl, request).pipe(
      map(data => {
        const userResponse: UserResponse = data.user;
        const user: User = {
          id: userResponse.id,
          firstName: userResponse.first_name,
          lastName: userResponse.last_name,
          email: userResponse.email,
          createdAt: new Date(userResponse.created_at),
          userRole: userResponse.user_role,
          locked: userResponse.locked,
          enabled: userResponse.enabled,
          lastActive: new Date(userResponse.last_active),
          statistics: {
            totalGamesPlayed: userResponse.total_games_played,
            gamesWon: userResponse.games_won,
            gamesLost: userResponse.games_lost,
            totalGuessesMade: userResponse.total_guesses_made,
            totalRosterLinkClicks: userResponse.total_roster_link_clicks,
            timesClickedNewGame: userResponse.times_clicked_new_game,
            currentStreak: userResponse.current_streak,
            maxStreak: userResponse.max_streak,
            winPercentage: userResponse.win_percentage,
            avgNumberOfGuessesPerGame: userResponse.avg_number_of_guesses_per_game,
            timesViewedActiveRoster: userResponse.total_roster_link_clicks
          },
        }
        this.token = data.access_token;

        return user;
      })
    );
  }

  public getHeaders() {
    return { 'Authorization': 'Bearer ' + this.token };
  }
}
