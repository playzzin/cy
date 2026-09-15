import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as admin from 'firebase-admin';
import { buildTaskNotification, notifyTaskChanges, resolveTaskNotificationRecipients, taskNotificationId, taskNotificationKind } from './taskNotifications';

test('new requests and revision requests notify DEV, including legacy statuses', () => {
    for (const status of ['요청', '요청중', '재요청']) assert.equal(taskNotificationKind(undefined, { status }), 'request');
    assert.equal(taskNotificationKind({ status: '완료' }, { status: '재요청' }), 'revision');
    assert.equal(taskNotificationKind({ status: '재요청' }, { status: '재요청', title: '수정' }), null);
});

test('completion requests review once; comments, approval and deletion send nothing', () => {
    for (const status of ['완료', '검토중']) assert.equal(taskNotificationKind({ status: '진행' }, { status }), 'review');
    assert.equal(taskNotificationKind({ status: '완료' }, { status: '검토중' }), null);
    assert.equal(taskNotificationKind({ status: '완료' }, { status: '검토' }), null);
    assert.equal(taskNotificationKind({ status: '완료' }, { status: '완료', title: '변경된 제목' }), null);
    assert.equal(taskNotificationKind({ status: '요청' }, undefined), null);
    assert.equal(taskNotificationKind(undefined, { status: '검토' }), null);
});

test('automation requiring human intervention alerts DEV once per completion', () => {
    const task = { status: '검토', automation: { status: 'completed', reviewRequired: true, completedAt: '2026-09-16' } };
    assert.equal(taskNotificationKind({ status: '진행' }, task), 'developer_review');
    assert.equal(taskNotificationKind(task, { ...task, title: '수정' }), null);
    assert.equal(taskNotificationKind(task, { ...task, automation: { ...task.automation, completedAt: '2026-09-17' } }), 'developer_review');
});

test('DEV recipients use active role, position and additional positions; admin alone is excluded', () => {
    const users = [
        { uid: 'role', role: 'Developer' }, { uid: 'position', position: ' ＤＥＶ ' },
        { uid: 'additional', additionalPositions: ['일반', '개발자'] },
        { uid: 'admin', role: 'admin' }, { uid: 'name-only', displayName: 'dev' },
        { uid: 'suspended', role: 'DEV', status: 'suspended' },
        { uid: 'pending', role: 'dev', status: 'pending' },
    ];
    assert.deepEqual(resolveTaskNotificationRecipients('request', {}, users).map(user => user.uid), ['role', 'position', 'additional']);
});

test('review uses requester ID across renames, without falling back from an invalid ID', () => {
    const users = [{ uid: 'one', displayName: '바뀐 이름' }, { uid: 'two', displayName: '원래 이름' }];
    assert.deepEqual(resolveTaskNotificationRecipients('review', { createdById: 'one', createdBy: '원래 이름' }, users).map(user => user.uid), ['one']);
    assert.deepEqual(resolveTaskNotificationRecipients('review', { createdById: 'missing', createdBy: '원래 이름' }, users), []);
    assert.deepEqual(resolveTaskNotificationRecipients('review', { createdById: 'one' }, [{ ...users[0], status: 'rejected' }]), []);
});

test('legacy names require one match; inactive duplicates cannot redirect a notification', () => {
    const users = [{ uid: 'one', displayName: '요청자', email: 'legacy@example.test' }];
    for (const createdBy of ['요청자', 'one', 'legacy@example.test', 'legacy']) {
        assert.equal(resolveTaskNotificationRecipients('review', { createdBy }, users)[0]?.uid, 'one');
    }
    assert.deepEqual(resolveTaskNotificationRecipients('review', { createdBy: '요청자' }, [...users, { uid: 'two', displayName: '요청자', status: 'suspended' }]), []);
    assert.deepEqual(resolveTaskNotificationRecipients('review', { createdBy: '없는 요청자', assignee: '요청자' }, users), []);
    assert.equal(resolveTaskNotificationRecipients('review', { assignee: '요청자' }, users)[0]?.uid, 'one');
    assert.deepEqual(resolveTaskNotificationRecipients('review', {}, users), []);
});

test('messages contain review guidance and an encoded task link, and start unread', () => {
    const timestamp = admin.firestore.Timestamp.now();
    const message = buildTaskNotification('review', 'task space', {
        title: '요청 제목', priority: '긴급', review: { changes: '바뀐 기능', location: '확인 화면', steps: '버튼 클릭', expected: '정상 결과' },
    }, [{ uid: 'requester', displayName: '요청자' }], timestamp);
    assert.equal(message.type, 'system');
    assert.equal(message.priority, 'urgent');
    assert.equal(message.actionUrl, '/todo?taskId=task%20space');
    assert.deepEqual(message.recipientIds, ['requester']);
    assert.deepEqual(message.readBy, []);
    for (const value of ['바뀐 기능', '확인 화면', '버튼 클릭', '정상 결과']) assert.ok(message.body.includes(value));
});

test('event IDs are stable for retries and distinct for a second review cycle', () => {
    assert.equal(taskNotificationId('task', 'event'), taskNotificationId('task', 'event'));
    assert.notEqual(taskNotificationId('task', 'event'), taskNotificationId('task', 'next-event'));
    assert.notEqual(taskNotificationId('task', 'event'), taskNotificationId('other', 'event'));
    const project = process.env.GCLOUD_PROJECT;
    try {
        process.env.GCLOUD_PROJECT = 'demo-task-notifications';
        const trigger = (notifyTaskChanges as any).__trigger;
        assert.ok(trigger.eventTrigger.resource.endsWith('/tasks/{taskId}'));
        assert.ok(trigger.failurePolicy);
    } finally {
        if (project === undefined) delete process.env.GCLOUD_PROJECT;
        else process.env.GCLOUD_PROJECT = project;
    }
});
