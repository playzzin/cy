import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Copy,
  FilePlus2,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ConstructionPlan, ConstructionPlanRevisionType } from '../types';
import {
  getConstructionPlanTemplateUpgradeProposal,
  loadConstructionPlanCreationTemplateCatalog,
  type ConstructionPlanTemplateListItem,
} from '../services/constructionPlanTemplateService';

export type ConstructionPlanDeriveMode = 'revision' | 'clone';
export type { ConstructionPlanRevisionType };

export type ConstructionPlanDeriveSubmission =
  | {
      mode: 'revision';
      sourcePlanId: string;
      idempotencyKey: string;
      revisionReason: string;
      revisionType: ConstructionPlanRevisionType;
      copyDrawings: boolean;
      targetTemplate?: {
        tradeType: ConstructionPlan['tradeType'];
        templateId: string;
        templateVersion: string;
        migrationReason: string;
      };
    }
  | {
      mode: 'clone';
      sourcePlanId: string;
      idempotencyKey: string;
      title: string;
      documentNo: string;
      copyDrawings: boolean;
    };

type DeriveSourcePlan = Pick<
  ConstructionPlan,
  'id' | 'title' | 'documentNo' | 'revision' | 'status' | 'projectSnapshot'
  | 'tradeType' | 'templateId' | 'templateVersion'
>;

type ConstructionPlanDeriveDialogProps = {
  open: boolean;
  mode: ConstructionPlanDeriveMode;
  sourcePlan: DeriveSourcePlan;
  onClose: () => void;
  onSubmit: (submission: ConstructionPlanDeriveSubmission) => Promise<void>;
};

const REVISION_TYPES: Array<{ value: ConstructionPlanRevisionType; label: string; description: string }> = [
  { value: 'design_change', label: '설계 변경', description: '구조·치수·승인도면 변경' },
  { value: 'site_condition', label: '현장 조건 변경', description: '동·층·구간 또는 현장 여건 변경' },
  { value: 'method_change', label: '시공 방법 변경', description: '설치·타설·해체 절차 변경' },
  { value: 'schedule_change', label: '공정 변경', description: '공사 기간·작업 순서 변경' },
  { value: 'safety_improvement', label: '안전 개선', description: '위험성평가·안전대책 보강' },
  { value: 'other', label: '기타', description: '위 유형에 해당하지 않는 변경' },
];

