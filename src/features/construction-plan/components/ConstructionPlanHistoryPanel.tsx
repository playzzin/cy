import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  FileCheck2,
  FilePlus2,
  GitBranch,
  History,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type {
  ConstructionPlanLineage,
  ConstructionPlanRevisionType,
  ConstructionPlanSummary,
  ConstructionPlanWorkflowEvent,
  ConstructionPlanWorkflowEventType,
} from '../types';
import {
  getConstructionPlanLineage,
  listConstructionPlanWorkflowEvents,
} from '../services/constructionPlanWorkflowApi';
import { getConstructionPlanStatusLabel } from './ConstructionPlanStatusBadge';

type ConstructionPlanHistoryPanelProps = {
  planId: string;
  onNavigatePlan?: (planId: string) => void;
};

const EVENT_META: Record<ConstructionPlanWorkflowEventType, { label: string; Icon: typeof History }> = {
  draft_created: { label: '초안 생성', Icon: FilePlus2 },
  revision_created: { label: '개정본 생성', Icon: GitBranch },
  plan_cloned: { label: '계획서 복제', Icon: Copy },
  template_binding_migrated: { label: '게시 템플릿 해시 바인딩', Icon: ShieldCheck },
  submit_review: { label: '검토 요청', Icon: Send },
  request_changes: { label: '수정 요청', Icon: AlertCircle },
  complete_review: { label: '검토 완료', Icon: CheckCircle2 },
  approve: { label: '최종 승인', Icon: ShieldCheck },
  issue: { label: '현장사용 발행', Icon: FileCheck2 },
  supersede: { label: '이전 Rev. 대체', Icon: GitBranch },
  archive: { label: '문서 보관', Icon: Archive },
  void: { label: '문서 폐기', Icon: AlertCircle },
  request_unlock: { label: '편집 잠금 해제 요청', Icon: Send },
  force_unlock: { label: '편집 잠금 강제 해제', Icon: ShieldCheck },
  expire_unlock: { label: '만료 편집 잠금 정리', Icon: Clock3 },
  withdraw_review: { label: '검토 요청 회수', Icon: ChevronLeft },
  pdf_download_intent: { label: '발행 PDF 다운로드 승인', Icon: FileCheck2 },
  pdf_download_complete: { label: '발행 PDF 다운로드 완료', Icon: CheckCircle2 },
};

