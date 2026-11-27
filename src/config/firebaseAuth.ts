import {
  browserLocalPersistence, browserSessionPersistence, connectAuthEmulator,
  getAuth, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence,
} from 'firebase/auth';
import { app } from './firebaseBase';
import { TEAM_SITE_PATH } from '../constants/teamWorkflowActions';
import { isDevPreviewFrame, previewAuthFacade } from '../utils/devPreviewRuntime';
import { readGoogleLoginRedirect } from '../utils/googleLoginRedirect';

const initializeBrowserAuth = () => {
  if (typeof window === 'undefined' || window.location.pathname.replace(/\/+$/, '') !== TEAM_SITE_PATH || readGoogleLoginRedirect()) {
    return getAuth(app);
  }
  // Keep Firebase's normal session restoration. On this route, load the Google
  // popup/redirect resolver when used instead of opening its iframe on mobile startup.
  return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence] });
};

export const rawAuth = isDevPreviewFrame ? initializeAuth(app, { persistence: inMemoryPersistence }) : initializeBrowserAuth();
export const auth = previewAuthFacade(rawAuth);

if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true') {
  connectAuthEmulator(rawAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
