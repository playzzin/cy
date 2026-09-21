import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { randomUUID } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';

const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const officeRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', 'systemadmin', '관리자', '사장', '대표', 'ceo', '실장', '개발', '개발자', '시스템관리자', 'office', 'officestaff', '사무실', '사무실직원', '사무직원', '사무', 'payrollmanager', '급여담당', '정산담당', '정산관리자', 'finance', 'financemanager', 'accounting', 'accountingmanager', '회계', '재무', '경리', '회계담당', '재무담당']);
export function signatureWorkerId(path: string): string {
    const match = /^signatures\/([a-zA-Z0-9_-]+)\/[a-zA-Z0-9_.-]+\.png$/.exec(path)
        || /^signatures\/([a-zA-Z0-9_-]+)_\d+\.png$/.exec(path);
    if (!match) return fail('invalid-argument', '서명 경로를 확인해 주세요.');
    return match[1];
}
async function authorize(transaction: FirebaseFirestore.Transaction, uid: string, workerId: string) {
    const db = admin.firestore();
    const [user, menu, worker] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'), db.collection('workers').doc(workerId));
    const profile = user.data();
    const privileged = resolvedRoleNames(profile, menu.data()).some(role => officeRoles.has(role.toLowerCase().replace(/[\s_-]/g, '')));
    if (!profile || profile.status !== 'active' || !worker.exists || (!privileged && (!Array.isArray(profile.linkedWorkerIds) || !profile.linkedWorkerIds.includes(workerId)))) {
        fail('permission-denied', '이 작업자의 서명에 접근할 권한이 없습니다.');
    }
    return worker.ref;
}

export async function handleWorkerSignature(input: any, context: functions.https.CallableContext) {
    const { uid } = requireCallableAuth(context);
    const db = admin.firestore(), bucket = admin.storage().bucket();
    if (input?.action === 'read') {
        const path = String(input.path || '');
        const workerId = signatureWorkerId(path);
        await db.runTransaction(transaction => authorize(transaction, uid, workerId));
        const file = bucket.file(path);
        const [metadata] = await file.getMetadata();
        if (Number(metadata.size) > 2 * 1024 * 1024) fail('failed-precondition', '서명 파일 크기를 확인해 주세요.');
        const [bytes] = await file.download();
        return { dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
    }
    if (input?.action !== 'save') fail('invalid-argument', '지원하지 않는 요청입니다.');
    const workerId = String(input.workerId || '');
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(workerId)) fail('invalid-argument', '작업자를 확인해 주세요.');
    const encoded = String(input.dataUrl || '');
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(encoded) || encoded.length > 3_000_000) fail('invalid-argument', 'PNG 서명 파일을 확인해 주세요.');
    const bytes = Buffer.from(encoded.split(',')[1], 'base64');
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.length > 2 * 1024 * 1024) fail('invalid-argument', 'PNG 서명 파일을 확인해 주세요.');
    await db.runTransaction(transaction => authorize(transaction, uid, workerId));
    const path = `signatures/${workerId}/${randomUUID()}.png`;
    await bucket.file(path).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'image/png' } });
    const signatureUrl = `gs://${bucket.name}/${path}`;
    await db.runTransaction(async transaction => {
        const worker = await authorize(transaction, uid, workerId);
        const agreedAt = new Date().toISOString();
        const updates: Record<string, any> = { signatureUrl, signatureUpdatedAt: agreedAt };
        if (['administrator', 'worker_direct'].includes(input.options?.source)) updates.signatureSource = input.options.source;
        if (input.options?.consent) {
            const consent: Record<string, any> = { version: 1, agreedAt };
            for (const key of ['documentText', 'documentDate', 'workMonth', 'siteName', 'mandataryName', 'workerName']) consent[key] = String(input.options.consent[key] || '').slice(0, key === 'documentText' ? 20000 : 500);
            updates.signatureConsent = consent;
        }
        transaction.update(worker, updates);
    });
    return { signatureUrl };
}
export const workerSignatures = protectedRegion.https.onCall(handleWorkerSignature);
