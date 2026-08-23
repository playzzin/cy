import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  FileCode2,
  FilePlus2,
  Fingerprint,
  Layers3,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { CONSTRUCTION_PLAN_TRADE_LABELS } from '../domain/templateRegistry';
import {
  createConstructionPlanTemplateMutationIdempotencyKey,
  getConstructionPlanTemplateErrorMessage,
  initializeConstructionPlanTemplateServer,
  listConstructionPlanTemplatesServer,
  transitionConstructionPlanTemplateLifecycleServer,
  type ConstructionPlanTemplateLifecycle,
  type ConstructionPlanTemplateListItem,
  type ConstructionPlanTemplateListResponse,
} from '../services/constructionPlanTemplateService';
import type { ConstructionPlanTradeType } from '../types';
import '../components/ConstructionPlanUI.css';
import './ConstructionPlanTemplateAdminPage.css';

type TradeFilter = 'all' | ConstructionPlanTradeType;
type LifecycleAction = {
  template: ConstructionPlanTemplateListItem;
  toLifecycle: ConstructionPlanTemplateLifecycle | 'draft-initialize';
  idempotencyKey: string;
};

const LIFECYCLE_LABELS: Record<ConstructionPlanTemplateListItem['lifecycle'], string> = {
  uninitialized: '미등록',
  draft: '작성 중',
  in_review: '검토 중',
  published: '게시',
  retired: '폐기',
};

const ACTION_COPY: Record<LifecycleAction['toLifecycle'], {
  title: string;
  description: string;
  confirm: string;
}> = {
  'draft-initialize': {
    title: '서버 표준 등록',
    description: '코드에 등록된 exact 계약과 서버 계산 해시를 작성 중 레코드로 초기화합니다.',
    confirm: '작성 중으로 등록',
  },
  draft: {
    title: '작성 중으로 반려',
    description: '검토 중인 표준을 수정 가능한 작성 단계로 돌립니다. 반려 사유는 감사이력에 남습니다.',
    confirm: '작성 중으로 반려',
  },
  in_review: {
    title: '표준 검토 요청',
    description: 'manifest를 변경하지 않고 현재 exact 서버 계약을 검토 단계로 전환합니다.',
    confirm: '검토 요청',
  },
  published: {
    title: '현장사용 표준 게시',
    description: '이 버전을 공종의 최신 게시본으로 원자 지정합니다. 기존 게시본은 그대로 보존됩니다.',
    confirm: '최신 표준 게시',
  },
  retired: {
    title: '게시본 폐기',
    description: '기존 계획서의 재현은 유지하지만 신규 계획서에서는 즉시 선택할 수 없게 됩니다.',
    confirm: '게시본 폐기',
  },
};

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const shortHash = (value: string): string => `${value.slice(0, 12)}…${value.slice(-6)}`;

const actionIcon = (lifecycle: LifecycleAction['toLifecycle']) => {
  if (lifecycle === 'draft-initialize') return <FilePlus2 size={15} />;
  if (lifecycle === 'draft') return <RotateCcw size={15} />;
  if (lifecycle === 'in_review') return <Send size={15} />;
  if (lifecycle === 'published') return <FileCheck2 size={15} />;
  return <Trash2 size={15} />;
};

export function ConstructionPlanTemplateAdminPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<ConstructionPlanTemplateListResponse>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<TradeFilter>('all');
  const [action, setAction] = useState<LifecycleAction>();
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setCatalog(await listConstructionPlanTemplatesServer());
    } catch (error) {
      console.error('[ConstructionPlanTemplateAdminPage] Failed to load templates', error);
      setLoadError(getConstructionPlanTemplateErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const templates = useMemo(() => (catalog?.templates ?? []).filter((template) => (
    filter === 'all' || template.tradeType === filter
  )), [catalog?.templates, filter]);

  const counts = useMemo(() => ({
    total: catalog?.templates.length ?? 0,
    published: catalog?.templates.filter((template) => template.lifecycle === 'published').length ?? 0,
    review: catalog?.templates.filter((template) => template.lifecycle === 'in_review').length ?? 0,
    retired: catalog?.templates.filter((template) => template.lifecycle === 'retired').length ?? 0,
  }), [catalog?.templates]);

  const openAction = (
    template: ConstructionPlanTemplateListItem,
    toLifecycle: LifecycleAction['toLifecycle'],
  ) => {
    setAction({
      template,
      toLifecycle,
      idempotencyKey: createConstructionPlanTemplateMutationIdempotencyKey(
        toLifecycle === 'draft-initialize' ? 'initialize' : 'transition',
      ),
    });
    setReason('');
    setActionError('');
  };

  const closeAction = () => {
    if (busy) return;
    setAction(undefined);
    setReason('');
    setActionError('');
  };

  const submitAction = async () => {
    if (!action || busy || reason.trim().length < 5) return;
    setBusy(true);
    setActionError('');
    const identity = {
      tradeType: action.template.tradeType,
      templateId: action.template.templateId,
      templateVersion: action.template.templateVersion,
    };
    try {
      if (action.toLifecycle === 'draft-initialize') {
        await initializeConstructionPlanTemplateServer({
          ...identity,
          reason: reason.trim(),
          idempotencyKey: action.idempotencyKey,
        });
      } else {
        await transitionConstructionPlanTemplateLifecycleServer({
          ...identity,
          toLifecycle: action.toLifecycle,
          expectedLifecycleVersion: action.template.lifecycleVersion,
          reason: reason.trim(),
          idempotencyKey: action.idempotencyKey,
        });
      }
      setAction(undefined);
      setReason('');
      await load();
    } catch (error) {
      console.error('[ConstructionPlanTemplateAdminPage] Lifecycle action failed', error);
      setActionError(getConstructionPlanTemplateErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (template: ConstructionPlanTemplateListItem) => {
    if (!catalog?.canManage) return <span className="cp-template-admin__read-only">조회 전용</span>;
    if (template.lifecycle === 'uninitialized') {
      return <button type="button" onClick={() => openAction(template, 'draft-initialize')}><FilePlus2 size={14} /> 서버 등록</button>;
    }
    if (template.lifecycle === 'draft') {
      return <button type="button" onClick={() => openAction(template, 'in_review')}><Send size={14} /> 검토 요청</button>;
    }
    if (template.lifecycle === 'in_review') {
      return <>
        <button type="button" className="is-ghost" onClick={() => openAction(template, 'draft')}><RotateCcw size={14} /> 반려</button>
        <button type="button" onClick={() => openAction(template, 'published')}><FileCheck2 size={14} /> 게시</button>
      </>;
    }
    if (template.lifecycle === 'published') {
      return <button type="button" className="is-danger" onClick={() => openAction(template, 'retired')}><Trash2 size={14} /> 폐기</button>;
    }
    return <span className="cp-template-admin__terminal"><LockKeyhole size={13} /> 신규생성 차단</span>;
  };

  return (
    <main className="cp-page cp-template-admin">
      <header className="cp-page-header">
        <div className="cp-page-header__copy">
          <div className="cp-page-header__icon"><Layers3 size={22} /></div>
          <div>
            <span className="cp-eyebrow">Controlled document standard</span>
            <h1>표준 템플릿 관리</h1>
            <p>코드로 검증된 표준만 검토·게시하고, 게시본의 manifest와 렌더러 번들을 불변 해시로 보존합니다.</p>
          </div>
        </div>
        <div className="cp-page-header__actions">
          <button type="button" className="cp-icon-button" onClick={() => void load()} aria-label="템플릿 목록 새로고침"><RefreshCw size={17} /></button>
          <button type="button" className="cp-button cp-button--ghost" onClick={() => navigate('/construction-plans/manage')}><ArrowLeft size={15} /> 계획서 목록</button>
          <button type="button" className="cp-button cp-button--secondary" onClick={() => navigate('/construction-plans/create')}><FilePlus2 size={15} /> 새 계획서</button>
        </div>
      </header>

      <div className="cp-page-body cp-template-admin__body">
        <section className="cp-template-admin__summary" aria-label="템플릿 현황">
          {[
            { label: '등록 계약', value: counts.total, Icon: FileCode2 },
            { label: '게시본', value: counts.published, Icon: CheckCircle2 },
            { label: '검토 중', value: counts.review, Icon: Clock3 },
            { label: '폐기본', value: counts.retired, Icon: LockKeyhole },
          ].map(({ label, value, Icon }) => (
            <div key={label}><span><Icon size={17} /></span><small>{label}</small><strong>{value}</strong></div>
          ))}
        </section>

        {!loading && catalog && !catalog.canManage && (
          <div className="cp-template-admin__notice" role="status"><ShieldCheck size={18} /><div><strong>조회 전용 권한</strong><p>상태 전이는 본사 또는 표준 템플릿 관리자만 수행할 수 있습니다.</p></div></div>
        )}

        <div className="cp-template-admin__grid">
          <section className="cp-card cp-template-admin__catalog">
            <div className="cp-template-admin__toolbar">
              <div role="tablist" aria-label="공종 필터">
                {([
                  ['all', '전체'],
                  ['system-shoring', '시스템동바리'],
                  ['system-scaffold', '시스템비계'],
                ] as Array<[TradeFilter, string]>).map(([value, label]) => (
                  <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} key={value} onClick={() => setFilter(value)}>{label}</button>
                ))}
              </div>
              <span><Fingerprint size={14} /> server-calculated hashes</span>
            </div>

            {loading && (
              <div className="cp-template-admin__loading" role="status"><Loader2 size={22} className="cp-spin" /><strong>서버 표준 계약 확인 중</strong><p>게시상태와 불변 해시를 검증하고 있습니다.</p></div>
            )}
            {!loading && loadError && (
              <div className="cp-template-admin__error" role="alert"><AlertCircle size={22} /><strong>템플릿 목록을 불러오지 못했습니다</strong><p>{loadError}</p><button type="button" onClick={() => void load()}><RefreshCw size={14} /> 다시 시도</button></div>
            )}
            {!loading && !loadError && templates.length === 0 && (
              <div className="cp-template-admin__empty"><FileCode2 size={24} /><strong>표시할 표준 계약이 없습니다</strong><p>선택한 공종 필터를 변경하거나 서버 등록 상태를 확인하세요.</p></div>
            )}

            {!loading && !loadError && templates.map((template) => (
              <article className={`cp-template-admin__row is-${template.lifecycle}`} key={template.key}>
                <div className="cp-template-admin__identity">
                  <div className="cp-template-admin__state-line">
                    <span className={`cp-template-admin__state is-${template.lifecycle}`}><CircleDot size={11} /> {LIFECYCLE_LABELS[template.lifecycle]}</span>
                    {template.isLatest && <em><CheckCircle2 size={12} /> 최신 게시</em>}
                  </div>
                  <strong>{template.name}</strong>
                  <p>{CONSTRUCTION_PLAN_TRADE_LABELS[template.tradeType]} · {template.templateId} · v{template.templateVersion}</p>
                </div>
                <dl className="cp-template-admin__contract">
                  <div><dt>논리 페이지</dt><dd>{template.pageCount}쪽</dd></div>
                  <div><dt>Renderer</dt><dd>{template.rendererVersion}</dd></div>
                  <div title={template.manifestHash}><dt>Manifest SHA</dt><dd>{shortHash(template.manifestHash)}</dd></div>
                  <div title={template.templateBundleHash}><dt>Bundle SHA</dt><dd>{shortHash(template.templateBundleHash)}</dd></div>
                </dl>
                <div className="cp-template-admin__audit">
                  <span>상태 버전 <strong>{template.lifecycleVersion}</strong></span>
                  <span>최근 변경 <strong>{formatDateTime(template.updatedAt)}</strong></span>
                  <span>변경자 <strong>{template.updatedByName || template.updatedBy || '-'}</strong></span>
                  {template.lastTransitionReason && <p>{template.lastTransitionReason}</p>}
                </div>
                <div className="cp-template-admin__actions">{renderActions(template)}</div>
              </article>
            ))}
          </section>

          <aside className="cp-template-admin__policy">
            <section>
              <span className="cp-template-admin__policy-icon"><ShieldCheck size={18} /></span>
              <h2>문서통제 불변식</h2>
              <ol>
                <li><b>1</b><span><strong>작성 중</strong>서버 등록 exact 계약만 시작</span></li>
                <li><b>2</b><span><strong>검토 중</strong>상태 전이 사유와 행위자 기록</span></li>
                <li><b>3</b><span><strong>게시</strong>한 공종의 최신본을 원자 지정</span></li>
                <li><b>4</b><span><strong>폐기</strong>신규생성만 차단, 과거본 재현 유지</span></li>
              </ol>
            </section>
            <section className="cp-template-admin__upgrade-policy">
              <LockKeyhole size={17} />
              <div><strong>기존 계획서 직접 변경 금지</strong><p>더 최신 표준이 게시되면 새 개정본에서만 업그레이드를 제안합니다. 이미 발행된 Rev.의 템플릿 ID·버전·해시는 바뀌지 않습니다.</p></div>
            </section>
          </aside>
        </div>
      </div>

      {action && (
        <div className="cp-template-admin__modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAction(); }}>
          <section className="cp-template-admin__modal" role="dialog" aria-modal="true" aria-labelledby="template-action-title">
            <header>
              <span>{actionIcon(action.toLifecycle)}</span>
              <div><small>{action.template.name} v{action.template.templateVersion}</small><h2 id="template-action-title">{ACTION_COPY[action.toLifecycle].title}</h2></div>
            </header>
            <p>{ACTION_COPY[action.toLifecycle].description}</p>
            <div className="cp-template-admin__modal-binding"><Fingerprint size={14} /><span>{shortHash(action.template.manifestHash)}</span><ChevronRight size={13} /><strong>{LIFECYCLE_LABELS[action.toLifecycle === 'draft-initialize' ? 'draft' : action.toLifecycle]}</strong></div>
            <label>
              <span>상태 전이 사유 *</span>
              <textarea aria-label="상태 전이 사유 *" autoFocus value={reason} maxLength={500} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="검토·게시·폐기 판단의 근거를 5자 이상 기록하세요." />
              <small>{reason.trim().length}/500</small>
            </label>
            {actionError && <div className="cp-template-admin__modal-error" role="alert"><AlertCircle size={14} />{actionError}</div>}
            <footer>
              <button type="button" className="is-ghost" disabled={busy} onClick={closeAction}>취소</button>
              <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void submitAction()}>{busy ? <Loader2 size={15} className="cp-spin" /> : actionIcon(action.toLifecycle)} {busy ? '서버 처리 중…' : ACTION_COPY[action.toLifecycle].confirm}</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default ConstructionPlanTemplateAdminPage;
