import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import { activeNoticeUser, canManageNotice, isNoticeManager, matchesNoticeAudience, noticeIdentity } from './noticeAccess';
export { isNoticeManager } from './noticeAccess';

type Data = FirebaseFirestore.DocumentData;
const stamp = (time: number) => admin.firestore.Timestamp.fromMillis(time);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const ids = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.map(v => String(v || '').trim()).filter(Boolean))] : [];
const key = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');
const active = activeNoticeUser;
export const notificationStateId = (uid: string, messageId: string) => hash(uid + '\0' + messageId);
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,180}$/.test(value);
const canReceive = (message: Data, uid: string) => message.recipientIds?.includes(uid)
    || (message.recipientScope === 'all' && !String(message.senderId).startsWith('system:'));
const available = (message: Data, now: number) => message.status === 'active' && (!message.expiresAt || message.expiresAt.toMillis() > now);

// Apply both the notice audience and the configured automation audience. Never broaden an unknown rule.
export function noticeRecipients(notice: Data, settings: Data, users: Data[], workers: Data[], teams: Data[], menu: Data = {}): Data[] {
    const rule = settings.events?.['notice.created']?.recipientRule || { mode: 'noticeTargetPositions' };
    const selectedTeams = teams.filter(team => ids(rule.teamIds).some(id => [team.id, team.legacyId].includes(id)) || ids(rule.teamNames).includes(team.name));
    const teamIds = new Set([...ids(rule.teamIds), ...selectedTeams.flatMap(t => [t.id, t.legacyId]).filter(Boolean)]);
    const teamNames = new Set([...ids(rule.teamNames), ...selectedTeams.map(t => t.name)]);
    return users.filter(user => {
        if (!matchesNoticeAudience(notice, user, workers, teams, menu)) return false;
        const { ownWorkers } = noticeIdentity(user, workers, teams, menu);
        switch (rule.mode) {
            case 'global': return settings.recipientScope === 'all' || ids(settings.recipientIds).includes(user.uid);
            case 'allUsers': case 'noticeTargetPositions': return true;
            case 'users': return ids(rule.recipientIds).includes(user.uid);
            case 'allWorkers': return ownWorkers.length > 0;
            case 'teamMembers': return ownWorkers.some(w => teamIds.has(w.teamId) || teamNames.has(w.teamName));
            case 'teamLeaders': return ownWorkers.some(w => ((teamIds.size === 0 && teamNames.size === 0) || teamIds.has(w.teamId) || teamNames.has(w.teamName))
                && (/팀장|반장|조장|leader|foreman/.test(key(w.role)) || (selectedTeams.length ? selectedTeams : teams).some(t => t.leaderId ? [w.id, w.legacyId].includes(t.leaderId)
                    : t.leaderName && w.name === t.leaderName
                        && ([t.id, t.legacyId].filter(Boolean).includes(w.teamId) || w.teamName === t.name) && workers.filter(candidate => candidate.name === t.leaderName
                        && ([t.id, t.legacyId].filter(Boolean).includes(candidate.teamId) || candidate.teamName === t.name)).length === 1)));
            case 'relatedTeamLeaders': return false; // Notices have no related team context.
            default: return fail('failed-precondition', '지원하지 않는 알림 수신 규칙입니다. 수신 설정을 확인해 주세요.');
        }
    });
}

