import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type { UpsertNoticeInput } from '../types/notice';
import type { NotificationPreferences, NotificationUserState, NoticeDeliveryJob, NoticeDeliveryRecipient } from '../types/notificationCenter';
import { defaultNotificationPreferences } from '../utils/notificationCenter';

const call = async <T>(name: string, input: unknown): Promise<T> => (await httpsCallable<unknown, T>(functions, name)(input)).data;
export const notificationCenterService = {
    saveNotice: (requestId: string, noticeId: string | null, notice: UpsertNoticeInput, notify: boolean) =>
        call<{ noticeId: string; jobId: string; status: NoticeDeliveryJob['status'] }>('saveNoticeWithNotification', {
            requestId, noticeId, notify, notice: { ...notice, expiresAt: notice.expiresAt?.toMillis() || null, confirmationDueAt: notice.confirmationDueAt?.toMillis() || null },
        }),
    subscribePreferences: (uid: string, next: (prefs: NotificationPreferences) => void, error: (error: Error) => void) =>
        onSnapshot(doc(db, 'notification_preferences', uid), snapshot => next({
            ...defaultNotificationPreferences, ...snapshot.data(),
            sources: { ...defaultNotificationPreferences.sources, ...snapshot.data()?.sources },
        }), error),
    subscribeStates: (uid: string, next: (states: Record<string, NotificationUserState>) => void, error: (error: Error) => void) =>
        onSnapshot(query(collection(db, 'notification_user_states'), where('userId', '==', uid)),
            snapshot => next(Object.fromEntries(snapshot.docs.map(s => [s.data().messageId, s.data() as NotificationUserState]))), error),
    savePreferences: (prefs: NotificationPreferences) => call('saveNotificationPreferences', prefs),
    confirm: (messageId: string) => call('setPersonalNotification', { messageId, action: 'confirm' }),
    snooze: (messageId: string, until: number) => call('setPersonalNotification', { messageId, action: 'snooze', until }),
    resume: (messageId: string) => call('setPersonalNotification', { messageId, action: 'resume' }),
    deliveryJobs: (before?: number, beforeId?: string) => call<{ jobs: NoticeDeliveryJob[]; hasMore: boolean }>('getNoticeDeliveryReport', { before, beforeId }),
    deliveryRecipients: (jobId: string) => call<{ recipients: NoticeDeliveryRecipient[] }>('getNoticeDeliveryReport', { jobId }),
    retryDelivery: (jobId: string) => call<{ status: string }>('retryNoticeDelivery', { jobId }),
};
