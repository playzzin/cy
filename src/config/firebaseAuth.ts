import { connectAuthEmulator, getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { app } from './firebaseBase';
import { isDevPreviewFrame, previewAuthFacade } from '../utils/devPreviewRuntime';

export const rawAuth = isDevPreviewFrame ? initializeAuth(app, { persistence: inMemoryPersistence }) : getAuth(app);
export const auth = previewAuthFacade(rawAuth);

if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true') {
  connectAuthEmulator(rawAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
