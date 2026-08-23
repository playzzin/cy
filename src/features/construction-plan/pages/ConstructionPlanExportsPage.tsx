import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { ConstructionPlan, PlanStatus } from '../types';
import { listConstructionPlans } from '../services/constructionPlanService';
import {
  getConstructionPlanWorkflowErrorMessage,
} from '../services/constructionPlanWorkflowApi';
import { fetchAuditedIssuedConstructionPlanPdfForPlan } from '../services/constructionPlanIssuedDownloadService';
import { downloadConstructionPlanPdf } from '../services/constructionPlanPdfService';
import ConstructionPlanStatusBadge from '../components/ConstructionPlanStatusBadge';
import { ConstructionPlanErrorState, ConstructionPlanSkeleton } from '../components/ConstructionPlanFeedback';
import '../components/ConstructionPlanUI.css';

type ExportFilter = 'all' | Extract<PlanStatus, 'issued' | 'superseded' | 'archived'>;
const EXPORT_STATUSES = new Set<ConstructionPlan['status']>(['issued', 'superseded', 'archived']);

export const isDownloadableConstructionPlanExport = (plan: ConstructionPlan): boolean => (
  EXPORT_STATUSES.has(plan.status)
  && Boolean(plan.issuedExportStoragePath)
  && /^[a-f0-9]{64}$/.test(plan.issuedExportSha256 || '')
);

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const fileName = (plan: ConstructionPlan): string => plan.issuedExportFileName
  || `${plan.projectSnapshot.siteName}_${plan.title}_REV-${String(plan.revision).padStart(2, '0')}_ISSUED.pdf`;

