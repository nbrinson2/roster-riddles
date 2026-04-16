import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { GameState } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import { FeatureFlagService } from 'src/app/shared/feature-flag/feature-flag.service';
import { GameService } from 'src/app/shared/utils/game-service.token';
import { GamePlayer } from 'src/app/shared/models/common-models';
import { environment } from 'src/environment';
import { Difficulty } from 'src/app/nav/difficulty-toggle/difficulty-toggle.component';

const SCHEMA_VERSION = 1;

/** Maps UI game type to API `gameMode` string. */
const gameTypeToApiMode: Record<GameType, string> = {
  [GameType.BIO_BALL]: 'bio-ball',
  [GameType.CAREER_PATH]: 'career-path',
  [GameType.NICKNAME_STREAK]: 'nickname-streak',
};

interface GameRouteContext {
  mode: string;
  league: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameplayTelemetryService {
  private clientSessionId: string | null = null;
  private roundStartedAt = 0;
  private terminalRecorded = false;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: Auth,
    private readonly router: Router,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  /** Call when a new round begins (after `startNewGame` finishes). */
  onRoundStarted(): void {
    if (!this.shouldSend()) {
      return;
    }
    this.clientSessionId = crypto.randomUUID();
    this.roundStartedAt = Date.now();
    this.terminalRecorded = false;
  }

  /** Win — call from `CommonGameService.onWin` after state is set. */
  recordWin(
    gameType: GameType,
    difficulty: Difficulty,
    mistakeCount: number,
  ): void {
    this.sendTerminal('won', gameType, difficulty, mistakeCount);
  }

  /** Loss — call from `CommonGameService.onLose` after state is set. */
  recordLoss(
    gameType: GameType,
    difficulty: Difficulty,
    mistakeCount: number,
  ): void {
    this.sendTerminal('lost', gameType, difficulty, mistakeCount);
  }

  /**
   * Leaving the game route while still PLAYING (navigation away mid-round).
   * Does not fire when the round already ended (won/lost) or when staying on the same game+league path.
   */
  tryRecordAbandonOnNavigate(
    fromUrl: string,
    toUrl: string,
    game: GameService<GamePlayer>,
  ): void {
    if (!this.shouldSend()) {
      return;
    }
    if (this.terminalRecorded || !this.clientSessionId) {
      return;
    }
    if (game.gameState() !== GameState.PLAYING) {
      return;
    }
    const toPath = toUrl.startsWith('/') ? toUrl : `/${toUrl}`;
    if (!this.isLeavingGameContext(fromUrl, toPath)) {
      return;
    }
    const gt = game.currentGame();
    const difficulty = game.currentGameMode();
    const mistakeCount = game.numberOfGuesses;
    this.sendTerminal('abandoned', gt, difficulty, mistakeCount);
  }

  private shouldSend(): boolean {
    if (!this.featureFlags.isEnabledSnapshot('gameplayTelemetry')) {
      return false;
    }
    if (environment.sendGameplayEvents === false) {
      return false;
    }
    return true;
  }

  private sendTerminal(
    result: 'won' | 'lost' | 'abandoned',
    gameType: GameType,
    difficulty: Difficulty,
    mistakeCount: number,
  ): void {
    if (!this.shouldSend() || !this.clientSessionId) {
      return;
    }
    if (this.terminalRecorded) {
      return;
    }
    const user = this.auth.currentUser;
    if (!user) {
      return;
    }

    this.terminalRecorded = true;

    const durationMs = Math.max(0, Date.now() - this.roundStartedAt);
    const url = this.router.url;
    const league = this.parseLeagueFromUrl(url);
    const gameMode = gameTypeToApiMode[gameType];
    if (!gameMode) {
      return;
    }

    const body: Record<string, unknown> = {
      schemaVersion: SCHEMA_VERSION,
      gameMode,
      result,
      durationMs,
      mistakeCount,
      clientSessionId: this.clientSessionId,
    };

    if (league) {
      body['league'] = league;
    }
    if (difficulty && difficulty !== 'n/a') {
      body['difficulty'] = difficulty;
    }
    body['deployment'] = environment.deployment;

    this.http.post(this.eventsUrl(), body).subscribe({
      error: (err: unknown) => {
        console.warn('[gameplay] Failed to record event', err);
      },
    });
  }

  private eventsUrl(): string {
    const base = environment.baseUrl?.trim() ?? '';
    if (!base) {
      return '/api/v1/me/gameplay-events';
    }
    return `${base.replace(/\/$/, '')}/me/gameplay-events`;
  }

  parseLeagueFromUrl(url: string): string | undefined {
    const m = url.match(
      /^\/(bio-ball|career-path|nickname-streak)\/([^/?#]+)/,
    );
    return m?.[2];
  }

  parseGameContext(url: string): GameRouteContext | null {
    const m = url.match(
      /^\/(bio-ball|career-path|nickname-streak)\/([^/?#]+)/,
    );
    if (!m) {
      return null;
    }
    return { mode: m[1], league: m[2] };
  }

  private isLeavingGameContext(fromUrl: string, toUrl: string): boolean {
    const fromCtx = this.parseGameContext(fromUrl);
    if (!fromCtx) {
      return false;
    }
    const toCtx = this.parseGameContext(toUrl);
    if (
      toCtx &&
      toCtx.mode === fromCtx.mode &&
      toCtx.league === fromCtx.league
    ) {
      return false;
    }
    return true;
  }
}
