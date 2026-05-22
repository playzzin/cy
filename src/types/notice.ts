import type { Timestamp } from 'firebase/firestore';

export type NoticePriority = 'normal' | 'important' | 'urgent';
export type NoticeStatus = 'draft' | 'published' | 'archived';

export interface NoticeAuthor {
    uid: string;
    name: string;
    email?: string | null;
}

export interface NoticeCategory {
    id: string;
    name: string;
    color: string;
    order: number;
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
}

export interface Notice {
    id: string;
    title: string;
    body: string;
    category: string;
    targetPositions: string[];
    priority: NoticePriority;
    status: NoticeStatus;
    pinned: boolean;
    createdBy: NoticeAuthor;
    updatedBy?: NoticeAuthor | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    publishedAt?: Timestamp | null;
    expiresAt?: Timestamp | null;
}

export interface UpsertNoticeInput {
    title: string;
    body: string;
    category: string;
    targetPositions: string[];
    priority: NoticePriority;
    status?: NoticeStatus;
    pinned: boolean;
    expiresAt?: Timestamp | null;
}

export interface UpsertNoticeCategoryInput {
    name: string;
    color: string;
    order?: number;
}
