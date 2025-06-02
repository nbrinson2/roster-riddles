import { Injectable, signal, Signal } from '@angular/core';
import { CommonGameService } from 'src/app/shared/services/common-game/common-game.service';
import { NicknameStreakPlayer } from '../models/nickname-streak.models';
import { GameService } from 'src/app/shared/utils/game-service.token';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';

@Injectable({
  providedIn: 'root',
})
export class NicknameStreakEngineService
  extends CommonGameService<NicknameStreakPlayer>
  implements GameService<NicknameStreakPlayer>
{
  get selectedPlayers(): Signal<NicknameStreakPlayer[]> {
    return this._selectedPlayers.asReadonly();
  }

  set selectedPlayers(players: NicknameStreakPlayer[]) {
    this._selectedPlayers.set(players);
  }

  get showAttributeHeader(): Signal<boolean> {
    return this._showAttributeHeader.asReadonly();
  }

  public allPlayers: NicknameStreakPlayer[] = [];
  public guessablePlayers: NicknameStreakPlayer[] = [];

  private _selectedPlayers = signal<NicknameStreakPlayer[]>([]);
  private _showAttributeHeader = signal<boolean>(false);

  constructor(slideUpService: SlideUpService) {
    super(slideUpService);
    this.currentGameMode = 'n/a';
  }

  public filterPlayers(searchTerm: string | null): NicknameStreakPlayer[] {
    if (!searchTerm) {
      return this.guessablePlayers;
    }

    return this.guessablePlayers.filter((player) =>
      player.nicknames.some((nickname) => nickname.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  public findMatchingPlayer(playerName: string): NicknameStreakPlayer | undefined {
    return this.filterPlayers(playerName).find((p) => p.name === playerName);
  }

  public handlePlayerSelection(player: NicknameStreakPlayer): void {
    // TODO: Implement
  }

  protected startNewGameNoMode(players?: NicknameStreakPlayer[]): void {
    this.allPlayers = players ?? this.allPlayers;
    this.guessablePlayers = [...this.allPlayers];
    this.selectNewTargetPlayer();
  }

  protected startNewGameEasy(players?: NicknameStreakPlayer[]): void {}
  protected startNewGameHard(players?: NicknameStreakPlayer[]): void {}
  protected updateStateAfterGuess(): void {}
  protected selectNewTargetPlayer(): void {}
}
