import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, Search, UserPlus, Users, X } from 'lucide-react';
import type { OrganizationRoleAssignment, OrganizationSnapshot, SafeWorkerDto } from '../types';

type ConstructionPlanOrganizationEditorProps = {
    value: OrganizationSnapshot;
    candidates: SafeWorkerDto[];
    disabled?: boolean;
    onChange: (value: OrganizationSnapshot) => void;
};

const workerDetail = (worker?: SafeWorkerDto): string => {
    if (!worker) return '';
    return [worker.position || worker.role, worker.teamName].filter(Boolean).join(' · ') || '소속 정보 없음';
};

const workerSearchText = (worker: SafeWorkerDto): string =>
    [worker.name, worker.position, worker.role, worker.teamName].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');

const isExplicitlyCrossSite = (worker: SafeWorkerDto | undefined, sourceSiteId: string | undefined): boolean =>
    Boolean(worker?.siteId && sourceSiteId && worker.siteId !== sourceSiteId);

export function ConstructionPlanOrganizationEditor({
    value,
    candidates,
    disabled = false,
    onChange,
}: ConstructionPlanOrganizationEditorProps) {
    const [query, setQuery] = useState('');
    const activeCandidates = useMemo(
        () => candidates.filter((worker) => worker.status === 'active'),
        [candidates],
    );
    const filteredCandidates = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase('ko-KR');
        if (!normalized) return activeCandidates;
        return activeCandidates.filter((worker) => workerSearchText(worker).includes(normalized));
    }, [activeCandidates, query]);

    const duplicateWorkerIds = useMemo(() => {
        const counts = new Map<string, number>();
        value.assignments.forEach((assignment) => {
            if (assignment.worker?.id) counts.set(assignment.worker.id, (counts.get(assignment.worker.id) ?? 0) + 1);
        });
        return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([id]) => id));
    }, [value.assignments]);

    const updateAssignment = (
        assignmentId: string,
        update: Partial<Pick<OrganizationRoleAssignment, 'worker' | 'externalAssignment' | 'exceptionReason'>>,
    ) => {
        const assignments = value.assignments.map((assignment) =>
            assignment.id === assignmentId ? { ...assignment, ...update } : assignment,
        );
        onChange({ ...value, assignments });
    };

    const updateAssignmentWorker = (assignmentId: string, workerId: string) => {
        const worker = activeCandidates.find((candidate) => candidate.id === workerId);
        const current = value.assignments.find((assignment) => assignment.id === assignmentId);
        const sameWorker = Boolean(worker && current?.worker?.id === worker.id);
        updateAssignment(assignmentId, {
            worker,
            externalAssignment: sameWorker
                ? Boolean(current?.externalAssignment || isExplicitlyCrossSite(worker, value.sourceSiteId))
                : isExplicitlyCrossSite(worker, value.sourceSiteId),
            exceptionReason: sameWorker ? current?.exceptionReason : undefined,
        });
    };

    const addAdditionalWorker = (worker: SafeWorkerDto) => {
        if (value.additionalWorkers.some((item) => item.id === worker.id)) return;
        onChange({ ...value, additionalWorkers: [...value.additionalWorkers, worker] });
    };

    const removeAdditionalWorker = (workerId: string) => {
        onChange({ ...value, additionalWorkers: value.additionalWorkers.filter((worker) => worker.id !== workerId) });
    };

    return (
        <section className="cp-org-editor">
            <div className="cp-panel-heading cp-panel-heading--bordered">
                <div>
                    <span className="cp-eyebrow">Organization</span>
                    <h3>현장 조직 역할</h3>
                </div>
                <span className="cp-source-chip"><Users size={13} /> 작업자 DB 연동</span>
            </div>

            <div className="cp-org-editor__roles">
                {value.assignments.map((assignment: OrganizationRoleAssignment) => {
                    const hasDuplicate = Boolean(assignment.worker?.id && duplicateWorkerIds.has(assignment.worker.id));
                    const crossSite = isExplicitlyCrossSite(assignment.worker, value.sourceSiteId);
                    const needsReason = Boolean(assignment.worker && (hasDuplicate || assignment.externalAssignment || crossSite));
                    const reasonValid = (assignment.exceptionReason?.trim().length ?? 0) >= 5;
                    return (
                        <div className={`cp-role-field${needsReason && !reasonValid ? ' has-exception-error' : ''}`} key={assignment.id} data-validation-record-id={assignment.id}>
                            <label className="cp-role-field__label" htmlFor={`cp-role-worker-${assignment.id}`}>
                                {assignment.label}
                                {assignment.required && <em>필수</em>}
                                {hasDuplicate && <em className="is-warning">겸임</em>}
                                {(assignment.externalAssignment || crossSite) && <em className="is-external">현장 외</em>}
                            </label>
                            <span className="cp-role-field__select-wrap">
                                <select
                                    data-validation-field="worker"
                                    id={`cp-role-worker-${assignment.id}`}
                                    value={assignment.worker?.id ?? ''}
                                    disabled={disabled}
                                    onChange={(event) => updateAssignmentWorker(assignment.id, event.target.value)}
                                    className={!assignment.worker && assignment.required ? 'is-missing' : ''}
                                >
                                    <option value="">담당자를 선택하세요</option>
                                    {activeCandidates.map((worker) => (
                                        <option key={worker.id} value={worker.id}>
                                            {worker.name} · {workerDetail(worker)}
                                            {isExplicitlyCrossSite(worker, value.sourceSiteId) ? ' · 타 현장' : ''}
                                        </option>
                                    ))}
                                </select>
                                {assignment.worker && <Check size={15} className="cp-role-field__check" />}
                            </span>
                            {assignment.worker ? (
                                <small className={hasDuplicate ? 'is-warning' : ''}>
                                    {hasDuplicate
                                        ? '동일인이 다른 역할을 겸임하고 있습니다. 각 역할별 겸임 사유가 필요합니다.'
                                        : crossSite
                                            ? `${workerDetail(assignment.worker)} · ${assignment.worker.siteId} 소속`
                                            : workerDetail(assignment.worker)}
                                </small>
                            ) : assignment.required ? (
                                <small className="is-error"><AlertCircle size={12} /> 필수 역할이 비어 있습니다.</small>
                            ) : null}
                            {assignment.worker && (
                                <label className="cp-role-field__external-toggle">
                                    <input
                                        data-validation-field="externalAssignment"
                                        type="checkbox"
                                        checked={assignment.externalAssignment || crossSite}
                                        disabled={disabled || crossSite}
                                        onChange={(event) => updateAssignment(assignment.id, {
                                            externalAssignment: event.target.checked,
                                            exceptionReason: event.target.checked ? assignment.exceptionReason : undefined,
                                        })}
                                    />
                                    현장 외 인원 배정
                                    {crossSite && <span>소속 현장 기준 자동 표시</span>}
                                </label>
                            )}
                            {needsReason && (
                                <label className="cp-role-field__reason">
                                    <span>{hasDuplicate ? '겸임' : '현장 외 배정'} 사유 <em>필수</em></span>
                                    <textarea
                                        data-validation-field="exceptionReason"
                                        value={assignment.exceptionReason ?? ''}
                                        disabled={disabled}
                                        maxLength={500}
                                        rows={2}
                                        aria-invalid={!reasonValid}
                                        placeholder="승인 가능한 구체적인 배정 사유를 5자 이상 입력하세요."
                                        onChange={(event) => updateAssignment(assignment.id, {
                                            exceptionReason: event.target.value || undefined,
                                        })}
                                    />
                                    <small className={reasonValid ? '' : 'is-error'}>
                                        {assignment.exceptionReason?.length ?? 0}/500자 · 5자 이상 입력
                                    </small>
                                </label>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="cp-org-editor__crew">
                <div className="cp-org-editor__crew-heading">
                    <div>
                        <strong>추가 작업반 인원</strong>
                        <small>{value.additionalWorkers.length}명 배정 · 연락처는 출력하지 않음</small>
                    </div>
                    {value.additionalWorkers.length > 12 && <span className="cp-warning-chip">별도 인원표로 출력</span>}
                </div>
                <div className="cp-worker-search">
                    <Search size={15} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="이름, 직책, 팀으로 작업자 검색"
                        disabled={disabled}
                    />
                </div>
                {query.trim() && (
                    <div className="cp-worker-results">
                        {filteredCandidates.slice(0, 6).map((worker) => {
                            const alreadyAdded = value.additionalWorkers.some((item) => item.id === worker.id);
                            return (
                                <button
                                    type="button"
                                    key={worker.id}
                                    disabled={disabled || alreadyAdded}
                                    onClick={() => addAdditionalWorker(worker)}
                                >
                                    <span className="cp-worker-avatar">{worker.name.slice(0, 1)}</span>
                                    <span><strong>{worker.name}</strong><small>{workerDetail(worker)}</small></span>
                                    {alreadyAdded ? <Check size={15} /> : <UserPlus size={15} />}
                                </button>
                            );
                        })}
                        {filteredCandidates.length === 0 && <p>검색 결과가 없습니다.</p>}
                    </div>
                )}
                <div className="cp-worker-chips">
                    {value.additionalWorkers.map((worker) => (
                        <span key={worker.id}>
                            <span className="cp-worker-avatar">{worker.name.slice(0, 1)}</span>
                            <span><strong>{worker.name}</strong><small>{worker.teamName || worker.position || worker.role || '소속 미등록'}</small></span>
                            <button type="button" disabled={disabled} onClick={() => removeAdditionalWorker(worker.id)} aria-label={`${worker.name} 제외`}>
                                <X size={13} />
                            </button>
                        </span>
                    ))}
                    {value.additionalWorkers.length === 0 && <p className="cp-inline-empty">추가 작업자가 아직 배정되지 않았습니다.</p>}
                </div>
            </div>
        </section>
    );
}

export default ConstructionPlanOrganizationEditor;
