import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AuthenticationService } from './authentication.service'
import { environment } from 'src/environment'
import { Observable, map } from 'rxjs'
import { Guess, GuessCreateRequest, GuessResponse } from './models'
import { MlbPlayerAttr, PlayerAttrColor } from '../shared/mlb-models'

@Injectable({
  providedIn: 'root',
})
export class GuessService {
  private readonly baseUrl = environment.baseUrl
  private readonly guessEndpoint = `/guesses`
  private readonly gameEndpoint = `/games`

  constructor(private http: HttpClient, private auth: AuthenticationService) {}

  public createGuess(gameId: number, guess: GuessCreateRequest): Observable<Guess> {
    const headers = this.auth.getHeaders()
    const reqUrl = `${this.baseUrl}${this.gameEndpoint}/${gameId}${this.guessEndpoint}`
    const response = this.http.post<GuessResponse>(
      reqUrl,
      { ...guess },
      { headers }
    )

    return response.pipe(map((response) => {
      return {
        id: response.id,
        gameId: response.game_id,
        guessNumber: response.guess_number,
        guessedPlayerId: response.guessed_player_id,
        correct: response.correct,
        leagueId: response.league_id,
        timestamp: new Date(response.timestamp),
        rosterLink: response.roster_link,
        colorMap: this.getColorMap(response.color_map),
      }
    }))
  }

  private getColorMap(colorMap: string): Map<MlbPlayerAttr, PlayerAttrColor> {
    const parsedArray: [MlbPlayerAttr, PlayerAttrColor][] = JSON.parse(colorMap);  
    return new Map<MlbPlayerAttr, PlayerAttrColor>(parsedArray);
  }
}
