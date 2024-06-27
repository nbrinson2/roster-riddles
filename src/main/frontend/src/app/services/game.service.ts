import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environment';
import { AuthenticationService } from './authentication.service';
import { Observable, map } from 'rxjs';
import { Game, GameCreateRequest, GameResponse, GameStatus } from './models';

@Injectable({
   providedIn: 'root'
})
export class GameService {
   private readonly baseUrl = environment.baseUrl;
   private readonly gameEndpoint = '/games';

   constructor(private http: HttpClient, private auth: AuthenticationService) { }

   public createGame(request: GameCreateRequest): Observable<Game> {
      const headers = this.auth.getHeaders();
      const reqUrl = `${this.baseUrl}${this.gameEndpoint}`;
      const response = this.http.post<GameResponse>(reqUrl, request, { headers });

      return response.pipe(map((gameResponse) => {
         return {
            id: gameResponse.id,
            startTime: new Date(gameResponse.start_time),
            endTime: gameResponse.end_time ? new Date(gameResponse.end_time) : null,
            status: gameResponse.status as GameStatus,
            remainingGuesses: gameResponse.remaining_guesses,
            numberOfGuesses: gameResponse.number_of_guesses,
            timesViewedActiveRoster: gameResponse.times_viewed_active_roster,
            userId: gameResponse.user_id,
            sportId: gameResponse.sport_id,
            gameTypeId: gameResponse.game_type_id,
         };
      }));
   }

}