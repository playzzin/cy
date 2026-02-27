import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { connectorConfig as localConnectorConfig } from '../dataconnect-generated';

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

const app = (() => {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const firebaseConfig = {
    apiKey: requireEnv('REACT_APP_FIREBASE_API_KEY'),
    authDomain: requireEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('REACT_APP_FIREBASE_APP_ID')
  };

  return initializeApp(firebaseConfig);
})();

export { app };

export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);

const DATA_CONNECT_DEFAULT_LOCATION = 'asia-northeast3';
const dataConnectLocationFromEnv =
  typeof process.env.REACT_APP_DATACONNECT_LOCATION === 'string'
    ? process.env.REACT_APP_DATACONNECT_LOCATION.trim()
    : '';
const dataConnectLocation =
  dataConnectLocationFromEnv && dataConnectLocationFromEnv !== 'us-central1'
    ? dataConnectLocationFromEnv
    : DATA_CONNECT_DEFAULT_LOCATION;

// NOTE: generated connectorConfig는 object export라 런타임에서 값을 덮어쓸 수 있음
(connectorConfig as any).location = dataConnectLocation;
(localConnectorConfig as any).location = dataConnectLocation;

export const dc = getDataConnect(app, connectorConfig);
// Kakao Functions are in asia-northeast3
export const functions = getFunctions(app, 'asia-northeast3');

const shouldUseEmulators =
  process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true';

if (shouldUseEmulators) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectDataConnectEmulator(dc, 'localhost', 9399);
}

export default app;
