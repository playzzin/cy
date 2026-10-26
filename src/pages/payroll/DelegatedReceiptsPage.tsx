import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDownLeft, ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleAlert, FileSpreadsheet, List, Plus, RefreshCw, Search, Settings2, Wallet, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { canAccessErpCollection } from '../../security/erpAccessPolicy';
import { delegatedReceiptService, DelegatedReceiptImportError } from '../../features/delegated-receipts/service';
import { ClaimListEdit, DelegatedClaim, DelegationType, RecipientKind, DepositStatus, calculateExpectedAmount, filterClaims, summarizeClaims, summarizeClaimAmounts } from '../../features/delegated-receipts/model';
import { parseDelegatedWorkbook } from '../../features/delegated-receipts/workbookImport';
import { workbookArchiveService, WorkbookArchive } from '../../features/delegated-receipts/workbookArchiveService';
import WorkbookArchivePanel, { ArchiveService, SourceReviewRows } from './WorkbookArchivePanel';
import { depositLabels, getDelegation, getDepositState, isCustomRecipient, recipientLabels } from '../../features/delegated-receipts/depositState';
import { emptyDirectory, getSiteTeam, ReceiptDirectory } from '../../features/delegated-receipts/teamDirectory';
import { receiptDirectoryService } from '../../features/delegated-receipts/directoryService';
import DelegatedWorkerLedger, { SiteIdentity } from './DelegatedWorkerLedger';
import DelegatedBulkEditForm from './DelegatedBulkEditForm';
import { createPortal } from 'react-dom';
import DelegatedBulkEntry from './DelegatedBulkEntry';
import ReceiptColorFilter from './ReceiptColorFilter';
import ReceiptChoiceSelect from './ReceiptChoiceSelect';
import { delegationChoices, delegationFilterChoices, recipientFilterChoices } from './receiptChoiceOptions';
import DelegatedSiteSettings from './DelegatedSiteSettings';
import { siteTaxService } from '../../features/delegated-receipts/siteTaxService';
import { SiteTaxSetting, siteTaxTarget } from '../../features/delegated-receipts/siteTax';
import './DelegatedReceiptsPage.css';

