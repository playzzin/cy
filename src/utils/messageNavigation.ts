import type { ErpMessage } from '../types/erpMessage';

export function messageDestination(message: Pick<ErpMessage, 'id' | 'senderId' | 'actionUrl'>): string {
    if (message.senderId === 'system:smart-memo-reminder' && message.actionUrl?.startsWith('/memos?')) {
        const query = new URLSearchParams(message.actionUrl.slice('/memos?'.length));
        const memoId = query.get('memoId');
        if (memoId && !memoId.includes('/')) return `/memos?memoId=${encodeURIComponent(memoId)}`;
    }
    return `/messages?messageId=${encodeURIComponent(message.id)}`;
}
