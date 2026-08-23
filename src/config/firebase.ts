import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { app } from './firebaseBase';
import { auth } from './firebaseAuth';

export { app };
export { auth };
export const storage = getStorage(app);
const createFirestore = () => {
  try {
    return initializeFirestore(app, {
      // Preserve proxy compatibility without forcing slower long-polling on healthy networks.
      experimentalAutoDetectLongPolling: true,
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
  // Keep browser E2E on one hermetic Firebase project. Connecting Functions
  // alone would authenticate against production while reading/writing local
  // services, which makes the real create→save→reload scenario impossible to
  // verify and can mask permission regressions.
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export default app;


