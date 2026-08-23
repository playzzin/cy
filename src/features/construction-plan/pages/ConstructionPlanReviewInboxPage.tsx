import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileClock,
  GitCompareArrows,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { ConstructionPlan } from '../types';
import { listConstructionPlans } from '../services/constructionPlanService';
import ConstructionPlanStatusBadge from '../components/ConstructionPlanStatusBadge';
import {
  ConstructionPlanErrorState,
  ConstructionPlanSkeleton,
} from '../components/ConstructionPlanFeedback';
import '../components/ConstructionPlanUI.css';

export type ConstructionPlanReviewInboxTab = 'pending' | 'changes' | 'completed';

type ReviewQueuePlan = ConstructionPlan;

const TABS: Array<{ key: ConstructionPlanReviewInboxTab; label: string; description: string }> = [
  { key: 'pending', label: '내 검토대기', description: '고정된 검토 패키지를 확인하고 의견이나 결정을 남깁니다.' },
  { key: 'changes', label: '수정요청', description: '작성자가 반영 중인 필수 의견과 처리상태를 확인합니다.' },
  { key: 'completed', label: '완료', description: '검토완료·승인·발행으로 이어진 문서를 조회합니다.' },
];

const COMPLETED_STATUSES = new Set<ConstructionPlan['status']>([
  'review_completed', 'approved_pending_issue', 'issued', 'superseded', 'archived',
]);

export const matchesConstructionPlanReviewInboxTab = (
  plan: ConstructionPlan,
  tab: ConstructionPlanReviewInboxTab,
): boolean => tab === 'pending'
  ? plan.status === 'in_review'
  : tab === 'changes'
    ? plan.status === 'changes_requested'
    : COMPLETED_STATUSES.has(plan.status);

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const shortHash = (value?: string): string => value ? `${value.slice(0, 12)}…${value.slice(-6)}` : '확인 필요';

export function ConstructionPlanReviewInboxPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ReviewQueuePlan[]>([]);
  const [tab, setTab] = useState<ConstructionPlanReviewInboxTab>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPlans(await listConstructionPlans() as ReviewQueuePlan[]);
    } catch (loadError) {
      console.error('[ConstructionPlanReviewInboxPage] Failed to load review inbox', loadError);
      setError('검토함을 불러오지 못했습니다. 권한과 네트워크 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((item) => [
    item.key,
    plans.filter((plan) => matchesConstructionPlanReviewInboxTab(plan, item.key)).length,
  ])) as Record<ConstructionPlanReviewInboxTab, number>, [plans]);

  const visiblePlans = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    return plans.filter((plan) => {
      if (!matchesConstructionPlanReviewInboxTab(plan, tab)) return false;
      if (!normalized) return true;
      return [plan.title, plan.documentNo, plan.projectSnapshot.siteName]
        .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(normalized);
    });
  }, [plans, query, tab]);

  const currentTab = TABS.find((item) => item.key === tab)!;

  return (
    <main className="cp-page cp-review-inbox-page">
      <header className="cp-page-header">
        <div className="cp-page-header__copy"><div className="cp-page-header__icon"><ClipboardCheck size={22} /></div><div><span className="cp-eyebrow">Review & approval inbox</span><h1>검토·승인함</h1><p>내가 참여한 계획서의 고정 검토 패키지, 필수 의견과 처리결정을 확인합니다.</p></div></div>
        <div className="cp-page-header__actions"><button type="button" className="cp-icon-button" onClick={() => void load()} aria-label="검토함 새로고침"><RefreshCw size={17} /></button><button type="button" className="cp-button cp-button--ghost" onClick={() => navigate('/construction-plan-exports')}><Download size={16} /> 발행본 관리</button><button type="button" className="cp-button cp-button--secondary" onClick={() => navigate('/construction-plans/manage')}>계획서 목록 <ArrowRight size={15} /></button></div>
      </header>

      <div className="cp-page-body">
        <section className="cp-review-inbox-summary" aria-label="검토함 상태">
          <span><FileClock size={18} /><small>검토대기</small><strong>{tabCounts.pending}</strong></span>
          <span><MessageSquareWarning size={18} /><small>수정요청</small><strong>{tabCounts.changes}</strong></span>
          <span><CheckCircle2 size={18} /><small>검토 이후</small><strong>{tabCounts.completed}</strong></span>
        </section>

        <section className="cp-card cp-review-inbox-card">
          <div className="cp-review-inbox-tabs" role="tablist" aria-label="검토함 분류">
            {TABS.map((item) => <button type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? 'is-active' : ''} key={item.key} onClick={() => setTab(item.key)}><span>{item.label}</span><b>{tabCounts[item.key]}</b></button>)}
          </div>
          <div className="cp-review-inbox-toolbar"><div><strong>{currentTab.label}</strong><p>{currentTab.description}</p></div><label className="cp-search-field"><Search size={16} /><span className="sr-only">검토함 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="현장명, 문서번호, 계획서명" /></label></div>

          {loading ? <ConstructionPlanSkeleton rows={4} /> : error ? <ConstructionPlanErrorState onRetry={() => void load()} /> : visiblePlans.length === 0 ? (
            <div className="cp-review-inbox-empty"><ClipboardCheck size={28} /><strong>{query ? '검색 결과가 없습니다' : `${currentTab.label} 문서가 없습니다`}</strong><p>{query ? '검색어를 바꾸거나 다른 분류를 확인해주세요.' : '새 검토 요청이나 상태 변경이 생기면 이곳에 표시됩니다.'}</p>{query && <button type="button" onClick={() => setQuery('')}>검색 초기화</button>}</div>
          ) : <div className="cp-review-inbox-list">{visiblePlans.map((plan) => {
            const requiredUnresolved = plan.commentSummary?.unresolvedRequired ?? 0;
            const snapshotMissing = plan.status === 'in_review' && !plan.activeReviewSnapshotId;
            return <article key={plan.id} className="cp-review-inbox-item">
              <div className="cp-review-inbox-item__title"><span><strong>{plan.projectSnapshot.siteName || '현장명 미등록'}</strong><small>{plan.documentNo} · REV.{String(plan.revision).padStart(2, '0')}</small></span><ConstructionPlanStatusBadge status={plan.status} compact /></div>
              <h2>{plan.title}</h2>
              <div className="cp-review-package-meta"><span><ShieldCheck size={13} /><small>검토 패키지</small><strong>{plan.activeReviewSnapshotId || plan.approvedSnapshotId || '미연결'}</strong></span><span><GitCompareArrows size={13} /><small>Snapshot hash</small><code>{shortHash(plan.activeReviewSnapshotHash || plan.approvedSnapshotHash)}</code></span></div>
              {snapshotMissing && <div className="cp-review-package-warning"><AlertCircle size={14} /> 고정 검토 패키지를 확인할 수 없어 결정 액션은 서버 재조회가 필요합니다.</div>}
              <div className="cp-review-inbox-item__foot"><span className={requiredUnresolved ? 'is-blocking' : ''}><MessageSquareWarning size={13} /> 필수 미해결 {requiredUnresolved}건</span><time dateTime={plan.updatedAt}>{formatDateTime(plan.updatedAt)}</time><button type="button" onClick={() => navigate(`/construction-plans/${plan.id}?tab=review`)}>{tab === 'changes' ? '수정사항 보기' : tab === 'completed' ? '검토결과 보기' : '검토 열기'} <ArrowRight size={14} /></button></div>
            </article>;
          })}</div>}
        </section>
      </div>
    </main>
  );
}

export default ConstructionPlanReviewInboxPage;
