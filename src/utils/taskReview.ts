import type { TaskReview } from '../types/task';

export const TASK_DEPLOYMENT_LABELS: Record<TaskReview['deployment'], string> = {
    pending: '사이트 반영 대기', preview: '검증 화면 반영', deployed: '실제 사이트 반영', not_required: '사이트 변경 없는 요청',
};
export const emptyTaskReview = (): TaskReview => ({ changes: '', steps: '', expected: '', deployment: 'pending', location: '' });
export function validateTaskReview(review: TaskReview): string | null {
    if (![review.changes, review.steps, review.expected, review.location].every(value => String(value ?? '').trim())) return '바뀐 점, 확인할 화면, 확인 순서, 정상 결과를 모두 적어 주세요.';
    if (review.deployment === 'pending' || !TASK_DEPLOYMENT_LABELS[review.deployment]) return '확인할 수 있는 화면에 반영한 뒤 확인 요청을 보내 주세요.';
    if ([review.changes, review.steps, review.expected, review.location].some(value => value.length > 3000)) return '각 안내는 3,000자 이내로 작성해 주세요.';
    return null;
}
export function formatTaskReview(review: TaskReview): string {
    return `바뀐 점\n${review.changes.trim()}\n\n확인할 화면\n${review.location.trim()}\n\n확인 순서\n${review.steps.trim()}\n\n정상 결과\n${review.expected.trim()}\n\n반영 상태\n${TASK_DEPLOYMENT_LABELS[review.deployment]}`;
}
