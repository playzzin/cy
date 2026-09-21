import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { requireCallableAuth } from './auth';
import { actorFor, requireCurrentReviewer, validateExpenseReceipt } from './teamExpenseRequests';
import { accountDigits, analyzeWorkerDocument, cleanWorkerText, phoneDigits, WorkerDocumentKind } from './workerDocumentAnalysis';
import { readRequestPage } from './teamRequestPagination';
import { maintainRequestDrafts } from './teamRequestDrafts';

const COLLECTION = 'team_worker_requests';
const DOCUMENTS = 'team-worker-documents';
const text = (value: unknown) => cleanWorkerText(value, 500);
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const safeId = (value: unknown) => { const result = text(value); if (!/^[a-zA-Z0-9_-]{1,100}$/.test(result)) fail('invalid-argument', '신청 정보를 확인해 주세요.'); return result; };
const documentKind = (value: unknown): WorkerDocumentKind => { if (!['identity', 'bank'].includes(String(value))) fail('invalid-argument', '서류 종류를 확인해 주세요.'); return value as WorkerDocumentKind; };
const isCompanyName = (value: unknown) => ['청연이엔지', '청연eng'].includes(text(value).normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|[\s㈜]/g, ''));

export async function registrationCompany() {
    const snapshot = await admin.firestore().collection('companies').select('name', 'status', 'isActive').limit(1001).get();
    if (snapshot.size > 1000) fail('resource-exhausted', '회사 설정을 확인해 주세요.');
    const matches = snapshot.docs.filter(doc => isCompanyName(doc.data().name) && doc.data().isActive !== false && !['inactive', 'archived'].includes(doc.data().status));
    if (matches.length !== 1) fail('failed-precondition', '통합DB에서 청연이엔지 소속회사를 하나로 확인할 수 없습니다. 사무실에서 회사 등록을 확인해 주세요.');
    return { id: matches[0].id, name: text(matches[0].data().name) };
}

export function workerFields(input: any) {
    if (typeof input?.contact !== 'string' || !/^0\d{8,10}$/.test(input.contact.normalize('NFKC').replace(/[\s-]/g, ''))) fail('invalid-argument', '올바른 연락처를 입력해 주세요.');
    const fields = { name: cleanWorkerText(input?.name, 80), address: cleanWorkerText(input?.address, 300), contact: phoneDigits(input?.contact), bankName: cleanWorkerText(input?.bankName, 80), accountNumber: accountDigits(input?.accountNumber), accountHolder: cleanWorkerText(input?.accountHolder, 80) };
    if (!fields.name || !fields.address || !/^0\d{8,10}$/.test(fields.contact)) fail('invalid-argument', '이름·주소·올바른 연락처를 입력해 주세요.');
    if ((fields.bankName || fields.accountNumber || fields.accountHolder) && (!fields.bankName || !/^\d{6,20}$/.test(fields.accountNumber) || !fields.accountHolder)) fail('invalid-argument', '은행·계좌번호·예금주를 모두 확인해 주세요.');
    return fields;
}

export function workerPayroll(input: any) {
    const payType = typeof input?.payType === 'string' ? input.payType.trim() : '';
    const unitPrice = input?.unitPrice;
    if (!['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'].includes(payType) || typeof unitPrice !== 'number' || !Number.isSafeInteger(unitPrice) || unitPrice <= 0 || unitPrice > 1_000_000_000) fail('invalid-argument', '승인하려면 급여 구분과 1원 이상 10억원 이하의 단가를 확인해 주세요.');
    return { payType, salaryModel: payType, unitPrice };
}