export function ConstructionPlanExportsPage() {
  const { planId } = useParams<{ planId?: string }>();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ConstructionPlan[]>([]);
  const [filter, setFilter] = useState<ExportFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPlans(await listConstructionPlans());
    } catch (loadError) {
      console.error('[ConstructionPlanExportsPage] Failed to load exports', loadError);
      setError('발행본 목록을 불러오지 못했습니다. 권한과 네트워크 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const exports = useMemo(() => plans.filter((plan) => {
    if (!isDownloadableConstructionPlanExport(plan)) return false;
    if (planId && plan.id !== planId) return false;
    if (filter !== 'all' && plan.status !== filter) return false;
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    if (normalized && ![plan.title, plan.documentNo, plan.projectSnapshot.siteName, fileName(plan)]
      .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(normalized)) return false;
    return true;
  }), [filter, planId, plans, query]);

  const counts = useMemo(() => ({
    all: plans.filter(isDownloadableConstructionPlanExport).length,
    issued: plans.filter((plan) => plan.status === 'issued' && isDownloadableConstructionPlanExport(plan)).length,
    superseded: plans.filter((plan) => plan.status === 'superseded' && isDownloadableConstructionPlanExport(plan)).length,
    archived: plans.filter((plan) => plan.status === 'archived' && isDownloadableConstructionPlanExport(plan)).length,
  }), [plans]);

  const download = async (plan: ConstructionPlan) => {
    if (!plan.issuedExportStoragePath || !plan.issuedExportSha256 || downloadingId) return;
    setDownloadingId(plan.id);
    setDownloadError('');
    try {
      const downloaded = await fetchAuditedIssuedConstructionPlanPdfForPlan(plan);
      downloadConstructionPlanPdf(downloaded.blob, downloaded.fileName || fileName(plan));
    } catch (downloadFailure) {
      console.error('[ConstructionPlanExportsPage] Download failed', downloadFailure);
      setDownloadError(getConstructionPlanWorkflowErrorMessage(downloadFailure));
    } finally {
      setDownloadingId(undefined);
    }
  };

  return (
    <main className="cp-page cp-exports-page">
      <header className="cp-page-header">
        <div className="cp-page-header__copy"><div className="cp-page-header__icon"><FileCheck2 size={22} /></div><div><span className="cp-eyebrow">Immutable issued exports</span><h1>{planId ? '계획서 발행본' : 'PDF 발행이력'}</h1><p>서버가 승인 스냅샷 hash와 논리 42쪽·물리 42~200쪽 무결성을 확인한 발행 PDF만 제공합니다.</p></div></div>
        <div className="cp-page-header__actions"><button type="button" className="cp-icon-button" onClick={() => void load()} aria-label="발행본 목록 새로고침"><RefreshCw size={17} /></button><button type="button" className="cp-button cp-button--ghost" onClick={() => navigate('/construction-plan-approvals')}><ClipboardCheck size={16} /> 검토·승인함</button><button type="button" className="cp-button cp-button--secondary" onClick={() => navigate(planId ? `/construction-plans/${planId}` : '/construction-plans/manage')}><ArrowLeft size={15} /> {planId ? '계획서로' : '목록으로'}</button></div>
      </header>

      <div className="cp-page-body">
        <section className="cp-card cp-exports-card">
          {!planId && <div className="cp-exports-tabs" role="tablist" aria-label="발행 상태 필터">{([
            ['all', '전체'], ['issued', '최신 발행'], ['superseded', '대체됨'], ['archived', '보관'],
          ] as Array<[ExportFilter, string]>).map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} key={value} onClick={() => setFilter(value)}><span>{label}</span><b>{counts[value]}</b></button>)}</div>}
          <div className="cp-exports-toolbar"><div><ShieldCheck size={17} /><span><strong>검증된 불변 발행본</strong><small>초안·발행 후보·저장경로가 없는 문서는 제외됩니다.</small></span></div><label className="cp-search-field"><Search size={16} /><span className="sr-only">발행본 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="현장명, 문서번호, 파일명" /></label></div>

          {downloadError && <div className="cp-list-action-error" role="alert"><AlertCircle size={15} /><span>{downloadError}</span><button type="button" onClick={() => setDownloadError('')}>닫기</button></div>}
          {loading ? <ConstructionPlanSkeleton rows={4} /> : error ? <ConstructionPlanErrorState onRetry={() => void load()} /> : exports.length === 0 ? (
            <div className="cp-exports-empty"><FileText size={28} /><strong>{query ? '검색 결과가 없습니다' : '다운로드 가능한 발행본이 없습니다'}</strong><p>현장사용 발행이 완료되고 서버 저장경로가 기록되면 이곳에 나타납니다.</p>{query && <button type="button" onClick={() => setQuery('')}>검색 초기화</button>}</div>
          ) : <div className="cp-exports-list">{exports.map((plan) => <article key={plan.id} className="cp-export-item">
            <div className="cp-export-item__icon"><FileText size={22} /></div>
            <div className="cp-export-item__body"><div><strong>{plan.projectSnapshot.siteName || '현장명 미등록'}</strong><ConstructionPlanStatusBadge status={plan.status} compact /></div><h2>{plan.title}</h2><p>{plan.documentNo} · REV.{String(plan.revision).padStart(2, '0')}</p><code title="발행 PDF 파일명">{fileName(plan)}</code></div>
            <div className="cp-export-item__integrity"><span><ShieldCheck size={13} /> SHA-256 <code>{plan.issuedExportSha256 ? `${plan.issuedExportSha256.slice(0, 12)}…` : '서버 기록 확인'}</code></span><span><FileClock size={13} /> {formatDateTime(plan.issuedAt || plan.updatedAt)}</span><span><FileCheck2 size={13} /> {plan.issuedExportPageCount ? `${plan.issuedExportPageCount}쪽 A4` : 'A4 물리쪽 서버 기록'}</span></div>
            <div className="cp-export-item__actions"><button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={() => navigate(`/construction-plans/${plan.id}?tab=history`)}>이력 보기</button><button type="button" className="cp-button cp-button--primary cp-button--small" disabled={Boolean(downloadingId)} onClick={() => void download(plan)}>{downloadingId === plan.id ? <Loader2 size={14} className="cp-spin" /> : <Download size={14} />} PDF 다운로드</button></div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
}

export default ConstructionPlanExportsPage;
