import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FileText, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import { getCardStatementFileName } from '../../services/cardStatementAttachmentService';
import type { CardStatementFileDetailPayload } from '../../types/cardStatementImport';
import { getCardStatementResults } from '../../utils/cardStatementReconciliation';
import CardStatementFilesDialog from './CardStatementFilesDialog';
import CardStatementReconciliation from './CardStatementReconciliation';

export interface CardStatementUsageDialogProps {
  yearMonth: string;
  cardId: string;
  cardLast4: string;
  cardName: string;
  ledgerTotal?: number;
  paths: string[];
  onClose: () => void;
}

interface FileState { loading: boolean; payload?: CardStatementFileDetailPayload; error?: string; }
const categories: Record<string, string> = { FUEL: '유류비', TOLL: '통행료', MEAL: '식비', MATERIAL: '자재비', OTHER: '기타' };
const statusLabels = { not_analyzed: '미분석', analyzing: '분석 중', completed: '분석 저장됨', failed: '분석 실패' };
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const PAGE_SIZE = 100;
const message = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '');
  if (/unauthenticated|permission-denied/.test(code)) return '명세서를 조회할 권한을 확인할 수 없습니다. 실제 로그인 계정을 확인해 주세요.';
  if (/deadline-exceeded/.test(code)) return '분석 응답이 지연되고 있습니다. 새로고침으로 저장된 결과를 확인해 주세요.';
  if (/not-found/.test(code)) return '명세서 또는 분석 기능을 찾을 수 없습니다. 원본 파일과 서버 적용 상태를 확인해 주세요.';
  const text = error instanceof Error ? error.message : '';
  return text && !/^(internal|unknown|unavailable)$/i.test(text) ? text : '명세서 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
};

