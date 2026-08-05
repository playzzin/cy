import { getApps, initializeApp } from 'firebase/app';

const REQUIRED_ENV_KEYS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

const requireEnv = (key: RequiredEnvKey): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Firebase] Missing environment variable: ${key}. Create .env.local and set REACT_APP_FIREBASE_* values.`);
  }
  return value;
};

export const app = (() => {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const measurementId = process.env.REACT_APP_FIREBASE_MEASUREMENT_ID;
  const firebaseConfig = {
    apiKey: requireEnv('REACT_APP_FIREBASE_API_KEY'),
    authDomain: requireEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('REACT_APP_FIREBASE_APP_ID'),
    ...(measurementId ? { measurementId } : {})
  };

  return initializeApp(firebaseConfig);
})();

export default app;
