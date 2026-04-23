import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';
import type { DeploymentEnvironment } from './environment.types';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
  gameplayTelemetry: true,
};

export const environment = {
  production: true,
  deployment: 'production' as DeploymentEnvironment,
  firestoreDatabaseId: "roster-riddles",
  baseUrl: "",
  stripePublishableKey: "",
  sendGameplayEvents: true,
  leaderboardPollIntervalMs: 0,
  leaderboardUseFirestoreSnapshot: false,
  leaderboardsUiEnabled: true,
  weeklyContestsUiEnabled: true,
  adminDashboardUiEnabled: true,
  /** Production: always false in CI output (`generate-env-prod.mjs`). Paid entry UX stays off until policy changes. */
  contestsPaymentsEnabled: false,
  /** Overwritten by `generate-env-prod.mjs` from `AUTH_SESSION_MAX_DAYS` (prod default 3 days if unset). */
  authSessionMaxMs: 3 * 24 * 60 * 60 * 1000,
  featureFlags,
  firebase: {
    apiKey: "x",
    authDomain: "x",
    projectId: "x",
    storageBucket: "x",
    messagingSenderId: "x",
    appId: "x",
    measurementId: "x",
  },
};
