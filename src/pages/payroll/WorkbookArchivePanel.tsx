import React, { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ChevronRight, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { workbookArchiveService, WorkbookArchive } from '../../features/delegated-receipts/workbookArchiveService';
import type { UnclassifiedSourceRow } from '../../features/delegated-receipts/workbookImport';

export type ArchiveService = typeof workbookArchiveService;

interface Props {
  service: ArchiveService;
  archives: WorkbookArchive[];
  loading: boolean;
  error: string;
  onReload: () => void;
  onSelectMonth: (month: string) => void;
}

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const dateLabel = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export function SourceReviewRows({ rows }: { rows: UnclassifiedSourceRow[] }) {
  return <div className="dr-review-rows">{rows.map((row) => <article className="dr-review-row" key={row.id}>
    <div className="dr-review-heading"><strong>{row.workerName || '작업자 미확인'}</strong><span>분류 대기</span></div>
    <p className="dr-review-reason">{row.reason}</p>
    <dl><div><dt>원본 위치</dt><dd>{row.sourceLabel}</dd></div><div><dt>원본 제목</dt><dd>{row.sourceTitle || '제목 없음'}</dd></div><div><dt>세전 금액</dt><dd>{row.grossAmount === null ? '미확인' : `${row.grossAmount.toLocaleString('ko-KR')}원`}</dd></div><div><dt>원본 입금 표시</dt><dd>{row.sourceStatus || '표시 없음'}</dd></div></dl>
    <details><summary>원본 셀 {row.rawCells.length}개 확인</summary><div className="dr-raw-cells">{row.rawCells.map((cell) => <div key={cell.address}><b>{cell.address}</b><span>{String(cell.value ?? '') || '(빈 값)'}{cell.formattedText && cell.formattedText !== String(cell.value ?? '') && <small>표시: {cell.formattedText}</small>}{cell.formula && <small>수식: {cell.formula}</small>}{cell.comment && <small>메모: {cell.comment}</small>}</span></div>)}</div></details>
  </article>)}</div>;
}

export default function WorkbookArchivePanel({ service, archives, loading, error, onReload, onSelectMonth }: Props) {
  const [selected, setSelected] = useState<WorkbookArchive | null>(null);
  const [rows, setRows] = useState<UnclassifiedSourceRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState('');
  const [downloadId, setDownloadId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [reviewReload, setReviewReload] = useState(0);
  const downloading = useRef(false);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setRows([]); setRowsError(''); setRowsLoading(true);
    service.listReviewRows(selected.id).then((data) => { if (!cancelled) setRows(data); }).catch(() => { if (!cancelled) setRowsError('분류 대기 내역을 불러오지 못했습니다. 다시 시도해 주세요.'); }).finally(() => { if (!cancelled) setRowsLoading(false); });
    return () => { cancelled = true; };
  }, [selected, service, reviewReload]);

  const download = async (archive: WorkbookArchive) => {
    if (downloading.current) return;
    downloading.current = true; setDownloadId(archive.id); setDownloadError('');
    try {
      const bytes = await service.downloadOriginal(archive.id);
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: archive.fileName.toLowerCase().endsWith('.xls') ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = archive.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError('원본 파일을 내려받지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { downloading.current = false; setDownloadId(''); }
  };

  return <div className="dr-modal-body dr-archive-panel">
    <p className="dr-archive-intro">엑셀 원본 전체와 분류 대기 행을 함께 보관합니다. 원본의 모든 시트·수식·메모·서식은 다운로드한 파일에서 그대로 확인할 수 있습니다.</p>
    {downloadError && <p role="alert" className="dr-form-error">{downloadError}</p>}
    {selected ? <>
      <button className="dr-text-button dr-archive-back" onClick={() => setSelected(null)}><ArrowLeft size={15} />보관 목록으로</button>
      <div className="dr-archive-detail-heading"><h3>{selected.fileName}</h3><span>분류 대기 {selected.reviewRowCount.toLocaleString('ko-KR')}건</span></div>
      <p className="dr-form-help">월·현장·작업자·금액의 확인이 필요한 자료입니다. 원본 그대로 보관하며 입금 현황 합계에 임의로 포함하지 않습니다.</p>
      {rowsLoading ? <div className="dr-empty" role="status"><RefreshCw size={22} className="dr-spin" /><p>분류 대기 내역을 불러오고 있습니다.</p></div> : rowsError ? <div className="dr-alert" role="alert"><span>{rowsError}</span><button className="dr-button" onClick={() => setReviewReload((value) => value + 1)}>다시 시도</button></div> : rows.length > 0 ? <SourceReviewRows rows={rows} /> : <div className="dr-empty"><p>분류 대기 내역이 없습니다.</p></div>}
    </> : <>
      <div className="dr-section-title"><h3>저장된 원본 {archives.length}개</h3><button className="dr-button" onClick={onReload} disabled={loading}><RefreshCw size={14} />목록 새로고침</button></div>
      {loading ? <div className="dr-empty" role="status"><RefreshCw size={23} className="dr-spin" /><p>원본 보관함을 불러오고 있습니다.</p></div> : error ? <div className="dr-alert" role="alert"><span>{error}</span><button className="dr-button" onClick={onReload}>다시 시도</button></div> : archives.length === 0 ? <div className="dr-empty"><Archive size={30} /><h3>아직 보관한 원본이 없습니다</h3><p>엑셀 가져오기에서 확인 후 저장하면 원본과 분류 대기 행도 함께 보관됩니다.</p></div> : <div className="dr-archive-list">{archives.map((archive) => <article key={archive.id} className="dr-archive-card">
        <div className="dr-archive-card-heading"><FileSpreadsheet size={21} /><div><h3>{archive.fileName}</h3><p>{dateLabel(archive.createdAt)} · {formatBytes(archive.byteLength)}</p></div><span className={`dr-badge ${archive.status === 'complete' ? 'dr-badge-paid' : 'dr-badge-unpaid'}`}>{archive.status === 'complete' ? '원본 보관 완료' : '저장 확인 필요'}</span></div>
        <div className="dr-archive-counts"><span>월별 관리 <strong>{archive.claimCount.toLocaleString('ko-KR')}건</strong></span><span>분류 대기 <strong>{archive.reviewRowCount.toLocaleString('ko-KR')}건</strong></span><span>전체 시트 <strong>{archive.sheetSummaries.length}개</strong></span></div>
        {archive.status !== 'complete' && <p className="dr-form-help dr-text-amber">일부 저장이 완료되지 않았습니다. 같은 파일을 다시 가져오면 이미 저장된 내역을 유지하며 이어서 저장합니다.</p>}
        <div className="dr-archive-months" aria-label={`${archive.fileName} 저장된 귀속월`}>{[...archive.months].sort().reverse().map((month) => <button key={month} onClick={() => onSelectMonth(month)} aria-label={`${month} 저장 내역 보기`}>{month}<ChevronRight size={12} /></button>)}</div>
        <details className="dr-archive-sheet-details"><summary>시트별 보관 내역 확인</summary><div>{archive.sheetSummaries.map((sheet) => <p key={sheet.name}><strong>{sheet.name}</strong><span>입력 셀 {sheet.populatedCells.toLocaleString('ko-KR')}개 · 관리 {sheet.claimCount.toLocaleString('ko-KR')}건 · 분류 대기 {sheet.reviewRowCount.toLocaleString('ko-KR')}건</span></p>)}</div></details>
        {archive.warnings.length > 0 && <details className="dr-archive-sheet-details"><summary>가져오기 안내 {archive.warnings.length}건</summary><ul>{archive.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        <div className="dr-archive-actions"><button className="dr-button" onClick={() => { setSelected(archive); setDownloadError(''); }}>분류 대기 내역 {archive.reviewRowCount}건 보기<ChevronRight size={14} /></button><button className="dr-button" disabled={!!downloadId || archive.status !== 'complete'} onClick={() => void download(archive)}><Download size={14} />{downloadId === archive.id ? '내려받는 중…' : '원본 다운로드'}</button></div>
      </article>)}</div>}
    </>}
  </div>;
}
