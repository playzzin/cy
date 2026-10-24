// QA entrypoint only. Every Firebase service is bound to the local demo emulators.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

export const app = initializeApp({ projectId: 'demo-client-workflow', apiKey: 'demo-only', authDomain: 'localhost', storageBucket: 'demo-client-workflow.appspot.com', appId: 'demo-client-workflow' });
export const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true });
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
connectFirestoreEmulator(db, '127.0.0.1', 18089);
export const storage = getStorage(app);
connectStorageEmulator(storage, '127.0.0.1', 19199);
export const functions = getFunctions(app, 'asia-northeast3');
connectFunctionsEmulator(functions, '127.0.0.1', 15019);
export default app;
