import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileImage,
  Library,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  createConstructionPlanDrawingLibraryImportIdempotencyKey,
  importConstructionPlanDrawingFromLibrary,
  listConstructionPlanDrawingLibrary,
  type ConstructionPlanDrawingLibraryItem,
  type ImportConstructionPlanDrawingResponse,
} from '../services/constructionPlanDrawingLibraryService';

type ConstructionPlanDrawingLibraryDialogProps = {
  open: boolean;
  targetPlanId: string;
  targetSectionId: string;
  expectedLockVersion: number;
  onClose: () => void;
  onImported: (result: ImportConstructionPlanDrawingResponse) => void | Promise<void>;
};

const errorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  if (code.includes('permission-denied')) return '원본 또는 대상 계획서에 접근할 권한이 없습니다.';
  if (code.includes('aborted')) return '대상 계획서가 변경되었습니다. 편집기를 새로고침한 뒤 다시 시도해주세요.';
  if (code.includes('failed-precondition')) return '원본 계보·Storage generation 또는 편집 잠금을 검증하지 못했습니다.';
  if (code.includes('already-exists')) return '같은 재사용 요청의 대상 경로가 다른 데이터와 충돌했습니다.';
  return error instanceof Error && !error.message.startsWith('construction-plan-')
    ? error.message
    : '도면 라이브러리 작업을 완료하지 못했습니다. 다시 시도해주세요.';
};

