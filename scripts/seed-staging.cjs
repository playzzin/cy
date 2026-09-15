// Create-only fixtures for the isolated project. Never copies production records.
const path = require('node:path');
const { clients, project } = require('./staging-project.cjs');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const month = '2026-09';
const teamId = '00000000-0000-4000-8000-000000000091';
const teamName = '검증 전용 가상팀';
async function stagingAdmin() {
    if (project !== 'cy-erp-staging-9c1e4') throw new Error('검증 프로젝트만 허용됩니다.');
    const { account, Client } = await clients();
    const { getAccessToken } = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
    const app = initializeApp({ projectId: project, credential: { getAccessToken: async () => {
        const token = await getAccessToken(account?.tokens?.refresh_token, []);
        return { access_token: token.access_token, expires_in: 3600 };
    } } }, 'cy-staging-admin');
    const rest = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
    const base = `/projects/${project}/databases/(default)/documents`;
    const encode = value => value === null ? { nullValue: null } : typeof value === 'string' ? { stringValue: value } : typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? { doubleValue: value } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
    const db = { doc: name => ({
        get: async () => {
            try { const result = await rest.get(`${base}/${name}`, { skipLog: { resBody: true } }); return { exists: true, data: result.body }; }
            catch (error) { if (error.status === 404 || /404|NOT_FOUND/.test(error.message)) return { exists: false }; throw error; }
        },
        delete: async () => rest.delete(`${base}/${name}`, { skipLog: { resBody: true } }),
        create: async value => rest.post(`${base}/${name.slice(0, name.lastIndexOf('/'))}`, { fields: encode(value).mapValue.fields }, { queryParams: { documentId: name.slice(name.lastIndexOf('/') + 1) }, skipLog: { reqBody: true, resBody: true } }),
    }) };
    return { app, account, auth: getAuth(app), db };
}
async function main() {
    const { app, account, auth, db } = await stagingAdmin();
    try {
        const email = account?.user?.email;
        if (!email) throw new Error('프로젝트 계정 확인 필요');
        let owner;
        try { owner = await auth.getUserByEmail(email); } catch (error) {
            if (error.code !== 'auth/user-not-found') throw error;
            owner = await auth.createUser({ email, emailVerified: true, displayName: '검증 서버 관리자' });
        }
        const now = new Date().toISOString();
        const utilityId = 'staging-utility-2026-09';
        const lodgingBillId = 'staging-accommodation-bill';
        const vehicleId = 'staging-vehicle';
        const vehicleBillId = 'staging-vehicle-bill';
        const rows = [
            [`users/${owner.uid}`, { uid: owner.uid, email, displayName: '검증 서버 관리자', role: 'admin', position: 'admin', accountType: 'office', status: 'active' }],
            [`teams/${teamId}`, { id: teamId, name: teamName, type: '시공팀', status: 'active', color: '#6366f1' }],
            ['accommodations/staging-room', { id: 'staging-room', name: '검증 숙소 · 가상자료', address: '시험용 주소', type: 'OneRoom', status: 'active', ownership: 'Cheongyeon', contract: { startDate: '2026-09-01', endDate: '2026-12-31', deposit: 0, monthlyRent: 300000, paymentDay: 1, landlordName: '가상 임대인', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'included', maintenance: 'included' } }],
            [`accommodationUtilityRecords/${utilityId}`, { id: utilityId, accommodationId: 'staging-room', accommodationName: '검증 숙소 · 가상자료', yearMonth: month, costs: { rent: 300000, electricity: 10000, gas: 0, water: 0, internet: 0, maintenance: 0, other: 0, total: 310000 }, paymentStatus: 'unpaid' }],
            ['accommodation_billing_targets/staging-room-target', { id: 'staging-room-target', accommodationId: 'staging-room', accommodationName: '검증 숙소 · 가상자료', targetType: 'team', teamId, teamName, startDate: '2026-09-01' }],
            ['accommodationAssignments/staging-room-assignment', { id: 'staging-room-assignment', accommodationId: 'staging-room', accommodationName: '검증 숙소 · 가상자료', workerId: '', teamId, teamName, source: 'team', startDate: '2026-09-01', status: 'active' }],
            [`accommodation_billing_documents/${lodgingBillId}`, { id: lodgingBillId, yearMonth: month, teamId, teamName, issuedToType: 'team', status: 'draft', memo: '전기료 1,000원 차이를 발견하는 시험 자료' }],
            ['accommodation_billing_line_items/staging-rent', { id: 'staging-rent', billingDocumentId: lodgingBillId, label: '검증 숙소 월세', amount: 300000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'staging-room', sourceUtilityRecordId: utilityId, status: 'active' }],
            ['accommodation_billing_line_items/staging-electricity', { id: 'staging-electricity', billingDocumentId: lodgingBillId, label: '검증 숙소 전기료', amount: 9000, targetField: 'electricity', sourceType: 'utility_ledger', sourceAccommodationId: 'staging-room', sourceUtilityRecordId: utilityId, status: 'active' }],
            [`vehicles/${vehicleId}`, { id: vehicleId, licensePlate: '검증00가0000', model: '가상 시험 차량', type: 'RENT', status: 'ASSIGNED', currentAssigneeType: 'TEAM', currentAssigneeId: teamId, currentAssigneeName: teamName, contract: { type: 'RENT', startDate: '2026-09-01', endDate: '2026-12-31', deposit: 0, monthlyFee: 300000, paymentDay: 1, financeCompany: { name: '가상 렌트사', contact: '' } } }],
            ['vehicleAssignments/staging-vehicle-assignment', { id: 'staging-vehicle-assignment', vehicleId, vehiclePlate: '검증00가0000', assigneeId: teamId, assigneeName: teamName, assigneeType: 'TEAM', startDate: '2026-09-01' }],
            [`vehicle_billing_documents/${vehicleBillId}`, { id: vehicleBillId, yearMonth: month, vehicleId, vehiclePlate: '검증00가0000', teamId, teamName, issuedToType: 'team', fixedCost: 300000, variableCost: 0, totalAmount: 300000, status: 'CONFIRMED', lineItems: [{ id: 'staging-vehicle-rent', label: '시험 렌트비', type: 'FIXED', category: 'RENT', amount: 300000, sourceType: 'vehicle_ledger', sourceLedgerRowId: `${vehicleId}:staging-vehicle-assignment`, sourceSegmentId: 'staging-vehicle-assignment', sourceStartDate: '2026-09-01', sourceEndDate: '2026-09-30' }] }],
            [`system_configs/team_settlement_${month}__${teamId}`, { id: `team_settlement_${month}__${teamId}`, data: JSON.stringify({ yearMonth: month, teamId, teamName, sales: [], purchases: [], deductions: [{ id: `vehicle_billing:${month}:${vehicleBillId}`, source: 'auto', origin: 'vehicle_billing', category: '시험 차량비', amount: 300000 }], additions: [], summary: { prevCarryover: 0, deposit: 0 }, confirmedAt: null, updatedAt: now }) }],
        ];
        let created = 0;
        for (const [name, value] of rows) {
            const ref = db.doc(name);
            if (!(await ref.get()).exists) { await ref.create(value); created += 1; }
        }
        console.log(`검증 전용 계정 준비 및 가상자료 ${created}건 생성 완료. 기존 시험 자료는 보존했습니다.`);
    } finally { await deleteApp(app); }
}
module.exports = { stagingAdmin };
if (require.main === module) main().catch(error => { console.error(`검증 자료 준비 실패 (${error.code || 'unknown'})`); process.exitCode = 1; });
