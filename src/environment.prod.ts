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
  /** Overwritten by `generate-env-prod.mjs` from `STRIPE_PUBLISHABLE_KEY` — prod trigger should use `pk_live_…` ([`weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md`](../docs/weekly-contests/weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md)). */
  stripePublishableKey: "",
  sendGameplayEvents: true,
  leaderboardPollIntervalMs: 0,
  leaderboardUseFirestoreSnapshot: false,
  leaderboardsUiEnabled: true,
  weeklyContestsUiEnabled: true,
  /** Overwritten by `generate-env-prod.mjs` — production defaults to false unless `SIMULATED_CONTESTS_UI_ENABLED=true` (`weekly-contests-gl-c2-simulated-contests-ui-build.md`). */
  simulatedContestsUiEnabled: false,
  adminDashboardUiEnabled: true,
  /**
   * Checked-in placeholder before `generate-env-prod.mjs`. CI overwrites from `CONTESTS_PAYMENTS_ENABLED`
   * (Cloud Build defaults `true` — see `weekly-contests-gl-c1-production-paid-ui-build.md`). Local `ng build --configuration production` without generating env keeps paid UX off.
   */
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
