import { Injectable } from "@angular/core";
import { HintService, HintType } from "../../shared/components/hint/hint.service";
import { SlideUpService } from "../../shared/components/slide-up/slide-up.service";
import { AttributesType, PlayerAttrColor, UiPlayer } from "../../shared/models/models";
import { EndResultMessage, InputPlaceHolderText } from "../util/util";
import { Headers } from "../util/util";
/**
 * Provides or holds the current player-to-guess.
 */
export interface PlayerProvider<PlayerType> {
  playerToGuess: PlayerType;
}

/**
 * Configuration for the GameEngineService—including attributes, compare logic,
 * player provider, and allowed guesses.
 */
export interface GameConfiguration<
  PlayerType extends UiPlayer<AttributesType>,
> {
  /** Attributes to compare (e.g. MlbPlayerAttr[]) */
  attributes: AttributesType[];

  /**
   * Function that takes the hidden target and a guessed player,
   * returning a map of attribute-to-color feedback.
   */
  compareFunction: (
    targetPlayer: PlayerType,
    guessedPlayer: PlayerType
  ) => Map<AttributesType, PlayerAttrColor>;

  /** Service or object that exposes the current hidden player */
  playerProvider: PlayerProvider<PlayerType>;

  /** Optional override of max allowed guesses (default = 9) */
  allowedGuesses?: number;
}

/**
 * Injectable Angular service containing the core guess-game logic.
 * Configure it once, then call startNewGame, handlePlayerSelection, etc.
 */
@Injectable({ providedIn: 'root' })
export class GameEngineService<
  PlayerType extends UiPlayer<AttributesType>,
> {

  get playerToGuess(): PlayerType {
    return this.gameConfiguration.playerProvider.playerToGuess;
  }

  public allPlayers: PlayerType[] = [];
  public guessablePlayers: PlayerType[] = [];
  public selectedPlayers: PlayerType[] = [];
  public numberOfGuesses = 0;
  public allowedGuesses = 9;
  public endResultText = EndResultMessage.WIN;
  public endOfGame = false;
  public isSearchDisabled = false;
  public searchInputPlaceHolderText: string = InputPlaceHolderText.GUESS;
  public headers = Headers;

  private gameConfiguration!:
    | GameConfiguration<PlayerType>;

  constructor(
    private slideUpService: SlideUpService,
    private hintService: HintService
  ) {}

  /** Supply configuration before using the engine */
  public configure(
    configuration: GameConfiguration<PlayerType>
  ): void {
    this.gameConfiguration = configuration;
    this.allowedGuesses = configuration.allowedGuesses ?? 9;
  }

  /** Set or reset the full list of possible players */
  public setAllPlayers(players: PlayerType[]): void {
    this.allPlayers = players;
  }

  /** Initialize or restart the game (requires configure() first) */
  public startNewGame(players?: PlayerType[]): void {
    if (!this.gameConfiguration) {
      throw new Error(
        'GameEngineService: must call configure() before starting a game'
      );
    }
    this.allPlayers = players ?? this.allPlayers;
    this.guessablePlayers = [...this.allPlayers];
    this.initializePlayerColorMaps();
    this.selectNewTargetPlayer();

    this.numberOfGuesses = 0;
    this.endOfGame = false;
    this.isSearchDisabled = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.selectedPlayers = [];
  }

  /** Filter out already guessed and by name */
  public filterPlayers(searchTerm: string | null): PlayerType[] {
    const term = searchTerm?.toLowerCase() ?? '';
    return this.guessablePlayers.filter(
      (player) =>
        !this.selectedPlayers.includes(player) &&
        (!searchTerm || player.name.toLowerCase().includes(term))
    );
  }

  /** Find an exact-match player by name */
  public findMatchingPlayer(
    playerName: string
  ): PlayerType | undefined {
    return this.filterPlayers(playerName).find(
      (p) => p.name === playerName
    );
  }

  /** Handle one guess: update feedback, check end-of-game */
  public handlePlayerSelection(player: PlayerType): void {
    if (!player || this.endOfGame || this.isSearchDisabled) {
      return;
    }
    if (this.selectedPlayers.length === 0) {
      this.hintService.showHint(HintType.COLOR_FEEDBACK);
    }
    this.numberOfGuesses++;
    const target = this.gameConfiguration.playerProvider.playerToGuess;
    player.colorMap = this.gameConfiguration.compareFunction(
      target,
      player
    );
    this.selectedPlayers.unshift(player);

    const colors = Array.from(player.colorMap.values());
    if (this.evaluateEndOfGame(colors)) {
      return;
    }
    this.searchInputPlaceHolderText =
      `${this.allowedGuesses - this.numberOfGuesses} ${InputPlaceHolderText.COUNT}`;
    this.propagateAttributeColors(player);
  }

  /** Propagate any non-NONE feedback to the remaining guessable players */
  private propagateAttributeColors(latestPlayer: PlayerType): void {
    const changedAttributes = this.gameConfiguration.attributes.filter(
      (key) =>
        latestPlayer.colorMap.get(key) !== PlayerAttrColor.NONE
    );

    for (const player of this.guessablePlayers) {
      for (const key of changedAttributes) {
        if ((player as any)[key] === (latestPlayer as any)[key]) {
          player.colorMap.set(
            key,
            latestPlayer.colorMap.get(key)!
          );
        }
      }
    }
  }

  /** Determine win/lose, flip flags, and show slide-up on loss */
  private evaluateEndOfGame(colorList: PlayerAttrColor[]): boolean {
    const hasWon =
      !colorList.includes(PlayerAttrColor.NONE) &&
      !colorList.includes(PlayerAttrColor.ORANGE);

    if (hasWon) {
      this.endResultText = EndResultMessage.WIN;
    } else if (this.numberOfGuesses >= this.allowedGuesses) {
      this.slideUpService.show();
      this.endResultText = EndResultMessage.LOSE;
    }

    if (hasWon || this.numberOfGuesses >= this.allowedGuesses) {
      this.endOfGame = true;
      this.searchInputPlaceHolderText = hasWon
        ? InputPlaceHolderText.WIN
        : InputPlaceHolderText.LOSE;
      this.isSearchDisabled = true;
      return true;
    }

    return false;
  }

  /** Initialize all players' colorMap to NONE */
  private initializePlayerColorMaps(): void {
    for (const player of this.guessablePlayers) {
      player.colorMap = new Map<AttributesType, PlayerAttrColor>();
      for (const key of this.gameConfiguration.attributes) {
        if (key !== ('name' as any)) {
          player.colorMap.set(key, PlayerAttrColor.NONE);
        }
      }
    }
  }

  /** Pick a new random target to guess */
  private selectNewTargetPlayer(): void {
    const index = Math.floor(Math.random() * this.allPlayers.length);
    this.gameConfiguration.playerProvider.playerToGuess =
      this.allPlayers[index];
  }
}