const createIdempotencyKey = (mode: ConstructionPlanDeriveMode): string => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cp-${mode}-${random}`.slice(0, 128);
};

const getErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  if (code.includes('permission-denied')) return '이 작업을 수행할 권한이 없습니다.';
  if (code.includes('failed-precondition')) return '문서 상태 또는 최신 Rev.가 변경되었습니다. 새로고침한 뒤 다시 시도해주세요.';
  if (code.includes('already-exists')) return '같은 문서번호 또는 개정번호가 이미 존재합니다.';
  if (code.includes('unavailable')) return '서버에 연결할 수 없습니다. 네트워크를 확인한 뒤 다시 시도해주세요.';
  return error instanceof Error && error.message && !error.message.startsWith('construction-plan-')
    ? error.message
    : '새 초안을 만들지 못했습니다. 입력값을 확인한 뒤 다시 시도해주세요.';
};

export function ConstructionPlanDeriveDialog({
  open,
  mode,
  sourcePlan,
  onClose,
  onSubmit,
}: ConstructionPlanDeriveDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionType, setRevisionType] = useState<ConstructionPlanRevisionType | ''>('');
  const [title, setTitle] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [copyDrawings, setCopyDrawings] = useState(mode === 'revision');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [upgradeTemplates, setUpgradeTemplates] = useState<readonly ConstructionPlanTemplateListItem[]>();
  const [upgradeCatalogLoading, setUpgradeCatalogLoading] = useState(false);
  const [upgradeCatalogError, setUpgradeCatalogError] = useState('');
  const [upgradeSelected, setUpgradeSelected] = useState(false);
  const [migrationReason, setMigrationReason] = useState('');

  const loadUpgradeCatalog = useCallback(async () => {
    if (mode !== 'revision') return;
    setUpgradeCatalogLoading(true);
    setUpgradeCatalogError('');
    try {
      const catalog = await loadConstructionPlanCreationTemplateCatalog();
      setUpgradeTemplates(catalog.serverTemplates);
    } catch (error) {
      console.error('[ConstructionPlanDeriveDialog] Failed to load template upgrade catalog', error);
      setUpgradeTemplates(undefined);
      setUpgradeCatalogError('게시 템플릿 목록을 확인하지 못했습니다. 현재 버전 유지 개정은 가능하며, 업그레이드는 다시 조회한 뒤 선택하세요.');
    } finally {
      setUpgradeCatalogLoading(false);
    }
  }, [mode]);

  const upgradeProposal = useMemo(() => getConstructionPlanTemplateUpgradeProposal({
    tradeType: sourcePlan.tradeType,
    templateId: sourcePlan.templateId,
    templateVersion: sourcePlan.templateVersion,
    templates: upgradeTemplates ?? [],
  }), [sourcePlan.templateId, sourcePlan.templateVersion, sourcePlan.tradeType, upgradeTemplates]);

  useEffect(() => { submittingRef.current = submitting; }, [submitting]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRevisionReason('');
    setRevisionType('');
    setTitle(`${sourcePlan.title} 복제본`);
    setDocumentNo(`${sourcePlan.documentNo}-COPY`);
    setCopyDrawings(mode === 'revision');
    setIdempotencyKey(createIdempotencyKey(mode));
    submittingRef.current = false;
    setSubmitting(false);
    setSubmitError('');
    setUpgradeSelected(false);
    setMigrationReason('');

    const focusTimer = window.setTimeout(() => initialFocusRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [mode, open, sourcePlan.documentNo, sourcePlan.id, sourcePlan.title]);

  useEffect(() => {
    if (!open || mode !== 'revision') {
      setUpgradeTemplates(undefined);
      setUpgradeCatalogError('');
      setUpgradeCatalogLoading(false);
      return;
    }
    void loadUpgradeCatalog();
  }, [loadUpgradeCatalog, mode, open, sourcePlan.id]);

  if (!open) return null;

  const revisionAllowed = sourcePlan.status === 'issued';
  const valid = mode === 'revision'
    ? revisionAllowed
      && revisionReason.trim().length >= 5
      && Boolean(revisionType)
      && (!upgradeSelected || (Boolean(upgradeProposal.latest) && migrationReason.trim().length >= 10))
    : title.trim().length > 0 && documentNo.trim().length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      if (mode === 'revision') {
        await onSubmit({
          mode,
          sourcePlanId: sourcePlan.id,
          idempotencyKey,
          revisionReason: revisionReason.trim(),
          revisionType: revisionType as ConstructionPlanRevisionType,
          copyDrawings,
          ...(upgradeSelected && upgradeProposal.latest ? {
            targetTemplate: {
              tradeType: upgradeProposal.latest.tradeType,
              templateId: upgradeProposal.latest.templateId,
              templateVersion: upgradeProposal.latest.templateVersion,
              migrationReason: migrationReason.trim(),
            },
          } : {}),
        });
      } else {
        await onSubmit({
          mode,
          sourcePlanId: sourcePlan.id,
          idempotencyKey,
          title: title.trim(),
          documentNo: documentNo.trim(),
          copyDrawings,
        });
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error));
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const Icon = mode === 'revision' ? FilePlus2 : Copy;
  const nextRevision = '다음 Rev.';

  return (
    <div
      className="cp-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cp-derive-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="cp-derive-dialog__header">
          <span className="cp-derive-dialog__icon"><Icon size={21} /></span>
          <div>
            <span className="cp-eyebrow">{mode === 'revision' ? 'New revision' : 'Independent copy'}</span>
            <h2 id={titleId}>{mode === 'revision' ? `${nextRevision} 개정본 만들기` : '계획서 복제'}</h2>
            <p id={descriptionId}>
              {mode === 'revision'
                ? '현재 발행본을 기준으로 새 초안을 만들며, 서버가 계보에서 사용하지 않은 다음 Rev. 번호를 배정합니다.'
                : '현재 내용을 독립된 REV.00 초안으로 복제합니다.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="대화상자 닫기"><X size={18} /></button>
        </header>

        <div className="cp-derive-dialog__source">
          <div><small>기준 현장</small><strong>{sourcePlan.projectSnapshot.siteName || '현장명 미등록'}</strong></div>
          <div><small>기준 문서</small><strong>{sourcePlan.documentNo} · REV.{String(sourcePlan.revision).padStart(2, '0')}</strong></div>
        </div>

        <form onSubmit={(event) => void submit(event)}>
          {mode === 'revision' ? (
            <>
              {!revisionAllowed && (
                <div className="cp-form-error" role="alert"><AlertCircle size={15} />현장사용 발행 상태에서만 개정본을 만들 수 있습니다.</div>
              )}
              <label className="cp-derive-field">
                <span>변경유형 *</span>
                <select
                  ref={(node) => { initialFocusRef.current = node; }}
                  value={revisionType}
                  disabled={submitting || !revisionAllowed}
                  onChange={(event) => setRevisionType(event.target.value as ConstructionPlanRevisionType | '')}
                >
                  <option value="">변경유형 선택</option>
                  {REVISION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.description}</option>)}
                </select>
              </label>
              <label className="cp-derive-field">
                <span>개정 사유 * <small>{revisionReason.trim().length}/500</small></span>
                <textarea
                  ref={(node) => { if (!initialFocusRef.current) initialFocusRef.current = node; }}
                  value={revisionReason}
                  disabled={submitting || !revisionAllowed}
                  maxLength={500}
                  onChange={(event) => setRevisionReason(event.target.value)}
                  placeholder="변경 대상 페이지·도면·현장조건과 개정 목적을 5자 이상 입력하세요."
                />
              </label>
              <section className="cp-derive-field" aria-label="표준 템플릿 업그레이드">
                <span>표준 템플릿 버전</span>
                <div className="cp-derive-dialog__safe-note">
                  <ShieldCheck size={16} />
                  <span><strong>현재 {sourcePlan.templateId} v{sourcePlan.templateVersion}</strong>원본 발행본은 변경하지 않고 새 Rev.에서만 업그레이드할 수 있습니다.</span>
                </div>
                {upgradeCatalogLoading ? (
                  <div className="cp-linked-data__notice" role="status"><Loader2 size={15} className="cp-spin" /><div><strong>게시 최신 버전 확인 중</strong></div></div>
                ) : upgradeCatalogError ? (
                  <div className="cp-form-error" role="alert"><AlertCircle size={15} /><span>{upgradeCatalogError}</span><button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={() => void loadUpgradeCatalog()}>다시 조회</button></div>
                ) : upgradeProposal.available && upgradeProposal.latest ? (
                  <>
                    <label className="cp-derive-check">
                      <input
                        type="checkbox"
                        checked={upgradeSelected}
                        disabled={submitting}
                        onChange={(event) => setUpgradeSelected(event.target.checked)}
                      />
                      <span><strong>게시 최신 v{upgradeProposal.latest.templateVersion}로 새 Rev. 업그레이드</strong><small>{upgradeProposal.latest.name} · 서버 게시 해시를 새 개정에 다시 바인딩합니다.</small></span>
                    </label>
                    {upgradeSelected && (
                      <label className="cp-derive-field">
                        <span>템플릿 마이그레이션 사유 * <small>{migrationReason.trim().length}/500</small></span>
                        <textarea
                          value={migrationReason}
                          disabled={submitting}
                          minLength={10}
                          maxLength={500}
                          onChange={(event) => setMigrationReason(event.target.value)}
                          placeholder="새 표준으로 전환하는 이유와 검토 범위를 10자 이상 입력하세요."
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <div className="cp-linked-data__notice" role="status"><ShieldCheck size={15} /><div><strong>현재 게시 최신 버전입니다</strong><p>업그레이드 가능한 새 버전이 없습니다. 현재 exact 버전을 보존해 새 Rev.를 만듭니다.</p></div></div>
                )}
              </section>
            </>
          ) : (
            <div className="cp-derive-dialog__fields">
              <label className="cp-derive-field">
                <span>새 계획서 제목 *</span>
                <input ref={(node) => { initialFocusRef.current = node; }} value={title} disabled={submitting} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="cp-derive-field">
                <span>새 문서번호 *</span>
                <input value={documentNo} disabled={submitting} maxLength={80} onChange={(event) => setDocumentNo(event.target.value)} />
              </label>
              <div className="cp-derive-dialog__safe-note"><ShieldCheck size={16} /><span><strong>동일 현장 안전 복제</strong>조직 배정은 서버의 안전 기본값으로 처리하며 새 초안에서 다시 확인합니다.</span></div>
            </div>
          )}

          <label className="cp-derive-check">
            <input type="checkbox" checked={copyDrawings} disabled={submitting} onChange={(event) => setCopyDrawings(event.target.checked)} />
            <span>
              <strong>도면과 구간 표시 복사</strong>
              <small>{mode === 'revision' ? '승인상태와 승인근거는 초기화되어 새 Rev.에서 재검토합니다.' : '기본값은 복사하지 않음입니다. 복사 시 승인정보를 다시 확인해야 합니다.'}</small>
            </span>
          </label>

          {submitting && copyDrawings && (
            <div className="cp-linked-data__notice" role="status">
              <Loader2 size={15} className="cp-spin" />
              <div>
                <strong>도면 원본을 검증하고 새 계획서 경로로 복사 중입니다</strong>
                <p>서버가 generation·MIME·SHA-256을 확인하고 문서 계보와 함께 저장할 때까지 화면을 이동하지 않습니다.</p>
              </div>
            </div>
          )}

          {submitError && <div className="cp-form-error" role="alert"><AlertCircle size={15} />{submitError}</div>}

          <footer className="cp-derive-dialog__actions">
            <button type="button" className="cp-button cp-button--ghost" disabled={submitting} onClick={onClose}>취소</button>
            <button type="submit" className="cp-button cp-button--primary" disabled={!valid || submitting}>
              {submitting ? <Loader2 size={16} className="cp-spin" /> : <Icon size={16} />}
              {submitting ? '새 초안 생성 중...' : mode === 'revision' ? `${nextRevision} 초안 만들기` : '독립 초안 복제'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default ConstructionPlanDeriveDialog;
