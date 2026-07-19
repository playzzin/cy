import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth';
import {
  arrayUnion,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-cy-bank';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

initializeAdminApp({ projectId });
const adminDb = getAdminFirestore();

const createClient = async (name, role, displayName) => {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId }, `bank-rules-${name}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${name}-${Date.now()}@example.test`,
    'rules-test-password',
  );
  await adminDb.collection('users').doc(credential.user.uid).set({
    uid: credential.user.uid,
    role,
    displayName,
    status: 'active',
  });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { app, auth, db, uid: credential.user.uid };
};

const expectAllowed = async (label, operation) => {
  try {
    await operation();
  } catch (error) {
    throw new Error(`${label} should be allowed, received ${error?.code || error}`, { cause: error });
  }
};

const expectDenied = async (label, operation) => {
  let denied = false;
  try {
    await operation();
  } catch (error) {
    denied = String(error?.code || '').includes('permission-denied');
  }
  assert.equal(denied, true, `${label} should be denied`);
};

const recipient = await createClient('finance', 'finance', '회계 사용자');
const outsider = await createClient('site', 'SITE_MANAGER', '현장 사용자');
const admin = await createClient('admin', 'admin', '관리자');
const now = AdminTimestamp.now();

await adminDb.collection('bank_transaction_candidates').doc('candidate-rules-test').set({
  status: 'pending',
  direction: 'deposit',
  amount: 1000,
  createdAt: now,
  updatedAt: now,
});
await adminDb.collection('erp_messages').doc('bank-rules-test').set({
  type: 'system',
  title: '국민은행 입금 알림',
  body: '새 입금 거래가 감지되었습니다.',
  senderId: 'system:bank-notification',
  senderName: '국민은행 알림',
  recipientScope: 'users',
  recipientIds: [recipient.uid],
  recipientNames: [],
  readBy: [],
  readAtBy: {},
  status: 'active',
  bankCandidateId: 'candidate-rules-test',
  createdAt: now,
  updatedAt: now,
});

await expectAllowed('configured recipient bank-message read', () => (
  getDoc(doc(recipient.db, 'erp_messages', 'bank-rules-test'))
));
await expectDenied('unconfigured user bank-message read', () => (
  getDoc(doc(outsider.db, 'erp_messages', 'bank-rules-test'))
));
await expectAllowed('admin bank-message read', () => (
  getDoc(doc(admin.db, 'erp_messages', 'bank-rules-test'))
));
await expectAllowed('recipient read receipt', () => updateDoc(
  doc(recipient.db, 'erp_messages', 'bank-rules-test'),
  {
    readBy: arrayUnion(recipient.uid),
    [`readAtBy.${recipient.uid}`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
));
await expectDenied('recipient bank-message content mutation', () => updateDoc(
  doc(recipient.db, 'erp_messages', 'bank-rules-test'),
  { body: '위조된 내용', updatedAt: serverTimestamp() },
));
await expectDenied('recipient bank-message delete', () => deleteDoc(
  doc(recipient.db, 'erp_messages', 'bank-rules-test'),
));

await expectAllowed('normal authenticated direct message', () => setDoc(
  doc(outsider.db, 'erp_messages', 'normal-rules-test'),
  {
    type: 'direct',
    title: '일반 메시지',
    body: '업무 메시지',
    senderId: outsider.uid,
    senderName: '현장 사용자',
    recipientScope: 'users',
    recipientIds: [recipient.uid],
    recipientNames: [],
    readBy: [outsider.uid],
    readAtBy: { [outsider.uid]: serverTimestamp() },
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
));
await expectDenied('client-authored bank-system spoof', () => setDoc(
  doc(outsider.db, 'erp_messages', 'spoof-rules-test'),
  {
    type: 'system',
    title: '가짜 은행 알림',
    body: '가짜 거래',
    senderId: 'system:bank-notification',
    recipientScope: 'users',
    recipientIds: [recipient.uid],
    readBy: [],
    readAtBy: {},
    bankCandidateId: 'fake',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
));

await expectAllowed('finance candidate review', () => updateDoc(
  doc(recipient.db, 'bank_transaction_candidates', 'candidate-rules-test'),
  {
    status: 'confirmed',
    reviewedBy: { uid: recipient.uid, displayName: recipient.auth.currentUser.email, email: recipient.auth.currentUser.email },
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
));
await expectDenied('site candidate mutation', () => updateDoc(
  doc(outsider.db, 'bank_transaction_candidates', 'candidate-rules-test'),
  { status: 'ignored', updatedAt: serverTimestamp() },
));

await expectDenied('finance global-settings write', () => setDoc(
  doc(recipient.db, 'bank_notification_settings', 'global'),
  {
    enabled: true,
    recipientIds: [recipient.uid],
    minimumAmount: 0,
    directions: ['deposit', 'withdrawal'],
    notifyOnParseFailure: true,
    quietHours: { enabled: false, start: '22:00', end: '07:00', timezone: 'Asia/Seoul' },
    updatedById: recipient.uid,
    updatedByName: '회계 사용자',
    updatedAt: serverTimestamp(),
  },
));
await expectAllowed('admin global-settings write', () => setDoc(
  doc(admin.db, 'bank_notification_settings', 'global'),
  {
    enabled: true,
    recipientIds: [recipient.uid],
    minimumAmount: 0,
    directions: ['deposit', 'withdrawal'],
    notifyOnParseFailure: true,
    quietHours: { enabled: false, start: '22:00', end: '07:00', timezone: 'Asia/Seoul' },
    updatedById: admin.uid,
    updatedByName: admin.auth.currentUser.email,
    updatedAt: serverTimestamp(),
  },
));

await expectAllowed('own push-device registration', () => setDoc(
  doc(recipient.db, 'notification_devices', 'web-rules-test'),
  {
    uid: recipient.uid,
    token: 'fcm-token-at-least-twenty-characters',
    platform: 'web',
    permission: 'granted',
    enabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  },
));
await expectDenied('other user push-device read', () => getDoc(
  doc(outsider.db, 'notification_devices', 'web-rules-test'),
));

await Promise.all([recipient, outsider, admin].map(({ auth }) => signOut(auth)));
console.log('Bank notification Firestore rule integration checks passed.');
