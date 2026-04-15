import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';
import { firebaseConfig } from './config/firebase.staging';
import type { DeploymentEnvironment } from './environment.types';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
};

export const environment = {
  production: false,
  /** Local `ng serve` — uses **staging** Firebase (`config/firebase.staging.ts`) and `(default)` Firestore. */
  deployment: 'development' as DeploymentEnvironment,
  /** Staging project (Spark): single `(default)` database. */
  firestoreDatabaseId: '(default)',
  baseUrl: 'http://localhost:7070/api/v1',
  featureFlags,
  firebase: firebaseConfig,
};
