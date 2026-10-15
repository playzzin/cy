import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Plus, RefreshCw, Save, Wrench } from 'lucide-react';
import type { Vehicle } from '../../types/vehicle';
import { getSupportManagementYearMonth, rememberSupportManagementYearMonth, subscribeSupportManagementYearMonth } from '../../utils/supportManagementState';
import { useIssueNavigationGuard } from '../../pages/taxinvoice/useIssueNavigationGuard';
import { vehicleRepairService } from './service';
import { classifyRepairImport, COST_KEYS, COST_LABELS, CostKey, emptyCosts, formatRepairAmount, matchRepairVehicles, parseRepairWorkbook, RepairRecord, repairReviewNotes, repairTotal, savedRepairRecord } from './model';
import { changeDraftAmount, createRepairDraft, hasRepairDraftChanges, invalidDraftAmounts, parseRepairAmountInput, RepairDraft, repairDraftIssues } from './draft';
import './VehicleRepairLedger.css';

const errorText = (error: unknown) => String((error as { code?: string })?.code ?? '').includes('permission-denied')
  ? '정비내역에 접근할 권한이 없습니다. 지원업무 권한을 확인해 주세요.'
  : error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해 주세요.';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const blankRecord = (period: string): RepairRecord => ({ id: `vehicle_repair_${crypto.randomUUID()}`, date: period === today().slice(0, 7) ? today() : `${period}-01`, yearMonth: period, originalDate: '', vehicleId: '', vehiclePlate: '', description: '', driver: '', vendor: '신대지자동차', costs: emptyCosts(), memo: '', issues: [], archived: false, revision: 0 });

