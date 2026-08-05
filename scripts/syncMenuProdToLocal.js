const { initializeApp: initAdminApp, cert } = require('firebase-admin/app');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');
const { initializeApp: initClientApp } = require('firebase/app');
const { getFirestore: getClientFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Temporarily remove FIRESTORE_EMULATOR_HOST to make sure that Prod fetch actually goes to Production
const originalEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIRESTORE_EMULATOR_HOST;

async function sync() {
    try {
        let prodData;
        
        // 1. Fetch from Prod
        const serviceAccountPath = 'c:/Users/playz/cy/firebase-admin-key.json';
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            const adminApp = initAdminApp({ credential: cert(serviceAccount) });
            const prodDb = getAdminFirestore(adminApp);
            const docSnap = await prodDb.collection('settings').doc('menus_v12').get();
            if(docSnap.exists) prodData = docSnap.data();
        } else {
            const firebaseConfig = {
                apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
                authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            };
            const clientApp = initClientApp(firebaseConfig, 'prod');
            const prodDb = getClientFirestore(clientApp);
            const snap = await getDoc(doc(prodDb, 'settings', 'menus_v12'));
            if(snap.exists()) prodData = snap.data();
        }

        if (!prodData) {
            console.log('No menus_v12 in prod DB');
            process.exit(0);
        }

        // 2. Set to Dev Server
        const devFirebaseConfig = {
            apiKey: process.env.REACT_APP_GOOGLE_API_KEY, // Or the dev one if available
            projectId: 'cyee-9c1e4',
        };
        const localApp = initClientApp(devFirebaseConfig, 'local');
        const localDb = getClientFirestore(localApp);
        
        await setDoc(doc(localDb, 'settings', 'menus_v12'), prodData);
        console.log('Successfully synced to Dev Firebase project (cyee-9c1e4)!');
        process.exit(0);
    } catch(e) {
        console.error('Error during sync:', e);
        process.exit(1);
    }
}
sync();
