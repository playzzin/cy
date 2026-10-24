import type { ErpMessage } from '../types/erpMessage';

export function noticeIdFromMessage(message: Pick<ErpMessage, 'actionUrl'>): string | null {
    if (!message.actionUrl?.startsWith('/notices?')) return null;
    const id = new URLSearchParams(message.actionUrl.slice('/notices?'.length)).get('noticeId');
    return id && !id.includes('/') && !id.includes('\\') && !Array.from(id).some(char => char.charCodeAt(0) < 32)
        && id !== '.' && id !== '..' ? id : null;
}

export function messageDestination(message: Pick<ErpMessage, 'id' | 'senderId' | 'actionUrl'>): string {
    const noticeId = noticeIdFromMessage(message);
    if (noticeId) return `/notices?noticeId=${encodeURIComponent(noticeId)}`;
    if (message.senderId === 'system:task-notification' && message.actionUrl?.startsWith('/todo?')) {
        const query = new URLSearchParams(message.actionUrl.slice('/todo?'.length));
        const taskId = query.get('taskId');
        if (taskId && !taskId.includes('/') && taskId !== '.' && taskId !== '..') return `/todo?taskId=${encodeURIComponent(taskId)}`;
    }
    if (message.senderId === 'system:smart-memo-reminder' && message.actionUrl?.startsWith('/memos?')) {
        const query = new URLSearchParams(message.actionUrl.slice('/memos?'.length));
        const memoId = query.get('memoId');
        if (memoId && !memoId.includes('/')) return `/memos?memoId=${encodeURIComponent(memoId)}`;
    }
    return `/messages?messageId=${encodeURIComponent(message.id)}`;
}
