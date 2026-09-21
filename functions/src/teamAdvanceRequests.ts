import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';
import { list, text } from './teamReadPolicy';

const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const id = (value: unknown) => {
    const result = text(value);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(result)) fail('invalid-argument', '신청 정보를 확인해 주세요.');
    return result;
};
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const cashKeys = ['corporateAdvance1', 'corporateAdvance2', 'corporateAdvance3', 'corporateAdvance4', 'laborAdvance1', 'laborAdvance2', 'laborAdvance3', 'laborAdvance4'];
const payrollRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', '관리자', '사장', '실장', 'office', 'officestaff', '사무', '사무실직원', 'payrollmanager', '급여담당', '정산담당', '정산관리자', 'finance', 'financemanager', 'accounting', 'accountingmanager', '회계', '재무', '경리', '회계담당', '재무담당']);

export async function handleTeamAdvanceRequest(input: any, context: functions.https.CallableContext) {
    const { uid } = requireCallableAuth(context);
    const db = admin.firestore();
    if (!['create', 'cancel'].includes(input?.action)) fail('invalid-argument', '지원하지 않는 요청입니다.');
    const requestId = input.action === 'create'
        ? createHash('sha256').update(`${uid}:${id(input.requestId)}`).digest('hex') : id(input.id);
    const ref = db.collection('advance_requests').doc(requestId);
    return db.runTransaction(async transaction => {
        const [profileSnapshot, menu, saved] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'), ref);
        const profile = profileSnapshot.data();
        if (!profile || profile.status !== 'active') fail('permission-denied', '활성 계정이 필요합니다.');
        const privileged = resolvedRoleNames(profile, menu.data()).some(role => payrollRoles.has(role.toLowerCase().replace(/[\s_-]/g, '')));
        if (input.action === 'cancel') {
            const row = saved.data();
            if (!row) return fail('not-found', '신청을 찾을 수 없습니다.');
            if (row.requesterUid !== uid) fail('permission-denied', '본인 신청만 취소할 수 있습니다.');
            if (row.status === 'cancelled') return { id: ref.id };
            if (row.status !== 'requested') fail('failed-precondition', '이미 처리된 신청은 취소할 수 없습니다.');
            transaction.update(ref, { status: 'cancelled', updatedAt: admin.firestore.Timestamp.now() });
            return { id: ref.id };
        }
        const workerId = id(input.workerId);
        const worker = (await transaction.get(db.collection('workers').doc(workerId))).data();
        if (!worker || worker.isActive === false || ['퇴사', 'inactive', 'retired', 'archived'].includes(text(worker.status))) fail('permission-denied', '활성 작업자 연결을 확인해 주세요.');
        const workerIds = [...new Set([workerId, text(worker!.legacyId)].filter(Boolean))];
        if (!privileged && !list(profile!.linkedWorkerIds).some(link => workerIds.includes(text(link)))) fail('permission-denied', '본인에게 연결된 작업자만 신청할 수 있습니다.');
        const yearMonth = text(input.yearMonth);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) fail('invalid-argument', '신청 월을 확인해 주세요.');
        const requestedAmount = Number(input.requestedAmount);
        if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) fail('invalid-argument', '신청 금액을 확인해 주세요.');
        const fingerprint = createHash('sha256').update(JSON.stringify([workerId, yearMonth, requestedAmount, text(input.memo)])).digest('hex');
        if (saved.exists) {
            if (saved.data()?.requestFingerprint !== fingerprint) fail('already-exists', '같은 신청 번호로 다른 내용을 저장할 수 없습니다.');
            return { id: ref.id };
        }
        const [year, month] = yearMonth.split('-').map(Number);
        const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
        const periodStart = `${previousMonth}-01`;
        const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
        // Serialize every month for this worker, including overlapping periods.
        const lock = db.doc(`server_settings/advance-request-${workerId}`);
        const [revision, reports, payments, requests] = await Promise.all([
            transaction.get(lock),
            transaction.get(db.collection('daily_reports').where('date', '>=', periodStart).where('date', '<=', periodEnd)),
            transaction.get(db.collection('advance_payments').where('workerId', 'in', workerIds)),
            transaction.get(db.collection('advance_requests').where('workerId', 'in', workerIds)),
        ]);
        let currentMonthEarned = 0, previousMonthEarned = 0;
        for (const report of reports.docs) {
            const row = report.data();
            const earned = list(row.workers).filter(entry => workerIds.includes(text(entry.workerId || entry.id)))
                .reduce((sum, entry) => sum + amount(Number(entry.manDay) * Number(entry.unitPrice)), 0);
            if (text(row.date).startsWith(yearMonth)) currentMonthEarned += earned;
            else previousMonthEarned += earned;
        }
        const existingAdvanceAmount = payments.docs.filter(doc => [yearMonth, previousMonth].includes(text(doc.data().yearMonth)))
            .reduce((sum, doc) => sum + cashKeys.reduce((cash, key) => cash + amount(doc.data().items?.[key]), 0), 0);
        const activeRequestAmount = requests.docs.map(doc => doc.data()).filter(row => ['requested', 'approved', 'paid'].includes(row.status))
            .filter(row => text(row.periodEnd || `${row.yearMonth}-31`) >= periodStart && text(row.periodStart || `${row.yearMonth}-01`) <= periodEnd)
            .reduce((sum, row) => sum + amount(row.requestedAmount), 0);
        const earnedAmount = currentMonthEarned + previousMonthEarned;
        const availableAmount = Math.max(0, Math.floor(earnedAmount - existingAdvanceAmount - activeRequestAmount));
        if (requestedAmount > availableAmount) fail('failed-precondition', '신청 가능액을 초과했습니다. 새로고침 후 확인해 주세요.');
        const now = admin.firestore.Timestamp.now();
        transaction.set(lock, { revision: (Number(revision.data()?.revision) || 0) + 1 });
        transaction.create(ref, {
            workerId, workerName: text(worker!.name), teamId: text(worker!.teamId), teamName: text(worker!.teamName),
            requesterUid: uid, requesterName: text(profile!.displayName || profile!.name), requesterEmail: text(profile!.email),
            yearMonth, periodStart, periodEnd, requestedAmount, currentMonthEarned, previousMonthEarned,
            earnedAmountSnapshot: earnedAmount, existingAdvanceAmountSnapshot: existingAdvanceAmount,
            activeRequestAmountSnapshot: activeRequestAmount, availableAmountSnapshot: availableAmount,
            bankName: text(worker!.bankName), accountNumber: text(worker!.accountNumber), accountHolder: text(worker!.accountHolder || worker!.name),
            memo: text(input.memo).slice(0, 1000), requestFingerprint: fingerprint, status: 'requested', createdAt: now, updatedAt: now,
        });
        return { id: ref.id };
    });
}

export const teamAdvanceRequests = protectedRegion.https.onCall(handleTeamAdvanceRequest);
