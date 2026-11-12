import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementImportFile } from '../../types/cardStatementImport';
import CardStatementFilesDialog from './CardStatementFilesDialog';

interface Props {
  isOpen: boolean;
  yearMonth: string;
  onClose: () => void;
  onCancelled: () => void;
}

const statusLabels: Record<string, string> = {
  uploading: '업로드 중', uploaded: '업로드됨', analyzing: '분석 중', completed: '분석 완료', failed: '처리 실패', cancelled: '취소됨',
};

const hasRetainedOriginal = (file: CardStatementImportFile) => Boolean(file.storagePath) && file.sourceDeletionStatus !== 'deleted';
const canSelect = (file: CardStatementImportFile) => Boolean(file.jobId) && !['uploading', 'analyzing'].includes(file.status)
  && (file.status !== 'cancelled' || hasRetainedOriginal(file));
const actionLabel = (file: CardStatementImportFile) => file.status === 'cancelled' ? '남은 원본 삭제' : '업로드·원본 삭제';

export const CardStatementImportHistoryModal: React.FC<Props> = ({ isOpen, yearMonth, onClose, onCancelled }) => {
  const [files, setFiles] = useState<CardStatementImportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<CardStatementImportFile[]>([]);
  const [progress, setProgress] = useState('');
  const cancelInFlight = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [viewingFile, setViewingFile] = useState<CardStatementImportFile | null>(null);
  const refresh = useCallback(async (deletedIds: string[], pendingIds: string[]) => {
    setLoading(true);
    try {
      const items = await cardStatementImportService.listUploadHistory(yearMonth);
      // A delayed list response must not restore a completed deletion button.
      setFiles(current => {
        const previous = new Map(current.map(file => [file.id, file.sourceDeletionStatus]));
        return items.map((file): CardStatementImportFile => {
          if (deletedIds.includes(file.id) || previous.get(file.id) === 'deleted') return { ...file, status: 'cancelled', sourceDeletionStatus: 'deleted' };
          if (file.sourceDeletionStatus !== 'deleted' && (pendingIds.includes(file.id) || previous.get(file.id) === 'pending')) return { ...file, status: 'cancelled', sourceDeletionStatus: 'pending' };
          return file;
        });
      });
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setFiles([]);
    setSelectedIds([]);
    setConfirmation([]);
    setViewingFile(null);
    setError('');
    setMessage('');
    setLoading(true);
    cardStatementImportService.listUploadHistory(yearMonth)
      .then((items) => { if (active) setFiles(items); })
      .catch(() => { if (active) setError('업로드 내역을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, yearMonth]);

  const cancel = async () => {
    if (!confirmation.length || cancelInFlight.current) return;
    cancelInFlight.current = true;
    const targets = confirmation.slice();
    const succeeded: string[] = [];
    const failed: string[] = [];
    const pending: string[] = [];
    const errors: string[] = [];
    setBusyId(targets[0].id);
    setError('');
    setMessage('');
    try {
      for (const [index, target] of targets.entries()) {
        setBusyId(target.id);
        setProgress(`${index + 1}/${targets.length}건 업로드·원본 삭제 중…`);
        try {
          await cardStatementImportService.cancelStoredFile(target.id, { deleteOriginal: true });
          succeeded.push(target.id);
        } catch (cause) {
          failed.push(target.id);
          if ((cause as { details?: { sourceDeletionStatus?: string } })?.details?.sourceDeletionStatus === 'pending') pending.push(target.id);
          errors.push(`${target.originalFileName}: ${cause instanceof Error ? cause.message : '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'}`);
        }
      }
      setConfirmation([]);
      setSelectedIds(failed);
      if (succeeded.length) {
        setMessage(`${targets.length === 1 ? '업로드와 원본 파일을 삭제했습니다.' : `선택한 ${targets.length}건 중 ${succeeded.length}건의 업로드와 원본 파일을 삭제했습니다.`} 카드 표의 첨부 연결도 정리했습니다. 취소 기록은 남으며, 올바른 월에 PDF를 다시 등록할 수 있습니다.`);
      }
      if (succeeded.length || pending.length) {
        setFiles(current => current.map(file => succeeded.includes(file.id) ? { ...file, status: 'cancelled', sourceDeletionStatus: 'deleted' }
          : pending.includes(file.id) ? { ...file, status: 'cancelled', sourceDeletionStatus: 'pending' } : file));
        onCancelled();
        await refresh(succeeded, pending).catch(() => errors.push('처리 결과는 저장됐지만 목록 새로고침에 실패했습니다. 창을 다시 열어 주세요.'));
      }
      setError(errors.join('\n'));
    } finally {
      cancelInFlight.current = false;
      setBusyId('');
      setProgress('');
    }
  };

  if (!isOpen) return null;
  const visible = files.filter((file) => showCancelled || file.status !== 'cancelled' || file.sourceDeletionStatus === 'pending');
  const selectable = visible.filter(canSelect);
  const selectedFiles = selectable.filter((file) => selectedIds.includes(file.id));
  const openConfirmation = (targets: CardStatementImportFile[]) => {
    setConfirmation(targets);
    setError('');
    setMessage('');
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-3">
      <section role="dialog" aria-modal="true" aria-labelledby="statement-history-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="statement-history-title" className="min-w-0 text-base font-extrabold sm:text-lg">{yearMonth} 청구서 업로드 내역</h2>
          <button type="button" onClick={onClose} disabled={!!busyId} className="shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm disabled:opacity-40">닫기</button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900">
            잘못된 월에 올렸나요? 이 월의 해당 카드 금액을 0으로 바꾸고 <strong>전체 저장</strong>한 뒤 업로드·원본 삭제를 누르세요.
            이후 올바른 월에서 PDF를 새로 등록할 수 있습니다. 확정된 청구서는 취소할 수 없습니다.
            <div className="mt-1 text-xs">원본 PDF와 카드 표의 첨부 연결도 함께 삭제합니다. 취소 기록은 남으며, 저장된 금액은 변경하지 않습니다.</div>
            <div className="mt-1 text-xs">전체 선택 또는 개별 선택 후 최종 확인을 눌러야 삭제가 시작됩니다. 이미 취소한 파일은 ‘취소 내역도 보기’에서 남은 원본을 선택해 한 번에 삭제할 수 있습니다.</div>
          </div>
          {error && <div role="alert" className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {message && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
          {confirmation.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h3 className="text-sm font-bold">삭제 전 최종 확인</h3>
              <p className="break-all text-sm">{confirmation.length === 1 ? <><strong>{confirmation[0].originalFileName}</strong>의 {yearMonth} 업로드와 원본 파일</> : <>선택한 {confirmation.length}건의 {yearMonth} 업로드와 원본 파일</>}을 삭제할까요? 카드 표의 첨부 연결도 제거합니다. 원본 PDF는 복구할 수 없으니 필요한 파일은 먼저 내려받아 주세요. 저장된 금액과 확정 청구 여부를 파일별로 확인한 후 처리합니다.</p>
              {confirmation.length > 1 && <ul className="max-h-32 list-inside list-disc overflow-y-auto break-all text-xs text-slate-700">{confirmation.map((file) => <li key={file.id}>{file.originalFileName}</li>)}</ul>}
              {progress && <p role="status" className="text-sm">{progress}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void cancel()} disabled={!!busyId} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busyId ? '업로드·원본 삭제 중…' : confirmation.length === 1 ? '확인, 원본까지 삭제' : `확인, ${confirmation.length}건 원본까지 삭제`}</button>
                <button type="button" onClick={() => setConfirmation([])} disabled={!!busyId} className="rounded-lg border bg-white px-4 py-2 text-sm">돌아가기</button>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showCancelled} disabled={!!busyId} onChange={(event) => setShowCancelled(event.target.checked)} />취소 내역도 보기</label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="삭제 가능한 내역 전체 선택" checked={selectable.length > 0 && selectedFiles.length === selectable.length} disabled={loading || !!busyId || confirmation.length > 0 || !selectable.length} onChange={(event) => setSelectedIds(event.target.checked ? selectable.map((file) => file.id) : [])} />전체 선택 ({selectedFiles.length}/{selectable.length}건)</label>
            <button type="button" onClick={() => openConfirmation(selectedFiles)} disabled={loading || !!busyId || confirmation.length > 0 || !selectedFiles.length} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">선택한 {selectedFiles.length}건 업로드·원본 삭제</button>
          </div>
          {loading ? <p role="status">업로드 내역을 불러오는 중…</p> : visible.length === 0 ? <p className="py-6 text-center text-slate-500">이 월에는 표시할 업로드 내역이 없습니다.</p> : (
            <ul className="divide-y rounded-xl border">
              {visible.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  {file.jobId && (file.status !== 'cancelled' || hasRetainedOriginal(file)) && <input type="checkbox" aria-label={`${file.originalFileName} 선택`} checked={selectedIds.includes(file.id)} disabled={!canSelect(file) || !!busyId || confirmation.length > 0} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id))} />}
                  <div className="min-w-0 flex-1">
                    <div className="break-all text-sm font-bold text-slate-800">{file.originalFileName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {file.createdAt?.seconds ? new Date(file.createdAt.seconds * 1000).toLocaleString('ko-KR') : '등록일 미확인'} · {statusLabels[file.status] || file.status}
                      {file.sourceDeletionStatus === 'pending' ? ' · 원본 삭제 재시도 필요' : file.status === 'cancelled' && hasRetainedOriginal(file) ? ' · 원본 보관 중' : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/support/cards/statements?month=${encodeURIComponent(yearMonth)}&fileId=${encodeURIComponent(file.id)}`}
                      aria-label={`${file.originalFileName} 상세내역`} onClick={event => { if (busyId || confirmation.length) event.preventDefault(); }}
                      aria-disabled={!!busyId || confirmation.length > 0}
                      className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50">상세내역</a>
                    {file.sourceDeletionStatus === 'deleted' ? <span className="px-3 py-2 text-sm text-slate-500">원본 삭제됨</span> : <button type="button" aria-label={`${file.originalFileName} 원본 열기`} onClick={() => setViewingFile(file)} disabled={!file.storagePath || file.status === 'uploading' || !!busyId || confirmation.length > 0} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">원본 열기</button>}
                    {file.jobId && (file.status !== 'cancelled' || hasRetainedOriginal(file)) && <button type="button" aria-label={`${file.originalFileName} ${actionLabel(file)}`} onClick={() => openConfirmation([file])} disabled={!!busyId || confirmation.length > 0 || !canSelect(file)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">{actionLabel(file)}</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {viewingFile && <CardStatementFilesDialog paths={[viewingFile.storagePath]} fileNames={{ [viewingFile.storagePath]: viewingFile.originalFileName }} onClose={() => setViewingFile(null)} />}
    </div>
  );
};
