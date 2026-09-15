import { messageDestination } from './messageNavigation';

it('opens the exact memo for a trusted memo reminder', () => {
    expect(messageDestination({ id: 'message', senderId: 'system:smart-memo-reminder', actionUrl: '/memos?memoId=memo%20one' })).toBe('/memos?memoId=memo%20one');
});

it.each(['https://example.test/memos?memoId=a', '//example.test/memos?memoId=a', '/memos?memoId=', '/memos?memoId=..%2Fother'])('does not follow an invalid memo target %s', actionUrl => {
    expect(messageDestination({ id: 'message', senderId: 'system:smart-memo-reminder', actionUrl })).toBe('/messages?messageId=message');
});

it('keeps regular messages in the message center', () => {
    expect(messageDestination({ id: 'regular', senderId: 'user', actionUrl: '/memos?memoId=a' })).toBe('/messages?messageId=regular');
});

it('opens the exact task from a task notification', () => {
    expect(messageDestination({ id: 'message', senderId: 'system:task-notification', actionUrl: '/todo?taskId=task%20one&filter=mine' })).toBe('/todo?taskId=task%20one');
});

it.each(['https://example.test/todo?taskId=a', '//example.test/todo?taskId=a', '/todo?taskId=', '/todo?taskId=..%2Fother', '/todo?taskId=..'])('does not follow an invalid task target %s', actionUrl => {
    expect(messageDestination({ id: 'message', senderId: 'system:task-notification', actionUrl })).toBe('/messages?messageId=message');
});

it('does not treat a regular message as a task notification', () => {
    expect(messageDestination({ id: 'message', senderId: 'user', actionUrl: '/todo?taskId=one' })).toBe('/messages?messageId=message');
});
