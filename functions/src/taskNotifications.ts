import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';

export const TASK_NOTIFICATION_SENDER = 'system:task-notification';
type NotificationKind = 'request' | 'revision' | 'review' | 'developer_review';
interface TaskNotificationData {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    createdBy?: string;
    createdById?: string;
    assignee?: string;
    review?: { changes?: string; location?: string; steps?: string; expected?: string };
    automation?: { status?: string; completedAt?: string; reviewRequired?: boolean; reviewReason?: string };
}
interface RecipientProfile {
    uid: string;
    status?: string;
    displayName?: string;
    email?: string;
    role?: string;
    position?: string;
    additionalPositions?: string[];
}
const normalize = (value: unknown): string => String(value ?? '').trim().normalize('NFKC').toLowerCase();
const active = (user: RecipientProfile): boolean => !user.status || user.status === 'active';
const reviewStatuses = new Set(['완료', '검토중']);
const devRoles = new Set(['dev', 'developer', '개발', '개발자']);

export function taskNotificationKind(before: TaskNotificationData | undefined, after: TaskNotificationData | undefined): NotificationKind | null {
    if (!after) return null;
    if (!before && ['요청', '요청중', '재요청'].includes(after.status)) return 'request';
    if (after.status === '재요청' && before?.status !== '재요청') return 'revision';
    if (reviewStatuses.has(after.status) && !reviewStatuses.has(before?.status)) return 'review';
    // 이전 자동 처리 도구는 개발자 확인이 필요한 결과를 '검토' 상태로 기록합니다.
    if (after.automation?.reviewRequired === true && after.automation.status === 'completed'
        && after.automation.completedAt && after.automation.completedAt !== before?.automation?.completedAt) return 'developer_review';
    return null;
}

export function resolveTaskNotificationRecipients(kind: NotificationKind, task: TaskNotificationData, users: RecipientProfile[]): RecipientProfile[] {
    if (kind !== 'review') {
        return users.filter(user => active(user) && [user.role, user.position, ...(Array.isArray(user.additionalPositions) ? user.additionalPositions : [])]
            .some(role => devRoles.has(normalize(role))));
    }
    // ID가 있으면 이름으로 재추정하지 않습니다. 이름 변경·동명이인 오발송을 방지합니다.
    if (task.createdById) return users.filter(user => user.uid === task.createdById && active(user));
    const identity = normalize(task.createdBy || task.assignee);
    if (!identity) return [];
    const exact = users.filter(user => [user.uid, user.email].some(value => normalize(value) === identity));
    const matches = exact.length ? exact : users.filter(user => [user.displayName, user.email?.split('@')[0]]
        .some(value => normalize(value) === identity));
    return matches.length === 1 && active(matches[0]) ? matches : [];
}

export const taskNotificationId = (taskId: string, eventId: string): string =>
    `task-${createHash('sha256').update(`${taskId}\0${eventId}`).digest('hex')}`;

export function buildTaskNotification(kind: NotificationKind, taskId: string, task: TaskNotificationData, recipients: RecipientProfile[], timestamp: FirebaseFirestore.Timestamp) {
    const title = String(task.title || '제목 없는 요청').slice(0, 100);
    const requester = String(task.createdBy || '요청자').slice(0, 80);
    const snippet = (value?: string) => String(value || '').trim().slice(0, 300);
    const reviewBody = task.review ? [
        ['바뀐 점', task.review.changes], ['확인할 화면', task.review.location],
        ['확인 순서', task.review.steps], ['정상 결과', task.review.expected],
    ].filter(([, value]) => snippet(value)).map(([label, value]) => `${label}: ${snippet(value)}`).join('\n') : '';
    const labels: Record<NotificationKind, string> = {
        request: '새 요청', revision: '수정 요청', review: '결과 검토 요청', developer_review: '개발자 검토 필요',
    };
    const body = kind === 'review'
        ? ['요청 처리가 완료되었습니다. 결과를 확인하고 완료 승인 또는 수정 요청을 선택해 주세요.', reviewBody].filter(Boolean).join('\n\n')
        : kind === 'developer_review'
            ? `자동 처리 결과에 개발자 검토가 필요합니다.\n${snippet(task.automation?.reviewReason)}`
            : `${requester}님의 ${kind === 'revision' ? '수정 요청이' : '새 요청이'} 등록되었습니다. 할일에서 내용을 확인해 주세요.\n${snippet(task.description)}`.trim();
    return {
        type: 'system', title: `${labels[kind]}: ${title}`, body, category: '할일 알림',
        priority: task.priority === '긴급' ? 'urgent' : kind === 'review' || kind === 'developer_review' ? 'high' : 'normal',
        status: 'active', senderId: TASK_NOTIFICATION_SENDER, senderName: '할일 알림', senderEmail: null,
        recipientScope: 'users', recipientIds: Array.from(new Set(recipients.map(user => user.uid))),
        recipientNames: recipients.map(user => user.displayName || user.email?.split('@')[0] || '사용자'),
        readBy: [], readAtBy: {}, pinned: false,
        actionLabel: kind === 'review' ? '결과 확인하기' : '요청 확인하기', actionUrl: `/todo?taskId=${encodeURIComponent(taskId)}`,
        createdAt: timestamp, updatedAt: timestamp, expiresAt: null,
    };
}

export async function deliverTaskNotification(db: FirebaseFirestore.Firestore, input: {
    taskId: string; eventId: string; before?: TaskNotificationData; after?: TaskNotificationData;
}): Promise<'sent' | 'duplicate' | 'skipped' | 'no_recipients'> {
    const kind = taskNotificationKind(input.before, input.after);
    if (!kind) return 'skipped';
    const task = input.after!;
    const ref = db.collection('erp_messages').doc(taskNotificationId(input.taskId, input.eventId));
    return db.runTransaction(async transaction => {
        if ((await transaction.get(ref)).exists) return 'duplicate';
        const users = await transaction.get(db.collection('users'));
        const profiles = users.docs.map(snapshot => ({ ...snapshot.data(), uid: snapshot.id } as RecipientProfile));
        const recipients = resolveTaskNotificationRecipients(kind, task, profiles);
        if (!recipients.length) return 'no_recipients';
        transaction.create(ref, buildTaskNotification(kind, input.taskId, task, recipients, admin.firestore.Timestamp.now()));
        return 'sent';
    });
}

// 화면과 자동화 도구의 요청 변경을 모두 수신합니다. 재시도는 같은 메시지 ID를 사용합니다.
export const notifyTaskChanges = functions.runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10, failurePolicy: true })
    .region('asia-northeast3').firestore.document('tasks/{taskId}').onWrite(async (change, context) => {
        const result = await deliverTaskNotification(admin.firestore(), {
            taskId: context.params.taskId, eventId: context.eventId,
            before: change.before.exists ? change.before.data() : undefined,
            after: change.after.exists ? change.after.data() : undefined,
        });
        if (result === 'no_recipients') functions.logger.warn('Task notification has no unambiguous active recipient.', { taskId: context.params.taskId });
    });
