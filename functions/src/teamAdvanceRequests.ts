import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';
import { list, text } from './teamReadPolicy';
import { requireWorkerRequestAccess } from './workerRequestAccess';

const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const id = (value: unknown) => {
    const result = text(value);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(result)) fail('invalid-argument', '신청 정보를 확인해 주세요.');
    return result;
};
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const cashKeys = ['corporateAdvance1', 'corporateAdvance2', 'corporateAdvance3', 'corporateAdvance4', 'laborAdvance1', 'laborAdvance2', 'laborAdvance3', 'laborAdvance4'];
const payrollRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', '관리자', '사장', '실장', 'office', 'officestaff', '사무', '사무실직원', 'payrollmanager', '급여담당', '정산담당', '정산관리자', 'finance', 'financemanager', 'accounting', 'accountingmanager', '회계', '재무', '경리', '회계담당', '재무담당']);

export function parseAdvanceRequestCategory(value: unknown): 'first' | 'second' | 'other' {
    if (value === undefined) return 'other'; // Older clients did not send a category.
    if (value === 'first' || value === 'second' || value === 'other') return value;
    return fail('invalid-argument', '신청 분류를 확인해 주세요.');
}

export function advanceRequestFingerprint(workerId: string, yearMonth: string, requestedAmount: number, memo: unknown, category: unknown): string {
    const values: unknown[] = [workerId, yearMonth, requestedAmount, text(memo)];
    // Preserve retries from older clients while binding new requests to their category.
    if (category !== undefined) values.push(parseAdvanceRequestCategory(category));
    return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

const storedCategory = (row: any) => row.category === 'first' || row.category === 'second' ? row.category
    : row.source === 'manual-prepayment' && row.category === 'other' ? 'other' : 'unclassified';
const requireRound = (value: unknown): 'first' | 'second' => value === 'first' || value === 'second' ? value
    : fail('invalid-argument', '화면을 새로고침하고 1회차 또는 2회차를 선택해 주세요. 선입금은 팀별 내역에서 입력합니다.');

async function requireSummaryWriteAccess(transaction: FirebaseFirestore.Transaction, uid: string, worker: any, privileged: boolean) {
    if (privileged) return;
    const db = admin.firestore();
    const staff = await transaction.get(db.collection('workers').where('uid', '==', uid).limit(2));
    const companyIds = [...new Set(staff.docs.map(doc => text(doc.data().companyId)).filter(Boolean))];
    const teamId = text(worker.teamId);
    if (!companyIds.length || !teamId || teamId.includes('/')) fail('permission-denied', '선입금 및 회차 수정 권한이 없습니다.');
    const [direct, legacy] = await Promise.all([transaction.get(db.doc(`teams/${teamId}`)), transaction.get(db.collection('teams').where('legacyId', '==', teamId))]);
    const companyId = text(direct.data()?.companyId || legacy.docs[0]?.data().companyId);
    if (!companyId || companyId.includes('/') || !companyIds.includes(companyId)) fail('permission-denied', '소속 시공사의 내역만 수정할 수 있습니다.');
    const company = await transaction.get(db.doc(`companies/${companyId}`));
    if (company.data()?.type !== '시공사') fail('permission-denied', '시공사 계정만 수정할 수 있습니다.');
}

export async function handleTeamAdvanceRequest(input: any, context: functions.https.CallableContext) {
    const { uid } = requireCallableAuth(context);
    const db = admin.firestore();
    if (!['create', 'cancel', 'setCategory', 'setPrepayment'].includes(input?.action)) fail('invalid-argument', '지원하지 않는 요청입니다.');
    const requestId = input.action === 'create'
        ? createHash('sha256').update(`${uid}:${id(input.requestId)}`).digest('hex') : input.action === 'setPrepayment'
            ? `prepayment_${createHash('sha256').update(`${id(input.workerId)}:${text(input.yearMonth)}`).digest('hex')}` : id(input.id);
    const ref = db.collection('advance_requests').doc(requestId);
    return db.runTransaction(async transaction => {
        const [profileSnapshot, menu, saved] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'), ref);
        const profile = profileSnapshot.data();
        if (!profile || profile.status !== 'active') fail('permission-denied', '활성 계정이 필요합니다.');
        const privileged = resolvedRoleNames(profile, menu.data()).some(role => payrollRoles.has(role.toLowerCase().replace(/[\s_-]/g, '')));
        if (input.action === 'setPrepayment') {
            const workerId = id(input.workerId), yearMonth = text(input.yearMonth);
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) fail('invalid-argument', '입력 월을 확인해 주세요.');
            const requestedAmount = input.amount, expectedAmount = input.expectedAmount;
            if (![requestedAmount, expectedAmount].every(value => Number.isSafeInteger(value) && value >= 0)) fail('invalid-argument', '선입금 금액을 확인해 주세요.');
            const worker = (await transaction.get(db.doc(`workers/${workerId}`))).data();
            if (!worker) return fail('not-found', '작업자를 찾을 수 없습니다.');
            await requireSummaryWriteAccess(transaction, uid, worker, privileged);
            const prior = saved.data();
            if (prior && (prior.source !== 'manual-prepayment' || prior.category !== 'other')) fail('failed-precondition', '선입금 원본을 확인해 주세요.');
            if ((prior?.requestedAmount ?? 0) !== expectedAmount) fail('aborted', '다른 화면에서 선입금이 변경되었습니다. 새로고침 후 다시 입력해 주세요.');
            const lock = db.doc(`server_settings/advance-request-${workerId}`);
            const revision = await transaction.get(lock);
            const now = admin.firestore.Timestamp.now();
            transaction.set(lock, { revision: (Number(revision.data()?.revision) || 0) + 1 });
            transaction.set(ref, { workerId, workerName: text(worker.name), teamId: text(worker.teamId), teamName: text(worker.teamName),
                yearMonth, periodStart: `${yearMonth}-01`, periodEnd: new Date(Date.UTC(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5)), 0)).toISOString().slice(0, 10),
                requestedAmount, category: 'other', source: 'manual-prepayment', status: 'paid', updatedAt: now, manualUpdatedById: uid,
                ...(!prior ? { createdAt: now, requesterUid: uid, memo: '', depositAccount: '' } : {}),
            }, { merge: true });
            return { id: ref.id, category: 'other' as const };
        }
        if (input.action === 'setCategory') {
            const row = saved.data();
            if (!row) return fail('not-found', '신청을 찾을 수 없습니다.');
            if (row.source === 'manual-prepayment' || !['requested', 'approved', 'paid'].includes(row.status)) fail('permission-denied', '유효한 가불 신청의 회차만 수정할 수 있습니다.');
            if (row.requesterUid !== uid || row.status !== 'requested') {
                const worker = (await transaction.get(db.doc(`workers/${id(row.workerId)}`))).data();
                if (!worker) return fail('not-found', '작업자를 찾을 수 없습니다.');
                await requireSummaryWriteAccess(transaction, uid, worker, privileged);
            }
            if (input.category === undefined || input.expectedCategory === undefined) fail('invalid-argument', '신청 분류를 확인해 주세요.');
            const category = requireRound(input.category);
            const current = storedCategory(row);
            const expected = input.expectedCategory;
            if (current !== expected) fail('aborted', '신청 분류가 변경되었습니다. 새로고침 후 다시 선택해 주세요.');
            transaction.update(ref, { category, categoryUpdatedAt: admin.firestore.Timestamp.now(), categoryUpdatedById: uid });
            return { id: ref.id, category };
        }
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
        await requireWorkerRequestAccess(transaction, profile, menu.data(), workerId, worker, privileged);
        const yearMonth = text(input.yearMonth);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) fail('invalid-argument', '신청 월을 확인해 주세요.');
        const requestedAmount = Number(input.requestedAmount);
        if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) fail('invalid-argument', '신청 금액을 확인해 주세요.');
        const category = requireRound(input.category);
        const fingerprint = advanceRequestFingerprint(workerId, yearMonth, requestedAmount, input.memo, input.category);
        if (saved.exists) {
            const row = saved.data()!;
            // Recover a retried request accepted by the old server before it stored categories.
            if (row.category === undefined && input.category !== undefined && row.status === 'requested'
                && row.requestFingerprint === advanceRequestFingerprint(workerId, yearMonth, requestedAmount, input.memo, undefined)) {
                transaction.update(ref, { category, requestFingerprint: fingerprint, categoryUpdatedAt: admin.firestore.Timestamp.now() });
                return { id: ref.id, category };
            }
            if (row.requestFingerprint !== fingerprint) fail('already-exists', '같은 신청 번호로 다른 내용을 저장할 수 없습니다.');
            return { id: ref.id, category: parseAdvanceRequestCategory(row.category) };
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
            yearMonth, periodStart, periodEnd, requestedAmount, category, currentMonthEarned, previousMonthEarned,
            earnedAmountSnapshot: earnedAmount, existingAdvanceAmountSnapshot: existingAdvanceAmount,
            activeRequestAmountSnapshot: activeRequestAmount, availableAmountSnapshot: availableAmount,
            bankName: text(worker!.bankName), accountNumber: text(worker!.accountNumber), accountHolder: text(worker!.accountHolder || worker!.name),
            memo: text(input.memo).slice(0, 1000), requestFingerprint: fingerprint, status: 'requested', createdAt: now, updatedAt: now,
        });
        return { id: ref.id, category };
    });
}

export const teamAdvanceRequests = protectedRegion.https.onCall(handleTeamAdvanceRequest);
