import { getApps, initializeApp } from 'firebase/app';
import { assertDeploymentEnvironment } from './deploymentEnvironment';
import { isDevPreviewFrame } from '../utils/devPreviewRuntime';
import { resolveFirebaseAuthDomain } from './firebaseAuthDomain';

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
  if (process.env.REACT_APP_PRIVATE_REVIEW === 'true' && !isDevPreviewFrame) {
    throw new Error('비공개 검증 주소에서 조회 전용 세션을 다시 시작해 주세요.');
  }
  const existing = getApps().filter(candidate => candidate.name === (isDevPreviewFrame ? 'cy-dev-preview' : '[DEFAULT]'));
  if (existing.length > 0) {
    if (existing[0].options?.projectId) assertDeploymentEnvironment(existing[0].options.projectId, typeof window === 'undefined' ? '' : window.location.hostname);
    return existing[0];
  }
  assertDeploymentEnvironment(requireEnv('REACT_APP_FIREBASE_PROJECT_ID'), typeof window === 'undefined' ? '' : window.location.hostname);

  const measurementId = process.env.REACT_APP_FIREBASE_MEASUREMENT_ID;
  const firebaseConfig = {
    apiKey: requireEnv('REACT_APP_FIREBASE_API_KEY'),
    authDomain: resolveFirebaseAuthDomain(
      requireEnv('REACT_APP_FIREBASE_PROJECT_ID'),
      requireEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
      typeof window === 'undefined' ? '' : window.location.hostname,
    ),
    projectId: requireEnv('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('REACT_APP_FIREBASE_APP_ID'),
    ...(measurementId ? { measurementId } : {})
  };

  return initializeApp(firebaseConfig, isDevPreviewFrame ? 'cy-dev-preview' : '[DEFAULT]');
})();

export default app;
