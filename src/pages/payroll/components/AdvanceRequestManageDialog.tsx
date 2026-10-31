import React, { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { AdvanceRequest, AdvanceRequestStatus } from '../../../services/advanceRequestService';
import { ADVANCE_REQUEST_CATEGORY_LABELS, getAdvanceRequestCategory } from '../../../types/advanceRequestCategory';
import AdvanceRequestActions, { confirmAdvanceRequestAction, type AdvanceRequestAction } from './AdvanceRequestActions';
import '../../../components/common/ResponsiveDetailDialog.css';

const labels: Record<AdvanceRequestStatus, string> = { requested: '신청 대기', approved: '승인', paid: '지급 완료', rejected: '반려', cancelled: '취소' };

export default function AdvanceRequestManageDialog({ requests, context, onAction, onClose }: {
    requests: AdvanceRequest[];
    context: string;
    onAction: (request: AdvanceRequest, action: AdvanceRequestAction) => Promise<void>;
    onClose: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const pending = useRef(false);
    const returnFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const close = () => { if (!pending.current) onClose(); };
    const act = async (request: AdvanceRequest, action: AdvanceRequestAction) => {
        if (pending.current || !confirmAdvanceRequestAction(request, action)) return;
        pending.current = true; setSaving(true); setError(''); setMessage('');
        try {
            await onAction(request, action);
            setMessage(action === 'cancel' ? '신청을 취소했습니다.' : '신청 내역을 삭제했습니다.');
        } catch {
            setError('처리하지 못했습니다. 신청 상태와 권한이 변경되었을 수 있습니다. 닫고 새로고침한 뒤 다시 시도해 주세요.');
        } finally { pending.current = false; setSaving(false); }
    };
    return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
        <Dialog.Portal>
            <Dialog.Overlay className="cy-detail-dialog__overlay" />
            <Dialog.Content className="cy-detail-dialog" onCloseAutoFocus={event => {
                event.preventDefault();
                if (returnFocus.current?.isConnected) returnFocus.current.focus();
            }}>
                <header className="cy-detail-dialog__header">
                    <div><Dialog.Title>가불 신청 관리</Dialog.Title><Dialog.Description>{context}</Dialog.Description></div>
                    <button type="button" className="cy-detail-dialog__close" aria-label="신청 관리 닫기" disabled={saving} onClick={close}>×</button>
                </header>
                <div className="cy-detail-dialog__body space-y-3" aria-busy={saving}>
                    <p className="text-sm text-slate-600">대기 중인 신청은 취소할 수 있고, 취소·반려된 내역은 삭제할 수 있습니다. 승인·지급된 건은 처리 내역을 유지합니다.</p>
                    {message && <p role="status" className="text-sm font-bold text-blue-700">{message}</p>}
                    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
                    {!requests.length && <p className="py-6 text-center text-sm text-slate-500">조회 조건에 맞는 신청 내역이 없습니다.</p>}
                    {requests.map(request => <article key={request.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><strong>{request.workerName} · {request.requestedAmount.toLocaleString('ko-KR')}원</strong>
                                <p className="mt-1 text-xs text-slate-500">{request.teamName} · {request.yearMonth} · {ADVANCE_REQUEST_CATEGORY_LABELS[getAdvanceRequestCategory(request)]}</p></div>
                            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold">{labels[request.status]}</span>
                        </div>
                        {request.memo && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{request.memo}</p>}
                        <div className="mt-2 flex justify-end"><AdvanceRequestActions request={request} canManage disabled={saving} onAction={(row, action) => void act(row, action)} /></div>
                    </article>)}
                </div>
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
