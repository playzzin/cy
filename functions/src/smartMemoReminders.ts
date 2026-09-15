import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { requireCallableAuth } from './auth';

export const MEMO_REMINDERS = 'smart_memo_reminders';
export const MEMO_REMINDER_SENDER = 'system:smart-memo-reminder';
export const REMINDER_REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'] as const;
export type ReminderRepeat = typeof REMINDER_REPEATS[number];
const DAY = 86400000;
const KST = 9 * 3600000;
const devRoles = new Set(['dev', 'developer', '개발', '개발자']);
const activeProfile = (profile: any) => Boolean(profile && (!('status' in profile) || profile.status === 'active'));

export function canReceiveMemoReminder(uid: string, profile: any, memo: any): boolean {
    if (!activeProfile(profile) || !memo) return false;
    return memo.userId === uid ||
        memo.scope === 'public' || memo.categoryId === 'public' ||
        [profile.role, profile.position, ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : [])]
            .some(role => devRoles.has(String(role || '').trim().normalize('NFKC').toLowerCase()));
}

export function nextMemoReminderTime(at: number, repeat: ReminderRepeat, now: number, anchorDay: number): number | null {
    if (repeat === 'none') return null;
    if (repeat === 'daily' || repeat === 'weekly') {
        const period = repeat === 'weekly' ? 7 * DAY : DAY;
        return at + Math.max(1, Math.floor((now - at) / period) + 1) * period;
    }
    if (repeat === 'weekdays') {
        let next = at + Math.max(1, Math.floor((now - at) / DAY)) * DAY;
        while (next <= now || [0, 6].includes(new Date(next + KST).getUTCDay())) next += DAY;
        return next;
    }
    const base = new Date(at + KST);
    let month = base.getUTCMonth() + 1;
    let next: number;
    do {
        const lastDay = new Date(Date.UTC(base.getUTCFullYear(), month + 1, 0)).getUTCDate();
        next = Date.UTC(base.getUTCFullYear(), month, Math.min(anchorDay, lastDay), base.getUTCHours(), base.getUTCMinutes()) - KST;
        month++;
    } while (next <= now);
    return next;
}

export const memoReminderId = (uid: string, memoId: string) => createHash('sha256').update(`${uid}\0${memoId}`).digest('hex');

export async function saveMemoReminder(db: FirebaseFirestore.Firestore, uid: string, input: any, now = Date.now()) {
    const memoId = typeof input?.memoId === 'string' ? input.memoId : '';
    if (!memoId || memoId.includes('/') || memoId === '.' || memoId === '..' || Buffer.byteLength(memoId) > 1500) {
        throw new functions.https.HttpsError('invalid-argument', '메모를 선택해 주세요.');
    }
    const cancel = input.remindAt === null;
    const repeat: ReminderRepeat = input.repeat || 'none';
    if (!cancel && (!Number.isSafeInteger(input.remindAt) || input.remindAt <= now || input.remindAt > 253402300799999 || !REMINDER_REPEATS.includes(repeat))) {
        throw new functions.https.HttpsError('invalid-argument', '미래의 알림 시간과 반복 주기를 선택해 주세요.');
    }
    let remindAt = input.remindAt;
    if (!cancel && repeat === 'weekdays') {
        while ([0, 6].includes(new Date(remindAt + KST).getUTCDay())) remindAt += DAY;
    }
    const ref = db.collection(MEMO_REMINDERS).doc(memoReminderId(uid, memoId));
    return db.runTransaction(async transaction => {
        const [userSnap, reminderSnap, memoSnap] = await Promise.all([
            transaction.get(db.collection('users').doc(uid)),
            transaction.get(ref),
            transaction.get(db.collection('smart_memos').doc(memoId))
        ]);
        if (!activeProfile(userSnap.data())) throw new functions.https.HttpsError('permission-denied', '활성 계정이 필요합니다.');
        if (!cancel && !canReceiveMemoReminder(uid, userSnap.data(), memoSnap.data())) {
            throw new functions.https.HttpsError('permission-denied', '이 메모에 알림을 설정할 권한이 없습니다.');
        }
        const previous = reminderSnap.data();
        const previousMessage = previous?.lastMessageId ? await transaction.get(db.collection('erp_messages').doc(previous.lastMessageId)) : null;
        const timestamp = admin.firestore.Timestamp.fromMillis(now);
        if (previousMessage?.exists) transaction.update(previousMessage.ref, { status: 'archived', updatedAt: timestamp });
        if (cancel) {
            if (reminderSnap.exists) transaction.update(ref, { status: 'cancelled', updatedAt: timestamp });
            return { id: ref.id, status: 'cancelled' };
        }
        transaction.set(ref, {
            userId: uid, memoId, remindAt: admin.firestore.Timestamp.fromMillis(remindAt),
            repeat, anchorDay: new Date(remindAt + KST).getUTCDate(), status: 'scheduled',
            revision: (Number.isSafeInteger(previous?.revision) ? previous.revision : 0) + 1,
            lastMessageId: null, lastSentAt: null, createdAt: previous?.createdAt || timestamp, updatedAt: timestamp
        });
        return { id: ref.id, status: 'scheduled' };
    });
}

