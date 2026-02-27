const fs = require('fs');
const http = require('http');

async function gqlRequest(mutationName, query, variables) {
    const postData = JSON.stringify({
        query: query,
        variables: variables,
        operationName: mutationName
    });

    const options = {
        hostname: 'localhost',
        port: 9399,
        path: '/graphql',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'x-firebase-auth-token': 'owner' // 에뮬레이터 인증 우회
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => resData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(resData);
                    if (parsed.errors) reject(new Error(JSON.stringify(parsed.errors)));
                    else resolve(parsed.data);
                } catch (e) {
                    reject(new Error(`응답 파싱 실패: ${resData}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

const CREATE_ACCOMMODATION = `
mutation CreateAccommodation(
  $id: String, $legacyId: String, $name: String!, $address: String!, $type: String!, $status: String!, $ownership: String!,
  $electricityMode: String!, $gasMode: String!, $waterMode: String!, $internetMode: String!, $maintenanceMode: String!,
  $deposit: Int!, $monthlyRent: Int!, $paymentDay: Int!, $isReported: Boolean!,
  $landlordName: String, $landlordContact: String, $bankName: String, $accountNumber: String, $accountHolder: String,
  $isAutoTransfer: Boolean, $transferDay: Int, $transferAccountInfo: String,
  $billingTargetType: String, $billingTargetTeamId: String, $billingTargetTeamName: String, $billingTargetWorkerId: String, $billingTargetWorkerName: String
) {
  accommodation_insert(data: {
    id: $id, legacyId: $legacyId, name: $name, address: $address, type: $type, status: $status, ownership: $ownership,
    electricityMode: $electricityMode, gasMode: $gasMode, waterMode: $waterMode, internetMode: $internetMode, maintenanceMode: $maintenanceMode,
    deposit: $deposit, monthlyRent: $monthlyRent, paymentDay: $paymentDay, isReported: $isReported,
    landlordName: $landlordName, landlordContact: $landlordContact, bankName: $bankName, accountNumber: $accountNumber, accountHolder: $accountHolder,
    isAutoTransfer: $isAutoTransfer, transferDay: $transferDay, transferAccountInfo: $transferAccountInfo,
    billingTargetType: $billingTargetType, billingTargetTeamId: $billingTargetTeamId, billingTargetTeamName: $billingTargetTeamName, 
    billingTargetWorkerId: $billingTargetWorkerId, billingTargetWorkerName: $billingTargetWorkerName
  })
}`;

const CREATE_ASSIGNMENT = `
mutation CreateAccommodationAssignment(
  $id: String, $legacyId: String, $accommodationId: String!, $workerName: String, $startDate: String!, $endDate: String, $status: String!
) {
  accommodationAssignment_insert(data: {
    id: $id, legacyId: $legacyId, accommodationId: $accommodationId, workerName: $workerName, startDate: $startDate, endDate: $endDate, status: $status
  })
}`;

async function runMigration() {
    console.log('--- HTTP 기반 마이그레이션 시작 ---');

    let rawData;
    try {
        rawData = JSON.parse(fs.readFileSync('./v2_schema.json', 'utf8'));
    } catch (e) {
        console.error('v2_schema.json 읽기 실패');
        return;
    }

    const collections = {};
    rawData.forEach(col => {
        collections[col.collectionName] = col.documents.reduce((acc, doc) => {
            const data = {};
            for (const key in doc.schema) {
                const val = doc.schema[key].preview;
                if (val === 'null') data[key] = null;
                else if (doc.schema[key].type === 'number') data[key] = Number(val);
                else if (doc.schema[key].type === 'boolean') data[key] = (val === 'true');
                else data[key] = val;
            }
            acc[doc.id] = data;
            return acc;
        }, {});
    });

    const getStr = (val, fallback = '') => (val === null || val === undefined ? fallback : String(val));
    const getNum = (val, fallback = 0) => (val === null || val === undefined ? fallback : Number(val));

    const accommodations = collections['accommodations_v2'] || {};
    for (const id in accommodations) {
        const acc = accommodations[id];
        const con = (collections['accommodation_contracts_v2'] || {})[id] || {};
        const util = (collections['accommodation_utility_policy_v2'] || {})[id] || {};
        const billing = (collections['accommodation_billing_targets'] || {})[id] || {};
        const pay = (collections['accommodation_landlord_payment_v2'] || {})[id] || {};

        const vars = {
            id: id,
            legacyId: id,
            name: getStr(acc.name, 'Unnamed'),
            address: getStr(acc.address),
            type: getStr(acc.type, 'OneRoom'),
            status: getStr(acc.status, 'active'),
            ownership: getStr(acc.ownership, 'Cheongyeon'),
            electricityMode: getStr(util.electricityMode, 'variable'),
            gasMode: getStr(util.gasMode, 'variable'),
            waterMode: getStr(util.waterMode, 'variable'),
            internetMode: getStr(util.internetMode, 'variable'),
            maintenanceMode: getStr(util.maintenanceMode, 'variable'),
            deposit: getNum(con.deposit),
            monthlyRent: getNum(con.monthlyRent),
            paymentDay: getNum(con.paymentDay, 1),
            isReported: !!con.isReported,
            landlordName: getStr(pay.landlordName),
            landlordContact: getStr(pay.landlordContact),
            bankName: getStr(pay.bankName),
            accountNumber: getStr(pay.accountNumber),
            accountHolder: getStr(pay.accountHolder),
            isAutoTransfer: !!pay.isAutoTransfer,
            transferDay: getNum(pay.transferDay, 1),
            transferAccountInfo: getStr(pay.transferAccountInfo),
            billingTargetType: getStr(billing.targetType, 'team'),
            billingTargetTeamId: getStr(billing.teamId),
            billingTargetTeamName: getStr(billing.teamName),
            billingTargetWorkerId: getStr(billing.workerId),
            billingTargetWorkerName: getStr(billing.workerName)
        };

        try {
            await gqlRequest('CreateAccommodation', CREATE_ACCOMMODATION, vars);
            console.log(`[숙소 완료] ${vars.name}`);
        } catch (e) {
            console.error(`[숙소 실패] ${vars.name}: ${e.message}`);
        }
    }

    const assignments = collections['accommodation_assignments_v2'] || {};
    for (const id in assignments) {
        const item = assignments[id];
        const vars = {
            id: id,
            legacyId: id,
            accommodationId: getStr(item.accommodationId),
            workerName: getStr(item.workerName),
            startDate: getStr(item.startDate, '2000-01-01'),
            endDate: item.endDate ? String(item.endDate) : null,
            status: getStr(item.status, 'active')
        };
        try {
            await gqlRequest('CreateAccommodationAssignment', CREATE_ASSIGNMENT, vars);
            console.log(`[배정 완료] ${vars.workerName}`);
        } catch (e) {
            console.error(`[배정 실패] ${vars.workerName}: ${e.message}`);
        }
    }

    console.log('--- 마이그레이션 종료 ---');
}

runMigration();
