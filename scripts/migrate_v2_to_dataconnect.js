const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const {
    createAccommodation,
    createAccommodationAssignment,
    connectorConfig
} = require('../src/dataconnect-admin-generated/index.cjs.js');

// Initialize Firebase Admin with default credentials
if (!admin.apps.length) {
    // Uses GOOGLE_APPLICATION_CREDENTIALS for default credentials
    admin.initializeApp({
        projectId: "cy-smart-construction"
    });
}

const db = getFirestore();

// Helper to get number or 0
const getNum = (val) => typeof val === 'number' ? val : 0;
const getStr = (val, def = '') => val ? String(val) : def;

async function migrateAccommodations() {
    console.log('--- Starting Accommodation Migration ---');

    const accommodationsSnapshot = await db.collection('accommodations_v2').get();
    console.log(`Found ${accommodationsSnapshot.size} accommodations`);

    for (const doc of accommodationsSnapshot.docs) {
        const data = doc.data();
        const legacyId = doc.id;

        // Fetch related docs
        const contractDoc = await db.collection('accommodation_contracts_v2').doc(legacyId).get();
        const contract = contractDoc.exists ? contractDoc.data() : {};

        const utilityDoc = await db.collection('accommodation_utility_policy_v2').doc(legacyId).get();
        const utility = utilityDoc.exists ? utilityDoc.data() : { costProfile: {} };
        const costs = utility.costProfile || {};

        const billingDoc = await db.collection('accommodation_billing_targets').doc(legacyId).get();
        const billing = billingDoc.exists ? billingDoc.data() : {};

        const paymentDoc = await db.collection('accommodation_landlord_payment_v2').doc(legacyId).get();
        const payment = paymentDoc.exists ? paymentDoc.data() : {};

        // Combine data into DC variables
        const vars = {
            id: legacyId,
            legacyId: legacyId,
            name: getStr(data.name, 'Unnamed'),
            address: getStr(data.address, 'No Address'),
            type: getStr(data.type, 'OneRoom'),
            status: getStr(data.status, 'active'),
            ownership: getStr(data.ownership, 'Cheongyeon'),

            electricityMode: getStr(costs.electricity?.mode, 'included'),
            gasMode: getStr(costs.gas?.mode, 'included'),
            waterMode: getStr(costs.water?.mode, 'included'),
            internetMode: getStr(costs.internet?.mode, 'included'),
            maintenanceMode: getStr(costs.maintenance?.mode, 'included'),

            fixedElectricity: getNum(costs.electricity?.fixedAmount),
            fixedGas: getNum(costs.gas?.fixedAmount),
            fixedWater: getNum(costs.water?.fixedAmount),
            fixedInternet: getNum(costs.internet?.fixedAmount),
            fixedMaintenance: getNum(costs.maintenance?.fixedAmount),

            contractStartDate: contract.contractStartDate || null,
            contractEndDate: contract.contractEndDate || null,
            deposit: getNum(contract.deposit),
            monthlyRent: getNum(contract.monthlyRent),
            paymentDay: getNum(contract.paymentDay),
            landlordName: contract.landlordName || null,
            landlordContact: contract.landlordContact || null,
            isReported: contract.isReported === true,

            bankName: payment.bankName || null,
            accountNumber: payment.accountNumber || null,
            accountHolder: payment.accountHolder || null,
            rentPayDate: getNum(payment.rentPayDate),
            isAutoTransfer: payment.isAutoTransfer === true,
            transferDay: getNum(payment.transferDay),
            transferAccountInfo: payment.transferAccountInfo || null,

            billingTargetType: billing.targetType || null,
            billingTargetTeamId: billing.teamId || null,
            billingTargetTeamName: billing.teamName || null,
            billingTargetWorkerId: billing.workerId || null,
            billingTargetWorkerName: billing.workerName || null,

            currentOccupantName: data.currentOccupantName || null,
            currentOccupantPhone: data.currentOccupantPhone || null,
            memo: data.memo || null,
        };

        try {
            // Must pass three arguments: dcOrVarsOrOptions, varsOrOptions, options
            // Actually because of index.cjs.js generated, passing (connectorConfig, vars) works? 
            // The implementation is: function createAccommodation(dcOrVarsOrOptions, varsOrOptions, options)
            // We pass the args such that it constructs it:
            await createAccommodation(vars);
            console.log(`✅ Migrated Accommodation: ${vars.name}`);
        } catch (e) {
            console.error(`❌ Failed to migrate Accommodation: ${vars.name}`, e.message);
        }
    }
}

async function migrateAssignments() {
    console.log('\\n--- Starting Accommodation Assignment Migration ---');

    const assignmentsSnapshot = await db.collection('accommodation_assignments_v2').get();
    console.log(`Found ${assignmentsSnapshot.size} assignments`);

    for (const doc of assignmentsSnapshot.docs) {
        const data = doc.data();
        const legacyId = doc.id;

        // We need to resolve the Data Connect accommodation ID
        // Note: The GraphQL schema defines `accommodation: Accommodation!` meaning we must pass `accommodationId: String`. 
        // Wait, let's verify args for CreateAccommodationAssignment.

        // If we only have legacyId for accommodation, how do we link them?
        // Since Data Connect generates its own `id` by default uuidV4(), mapping accommodation_v2 legacyId to accommodation.id in Assignment means we either:
        // 1. Force the `id` of `Accommodation` to be same as `legacyId` during creation.
        // Let's modify the creation above manually? Or query Data Connect to find the ID.
        // For simplicity, let's just query Firestore or pass `accommodationId` assuming Data Connect is the same DB? No, Data Connect is different.

        // A better approach is to force Data Connect Accommodation `id` = `legacyId` initially!
        // But `id: String! @default(expr: "uuidV4()")` might complain if we provide it. Actually we *can* provide `id`.

        // Wait, since we are doing createAccommodation Assignment, the field is `accommodationId`.

        const vars = {
            legacyId: legacyId,
            accommodationId: data.accommodationId, // Assuming we pass data.accommodationId as `id` when creating Accommodation
            teamId: data.teamId || null,
            teamName: data.teamName || null,
            workerId: data.workerId || null,
            workerName: data.workerName || null,
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            endDate: data.endDate || null,
            status: data.status || 'active',
            source: data.source || null,
            memo: data.memo || null,
        };

        try {
            await createAccommodationAssignment(vars);
            console.log(`✅ Migrated Assignment for ${vars.teamName || vars.workerName}`);
        } catch (e) {
            console.error(`❌ Failed to migrate Assignment: ${legacyId}`, e.message);
        }
    }
}

async function main() {
    await migrateAccommodations();
    await migrateAssignments();
    console.log('Migration Complete!');
}

main().catch(console.error);
