import type { Timestamp } from 'firebase/firestore';

export type NotificationSource = 'notice' | 'memo' | 'task' | 'message';
export interface NotificationPreferences {
    sound: boolean;
    sources: Record<NotificationSource, boolean>;
    quietEnabled: boolean;
    quietStart: string;
    quietEnd: string;
    digestMinutes: number;
}
export interface NotificationUserState {
    messageId: string;
    userId: string;
    confirmedAt?: Timestamp | null;
    snoozedUntil?: Timestamp | null;
    remindedAt?: Timestamp | null;
}
export interface NoticeDeliveryJob {
    id: string; noticeId: string; title: string;
    status: 'pending' | 'sent' | 'failed' | 'disabled' | 'no_recipients' | 'cancelled';
    reason: string; attempts: number; recipientCount: number; deliveredCount: number;
    requiresConfirmation: boolean; dueAt: number | null; createdAt: number; nextAttemptAt: number | null;
}
export interface NoticeDeliveryRecipient {
    uid: string; name: string; delivered: boolean; read: boolean; confirmedAt: number | null;
}
