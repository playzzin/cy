import { getAuth } from 'firebase/auth';
import { app } from './firebaseBase';

export const auth = getAuth(app);
