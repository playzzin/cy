import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { list, text } from './teamReadPolicy';
import { requireWorkerRequestAccess } from './workerRequestAccess';

export async function handleTeamOffDutyRequest(input: any, context: functions.https.CallableContext) {
    const { uid } = requireCallableAuth(context);
    const date = text(input?.date);
    const ids = [...new Set<string>(list(input?.workerIds).map(text))];
    if (!['add', 'remove'].includes(input?.action) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date
        || !ids.length || ids.length > 30 || ids.some(id => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) {
        throw new functions.https.HttpsError('invalid-argument', '신청 날짜와 작업자를 확인해 주세요.');
    }
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const lastDate = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10);
    if (date <= today || date > lastDate) throw new functions.https.HttpsError('invalid-argument', '내일부터 30일 이내의 휴무를 신청해 주세요.');
    const db = admin.firestore();
    const ref = db.collection('field_schedule_requests').doc(`${date}___date_off_duty__`);
    return db.runTransaction(async transaction => {
        const [profile, menu, saved] = await transaction.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'), ref);
        const workers = await transaction.getAll(...ids.map(id => db.collection('workers').doc(id)));
        for (const worker of workers) await requireWorkerRequestAccess(transaction, profile.data(), menu.data(), worker.id, worker.data());
        const existing = saved.data() || {};
        const names = list(existing.offDutyWorkerNames);
        const members = new Map<string, string>(list(existing.offDutyWorkerIds).map((id, i) => [text(id), text(names[i]) || text(id)]));
        const audit = { ...(existing.offDutyRequestActors || {}) };
        const now = admin.firestore.Timestamp.now();
        for (const worker of workers) {
            if (input.action === 'remove') { members.delete(worker.id); delete audit[worker.id]; }
            else {
                members.set(worker.id, text(worker.data()?.name));
                audit[worker.id] = { requesterUid: uid, requesterName: text(profile.data()?.displayName || profile.data()?.name), memo: text(input.memo).slice(0, 1000), requestedAt: now };
            }
        }
        if (!members.size) { if (saved.exists) transaction.delete(ref); return { id: ref.id }; }
        // Preserve other teams' entries and legacy memo lines in this shared date document.
        const oldLines = text(existing.memo).split('\n').filter(Boolean);
        const newLines = input.action === 'add' && text(input.memo)
            ? workers.map(worker => `${text(worker.data()?.name)}: ${text(input.memo).slice(0, 1000)}`) : [];
        transaction.set(ref, {
            ...existing, date, siteId: '__date_off_duty__', siteName: '날짜별 휴무자',
            requestedHeadcount: 0, requestedRoles: [], priority: 'normal', status: 'requested',
            offDutyWorkerIds: [...members.keys()], offDutyWorkerNames: [...members.values()],
            offDutyRequestActors: audit, memo: [...new Set([...oldLines, ...newLines])].join('\n'),
            requestedById: existing.requestedById || uid,
            requestedByName: existing.requestedByName || text(profile.data()?.displayName || profile.data()?.name),
            createdAt: existing.createdAt || now, updatedAt: now,
        });
        return { id: ref.id };
    });
}

export const teamOffDutyRequests = protectedRegion.https.onCall(handleTeamOffDutyRequest);
