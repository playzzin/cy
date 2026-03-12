import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "cyee-9c1e4"
    });
}

async function checkDatabases() {
    console.log('--- Checking for Multiple Firestore Databases ---');
    try {
        // Unfortunately, the Admin SDK doesn't have a direct "listDatabases" method in the basic Firestore client.
        // We usually use the project management API or the Node.js client with specific databaseId.
        // But we can try to access some common names or check the project metadata.

        // Let's try to check the default database first more thoroughly.
        const db = admin.firestore();
        const settings = await db.listCollections();
        console.log(`Default database has ${settings.length} collections.`);

        // Also check if there's any mention of other databases in the codebase.
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDatabases();
