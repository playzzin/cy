import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    Archive,
    ArrowRight,
    Building2,
    CalendarDays,
    FileCheck2,
    FileClock,
    FilePlus2,
    FileText,
    Filter,
    History,
    Loader2,
    RefreshCw,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import type { ConstructionPlan, ConstructionPlanTradeType, PlanStatus } from '../types';
import {
    constructionPlanListAssignee,
    filterConstructionPlanList,
    type ConstructionPlanListView,
} from '../domain/constructionPlanListFilters';
import { listConstructionPlans } from '../services/constructionPlanService';
import {
    cloneConstructionPlanServer,
    createConstructionPlanRevisionServer,
    getConstructionPlanWorkflowErrorMessage,
} from '../services/constructionPlanWorkflowApi';
import { fetchAuditedIssuedConstructionPlanPdfForPlan } from '../services/constructionPlanIssuedDownloadService';
import {
    createConstructionPlanControlIdempotencyKey,
    getConstructionPlanControlCapabilities,
    transitionConstructionPlanLifecycle,
    type ConstructionPlanLifecycleAction,
} from '../services/constructionPlanLifecycleControlApi';
import { downloadConstructionPlanPdf } from '../services/constructionPlanPdfService';
import ConstructionPlanStatusBadge from '../components/ConstructionPlanStatusBadge';
import ConstructionPlanDeriveDialog, {
    type ConstructionPlanDeriveMode,
    type ConstructionPlanDeriveSubmission,
} from '../components/ConstructionPlanDeriveDialog';
import {
    ConstructionPlanEmptyState,
    ConstructionPlanErrorState,
    ConstructionPlanSkeleton,
} from '../components/ConstructionPlanFeedback';
import ConstructionPlanRowActions, {
    findActiveRevisionSuccessor,
} from '../components/ConstructionPlanRowActions';
import { getConstructionPlanDerivationDrawingReuseStatus } from '../services/constructionPlanDrawingLibraryService';
import '../components/ConstructionPlanUI.css';

type PlanListView = ConstructionPlanListView;

const STATUS_FILTERS: Array<{ value: PlanStatus | 'all'; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'draft', label: '작성 중' },
    { value: 'in_review', label: '검토 중' },
    { value: 'changes_requested', label: '수정 요청' },
    { value: 'review_completed', label: '검토 완료' },
    { value: 'approved_pending_issue', label: '발행 대기' },
    { value: 'issued', label: '현장사용 발행' },
    { value: 'superseded', label: '대체됨' },
    { value: 'archived', label: '보관' },
    { value: 'void', label: '폐기' },
];

const formatDateTime = (value?: string): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
};

const getReviewProgress = (plan: PlanListView): number => {
    const relevant = plan.sections.filter((section) => section.required);
    if (!relevant.length) return 0;
    const done = relevant.filter((section) => section.status === 'complete' || section.status === 'not_applicable').length;
    return Math.round((done / relevant.length) * 100);
};

const issuedPdfFileName = (plan: ConstructionPlan): string => plan.issuedExportFileName
    || `${plan.projectSnapshot.siteName}_${plan.title}_REV-${String(plan.revision).padStart(2, '0')}_ISSUED.pdf`;

