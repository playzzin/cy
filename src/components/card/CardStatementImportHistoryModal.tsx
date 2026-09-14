import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementImportFile } from '../../types/cardStatementImport';

interface Props {
  isOpen: boolean;
  yearMonth: string;
  onClose: () => void;
  onCancelled: () => void;
}

const statusLabels: Record<string, string> = {
  uploading: '업로드 중', uploaded: '업로드됨', analyzing: '분석 중', completed: '분석 완료', failed: '처리 실패', cancelled: '취소됨',
};

const canSelect = (file: CardStatementImportFile) => !['cancelled', 'uploading', 'analyzing'].includes(file.status);

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
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await cardStatementImportService.listUploadHistory(yearMonth));
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
    const errors: string[] = [];
    setBusyId(targets[0].id);
    setError('');
    setMessage('');
    try {
      for (const [index, target] of targets.entries()) {
        setBusyId(target.id);
        setProgress(`${index + 1}/${targets.length}건 확인 및 취소 중…`);
        try {
          await cardStatementImportService.cancelStoredFile(target.id);
          succeeded.push(target.id);
        } catch (cause) {
          failed.push(target.id);
          errors.push(`${target.originalFileName}: ${cause instanceof Error ? cause.message : '취소하지 못했습니다. 잠시 후 다시 시도해 주세요.'}`);
        }
      }
      setConfirmation([]);
      setSelectedIds(failed);
      if (succeeded.length) {
        setFiles((current) => current.map((file) => succeeded.includes(file.id) ? { ...file, status: 'cancelled' } : file));
        setMessage(`${targets.length === 1 ? '업로드를 취소했습니다.' : `선택한 ${targets.length}건 중 ${succeeded.length}건의 업로드를 취소했습니다.`} 올바른 월로 이동해 PDF를 새로 등록해 주세요. 원본 파일과 취소 기록은 보관됩니다.`);
        onCancelled();
        await refresh().catch(() => errors.push('취소는 완료됐지만 목록 새로고침에 실패했습니다. 창을 다시 열어 주세요.'));
      }
      setError(errors.join('\n'));
    } finally {
      cancelInFlight.current = false;
      setBusyId('');
      setProgress('');
    }
  };

  if (!isOpen) return null;
  const visible = files.filter((file) => showCancelled || file.status !== 'cancelled');
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
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="statement-history-title" className="text-lg font-extrabold">{yearMonth} 청구서 업로드 내역</h2>
          <button type="button" onClick={onClose} disabled={!!busyId} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">닫기</button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900">
            잘못된 월에 올렸나요? 이 월의 해당 카드 금액을 0으로 바꾸고 <strong>전체 저장</strong>한 뒤 파일을 취소하세요.
            이후 올바른 월에서 PDF를 새로 등록할 수 있습니다. 확정된 청구서는 취소할 수 없습니다.
            <div className="mt-1 text-xs">카드 PDF 일괄등록 내역입니다. 원본 파일과 취소 기록은 보관하며, 금액은 이 버튼으로 삭제하지 않습니다.</div>
            <div className="mt-1 text-xs">여러 내역을 한 번에 정리하려면 전체 선택 또는 개별 선택 후 업로드 취소를 누르세요. 취소할 수 없는 파일은 사유를 안내하고 나머지는 처리합니다.</div>
          </div>
          {error && <div role="alert" className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {message && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
          {confirmation.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="break-all text-sm">{confirmation.length === 1 ? <><strong>{confirmation[0].originalFileName}</strong>의 {yearMonth} 업로드</> : <>선택한 {confirmation.length}건의 {yearMonth} 업로드</>}를 취소할까요? 저장된 금액과 확정 청구 여부를 파일별로 확인한 후 처리합니다. 금액과 원본 PDF는 삭제하지 않습니다.</p>
              {confirmation.length > 1 && <ul className="max-h-32 list-inside list-disc overflow-y-auto break-all text-xs text-slate-700">{confirmation.map((file) => <li key={file.id}>{file.originalFileName}</li>)}</ul>}
              {progress && <p role="status" className="text-sm">{progress}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void cancel()} disabled={!!busyId} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busyId ? '확인 및 취소 중…' : confirmation.length === 1 ? '확인, 업로드 취소' : `확인, ${confirmation.length}건 업로드 취소`}</button>
                <button type="button" onClick={() => setConfirmation([])} disabled={!!busyId} className="rounded-lg border bg-white px-4 py-2 text-sm">돌아가기</button>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showCancelled} disabled={!!busyId} onChange={(event) => setShowCancelled(event.target.checked)} />취소 내역도 보기</label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="취소 가능한 내역 전체 선택" checked={selectable.length > 0 && selectedFiles.length === selectable.length} disabled={loading || !!busyId || confirmation.length > 0 || !selectable.length} onChange={(event) => setSelectedIds(event.target.checked ? selectable.map((file) => file.id) : [])} />전체 선택 ({selectedFiles.length}/{selectable.length}건)</label>
            <button type="button" onClick={() => openConfirmation(selectedFiles)} disabled={loading || !!busyId || confirmation.length > 0 || !selectedFiles.length} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">선택한 {selectedFiles.length}건 업로드 취소</button>
          </div>
          {loading ? <p role="status">업로드 내역을 불러오는 중…</p> : visible.length === 0 ? <p className="py-6 text-center text-slate-500">이 월에는 표시할 업로드 내역이 없습니다.</p> : (
            <ul className="divide-y rounded-xl border">
              {visible.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  {file.status !== 'cancelled' && <input type="checkbox" aria-label={`${file.originalFileName} 선택`} checked={selectedIds.includes(file.id)} disabled={!canSelect(file) || !!busyId || confirmation.length > 0} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id))} />}
                  <div className="min-w-0 flex-1">
                    <div className="break-all text-sm font-bold text-slate-800">{file.originalFileName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {file.createdAt?.seconds ? new Date(file.createdAt.seconds * 1000).toLocaleString('ko-KR') : '등록일 미확인'} · {statusLabels[file.status] || file.status}
                    </div>
                  </div>
                  {file.status !== 'cancelled' && <button type="button" aria-label={`${file.originalFileName} 업로드 취소`} onClick={() => openConfirmation([file])} disabled={!!busyId || confirmation.length > 0 || !canSelect(file)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">업로드 취소</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
