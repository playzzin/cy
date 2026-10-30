import React, { useEffect, useRef, useState } from 'react';
import { teamResourceStatusService, TeamResourceStatus, TeamResourceStatusResult } from '../../services/teamResourceStatusService';
import { showConfirmAlert, toast } from '../../utils/swal';
import { isClosedSite, normalizeSiteStatus } from '../../utils/siteStatus';
import { getWorkerStatusGroup, getWorkerStatusLabel } from '../../utils/workerStatus';
import { employmentToday, validateEmploymentPeriod } from '../../utils/workerEmploymentPeriod';

export default function TeamResourceStatusControl({ kind, resource, onSaved }: {
    kind: 'site' | 'worker';
    resource: { id?: string; name: string; status?: string; isActive?: boolean; joinDate?: string; retirementDate?: string };
    onSaved: (result: TeamResourceStatusResult) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [joinDate, setJoinDate] = useState(resource.joinDate || '');
    const [retirementDate, setRetirementDate] = useState(resource.retirementDate || (getWorkerStatusGroup(resource) === 'retired' ? '' : employmentToday()));
    useEffect(() => {
        setJoinDate(resource.joinDate || '');
        setRetirementDate(resource.retirementDate || (getWorkerStatusGroup(resource) === 'retired' ? '' : employmentToday()));
    }, [resource.id, resource.joinDate, resource.retirementDate, resource.status, resource.isActive]);
    const pending = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const closed = kind === 'site' ? isClosedSite(resource) : getWorkerStatusGroup(resource) === 'retired';
    const statusLabel = kind === 'worker' ? getWorkerStatusLabel(resource) : closed ? '종료' : ['planned', '예정'].includes(normalizeSiteStatus(resource.status)) ? '예정' : '진행중';
    const change = async (status: TeamResourceStatus, label: string) => {
        if (pending.current || !resource.id) return;
        pending.current = true;
        setBusy(true);
        setError('');
        try {
            const dates = kind === 'worker' ? { joinDate, retirementDate: status === '퇴사' ? retirementDate : '' } : {};
            const validation = validateEmploymentPeriod(dates);
            if (validation || (kind === 'worker' && status === '퇴사' && !retirementDate)) throw new Error(validation || '퇴사일을 입력해 주세요.');
            const confirmation = await showConfirmAlert(`${label} 확인`, `${resource.name}의 상태를 변경합니다.${kind === 'worker' ? ` 입사일: ${joinDate || '미등록'}, 퇴사일: ${dates.retirementDate || '없음'}.` : ''} 기존 근무·정산 기록은 유지됩니다.`, label);
            if (!confirmation.isConfirmed || !mounted.current) return;
            const result = await teamResourceStatusService.update({
                kind, id: resource.id, status,
                expectedStatus: resource.status ?? null,
                expectedIsActive: kind === 'worker' ? resource.isActive ?? null : null,
                ...(kind === 'worker' ? { ...dates, expectedJoinDate: resource.joinDate ?? null, expectedRetirementDate: resource.retirementDate ?? null } : {}),
            });
            if (!mounted.current) return;
            onSaved(result);
            toast.success(`${resource.name}: ${label} 완료`);
        } catch (reason) {
            if (mounted.current) setError(reason instanceof Error ? reason.message : '상태를 변경하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const buttons = kind === 'site'
        ? [{ status: 'active', label: '진행중으로 변경', show: statusLabel !== '진행중' }, { status: 'completed', label: '현장 종료', show: !closed }]
        : [{ status: '재직', label: '재직중으로 변경', show: statusLabel !== '재직중' }, { status: '퇴사', label: '퇴사 처리', show: !closed }];
    if (kind === 'worker' && getWorkerStatusGroup(resource) === 'inactive') return null;
    return <section className="tw-detail-section" aria-label={kind === 'site' ? '현장 상태 설정' : '재직 상태 설정'} aria-busy={busy}>
        <h3>{kind === 'site' ? '현장 상태 설정' : '재직 상태 설정'}</h3>
        <p className="mb-3 text-sm text-slate-600">현재 상태: <strong>{statusLabel}</strong></p>
        {kind === 'worker' && <div className="mb-3 flex flex-wrap gap-2">
            <label>입사일 <input aria-label="재직 시작일" type="date" value={joinDate} disabled={busy} onChange={event => setJoinDate(event.target.value)} /></label>
            <label>퇴사일 <input aria-label="퇴사 적용일" type="date" value={retirementDate} min={joinDate || undefined} disabled={busy} onChange={event => setRetirementDate(event.target.value)} /></label>
        </div>}
        <div className="flex flex-wrap gap-2">
            {buttons.filter(button => button.show).map(button => <button key={button.status} type="button" className="tw-secondary-button"
                disabled={busy || !resource.id} onClick={() => void change(button.status as TeamResourceStatus, button.label)}>
                {busy ? '처리 중…' : button.label}
            </button>)}
            {kind === 'worker' && <button type="button" className="tw-secondary-button" disabled={busy || !resource.id}
                onClick={() => void change(closed ? '퇴사' : '재직', '재직 기간 저장')}>재직 기간 저장</button>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>;
}