export const CONSTRUCTION_PLAN_REVISION_TYPE_LABELS: Record<ConstructionPlanRevisionType, string> = {
  design_change: '설계 변경',
  site_condition: '현장 조건 변경',
  method_change: '시공 방법 변경',
  schedule_change: '공정 변경',
  safety_improvement: '안전 개선',
  other: '기타',
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const revisionLabel = (revision: number): string => `REV.${String(revision).padStart(2, '0')}`;
const shortHash = (value?: string): string | undefined => value ? `${value.slice(0, 12)}…${value.slice(-6)}` : undefined;

const eventHash = (event: ConstructionPlanWorkflowEvent): string | undefined => {
  const metadata = event.metadata ?? {};
  const value = ['approvedSnapshotHash', 'snapshotHash', 'sha256', 'contentHash']
    .map((key) => metadata[key])
    .find((candidate): candidate is string => typeof candidate === 'string' && candidate.length >= 12);
  return shortHash(value);
};

function LineagePlanButton({
  plan,
  active,
  onNavigatePlan,
}: {
  plan: ConstructionPlanSummary;
  active: boolean;
  onNavigatePlan?: (planId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`cp-history-revision${active ? ' is-current' : ''}`}
      aria-current={active ? 'page' : undefined}
      disabled={active || !onNavigatePlan}
      onClick={() => onNavigatePlan?.(plan.id)}
    >
      <span><strong>{revisionLabel(plan.revision)}</strong><em>{getConstructionPlanStatusLabel(plan.status)}</em></span>
      <small>{plan.revisionType ? CONSTRUCTION_PLAN_REVISION_TYPE_LABELS[plan.revisionType] : plan.revision === 0 ? '최초 작성' : '개정'}</small>
      <time dateTime={plan.updatedAt}>{formatDateTime(plan.updatedAt)}</time>
    </button>
  );
}

export function ConstructionPlanHistoryPanel({ planId, onNavigatePlan }: ConstructionPlanHistoryPanelProps) {
  const [events, setEvents] = useState<ConstructionPlanWorkflowEvent[]>([]);
  const [lineage, setLineage] = useState<ConstructionPlanLineage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextEvents, nextLineage] = await Promise.all([
        listConstructionPlanWorkflowEvents(planId),
        getConstructionPlanLineage(planId),
      ]);
      setEvents(nextEvents);
      setLineage(nextLineage);
    } catch (loadError) {
      console.error('[ConstructionPlanHistoryPanel] Failed to load history', loadError);
      setError('개정 계보와 감사이력을 불러오지 못했습니다. 권한과 네트워크 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { void load(); }, [load]);

  const sortedEvents = useMemo(
    () => [...events].sort((left, right) => Date.parse(right.at) - Date.parse(left.at)),
    [events],
  );

  if (loading) {
    return <section className="cp-history-panel cp-history-panel--loading" aria-busy="true" aria-label="문서 이력 불러오는 중"><div className="cp-panel-heading"><div><span className="cp-eyebrow">History</span><h3>문서 이력</h3></div><History size={18} /></div>{Array.from({ length: 4 }, (_, index) => <span className="cp-history-skeleton" key={index} />)}</section>;
  }

  if (error || !lineage) {
    return <section className="cp-history-panel cp-history-panel--error"><div className="cp-panel-heading"><div><span className="cp-eyebrow">History</span><h3>문서 이력</h3></div><AlertCircle size={18} /></div><div className="cp-history-error" role="alert"><AlertCircle size={22} /><strong>이력을 표시할 수 없습니다</strong><p>{error || '문서 계보 응답이 없습니다.'}</p><button type="button" className="cp-button cp-button--secondary cp-button--small" onClick={() => void load()}><RefreshCw size={14} /> 다시 시도</button></div></section>;
  }

  return (
    <section className="cp-history-panel">
      <div className="cp-panel-heading">
        <div><span className="cp-eyebrow">History</span><h3>개정 · 감사이력</h3></div>
        <button type="button" className="cp-icon-button cp-icon-button--small" onClick={() => void load()} aria-label="문서 이력 새로고침"><RefreshCw size={15} /></button>
      </div>

      <div className="cp-history-lineage-nav" aria-label="직전 및 다음 개정본">
        <button type="button" disabled={!lineage.previous || !onNavigatePlan} onClick={() => lineage.previous && onNavigatePlan?.(lineage.previous.id)}><ChevronLeft size={15} /><span><small>직전 Rev.</small><strong>{lineage.previous ? revisionLabel(lineage.previous.revision) : '없음'}</strong></span></button>
        <div><small>현재 계보</small><strong>{lineage.series.documentNo}</strong><span>{lineage.plans.length}개 Rev.</span></div>
        <button type="button" disabled={!lineage.next || !onNavigatePlan} onClick={() => lineage.next && onNavigatePlan?.(lineage.next.id)}><span><small>다음 Rev.</small><strong>{lineage.next ? revisionLabel(lineage.next.revision) : '없음'}</strong></span><ChevronRight size={15} /></button>
      </div>

      <div className="cp-history-section-title"><GitBranch size={14} /><strong>개정 계보</strong><span>최신 {revisionLabel(lineage.series.latestRevisionNo)}</span></div>
      <div className="cp-history-revisions">
        {lineage.plans.map((item) => <LineagePlanButton key={item.id} plan={item} active={item.id === planId} onNavigatePlan={onNavigatePlan} />)}
      </div>

      <div className="cp-history-section-title"><Clock3 size={14} /><strong>감사 이벤트</strong><span>{sortedEvents.length}건</span></div>
      {sortedEvents.length === 0 ? (
        <div className="cp-history-empty"><History size={22} /><strong>기록된 감사 이벤트가 없습니다</strong><p>레거시 문서는 최근 저장 정보만 보존되었을 수 있습니다.</p></div>
      ) : (
        <ol className="cp-history-events">
          {sortedEvents.map((event) => {
            const meta = EVENT_META[event.type];
            const EventIcon = meta.Icon;
            const hash = eventHash(event);
            return <li key={event.id}>
              <span className={`cp-history-event__icon is-${event.type}`}><EventIcon size={14} /></span>
              <div className="cp-history-event__content">
                <div><strong>{meta.label}</strong>{event.revisionNo !== undefined && <em>{revisionLabel(event.revisionNo)}</em>}</div>
                <p>{event.actorName || event.actorId}<time dateTime={event.at}>{formatDateTime(event.at)}</time></p>
                {(event.fromStatus || event.toStatus) && <span className="cp-history-event__status">{event.fromStatus ? getConstructionPlanStatusLabel(event.fromStatus) : '시작'}<ChevronRight size={11} />{event.toStatus ? getConstructionPlanStatusLabel(event.toStatus) : '완료'}</span>}
                {event.revisionType && <span className="cp-history-event__detail"><b>변경유형</b>{CONSTRUCTION_PLAN_REVISION_TYPE_LABELS[event.revisionType]}</span>}
                {event.reason && <span className="cp-history-event__reason">“{event.reason}”</span>}
                {(event.sourcePlanId || event.targetPlanId) && <div className="cp-history-event__links">
                  {event.sourcePlanId && <button type="button" onClick={() => onNavigatePlan?.(event.sourcePlanId!)} disabled={!onNavigatePlan}>기준 문서 열기</button>}
                  {event.targetPlanId && <button type="button" onClick={() => onNavigatePlan?.(event.targetPlanId!)} disabled={!onNavigatePlan}>생성 문서 열기</button>}
                </div>}
                {hash && <code title="감사 hash">HASH {hash}</code>}
              </div>
            </li>;
          })}
        </ol>
      )}
    </section>
  );
}

export default ConstructionPlanHistoryPanel;
