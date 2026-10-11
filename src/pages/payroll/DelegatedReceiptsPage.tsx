import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDownLeft, ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleAlert, FileSpreadsheet, Plus, RefreshCw, Search, SlidersHorizontal, Wallet, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { canAccessErpCollection } from '../../security/erpAccessPolicy';
import { delegatedReceiptService, DelegatedReceiptImportError } from '../../features/delegated-receipts/service';
import { DelegatedClaim, DelegationType, PaymentMethod, Receipt, calculateExpectedAmount, filterClaims, getClaimTotals, summarizeClaims } from '../../features/delegated-receipts/model';
import { parseDelegatedWorkbook } from '../../features/delegated-receipts/workbookImport';
import { workbookArchiveService, WorkbookArchive } from '../../features/delegated-receipts/workbookArchiveService';
import WorkbookArchivePanel, { ArchiveService, SourceReviewRows } from './WorkbookArchivePanel';
import './DelegatedReceiptsPage.css';

const methodLabels: Record<PaymentMethod, string> = { transfer: '계좌이체', cash: '현금', other: '기타', unknown: '미확인' };
const delegationLabels: Record<DelegationType, string> = { delegate: '위임', direct: '직불', unknown: '미확인' };
const statusLabels = { unconfirmed: '금액 미확정', unpaid: '미입금', partial: '일부 입금', paid: '입금 완료', overpaid: '초과 입금' };
type ClaimStatus = keyof typeof statusLabels;
const won = (value: number | null) => value === null ? '미확정' : `${value.toLocaleString('ko-KR')}원`;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const createId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const moveMonth = (month: string, distance: number) => {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + distance, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const blankClaim = (month: string): DelegatedClaim => ({ id: createId(), month, siteName: '', workerName: '', delegationType: 'delegate', paymentMethod: 'unknown', grossAmount: null, expectedAmount: null, receipts: [], sourceStatus: '', sourceLabel: '직접 입력', memo: '', updatedAt: new Date().toISOString() });

function StatusBadge({ claim }: { claim: DelegatedClaim }) {
  const status = getClaimTotals(claim).status;
  return <span className={`dr-badge dr-badge-${status}`}><span aria-hidden="true" />{statusLabels[status]}</span>;
}

function Dialog({ title, subtitle, onClose, children, wide = false, busy = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean; busy?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <div className="dr-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialog} className={`dr-modal ${wide ? 'dr-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={(event) => {
      if (event.key === 'Escape' && !busy) closeRef.current();
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
      if (!elements?.length) { event.preventDefault(); return; }
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    }}>
      <header className="dr-modal-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="dr-icon-button" onClick={onClose} disabled={busy} aria-label="닫기"><X size={20} /></button></header>
      {children}
    </div>
  </div>;
}

interface WorkspaceProps { initialClaims?: DelegatedClaim[]; service?: typeof delegatedReceiptService; archiveService?: ArchiveService; canWrite?: boolean; }