export async function saveNoticeAndQueue(db: FirebaseFirestore.Firestore, uid: string, input: Data, now = Date.now()) {
    if (!validId(input.requestId) || (input.noticeId && !validId(input.noticeId))) fail('invalid-argument', '저장 요청 정보가 올바르지 않습니다.');
    const raw = input.notice || {};
    const audience = raw.audience || 'positions';
    if (!['all', 'teamLeaders', 'team', 'positions'].includes(audience)) fail('invalid-argument', '공지 공개 범위를 선택해 주세요.');
    const title = String(raw.title || '').trim(), body = String(raw.body || '').trim();
    if (!title || title.length > 200 || !body || body.length > 40000) fail('invalid-argument', '제목은 1~200자, 본문은 1~40,000자로 입력해 주세요.');
    const date = (value: unknown) => value == null ? null : typeof value === 'number' && Number.isFinite(value) && value > now && value <= now + 5 * 366 * 86400000
        ? stamp(value) : fail('invalid-argument', '기한은 현재 이후 5년 이내로 지정해 주세요.');
    const payload = { title, body, category: String(raw.category || '일반').trim().slice(0, 80),
        audience, teamId: audience === 'team' ? String(raw.teamId || '').trim() : null,
        targetPositions: audience === 'positions' ? ids(raw.targetPositions).slice(0, 100) : [], priority: ['normal', 'important', 'urgent'].includes(raw.priority) ? raw.priority : 'normal',
        status: 'published', pinned: raw.pinned === true, expiresAt: date(raw.expiresAt),
        requiresConfirmation: raw.requiresConfirmation === true,
        confirmationDueAt: raw.requiresConfirmation ? date(raw.confirmationDueAt) : null };
    if (payload.requiresConfirmation && (!input.notify || !payload.confirmationDueAt)) fail('invalid-argument', '확인 완료가 필요한 공지는 알림 발송과 확인 기한을 지정해 주세요.');
    if (payload.expiresAt && payload.confirmationDueAt && payload.confirmationDueAt.toMillis() > payload.expiresAt.toMillis()) fail('invalid-argument', '확인 기한은 공지 만료보다 늦을 수 없습니다.');
    const operationId = hash(uid + '\0' + input.requestId);
    const noticeId = input.noticeId || 'notice-' + operationId;
    const fingerprint = hash(JSON.stringify({ noticeId, payload, notify: !!input.notify }));
    const jobRef = db.collection('notice_notification_outbox').doc(operationId);
    const noticeRef = db.collection('notices').doc(noticeId);
    return db.runTransaction(async tx => {
        const [profile, existing, oldNotice, workers, teams, menu] = await Promise.all([
            tx.get(db.doc('users/' + uid)), tx.get(jobRef), tx.get(noticeRef),
            tx.get(db.collection('workers')), tx.get(db.collection('teams')), tx.get(db.doc('settings/menus_v12')),
        ]);
        if (!active(profile.data())) fail('permission-denied', '활성 계정이 필요합니다.');
        const user = { ...profile.data(), uid };
        const workerRows: Data[] = workers.docs.map(s => ({ ...s.data(), id: s.id }));
        const teamRows: Data[] = teams.docs.map(s => ({ ...s.data(), id: s.id }));
        const manager = isNoticeManager(user, menu.data());
        const team = audience === 'team' ? teamRows.find(t => t.id === payload.teamId) : undefined;
        if (audience === 'team' && (!team || team.isActive === false)) fail('invalid-argument', '공지를 받을 소속 팀을 선택해 주세요.');
        if (!manager && (audience !== 'team' || !noticeIdentity(user, workerRows, teamRows, menu.data()).ledTeams.some(t => t.id === payload.teamId))) {
            fail('permission-denied', '팀장은 본인이 이끄는 팀의 공지만 작성할 수 있습니다.');
        }
        if (oldNotice.exists && !canManageNotice(oldNotice.data()!, user, workerRows, teamRows, menu.data())) fail('permission-denied', '수정할 수 있는 공지가 아닙니다.');
        if (existing.exists) {
            if (existing.get('fingerprint') !== fingerprint) fail('already-exists', '이 요청으로 이미 저장했습니다. 새 요청으로 다시 저장해 주세요.');
            return { noticeId, jobId: operationId, status: existing.get('status') };
        }
        if (input.noticeId && !oldNotice.exists) fail('not-found', '수정할 공지가 없습니다.');
        const priorRevision = oldNotice.get('notificationRevision');
        const priorMessageRef = priorRevision ? db.doc('erp_messages/notice-' + priorRevision) : null;
        const priorMessage = priorMessageRef ? await tx.get(priorMessageRef) : null;
        let recipients: Data[] = [];
        let status = input.notify ? 'pending' : 'disabled';
        let reason = input.notify ? '' : 'author_disabled';
        if (input.notify) {
            const [settings, users] = await Promise.all([
                tx.get(db.doc('erp_message_settings/daily_report')), tx.get(db.collection('users')),
            ]);
            const config = settings.data() || {};
            if (!config.enabled || !config.events?.['notice.created']?.enabled) { status = 'disabled'; reason = 'settings_disabled'; }
            else {
                recipients = noticeRecipients(payload, config, users.docs.map(s => ({ ...s.data(), uid: s.id })),
                    workerRows, teamRows, menu.data());
                if (!recipients.length) { status = 'no_recipients'; reason = 'empty_audience'; }
            }
        }
        if (payload.requiresConfirmation && status !== 'pending') fail('failed-precondition', '확인 요청을 보낼 대상이 없습니다. 공지 자동 알림과 수신 대상을 먼저 설정해 주세요.');
        if (recipients.length > 2000) fail('resource-exhausted', '한 번에 2,000명까지 발송할 수 있습니다. 대상 범위를 나누어 주세요.');
        const actor = { uid, name: String(profile.get('displayName') || '관리자').slice(0, 80), email: null };
        tx.set(noticeRef, { ...payload, teamName: team?.name || null, createdBy: oldNotice.get('createdBy') || actor, updatedBy: actor,
            createdAt: oldNotice.get('createdAt') || stamp(now), updatedAt: stamp(now), publishedAt: stamp(now), notificationRevision: operationId }, { merge: true });
        if (priorMessage?.exists) tx.update(priorMessageRef!, { status: 'archived', updatedAt: stamp(now) });
        tx.create(jobRef, { noticeId, fingerprint, notice: payload, createdBy: uid, status, reason,
            recipientIds: recipients.map(u => u.uid), recipientNames: recipients.map(u => String(u.displayName || '사용자').slice(0, 80)),
            attempts: 0, nextAttemptAt: stamp(now), createdAt: stamp(now), updatedAt: stamp(now), messageId: 'notice-' + operationId });
        return { noticeId, jobId: operationId, status };
    });
}

