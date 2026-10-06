import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Loader2, RefreshCw, Search, Sparkles } from 'lucide-react';
import CardStatementFilesDialog from '../../components/card/CardStatementFilesDialog';
import CardStatementBulkAnalysisPanel from '../../components/card/CardStatementBulkAnalysisPanel';
import SupportWorkspaceHeader, { supportWorkspacePaths, type SupportTabId } from '../../components/support/SupportWorkspaceHeader';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementFileDetailPayload, CardStatementImportFile } from '../../types/cardStatementImport';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { getSupportManagementYearMonth, rememberSupportManagementYearMonth } from '../../utils/supportManagementState';

const categoryLabels: Record<string, string> = {
  FUEL: '유류비', TOLL: '통행료', MEAL: '식비', MATERIAL: '자재비', OTHER: '기타',
};
const fileStatusLabels: Record<string, string> = {
  uploading: '업로드 중', uploaded: '미분석', analyzing: '분석 중', completed: '저장됨', failed: '처리 실패', cancelled: '취소됨',
};
const detailStatusLabels: Record<string, string> = {
  not_analyzed: '상세 분석 전', analyzing: '상세 분석 중', completed: '상세 저장됨', failed: '상세 분석 실패',
};
const PAGE_SIZE = 100;
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const validMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const fileSearchParams = (yearMonth: string, file: CardStatementImportFile): Record<string, string> => (
  !file.jobId && file.storagePath
    ? { month: yearMonth, storagePath: file.storagePath, fileName: file.originalFileName }
    : { month: yearMonth, fileId: file.id }
);
const errorMessage = (cause: unknown, fallback: string) => {
  const code = String((cause as { code?: string })?.code || '');
  if (['functions/unauthenticated', 'functions/permission-denied', 'unauthenticated', 'permission-denied'].includes(code)) return '현재 계정으로 명세서를 조회할 수 없습니다. 실제 로그인 계정과 명세서 접근 설정을 확인해 주세요.';
  if (code === 'functions/not-found') return '명세서 상세내역 기능을 서버에서 찾을 수 없습니다. 서버 적용 상태를 확인해 주세요.';
  if (code === 'functions/deadline-exceeded') return '분석 응답이 지연되고 있습니다. 잠시 후 새로고침해 저장된 결과를 확인해 주세요.';
  const message = cause instanceof Error ? cause.message : '';
  if (!message || /^(internal|unavailable|unknown)$/i.test(message)) return `${fallback} 잠시 후 다시 시도해 주세요.`;
  return message;
};