export async function deliverMemoReminder(db: FirebaseFirestore.Firestore, reminderId: string, now = Date.now()): Promise<boolean> {
    const ref = db.collection(MEMO_REMINDERS).doc(reminderId);
    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const reminder = snapshot.data();
        const at = reminder?.remindAt?.toMillis?.();
        if (!reminder || reminder.status !== 'scheduled' || typeof at !== 'number' || at > now) return false;
        const [userSnap, memoSnap] = await Promise.all([
            transaction.get(db.collection('users').doc(reminder.userId)),
            transaction.get(db.collection('smart_memos').doc(reminder.memoId))
        ]);
        const timestamp = admin.firestore.Timestamp.fromMillis(now);
        if (!canReceiveMemoReminder(reminder.userId, userSnap.data(), memoSnap.data())) {
            transaction.update(ref, { status: 'unavailable', updatedAt: timestamp });
            return false;
        }
        const memo = memoSnap.data()!;
        const messageId = `memo-reminder-${ref.id}-${reminder.revision}-${at}`;
        transaction.set(db.collection('erp_messages').doc(messageId), {
            type: 'system', title: `메모 알림: ${String(memo.title || '제목 없음').slice(0, 100)}`,
            body: '설정한 알림 시간이 되었습니다. 메모를 확인해 주세요.', category: '메모 알림',
            priority: 'normal', status: 'active', senderId: MEMO_REMINDER_SENDER, senderName: '스마트메모 알림', senderEmail: null,
            recipientScope: 'users', recipientIds: [reminder.userId], recipientNames: [], readBy: [], readAtBy: {},
            pinned: false, actionLabel: '메모 열기', actionUrl: `/memos?memoId=${encodeURIComponent(reminder.memoId)}`,
            createdAt: timestamp, updatedAt: timestamp, expiresAt: null
        });
        const repeat: ReminderRepeat = REMINDER_REPEATS.includes(reminder.repeat) ? reminder.repeat : 'none';
        const nextAt = nextMemoReminderTime(at, repeat, now, reminder.anchorDay || new Date(at + KST).getUTCDate());
        transaction.update(ref, {
            status: nextAt === null ? 'sent' : 'scheduled',
            ...(nextAt === null ? {} : { remindAt: admin.firestore.Timestamp.fromMillis(nextAt) }),
            lastSentAt: timestamp, lastMessageId: messageId, updatedAt: timestamp
        });
        return true;
    });
}

export const setSmartMemoReminder = functions.runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3').https.onCall(async (data, context) => {
        const auth = requireCallableAuth(context);
        return saveMemoReminder(admin.firestore(), auth.uid, data);
    });

export const dispatchSmartMemoReminders = functions.runWith({ timeoutSeconds: 120, memory: '256MB', maxInstances: 1 })
    .region('asia-northeast3').pubsub.schedule('every 1 minutes').timeZone('Asia/Seoul').onRun(async () => {
        const db = admin.firestore();
        const now = Date.now();
        const due = await db.collection(MEMO_REMINDERS).where('status', '==', 'scheduled')
            .where('remindAt', '<=', admin.firestore.Timestamp.fromMillis(now)).orderBy('remindAt').limit(200).get();
        for (let offset = 0; offset < due.docs.length; offset += 10) {
            await Promise.all(due.docs.slice(offset, offset + 10).map(async reminder => {
                try { await deliverMemoReminder(db, reminder.id, now); }
                catch { functions.logger.error('Failed to dispatch a smart memo reminder.', { reminderId: reminder.id }); }
            }));
        }
        return null;
    });