export async function deliverNoticeJob(db: FirebaseFirestore.Firestore, jobId: string, now = Date.now()) {
    const ref = db.doc('notice_notification_outbox/' + jobId);
    try {
        return await db.runTransaction(async tx => {
            const jobSnap = await tx.get(ref);
            const job = jobSnap.data();
            if (!job || job.status !== 'pending' || job.nextAttemptAt.toMillis() > now) return 'skipped';
            const messageRef = db.doc('erp_messages/' + job.messageId);
            const [message, currentNotice] = await Promise.all([tx.get(messageRef), tx.get(db.doc('notices/' + job.noticeId))]);
            if (message.exists) { tx.update(ref, { status: 'sent', updatedAt: stamp(now) }); return 'duplicate'; }
            const notice = job.notice;
            if (!currentNotice.exists || currentNotice.get('status') !== 'published' || currentNotice.get('notificationRevision') !== jobId
                || (notice.expiresAt && notice.expiresAt.toMillis() <= now)) {
                tx.update(ref, { status: 'cancelled', reason: 'notice_changed_or_expired', updatedAt: stamp(now) }); return 'cancelled';
            }
            const [profiles, workers, teams, menu] = await Promise.all([
                Promise.all(job.recipientIds.map((uid: string) => tx.get(db.doc('users/' + uid)))),
                tx.get(db.collection('workers')), tx.get(db.collection('teams')), tx.get(db.doc('settings/menus_v12')),
            ]);
            const recipients = profiles.filter(s => s.exists && matchesNoticeAudience(notice, { ...s.data(), uid: s.id },
                workers.docs.map(s => ({ ...s.data(), id: s.id })), teams.docs.map(s => ({ ...s.data(), id: s.id })), menu.data())).map(s => s.id);
            const names = recipients.map(uid => job.recipientNames[job.recipientIds.indexOf(uid)]);
            if (!recipients.length) { tx.update(ref, { status: 'no_recipients', reason: 'inactive_audience', updatedAt: stamp(now) }); return 'no_recipients'; }
            tx.create(messageRef, { type: 'system', title: '[공지사항] ' + notice.title, body: notice.body, category: '공지',
                priority: notice.priority === 'urgent' ? 'urgent' : notice.priority === 'important' ? 'high' : 'normal',
                status: 'active', senderId: 'system:notice-notification', senderName: '공지 알림', senderEmail: null,
                recipientScope: 'users', recipientIds: recipients, recipientNames: names, readBy: [], readAtBy: {}, pinned: notice.pinned,
                actionLabel: '공지사항 바로가기', actionUrl: '/notices?noticeId=' + encodeURIComponent(job.noticeId),
                noticeId: job.noticeId, requiresConfirmation: notice.requiresConfirmation, dueAt: notice.confirmationDueAt,
                createdAt: stamp(now), updatedAt: stamp(now), expiresAt: notice.expiresAt });
            tx.update(ref, { status: 'sent', attempts: job.attempts + 1, sentAt: stamp(now), updatedAt: stamp(now),
                deliveredRecipientIds: recipients, deliveredRecipientNames: names, errorCode: null });
            return 'sent';
        });
    } catch (error) {
        // A lost response after commit must never turn an already sent job into a failed job.
        await db.runTransaction(async tx => {
            const snapshot = await tx.get(ref), job = snapshot.data();
            if (!job || job.status !== 'pending') return;
            const attempts = Number(job.attempts || 0) + 1;
            tx.update(ref, { attempts, status: attempts >= 8 ? 'failed' : 'pending', errorCode: 'delivery_failed',
                nextAttemptAt: stamp(now + Math.min(60, 2 ** attempts) * 60000), updatedAt: stamp(now) });
        });
        functions.logger.warn('Notice delivery queued for retry.', { jobId });
        return 'retry';
    }
}