export function ConstructionPlanListPage() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<PlanListView[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<PlanStatus | 'all'>('all');
    const [site, setSite] = useState('all');
    const [tradeType, setTradeType] = useState<ConstructionPlanTradeType | 'all'>('all');
    const [assignee, setAssignee] = useState('all');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [deriveDialog, setDeriveDialog] = useState<{ plan: PlanListView; mode: ConstructionPlanDeriveMode }>();
    const [busyRow, setBusyRow] = useState<{ planId: string; action: 'revision' | 'clone' | 'download' | 'void' | 'archive' }>();
    const [actionError, setActionError] = useState('');
    const [lifecycleDialog, setLifecycleDialog] = useState<{
        plan: PlanListView;
        action: Extract<ConstructionPlanLifecycleAction, 'void' | 'archive'>;
        reason: string;
        idempotencyKey: string;
        expectedLockVersion: number;
    }>();

    const loadPlans = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await listConstructionPlans();
            setPlans(data as PlanListView[]);
        } catch (loadError) {
            console.error('[ConstructionPlanListPage] Failed to load plans', loadError);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPlans();
    }, [loadPlans]);

    const sites = useMemo(
        () => Array.from(new Set(plans.map((plan) => plan.projectSnapshot.siteName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko-KR')),
        [plans],
    );
    const assignees = useMemo(
        () => Array.from(new Set(plans.map(constructionPlanListAssignee).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko-KR')),
        [plans],
    );

    const filteredPlans = useMemo(() => filterConstructionPlanList(plans, {
        query, status, site, tradeType, assignee, periodStart, periodEnd,
    }), [assignee, periodEnd, periodStart, plans, query, site, status, tradeType]);

    const counts = useMemo(() => ({
        total: plans.length,
        writing: plans.filter((plan) => ['draft', 'changes_requested'].includes(plan.status)).length,
        review: plans.filter((plan) => ['in_review', 'review_completed', 'approved_pending_issue'].includes(plan.status)).length,
        issued: plans.filter((plan) => plan.status === 'issued').length,
    }), [plans]);

    const hasFilters = Boolean(query.trim() || status !== 'all' || site !== 'all'
        || tradeType !== 'all' || assignee !== 'all' || periodStart || periodEnd);
    const resetFilters = () => {
        setQuery(''); setStatus('all'); setSite('all'); setTradeType('all'); setAssignee('all');
        setPeriodStart(''); setPeriodEnd('');
    };

    const derivePlan = async (submission: ConstructionPlanDeriveSubmission) => {
        const sourcePlanId = submission.sourcePlanId;
        const action = submission.mode;
        setBusyRow({ planId: sourcePlanId, action });
        setActionError('');
        try {
            let result;
            try {
                result = submission.mode === 'revision'
                    ? await createConstructionPlanRevisionServer({
                        sourcePlanId,
                        revisionReason: submission.revisionReason,
                        revisionType: submission.revisionType,
                        copyDrawings: submission.copyDrawings,
                        idempotencyKey: submission.idempotencyKey,
                        ...(submission.targetTemplate ? { targetTemplate: submission.targetTemplate } : {}),
                    })
                    : await cloneConstructionPlanServer({
                        sourcePlanId,
                        title: submission.title,
                        documentNo: submission.documentNo,
                        copyDrawings: submission.copyDrawings,
                        idempotencyKey: submission.idempotencyKey,
                    });
            } catch (deriveError) {
                const code = typeof deriveError === 'object' && deriveError !== null && 'code' in deriveError
                    ? String((deriveError as { code?: unknown }).code ?? '')
                    : '';
                const ambiguous = submission.copyDrawings && (
                    code.includes('unavailable')
                    || code.includes('deadline-exceeded')
                    || code.includes('internal')
                    || code.includes('unknown')
                    || deriveError instanceof TypeError
                );
                if (!ambiguous) throw deriveError;

                for (let attempt = 0; attempt < 24 && !result; attempt += 1) {
                    if (attempt > 0) {
                        await new Promise<void>((resolve) => window.setTimeout(
                            resolve,
                            Math.min(1_500, 500 + attempt * 100),
                        ));
                    }
                    try {
                        const reuseStatus = await getConstructionPlanDerivationDrawingReuseStatus({
                            operation: submission.mode,
                            idempotencyKey: submission.idempotencyKey,
                        });
                        if (reuseStatus.status === 'completed') {
                            result = reuseStatus.result;
                            break;
                        }
                        if (reuseStatus.status === 'failed') {
                            throw new Error(`서버 도면 복사 작업이 실패했습니다${reuseStatus.errorCode ? ` (${reuseStatus.errorCode})` : ''}. 같은 요청으로 다시 시도해주세요.`);
                        }
                        if (reuseStatus.status === 'not_started' && attempt >= 2) throw deriveError;
                    } catch (statusError) {
                        const statusCode = typeof statusError === 'object' && statusError !== null && 'code' in statusError
                            ? String((statusError as { code?: unknown }).code ?? '')
                            : '';
                        const statusUnavailable = statusCode.includes('unavailable')
                            || statusCode.includes('deadline-exceeded')
                            || statusCode.includes('internal')
                            || statusCode.includes('unknown')
                            || statusError instanceof TypeError;
                        if (!statusUnavailable) throw statusError;
                    }
                }
                if (!result) throw deriveError;
            }
            setDeriveDialog(undefined);
            navigate(`/construction-plans/${result.planId}`);
        } finally {
            setBusyRow(undefined);
        }
    };

    const downloadIssuedPdf = async (plan: PlanListView) => {
        if (!plan.issuedExportStoragePath || !plan.issuedExportSha256) {
            setActionError('이 Rev.의 발행 PDF 저장 경로 또는 무결성 SHA-256을 확인할 수 없습니다.');
            return;
        }
        setBusyRow({ planId: plan.id, action: 'download' });
        setActionError('');
        try {
            const downloaded = await fetchAuditedIssuedConstructionPlanPdfForPlan(plan);
            downloadConstructionPlanPdf(downloaded.blob, downloaded.fileName || issuedPdfFileName(plan));
        } catch (error) {
            console.error('[ConstructionPlanListPage] Issued PDF download failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setBusyRow(undefined);
        }
    };

    const openLifecycleDialog = async (
        plan: PlanListView,
        action: Extract<ConstructionPlanLifecycleAction, 'void' | 'archive'>,
    ) => {
        if (busyRow) return;
        setBusyRow({ planId: plan.id, action });
        setActionError('');
        try {
            const capabilities = await getConstructionPlanControlCapabilities(plan.id);
            const allowed = action === 'void' ? capabilities.canVoid : capabilities.canArchive;
            if (!allowed) {
                setActionError('현재 계정 권한이나 최신 문서 상태에서는 이 작업을 수행할 수 없습니다.');
                return;
            }
            setLifecycleDialog({
                plan,
                action,
                reason: '',
                idempotencyKey: createConstructionPlanControlIdempotencyKey(),
                expectedLockVersion: capabilities.lockVersion,
            });
        } catch (lifecycleError) {
            console.error('[ConstructionPlanListPage] Lifecycle capability check failed', lifecycleError);
            setActionError(getConstructionPlanWorkflowErrorMessage(lifecycleError));
        } finally {
            setBusyRow(undefined);
        }
    };

    const applyLifecycle = async () => {
        const dialog = lifecycleDialog;
        if (!dialog || dialog.reason.trim().length < 5 || busyRow) return;
        setBusyRow({ planId: dialog.plan.id, action: dialog.action });
        setActionError('');
        try {
            await transitionConstructionPlanLifecycle({
                planId: dialog.plan.id,
                action: dialog.action,
                expectedLockVersion: dialog.expectedLockVersion,
                reason: dialog.reason.trim(),
                idempotencyKey: dialog.idempotencyKey,
            });
            setLifecycleDialog(undefined);
            await loadPlans();
        } catch (lifecycleError) {
            console.error('[ConstructionPlanListPage] Lifecycle transition failed', lifecycleError);
            setActionError(getConstructionPlanWorkflowErrorMessage(lifecycleError));
        } finally {
            setBusyRow(undefined);
        }
    };

    return (
        <main className="cp-page cp-list-page">
            <header className="cp-page-header">
                <div className="cp-page-header__copy">
                    <div className="cp-page-header__icon"><FileCheck2 size={22} /></div>
                    <div>
                        <span className="cp-eyebrow">Construction documents</span>
                        <h1>시공계획서</h1>
                        <p>현장 데이터부터 승인도면, 검토 및 PDF 발행 이력을 한곳에서 관리합니다.</p>
                    </div>
                </div>
                <div className="cp-page-header__actions">
                    <button type="button" className="cp-icon-button" onClick={() => void loadPlans()} aria-label="새로고침"><RefreshCw size={17} /></button>
                    <button type="button" className="cp-button cp-button--primary" onClick={() => navigate('/construction-plans/create')}>
                        <FilePlus2 size={17} /> 새 계획서
                    </button>
                </div>
            </header>

            <div className="cp-page-body">
                <section className="cp-summary-grid" aria-label="계획서 현황">
                    <div className="cp-summary-card cp-summary-card--total"><span><FileText size={18} /></span><div><small>전체 계획서</small><strong>{counts.total}</strong></div></div>
                    <div className="cp-summary-card cp-summary-card--writing"><span><FileClock size={18} /></span><div><small>작성 · 수정</small><strong>{counts.writing}</strong></div></div>
                    <div className="cp-summary-card cp-summary-card--review"><span><History size={18} /></span><div><small>검토 · 발행대기</small><strong>{counts.review}</strong></div></div>
                    <div className="cp-summary-card cp-summary-card--issued"><span><FileCheck2 size={18} /></span><div><small>현장사용 발행</small><strong>{counts.issued}</strong></div></div>
                </section>

                <section className="cp-card cp-list-card">
                    <div className="cp-toolbar">
                        <div className="cp-search-field">
                            <Search size={17} />
                            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="현장명, 문서번호, 계획서명 검색" aria-label="계획서 검색" />
                            {query && <button type="button" onClick={() => setQuery('')}>지우기</button>}
                        </div>
                        <div className="cp-toolbar__filters">
                            <Filter size={15} />
                            <select value={site} onChange={(event) => setSite(event.target.value)} aria-label="현장 필터">
                                <option value="all">전체 현장</option>
                                {sites.map((siteName) => <option value={siteName} key={siteName}>{siteName}</option>)}
                            </select>
                            <select value={status} onChange={(event) => setStatus(event.target.value as PlanStatus | 'all')} aria-label="상태 필터">
                                {STATUS_FILTERS.map((filter) => <option value={filter.value} key={filter.value}>{filter.label}</option>)}
                            </select>
                            <select value={tradeType} onChange={(event) => setTradeType(event.target.value as ConstructionPlanTradeType | 'all')} aria-label="공법 필터">
                                <option value="all">전체 공법</option>
                                <option value="system-shoring">시스템동바리</option>
                                <option value="system-scaffold">시스템비계</option>
                            </select>
                            <select value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-label="담당자 필터">
                                <option value="all">전체 담당자</option>
                                {assignees.map((name) => <option value={name} key={name}>{name}</option>)}
                            </select>
                            <label><span className="sr-only">기간 시작</span><input type="date" value={periodStart} max={periodEnd || undefined} onChange={(event) => setPeriodStart(event.target.value)} aria-label="기간 시작" /></label>
                            <label><span className="sr-only">기간 종료</span><input type="date" value={periodEnd} min={periodStart || undefined} onChange={(event) => setPeriodEnd(event.target.value)} aria-label="기간 종료" /></label>
                        </div>
                    </div>

                    <div className="cp-filter-tabs" role="tablist" aria-label="상태 빠른 필터">
                        {STATUS_FILTERS.map((filter) => (
                            <button type="button" role="tab" aria-selected={status === filter.value} className={status === filter.value ? 'is-active' : ''} key={filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>
                        ))}
                    </div>

                    {actionError && <div className="cp-list-action-error" role="alert"><AlertCircle size={15} /><span>{actionError}</span><button type="button" onClick={() => setActionError('')} aria-label="오류 닫기"><X size={14} /></button></div>}

                    {loading ? <ConstructionPlanSkeleton /> : error ? <ConstructionPlanErrorState onRetry={() => void loadPlans()} /> : filteredPlans.length === 0 ? (
                        <ConstructionPlanEmptyState filtered={hasFilters || plans.length > 0} onAction={hasFilters || plans.length > 0 ? resetFilters : () => navigate('/construction-plans/create')} />
                    ) : (
                        <div className="cp-plan-table-wrap">
                            <table className="cp-plan-table">
                                <thead><tr><th>현장 · 계획서</th><th>문서정보</th><th>상태</th><th>완성도</th><th>최근 수정</th><th>최신 PDF</th><th aria-label="작업" /></tr></thead>
                                <tbody>
                                    {filteredPlans.map((plan) => {
                                        const progress = getReviewProgress(plan);
                                        const activeRevision = findActiveRevisionSuccessor(plans, plan);
                                        return (
                                            <tr key={plan.id} onClick={() => navigate(`/construction-plans/${plan.id}`)}>
                                                <td>
                                                    <div className="cp-plan-title-cell"><span className="cp-plan-title-cell__icon"><Building2 size={18} /></span><div><strong>{plan.projectSnapshot.siteName || '현장명 미등록'}</strong><span>{plan.title}</span></div></div>
                                                </td>
                                                <td><strong className="cp-document-no">{plan.documentNo || '문서번호 미등록'}</strong><span className="cp-table-sub">{plan.tradeType === 'system-scaffold' ? '시스템비계' : '시스템동바리'} · REV.{String(plan.revision).padStart(2, '0')}</span></td>
                                                <td><ConstructionPlanStatusBadge status={plan.status} compact /></td>
                                                <td><div className="cp-table-progress"><div><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div></td>
                                                <td><span className="cp-table-date"><CalendarDays size={13} />{formatDateTime(plan.updatedAt)}</span><span className="cp-table-sub">{plan.lastEditorName || plan.createdByName || plan.updatedBy || '수정자 미등록'}</span></td>
                                                <td>
                                                    {plan.status === 'issued' && plan.issuedExportStoragePath ? (
                                                        <button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={(event) => { event.stopPropagation(); void downloadIssuedPdf(plan); }}>발행본 보기</button>
                                                    ) : <span className="cp-table-sub">미발행</span>}
                                                </td>
                                                <td>
                                                    <ConstructionPlanRowActions
                                                        plan={plan}
                                                        activeRevision={activeRevision}
                                                        busyAction={busyRow?.planId === plan.id ? busyRow.action : undefined}
                                                        onOpen={() => navigate(`/construction-plans/${plan.id}`)}
                                                        onOpenActiveRevision={activeRevision ? () => navigate(`/construction-plans/${activeRevision.id}`) : undefined}
                                                        onCreateRevision={() => setDeriveDialog({ plan, mode: 'revision' })}
                                                        onClone={() => setDeriveDialog({ plan, mode: 'clone' })}
                                                        onDownloadIssued={() => void downloadIssuedPdf(plan)}
                                                        onOpenHistory={() => navigate(`/construction-plans/${plan.id}?tab=history`)}
                                                        onVoid={() => void openLifecycleDialog(plan, 'void')}
                                                        onArchive={() => void openLifecycleDialog(plan, 'archive')}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
                <p className="cp-list-footer-note"><ArrowRight size={14} /> 발행본은 변경되지 않으며, 수정이 필요하면 행 작업 메뉴에서 새 개정본으로 이어집니다.</p>
            </div>
            {deriveDialog && (
                <ConstructionPlanDeriveDialog
                    open
                    mode={deriveDialog.mode}
                    sourcePlan={deriveDialog.plan}
                    onClose={() => { if (!busyRow) setDeriveDialog(undefined); }}
                    onSubmit={derivePlan}
                />
            )}
            {lifecycleDialog && (
                <div className="cp-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyRow) setLifecycleDialog(undefined); }}>
                    <div className="cp-derive-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-list-lifecycle-title">
                        <header className="cp-derive-dialog__header">
                            <span className="cp-derive-dialog__icon">{lifecycleDialog.action === 'void' ? <ShieldAlert size={21} /> : <Archive size={21} />}</span>
                            <div><span className="cp-eyebrow">Server-authoritative lifecycle</span><h2 id="cp-list-lifecycle-title">{lifecycleDialog.action === 'void' ? '계획서 폐기' : '계획서 보관'}</h2><p>문서·검토 스냅샷·발행 PDF는 삭제하지 않고 상태 전이와 사유를 감사이력에 남깁니다.</p></div>
                            <button type="button" disabled={Boolean(busyRow)} onClick={() => setLifecycleDialog(undefined)} aria-label="대화상자 닫기"><X size={18} /></button>
                        </header>
                        <div className="cp-derive-dialog__source"><div><small>대상 현장</small><strong>{lifecycleDialog.plan.projectSnapshot.siteName || '현장명 미등록'}</strong></div><div><small>대상 문서</small><strong>{lifecycleDialog.plan.documentNo} · REV.{String(lifecycleDialog.plan.revision).padStart(2, '0')}</strong></div></div>
                        <form onSubmit={(event) => { event.preventDefault(); void applyLifecycle(); }}>
                            <label className="cp-derive-field"><span>처리 사유 * <small>{lifecycleDialog.reason.trim().length}/1000</small></span><textarea autoFocus maxLength={1000} disabled={Boolean(busyRow)} value={lifecycleDialog.reason} onChange={(event) => setLifecycleDialog((current) => current ? { ...current, reason: event.target.value } : current)} placeholder="상태 전환 사유를 5자 이상 입력하세요." /></label>
                            <div className="cp-derive-dialog__safe-note"><ShieldAlert size={15} /><span><strong>삭제 없는 상태 전환</strong>서버가 권한·현재 상태·lockVersion을 transaction에서 다시 확인합니다.</span></div>
                            <div className="cp-derive-dialog__actions"><button type="button" className="cp-button cp-button--ghost" disabled={Boolean(busyRow)} onClick={() => setLifecycleDialog(undefined)}>취소</button><button type="submit" className="cp-button cp-button--primary" disabled={Boolean(busyRow) || lifecycleDialog.reason.trim().length < 5}>{busyRow ? <Loader2 size={15} className="cp-spin" /> : lifecycleDialog.action === 'void' ? <ShieldAlert size={15} /> : <Archive size={15} />}{lifecycleDialog.action === 'void' ? '폐기 확정' : '보관 확정'}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

export default ConstructionPlanListPage;
