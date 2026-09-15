// Task Types for Todo/TaskBoard
import { TASK_STATUS_META } from '../utils/taskStatus';

export interface TaskReview {
    changes: string;
    location: string;
    steps: string;
    expected: string;
    deployment: 'pending' | 'preview' | 'deployed' | 'not_required';
    requestedAt?: string;
    requestedBy?: string;
}

export interface TaskComment {
    id: number;
    user: string;
    text: string;
    time: string;
    image?: string | null;
    images?: string[];
    isSystem: boolean;
}

export interface TaskAutomationInfo {
    status?: 'in_progress' | 'completed' | 'failed';
    source?: 'browser' | 'codex_cli';
    mode?: 'manual' | 'auto';
    autoRun?: boolean;
    startedAt?: string;
    completedAt?: string;
    originalTitle?: string;
    updatedTitle?: string;
    feedback?: string;
    changedFiles?: string[];
    verification?: string[];
    reviewRequired?: boolean;
    reviewReason?: string;
    error?: string;
    runId?: string;
    workerHost?: string;
    exitCode?: number;
    logPath?: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    assignee: string;
    createdBy?: string; // 추가된 필드: 업무 요청자
    priority: '긴급' | '보통';
    status: '요청' | '진행' | '완료' | '검토' | '요청중' | '진행중' | '검토중' | '재요청' | '완료함';
    dueDate: string;
    createdAt: string;
    image?: string | null;
    images?: string[];
    comments: TaskComment[];
    automation?: TaskAutomationInfo;
    review?: TaskReview;
}

export const STATUS_CONFIG = Object.fromEntries(Object.entries(TASK_STATUS_META).map(([status, meta]) => [status, { color: meta.className, icon: meta.icon, label: meta.label }])) as Record<string, { color: string; icon: string; label: string }>;

export const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
    '긴급': { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: 'arrow-up' },
    '보통': { color: 'text-amber-600 bg-amber-50 border-amber-100', icon: 'circle' }
};
