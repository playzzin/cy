import admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'cyee-9c1e4';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(firestoreHost)
  || !/^(127\.0\.0\.1|localhost):\d+$/.test(authHost)) {
  throw new Error('construction-plan-e2e-seed-refuses-nonlocal-emulator');
}

process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;

const appName = `construction-plan-e2e-${process.pid}`;
const app = admin.initializeApp({ projectId }, appName);
const auth = app.auth();
const db = app.firestore();
db.settings({ ignoreUndefinedProperties: true });

const email = process.env.CONSTRUCTION_PLAN_E2E_EMAIL || 'construction-plan-e2e@example.com';
const password = process.env.CONSTRUCTION_PLAN_E2E_PASSWORD || 'ConstructionPlan-E2E-2026!';
const now = admin.firestore.Timestamp.now();

let user;
try {
  user = await auth.getUserByEmail(email);
  user = await auth.updateUser(user.uid, { password, displayName: '시공계획서 E2E 관리자', disabled: false });
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error;
  user = await auth.createUser({ email, password, displayName: '시공계획서 E2E 관리자', emailVerified: true });
}

await auth.setCustomUserClaims(user.uid, { role: 'admin', erpRoleGroups: ['admin'] });

const batch = db.batch();
batch.set(db.collection('users').doc(user.uid), {
  uid: user.uid,
  email,
  name: '시공계획서 E2E 관리자',
  displayName: '시공계획서 E2E 관리자',
  role: 'admin',
  roles: ['admin'],
  erpRoleGroups: ['admin'],
  status: 'active',
  updatedAt: now,
  createdAt: now,
}, { merge: true });

batch.set(db.collection('companies').doc('company-client-e2e'), {
  id: 'company-client-e2e', name: 'E2E 발주 주식회사', code: 'E2E-CLIENT',
  businessNumber: '111-22-33333', representativeName: '발주대표', address: '서울특별시 중구',
  phone: '02-0000-0001', type: 'client', status: 'active', createdAt: now, updatedAt: now,
});
batch.set(db.collection('companies').doc('company-contractor-e2e'), {
  id: 'company-contractor-e2e', name: 'E2E 원도급 주식회사', code: 'E2E-CONTRACTOR',
  businessNumber: '444-55-66666', representativeName: '원도급대표', address: '서울특별시 강남구',
  phone: '02-0000-0002', type: 'contractor', status: 'active', createdAt: now, updatedAt: now,
});
batch.set(db.collection('companies').doc('company-partner-e2e'), {
  id: 'company-partner-e2e', name: '청연이엔지 E2E', code: 'E2E-PARTNER',
  businessNumber: '777-88-99999', representativeName: '협력대표', address: '경기도 성남시',
  phone: '031-000-0003', type: 'partner', status: 'active', createdAt: now, updatedAt: now,
});
batch.set(db.collection('teams').doc('team-e2e'), {
  id: 'team-e2e', name: 'E2E 시스템 시공팀', type: 'construction', status: 'active',
  leaderWorkerId: 'worker-e2e-manager', leaderName: '김현장',
  companyId: 'company-partner-e2e', companyName: '청연이엔지 E2E', createdAt: now, updatedAt: now,
});
batch.set(db.collection('sites').doc('site-e2e'), {
  id: 'site-e2e', name: 'E2E 시공계획 현장', code: 'SITE-E2E', status: 'active',
  address: '서울특별시 송파구 E2E로 1', startDate: '2026-08-01', endDate: '2027-02-28',
  buildings: ['101동', '102동'], floors: ['B2F', 'B1F', '1F'], zones: ['A구간', '램프구간'],
  responsibleTeamId: 'team-e2e', responsibleTeamName: 'E2E 시스템 시공팀',
  clientCompanyId: 'company-client-e2e', clientCompanyName: 'E2E 발주 주식회사',
  constructorCompanyId: 'company-contractor-e2e', contractorCompanyName: 'E2E 원도급 주식회사',
  partnerId: 'company-partner-e2e', partnerCompanyName: '청연이엔지 E2E',
  siteManagerId: 'worker-e2e-manager', createdAt: now, updatedAt: now,
});
batch.set(db.collection('workers').doc('worker-e2e-manager'), {
  id: 'worker-e2e-manager', uid: user.uid, name: '김현장', position: '현장대리인',
  role: 'site_manager', teamId: 'team-e2e', teamName: 'E2E 시스템 시공팀',
  siteId: 'site-e2e', status: 'active', createdAt: now, updatedAt: now,
});
batch.set(db.collection('workers').doc('worker-e2e-safety'), {
  id: 'worker-e2e-safety', name: '이안전', position: '안전관리자', role: 'safety_manager',
  teamId: 'team-e2e', teamName: 'E2E 시스템 시공팀', siteId: 'site-e2e',
  status: 'active', createdAt: now, updatedAt: now,
});
batch.set(db.collection('workers').doc('worker-e2e-quality'), {
  id: 'worker-e2e-quality', name: '박품질', position: '품질관리자', role: 'quality_manager',
  teamId: 'team-e2e', teamName: 'E2E 시스템 시공팀', siteId: 'site-e2e',
  status: 'active', createdAt: now, updatedAt: now,
});
await batch.commit();

console.log(JSON.stringify({
  projectId,
  firestoreHost,
  authHost,
  uid: user.uid,
  email,
  password,
  siteId: 'site-e2e',
}, null, 2));

await app.delete();
