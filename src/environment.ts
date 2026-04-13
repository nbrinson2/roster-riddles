import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';
import { firebaseConfig } from './config/firebase.development';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
};

export const environment = {
  production: false,
  baseUrl: 'http://localhost:7070/api/v1',
  featureFlags,
  firebase: firebaseConfig,
};
