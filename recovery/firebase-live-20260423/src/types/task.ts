// Task Types for Todo/TaskBoard

export interface TaskComment {
    id: number;
    user: string;
    text: string;
    time: string;
    image?: string | null;
    images?: string[];
    isSystem: boolean;
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
}

export const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    '요청': { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'clock', label: '요청' },
    '진행': { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'loader', label: '진행' },
    '완료': { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: 'circle-check', label: '완료' },
    '검토': { color: 'bg-violet-50 text-violet-600 border-violet-200', icon: 'magnifying-glass', label: '검토' },
    // Legacy support
    '요청중': { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'clock', label: '요청' },
    '진행중': { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'loader', label: '진행' },
    '검토중': { color: 'bg-violet-50 text-violet-600 border-violet-200', icon: 'magnifying-glass', label: '검토' },
    '재요청': { color: 'bg-orange-50 text-orange-600 border-orange-200', icon: 'rotate-right', label: '요청' },
    '완료함': { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: 'circle-check', label: '완료' }
};

export const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
    '긴급': { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: 'arrow-up' },
    '보통': { color: 'text-amber-600 bg-amber-50 border-amber-100', icon: 'circle' }
};
