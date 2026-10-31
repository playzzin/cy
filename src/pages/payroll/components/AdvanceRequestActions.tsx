import React from 'react';
import type { AdvanceRequest } from '../../../services/advanceRequestService';

export type AdvanceRequestAction = 'cancel' | 'delete';

export default function AdvanceRequestActions({ request, canManage, disabled, onAction }: {
    request: AdvanceRequest;
    canManage: boolean;
    disabled: boolean;
    onAction: (request: AdvanceRequest, action: AdvanceRequestAction) => void;
}) {
    if (!canManage || !request.id || request.deletedAt || request.source === 'manual-prepayment') return null;
    const action = request.status === 'requested' ? 'cancel'
        : request.status === 'cancelled' || request.status === 'rejected' ? 'delete' : null;
    if (!action) return null;
    return <button type="button" disabled={disabled} onClick={() => onAction(request, action)}
        className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
        {action === 'cancel' ? '신청 취소' : '삭제'}
    </button>;
}

export function confirmAdvanceRequestAction(request: AdvanceRequest, action: AdvanceRequestAction): boolean {
    const target = `${request.workerName || '작업자'} · ${request.yearMonth} · ${request.requestedAmount.toLocaleString('ko-KR')}원`;
    return window.confirm(action === 'cancel'
        ? `${target}\n신청을 취소할까요? 취소 내역은 남고 가불 합계와 신청 가능액에 반영됩니다.`
        : `${target}\n이 신청 내역을 삭제할까요? 삭제하면 목록에서 사라집니다.`);
}