export async function updatePersonalNotification(db: FirebaseFirestore.Firestore, uid: string, input: Data, now = Date.now()) {
    if (!validId(input.messageId) || !['confirm', 'snooze', 'resume'].includes(input.action)) fail('invalid-argument', '잘못된 알림 요청입니다.');
    if (input.action === 'snooze' && (!Number.isFinite(input.until) || input.until <= now || input.until > now + 30 * 86400000)) fail('invalid-argument', '다시 알림은 현재 이후 30일 이내로 지정해 주세요.');
    const ref = db.doc('notification_user_states/' + notificationStateId(uid, input.messageId));
    return db.runTransaction(async tx => {
        const [user, messageSnap, state] = await Promise.all([tx.get(db.doc('users/' + uid)), tx.get(db.doc('erp_messages/' + input.messageId)), tx.get(ref)]);
        const message = messageSnap.data();
        if (!active(user.data()) || !message || !canReceive(message, uid) || !available(message, now)) fail('permission-denied', '접근 가능한 활성 알림이 아닙니다.');
        if (input.action === 'confirm' && !message.requiresConfirmation) fail('failed-precondition', '확인 완료 대상이 아닙니다.');
        if (input.action === 'snooze' && message.expiresAt && input.until >= message.expiresAt.toMillis()) fail('invalid-argument', '알림이 만료되기 전으로 지정해 주세요.');
        if (input.action === 'snooze' && state.get('confirmedAt')) fail('failed-precondition', '이미 확인 완료한 알림입니다.');
        const data: Data = { userId: uid, messageId: input.messageId, updatedAt: stamp(now),
            reminderStatus: input.action === 'snooze' ? 'scheduled' : 'cancelled', snoozedUntil: input.action === 'snooze' ? stamp(input.until) : null };
        if (input.action === 'confirm') data.confirmedAt = state.get('confirmedAt') || stamp(now);
        tx.set(ref, data, { merge: true });
        return { ok: true };
    });
}