export function DelegatedReceiptsWorkspace({ initialClaims, service = delegatedReceiptService, archiveService = workbookArchiveService, canWrite = true }: WorkspaceProps) {
  const [month, setMonth] = useState(() => initialClaims?.[0]?.month || today().slice(0, 7));
  const [claims, setClaims] = useState<DelegatedClaim[]>(initialClaims || []);
  const [loading, setLoading] = useState(!initialClaims);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [siteName, setSiteName] = useState('');
  const [worker, setWorker] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [delegationType, setDelegationType] = useState<DelegationType | ''>('');
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSites, setShowSites] = useState(false);
  const [selected, setSelected] = useState<DelegatedClaim | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expectedInput, setExpectedInput] = useState('');
  const [taxInput, setTaxInput] = useState('');
  const [grossInput, setGrossInput] = useState('');
  const [amountMode, setAmountMode] = useState<'manual' | 'tax'>('manual');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(today());
  const [receiptMethod, setReceiptMethod] = useState<PaymentMethod>('transfer');
  const [receiptMemo, setReceiptMemo] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingReceipt = useRef<{ signature: string; receipt: Receipt } | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof parseDelegatedWorkbook> | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [archives, setArchives] = useState<WorkbookArchive[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveRequested, setArchiveRequested] = useState(initialClaims === undefined);
  const [archivesLoading, setArchivesLoading] = useState(initialClaims === undefined);
  const [archivesError, setArchivesError] = useState('');
  const [archiveReload, setArchiveReload] = useState(0);
  const [importTax, setImportTax] = useState('');
  const [importDelegation, setImportDelegation] = useState<DelegationType>('unknown');
  const fileInput = useRef<HTMLInputElement>(null);
  const initialUsed = useRef(false);

  useEffect(() => {
    if (initialClaims && !initialUsed.current) { initialUsed.current = true; return; }
    let cancelled = false;
    setLoading(true); setError('');
    service.list(month).then((data) => { if (!cancelled) setClaims(data); }).catch(() => { if (!cancelled) { setClaims([]); setError('입금 내역을 불러오지 못했습니다. 연결과 조회 권한을 확인한 후 다시 시도해 주세요.'); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, reload, service, initialClaims]);

  useEffect(() => {
    if (!archiveRequested) return;
    let cancelled = false; setArchivesLoading(true); setArchivesError('');
    archiveService.listArchives().then((data) => { if (!cancelled) setArchives(data); }).catch(() => { if (!cancelled) setArchivesError('원본 보관 목록을 불러오지 못했습니다. 다시 시도해 주세요.'); }).finally(() => { if (!cancelled) setArchivesLoading(false); });
    return () => { cancelled = true; };
  }, [archiveService, archiveRequested, archiveReload]);
  const savedMonths = useMemo(() => Array.from(new Set(archives.filter((archive) => archive.status === 'complete').flatMap((archive) => archive.months))).sort().reverse(), [archives]);
  const openArchive = () => { setArchiveRequested(true); setArchiveOpen(true); };
  const selectArchivedMonth = (value: string) => { setMonth(value); resetFilters(); setArchiveOpen(false); setShowTools(false); };

  const filtered = useMemo(() => filterClaims(claims, { month, siteName, worker, paymentMethod: paymentMethod || undefined, delegationType: delegationType || undefined, status: status || undefined }), [claims, month, siteName, worker, paymentMethod, delegationType, status]);
  const summary = useMemo(() => summarizeClaims(filtered), [filtered]);
  const allUnconfirmed = summary.count > 0 && summary.unconfirmed === summary.count;
  const sites = useMemo(() => Array.from(new Set(claims.filter((claim) => claim.month === month).map((claim) => claim.siteName))).sort((a, b) => a.localeCompare(b, 'ko')), [claims, month]);
  const siteSummaries = useMemo(() => Array.from(new Set(filtered.map((claim) => claim.siteName))).map((name) => {
    const rows = filtered.filter((claim) => claim.siteName === name);
    const covered = rows.reduce((sum, claim) => sum + (claim.expectedAmount === null ? 0 : Math.min(claim.expectedAmount, getClaimTotals(claim).received)), 0);
    return { name, covered, ...summarizeClaims(rows) };
  }).sort((a, b) => b.remaining - a.remaining), [filtered]);
  const availableMonths = useMemo(() => Array.from(new Set(preview?.claims.map((claim) => claim.month) || [])).sort(), [preview]);
  const paidCount = filtered.filter((claim) => ['paid', 'overpaid'].includes(getClaimTotals(claim).status)).length;
  const activeFilterCount = [siteName, worker, paymentMethod, status, delegationType].filter(Boolean).length;
  const unknownCount = claims.filter((claim) => claim.month === month && claim.delegationType === 'unknown').length;
  const delegationSummary = summarizeClaims(filtered.filter((claim) => claim.delegationType === 'delegate'));
  const directSummary = summarizeClaims(filtered.filter((claim) => claim.delegationType === 'direct'));
  const calculatedAmount = useMemo(() => {
    if (amountMode !== 'tax' || grossInput === '' || taxInput === '') return null;
    try { return calculateExpectedAmount(Number(grossInput), Number(taxInput)); } catch { return null; }
  }, [amountMode, grossInput, taxInput]);
  const preparedImport = useMemo(() => {
    if (!preview) return [];
    return preview.claims.map((claim) => {
      const delegationType = claim.delegationType === 'unknown' ? importDelegation : claim.delegationType;
      if (importTax.trim() === '' || claim.grossAmount === null) return { ...claim, delegationType };
      try { return { ...claim, delegationType, taxRate: Number(importTax), ...calculateExpectedAmount(claim.grossAmount, Number(importTax)) }; }
      catch { return { ...claim, delegationType }; }
    });
  }, [preview, importTax, importDelegation]);

  const openClaim = (claim: DelegatedClaim, newEntry = false) => {
    setSelected({ ...claim }); setIsNew(newEntry); setEditMode(newEntry); setExpectedInput(claim.expectedAmount === null ? '' : String(claim.expectedAmount));
    setGrossInput(claim.grossAmount === null ? '' : String(claim.grossAmount)); setTaxInput(claim.taxRate === null || claim.taxRate === undefined ? '' : String(claim.taxRate)); setAmountMode(claim.taxRate !== null && claim.taxRate !== undefined ? 'tax' : 'manual'); pendingReceipt.current = null;
    setReceiptAmount(''); setReceiptDate(today()); setReceiptMethod(claim.paymentMethod === 'unknown' ? 'transfer' : claim.paymentMethod); setReceiptMemo(''); setDialogError('');
  };
  const closeDialog = () => { if (!savingRef.current) { setSelected(null); setPreview(null); setPreviewBytes(null); setDialogError(''); } };
  const runSave = async (operation: () => Promise<void | string>, success: string) => {
    if (savingRef.current || !canWrite) return;
    savingRef.current = true; setSaving(true); setDialogError('');
    try { const detail = await operation(); setNotice(detail || success); setSelected(null); setPreview(null); setPreviewBytes(null); setReload((value) => value + 1); }
    catch (failure) { setDialogError(failure instanceof DelegatedReceiptImportError ? failure.message : '저장하지 못했습니다. 입력 내용과 연결 상태를 확인한 후 다시 시도해 주세요.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const saveClaim = (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const gross = grossInput.trim() === '' ? null : Number(grossInput);
    const amount = amountMode === 'tax' ? calculatedAmount?.expectedAmount ?? null : expectedInput.trim() === '' ? null : Number(expectedInput);
    if ((amountMode === 'tax' && !calculatedAmount) || (gross !== null && (!Number.isSafeInteger(gross) || gross < 0))) { setDialogError('세전 금액은 0원 이상의 정수, 세율은 0~100%로 입력해 주세요.'); return; }
    if (!selected.siteName.trim() || !selected.workerName.trim() || !/^\d{4}-\d{2}$/.test(selected.month) || (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))) { setDialogError('현장·작업자·귀속월과 0원 이상의 정수 금액을 확인해 주세요.'); return; }
    void runSave(() => service.saveClaim({ ...selected, siteName: selected.siteName.trim(), workerName: selected.workerName.trim(), grossAmount: gross, expectedAmount: amount, taxRate: amountMode === 'tax' ? Number(taxInput) : null, taxAmount: amountMode === 'tax' ? calculatedAmount?.taxAmount ?? null : null, updatedAt: new Date().toISOString() }), '기준 정보가 저장되었습니다.');
  };
  const addReceipt = (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const amount = Number(receiptAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !receiptDate || receiptDate > today() || receiptMethod === 'unknown') { setDialogError('실제 입금일, 1원 이상의 정수 금액과 수령수단을 입력해 주세요. 미래 날짜는 등록할 수 없습니다.'); return; }
    const signature = JSON.stringify([selected.id, amount, receiptDate, receiptMethod, receiptMemo.trim()]);
    const receipt: Receipt = pendingReceipt.current?.signature === signature ? pendingReceipt.current.receipt : { id: createId(), amount, date: receiptDate, method: receiptMethod, memo: receiptMemo.trim(), createdAt: new Date().toISOString() };
    pendingReceipt.current = { signature, receipt };
    void runSave(() => service.addReceipt(selected.id, receipt), '입금 기록을 저장했습니다. 잔액이 갱신되었습니다.');
  };
  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || readingFile || !canWrite) return;
    if (!/\.xlsx?$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setError('10MB 이하의 Excel 파일(.xlsx, .xls)을 선택해 주세요.'); return; }
    setReadingFile(true); setError(''); setDialogError('');
    try { const XLSX = await import('xlsx'); const bytes = new Uint8Array(await file.arrayBuffer()); const result = parseDelegatedWorkbook(XLSX.read(bytes, { type: 'array', cellDates: true, cellFormula: true, cellText: true })); setPreview(result); setPreviewBytes(bytes); setPreviewName(file.name); setImportTax(''); setImportDelegation('unknown'); }
    catch { setError('엑셀을 읽지 못했습니다. 노무 처리 확인 양식의 월·현장·작업자 열을 확인해 주세요.'); }
    finally { setReadingFile(false); }
  };
  const resetFilters = () => { setSiteName(''); setWorker(''); setPaymentMethod(''); setDelegationType(''); setStatus(''); };

  return <main className="dr-page">
    <header className="dr-page-header">
      <div className="dr-title-line"><div className="dr-page-symbol"><Wallet size={21} /></div><h1>위임금 입금 확인</h1></div>
      <div className="dr-header-actions"><button className="dr-icon-button" onClick={() => setReload((value) => value + 1)} disabled={loading} aria-label="새로고침" title="새로고침"><RefreshCw size={17} className={loading ? 'dr-spin' : ''} /></button><button className="dr-button" aria-expanded={showTools} aria-controls="dr-data-tools" onClick={() => setShowTools(!showTools)}><Archive size={16} />자료 관리<ChevronRight size={14} className={showTools ? 'dr-chevron-open' : ''} /></button></div>
    </header>
    {showTools && <section id="dr-data-tools" className="dr-data-tools" aria-label="자료 관리">
      <div className="dr-data-actions">{canWrite && <><button className="dr-button" onClick={() => openClaim(blankClaim(month), true)}><Plus size={16} />직접 추가</button><button className="dr-button dr-button-primary" disabled={readingFile} onClick={() => fileInput.current?.click()}><FileSpreadsheet size={17} />{readingFile ? '파일 읽는 중' : '엑셀 가져오기'}</button></>}<button className="dr-button" onClick={openArchive}><Archive size={16} />원본 보관함{archives.length > 0 && <span>{archives.length}</span>}</button></div>
      {savedMonths.length > 0 && <label className="dr-saved-month">저장된 귀속월<select aria-label="저장된 귀속월 바로가기" value="" onChange={(event) => { if (event.target.value) { selectArchivedMonth(event.target.value); setShowTools(false); } }}><option value="">선택하여 조회</option>{savedMonths.map((savedMonth) => <option key={savedMonth} value={savedMonth}>{savedMonth}</option>)}</select></label>}
    </section>}
    <input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="입금 확인 엑셀 파일" hidden onChange={readFile} />
    <div className="dr-period-bar"><div className="dr-month-picker"><button className="dr-icon-button" aria-label="이전 달" onClick={() => { setMonth(moveMonth(month, -1)); setSiteName(''); }}><ArrowLeft size={16} /></button><label><span className="dr-sr-only">귀속월</span><input type="month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setSiteName(''); } }} /></label><button className="dr-icon-button" aria-label="다음 달" onClick={() => { setMonth(moveMonth(month, 1)); setSiteName(''); }}><ArrowRight size={16} /></button></div><span className="dr-scope-label">근무 귀속월</span>{savedMonths.length > 0 && month !== savedMonths[0] && <button className="dr-text-button dr-latest-month" onClick={() => selectArchivedMonth(savedMonths[0])}>최근 자료 {savedMonths[0]} 보기<ChevronRight size={13} /></button>}</div>
    {notice && <div role="status" className="dr-notice"><Check size={16} /><span>{notice}</span><button aria-label="알림 닫기" className="dr-icon-button" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {error && <div role="alert" className="dr-alert"><CircleAlert size={18} /><span>{error}</span><button className="dr-button" onClick={() => setReload((value) => value + 1)}>다시 시도</button></div>}
    <section className="dr-summary-grid" aria-label="입금 요약" aria-busy={loading}>
      <article className="dr-stat dr-stat-dark"><div className="dr-stat-label">{summary.unconfirmed > 0 ? '확정분 받을 금액' : '받을 예정 금액'} <Wallet size={17} /></div><strong>{loading ? '—' : allUnconfirmed ? '미확정' : won(summary.expected)}</strong><p>확정된 수금 기준액 합계</p></article>
      <article className="dr-stat"><div className="dr-stat-label">확인된 입금액 <ArrowDownLeft size={18} /></div><strong className="dr-text-green">{loading ? '—' : won(summary.received)}</strong><p>입금 완료 {paidCount}건 / 조회 {filtered.length}건</p></article>
      <article className="dr-stat"><div className="dr-stat-label">{summary.unconfirmed > 0 ? '확정분 남은 금액' : '남은 받을 돈'} <span className="dr-dot dr-dot-amber" /></div><strong>{loading ? '—' : allUnconfirmed ? '미확정' : won(summary.remaining)}</strong><p className={summary.overpaid > 0 ? 'dr-stat-exception' : undefined}>{summary.overpaid > 0 ? `초과 입금 ${won(summary.overpaid)} 별도` : '확정 금액에서 확인된 입금 차감'}</p></article>
      <article className="dr-stat"><div className="dr-stat-label">금액 확인 필요 <CircleAlert size={17} /></div><strong>{loading ? '—' : <>{summary.unconfirmed}<small>건</small></>}</strong><p>수금 기준액 입력 후 잔액 계산</p></article>
    </section>
    <section className="dr-filter-section" aria-label="입금 내역 필터">
      <div className="dr-filter-top">
        <label className="dr-search"><Search size={17} /><input aria-label="작업자 검색" placeholder="작업자 이름 검색" value={worker} onChange={(event) => setWorker(event.target.value)} />{worker && <button className="dr-icon-button" aria-label="작업자 검색 지우기" onClick={() => setWorker('')}><X size={16} /></button>}</label>
        <div className="dr-primary-filters">
          <label><span className="dr-sr-only">현장</span><select value={siteName} onChange={(event) => setSiteName(event.target.value)}><option value="">전체 현장</option>{sites.map((site) => <option key={site}>{site}</option>)}</select></label>
          <label><span className="dr-sr-only">입금방법</span><select value={delegationType} onChange={(event) => setDelegationType(event.target.value as DelegationType | '')}><option value="">위임·직불 전체</option>{Object.entries(delegationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <button className={'dr-button dr-filter-toggle ' + (showFilters ? 'dr-selected' : '')} aria-expanded={showFilters} aria-controls="dr-extra-filters" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} />상세 필터{[paymentMethod, status].filter(Boolean).length > 0 && <span>{[paymentMethod, status].filter(Boolean).length}</span>}</button>
      </div>
      <div className="dr-filter-bottom"><div className="dr-status-tabs" aria-label="입금 상태 빠른 필터">{(['', 'unconfirmed', 'unpaid', 'partial', 'paid'] as const).map((value) => <button key={value} className={status === value ? 'dr-active' : ''} aria-pressed={status === value} aria-label={value ? statusLabels[value] : '전체 상태'} onClick={() => setStatus(value)}>{value === 'unconfirmed' ? '금액 확인' : value === 'paid' ? '입금 완료' : value ? statusLabels[value] : '전체'}</button>)}</div>{activeFilterCount > 0 && <button className="dr-text-button dr-reset-filters" onClick={resetFilters}><X size={13} />필터 초기화 <span>{activeFilterCount}</span></button>}</div>
      {showFilters && <div id="dr-extra-filters" className="dr-filter-fields">
        <label>수령수단<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | '')}><option value="">전체 방법</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>입금 상태<select value={status} onChange={(event) => setStatus(event.target.value as ClaimStatus | '')}><option value="">전체 상태</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>}
    </section>
    <section className="dr-list-section" aria-label="작업자별 입금 내역"><div className="dr-section-title"><h2>작업자별 내역 <span className="dr-count">{filtered.length}</span></h2><button className="dr-text-button dr-sites-toggle" aria-expanded={showSites} aria-controls="dr-site-summary" onClick={() => setShowSites(!showSites)}><Building2 size={15} />현장별 요약<ChevronRight size={14} className={showSites ? 'dr-chevron-open' : ''} /></button></div>
    {showSites && !loading && siteSummaries.length > 0 && <section id="dr-site-summary" className="dr-sites" aria-label="현장별 집계"><div className="dr-section-title"><h2>현장별 입금 현황</h2><span>{siteSummaries.length}개 현장 · 현재 필터 기준</span></div><div className="dr-method-summary"><span><b>위임</b> 예정 {won(delegationSummary.expected)} · 입금 {won(delegationSummary.received)}</span><span><b>직불</b> 예정 {won(directSummary.expected)} · 입금 {won(directSummary.received)}</span>{unknownCount > 0 && <button onClick={() => { resetFilters(); setDelegationType('unknown'); }}>입금방법 미확인 {unknownCount}건 확인<ChevronRight size={13} /></button>}</div><div className="dr-site-grid">{siteSummaries.map((site) => <button key={site.name} className={`dr-site-card ${siteName === site.name ? 'dr-site-selected' : ''}`} onClick={() => { setSiteName(siteName === site.name ? '' : site.name); setShowSites(false); }} aria-pressed={siteName === site.name}><div className="dr-site-title"><span><Building2 size={16} />{site.name}</span><ChevronRight size={16} /></div><div className="dr-site-values"><span>{site.unconfirmed > 0 ? '확정분 잔액' : '남은 금액'}<strong>{site.count === site.unconfirmed ? '미확정' : won(site.remaining)}</strong></span><span>{site.count}건<small>{site.unconfirmed > 0 ? `미확정 ${site.unconfirmed}건` : '금액 확정'}</small></span></div>{site.unconfirmed === 0 && <div className="dr-progress" role="progressbar" aria-label={`${site.name} 입금률`} aria-valuenow={site.expected > 0 ? Math.min(100, Math.round(site.covered / site.expected * 100)) : 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${site.expected > 0 ? Math.min(100, site.covered / site.expected * 100) : 0}%` }} /></div>}<p>확인 입금 {won(site.received)}<span>예정 {site.count === site.unconfirmed ? '미확정' : won(site.expected)}</span></p></button>)}</div></section>}

      {loading ? <div className="dr-empty" role="status"><RefreshCw className="dr-spin" size={25} /><h3>입금 내역을 불러오고 있습니다</h3></div> : filtered.length === 0 ? <div className="dr-empty"><div className="dr-empty-icon"><FileSpreadsheet size={29} /></div><h3>{claims.length ? '선택한 조건의 내역이 없습니다' : '이 달에 등록된 내역이 없습니다'}</h3><p>{claims.length ? '현장이나 입금 상태를 바꾸어 확인해 보세요.' : '노무 처리 확인 엑셀을 가져오거나 직접 내역을 추가해 주세요.'}</p><p className="dr-empty-hint">이전 자료는 해당 근무 귀속월을 선택해 조회할 수 있습니다.</p>{claims.length ? <button className="dr-button" onClick={resetFilters}>필터 초기화</button> : canWrite && <button className="dr-button dr-button-primary" onClick={() => fileInput.current?.click()} disabled={readingFile}><FileSpreadsheet size={16} />엑셀 가져오기</button>}</div> : <>
        <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>작업자 / 현장</th><th>입금방법 / 수령수단</th><th className="dr-align-right">받을 예정</th><th className="dr-align-right">확인 입금</th><th className="dr-align-right">남은 금액</th><th>입금 상태</th><th><span className="dr-sr-only">상세 보기</span></th></tr></thead><tbody>{filtered.map((claim) => { const total = getClaimTotals(claim); return <tr key={claim.id}><td><strong>{claim.workerName}</strong><span className="dr-cell-sub">{claim.siteName}</span></td><td>{delegationLabels[claim.delegationType]}<span className="dr-cell-sub">{methodLabels[claim.paymentMethod]}</span></td><td className="dr-align-right dr-number">{won(claim.expectedAmount)}{claim.grossAmount !== null && <span className="dr-cell-sub">원본 세전 {won(claim.grossAmount)}</span>}</td><td className="dr-align-right dr-number dr-text-green">{won(total.received)}<span className="dr-cell-sub">{claim.receipts.length}회 입금</span></td><td className="dr-align-right dr-number">{won(total.remaining)}{total.overpaid > 0 && <span className="dr-cell-sub dr-text-amber">초과 {won(total.overpaid)}</span>}</td><td><StatusBadge claim={claim} />{claim.sourceStatus && <span className="dr-original-status" title={claim.sourceStatus}>원본: {claim.sourceStatus}</span>}</td><td><button className="dr-row-button" onClick={() => openClaim(claim)} aria-label={`${claim.workerName} 입금 및 내역`}>{canWrite ? '입금 · 내역' : '내역 보기'}<ChevronRight size={14} /></button></td></tr>; })}</tbody></table></div>
        <div className="dr-mobile-list">{filtered.map((claim) => { const total = getClaimTotals(claim); return <article className="dr-worker-card" key={claim.id}><div className="dr-worker-heading"><div><strong>{claim.workerName}</strong><p>{claim.siteName}</p></div><StatusBadge claim={claim} /></div><div className="dr-worker-meta">{delegationLabels[claim.delegationType]}<span>·</span>{methodLabels[claim.paymentMethod]}<span>·</span>{claim.receipts.length}회 입금</div>{claim.sourceStatus && <p className="dr-original-status dr-original-status-mobile" title={claim.sourceStatus}>원본: {claim.sourceStatus}</p>}<dl className="dr-worker-amounts"><div><dt>받을 예정</dt><dd>{won(claim.expectedAmount)}</dd></div><div><dt>확인 입금</dt><dd className="dr-text-green">{won(total.received)}</dd></div><div><dt>남은 금액</dt><dd>{won(total.remaining)}</dd></div></dl>{total.overpaid > 0 && <p className="dr-text-amber">초과 입금 {won(total.overpaid)}</p>}<button className="dr-button dr-card-button" onClick={() => openClaim(claim)} aria-label={`${claim.workerName} 모바일 입금 및 내역`}>{canWrite ? '입금 등록 · 내역 보기' : '입금 내역 보기'}<ChevronRight size={16} /></button></article>; })}</div>
      </>}
      <footer className="dr-list-note"><CircleAlert size={15} /><span>원본의 ‘완료’ 표시는 참고 정보입니다. 실제 입금일과 금액을 등록해야 입금액에 반영됩니다.</span></footer>
    </section>
    {selected && <Dialog title={isNew ? '위임금 내역 추가' : `${selected.workerName} · 입금 확인`} subtitle={isNew ? '근무 귀속월과 받을 금액의 기준을 입력하세요.' : `${selected.month} · ${selected.siteName}`} onClose={closeDialog} busy={saving}>
      <div className="dr-modal-body">
        {!isNew && <><div className="dr-detail-summary"><div><span>받을 예정</span><strong>{won(selected.expectedAmount)}</strong></div><div><span>확인 입금</span><strong className="dr-text-green">{won(getClaimTotals(selected).received)}</strong></div><div><span>남은 금액</span><strong>{won(getClaimTotals(selected).remaining)}</strong></div></div><div className="dr-detail-status"><StatusBadge claim={selected} />{canWrite && <button className="dr-text-button" onClick={() => { setEditMode(!editMode); setDialogError(''); }}>{editMode ? '입금 등록으로 돌아가기' : '기준 정보 수정'}</button>}</div></>}
        {editMode && canWrite ? <form onSubmit={saveClaim} className="dr-form"><h3>수금 기준 정보</h3><div className="dr-form-grid"><label>근무 귀속월<input type="month" required value={selected.month} disabled={!isNew} onChange={(event) => setSelected({ ...selected, month: event.target.value })} /></label><label>입금방법<select value={selected.delegationType} onChange={(event) => setSelected({ ...selected, delegationType: event.target.value as DelegationType })}>{Object.entries(delegationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>현장명<input required maxLength={100} value={selected.siteName} onChange={(event) => setSelected({ ...selected, siteName: event.target.value })} /></label><label>작업자명<input required maxLength={80} value={selected.workerName} onChange={(event) => setSelected({ ...selected, workerName: event.target.value })} /></label><label>세전 금액 (원)<input type="number" min="0" step="1" inputMode="numeric" placeholder="원본 세전 금액" value={grossInput} onChange={(event) => setGrossInput(event.target.value)} /></label><label>금액 계산 방식<select value={amountMode} onChange={(event) => setAmountMode(event.target.value as 'manual' | 'tax')}><option value="manual">예정액 직접 입력</option><option value="tax">세율로 계산</option></select></label>{amountMode === 'tax' ? <><label>적용 세율 (%)<input type="number" required min="0" max="100" step="any" inputMode="decimal" placeholder="직접 설정" value={taxInput} onChange={(event) => setTaxInput(event.target.value)} /></label><div className="dr-tax-result"><span>공제 세금 {won(calculatedAmount?.taxAmount ?? null)}</span><strong>받을 예정 {won(calculatedAmount?.expectedAmount ?? null)}</strong></div></> : <label>받을 예정 금액 (원)<input type="number" min="0" step="1" inputMode="numeric" placeholder="미입력 시 금액 미확정" value={expectedInput} onChange={(event) => setExpectedInput(event.target.value)} /></label>}<label>예정 수령수단<select value={selected.paymentMethod} onChange={(event) => setSelected({ ...selected, paymentMethod: event.target.value as PaymentMethod })}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><p className="dr-form-help">실제로 받기로 한 금액을 입력하세요. 세율은 직접 설정하며, 세금은 원 단위 반올림합니다. 직접 입력으로 전환하면 세율·세금 정보는 초기화됩니다.</p><label>기준 / 메모<textarea rows={2} maxLength={500} placeholder="예: 공제 후 확정액, 정산 기준" value={selected.memo} onChange={(event) => setSelected({ ...selected, memo: event.target.value })} /></label>{dialogError && <p role="alert" className="dr-form-error">{dialogError}</p>}<button type="submit" className="dr-button dr-button-primary dr-full-width" disabled={saving}>{saving ? '저장 중…' : '기준 정보 저장'}</button></form> : <>
          <div className="dr-source-info"><p><span>원본 세전 금액</span><strong>{won(selected.grossAmount)}</strong></p>{selected.taxRate !== null && selected.taxRate !== undefined && <p><span>적용 세율 / 공제 세금</span><strong>{selected.taxRate}% / {won(selected.taxAmount ?? null)}</strong></p>}<p><span>원본 표시</span><strong>{selected.sourceStatus || '표시 없음'}</strong></p>{selected.sourceLabel && <p><span>원본 위치</span><strong>{selected.sourceLabel}</strong></p>}{selected.memo && <p className="dr-source-memo">{selected.memo}</p>}</div>
          {canWrite && <form onSubmit={addReceipt} className="dr-form"><h3><Plus size={16} />입금 기록 추가</h3><p className="dr-form-help">통장 또는 입금 증빙을 확인한 금액만 입력하세요. 나누어 받은 금액도 각각 등록할 수 있습니다.</p><div className="dr-form-grid"><label>실제 입금일<input type="date" required max={today()} value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} /></label><label>실제 수령수단<select value={receiptMethod} onChange={(event) => setReceiptMethod(event.target.value as PaymentMethod)}>{Object.entries(methodLabels).filter(([value]) => value !== 'unknown').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="dr-field-span">입금액 (원)<input type="number" required min="1" step="1" inputMode="numeric" placeholder="입금된 금액 입력" value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)} /></label><label className="dr-field-span">입금 메모<input maxLength={500} placeholder="예: 1차 입금, 증빙 확인 내용" value={receiptMemo} onChange={(event) => setReceiptMemo(event.target.value)} /></label></div>{selected.expectedAmount === null && <p className="dr-form-help dr-text-amber">예정 금액이 미확정입니다. 입금은 기록되며, 잔액은 기준액 확정 후 계산됩니다.</p>}{selected.expectedAmount !== null && Number(receiptAmount) > (getClaimTotals(selected).remaining || 0) && <p className="dr-form-help dr-text-amber">남은 받을 돈을 초과하는 입금입니다. 금액을 다시 확인해 주세요.</p>}{dialogError && <p role="alert" className="dr-form-error">{dialogError}</p>}<button type="submit" className="dr-button dr-button-primary dr-full-width" disabled={saving}>{saving ? '저장 중…' : '확인한 입금 기록 저장'}</button></form>}
          <section className="dr-history"><div className="dr-section-title"><h3>입금 이력</h3><span>{selected.receipts.length}회</span></div>{selected.receipts.length ? <ul>{[...selected.receipts].sort((a, b) => b.date.localeCompare(a.date)).map((receipt) => <li key={receipt.id}><div className="dr-history-check"><Check size={14} /></div><div><strong>{receipt.date}<span>{methodLabels[receipt.method]}</span></strong>{receipt.memo && <p>{receipt.memo}</p>}</div><b>{won(receipt.amount)}</b></li>)}</ul> : <p className="dr-history-empty">아직 등록한 입금 기록이 없습니다.</p>}</section>
        </>}
      </div>
    </Dialog>}
    {archiveOpen && <Dialog title="원본 보관함" subtitle="저장된 엑셀과 분류 대기 내역을 확인하세요." onClose={() => setArchiveOpen(false)} wide><WorkbookArchivePanel service={archiveService} archives={archives} loading={archivesLoading} error={archivesError} onReload={() => setArchiveReload((value) => value + 1)} onSelectMonth={selectArchivedMonth} /></Dialog>}
    {preview && <Dialog title="엑셀 가져오기 확인" subtitle={previewName} onClose={closeDialog} wide busy={saving}>
      <div className="dr-modal-body"><div className="dr-import-summary"><FileSpreadsheet size={24} /><div><strong>월별 관리 {preview.claims.length.toLocaleString('ko-KR')}건 · 분류 대기 {preview.unclassifiedRows.length.toLocaleString('ko-KR')}건</strong><p>{availableMonths.join(' · ') || '월별 분류 전 · 원본과 분류 대기 행 보관'}</p></div></div><p className="dr-import-explainer">모든 시트·셀·수식·서식이 담긴 엑셀 원본 전체를 함께 보관합니다. 월·현장이 확인되지 않는 행도 분류 대기로 저장합니다. 공통 세율을 설정하면 세후 예정액을 계산합니다. 실제 입금액은 별도 입력하며, 같은 원본 내역은 중복 저장하지 않습니다.</p><div className="dr-form dr-import-settings"><div className="dr-form-grid"><label>공통 세율 (%) · 선택<input type="number" min="0" max="100" step="any" inputMode="decimal" placeholder="세전 내역에만 적용" value={importTax} onChange={(event) => setImportTax(event.target.value)} /></label><label>미확인 입금방법 설정<select value={importDelegation} onChange={(event) => setImportDelegation(event.target.value as DelegationType)}><option value="unknown">미확인 유지</option><option value="delegate">위임</option><option value="direct">직불</option></select></label></div><p className="dr-form-help">세금은 원 단위 반올림합니다. 원본에 위임·직불이 명시된 내역은 유지합니다. 원본에 세후 금액이 명시된 내역은 예정액을 유지합니다. 세전·세후 금액이 모두 없으면 미확정으로 남습니다.</p><p className="dr-import-total">세후 받을 예정 <strong>{won(summarizeClaims(preparedImport).expected)}</strong><span>금액 미확정 {summarizeClaims(preparedImport).unconfirmed}건</span></p></div>{preview.warnings.length > 0 && <div className="dr-import-warnings"><strong>확인할 내용 {preview.warnings.length}건</strong><ul>{preview.warnings.slice(0, 8).map((warning, index) => <li key={index}>{String(warning)}</li>)}</ul>{preview.warnings.length > 8 && <p>그 외 {preview.warnings.length - 8}건이 있습니다.</p>}</div>}<div className="dr-import-coverage"><span>원본 파일 전체 보관</span><span>{preview.sheetSummaries.length}개 시트 · 입력 셀 {preview.sheetSummaries.reduce((sum, sheet) => sum + sheet.populatedCells, 0).toLocaleString('ko-KR')}개</span></div>{preview.unclassifiedRows.length > 0 && <details className="dr-import-review-preview"><summary>분류 대기 {preview.unclassifiedRows.length}건 확인 · 원본 그대로 함께 저장</summary><p className="dr-form-help">아래 행은 월·현장을 추정하지 않고 원본 위치와 내용을 보관합니다. 가져온 뒤 원본 보관함에서 다시 확인할 수 있습니다.</p><SourceReviewRows rows={preview.unclassifiedRows} /></details>}<div className="dr-preview-list">{preparedImport.slice(0, 40).map((claim) => <div key={claim.id}><span><strong>{claim.workerName}</strong><small>{claim.month} · {claim.siteName}</small></span><span>{delegationLabels[claim.delegationType]}<small>원본 세전 {won(claim.grossAmount)}</small><small>세후 예정 {won(claim.expectedAmount)}</small></span></div>)}</div>{preview.claims.length > 40 && <p className="dr-form-help">미리보기는 앞 40건을 표시합니다. 전체 {preview.claims.length}건이 저장 대상입니다.</p>}{dialogError && <p role="alert" className="dr-form-error">{dialogError}</p>}<div className="dr-import-actions"><button className="dr-button" onClick={closeDialog} disabled={saving}>취소</button><button className="dr-button dr-button-primary" disabled={saving || !previewBytes || !canWrite || (importTax !== '' && (!Number.isFinite(Number(importTax)) || Number(importTax) < 0 || Number(importTax) > 100))} onClick={() => { const importing = preparedImport; const originalBytes = previewBytes; if (!originalBytes) return; void runSave(async () => { const result = await archiveService.importWorkbook(originalBytes, previewName, preview, importing); setArchiveRequested(true); setArchiveReload((value) => value + 1); setMonth(availableMonths[availableMonths.length - 1] || month); resetFilters(); return `원본 전체 보관 완료 · 관리 ${result.added}건 추가 · 기존 ${result.skipped}건 유지 · 분류 대기 ${result.reviewRows}건 보관`; }, '엑셀 내역을 가져왔습니다. 받을 예정 금액을 확인해 주세요.'); }}>{saving ? '원본과 내역 저장 중…' : `원본과 전체 ${preview.claims.length + preview.unclassifiedRows.length}건 저장`}</button></div></div>
    </Dialog>}
  </main>;
}

export default function DelegatedReceiptsPage() {
  const { currentUser, loading } = useAuth();
  const userId = currentUser?.uid;
  const [access, setAccess] = useState<{ userId: string; read: boolean; write: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false; setAccess(null); setFailed(false);
    if (!userId) return;
    userService.getUser(userId).then((profile) => {
      if (cancelled) return;
      const roles = profile ? [profile.role, profile.position, ...(profile.additionalPositions || [])] : [];
      const eligible = !!profile && profile.status !== 'suspended' && profile.status !== 'rejected' && profile.status !== 'pending';
      setAccess({ userId, read: eligible && canAccessErpCollection(roles, 'delegated_receipt_claims', 'read'), write: eligible && canAccessErpCollection(roles, 'delegated_receipt_claims', 'write') });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId, retry]);
  if (loading || (currentUser && (!access || access.userId !== userId) && !failed)) return <div className="dr-page dr-empty" role="status">접근 권한을 확인하고 있습니다.</div>;
  if (failed) return <div className="dr-page dr-empty" role="alert"><h2>접근 권한을 확인하지 못했습니다</h2><button className="dr-button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>;
  if (!currentUser || !access?.read) return <div className="dr-page dr-empty"><CircleAlert size={28} /><h2>조회 권한이 필요합니다</h2><p>관리자·급여·재무 담당 권한으로 이용할 수 있습니다.</p></div>;
  return <DelegatedReceiptsWorkspace key={userId} canWrite={access.write} />;
}
