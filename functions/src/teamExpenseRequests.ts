import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { requireCallableAuth } from './auth';
import { analyzeExpenseReceipt } from './expenseReceiptAnalysis';
import { readRequestPage } from './teamRequestPagination';
import { maintainRequestDrafts } from './teamRequestDrafts';

const COLLECTION = 'team_expense_requests';
const RECEIPTS = 'team-expense-receipts';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const text = (value: unknown) => String(value ?? '').trim();
const teamColor = (value: unknown) => /^#[\da-f]{6}$/i.test(text(value)) ? text(value) : /^#[\da-f]{3}$/i.test(text(value)) ? `#${text(value).slice(1).split('').map(char => char + char).join('')}` : '#64748b';
const teamIcon = (data: any) => text(data?.iconKey || data?.icon).slice(0, 80) || 'fa-users';
const teamOption = (doc: FirebaseFirestore.DocumentSnapshot) => ({ id: doc.id, name: text(doc.data()?.name), color: teamColor(doc.data()?.color), icon: teamIcon(doc.data()) });
const key = (value: unknown) => text(value).toLowerCase().replace(/[\s_-]/g, '');
const isTeamLeader = (value: unknown) => ['팀장', '반장', 'teamlead', 'teamleader', 'foreman'].includes(key(value));
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const safeId = (value: unknown) => {
    const id = text(value);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) fail('invalid-argument', '요청 정보를 확인해 주세요.');
    return id;
};
const month = (value: unknown) => {
    const result = text(value);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(result)) fail('invalid-argument', '조회 월을 확인해 주세요.');
    return result;
};
const reviewerRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', 'systemadmin', '관리자', '사장', '대표', 'ceo', '실장', '개발', '개발자', '시스템관리자', 'office', 'officestaff', '사무실', '사무실직원', '사무직원', '사무', 'finance', 'financemanager', 'accounting', 'accountingmanager', '회계', '재무', '경리', '회계담당', '재무담당']);

export function resolvedRoleNames(profile: any, menu: any): string[] {
    const positions: Array<{ id: string; name: string }> = menu?.admin?.positionConfig || [];
    return ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions']
        .flatMap(field => Array.isArray(profile?.[field]) ? profile[field] : [profile?.[field]])
        .flatMap(role => [text(role), positions.find(position => role === position.id || role === `pos_${position.id}`)?.name || '']);
}
export async function requireCurrentReviewer(transaction: FirebaseFirestore.Transaction, uid: string) {
    const db = admin.firestore();
    const [profile, menu] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'));
    if (profile.data()?.status !== 'active' || !resolvedRoleNames(profile.data(), menu.data()).some(role => reviewerRoles.has(key(role)))) {
        fail('permission-denied', '현재 승인 권한이 없습니다. 다시 로그인해 주세요.');
    }
}

