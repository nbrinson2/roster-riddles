import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { UiPlayer } from '../models/models'
import { ActivatedRoute } from '@angular/router'
import { first } from 'rxjs'
import {
  Data,
  EndResultMessage,
  Header,
} from './util/util'
import { GameService } from '../services/game.service'
import { GameCreateRequest, LeagueType } from '../services/models'
import { AuthenticationService } from '../services/authentication.service'
import { ToastService } from '../services/toast.service'

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  @Output() selectRosterEvent = new EventEmitter<UiPlayer[]>()

  get headers(): Header[] {
    return this.gameService.gameData().headers;
  }

  get searchInputPlaceHolderText(): string {
    return this.gameService.gameData().searchInputPlaceHolderText;
  }

  get numberOfGuesses(): number {
    return this.gameService.gameData().numberOfGuesses;
  }

  get showNewGameButton(): boolean {
    return this.gameService.gameData().showNewGameButton;
  }

  get selectedPlayers(): UiPlayer[] {
    return this.gameService.gameData().selectedPlayers;
  }

  get playerToGuess(): UiPlayer {
    return this.gameService.gameData().playerToGuess;
  }
  
  get endResultText(): EndResultMessage {
    return this.gameService.gameData().endResultText;
  }

  get endOfGame(): boolean {
    return this.gameService.gameData().endOfGame;
  }

  get isSearchDisabled(): boolean {
    return this.gameService.gameData().isSearchDisabled;
  }

  get guessablePlayers(): UiPlayer[] {
    return this.gameService.gameData().guessablePlayers;
  }

  private allPlayers: UiPlayer[] = [];

  constructor(private route: ActivatedRoute, private gameService: GameService, private authService: AuthenticationService, private toastService: ToastService) {
    this.route.data.pipe(first()).subscribe((d) => {
      this.allPlayers = (d as Data).players;
    })
  }

  ngOnInit(): void {
    this.gameService.initializeGameData(LeagueType.MLB);
    this.gameService.updateGameDataField('guessablePlayers', this.allPlayers);
    this.setPlayerToGuess();
  }

  protected selectPlayer(player: UiPlayer): void {
    this.gameService.selectPlayer(player);
    this.toastService.showToast('Player selected');
  }

  protected startNewGame(): void {
    const newGameRequest: GameCreateRequest = {
      userId: this.authService.activeUser().id,
      leagueId: 1,
      gameTypeId: 1,
    }

    this.gameService.startNewGame(newGameRequest, this.authService.activeUser().id);
  }

  protected selectRoster(team: string): void {
    this.gameService.increaseNumberOfGuesses();

    if (this.gameService.isGameFinished()) {
      return;
    }

    this.gameService.setInProgressPlaceHolderText();

    const selectedRoster = this.allPlayers.filter(
      (player) => player.team === team
    )
    this.selectRosterEvent.emit(selectedRoster)
  }

  private setPlayerToGuess(): void {
    const randomIndex = Math.floor(
      Math.random() * this.allPlayers.length
    )
    this.gameService.setPlayerToGuess(this.allPlayers[randomIndex])
  }
}
