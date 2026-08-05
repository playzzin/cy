import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { DEFAULT_MENU_CONFIG } from '../src/constants/defaultMenu';

dotenv.config({ path: '.env' });

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

async function seed() {
    try {
        console.log(`Seeding menus_v12 to ${firebaseConfig.projectId}...`);
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        
        await setDoc(doc(db, 'settings', 'menus_v12'), {
            updatedAt: new Date().toISOString(),
            items: DEFAULT_MENU_CONFIG
        });
        
        console.log('Seeded successfully!');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
seed();