export async function deliverPersonalReminder(db: FirebaseFirestore.Firestore, stateId: string, now = Date.now()) {
    return db.runTransaction(async tx => {
        const ref = db.doc('notification_user_states/' + stateId), snapshot = await tx.get(ref), state = snapshot.data();
        if (!state || state.reminderStatus !== 'scheduled' || !state.snoozedUntil || state.snoozedUntil.toMillis() > now) return 'skipped';
        const messageRef = db.doc('erp_messages/' + state.messageId);
        const [user, messageSnap] = await Promise.all([tx.get(db.doc('users/' + state.userId)), tx.get(messageRef)]);
        const message = messageSnap.data();
        if (!active(user.data()) || !message || !canReceive(message, state.userId) || !available(message, now) || state.confirmedAt) {
            tx.update(ref, { reminderStatus: 'cancelled', snoozedUntil: null, updatedAt: stamp(now) }); return 'cancelled';
        }
        const readAt = { ...(message.readAtBy || {}) };
        delete readAt[state.userId.replace(/[^a-zA-Z0-9_-]/g, '_')];
        tx.update(messageRef, { readBy: (message.readBy || []).filter((id: string) => id !== state.userId), readAtBy: readAt, updatedAt: stamp(now) });
        tx.update(ref, { reminderStatus: 'delivered', snoozedUntil: null, remindedAt: stamp(now), updatedAt: stamp(now) });
        return 'sent';
    });
}