export const CardStatementDetailsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const devAdminSession = isDevAdminSessionEnabled();
  const realAccountParams = new URLSearchParams(searchParams);
  realAccountParams.set('devAdmin', '0');
  const realAccountHref = `${location.pathname}?${realAccountParams.toString()}`;
  const monthParam = searchParams.get('month');
  const [initialMonth] = useState(getSupportManagementYearMonth);
  const yearMonth = validMonth(monthParam) ? monthParam : initialMonth;
  const fileId = searchParams.get('fileId') || '';
  const storagePath = searchParams.get('storagePath') || '';
  const originalFileName = searchParams.get('fileName') || '';
  const selectionKey = `${yearMonth}:${fileId || storagePath}`;
  const hasSelection = !!(fileId || storagePath);
  const [files, setFiles] = useState<CardStatementImportFile[]>([]);
  const [filesMonth, setFilesMonth] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [listRevision, setListRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; payload: CardStatementFileDetailPayload } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewingOriginal, setViewingOriginal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(0);
  const inFlight = useRef(false);
  const activeSelection = useRef(selectionKey);
  activeSelection.current = selectionKey;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setBulkBusy(false); }, [yearMonth]);

  const detail = loaded?.key === selectionKey ? loaded.payload : null;
  const input = useMemo(() => fileId
    ? { fileId, yearMonth }
    : { storagePath, yearMonth, ...(originalFileName ? { originalFileName } : {}) }, [fileId, storagePath, yearMonth, originalFileName]);
  const analyzing = analysisBusy || detail?.analysisStatus === 'analyzing';

  useEffect(() => {
    let active = true;
    setListLoading(true);
    setListError('');
    setFiles([]);
    cardStatementImportService.listStoredFiles(yearMonth)
      .then(items => { if (active) { setFiles(items.filter(file => file.status !== 'cancelled')); setFilesMonth(yearMonth); } })
      .catch(cause => { if (active) setListError(errorMessage(cause, '업로드한 명세서 목록을 불러오지 못했습니다.')); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [yearMonth, listRevision]);

  useEffect(() => {
    if (hasSelection || listLoading || filesMonth !== yearMonth || !files.length) return;
    setSearchParams(fileSearchParams(yearMonth, files[0]), { replace: true });
  }, [hasSelection, listLoading, files, filesMonth, yearMonth, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoaded(null);
    setDetailError('');
    setAnalysisError('');
    setNotice('');
    setViewingOriginal(false);
    setSearch('');
    setCategory('ALL');
    setPage(0);
    if (!hasSelection) { setDetailLoading(false); return () => { active = false; }; }
    setDetailLoading(true);
    cardStatementImportService.getFileDetail(input)
      .then(payload => { if (active) setLoaded({ key: selectionKey, payload }); })
      .catch(cause => { if (active) setDetailError(errorMessage(cause, '명세서 상세내역을 불러오지 못했습니다.')); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [hasSelection, input, selectionKey, detailRevision]);

  useEffect(() => {
    if (detail?.analysisStatus !== 'analyzing' || analysisBusy || bulkBusy) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const payload = await cardStatementImportService.getFileDetail(input);
        if (!active) return;
        setLoaded({ key: selectionKey, payload });
        setDetailError('');
        if (payload.analysisStatus === 'completed') {
          setNotice('분석한 상세내역을 저장했습니다. 다음 방문에도 다시 조회할 수 있습니다.');
          setListRevision(value => value + 1);
        }
        if (payload.analysisStatus !== 'analyzing') return;
      } catch {
        if (!active) return;
        setDetailError('분석 상태를 확인하지 못했습니다. 연결이 복구되면 자동으로 다시 확인합니다.');
      }
      timer = setTimeout(refresh, 4000);
    };
    timer = setTimeout(refresh, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [detail?.analysisStatus, analysisBusy, bulkBusy, input, selectionKey]);

  const analyze = async () => {
    if (!detail || bulkBusy || detail.analysisAvailable === false || inFlight.current || analyzing || detail.file.status === 'uploading' || detail.file.status === 'cancelled') return;
    inFlight.current = true;
    setAnalysisBusy(true);
    setAnalysisError('');
    setNotice('');
    const key = selectionKey;
    const stillActive = () => mounted.current && activeSelection.current === key;
    try {
      const payload = await cardStatementImportService.analyzeStoredFile(input);
      if (!stillActive()) return;
      setLoaded({ key, payload });
      if (payload.analysisStatus === 'completed') {
        setNotice('분석한 상세내역을 저장했습니다. 다음 방문에도 다시 조회할 수 있습니다.');
        try {
          const saved = await cardStatementImportService.getFileDetail(input);
          if (stillActive()) setLoaded({ key, payload: saved });
        } catch {
          if (stillActive()) setNotice('분석한 상세내역을 저장했습니다. 저장 내역의 재조회에 실패했으므로 새로고침으로 확인해 주세요.');
        }
      }
      if (stillActive()) setListRevision(value => value + 1);
    } catch (cause) {
      if (stillActive()) {
        setAnalysisError(errorMessage(cause, 'Gemini 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
        try {
          const saved = await cardStatementImportService.getFileDetail(input);
          if (stillActive()) setLoaded({ key, payload: saved });
        } catch { /* Keep the last loaded result available when the connection fails. */ }
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setAnalysisBusy(false);
    }
  };

  const transactions = useMemo(() => (detail?.results || []).flatMap(result => {
    const cardLabel = result.matchedCardLabel || result.cardName || (result.cardLast4 ? `카드 •••• ${result.cardLast4}` : '카드 미확인');
    const cardNumber = result.cardLast4 && !cardLabel.includes(result.cardLast4) ? ` •••• ${result.cardLast4}` : '';
    return (result.transactions || []).map((transaction, index) => ({
      ...transaction,
      rowKey: `${result.id}:${transaction.id || index}`,
      cardLabel: `${cardLabel}${cardNumber}`,
      holderName: result.holderName || '',
    }));
  }).sort((a, b) => a.date.localeCompare(b.date) || a.rowKey.localeCompare(b.rowKey)), [detail]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return transactions.filter(row => (category === 'ALL' || row.category === category) && (!term || [
      row.date, row.merchant, row.cardLabel, row.holderName, row.memo, row.amount, categoryLabels[row.category] || row.category,
    ].join(' ').toLocaleLowerCase().includes(term)));
  }, [transactions, search, category]);
  const totalAmount = transactions.reduce((sum, row) => sum + row.amount, 0);
  const filteredAmount = filtered.reduce((sum, row) => sum + row.amount, 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const warnings = Array.from(new Set([...(detail?.file.warnings || []), ...(detail?.results.flatMap(result => result.warnings || []) || [])]));
  const selectedFile = detail?.file || files.find(file => file.id === fileId || file.storagePath === storagePath);
  const selectedName = selectedFile?.originalFileName || originalFileName || '선택한 명세서';
  const isSaved = detail?.analysisStatus === 'completed';

  const handleYearMonthChange = (nextMonth: string) => {
    if (analysisBusy || bulkBusy || !validMonth(nextMonth)) return;
    rememberSupportManagementYearMonth(nextMonth);
    setSearchParams({ month: nextMonth });
  };

  const handleTabChange = (tab: SupportTabId) => {
    rememberSupportManagementYearMonth(yearMonth);
    navigate(`${supportWorkspacePaths[tab]}?view=ledger&month=${yearMonth}`);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 px-3 pb-6 pt-0 sm:px-5 xl:px-6">
      <div className="w-full max-w-none min-w-0 space-y-3">
        <SupportWorkspaceHeader
          activeTab="card"
          onTabChange={handleTabChange}
          yearMonth={yearMonth}
          onYearMonthChange={handleYearMonthChange}
          monthDisabled={analysisBusy || bulkBusy}
        />
    <main className="mx-auto max-w-[1600px] space-y-5 py-2">
      <Link to={`/support/cards?view=ledger&month=${yearMonth}`} onClick={() => rememberSupportManagementYearMonth(yearMonth)} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-indigo-700"><ArrowLeft size={16} aria-hidden="true" />카드 통합관리대장</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-indigo-600"><FileText size={16} aria-hidden="true" />CARD STATEMENTS</div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">카드 명세서 상세내역</h1><p className="mt-2 text-sm text-slate-500">업로드한 명세서를 Gemini로 분석하고, 저장된 카드별 이용내역을 확인하세요.</p></div>
        <div className="flex items-end gap-2">
          <button type="button" disabled={analysisBusy || bulkBusy || listLoading || detailLoading} onClick={() => { setListRevision(value => value + 1); setDetailRevision(value => value + 1); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"><RefreshCw size={15} aria-hidden="true" />새로고침</button>
        </div>
      </header>

      {devAdminSession && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>개발용 화면으로 보고 있습니다. 실제 명세서 조회에는 서버에 로그인된 계정이 사용됩니다.</p><a href={realAccountHref} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold">실제 계정으로 돌아가기</a></div>}

      <CardStatementBulkAnalysisPanel key={yearMonth} yearMonth={yearMonth} files={files} disabled={analysisBusy || listLoading || !!listError || filesMonth !== yearMonth || detail?.analysisAvailable === false}
        onRunningChange={setBulkBusy}
        onFile={payload => {
          const updatedFile = { ...payload.file, detailAnalysisStatus: payload.analysisStatus, transactionCount: payload.results.reduce((sum, result) => sum + (result.transactions?.length || 0), 0) };
          setFiles(current => current.map(file => file.id === updatedFile.id || file.storagePath === updatedFile.storagePath ? updatedFile : file).filter(file => file.status !== 'cancelled'));
          if (payload.file.id === fileId || (!!storagePath && payload.file.storagePath === storagePath)) setLoaded({ key: selectionKey, payload });
        }}
        onComplete={() => { setListRevision(value => value + 1); setDetailRevision(value => value + 1); }} />

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-4"><h2 className="font-extrabold text-slate-900">업로드한 명세서 <span className="ml-1 text-sm text-indigo-600">{files.length}</span></h2><p className="mt-1 text-xs text-slate-500">{yearMonth}에 등록한 파일</p></div>
          {listLoading && <p role="status" className="p-5 text-sm text-slate-500">명세서 목록을 불러오는 중…</p>}
          {listError && <div role="alert" className="m-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><p>{listError}</p><button type="button" onClick={() => setListRevision(value => value + 1)} className="mt-2 font-bold underline">목록 다시 불러오기</button></div>}
          {!listLoading && !listError && !files.length && <p className="p-5 text-sm leading-6 text-slate-500">이 월에 등록된 명세서가 없습니다. 카드 통합관리대장에서 PDF를 업로드하세요.</p>}
          <ul aria-label="업로드한 명세서 목록" className="max-h-[600px] overflow-y-auto p-2">
            {files.map(file => {
              const selected = file.id === fileId || (!!storagePath && file.storagePath === storagePath);
              return <li key={file.id}><button type="button" aria-label={`${file.originalFileName} 상세내역`} aria-pressed={selected} disabled={analysisBusy || bulkBusy} onClick={() => setSearchParams(fileSearchParams(yearMonth, file))} className={`mb-1 w-full rounded-xl p-3 text-left transition disabled:opacity-50 ${selected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50'}`}><div className="flex items-start gap-2"><FileText className={`mt-0.5 shrink-0 ${selected ? 'text-indigo-600' : 'text-slate-400'}`} size={18} aria-hidden="true" /><span className="break-all text-sm font-bold text-slate-800">{file.originalFileName}</span></div><div className="mt-2 flex justify-between gap-2 pl-6 text-xs text-slate-500"><span>{file.detailAnalysisStatus ? detailStatusLabels[file.detailAnalysisStatus] : file.analysisSource === 'fast_text' ? '상세 분석 전' : fileStatusLabels[file.status] || file.status}</span><span>{file.analysisSource === 'fast_text' && !file.detailAnalysisStatus ? 0 : file.transactionCount || 0}건</span></div></button></li>;
            })}
          </ul>
        </aside>

        <section aria-label="선택한 명세서 상세내역" className="min-w-0 space-y-4">
          {!hasSelection && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center"><FileText className="mx-auto mb-4 text-slate-300" size={40} aria-hidden="true" /><h2 className="font-bold text-slate-700">명세서를 선택해 주세요</h2><p className="mt-2 text-sm text-slate-500">파일을 선택하면 저장된 이용내역을 확인할 수 있습니다.</p></div>}
          {detailLoading && <div role="status" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} aria-hidden="true" />저장된 상세내역을 불러오는 중…</div>}
          {detailError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><p>{detailError}</p><button type="button" disabled={analysisBusy || bulkBusy} onClick={() => setDetailRevision(value => value + 1)} className="mt-2 font-bold underline disabled:opacity-40">상세내역 다시 불러오기</button></div>}
          {detail && <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-bold ${isSaved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{analyzing ? 'Gemini 분석 중' : isSaved ? '상세내역 저장됨' : detail.analysisStatus === 'failed' ? '분석 실패' : '분석 전'}</span><span className="text-slate-500">{detail.file.statementMonth || yearMonth} 명세서</span></div><h2 className="break-all text-lg font-extrabold text-slate-900">{selectedName}</h2><p className="mt-2 text-xs leading-5 text-slate-500">카드사와 카드별 이용내역을 추출해 보관합니다. 상세 분석 결과는 통합관리대장의 청구 금액과 별도로 저장됩니다.</p></div>
                <div className="flex flex-wrap gap-2"><button type="button" disabled={!detail.file.storagePath} onClick={() => setViewingOriginal(true)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40">원본 열기</button><button type="button" onClick={() => void analyze()} disabled={bulkBusy || detail.analysisAvailable === false || analyzing || ['uploading', 'cancelled'].includes(detail.file.status)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{analyzing ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{analyzing ? '분석 및 저장 중…' : isSaved ? 'Gemini 재분석 및 저장' : 'Gemini 분석 및 저장'}</button></div>
              </div>
              {detail.readNotice && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">{detail.readNotice} 새로고침으로 연결 상태를 다시 확인할 수 있습니다.</p>}
              {analyzing && <p role="status" className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm leading-6 text-indigo-800">원본에서 이용내역을 추출하고 있습니다. 파일 크기에 따라 몇 분 정도 걸릴 수 있으며, 완료되면 자동으로 저장합니다.</p>}
              {notice && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 shrink-0" size={16} aria-hidden="true" />{notice}</p>}
              {(analysisError || detail.analysisStatus === 'failed') && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{analysisError || detail.analysisError || '분석에 실패했습니다. 원본을 확인한 후 다시 분석해 주세요.'}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">전체 이용내역</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{transactions.length.toLocaleString('ko-KR')}<span className="ml-1 text-sm font-medium text-slate-500">건</span></p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">이용내역 합계</p><p className="mt-2 text-2xl font-extrabold text-indigo-700">{won(totalAmount)}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">명세서 카드</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{detail.results.length}<span className="ml-1 text-sm font-medium text-slate-500">개</span></p></div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">AI가 추출한 날짜·가맹점·금액·분류는 원본 명세서와 대조해 주세요. 취소·할인·수수료·할부에 따라 이용내역 합계와 청구 총액이 다를 수 있습니다.{typeof detail.file.grandTotalAmount === 'number' && <span className="ml-1 font-bold">명세서 청구 총액: {won(detail.file.grandTotalAmount)}</span>}{warnings.length > 0 && <details className="mt-1"><summary className="cursor-pointer font-bold">분석 확인사항 {warnings.length}개</summary><ul className="mt-1 list-inside list-disc">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}</div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
                <label className="min-w-[180px] flex-1 text-xs font-bold text-slate-600" htmlFor="statement-search">이용내역 검색<span className="relative mt-1.5 block"><Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input id="statement-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="가맹점, 카드, 날짜, 메모 검색" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-normal" /></span></label>
                <label className="text-xs font-bold text-slate-600" htmlFor="statement-category">분류<select id="statement-category" value={category} onChange={event => { setCategory(event.target.value); setPage(0); }} className="mt-1.5 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="ALL">전체 분류</option>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-xs text-slate-600"><span>조회 결과 <strong className="text-slate-900">{filtered.length.toLocaleString('ko-KR')}건</strong></span><span>조회 결과 합계 <strong className="ml-1 text-sm text-slate-900">{won(filteredAmount)}</strong></span></div>
              {visibleRows.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><caption className="sr-only">명세서의 저장된 카드 이용 상세내역</caption><thead className="border-y border-slate-100 text-xs text-slate-500"><tr>{['이용일', '가맹점', '카드', '분류', '금액', '메모'].map(label => <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 font-bold ${label === '금액' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map(row => <tr key={row.rowKey} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.date || '날짜 미확인'}</td><td className="max-w-[260px] break-words px-4 py-3 font-bold text-slate-800">{row.merchant || '가맹점 미확인'}{row.confidence < 0.8 && <span className="ml-1.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">원본 확인</span>}</td><td className="max-w-[220px] break-words px-4 py-3 text-slate-600">{row.cardLabel}{row.holderName && <span className="mt-0.5 block text-xs text-slate-400">{row.holderName}</span>}</td><td className="whitespace-nowrap px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{categoryLabels[row.category] || row.category || '미분류'}</span></td><td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${row.amount < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{won(row.amount)}</td><td className="max-w-[260px] break-words px-4 py-3 text-xs leading-5 text-slate-500">{row.memo || '—'}</td></tr>)}</tbody></table></div> : <div className="p-12 text-center text-sm leading-6 text-slate-500">{transactions.length ? '검색 조건에 맞는 이용내역이 없습니다.' : analyzing ? '분석이 완료되면 상세 이용내역이 여기에 표시됩니다.' : detail.analysisAvailable === false ? '저장된 상세 이용내역이 없습니다. 새 분석 기능이 연결되면 이 파일을 분석할 수 있습니다.' : isSaved ? '저장된 상세 이용내역이 없습니다. 원본을 확인하거나 Gemini로 다시 분석해 주세요.' : '아직 분석된 상세내역이 없습니다. 위의 Gemini 분석 및 저장 버튼을 눌러 주세요.'}</div>}
              {pageCount > 1 && <nav aria-label="상세내역 페이지" className="flex items-center justify-end gap-3 border-t border-slate-100 p-3 text-sm"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">이전</button><span className="text-slate-500">{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">다음</button></nav>}
            </div>
          </>}
        </section>
      </div>
      {viewingOriginal && detail?.file.storagePath && <CardStatementFilesDialog paths={[detail.file.storagePath]} fileNames={{ [detail.file.storagePath]: selectedName }} title="카드 명세서 원본" onClose={() => setViewingOriginal(false)} />}
    </main>
      </div>
    </div>
  );
};

export default CardStatementDetailsPage;