export async function actorFor(uid: string) {
    const db = admin.firestore();
    const profile = (await db.doc(`users/${uid}`).get()).data();
    if (!profile || profile.status !== 'active') fail('permission-denied', '활성 계정이 필요합니다.');
    const menu = (await db.doc('settings/menus_v12').get()).data();
    const positions: Array<{ id: string; name: string }> = menu?.admin?.positionConfig || [];
    const roles = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions']
        .flatMap(field => Array.isArray(profile![field]) ? profile![field] : [profile![field]]).map(text);
    const names = roles.flatMap(role => [role, positions.find(position => role === position.id || role === `pos_${position.id}`)?.name]);
    const canReview = names.some(role => reviewerRoles.has(key(role)));
    const links = Array.isArray(profile!.linkedWorkerIds) ? [...new Set<string>(profile!.linkedWorkerIds.map(text).filter(Boolean))] : [];
    if (links.length > 30) fail('failed-precondition', '작업자 연결 정보를 확인해 주세요.');
    const workers = links.length ? (await db.getAll(...links.map(id => db.collection('workers').doc(id)))).filter(doc => doc.exists).map(doc => doc.data()!).filter(worker => worker.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived'].includes(text(worker.status))) : [];
    const leader = names.some(isTeamLeader) || workers.some(worker => isTeamLeader(worker.role));
    if (!canReview && !leader) fail('permission-denied', '팀장 또는 사무실 직원만 이용할 수 있습니다.');
    const teamIds = [...new Set(workers.map(worker => text(worker.teamId)).filter(Boolean))];
    // Keep document IDs separate from legacy data-field queries: their mixed
    // OR query requires a production-only index that the emulator does not.
    const teamDocs = teamIds.length ? [
            ...await db.getAll(...teamIds.map(id => db.collection('teams').doc(id))),
            ...(await db.collection('teams').where('legacyId', 'in', teamIds).limit(100).get()).docs,
        ] : [];
    const teams = [...new Map(teamDocs.filter(doc => doc.exists && doc.data()?.isActive !== false).map(doc => [doc.id, { ...doc.data(), id: doc.id }])).values()];
    return { uid, name: text(profile!.name || profile!.displayName) || '사용자', canReview, teams: teams.map((team: any) => ({ id: team.id, name: text(team.name), color: teamColor(team.color), icon: teamIcon(team) })) };
}

async function categoriesFor() {
    const defaults = [
        { id: 'meal', label: '식대' }, { id: 'parking', label: '주차비' }, { id: 'toll', label: '통행료' },
        { id: 'fieldGoods', label: '현장물품' }, { id: 'etc', label: '기타' },
    ];
    const rows = new Map(defaults.map(row => [row.id, row]));
    const saved = await admin.firestore().collection('team_expense_categories').get();
    saved.docs.forEach(doc => {
        const data = doc.data();
        if (data.isActive === false || !['teamCharge', 'both'].includes(data.scope)) rows.delete(doc.id);
        else rows.set(doc.id, { id: doc.id, label: text(data.label) || doc.id });
    });
    return [...rows.values()];
}

export const validateExpenseReceipt = (contentType: string, encoded: string): Buffer => {
    if (encoded.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail('invalid-argument', '영수증은 파일당 5MB 이하로 올려 주세요.');
    const bytes = Buffer.from(encoded, 'base64');
    const valid = contentType === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : contentType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : contentType === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
                : contentType === 'application/pdf' && bytes.toString('ascii', 0, 5) === '%PDF-';
    if (!valid || bytes.length < 12 || bytes.length > MAX_FILE_BYTES) fail('invalid-argument', 'JPG, PNG, WEBP 이미지 또는 PDF 영수증을 올려 주세요.');
    return bytes;
};

export async function handleTeamExpenseRequest(input: any, context: functions.https.CallableContext) {
    const auth = requireCallableAuth(context);
    const actor = await actorFor(auth.uid);
    const db = admin.firestore();
    const action = text(input?.action);
    if (['drafts', 'discardDraft'].includes(action)) return maintainRequestDrafts(input, actor.canReview, COLLECTION, RECEIPTS);
    if (action === 'list') {
        const yearMonth = month(input.yearMonth);
        const scope = actor.canReview ? db.collection(COLLECTION).where('yearMonth', '==', yearMonth)
            : db.collection(COLLECTION).where('ownerUid', '==', actor.uid).where('yearMonth', '==', yearMonth);
        const snapshot = await readRequestPage(scope, input);
        const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any))
            .filter(row => row.yearMonth === yearMonth && ['pending', 'approved', 'rejected'].includes(row.status))
            .sort((a, b) => text(b.submittedAt || b.createdAt).localeCompare(text(a.submittedAt || a.createdAt)));
        // Old pages still use `teams` as the payer selector. New pages explicitly
        // request the minimal billing directory, without private team fields.
        let teams = actor.teams;
        if (actor.canReview || input.includeBillingTeams === true) {
            const directory = await db.collection('teams').select('name', 'color', 'icon', 'iconKey').limit(1001).get();
            if (directory.size > 1000) fail('resource-exhausted', '팀 목록이 많습니다. 사무실에 문의해 주세요.');
            teams = directory.docs.map(teamOption).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        }
        return { canReview: actor.canReview, payerTeams: actor.teams, teams, categories: await categoriesFor(), requests, nextCursor: snapshot.nextCursor };
    }
    if (action === 'receipt') {
        const ref = db.collection(COLLECTION).doc(safeId(input.id));
        const row = (await ref.get()).data();
        const sharedTeam = row?.status === 'approved' && actor.teams.some(team => [row.teamId, row.chargeToTeamId].includes(team.id));
        if (!row || (!actor.canReview && row.ownerUid !== actor.uid && !sharedTeam)) fail('permission-denied', '영수증 열람 권한이 없습니다.');
        const saved = (await ref.collection('receipts').doc(safeId(input.receiptId)).get()).data()?.attachment;
        if (!saved || !text(saved.fullPath).startsWith(`${RECEIPTS}/${row!.ownerUid}/${ref.id}/`)) fail('not-found', '영수증을 찾을 수 없습니다.');
        const [bytes] = await admin.storage().bucket().file(saved.fullPath).download();
        return { name: saved.name, contentType: saved.contentType, base64: bytes.toString('base64') };
    }
    if (action === 'review') {
        if (!actor.canReview) fail('permission-denied', '사무실 승인 권한이 필요합니다.');
        const ref = db.collection(COLLECTION).doc(safeId(input.id));
        const decision = text(input.decision);
        const reason = text(input.reason).slice(0, 500);
        if (!['approved', 'rejected'].includes(decision) || (decision === 'rejected' && !reason)) fail('invalid-argument', '반려 사유를 입력해 주세요.');
        return db.runTransaction(async transaction => {
            await requireCurrentReviewer(transaction, actor.uid);
            const row = (await transaction.get(ref)).data();
            if (!row) return fail('not-found', '신청을 찾을 수 없습니다.');
            if (row.ownerUid === actor.uid) fail('permission-denied', '본인 신청은 다른 사무실 직원이 승인해야 합니다.');
            if (row.status === decision) {
                if (decision === 'approved') {
                    const claim = row.claimId ? await transaction.get(db.collection('team_expense_claims').doc(safeId(row.claimId))) : null;
                    if (!claim?.exists || claim.data()?.sourceRequestId !== ref.id) fail('failed-precondition', '승인된 경비와 기존 경비내역의 연결을 확인할 수 없습니다. 사무실에서 확인해 주세요.');
                }
                return { id: ref.id, status: decision, claimId: row.claimId || null };
            }
            if (row.status !== 'pending') fail('failed-precondition', '이미 처리된 신청입니다. 새로고침해 주세요.');
            const now = new Date().toISOString();
            const claimId = `team-request-${ref.id}`;
            if (decision === 'approved') {
                const claimRef = db.collection('team_expense_claims').doc(claimId);
                if ((await transaction.get(claimRef)).exists) fail('already-exists', '이미 반영된 경비입니다.');
                const teams = await transaction.getAll(db.collection('teams').doc(safeId(row.teamId)), db.collection('teams').doc(safeId(row.chargeToTeamId || row.teamId)));
                if (teams.some(team => !team.exists)) fail('failed-precondition', '사용팀 또는 청구팀이 삭제되었습니다. 사무실에서 확인해 주세요.');
                transaction.create(claimRef, {
                    yearMonth: row.yearMonth, date: row.date, claimType: 'teamCharge',
                    payerTeamId: row.teamId, payerTeamName: row.teamName,
                    chargeToTeamId: row.chargeToTeamId || row.teamId, chargeToTeamName: row.chargeToTeamName || row.teamName,
                    category: row.category, description: row.description, amount: row.amount,
                    cardLabel: row.paymentMethod, memo: row.memo, attachments: row.attachments,
                    status: 'charged', sourceType: 'team_request', sourceRequestId: ref.id,
                    operationId: claimId, handledById: actor.uid, handledByName: actor.name,
                    handleMemo: reason, handledAt: Timestamp.now(),
                    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
                });
            }
            transaction.update(ref, { status: decision, reviewedBy: actor.uid, reviewerName: actor.name, reviewedAt: now, reviewReason: reason, claimId: decision === 'approved' ? claimId : null });
            return { id: ref.id, status: decision, claimId: decision === 'approved' ? claimId : null };
        });
    }
    if (!['upload', 'submit', 'analyze'].includes(action)) fail('invalid-argument', '지원하지 않는 요청입니다.');
    const team = actor.teams.find(team => team.id === text(input.teamId));
    if (!team) fail('permission-denied', '사용팀은 본인의 현재 소속팀이어야 합니다.');
    if (action === 'analyze') {
        const contentType = text(input.contentType);
        const base64 = text(input.base64);
        validateExpenseReceipt(contentType, base64);
        const { getServerGeminiSettings } = await import('./serverAiSettings');
        const settings = await getServerGeminiSettings();
        if (!settings.apiKey) fail('failed-precondition', '사무실에서 AI 설정의 서버 Gemini API 키를 등록해 주세요. 직접 입력으로도 신청할 수 있습니다.');
        const usage = db.doc(`server_settings/receipt-analysis-${createHash('sha256').update(actor.uid).digest('hex')}`);
        const now = Date.now();
        await db.runTransaction(async transaction => {
            const previous = (await transaction.get(usage)).data();
            const minute = Math.floor(now / 60_000), day = Math.floor(now / 86_400_000);
            const minuteCount = previous?.minute === minute ? Number(previous.minuteCount) || 0 : 0;
            const dayCount = previous?.day === day ? Number(previous.dayCount) || 0 : 0;
            if (minuteCount >= 10 || dayCount >= 100) fail('resource-exhausted', '영수증 분석 횟수가 많습니다. 잠시 뒤 다시 시도하거나 직접 입력해 주세요.');
            transaction.set(usage, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
        });
        return analyzeExpenseReceipt({ contentType, base64 }, await categoriesFor(), settings);
    }
    const requestId = safeId(input.requestId);
    const id = createHash('sha256').update(`${actor.uid}:${requestId}`).digest('hex');
    const ref = db.collection(COLLECTION).doc(id);
    if (action === 'upload') {
        const receiptId = safeId(input.receiptId);
        const contentType = text(input.contentType);
        const bytes = validateExpenseReceipt(contentType, text(input.base64));
        const digest = createHash('sha256').update(bytes).digest('hex');
        const receiptRef = ref.collection('receipts').doc(receiptId);
        // Lock ownership/team before storage writes. Submitted receipts cannot
        // be changed, even by retrying an earlier upload from another tab.
        const existing = await db.runTransaction(async transaction => {
            const row = (await transaction.get(ref)).data();
            const saved = (await transaction.get(receiptRef)).data();
            if (row && (row.ownerUid !== actor.uid || row.teamId !== team!.id)) fail('permission-denied', '신청 정보를 확인해 주세요.');
            if (['discarding', 'discarded'].includes(row?.status)) fail('failed-precondition', '정리 중인 임시 신청입니다. 새로 작성해 주세요.');
            if (saved) {
                if (saved.digest !== digest) fail('already-exists', '영수증 파일이 변경되었습니다. 새 신청으로 작성해 주세요.');
                if (row?.status === 'uploading') transaction.update(ref, { updatedAt: new Date().toISOString() });
                return saved;
            }
            if (row && row.status !== 'uploading') fail('failed-precondition', '제출된 신청의 영수증은 변경할 수 없습니다.');
            const uploaded = await transaction.get(ref.collection('receipts').limit(6));
            const uploadIds = [...new Set([...(Array.isArray(row?.uploadIds) ? row!.uploadIds : []), ...uploaded.docs.map(doc => doc.id), receiptId])];
            if (uploadIds.length > 5) fail('resource-exhausted', '한 신청에는 영수증을 최대 5개까지 올릴 수 있습니다.');
            if (!row) transaction.create(ref, { ownerUid: actor.uid, teamId: team!.id, status: 'uploading', uploadIds, createdAt: new Date().toISOString() });
            else transaction.update(ref, { uploadIds, updatedAt: new Date().toISOString() });
            return undefined;
        });
        if (existing) {
            return { receipt: existing.attachment };
        }
        const fullPath = `${RECEIPTS}/${actor.uid}/${id}/${receiptId}`;
        const file = admin.storage().bucket().file(fullPath);
        try {
            await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, metadata: { digest } } });
        } catch (error) {
            if (Number((error as any)?.code) !== 412) throw error;
            const [metadata] = await file.getMetadata();
            if (metadata.metadata?.digest !== digest) fail('already-exists', '다른 영수증으로 덮어쓸 수 없습니다.');
        }
        const attachment = { id: receiptId, fullPath, name: text(input.name).slice(0, 120) || '영수증', size: bytes.length, contentType, uploadedAt: new Date().toISOString(), url: '' };
        await db.runTransaction(async transaction => {
            const row = (await transaction.get(ref)).data();
            if (row?.status !== 'uploading') fail('failed-precondition', '이미 제출된 신청입니다.');
            transaction.set(receiptRef, { digest, attachment });
        });
        return { receipt: attachment };
    }
    const date = text(input.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail('invalid-argument', '사용일을 확인해 주세요.');
    if (typeof input.amount !== 'number' && !(typeof input.amount === 'string' && /^\d+$/.test(input.amount.trim()))) fail('invalid-argument', '올바른 금액을 입력해 주세요.');
    const amount = Number(input.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) fail('invalid-argument', '금액은 1원 이상 10억원 이하로 입력해 주세요.');
    const description = text(input.description).slice(0, 500);
    if (!description) fail('invalid-argument', '사용 내용을 입력해 주세요.');
    const categories = await categoriesFor();
    const category = categories.find(row => row.id === text(input.category));
    if (!category) fail('invalid-argument', '사용 가능한 경비 구분을 선택해 주세요.');
    const receiptIds = Array.isArray(input.receiptIds) ? [...new Set<string>(input.receiptIds.map(safeId))] : [];
    if (receiptIds.length < 1 || receiptIds.length > 5) fail('invalid-argument', '영수증을 1~5개 첨부해 주세요.');
    const paymentMethod = text(input.paymentMethod);
    if (!['현찰', '개인카드', '계좌이체'].includes(paymentMethod)) fail('invalid-argument', '결제수단을 확인해 주세요.');
    // Old clients omitted the billing team and charged their own team.
    const chargeToTeamId = input.chargeToTeamId === undefined ? team!.id : safeId(input.chargeToTeamId);
    const chargeToDoc = await db.collection('teams').doc(chargeToTeamId).get();
    if (!chargeToDoc.exists) fail('invalid-argument', '청구할 팀을 선택해 주세요.');
    const chargeTo = teamOption(chargeToDoc);
    const legacyPayload = { ownerUid: actor.uid, submitterName: actor.name, teamId: team!.id, teamName: team!.name, date, yearMonth: date.slice(0, 7), amount, description, category: category!.id, categoryLabel: category!.label, paymentMethod, memo: text(input.memo).slice(0, 1000), receiptIds };
    const payload = { ...legacyPayload, teamColor: team!.color, teamIcon: team!.icon, chargeToTeamId: chargeTo.id, chargeToTeamName: chargeTo.name, chargeToTeamColor: chargeTo.color, chargeToTeamIcon: chargeTo.icon };
    const fingerprint = createHash('sha256').update(JSON.stringify({ teamId: team!.id, chargeToTeamId, date, amount, description, category: category!.id, paymentMethod, memo: payload.memo, receiptIds })).digest('hex');
    const legacyFingerprint = createHash('sha256').update(JSON.stringify(legacyPayload)).digest('hex');
    return db.runTransaction(async transaction => {
        const row = (await transaction.get(ref)).data();
        const sameRequest = row?.fingerprint === fingerprint || (!row?.chargeToTeamId && chargeToTeamId === team!.id && row?.fingerprint === legacyFingerprint);
        if (sameRequest && row?.status !== 'uploading') return { id: ref.id, status: row!.status };
        if (!row || row.status !== 'uploading' || row.ownerUid !== actor.uid || row.teamId !== team!.id) fail('failed-precondition', '영수증을 올린 후 제출해 주세요. 이미 제출했다면 새로고침해 주세요.');
        const receipts = await transaction.getAll(...receiptIds.map(receiptId => ref.collection('receipts').doc(receiptId)));
        if (receipts.some(doc => !doc.exists)) fail('failed-precondition', '영수증 업로드가 완료되지 않았습니다. 다시 시도해 주세요.');
        transaction.update(ref, { ...payload, attachments: receipts.map(doc => doc.data()!.attachment), fingerprint, status: 'pending', submittedAt: new Date().toISOString() });
        return { id: ref.id, status: 'pending' };
    });
}

export const teamExpenseRequests = functions.runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 5 }).region('asia-northeast3').https.onCall(handleTeamExpenseRequest);
