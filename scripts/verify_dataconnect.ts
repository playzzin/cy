
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { connectorConfig, createCompany, Status } from '../src/dataconnect-admin-generated/index.cjs.js';
import { getDataConnect } from 'firebase-admin/data-connect';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// 주의: 이 스크립트를 실행하려면 Service Account Key가 필요합니다.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const SERVICE_ACCOUNT_PATH = './service-account.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service Account Key file not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const runVerification = async () => {
    try {
        console.log("🚀 Initializing Data Connect...");

        // Data Connect requires explicit initialization in Admin SDK sometimes, 
        // but the generated SDK might handle it if we pass the app.
        // Actually for Admin SDK, we often use the functions exported from generated SDK directly
        // but they need the DataConnect instance. 

        const dataConnect = getDataConnect(connectorConfig);

        console.log("🧪 testing CreateCompany mutation...");

        const companyName = `Test Company ${new Date().toISOString()}`;
        const result = await createCompany(dataConnect, {
            name: companyName,
            code: "TEST-001",
            type: "Partner", // If type is not restricted by enum, string is fine
            status: Status.ACTIVE
        });

        console.log("✅ Mutation Successful!");
        console.log("📝 Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Verification failed:', error);
    }
};

runVerification();