const formatBytes = (value: number): string => {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${value} B`;
};

export function ConstructionPlanDrawingLibraryDialog({
  open,
  targetPlanId,
  targetSectionId,
  expectedLockVersion,
  onClose,
  onImported,
}: ConstructionPlanDrawingLibraryDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const requestSequenceRef = useRef(0);
  const importingRef = useRef(false);
  const [items, setItems] = useState<ConstructionPlanDrawingLibraryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [selected, setSelected] = useState<ConstructionPlanDrawingLibraryItem>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [imported, setImported] = useState<ImportConstructionPlanDrawingResponse>();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { importingRef.current = importing; }, [importing]);

  const load = useCallback(async (cursor?: string) => {
    const sequence = ++requestSequenceRef.current;
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setLoadError('');
    try {
      const response = await listConstructionPlanDrawingLibrary({
        targetPlanId,
        pageSize: 20,
        ...(cursor ? { cursor } : {}),
      });
      if (sequence !== requestSequenceRef.current) return;
      setItems((current) => cursor
        ? [...current, ...response.items.filter((item) => !current.some((candidate) => (
          candidate.sourcePlanId === item.sourcePlanId && candidate.drawingId === item.drawingId
        )))]
        : response.items);
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (sequence === requestSequenceRef.current) setLoadError(errorMessage(error));
    } finally {
      if (sequence === requestSequenceRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [targetPlanId]);

  useEffect(() => {
    if (!open) return undefined;
    setItems([]);
    setNextCursor(undefined);
    setSelected(undefined);
    setImported(undefined);
    setImportError('');
    setIdempotencyKey('');
    importingRef.current = false;
    setImporting(false);
    void load();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !importingRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', keydown);
    return () => {
      requestSequenceRef.current += 1;
      document.removeEventListener('keydown', keydown);
    };
  }, [load, open]);

  if (!open) return null;

  const choose = (item: ConstructionPlanDrawingLibraryItem) => {
    if (!item.reusable || importing) return;
    setSelected(item);
    setImported(undefined);
    setImportError('');
    setIdempotencyKey(createConstructionPlanDrawingLibraryImportIdempotencyKey());
  };

  const submit = async () => {
    if (!selected || !selected.reusable || importingRef.current) return;
    const requestKey = idempotencyKey || createConstructionPlanDrawingLibraryImportIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(requestKey);
    importingRef.current = true;
    setImporting(true);
    setImportError('');
    try {
      const result = await importConstructionPlanDrawingFromLibrary({
        targetPlanId,
        targetSectionId,
        sourcePlanId: selected.sourcePlanId,
        sourceDrawingId: selected.drawingId,
        expectedLockVersion,
        idempotencyKey: requestKey,
      });
      await onImported(result);
      setImported(result);
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  };

  return (
    <div
      className="cp-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !importing) onClose();
      }}
    >
      <div
        className="cp-drawing-library-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="cp-derive-dialog__header">
          <span className="cp-derive-dialog__icon"><Library size={21} /></span>
          <div>
            <span className="cp-eyebrow">Same-site drawing library</span>
            <h2 id={titleId}>현장 도면 가져오기</h2>
            <p id={descriptionId}>접근 가능한 같은 현장 계획서의 검증된 원본만 서버에서 복사합니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={importing} aria-label="도면 라이브러리 닫기"><X size={18} /></button>
        </header>

        <div className="cp-drawing-library-dialog__security">
          <ShieldCheck size={16} />
          <span>원본은 변경하지 않습니다. 대상 계획서에 새 불변 경로로 복사하며 승인·적용성·PDF 미리보기는 재검토됩니다.</span>
        </div>

        <div className="cp-drawing-library-dialog__body">
          <section className="cp-drawing-library-dialog__list" aria-label="재사용 가능한 도면 목록">
            {loading ? (
              <div className="cp-drawing-library-dialog__state" role="status"><Loader2 className="cp-spin" /><strong>같은 현장 도면 조회 중</strong></div>
            ) : loadError ? (
              <div className="cp-drawing-library-dialog__state is-error" role="alert">
                <AlertCircle /><strong>{loadError}</strong>
                <button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={() => void load()}><RefreshCw size={14} />다시 조회</button>
              </div>
            ) : items.length === 0 ? (
              <div className="cp-drawing-library-dialog__state"><FileImage /><strong>가져올 수 있는 기존 도면이 없습니다</strong><p>같은 현장의 다른 접근 가능 계획서에 도면을 먼저 등록하세요.</p></div>
            ) : (
              <>
                {items.map((item) => {
                  const active = selected?.sourcePlanId === item.sourcePlanId && selected.drawingId === item.drawingId;
                  return (
                    <button
                      key={`${item.sourcePlanId}:${item.drawingId}`}
                      type="button"
                      className={`cp-drawing-library-card${active ? ' is-selected' : ''}${item.reusable ? '' : ' is-disabled'}`}
                      disabled={!item.reusable || importing}
                      onClick={() => choose(item)}
                    >
                      <span className="cp-drawing-library-card__icon"><FileImage size={18} /></span>
                      <span className="cp-drawing-library-card__content">
                        <span><strong>{item.drawingNo} · {item.title}</strong><em>{item.approvalStatus}</em></span>
                        <small>{item.sourceDocumentNo} · REV.{String(item.sourcePlanRevision).padStart(2, '0')} · {item.sourcePlanStatus}</small>
                        <small>{item.originalFileName} · {formatBytes(item.sizeBytes)} · SHA {item.sourceSha256 ? `${item.sourceSha256.slice(0, 12)}…` : '검증 불가'}</small>
                        {!item.reusable && <small className="is-warning">{item.reuseBlockReason}</small>}
                      </span>
                      {item.reusable && <ChevronRight size={16} />}
                    </button>
                  );
                })}
                {nextCursor && (
                  <button type="button" className="cp-button cp-button--ghost cp-drawing-library-dialog__more" disabled={loadingMore} onClick={() => void load(nextCursor)}>
                    {loadingMore ? <Loader2 size={15} className="cp-spin" /> : <RefreshCw size={15} />}
                    {loadingMore ? '다음 목록 조회 중' : '도면 더 보기'}
                  </button>
                )}
              </>
            )}
          </section>

          <aside className="cp-drawing-library-dialog__selection">
            {imported ? (
              <div className="cp-drawing-library-dialog__success" role="status">
                <CheckCircle2 size={28} />
                <strong>{imported.drawing.drawingNo || '도면'}을 가져왔습니다</strong>
                <p>대상 원본 generation과 SHA를 검증했습니다. 승인정보와 적용구간을 다시 확인하고, PDF는 새 계획서에서 미리보기를 재생성합니다.</p>
                <button type="button" className="cp-button cp-button--primary" onClick={onClose}>편집기로 돌아가기</button>
              </div>
            ) : selected ? (
              <>
                <span className="cp-eyebrow">Selected source</span>
                <h3>{selected.drawingNo} · {selected.title}</h3>
                <dl>
                  <div><dt>원본 계획서</dt><dd>{selected.sourcePlanTitle}</dd></div>
                  <div><dt>문서 / Rev.</dt><dd>{selected.sourceDocumentNo} / {selected.sourcePlanRevision}</dd></div>
                  <div><dt>원본 승인상태</dt><dd>{selected.approvalStatus}</dd></div>
                  <div><dt>가져온 뒤</dt><dd>초안 · 재검토 필요</dd></div>
                </dl>
                <div className="cp-standard-warning"><AlertCircle size={15} /><div><strong>자동 승인 승계 없음</strong><p>주석 좌표·스타일·라벨은 복사되지만 잠금과 승인근거는 초기화됩니다.</p></div></div>
                {importError && <div className="cp-form-error" role="alert"><AlertCircle size={15} />{importError}</div>}
                <button type="button" className="cp-button cp-button--primary" disabled={importing} onClick={() => void submit()}>
                  {importing ? <Loader2 size={16} className="cp-spin" /> : <Library size={16} />}
                  {importing ? '원본 검증·복사 중...' : importError ? '같은 요청 다시 시도' : '이 도면 가져오기'}
                </button>
              </>
            ) : (
              <div className="cp-drawing-library-dialog__state"><Library /><strong>왼쪽에서 도면을 선택하세요</strong><p>서버가 원본 generation·MIME magic·크기·SHA-256을 다시 검사합니다.</p></div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default ConstructionPlanDrawingLibraryDialog;