function exportCsv(rows: RepairRecord[]) {
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const data = [['정비일', '차량번호', '정비내용', '운전자', '정비업체', ...COST_KEYS.map(key => COST_LABELS[key]), '합계', '비고', '확인사항', '원본 시트', '원본 위치'],
    ...rows.map(row => [row.date || row.originalDate, row.vehiclePlate, row.description, row.driver, row.vendor, ...COST_KEYS.map(key => row.costs[key]), repairTotal(row), row.memo, row.issues.join(' / '), row.source?.sheet, row.source?.cell])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + data.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `차량_정비내역_${today()}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AmountInput({ value, raw, label, disabled, onChange }: { value: number | null; raw?: string; label: string; disabled: boolean; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { if (focused) inputRef.current?.select(); }, [focused]);
  const invalid = raw !== undefined && !parseRepairAmountInput(raw).valid;
  const text = invalid ? raw : focused ? raw ?? (value === null ? '' : String(value)) : value === null ? '' : formatRepairAmount(value);
  return <input ref={inputRef} type="text" inputMode="decimal" aria-label={label} aria-invalid={invalid} disabled={disabled} value={text} placeholder="—"
    onFocus={() => setFocused(true)}
    onChange={event => onChange(event.target.value)} onBlur={() => setFocused(false)} />;
}

type Props = { vehicles: Vehicle[]; onBeforeLeaveChange?: (guard: (() => boolean) | null) => void };
export default function VehicleRepairLedger({ vehicles, onBeforeLeaveChange }: Props) {
  const [records, setRecords] = useState<RepairRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [yearMonth, setYearMonth] = useState(getSupportManagementYearMonth);
  const [allPeriods, setAllPeriods] = useState(false);
  const [cost, setCost] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [sticky, setSticky] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, RepairDraft>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [focusId, setFocusId] = useState('');
  const [preview, setPreview] = useState<RepairRecord[] | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const loadSequence = useRef(0);
  const changedDrafts = useMemo(() => Object.values(drafts).filter(hasRepairDraftChanges), [drafts]);
  const changedIds = useMemo(() => new Set(changedDrafts.map(draft => draft.record.id)), [changedDrafts]);
  const draftCount = changedDrafts.length;
  const pending = useRef({ dirty: false, busy: false });
  pending.current = { dirty: draftCount > 0, busy };

  const canLeave = useCallback(() => {
    if (pending.current.busy) { window.alert('저장이 끝난 후 이동해 주세요.'); return false; }
    if (pending.current.dirty && !window.confirm('저장하지 않은 정비내역이 있습니다. 변경사항을 취소하고 이동할까요?')) return false;
    pending.current.dirty = false;
    setDrafts({}); setRowErrors({}); setError('');
    return true;
  }, []);
  useIssueNavigationGuard(draftCount > 0 || busy, canLeave);
  useEffect(() => { onBeforeLeaveChange?.(canLeave); return () => onBeforeLeaveChange?.(null); }, [onBeforeLeaveChange, canLeave]);

  const refresh = async () => {
    if (pending.current.dirty) return;
    const sequence = ++loadSequence.current;
    setLoading(true); setError(''); setDrafts({}); setRowErrors({});
    try { const next = await vehicleRepairService.list(); if (sequence === loadSequence.current) setRecords(next); }
    catch (error) { if (sequence === loadSequence.current) setError(errorText(error)); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  };
  useEffect(() => { void refresh(); return () => { loadSequence.current++; }; }, []);
  useEffect(() => { setPage(1); }, [yearMonth, allPeriods, cost, search, status]);
  useEffect(() => subscribeSupportManagementYearMonth(next => {
    if (next === yearMonth) return;
    if (canLeave()) { setYearMonth(next); setAllPeriods(false); }
    else rememberSupportManagementYearMonth(yearMonth);
  }), [yearMonth, canLeave]);
  useEffect(() => { if (focusId) document.getElementById(`repair-date-${focusId}`)?.focus(); }, [focusId]);

  const changeMonth = (next: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next) || !canLeave()) return;
    setYearMonth(next); setAllPeriods(false); rememberSupportManagementYearMonth(next);
  };
  const stepMonth = (offset: number) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    changeMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };
  const filtered = useMemo(() => {
    const order = new Map(records.slice().sort((a, b) => (b.date || b.yearMonth).localeCompare(a.date || a.yearMonth) || a.id.localeCompare(b.id)).map((row, index) => [row.id, index]));
    const added = Object.values(drafts).map(draft => draft.record).filter(row => row.revision === 0);
    added.forEach((row, index) => order.set(row.id, -index - 1));
    const rows = [...records.map(row => drafts[row.id]?.record ?? row), ...added];
    return rows.filter(row => {
      if (changedIds.has(row.id)) return true; // Keep unsaved rows visible while their date or search fields change.
      if (status === 'archived' ? !row.archived : row.archived) return false;
      if (status === 'review' && !row.issues.length) return false;
      if (!allPeriods && row.yearMonth !== yearMonth) return false;
      if (cost && row.costs[cost as CostKey] === null) return false;
      const query = search.replace(/\s/g, '').toLowerCase();
      return !query || [row.vehiclePlate, row.description, row.driver, row.vendor, row.memo].some(value => value.replace(/\s/g, '').toLowerCase().includes(query));
    }).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [records, drafts, changedIds, yearMonth, allPeriods, cost, search, status]);
  const invalidAmounts = useMemo(() => new Set(changedDrafts.filter(draft => invalidDraftAmounts(draft).length).map(draft => draft.record.id)), [changedDrafts]);
  const hasInvalidAmounts = filtered.some(row => invalidAmounts.has(row.id));
  const totals = useMemo(() => COST_KEYS.reduce((result, key) => ({ ...result, [key]: Math.round(filtered.reduce((sum, row) => sum + (Number.isFinite(row.costs[key]) ? row.costs[key]! : 0), 0) * 100) / 100 }), {} as Record<CostKey, number>), [filtered]);
  const total = Math.round(COST_KEYS.reduce((sum, key) => sum + totals[key], 0) * 100) / 100;
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 50, currentPage * 50);
  const importPlan = useMemo(() => preview ? classifyRepairImport(preview, records) : null, [preview, records]);

  const updateRow = (row: RepairRecord, patch: Partial<RepairRecord>) => {
    if (lock.current) return;
    if (!changedIds.has(row.id) && draftCount >= 100) { setError('한 번에 100건까지 편집할 수 있습니다. 먼저 저장해 주세요.'); return; }
    setDrafts(current => {
      const draft = current[row.id] ?? createRepairDraft(row);
      return { ...current, [row.id]: { ...draft, record: { ...draft.record, ...patch } } };
    });
    setRowErrors(current => { const next = { ...current }; delete next[row.id]; return next; });
    setNotice('');
  };
  const updateAmount = (row: RepairRecord, key: CostKey, text: string) => {
    if (lock.current || (!changedIds.has(row.id) && draftCount >= 100)) return;
    setDrafts(current => ({ ...current, [row.id]: changeDraftAmount(current[row.id] ?? createRepairDraft(row), key, text) }));
    setRowErrors(current => { const next = { ...current }; delete next[row.id]; return next; });
    setNotice('');
  };
  const addRow = () => {
    if (lock.current || draftCount >= 100) return;
    const row = blankRecord(yearMonth);
    setDrafts(current => ({ ...current, [row.id]: createRepairDraft(row) })); setPage(1); setFocusId(row.id); setNotice('');
  };
  const undoRow = (id: string) => {
    setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
    setRowErrors(current => { const next = { ...current }; delete next[id]; return next; });
    setError('');
  };
  const save = async () => {
    if (lock.current || !draftCount) return;
    const next = matchRepairVehicles(changedDrafts.map(({ record }) => ({ ...record, yearMonth: record.date.slice(0, 7) })), vehicles);
    const errors = Object.fromEntries(changedDrafts.map(draft => [draft.record.id, repairDraftIssues(draft).join(' · ')]).filter(([, value]) => value));
    setRowErrors(errors);
    if (Object.keys(errors).length) { const index = filtered.findIndex(row => errors[row.id]); setPage(Math.floor(Math.max(0, index) / 50) + 1); setError('표에 표시된 입력 항목을 확인해 주세요. 아직 저장되지 않았습니다.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      await vehicleRepairService.saveRows(next);
      const saved = new Map(next.map(row => [row.id, savedRepairRecord(row)]));
      setRecords(current => [...current.map(row => saved.get(row.id) ?? row), ...next.filter(row => row.revision === 0).map(row => saved.get(row.id)!)]);
      setDrafts({}); setRowErrors({}); setNotice(`${next.length}건의 정비내역을 저장했습니다.`);
    } catch (error) { setError(errorText(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  const readFile = async (file?: File) => {
    if (!file || lock.current || draftCount) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('15MB 이하 엑셀 파일을 선택해 주세요.');
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setPreview(matchRepairVehicles(parseRepairWorkbook(workbook, file.name), vehicles)); setProgress(0);
    } catch (error) { setError(errorText(error)); }
    finally { lock.current = false; setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const commitImport = async () => {
    if (!preview || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await vehicleRepairService.importRecords(preview, setProgress);
      setNotice(`${result.added}건을 가져왔습니다. 기존 ${result.skipped}건과 원본 변경 ${result.conflicts}건은 유지했습니다.`);
      setPreview(null); await refresh();
    } catch (error) { await refresh(); setError(`${errorText(error)} 완료된 기록은 보존됩니다. 다시 가져오면 이미 저장된 기록을 건너뜁니다.`); }
    finally { lock.current = false; setBusy(false); }
  };
  const archive = async (row: RepairRecord) => {
    if (lock.current || draftCount || !window.confirm(row.archived ? '이 정비내역을 복원할까요?' : '이 정비내역을 보관할까요? 보관함에서 다시 복원할 수 있습니다.')) return;
    lock.current = true; setBusy(true); setError('');
    try { await vehicleRepairService.archive(row); setNotice(row.archived ? '정비내역을 복원했습니다.' : '정비내역을 보관했습니다.'); await refresh(); }
    catch (error) { setError(errorText(error)); }
    finally { lock.current = false; setBusy(false); }
  };

  return <section className="repair-ledger" aria-label="차량 정비내역 관리" aria-busy={busy}>
    <div className="repair-toolbar">
      <div className="repair-toolbar-title">
        <div className="repair-month-nav"><button type="button" aria-label="정비 이전 달" disabled={busy} onClick={() => stepMonth(-1)}><ChevronLeft size={18} /></button><input type="month" aria-label="정비 조회 월" value={yearMonth} disabled={busy} onChange={event => changeMonth(event.target.value)} /><button type="button" aria-label="정비 다음 달" disabled={busy} onClick={() => stepMonth(1)}><ChevronRight size={18} /></button></div>
        <h2><Wrench size={21} /> 월별 정비내역 대장</h2>
        {draftCount > 0 && <span className="repair-dirty">수정사항 {draftCount}건</span>}
      </div>
      <div className="repair-actions">
        <div className="repair-toolbar-total"><span>{draftCount ? '입력 포함 합계' : '총 합계'}</span><strong>{hasInvalidAmounts ? '금액 확인 필요' : formatRepairAmount(total)}{!hasInvalidAmounts && <small>원</small>}</strong></div>
        <button type="button" onClick={() => void refresh()} disabled={busy || loading || draftCount > 0} aria-label="정비내역 새로고침"><RefreshCw size={16} /></button>
        <label className="repair-sticky-toggle"><input type="checkbox" checked={sticky} onChange={event => setSticky(event.target.checked)} /> 목록 고정</label>
        <button type="button" className="repair-export" onClick={() => exportCsv(filtered)} disabled={busy || loading || !filtered.length || draftCount > 0}><Download size={16} /> 엑셀용 CSV</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || loading || draftCount > 0 || Boolean(error)}><FileSpreadsheet size={16} /> 엑셀 가져오기</button>
        <button type="button" onClick={addRow} disabled={busy || loading || status === 'archived' || draftCount >= 100}><Plus size={16} /> 행 추가</button>
        <button type="button" className="repair-primary" onClick={() => void save()} disabled={busy || loading || !draftCount}><Save size={16} /> {busy ? '저장 중…' : '저장'}</button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="정비 엑셀 파일" hidden onChange={event => void readFile(event.target.files?.[0])} />
      </div>
    </div>
    {error && <div role="alert" className="repair-error">{error} {!draftCount && <button type="button" disabled={busy} onClick={() => void refresh()}>다시 조회</button>}</div>}
    {notice && <div role="status" className="repair-notice">{notice}</div>}
    <div className="repair-filters">
      <button type="button" className={allPeriods ? 'repair-period-active' : ''} aria-pressed={allPeriods} disabled={busy} onClick={() => { if (canLeave()) setAllPeriods(!allPeriods); }}>전체 기간</button>
      <label>비용 구분<select aria-label="정비 비용 구분" value={cost} onChange={event => setCost(event.target.value)}><option value="">전체 구분</option>{COST_KEYS.map(key => <option key={key} value={key}>{COST_LABELS[key]}</option>)}</select></label>
      <label>상태<select aria-label="정비 상태" value={status} disabled={busy || draftCount > 0} onChange={event => setStatus(event.target.value)}><option value="active">전체 내역</option><option value="review">확인 필요</option><option value="archived">보관함</option></select></label>
      <label className="repair-search">검색<input value={search} onChange={event => setSearch(event.target.value)} placeholder="차량번호, 정비내용, 운전자, 업체" /></label>
      <button type="button" onClick={() => { setCost(''); setStatus('active'); setSearch(''); }}>초기화</button>
      <span className="repair-count">{allPeriods ? '전체 기간' : yearMonth} · {filtered.length}건</span>
      {draftCount > 0 && <button type="button" disabled={busy} onClick={() => { if (window.confirm('저장하지 않은 변경사항을 모두 취소할까요?')) { setDrafts({}); setRowErrors({}); setError(''); } }}>변경 취소</button>}
    </div>
    <datalist id="repair-vehicle-options">{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.licensePlate}>{vehicle.model}</option>)}</datalist>
    <div className={`repair-table-wrap${sticky ? ' repair-table-fixed' : ''}`}>
      <table><caption className="sr-only">차량 정비내역 입력 대장</caption><colgroup><col style={{ width: 140 }} /><col style={{ width: 130 }} /><col style={{ width: 200 }} /><col style={{ width: 110 }} /><col style={{ width: 125 }} />{COST_KEYS.map(key => <col key={key} style={{ width: 110 }} />)}<col style={{ width: 120 }} /><col style={{ width: 160 }} /><col style={{ width: 90 }} /></colgroup>
        <thead><tr><th>정비일</th><th>차량번호</th><th>정비내용</th><th>운전자</th><th>정비업체</th>{COST_KEYS.map(key => <th className="repair-number" key={key}>{COST_LABELS[key]}{key === 'cheongyeon' && <small>VAT포함</small>}</th>)}<th className="repair-number">합계</th><th>비고</th><th>관리</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={12} className="repair-empty">정비내역을 불러오는 중입니다.</td></tr> : !visible.length ? <tr><td colSpan={12} className="repair-empty">{status === 'archived' ? '보관한 정비내역이 없습니다.' : '조회 조건에 맞는 정비내역이 없습니다. 행 추가로 입력하거나 전체 기간을 확인해 주세요.'}</td></tr> : visible.map((row, index) => {
          const label = `${(currentPage - 1) * 50 + index + 1}행`;
          const disabled = busy || row.archived || (draftCount >= 100 && !changedIds.has(row.id));
          return <tr key={row.id} className={`${changedIds.has(row.id) ? 'repair-row-dirty' : ''} ${rowErrors[row.id] || invalidAmounts.has(row.id) ? 'repair-row-error' : ''}`}>
            <td><input id={`repair-date-${row.id}`} aria-label={`${label} 정비일`} type="date" value={row.date} disabled={disabled} onChange={event => updateRow(row, { date: event.target.value })} />{!row.date && row.originalDate && <small>원본: {row.originalDate}</small>}{row.issues.length > 0 && <span className="repair-review" title={row.issues.join(' · ')}>확인 필요</span>}{row.revision === 0 && <span className="repair-new">신규</span>}{rowErrors[row.id] && <span role="alert" className="repair-cell-error">{rowErrors[row.id]}</span>}</td>
            <td><input aria-label={`${label} 차량번호`} list="repair-vehicle-options" value={row.vehiclePlate} disabled={disabled} placeholder="차량번호 입력" onChange={event => updateRow(row, { vehiclePlate: event.target.value })} />{!row.vehicleId && row.revision > 0 && <small>과거 / 미연결 차량</small>}</td>
            <td><input aria-label={`${label} 정비내용`} value={row.description} title={row.description} disabled={disabled} placeholder="정비내용 입력" onChange={event => updateRow(row, { description: event.target.value })} />{row.source && <small>{row.source.sheet} · {row.source.cell}</small>}</td>
            <td><input aria-label={`${label} 운전자`} value={row.driver} disabled={disabled} placeholder="—" onChange={event => updateRow(row, { driver: event.target.value })} /></td>
            <td><input aria-label={`${label} 정비업체`} value={row.vendor} disabled={disabled} placeholder="업체 입력" onChange={event => updateRow(row, { vendor: event.target.value })} /></td>
            {COST_KEYS.map(key => <td className="repair-number repair-cost-cell" key={key}><AmountInput value={row.costs[key]} raw={drafts[row.id]?.amountInputs[key]} label={`${label} ${COST_LABELS[key]} 금액`} disabled={disabled} onChange={text => updateAmount(row, key, text)} /></td>)}
            <td className="repair-number repair-row-total">{invalidAmounts.has(row.id) ? '확인 필요' : formatRepairAmount(repairTotal(row))}</td>
            <td><input aria-label={`${label} 비고`} value={row.memo} title={row.memo} disabled={disabled} placeholder="—" onChange={event => updateRow(row, { memo: event.target.value })} />{repairReviewNotes(drafts[row.id]?.original ?? row).length > 0 && <label className="repair-review-check"><input type="checkbox" aria-label={`${label} 비용 메모 확인 완료`} disabled={disabled} checked={repairReviewNotes(row).length === 0} onChange={event => updateRow(row, { issues: event.target.checked ? row.issues.filter(issue => !repairReviewNotes(row).includes(issue)) : Array.from(new Set([...row.issues, ...repairReviewNotes(drafts[row.id]?.original ?? row)])) })} />비용 메모 확인 완료</label>}</td>
            <td>{changedIds.has(row.id) ? <button type="button" disabled={busy} onClick={() => undoRow(row.id)}>{row.revision === 0 ? '행 취소' : '되돌리기'}</button> : <button type="button" disabled={busy || draftCount > 0} onClick={() => void archive(row)}>{row.archived ? '복원' : '보관'}</button>}</td>
          </tr>;
        })}</tbody>
        <tfoot><tr><th colSpan={5}>조회 내역 합계 ({filtered.length}건)</th>{COST_KEYS.map(key => <td className="repair-number" key={key}>{filtered.some(row => drafts[row.id] && invalidDraftAmounts(drafts[row.id]).includes(key)) ? '확인 필요' : formatRepairAmount(totals[key])}</td>)}<td className="repair-number repair-total-cell">{hasInvalidAmounts ? '확인 필요' : formatRepairAmount(total)}</td><td colSpan={2}>{draftCount > 0 ? '저장 전 입력 포함' : '저장된 내역'}</td></tr></tfoot>
      </table>
    </div>
    <div className="repair-footer"><span>표에서 바로 입력 · Tab 키로 다음 칸 이동</span><div><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></div>
    <div className="repair-guide"><strong>입력 가이드</strong><p><b>행 추가</b>로 정비일·차량번호·정비내용·비용을 입력한 뒤 상단 <b>저장</b>을 누르세요. 기존 내역도 표에서 바로 수정할 수 있습니다. 빈 비용은 미입력, 0은 0원으로 저장됩니다.</p><p>청연(VAT포함) 금액은 원본 그대로 보존합니다. 정비내역 저장은 월별 청구 금액에 자동 합산되지 않습니다.</p></div>

    <Dialog.Root open={Boolean(preview)} onOpenChange={open => { if (!open && !busy) setPreview(null); }}><Dialog.Portal><Dialog.Overlay className="repair-overlay" /><Dialog.Content className="repair-dialog repair-import-dialog" onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <Dialog.Title>엑셀 정비내역 가져오기</Dialog.Title><Dialog.Description>월별 합계 행을 제외하고 개별 정비 이력만 가져옵니다. 기존 기록은 덮어쓰지 않습니다.</Dialog.Description>
      {preview && importPlan && <><div className="repair-import-summary"><strong>원본 {preview.length}건</strong><span>신규 {importPlan.added.length}건</span><span>이미 등록 {importPlan.duplicates.length}건</span><span>원본 변경 {importPlan.conflicts.length}건</span></div>
        <p>신규 정비비 합계 <strong>{formatRepairAmount(Math.round(importPlan.added.reduce((sum, row) => sum + repairTotal(row), 0) * 100) / 100)}원</strong></p>
        <p>확인 필요 {preview.filter(row => row.issues.length).length}건 · 현재 차량과 미연결 {preview.filter(row => !row.vehicleId).length}건</p>
        <p className="repair-help">날짜 오류와 미연결 차량도 원본 이력으로 보존되며, 가져온 후 수정할 수 있습니다.</p>
        <div className="repair-import-preview"><table><thead><tr><th>원본 위치</th><th>건수</th><th className="repair-number">금액</th></tr></thead><tbody>{Array.from(new Set(preview.map(row => row.source?.sheet))).map(sheet => <tr key={sheet}><td>{sheet}</td><td>{preview.filter(row => row.source?.sheet === sheet).length}</td><td className="repair-number">{formatRepairAmount(Math.round(preview.filter(row => row.source?.sheet === sheet).reduce((sum, row) => sum + repairTotal(row), 0) * 100) / 100)}</td></tr>)}</tbody></table></div>
        {preview.some(row => row.issues.length) && <div className="repair-import-issues">{preview.filter(row => row.issues.length).map(row => <p key={row.id}>{row.source?.sheet} {row.source?.cell}: {row.issues.join(' · ')}{!row.date ? ` (${row.originalDate})` : ''}</p>)}</div>}
        {error && <div role="alert" className="repair-error">{error}</div>}
        <div className="repair-dialog-actions"><button type="button" disabled={busy} onClick={() => setPreview(null)}>닫기</button><button type="button" className="repair-primary" disabled={busy || !importPlan.added.length} onClick={() => void commitImport()}>{busy ? `가져오는 중 ${progress} / ${preview.length}` : `${importPlan.added.length}건 가져오기`}</button></div></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>


  </section>;
}