const CardStatementUsageDialog: React.FC<CardStatementUsageDialogProps> = ({ yearMonth, cardId, cardLast4, cardName, ledgerTotal, paths, onClose }) => {
  const pathKey = JSON.stringify(Array.from(new Set(paths.map(path => path.trim()).filter(Boolean))));
  const files = useMemo<string[]>(() => JSON.parse(pathKey), [pathKey]);
  const scopeKey = `${yearMonth}:${cardId}:${cardLast4}:${pathKey}`;
  const [selected, setSelected] = useState(() => files[files.length - 1] || '');
  const activePath = files.includes(selected) ? selected : files[files.length - 1] || '';
  const [loaded, setLoaded] = useState<{ key: string; files: Record<string, FileState> }>({ key: '', files: {} });
  const fileStates = loaded.key === scopeKey ? loaded.files : {};
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<{ key: string; path: string } | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; path: string; error?: string; notice?: string } | null>(null);
  const [viewingOriginal, setViewingOriginal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(0);
  const mounted = useRef(true);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const requestSequence = useRef(0);
  const requestIds = useRef<Record<string, number>>({});
  const analysisInFlight = useRef(false);
  const busyPath = busy?.key === scopeKey ? busy.path : '';
  const selectedState = fileStates[activePath];
  const detail = selectedState?.payload;
  const selectedName = detail?.file.originalFileName || getCardStatementFileName(activePath);
  const currentFeedback = feedback?.key === scopeKey && feedback.path === activePath ? feedback : null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const updateFile = useCallback((path: string, state: FileState) => {
    if (!mounted.current || activeScope.current !== scopeKey) return;
    setLoaded(current => ({ key: scopeKey, files: { ...(current.key === scopeKey ? current.files : {}), [path]: state } }));
  }, [scopeKey]);

  const readFile = useCallback(async (path: string) => {
    const id = ++requestSequence.current;
    requestIds.current[path] = id;
    updateFile(path, { loading: true });
    const isCurrent = () => mounted.current && activeScope.current === scopeKey && requestIds.current[path] === id;
    try {
      const payload = await cardStatementImportService.getFileDetail({ storagePath: path, yearMonth });
      if (isCurrent()) updateFile(path, { loading: false, payload });
    } catch (cause) {
      if (isCurrent()) updateFile(path, { loading: false, error: message(cause) });
    }
  }, [scopeKey, updateFile, yearMonth]);

  useEffect(() => {
    setLoaded({ key: scopeKey, files: {} });
    setFeedback(null);
    files.forEach(path => { void readFile(path); });
  }, [scopeKey, files, readFile, revision]);

  useEffect(() => { setSearch(''); setCategory('ALL'); setPage(0); setViewingOriginal(false); }, [activePath, scopeKey]);

  useEffect(() => {
    const pending = files.filter(path => fileStates[path]?.payload?.analysisStatus === 'analyzing' && path !== busyPath);
    if (!pending.length) return;
    const timer = setTimeout(() => pending.forEach(path => { void readFile(path); }), 3000);
    return () => clearTimeout(timer);
  }, [files, fileStates, busyPath, readFile]);

  const analyze = async () => {
    if (!detail || detail.analysisAvailable === false || selectedState?.loading || analysisInFlight.current || busyPath || detail.analysisStatus === 'analyzing' || ['uploading', 'cancelled'].includes(detail.file.status)) return;
    analysisInFlight.current = true;
    const path = activePath;
    const id = ++requestSequence.current;
    requestIds.current[path] = id;
    const isCurrent = () => mounted.current && activeScope.current === scopeKey && requestIds.current[path] === id;
    setBusy({ key: scopeKey, path });
    setFeedback(null);
    const input = { storagePath: path, yearMonth };
    try {
      const payload = await cardStatementImportService.analyzeStoredFile(input);
      if (!isCurrent()) return;
      updateFile(path, { loading: false, payload });
      if (payload.analysisStatus === 'completed') {
        setFeedback({ key: scopeKey, path, notice: '분석한 상세내역을 저장했습니다.' });
        try {
          const saved = await cardStatementImportService.getFileDetail(input);
          if (isCurrent()) updateFile(path, { loading: false, payload: saved });
        } catch {
          if (isCurrent()) setFeedback({ key: scopeKey, path, notice: '분석 결과를 저장했으나 재조회에 실패했습니다. 새로고침으로 확인해 주세요.' });
        }
      }
    } catch (cause) {
      if (isCurrent()) {
        const error = message(cause);
        updateFile(path, { loading: false, payload: { ...detail, analysisStatus: 'failed', analysisError: error } });
        setFeedback({ key: scopeKey, path, error });
      }
    } finally {
      analysisInFlight.current = false;
      if (mounted.current) setBusy(current => current?.key === scopeKey && current.path === path ? null : current);
    }
  };

  const whole = useMemo(() => {
    const seen = new Set<string>();
    const results = [] as NonNullable<CardStatementFileDetailPayload['results']>;
    let complete = files.length > 0;
    let duplicates = 0;
    let missingCards = 0;
    for (const path of files) {
      const state = fileStates[path];
      if (!state?.payload || state.loading || state.error) { complete = false; continue; }
      const payload = state.payload;
      if (['uploading', 'cancelled'].includes(payload.file.status)) { complete = false; continue; }
      const sourceHashes = Array.from(new Set(payload.results.map(result => result.sourceSha256).filter(Boolean)));
      const hash = payload.file.sha256 || (sourceHashes.length === 1 ? sourceHashes[0] : '');
      const identity = hash ? `hash:${hash}` : payload.file.storagePath ? `path:${payload.file.storagePath}` : path;
      if (seen.has(identity)) { duplicates += 1; continue; }
      seen.add(identity);
      const matched = getCardStatementResults(payload.results, cardId, cardLast4);
      if (!matched.length) { missingCards += 1; complete = false; }
      if (payload.analysisStatus !== 'completed' || matched.some(result => result.status === 'failed') || busyPath === path) complete = false;
      results.push(...matched);
    }
    return { results, complete, duplicates, missingCards };
  }, [files, fileStates, cardId, cardLast4, busyPath]);

  const matchingResults = useMemo(() => detail && !['uploading', 'cancelled'].includes(detail.file.status) ? getCardStatementResults(detail.results, cardId, cardLast4) : [], [detail, cardId, cardLast4]);
  const transactions = useMemo(() => matchingResults.flatMap(result => (result.transactions || []).map((row, index) => ({ ...row, rowKey: `${result.id}:${row.id || index}` }))).sort((a, b) => a.date.localeCompare(b.date) || a.rowKey.localeCompare(b.rowKey)), [matchingResults]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return transactions.filter(row => (category === 'ALL' || row.category === category) && (!term || [row.date, row.merchant, row.amount, row.memo, categories[row.category]].join(' ').toLocaleLowerCase().includes(term)));
  }, [transactions, category, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const warnings = Array.from(new Set([...(detail?.file.warnings || []), ...matchingResults.flatMap(result => result.warnings || [])]));
  const loadingCount = files.filter(path => !fileStates[path] || fileStates[path].loading).length;
  const failureCount = files.filter(path => !!fileStates[path]?.error).length;
  const selectedAnalyzing = busyPath === activePath || detail?.analysisStatus === 'analyzing';

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[95] bg-slate-900/50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[96] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div><Dialog.Title className="text-lg font-extrabold text-slate-900">{cardName} 사용내역 상세</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">{yearMonth} · 카드 {cardLast4 ? `•••• ${cardLast4}` : '번호 미확인'} · 연결된 PDF {files.length}개</Dialog.Description></div>
          <button type="button" onClick={onClose} aria-label="사용내역 상세 닫기" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">
          <CardStatementReconciliation results={whole.results} analysisStatus={whole.complete ? 'completed' : 'not_analyzed'} ledgerTotal={ledgerTotal} title="연결된 전체 PDF · 월 사용금액 대조" />
          {(loadingCount > 0 || failureCount > 0 || whole.missingCards > 0 || whole.duplicates > 0) && <div className="space-y-1 text-xs leading-5 text-slate-600" aria-live="polite">
            {loadingCount > 0 && <p>파일 {loadingCount}개의 저장된 분석 결과를 불러오는 중입니다. 현재 합계는 일부 내역일 수 있습니다.</p>}
            {failureCount > 0 && <p className="text-rose-700">파일 {failureCount}개를 조회하지 못했습니다. 전체 합계와 일치 여부는 미확인입니다.</p>}
            {whole.missingCards > 0 && <p className="text-amber-800">파일 {whole.missingCards}개에서 이 카드의 분석 결과를 확인하지 못했습니다. 카드 연결 또는 원본을 확인해 주세요.</p>}
            {whole.duplicates > 0 && <p>동일한 원본 PDF {whole.duplicates}개는 전체 합계에 중복 반영하지 않았습니다.</p>}
          </div>}
          {!files.length ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">연결된 PDF가 없습니다. 사용내역서에 카드 명세서를 업로드해 주세요.</p> : <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">상세 조회할 PDF<select aria-label="상세 조회할 PDF" value={activePath} onChange={event => setSelected(event.target.value)} className="mt-1 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800">{files.map(path => <option key={path} value={path}>{fileStates[path]?.payload?.file.originalFileName || getCardStatementFileName(path)} · {fileStates[path]?.error ? '조회 실패' : fileStates[path]?.loading ? '불러오는 중' : fileStates[path]?.payload ? statusLabels[fileStates[path].payload!.analysisStatus] : '대기'}</option>)}</select></label>
              <button type="button" disabled={!!busyPath || loadingCount > 0} onClick={() => setRevision(value => value + 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"><RefreshCw size={15} aria-hidden="true" />전체 새로고침</button>
              <button type="button" onClick={() => setViewingOriginal(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"><FileText size={15} aria-hidden="true" />원본 열기</button>
            </div>
            {selectedState?.error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>{selectedState.error}</p><button type="button" onClick={() => { void readFile(activePath); }} className="mt-2 font-bold underline">선택 파일 다시 불러오기</button></div>}
            {(!selectedState || selectedState.loading) && <p role="status" className="flex items-center gap-2 rounded-xl bg-white p-5 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} aria-hidden="true" />저장된 상세내역을 불러오는 중…</p>}
            {detail && <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="break-all text-sm font-bold text-slate-900">{selectedName}</h3><p className="mt-1 text-xs text-slate-500">{statusLabels[detail.analysisStatus]} · 아래 표는 선택한 PDF의 이 카드 내역만 표시합니다.</p></div><button type="button" disabled={!!busyPath || detail.analysisAvailable === false || selectedAnalyzing || ['uploading', 'cancelled'].includes(detail.file.status)} onClick={() => { void analyze(); }} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{selectedAnalyzing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{selectedAnalyzing ? '분석 및 저장 중…' : detail.analysisStatus === 'completed' ? '선택 PDF 재분석 및 저장' : '선택 PDF 분석 및 저장'}</button></div>
                <p className="mt-3 text-xs leading-5 text-slate-500">분석 버튼을 누르면 선택한 PDF를 Gemini로 분석하고 결과를 저장합니다. AI가 추출한 날짜·가맹점·금액은 원본과 확인해 주세요.</p>
                {detail.readNotice && <p className="mt-2 text-xs text-amber-800">{detail.readNotice}</p>}
                {detail.analysisAvailable === false && <p className="mt-2 text-xs text-amber-800">저장된 결과를 조회하고 있습니다. 분석 기능의 서버 연결이 필요합니다.</p>}
              </div>
              {currentFeedback?.notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{currentFeedback.notice}</p>}
              {(currentFeedback?.error || detail.analysisError) && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{currentFeedback?.error || detail.analysisError}</p>}
              {warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>원본 확인이 필요한 내용</strong><ul className="mt-1 list-disc pl-4">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
              {files.length > 1 && <CardStatementReconciliation results={matchingResults} analysisStatus={selectedAnalyzing ? 'analyzing' : detail.analysisStatus} title="선택한 PDF · 카드 금액 대조" />}
              <section aria-label="선택한 PDF 사용내역" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap gap-3 p-4"><label className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={16} aria-hidden="true" /><input aria-label="사용내역 검색" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="가맹점, 날짜, 금액, 메모 검색" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label><label className="sr-only" htmlFor="card-usage-category">분류</label><select id="card-usage-category" value={category} onChange={event => { setCategory(event.target.value); setPage(0); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="ALL">전체 분류</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div className="flex flex-wrap justify-between gap-2 bg-slate-100 px-4 py-3 text-xs text-slate-600"><span>선택 PDF 검색 결과 <strong>{filtered.length}건</strong></span><span>검색 결과 합계 <strong className="text-sm text-slate-900">{won(filtered.reduce((sum, row) => sum + row.amount, 0))}</strong></span></div>
                {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="sr-only">선택한 카드의 분석된 사용내역</caption><thead className="border-b border-slate-100 text-xs text-slate-500"><tr>{['이용일', '가맹점', '분류', '금액', '메모'].map(label => <th key={label} scope="col" className={`px-4 py-3 ${label === '금액' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(row => <tr key={row.rowKey}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.date || '날짜 미확인'}</td><td className="max-w-[260px] break-words px-4 py-3 font-bold text-slate-800">{row.merchant || '가맹점 미확인'}{row.confidence < 0.8 && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-700">원본 확인</span>}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{categories[row.category] || '미분류'}</td><td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${row.amount < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{won(row.amount)}</td><td className="max-w-[260px] break-words px-4 py-3 text-xs text-slate-500">{row.memo || '—'}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm leading-6 text-slate-500">{transactions.length ? '검색 조건에 맞는 사용내역이 없습니다.' : detail.analysisStatus === 'not_analyzed' ? '아직 분석된 상세내역이 없습니다. 선택 PDF 분석 및 저장 버튼을 눌러 주세요.' : selectedAnalyzing ? '분석이 완료되면 상세 사용내역을 확인할 수 있습니다.' : '이 카드의 상세 사용내역이 없습니다. 원본의 카드번호를 확인하거나 다시 분석해 주세요.'}</p>}
                {pageCount > 1 && <nav aria-label="사용내역 페이지" className="flex items-center justify-end gap-3 border-t border-slate-100 p-3 text-sm"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">이전</button><span>{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">다음</button></nav>}
              </section>
            </>}
          </>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
    {viewingOriginal && activePath && <CardStatementFilesDialog paths={[activePath]} fileNames={{ [activePath]: selectedName }} title="카드 명세서 원본" onClose={() => setViewingOriginal(false)} />}
  </Dialog.Root>;
};

export default CardStatementUsageDialog;