export async function handleTeamWorkerRequest(input: any, context: functions.https.CallableContext) {
    const auth = requireCallableAuth(context);
    const actor = await actorFor(auth.uid);
    const db = admin.firestore();
    const action = text(input?.action);
    if (['drafts', 'discardDraft'].includes(action)) return maintainRequestDrafts(input, actor.canReview, COLLECTION, DOCUMENTS);
    if (action === 'list') {
        const yearMonth = text(input.yearMonth);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) fail('invalid-argument', '조회 월을 확인해 주세요.');
        const scope = actor.canReview ? db.collection(COLLECTION).where('yearMonth', '==', yearMonth) : db.collection(COLLECTION).where('ownerUid', '==', actor.uid).where('yearMonth', '==', yearMonth);
        const snapshot = await readRequestPage(scope, input);
        const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)).filter(row => ['pending', 'approved', 'rejected'].includes(row.status) && row.yearMonth === yearMonth).sort((a, b) => text(b.submittedAt || b.createdAt).localeCompare(text(a.submittedAt || a.createdAt)));
        return { canReview: actor.canReview, teams: actor.teams, company: await registrationCompany(), requests, nextCursor: snapshot.nextCursor };
    }
    if (action === 'document') {
        const ref = db.collection(COLLECTION).doc(safeId(input.id));
        const row = (await ref.get()).data();
        if (!row || (!actor.canReview && row.ownerUid !== actor.uid)) fail('permission-denied', '이 신청의 서류를 열람할 권한이 없습니다.');
        const saved = (await ref.collection('documents').doc(safeId(input.fileId)).get()).data();
        if (!saved || !saved.fullPath.startsWith(`${DOCUMENTS}/${row!.ownerUid}/${ref.id}/`)) fail('not-found', '서류를 찾을 수 없습니다.');
        const [bytes] = await admin.storage().bucket().file(saved.fullPath).download();
        return { name: saved.name, contentType: saved.contentType, base64: bytes.toString('base64') };
    }
    if (action === 'review') {
        if (!actor.canReview) fail('permission-denied', '사무실 승인 권한이 필요합니다.');
        const ref = db.collection(COLLECTION).doc(safeId(input.id));
        const decision = text(input.decision), reason = cleanWorkerText(input.reason, 500);
        if (!['approved', 'rejected'].includes(decision) || (decision === 'rejected' && !reason)) fail('invalid-argument', '반려 사유를 입력해 주세요.');
        return db.runTransaction(async transaction => {
            await requireCurrentReviewer(transaction, actor.uid);
            const row = (await transaction.get(ref)).data();
            if (!row) return fail('not-found', '신청을 찾을 수 없습니다.');
            if (row.ownerUid === actor.uid) fail('permission-denied', '본인 신청은 다른 사무실 직원이 승인해야 합니다.');
            if (row.status === decision) {
                if (decision === 'approved') {
                    const worker = row.workerId ? await transaction.get(db.collection('workers').doc(safeId(row.workerId))) : null;
                    if (!worker?.exists || worker.data()?.registrationRequestId !== ref.id) fail('failed-precondition', '승인된 작업자와 통합DB 연결을 확인할 수 없습니다. 사무실에서 확인해 주세요.');
                }
                return { id: ref.id, status: decision, workerId: row.workerId || null };
            }
            if (row.status !== 'pending') fail('failed-precondition', '이미 처리된 신청입니다.');
            const now = new Date().toISOString(), workerId = `team-registration-${ref.id}`;
            if (decision === 'approved') {
                const fields = workerFields(row);
                const payroll = workerPayroll(input.payroll);
                const workerRef = db.collection('workers').doc(workerId);
                const duplicateRef = db.doc(`server_settings/worker-registration-${hash(`${fields.name}:${fields.contact}`)}`);
                const accountRef = fields.accountNumber ? db.doc(`server_settings/worker-registration-account-${hash(`${fields.name}:${fields.accountNumber}`)}`) : null;
                const [team, company, existing, duplicate, sameNames, duplicateAccount] = await Promise.all([
                    transaction.get(db.collection('teams').doc(row.teamId)), transaction.get(db.collection('companies').doc(row.companyId)),
                    transaction.get(workerRef), transaction.get(duplicateRef), transaction.get(db.collection('workers').where('name', '==', fields.name).limit(101)),
                    accountRef ? transaction.get(accountRef) : Promise.resolve(null),
                ]);
                if (!team.exists || team.data()?.isActive === false || !company.exists || company.data()?.isActive === false || !isCompanyName(company.data()?.name) || ['inactive', 'archived'].includes(company.data()?.status)) fail('failed-precondition', '신청한 팀 또는 소속회사를 확인해 주세요.');
                const teamType = text(team.data()?.type);
                if (['지원팀', '용역팀'].includes(teamType) && payroll.payType !== teamType) fail('invalid-argument', `이 팀의 급여 구분은 ${teamType}이어야 합니다.`);
                if (existing.exists || duplicate.exists || duplicateAccount?.exists || sameNames.size > 100 || sameNames.docs.some(doc => phoneDigits(doc.data().contact) === fields.contact || (fields.accountNumber && accountDigits(doc.data().accountNumber) === fields.accountNumber))) fail('already-exists', '동일한 작업자가 이미 통합DB에 있습니다. 기존 정보를 확인한 후 신청을 반려해 주세요.');
                transaction.create(workerRef, { ...fields, teamId: row.teamId, teamName: text(team.data()?.name), companyId: row.companyId, companyName: text(company.data()?.name), role: '작업자', status: '재직', isActive: true, needsApproval: false, ...payroll, totalManDay: 0, teamType: text(team.data()?.type) || '미배정', registrationRequestId: ref.id, sourceType: 'team_registration_request', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
                transaction.create(duplicateRef, { workerId, requestId: ref.id });
                if (accountRef) transaction.create(accountRef, { workerId, requestId: ref.id });
                // Audit provenance without duplicating ID images, addresses or bank details.
                transaction.create(db.collection('database_logs').doc(`team-registration-${ref.id}`), { action: 'created', actionLabel: '저장', entityType: 'worker', entityLabel: '작업자', entityId: workerId, entityName: fields.name, teamId: row.teamId, teamName: row.teamName, companyId: row.companyId, companyName: row.companyName, actor: { uid: actor.uid, name: actor.name, email: null }, source: 'teamWorkerRequests.approve', before: null, after: { id: workerId, teamId: row.teamId, companyId: row.companyId }, fieldChanges: [], summaryLines: ['팀장 신규 작업자 신청 승인'], summaryText: '팀장 신규 작업자 신청 승인', changeCount: 1, createdAt: Timestamp.now(), createdAtIso: now });
            }
            transaction.update(ref, { status: decision, reviewedBy: actor.uid, reviewerName: actor.name, reviewedAt: now, reviewReason: reason, workerId: decision === 'approved' ? workerId : null });
            return { id: ref.id, status: decision, workerId: decision === 'approved' ? workerId : null };
        });
    }
    if (!['analyze', 'upload', 'submit'].includes(action)) fail('invalid-argument', '지원하지 않는 요청입니다.');
    const team = actor.teams.find(item => item.id === text(input.teamId));
    if (!team) fail('permission-denied', '현재 소속팀으로만 신청할 수 있습니다.');
    if (action === 'analyze') {
        const kind = documentKind(input.kind), contentType = text(input.contentType), base64 = String(input.base64 || '');
        validateExpenseReceipt(contentType, base64);
        const { getServerGeminiSettings } = await import('./serverAiSettings');
        const settings = await getServerGeminiSettings();
        if (!settings.apiKey) fail('failed-precondition', '사무실에서 서버 Gemini API 설정을 확인해 주세요.');
        const usage = db.doc(`server_settings/worker-analysis-${hash(actor.uid)}`), now = Date.now();
        await db.runTransaction(async transaction => {
            const previous = (await transaction.get(usage)).data(), minute = Math.floor(now / 60_000), day = Math.floor(now / 86_400_000);
            const minuteCount = previous?.minute === minute ? Number(previous.minuteCount) || 0 : 0, dayCount = previous?.day === day ? Number(previous.dayCount) || 0 : 0;
            if (minuteCount >= 10 || dayCount >= 100) fail('resource-exhausted', '분석 횟수가 많습니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.');
            transaction.set(usage, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
        });
        return analyzeWorkerDocument({ contentType, base64 }, kind, settings);
    }
    const id = hash(`${actor.uid}:${safeId(input.requestId)}`), ref = db.collection(COLLECTION).doc(id);
    if (action === 'upload') {
        const fileId = safeId(input.fileId), kind = documentKind(input.kind), contentType = text(input.contentType);
        const bytes = validateExpenseReceipt(contentType, String(input.base64 || '')), digest = createHash('sha256').update(bytes).digest('hex');
        const documentRef = ref.collection('documents').doc(fileId);
        const existing = await db.runTransaction(async transaction => {
            const row = (await transaction.get(ref)).data(), saved = (await transaction.get(documentRef)).data();
            if (row && (row.ownerUid !== actor.uid || row.teamId !== team!.id)) fail('permission-denied', '신청 소속팀을 확인해 주세요.');
            if (['discarding', 'discarded'].includes(row?.status)) fail('failed-precondition', '정리 중인 임시 신청입니다. 새로 작성해 주세요.');
            if (saved) { if (saved.digest !== digest || saved.kind !== kind) fail('already-exists', '이미 등록된 서류를 바꿀 수 없습니다.'); if (row?.status === 'uploading') transaction.update(ref, { updatedAt: new Date().toISOString() }); return saved; }
            if (row && row.status !== 'uploading') fail('failed-precondition', '제출된 신청의 서류를 바꿀 수 없습니다.');
            const uploaded = await transaction.get(ref.collection('documents').limit(3));
            const uploadIds = [...new Set([...(Array.isArray(row?.uploadIds) ? row!.uploadIds : []), ...uploaded.docs.map(doc => doc.id), fileId])];
            if (uploadIds.length > 2) fail('resource-exhausted', '한 신청에는 신분증과 통장 서류만 올릴 수 있습니다.');
            if (!row) transaction.create(ref, { ownerUid: actor.uid, teamId: team!.id, status: 'uploading', uploadIds, createdAt: new Date().toISOString() });
            else transaction.update(ref, { uploadIds, updatedAt: new Date().toISOString() });
            return undefined;
        });
        if (existing) return { fileId };
        const fullPath = `${DOCUMENTS}/${actor.uid}/${id}/${fileId}`, file = admin.storage().bucket().file(fullPath);
        try { await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, metadata: { digest, kind } } }); }
        catch (error) { if (Number((error as any)?.code) !== 412) throw error; const [metadata] = await file.getMetadata(); if (metadata.metadata?.digest !== digest || metadata.metadata?.kind !== kind) fail('already-exists', '다른 서류로 덮어쓸 수 없습니다.'); }
        await db.runTransaction(async transaction => {
            const row = (await transaction.get(ref)).data();
            const saved = (await transaction.get(documentRef)).data();
            if (saved) { if (saved.digest !== digest || saved.kind !== kind) fail('already-exists', '다른 서류로 덮어쓸 수 없습니다.'); return; }
            if (row?.status !== 'uploading') fail('failed-precondition', '이미 제출된 신청입니다.');
            transaction.set(documentRef, { id: fileId, kind, fullPath, contentType, name: cleanWorkerText(input.name, 120) || '서류', size: bytes.length, digest });
        });
        return { fileId };
    }
    const fields = workerFields(input.fields), company = await registrationCompany();
    const identityId = safeId(input.identityId), bankId = input.bankId ? safeId(input.bankId) : '';
    if (Boolean(bankId) !== Boolean(fields.accountNumber)) fail('invalid-argument', '계좌를 등록하려면 통장 사진과 계좌 정보를 함께 확인해 주세요.');
    const fingerprint = hash(JSON.stringify({ ...fields, teamId: team!.id, companyId: company.id, identityId, bankId }));
    return db.runTransaction(async transaction => {
        const row = (await transaction.get(ref)).data();
        if (row?.fingerprint === fingerprint && row.status !== 'uploading') return { id, status: row.status };
        if (!row || row.ownerUid !== actor.uid || row.teamId !== team!.id || row.status !== 'uploading') fail('failed-precondition', '서류를 올린 후 신청해 주세요.');
        const docs = await transaction.getAll(...[identityId, bankId].filter(Boolean).map(fileId => ref.collection('documents').doc(fileId)));
        if (docs.some(doc => !doc.exists) || docs[0].data()?.kind !== 'identity' || (bankId && docs[1].data()?.kind !== 'bank')) fail('failed-precondition', '신분증과 통장 서류를 확인해 주세요.');
        const now = new Date().toISOString();
        transaction.update(ref, { ...fields, ownerUid: actor.uid, submitterName: actor.name, teamId: team!.id, teamName: team!.name, teamColor: team!.color, teamIcon: team!.icon, companyId: company.id, companyName: company.name, attachments: docs.map(doc => { const saved = doc.data()!; return { id: doc.id, kind: saved.kind, name: saved.name, contentType: saved.contentType }; }), fingerprint, status: 'pending', yearMonth: new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7), submittedAt: now });
        return { id, status: 'pending' };
    });
}

export const teamWorkerRequests = functions.runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 5 }).region('asia-northeast3').https.onCall(handleTeamWorkerRequest);