export async function savePersonalPreferences(db: FirebaseFirestore.Firestore, uid: string, raw: Data) {
    if (!active((await db.doc('users/' + uid).get()).data())) fail('permission-denied', '활성 계정이 필요합니다.');
    const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (typeof raw.sound !== 'boolean' || typeof raw.quietEnabled !== 'boolean' || !validTime(raw.quietStart) || !validTime(raw.quietEnd)
        || ![0, 5, 15, 30, 60].includes(raw.digestMinutes) || !['notice', 'memo', 'task', 'message'].every(s => typeof raw.sources?.[s] === 'boolean')) fail('invalid-argument', '알림 설정을 확인해 주세요.');
    const prefs = { sound: raw.sound, quietEnabled: raw.quietEnabled, quietStart: raw.quietStart, quietEnd: raw.quietEnd,
        digestMinutes: raw.digestMinutes, sources: Object.fromEntries(['notice', 'memo', 'task', 'message'].map(s => [s, raw.sources[s]])) };
    await db.doc('notification_preferences/' + uid).set({ ...prefs, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true };
}

export async function noticeDeliveryReport(db: FirebaseFirestore.Firestore, uid: string, input: Data) {
    if (!isNoticeManager((await db.doc('users/' + uid).get()).data())) fail('permission-denied', '공지 관리자만 볼 수 있습니다.');
    if (input.jobId) {
        if (!validId(input.jobId)) fail('invalid-argument', '잘못된 발송 ID입니다.');
        const job = (await db.doc('notice_notification_outbox/' + input.jobId).get()).data();
        if (!job) fail('not-found', '발송 기록이 없습니다.');
        const [message, receipts] = await Promise.all([db.doc('erp_messages/' + job.messageId).get(),
            db.collection('notification_user_states').where('messageId', '==', job.messageId).get()]);
        const confirmed = new Map(receipts.docs.filter(s => s.get('confirmedAt')).map(s => [s.get('userId'), s.get('confirmedAt').toMillis()]));
        return { recipients: job.recipientIds.map((id: string, i: number) => ({ uid: id, name: job.recipientNames[i],
            delivered: (job.deliveredRecipientIds || []).includes(id), read: (message.get('readBy') || []).includes(id),
            confirmedAt: confirmed.get(id) || null })) };
    }
    const cursor = Number(input.before);
    let query: FirebaseFirestore.Query = db.collection('notice_notification_outbox').orderBy('createdAt', 'desc').orderBy(admin.firestore.FieldPath.documentId(), 'desc');
    if (Number.isFinite(cursor) && cursor > 0 && validId(input.beforeId)) query = query.startAfter(stamp(cursor), input.beforeId);
    const jobs = await query.limit(30).get();
    return { jobs: jobs.docs.map(s => { const j = s.data(); return { id: s.id, noticeId: j.noticeId, title: j.notice.title, status: j.status, reason: j.reason,
        attempts: j.attempts, recipientCount: j.recipientIds.length, deliveredCount: (j.deliveredRecipientIds || []).length,
        requiresConfirmation: j.notice.requiresConfirmation, dueAt: j.notice.confirmationDueAt?.toMillis() || null,
        createdAt: j.createdAt.toMillis(), nextAttemptAt: j.nextAttemptAt?.toMillis() || null }; }), hasMore: jobs.size === 30 };
}

export async function retryNoticeJob(db: FirebaseFirestore.Firestore, uid: string, jobId: string, now = Date.now()) {
    if (!validId(jobId)) fail('invalid-argument', '잘못된 발송 ID입니다.');
    await db.runTransaction(async tx => {
        const ref = db.doc('notice_notification_outbox/' + jobId);
        const [user, snapshot] = await Promise.all([tx.get(db.doc('users/' + uid)), tx.get(ref)]);
        if (!isNoticeManager(user.data())) fail('permission-denied', '공지 관리자만 재시도할 수 있습니다.');
        if (!snapshot.exists) fail('not-found', '발송 기록이 없습니다.');
        if (!['failed', 'pending'].includes(snapshot.get('status'))) fail('failed-precondition', '재시도 가능한 발송이 아닙니다.');
        tx.update(ref, { status: 'pending', attempts: 0, nextAttemptAt: stamp(now), updatedAt: stamp(now), retriedBy: uid });
    });
    return { status: await deliverNoticeJob(db, jobId, now) };
}

export const saveNoticeWithNotification = protectedRegion.https.onCall((data, context) => saveNoticeAndQueue(admin.firestore(), requireCallableAuth(context).uid, data || {}));
export const setPersonalNotification = protectedRegion.https.onCall((data, context) => updatePersonalNotification(admin.firestore(), requireCallableAuth(context).uid, data || {}));
export const saveNotificationPreferences = protectedRegion.https.onCall((data, context) => savePersonalPreferences(admin.firestore(), requireCallableAuth(context).uid, data || {}));
export const getNoticeDeliveryReport = protectedRegion.https.onCall((data, context) => noticeDeliveryReport(admin.firestore(), requireCallableAuth(context).uid, data || {}));
export const retryNoticeDelivery = protectedRegion.https.onCall((data, context) => retryNoticeJob(admin.firestore(), requireCallableAuth(context).uid, data?.jobId));
export const dispatchNoticeNotification = functions.runWith({ timeoutSeconds: 120, memory: '256MB', maxInstances: 5, failurePolicy: true })
    .region('asia-northeast3').firestore.document('notice_notification_outbox/{jobId}').onCreate((_, context) => deliverNoticeJob(admin.firestore(), context.params.jobId));
export const recoverNotificationDeliveries = functions.runWith({ timeoutSeconds: 120, memory: '256MB', maxInstances: 1 })
    .region('asia-northeast3').pubsub.schedule('every 1 minutes').timeZone('Asia/Seoul').onRun(async () => {
        const db = admin.firestore(), now = Date.now();
        const jobs = await db.collection('notice_notification_outbox').where('status', '==', 'pending').where('nextAttemptAt', '<=', stamp(now)).orderBy('nextAttemptAt').limit(100).get();
        const reminders = await db.collection('notification_user_states').where('reminderStatus', '==', 'scheduled').where('snoozedUntil', '<=', stamp(now)).orderBy('snoozedUntil').limit(200).get();
        for (const job of jobs.docs) await deliverNoticeJob(db, job.id, now);
        for (const reminder of reminders.docs) {
            try { await deliverPersonalReminder(db, reminder.id, now); }
            catch { functions.logger.warn('Personal notification reminder will retry.', { stateId: reminder.id }); }
        }
    });

export async function archiveDeletedNotice(db: FirebaseFirestore.Firestore, noticeId: string) {
    const messages = await db.collection('erp_messages').where('noticeId', '==', noticeId).get();
    for (let i = 0; i < messages.size; i += 450) {
        const batch = db.batch();
        for (const message of messages.docs.slice(i, i + 450)) batch.update(message.ref, { status: 'archived', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
    }
}
export const archiveDeletedNoticeNotifications = functions.runWith({ timeoutSeconds: 120, memory: '256MB', maxInstances: 5, failurePolicy: true })
    .region('asia-northeast3').firestore.document('notices/{noticeId}').onDelete((_, context) => archiveDeletedNotice(admin.firestore(), context.params.noticeId));
