import { initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';

if (window.location.hostname !== '127.0.0.1') throw new Error('This test page only runs on loopback.');
const app = initializeApp({ projectId: 'demo-taxinvoice-issue-e2e', apiKey: 'demo-only' });
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
connectFirestoreEmulator(db, '127.0.0.1', 18086);
