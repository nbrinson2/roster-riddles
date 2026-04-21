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