const delegationLabels: Record<DelegationType, string> = { delegate: '위임', direct: '직불', unknown: '미확인' };
const won = (value: number | null) => value === null ? '미확정' : `${value.toLocaleString('ko-KR')}원`;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const moveMonth = (month: string, distance: number) => {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + distance, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

function ClaimAmountSummary({ claims, loading, total = false }: { claims: DelegatedClaim[]; loading: boolean; total?: boolean }) {
  const amounts = summarizeClaimAmounts(claims);
  return <dl className="dr-stat-amounts">{(['gross', 'expected'] as const).map(field => {
    const value = amounts[field];
    return <div key={field}><dt>{total ? '조회 ' : ''}{field === 'gross' ? '세전' : '예정'}</dt><dd>{loading ? '—' : <><b>{won(value.amount)}</b>{value.amount !== null && value.missing > 0 && <small>미확정 {value.missing}건 제외</small>}</>}</dd></div>;
  })}</dl>;
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
  return createPortal(<div className="dr-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
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
  </div>, document.body);
}

interface WorkspaceProps { initialDirectory?: ReceiptDirectory; initialClaims?: DelegatedClaim[]; service?: typeof delegatedReceiptService; archiveService?: ArchiveService; canWrite?: boolean; taxService?: typeof siteTaxService; initialSiteTaxes?: SiteTaxSetting[]; }

export function DelegatedReceiptsWorkspace({ initialClaims, initialDirectory, service = delegatedReceiptService, archiveService = workbookArchiveService, canWrite = true, taxService = siteTaxService, initialSiteTaxes }: WorkspaceProps) {
  const [month, setMonth] = useState(() => initialClaims?.[0]?.month || today().slice(0, 7));
  const [claims, setClaims] = useState<DelegatedClaim[]>(initialClaims || []);
  const [loading, setLoading] = useState(!initialClaims);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [siteName, setSiteName] = useState('');
  const [worker, setWorker] = useState('');
  const deferredWorker = useDeferredValue(worker);
  const [recipient, setRecipient] = useState<RecipientKind | '' | 'custom'>('');
  const [directory, setDirectory] = useState<ReceiptDirectory>(initialDirectory || emptyDirectory);
  const [directoryError, setDirectoryError] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<DelegatedClaim[] | null>(null);
  const [delegationType, setDelegationType] = useState<DelegationType | ''>('');
  const [status, setStatus] = useState<DepositStatus | ''>('');
  const [showTools, setShowTools] = useState(false);
  const [showSites, setShowSites] = useState(false);
  const [ledgerView, setLedgerView] = useState<'list' | 'excel'>('excel');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [siteTaxes, setSiteTaxes] = useState<SiteTaxSetting[]>(initialSiteTaxes || []);
  const [taxLoading, setTaxLoading] = useState(!initialSiteTaxes && !initialClaims);
  const [taxError, setTaxError] = useState('');
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
    if (initialSiteTaxes || initialClaims) return;
    let cancelled = false; setTaxLoading(true); setTaxError('');
    taxService.list().then(values => { if (!cancelled) setSiteTaxes(values); }).catch(() => { if (!cancelled) setTaxError('현장 세율을 불러오지 못했습니다. 새로고침 후 등록해 주세요.'); }).finally(() => { if (!cancelled) setTaxLoading(false); });
    return () => { cancelled = true; };
  }, [taxService, initialSiteTaxes, initialClaims, reload]);

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

  useEffect(() => {
    if (initialDirectory || initialClaims) return;
    let cancelled = false;
    receiptDirectoryService.load().then(value => { if (!cancelled) { setDirectory(value); setDirectoryError(''); } })
      .catch(() => { if (!cancelled) setDirectoryError('작업자·담당 팀 정보를 불러오지 못했습니다. 새로고침해 주세요.'); });
    return () => { cancelled = true; };
  }, [initialDirectory, initialClaims, reload]);
  useEffect(() => { setSelectedIds(previous => previous.length ? [] : previous); }, [month, siteName, worker, recipient, teamFilter, status, delegationType, reload]);

  const filtered = useMemo(() => filterClaims(claims, { month, siteName, worker: deferredWorker }).filter(claim =>
    (!delegationType || getDelegation(claim) === delegationType)
    && (!status || getDepositState(claim).status === status)
    && (!recipient || (recipient === 'custom' ? isCustomRecipient(getDepositState(claim).recipient) : getDepositState(claim).recipient === recipient))
    && (!teamFilter || (teamFilter === 'unlinked' ? !getSiteTeam(claim, directory) : getSiteTeam(claim, directory)?.id === teamFilter))
  ), [claims, month, siteName, deferredWorker, delegationType, status, recipient, teamFilter, directory]);
  const summary = useMemo(() => summarizeClaims(filtered), [filtered]);
  const statusCounts = useMemo(() => filtered.reduce((counts, claim) => { counts[getDepositState(claim).status]++; return counts; }, { complete: 0, pending: 0, partial: 0, unknown: 0 }), [filtered]);
  const sites = useMemo(() => Array.from(new Set(claims.filter(claim => claim.month === month).map(claim => claim.siteName))).sort((a,b) => a.localeCompare(b, 'ko')), [claims, month]);
  const siteFilterOptions = useMemo(() => [{ value: '', label: '전체 현장' }, ...sites.map(name => {
    const teams = new Map(claims.filter(claim => claim.month === month && claim.siteName === name).map(claim => getSiteTeam(claim, directory)).filter(team => team !== undefined).map(team => [team.id, team]));
    return { value: name, label: name, color: teams.size === 1 ? [...teams.values()][0].color : undefined };
  })], [sites, claims, month, directory]);
  const teamFilterOptions = useMemo(() => [{ value: '', label: '전체 팀' }, { value: 'unlinked', label: '팀 연결 필요' }, ...directory.teams.map(team => ({ value: team.id, label: team.name, color: team.color }))], [directory.teams]);
  const siteSummaries = useMemo(() => Array.from(new Set(filtered.map(claim => claim.siteName))).map(name => {
    const rows = filtered.filter(claim => claim.siteName === name);
    return { name, count: rows.length, complete: rows.filter(claim => getDepositState(claim).status === 'complete').length, team: getSiteTeam(rows[0], directory) };
  }), [filtered, directory]);
  const availableMonths = useMemo(() => Array.from(new Set(preview?.claims.map((claim) => claim.month) || [])).sort(), [preview]);
  const activeFilterCount = [siteName, worker, recipient, teamFilter, status, delegationType].filter(Boolean).length;
  const preparedImport = useMemo(() => {
    if (!preview) return [];
    return preview.claims.map((claim) => {
      const sourceDelegation = getDelegation(claim);
      const delegationType = sourceDelegation === 'unknown' ? importDelegation : sourceDelegation;
      const rate = importTax.trim() ? Number(importTax) : siteTaxes.find(value => value.key === siteTaxTarget(claim, directory).key)?.taxRate;
      if (rate == null || claim.grossAmount === null) return { ...claim, delegationType };
      try { return { ...claim, delegationType, taxRate: rate, ...calculateExpectedAmount(claim.grossAmount, rate) }; }
      catch { return { ...claim, delegationType }; }
    });
  }, [preview, importTax, importDelegation, siteTaxes, directory]);

  const updateListField = useCallback(async (id: string, edit: ClaimListEdit) => {
    if (!canWrite) throw new Error('수정 권한이 없습니다.');
    const updated = await service.updateListField(id, edit);
    setClaims(previous => previous.map(claim => claim.id === id ? updated : claim));
    setSelectedIds(previous => previous.filter(value => value !== id));
  }, [canWrite, service]);
  const closeDialog = () => { if (!savingRef.current) { setConfirming(null); setSelectedIds([]); setPreview(null); setPreviewBytes(null); setDialogError(''); } };
  const runSave = async (operation: () => Promise<void | string>, success: string) => {
    if (savingRef.current || !canWrite) return;
    savingRef.current = true; setSaving(true); setDialogError('');
    try { const detail = await operation(); setNotice(detail || success); setConfirming(null); setSelectedIds([]); setPreview(null); setPreviewBytes(null); setReload((value) => value + 1); }
    catch (failure) { setDialogError(failure instanceof DelegatedReceiptImportError ? failure.message : '저장하지 못했습니다. 입력 내용과 연결 상태를 확인한 후 다시 시도해 주세요.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || readingFile || !canWrite) return;
    if (!/\.xlsx?$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setError('10MB 이하의 Excel 파일(.xlsx, .xls)을 선택해 주세요.'); return; }
    setReadingFile(true); setError(''); setDialogError('');
    try { const XLSX = await import('xlsx'); const bytes = new Uint8Array(await file.arrayBuffer()); const result = parseDelegatedWorkbook(XLSX.read(bytes, { type: 'array', cellDates: true, cellFormula: true, cellText: true })); setPreview(result); setPreviewBytes(bytes); setPreviewName(file.name); setImportTax(''); setImportDelegation('unknown'); }
    catch { setError('엑셀을 읽지 못했습니다. 노무 처리 확인 양식의 월·현장·작업자 열을 확인해 주세요.'); }
    finally { setReadingFile(false); }
  };
  const resetFilters = () => { setSiteName(''); setWorker(''); setRecipient(''); setTeamFilter(''); setDelegationType(''); setStatus(''); };

  return <main className="dr-page">
    <header className="dr-page-header">
      <div className="dr-title-line"><div className="dr-page-symbol"><Wallet size={21} /></div><h1>노무 입금 확인</h1></div>
      <div className="dr-period-bar"><div className="dr-month-picker"><button className="dr-icon-button" aria-label="이전 달" onClick={() => { setMonth(moveMonth(month, -1)); setSiteName(''); }}><ArrowLeft size={16} /></button><label><span className="dr-sr-only">귀속월</span><input type="month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setSiteName(''); } }} /></label><button className="dr-icon-button" aria-label="다음 달" onClick={() => { setMonth(moveMonth(month, 1)); setSiteName(''); }}><ArrowRight size={16} /></button></div><span className="dr-scope-label">근무 귀속월</span>{savedMonths.length > 0 && month !== savedMonths[0] && <button className="dr-text-button dr-latest-month" onClick={() => selectArchivedMonth(savedMonths[0])}>최근 자료 {savedMonths[0]} 보기<ChevronRight size={13} /></button>}</div>
      <div className="dr-header-actions">{canWrite && <button className="dr-button" disabled={taxLoading || !!taxError} onClick={() => setSettingsKey('')}><Settings2 size={16} />현장 설정</button>}<button className="dr-icon-button" onClick={() => setReload((value) => value + 1)} disabled={loading} aria-label="새로고침" title="새로고침"><RefreshCw size={17} className={loading ? 'dr-spin' : ''} /></button><button className="dr-button" aria-expanded={showTools} aria-controls="dr-data-tools" onClick={() => setShowTools(!showTools)}><Archive size={16} />자료 관리<ChevronRight size={14} className={showTools ? 'dr-chevron-open' : ''} /></button></div>
    </header>
    {showTools && <section id="dr-data-tools" className="dr-data-tools" aria-label="자료 관리">
      <div className="dr-data-actions">{canWrite && <button className="dr-button dr-button-primary" disabled={readingFile} onClick={() => fileInput.current?.click()}><FileSpreadsheet size={17} />{readingFile ? '파일 읽는 중' : '엑셀 가져오기'}</button>}<button className="dr-button" onClick={openArchive}><Archive size={16} />원본 보관함{archives.length > 0 && <span>{archives.length}</span>}</button></div>
      {savedMonths.length > 0 && <label className="dr-saved-month">저장된 귀속월<select aria-label="저장된 귀속월 바로가기" value="" onChange={(event) => { if (event.target.value) { selectArchivedMonth(event.target.value); setShowTools(false); } }}><option value="">선택하여 조회</option>{savedMonths.map((savedMonth) => <option key={savedMonth} value={savedMonth}>{savedMonth}</option>)}</select></label>}
    </section>}
    <input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="입금 확인 엑셀 파일" hidden onChange={readFile} />
    {notice && <div role="status" className="dr-notice"><Check size={16} /><span>{notice}</span><button aria-label="알림 닫기" className="dr-icon-button" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {error && <div role="alert" className="dr-alert"><CircleAlert size={18} /><span>{error}</span><button className="dr-button" onClick={() => setReload((value) => value + 1)}>다시 시도</button></div>}
    {directoryError && <p role="status" className="dr-form-help">{directoryError}</p>}{taxError && <p role="alert" className="dr-form-error">{taxError}</p>}
    <section className="dr-summary-grid" aria-label="입금 요약" aria-busy={loading}>
      <article className="dr-stat dr-stat-dark" aria-label="입금완료 현황"><div className="dr-stat-label">입금완료 / 조회 <Check size={17} /></div><strong>{loading ? '—' : <>{statusCounts.complete}<small>/ {filtered.length}건</small></>}</strong><ClaimAmountSummary claims={filtered.filter(claim => getDepositState(claim).status === 'complete')} loading={loading} /></article>
      <article className="dr-stat" aria-label="입금 전·일부 현황"><div className="dr-stat-label">입금 전 · 일부 <CircleAlert size={17} /></div><strong>{loading ? '—' : <>{statusCounts.pending + statusCounts.partial}<small>건</small></>}</strong><ClaimAmountSummary claims={filtered.filter(claim => ['pending', 'partial'].includes(getDepositState(claim).status))} loading={loading} /></article>
      <article className="dr-stat" aria-label="확인 필요 현황"><div className="dr-stat-label">입금여부 확인 필요</div><strong>{loading ? '—' : <>{statusCounts.unknown}<small>건</small></>}</strong><ClaimAmountSummary claims={filtered.filter(claim => getDepositState(claim).status === 'unknown')} loading={loading} /></article>
      <article className="dr-stat" aria-label="조회 금액 현황"><div className="dr-stat-label">기록된 입금액 <ArrowDownLeft size={17} /></div><strong className="dr-text-green">{loading ? '—' : filtered.some(claim => claim.receipts.length) ? won(summary.received) : '미기록'}</strong><ClaimAmountSummary claims={filtered} loading={loading} total /></article>
    </section>
    <section className="dr-filter-section" aria-label="입금 내역 필터">
      <div className="dr-filter-top">
        <div className="dr-primary-filters">
          <ReceiptColorFilter label="현장" kind="site" value={siteName} options={siteFilterOptions} onChange={setSiteName} />
          <ReceiptChoiceSelect label="입금방법" value={delegationType} options={delegationFilterChoices} onChange={value => setDelegationType(value as DelegationType | '')} />
          <ReceiptChoiceSelect label="받는 계좌" value={recipient} options={recipientFilterChoices} onChange={value => setRecipient(value as RecipientKind | '' | 'custom')} />
          <ReceiptColorFilter label="담당 팀" kind="team" value={teamFilter} options={teamFilterOptions} onChange={setTeamFilter} />
        </div>
        <div className="dr-filter-actions">{canWrite && <button className="dr-button dr-button-primary dr-direct-add" disabled={taxLoading || !!taxError} onClick={() => setBulkOpen(true)}><Plus size={16} />직접 추가</button>}<label className="dr-search"><Search size={17} /><input aria-label="작업자 검색" placeholder="작업자·항목명 검색" value={worker} onChange={(event) => setWorker(event.target.value)} />{worker && <button className="dr-icon-button" aria-label="작업자 검색 지우기" onClick={() => setWorker('')}><X size={16} /></button>}</label></div>
      </div>
      <div className="dr-filter-bottom"><div className="dr-status-tabs" aria-label="입금여부 빠른 필터">{(['', 'pending', 'partial', 'complete', 'unknown'] as const).map(value => <button key={value} className={status === value ? 'dr-active' : ''} aria-pressed={status === value} aria-label={value ? depositLabels[value] : '전체 상태'} onClick={() => setStatus(value)}>{value ? depositLabels[value] : '전체'}</button>)}</div>{activeFilterCount > 0 && <button className="dr-text-button dr-reset-filters" onClick={resetFilters}><X size={13} />필터 초기화 <span>{activeFilterCount}</span></button>}</div>
    </section>
    <section className="dr-list-section" aria-label="작업자별 입금 내역"><div className="dr-section-title dr-ledger-title"><h2>작업자·별도 내역 <span className="dr-count">{filtered.length}</span></h2><div className="dr-ledger-view-switch" role="group" aria-label="목록 보기 방식"><button type="button" aria-pressed={ledgerView === 'list'} onClick={() => setLedgerView('list')}><List size={16} />기본 목록</button><button type="button" aria-pressed={ledgerView === 'excel'} onClick={() => setLedgerView('excel')}><FileSpreadsheet size={16} />엑셀형 · 4개씩</button></div><button className="dr-text-button dr-sites-toggle" aria-expanded={showSites} aria-controls="dr-site-summary" onClick={() => setShowSites(!showSites)}><Building2 size={15} />현장별 요약<ChevronRight size={14} className={showSites ? 'dr-chevron-open' : ''} /></button></div>
    {showSites && !loading && siteSummaries.length > 0 && <section id="dr-site-summary" className="dr-sites" aria-label="현장별 집계"><div className="dr-section-title"><h2>현장별 입금여부</h2><span>{siteSummaries.length}개 현장</span></div><div className="dr-site-grid">{siteSummaries.map(site => <button key={site.name} className="dr-site-card" onClick={() => { setSiteName(site.name); setShowSites(false); }}><div className="dr-site-title"><SiteIdentity name={site.name} color={site.team?.color} teamName={site.team?.name} /><ChevronRight size={16} /></div><div className="dr-site-values"><span>입금완료<strong>{site.complete} / {site.count}건</strong></span></div><div className="dr-progress" role="progressbar" aria-label={`${site.name} 입금완료 비율`} aria-valuenow={Math.round(site.complete / site.count * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${site.complete / site.count * 100}%` }} /></div></button>)}</div></section>}
    {canWrite && selectedIds.length > 0 && <div className="dr-selection-bar"><strong>{selectedIds.length}건 선택</strong><button className="dr-button dr-button-primary" onClick={() => { setDialogError(''); setConfirming(filtered.filter(claim => selectedIds.includes(claim.id))); }}>선택 내역 일괄 수정</button><button className="dr-text-button" onClick={() => setSelectedIds([])}>선택 해제</button></div>}

      {loading && !filtered.length ? <div className="dr-empty" role="status"><RefreshCw className="dr-spin" size={25} /><h3>입금 내역을 불러오고 있습니다</h3></div> : filtered.length === 0 ? <div className="dr-empty"><div className="dr-empty-icon"><FileSpreadsheet size={29} /></div><h3>{claims.length ? '선택한 조건의 내역이 없습니다' : '이 달에 등록된 내역이 없습니다'}</h3><p>{claims.length ? '현장이나 입금 상태를 바꾸어 확인해 보세요.' : '노무 처리 확인 엑셀을 가져오거나 직접 내역을 추가해 주세요.'}</p><p className="dr-empty-hint">이전 자료는 해당 근무 귀속월을 선택해 조회할 수 있습니다.</p>{claims.length ? <button className="dr-button" onClick={resetFilters}>필터 초기화</button> : canWrite && <button className="dr-button dr-button-primary" onClick={() => fileInput.current?.click()} disabled={readingFile}><FileSpreadsheet size={16} />엑셀 가져오기</button>}</div> : <>
        <DelegatedWorkerLedger key={month} view={ledgerView} claims={filtered} directory={directory} canWrite={canWrite} selectedIds={selectedIds} onSelect={setSelectedIds} onUpdate={updateListField} onSiteSettings={canWrite && !taxLoading && !taxError ? claim => setSettingsKey(siteTaxTarget(claim, directory).key) : undefined} />
      </>}
      <footer className="dr-list-note"><CircleAlert size={15} /><span>엑셀의 입금완료·공동 입금 표시는 입금여부에 반영됩니다. 기록된 입금액은 별도이며, 완료 표시만으로 금액을 추정하지 않습니다.</span></footer>
    </section>
    {bulkOpen && canWrite && <Dialog title="직접 추가 · 일괄 등록" subtitle="작업자 또는 바이백·계산서 내역을 한 번에 입력합니다." onClose={() => { if (!bulkBusy) setBulkOpen(false); }} busy={bulkBusy} wide><DelegatedBulkEntry siteTaxes={siteTaxes} month={month} directory={directory} existingClaims={claims} directoryError={directoryError} onSave={values => service.createClaims(values)} onBusy={setBulkBusy} onClose={() => { if (!bulkBusy) setBulkOpen(false); }} onComplete={(savedMonth, count) => { setBulkOpen(false); setMonth(savedMonth); resetFilters(); setNotice(count + "행을 등록했습니다."); setReload(value => value + 1); }} /></Dialog>}
    {settingsKey !== null && canWrite && <Dialog title="현장 설정" subtitle="기본 세율과 기존 내역의 재계산 범위를 설정합니다." busy={settingsBusy} onClose={() => { if (!settingsBusy) setSettingsKey(null); }}><DelegatedSiteSettings month={month} claims={claims} directory={directory} settings={siteTaxes} initialKey={settingsKey} onBusy={setSettingsBusy} onClose={() => { if (!settingsBusy) setSettingsKey(null); }} onSave={async request => {
      const result = await taxService.save(request);
      setSiteTaxes(previous => [...previous.filter(value => value.key !== result.setting.key), result.setting]);
      const updated = new Map(result.claims.map(claim => [claim.id, claim]));
      setClaims(previous => previous.map(claim => updated.get(claim.id) || claim));
      setSettingsKey(null); setSelectedIds([]); setNotice(request.selected.length ? `현장 세율 저장 · ${request.selected.length}건 재계산 완료` : '현장 기본 세율을 저장했습니다.');
    }} /></Dialog>}
    {confirming && <Dialog title="선택 내역 일괄 수정" subtitle={`${confirming.length}건 · 현재 선택한 내역에 적용`} onClose={closeDialog} busy={saving}><div className="dr-modal-body"><DelegatedBulkEditForm directory={directory} claims={confirming} busy={saving} error={dialogError} onSave={edits => { void runSave(() => service.updateListFields(confirming.map(claim => claim.id), edits), `${confirming.length}건을 일괄 수정했습니다.`); }} /></div></Dialog>}
    {archiveOpen && <Dialog title="원본 보관함" subtitle="저장된 엑셀과 분류 대기 내역을 확인하세요." onClose={() => setArchiveOpen(false)} wide><WorkbookArchivePanel service={archiveService} archives={archives} loading={archivesLoading} error={archivesError} onReload={() => setArchiveReload((value) => value + 1)} onSelectMonth={selectArchivedMonth} /></Dialog>}
    {preview && <Dialog title="엑셀 가져오기 확인" subtitle={previewName} onClose={closeDialog} wide busy={saving}>
      <div className="dr-modal-body"><div className="dr-import-summary"><FileSpreadsheet size={24} /><div><strong>월별 관리 {preview.claims.length.toLocaleString('ko-KR')}건 · 분류 대기 {preview.unclassifiedRows.length.toLocaleString('ko-KR')}건</strong><p>{availableMonths.join(' · ') || '월별 분류 전 · 원본과 분류 대기 행 보관'}</p></div></div><p className="dr-import-explainer">모든 시트·셀·수식·서식이 담긴 엑셀 원본 전체를 함께 보관합니다. 월·현장이 확인되지 않는 행도 분류 대기로 저장합니다. 공통 세율을 설정하면 세후 예정액을 계산합니다. 입금완료·입금 전은 병합된 공동 표시까지 반영합니다. 실제 입금액은 별도 입력하며, 같은 원본 내역은 중복 저장하지 않습니다.</p><div className="dr-form dr-import-settings"><div className="dr-form-grid"><label>공통 세율 (%) · 선택<input type="number" min="0" max="100" step="any" inputMode="decimal" placeholder="비우면 현장 기본 세율" value={importTax} onChange={(event) => setImportTax(event.target.value)} /></label><label>미확인 입금방법 설정<ReceiptChoiceSelect label="미확인 입금방법 설정" value={importDelegation} options={delegationChoices.map(option => option.value === 'unknown' ? { ...option, label: '미확인 유지' } : option)} onChange={value => setImportDelegation(value as DelegationType)} /></label></div><p className="dr-form-help">공통 세율을 비우면 현장 기본 세율을 적용합니다. 세금은 원 단위 반올림합니다. 원본에 위임·직불이 명시된 내역은 유지합니다. 원본에 세후 금액이 명시된 내역은 예정액을 유지합니다. 세전·세후 금액이 모두 없으면 미확정으로 남습니다.</p><p className="dr-import-total">세후 받을 예정 <strong>{won(summarizeClaims(preparedImport).expected)}</strong><span>금액 미확정 {summarizeClaims(preparedImport).unconfirmed}건</span></p></div>{preview.warnings.length > 0 && <div className="dr-import-warnings"><strong>확인할 내용 {preview.warnings.length}건</strong><ul>{preview.warnings.slice(0, 8).map((warning, index) => <li key={index}>{String(warning)}</li>)}</ul>{preview.warnings.length > 8 && <p>그 외 {preview.warnings.length - 8}건이 있습니다.</p>}</div>}<div className="dr-import-coverage"><span>원본 파일 전체 보관</span><span>{preview.sheetSummaries.length}개 시트 · 입력 셀 {preview.sheetSummaries.reduce((sum, sheet) => sum + sheet.populatedCells, 0).toLocaleString('ko-KR')}개</span></div>{preview.unclassifiedRows.length > 0 && <details className="dr-import-review-preview"><summary>분류 대기 {preview.unclassifiedRows.length}건 확인 · 원본 그대로 함께 저장</summary><p className="dr-form-help">아래 행은 월·현장을 추정하지 않고 원본 위치와 내용을 보관합니다. 가져온 뒤 원본 보관함에서 다시 확인할 수 있습니다.</p><SourceReviewRows rows={preview.unclassifiedRows} /></details>}<div className="dr-preview-list">{preparedImport.slice(0, 40).map((claim) => <div key={claim.id}><span><strong>{claim.workerName}</strong><small>{claim.month} · {claim.siteName}</small></span><span>{delegationLabels[claim.delegationType]}<small>원본 세전 {won(claim.grossAmount)}</small><small>세후 예정 {won(claim.expectedAmount)}</small></span></div>)}</div>{preview.claims.length > 40 && <p className="dr-form-help">미리보기는 앞 40건을 표시합니다. 전체 {preview.claims.length}건이 저장 대상입니다.</p>}{dialogError && <p role="alert" className="dr-form-error">{dialogError}</p>}<div className="dr-import-actions"><button className="dr-button" onClick={closeDialog} disabled={saving}>취소</button><button className="dr-button dr-button-primary" disabled={saving || !previewBytes || !canWrite || (importTax !== '' && (!Number.isFinite(Number(importTax)) || Number(importTax) < 0 || Number(importTax) > 100))} onClick={() => { const importing = preparedImport; const originalBytes = previewBytes; if (!originalBytes) return; void runSave(async () => { const result = await archiveService.importWorkbook(originalBytes, previewName, preview, importing); setArchiveRequested(true); setArchiveReload((value) => value + 1); setMonth(availableMonths[availableMonths.length - 1] || month); resetFilters(); return `원본 전체 보관 완료 · 관리 ${result.added}건 추가 · 기존 ${result.skipped}건 유지 · 분류 대기 ${result.reviewRows}건 보관`; }, '엑셀 내역을 가져왔습니다. 받을 예정 금액을 확인해 주세요.'); }}>{saving ? '원본과 내역 저장 중…' : `원본과 전체 ${preview.claims.length + preview.unclassifiedRows.length}건 저장`}</button></div></div>
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
