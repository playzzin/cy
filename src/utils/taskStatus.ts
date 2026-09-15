export type TaskStage = 'active' | 'review' | 'done';
export const ACTIVE_TASK_STATUSES = new Set(['요청', '요청중', '재요청', '진행', '진행중']);
export const REVIEW_TASK_STATUSES = new Set(['완료', '검토중']);
export const DONE_TASK_STATUSES = new Set(['검토', '완료함', '완료됨', '최종', 'closed', 'done', 'complete', 'completed']);

export function getTaskStage(value: unknown): TaskStage {
    const status = String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
    if (DONE_TASK_STATUSES.has(status)) return 'done';
    if (REVIEW_TASK_STATUSES.has(status)) return 'review';
    return 'active';
}

const active = { label: '접수', description: '담당자가 확인할 차례예요', className: 'border-slate-200 bg-slate-100 text-slate-700', icon: 'clock' };
const working = { label: '처리 중', description: '담당자가 요청을 처리하고 있어요', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: 'loader' };
const review = { label: '확인 필요', description: '요청자가 결과를 확인할 차례예요', className: 'border-violet-200 bg-violet-50 text-violet-700', icon: 'magnifying-glass' };
const done = { label: '완료', description: '요청자가 결과를 확인했어요', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: 'circle-check' };
export const TASK_STATUS_META: Record<string, typeof active> = {
    요청: active, 요청중: active, 진행: working, 진행중: working, 완료: review, 검토중: review, 검토: done, 완료함: done,
    재요청: { label: '수정 요청', description: '요청자의 의견을 확인해 주세요', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: 'rotate-right' },
};
export const getTaskStatusMeta = (status: string) => TASK_STATUS_META[status] || (getTaskStage(status) === 'done' ? done : active);
