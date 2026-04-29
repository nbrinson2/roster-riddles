import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';
import { firebaseConfig } from './config/firebase.staging';
import type { DeploymentEnvironment } from './environment.types';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
  /** When false, gameplay completion is not POSTed (see `GameplayTelemetryService`). */
  gameplayTelemetry: true,
};

export const environment = {
  production: false,
  /** Local `ng serve` — uses **staging** Firebase (`config/firebase.staging.ts`) and `(default)` Firestore. */
  deployment: 'development' as DeploymentEnvironment,
  /** Staging project (Spark): single `(default)` database. */
  firestoreDatabaseId: '(default)',
  /**
   * Empty string = same origin as `ng serve` (e.g. :4300) so `/api/*` hits `proxy.conf.json` → Express :3000.
   * Do not use `http://localhost:3000/...` from the browser (CORS); avoid a random port with nothing listening.
   */
  baseUrl: '',
  /** Set to `false` to skip gameplay telemetry POSTs without changing feature flags. */
  sendGameplayEvents: true,
  /** Stripe.js publishable key (`pk_test_…`); baked at CI build via `STRIPE_PUBLISHABLE_KEY` for staging/prod. */
  stripePublishableKey: '',
  /**
   * Story E1 — optional HTTP poll of `GET /api/v1/leaderboards` (ms). `0` = off.
   * Ignored when `leaderboardUseFirestoreSnapshot` is true.
   */
  leaderboardPollIntervalMs: 0,
  /**
   * Story E1 — when true, leaderboard panel listens to precomputed B2 docs under leaderboards/snapshots/boards (see docs) instead of the HTTP API (D1).
   * **Development:** false (use HTTP + proxy). **Staging:** false via `build:staging`. **Production:** true via `generate-env-prod.mjs` (listener on snapshot docs).
   */
  leaderboardUseFirestoreSnapshot: false,
  /**
   * Story G2 — hide left-nav leaderboard panel (staging/prod: set via `LEADERBOARDS_UI_ENABLED` at build).
   */
  leaderboardsUiEnabled: true,
  /**
   * Story C2 — hide weekly contests drawer (staging/prod: `WEEKLY_CONTESTS_UI_ENABLED` via `generate-env-prod.mjs`).
   */
  weeklyContestsUiEnabled: true,
  /**
   * When false, omit simulated / dry-run contest UX (hero disclaimer, “Simulated prizes” strip taglines,
   * “(simulated)” entry-fee phrasing, dry-run payout headings). Weekly contests UI still follows
   * `weeklyContestsUiEnabled`. Staging/prod: `SIMULATED_CONTESTS_UI_ENABLED` via `generate-env-prod.mjs`.
   */
  simulatedContestsUiEnabled: false,
  /**
   * Phase 0 — “Weekly contest” segment in the leaderboard sidenav panel (live table comes in Phase 1).
   * Requires `weeklyContestsUiEnabled`. Staging/prod: `LEADERBOARD_CONTEST_TAB_ENABLED` via `generate-env-prod.mjs` (omit or not `false` = on).
   */
  leaderboardContestTabEnabled: true,
  /**
   * Phase 3 — optional HTTP poll of `GET /api/v1/contests/:contestId/leaderboard` while the weekly
   * contest tab is open (ms). `0` = off. Staging/prod: `CONTEST_LIVE_LEADERBOARD_POLL_MS` via `generate-env-prod.mjs` (default 30s when unset).
   */
  contestLiveLeaderboardPollIntervalMs: 30_000,
  /**
   * Story P5-D2 — paid entry via Stripe Checkout. When true, contests with `entryFeeCents > 0` use
   * `POST .../checkout-session` + redirect; requires server `CONTESTS_PAYMENTS_ENABLED=true`.
   * Staging/production CI: set `CONTESTS_PAYMENTS_ENABLED` at Docker/build time (`generate-env-prod.mjs` → `contestsPaymentsEnabled`; Cloud Build default `true` — see `weekly-contests-gl-c1-production-paid-ui-build.md`).
   */
  contestsPaymentsEnabled: true,
  /**
   * Story AD-4 — hide admin dashboard entry (staging/prod: `ADMIN_DASHBOARD_UI_ENABLED` via `generate-env-prod.mjs`).
   * Local dev: set `false` here to simulate a build with the flag off.
   */
  adminDashboardUiEnabled: true,
  /**
   * Max time (ms) from Firebase ID token `authTime` before forced `signOut`. `0` = no limit.
   * Staging/prod: `AUTH_SESSION_MAX_DAYS` via `generate-env-prod.mjs` (production defaults to 3 days if unset).
   */
  authSessionMaxMs: 0,
  featureFlags,
  firebase: firebaseConfig,
};
