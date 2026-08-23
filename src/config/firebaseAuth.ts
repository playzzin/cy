import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { app } from './firebaseBase';

export const auth = getAuth(app);

if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
