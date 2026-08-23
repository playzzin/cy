import React from 'react';
import type { PlanStatus } from '../types';

type StatusMeta = {
    label: string;
    tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'violet' | 'rose';
};

const STATUS_META: Record<PlanStatus, StatusMeta> = {
    draft: { label: '작성 중', tone: 'slate' },
    in_review: { label: '검토 중', tone: 'blue' },
    changes_requested: { label: '수정 요청', tone: 'amber' },
    review_completed: { label: '검토 완료', tone: 'violet' },
    approved_pending_issue: { label: '승인 · 발행 대기', tone: 'violet' },
    issued: { label: '현장사용 발행', tone: 'emerald' },
    superseded: { label: '대체됨', tone: 'slate' },
    archived: { label: '보관', tone: 'slate' },
    void: { label: '폐기', tone: 'rose' },
};

export const getConstructionPlanStatusLabel = (status: PlanStatus): string =>
    STATUS_META[status]?.label ?? status;

type ConstructionPlanStatusBadgeProps = {
    status: PlanStatus;
    compact?: boolean;
};

export function ConstructionPlanStatusBadge({ status, compact = false }: ConstructionPlanStatusBadgeProps) {
    const meta = STATUS_META[status] ?? STATUS_META.draft;

    return (
        <span className={`cp-status-badge cp-status-badge--${meta.tone}${compact ? ' cp-status-badge--compact' : ''}`}>
            <span className="cp-status-badge__dot" aria-hidden="true" />
            {meta.label}
        </span>
    );
}

export default ConstructionPlanStatusBadge;
