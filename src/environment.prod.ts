import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
};

export const environment = {
  production: true,
  baseUrl: "",
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
