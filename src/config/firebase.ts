import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { app } from './firebaseBase';

export { app };

export const auth = getAuth(app);
export const storage = getStorage(app);
const createFirestore = () => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: {
        timeoutSeconds: 25,
      },
      ignoreUndefinedProperties: true,
    });
  } catch (error) {
    return getFirestore(app);
  }
};

export const db = createFirestore();

// Kakao Functions are in asia-northeast3
export const functions = getFunctions(app, 'asia-northeast3');

const shouldUseEmulators =
  process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true';

if (shouldUseEmulators) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;


