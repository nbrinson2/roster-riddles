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
   * Story AD-4 — hide admin dashboard entry (staging/prod: `ADMIN_DASHBOARD_UI_ENABLED` via `generate-env-prod.mjs`).
   * Local dev: set `false` here to simulate a build with the flag off.
   */
  adminDashboardUiEnabled: true,
  featureFlags,
  firebase: firebaseConfig,
};
