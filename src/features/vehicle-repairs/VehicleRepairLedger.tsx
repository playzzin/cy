import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, FileSpreadsheet, Plus, RefreshCw, Wrench, X } from 'lucide-react';
import type { Vehicle } from '../../types/vehicle';
import { vehicleRepairService } from './service';
import { classifyRepairImport, COST_KEYS, COST_LABELS, CostKey, emptyCosts, formatRepairAmount, matchRepairVehicles, normalizePlate, parseRepairWorkbook, RepairRecord, repairIssues, repairTotal } from './model';
import './VehicleRepairLedger.css';

const errorText = (error: unknown) => String((error as { code?: string })?.code ?? '').includes('permission-denied')
  ? '정비내역에 접근할 권한이 없습니다. 지원업무 권한을 확인해 주세요.'
  : error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해 주세요.';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const blankRecord = (): RepairRecord => ({ id: `vehicle_repair_${crypto.randomUUID()}`, date: today(), yearMonth: today().slice(0, 7), originalDate: '', vehicleId: '', vehiclePlate: '', description: '', driver: '', vendor: '신대지자동차', costs: emptyCosts(), memo: '', issues: [], archived: false, revision: 0 });

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

export default function VehicleRepairLedger({ vehicles }: { vehicles: Vehicle[] }) {
  const [records, setRecords] = useState<RepairRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [cost, setCost] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<RepairRecord | null>(null);
  const [editError, setEditError] = useState('');
  const [preview, setPreview] = useState<RepairRecord[] | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const loadSequence = useRef(0);

  const refresh = async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try { const next = await vehicleRepairService.list(); if (sequence === loadSequence.current) setRecords(next); }
    catch (error) { if (sequence === loadSequence.current) setError(errorText(error)); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  };
  useEffect(() => { void refresh(); return () => { loadSequence.current++; }; }, []);
  useEffect(() => { setPage(1); }, [year, month, cost, search, status]);

  const years = useMemo(() => Array.from(new Set(records.map(row => row.yearMonth.slice(0, 4)).filter(Boolean))).sort().reverse(), [records]);
  const filtered = useMemo(() => records.filter(row => {
    if (status === 'archived' ? !row.archived : row.archived) return false;
    if (status === 'review' && !row.issues.length) return false;
    if (year && !row.yearMonth.startsWith(year)) return false;
    if (month && row.yearMonth.slice(5, 7) !== month) return false;
    if (cost && row.costs[cost as CostKey] === null) return false;
    const query = search.replace(/\s/g, '').toLowerCase();
    return !query || [row.vehiclePlate, row.description, row.driver, row.vendor, row.memo].some(value => value.replace(/\s/g, '').toLowerCase().includes(query));
  }).sort((a, b) => (b.date || b.yearMonth).localeCompare(a.date || a.yearMonth) || a.id.localeCompare(b.id)), [records, year, month, cost, search, status]);
  const totals = useMemo(() => COST_KEYS.reduce((result, key) => ({ ...result, [key]: Math.round(filtered.reduce((sum, row) => sum + (row.costs[key] ?? 0), 0) * 100) / 100 }), {} as Record<CostKey, number>), [filtered]);
  const total = Math.round(COST_KEYS.reduce((sum, key) => sum + totals[key], 0) * 100) / 100;
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 50, currentPage * 50);
  const importPlan = useMemo(() => preview ? classifyRepairImport(preview, records) : null, [preview, records]);

  const readFile = async (file?: File) => {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('15MB 이하 엑셀 파일을 선택해 주세요.');
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setPreview(matchRepairVehicles(parseRepairWorkbook(workbook, file.name), vehicles));
      setProgress(0);
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
    } catch (error) {
      await refresh();
      setError(`${errorText(error)} 완료된 기록은 보존됩니다. 다시 가져오면 이미 저장된 기록을 건너뜁니다.`);
    } finally { lock.current = false; setBusy(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || lock.current) return;
    const next = matchRepairVehicles([{ ...editing, yearMonth: editing.date.slice(0, 7) }], vehicles)[0];
    const issues = repairIssues(next);
    if (issues.length) { setEditError(issues.join(' · ')); return; }
    lock.current = true; setBusy(true); setEditError('');
    try { await vehicleRepairService.save(next); setEditing(null); setNotice('정비내역을 저장했습니다.'); await refresh(); }
    catch (error) { setEditError(errorText(error)); }
    finally { lock.current = false; setBusy(false); }
  };

  const archive = async (row: RepairRecord) => {
    if (lock.current || !window.confirm(row.archived ? '이 정비내역을 복원할까요?' : '이 정비내역을 보관할까요? 보관함에서 다시 복원할 수 있습니다.')) return;
    lock.current = true; setBusy(true); setError('');
    try { await vehicleRepairService.archive(row); setNotice(row.archived ? '정비내역을 복원했습니다.' : '정비내역을 보관했습니다.'); await refresh(); }
    catch (error) { setError(errorText(error)); }
    finally { lock.current = false; setBusy(false); }
  };

  return <section className="repair-ledger" aria-label="차량 정비내역 관리">
    <div className="repair-heading">
      <div><div className="repair-eyebrow"><Wrench size={15} /> VEHICLE MAINTENANCE</div><h2>차량 정비내역</h2><p>차량별 수리 이력과 개인·회사 부담금을 한곳에서 관리합니다.</p></div>
      <div className="repair-actions">
        <button type="button" onClick={() => void refresh()} disabled={busy || loading} aria-label="정비내역 새로고침"><RefreshCw size={16} /></button>
        <button type="button" onClick={() => exportCsv(filtered)} disabled={busy || loading || !filtered.length}><Download size={16} /> 엑셀용 CSV</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || loading || Boolean(error)}><FileSpreadsheet size={16} /> 엑셀 가져오기</button>
        <button type="button" className="repair-primary" onClick={() => { setEditing(blankRecord()); setEditError(''); }} disabled={busy || loading}><Plus size={16} /> 정비 등록</button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="정비 엑셀 파일" hidden onChange={event => void readFile(event.target.files?.[0])} />
      </div>
    </div>
    {error && <div role="alert" className="repair-error">{error} <button type="button" onClick={() => void refresh()}>다시 조회</button></div>}
    {notice && <div role="status" className="repair-notice">{notice}</div>}
    <div className="repair-stats">
      <div><span>조회 정비내역</span><strong>{filtered.length.toLocaleString()}<small>건</small></strong><p>{new Set(filtered.map(row => normalizePlate(row.vehiclePlate))).size}대의 차량</p></div>
      <div className="repair-stat-total"><span>정비비 합계</span><strong>{formatRepairAmount(total)}<small>원</small></strong><p>선택한 조회 조건 기준</p></div>
      <div><span>개인 부담</span><strong>{formatRepairAmount(totals.personal)}<small>원</small></strong><p>엑셀의 개인 비용 구분</p></div>
      <div><span>회사 부담</span><strong>{formatRepairAmount(Math.round((total - totals.personal) * 100) / 100)}<small>원</small></strong><p>청연 · 조은 · 법인 미구분</p></div>
    </div>
    <div className="repair-filters">
      <label>연도<select aria-label="정비 연도" value={year} onChange={event => setYear(event.target.value)}><option value="">전체 연도</option>{years.map(value => <option key={value} value={value}>{value}년</option>)}</select></label>
      <label>월<select aria-label="정비 월" value={month} onChange={event => setMonth(event.target.value)}><option value="">전체 월</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{i + 1}월</option>)}</select></label>
      <label>비용 구분<select value={cost} onChange={event => setCost(event.target.value)}><option value="">전체 구분</option>{COST_KEYS.map(key => <option key={key} value={key}>{COST_LABELS[key]}</option>)}</select></label>
      <label>상태<select value={status} onChange={event => setStatus(event.target.value)}><option value="active">전체 내역</option><option value="review">확인 필요</option><option value="archived">보관함</option></select></label>
      <label className="repair-search">검색<input value={search} onChange={event => setSearch(event.target.value)} placeholder="차량번호, 정비내용, 운전자, 업체" /></label>
      <button type="button" onClick={() => { setYear(''); setMonth(''); setCost(''); setStatus('active'); setSearch(''); }}>초기화</button>
    </div>
    <div className="repair-table-wrap">
      <table><caption className="sr-only">차량 정비 이력과 비용 구분별 금액</caption><thead><tr><th>정비일</th><th>차량번호</th><th>정비내용 / 업체</th><th>운전자</th>{COST_KEYS.map(key => <th className="repair-number" key={key}>{COST_LABELS[key]}</th>)}<th className="repair-number">합계</th><th>관리</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={10} className="repair-empty">정비내역을 불러오는 중입니다.</td></tr> : !visible.length ? <tr><td colSpan={10} className="repair-empty">{records.length ? '조회 조건에 맞는 정비내역이 없습니다.' : '엑셀을 가져오거나 첫 정비내역을 등록해 주세요.'}</td></tr> : visible.map(row => <tr key={row.id}>
          <td><span className="repair-date">{row.date || `${row.yearMonth} · ${row.originalDate || '미입력'}`}</span>{row.issues.length > 0 && <span className="repair-review" title={row.issues.join(' · ')}>확인 필요</span>}</td>
          <td><strong>{row.vehiclePlate || '미입력'}</strong>{!row.vehicleId && <small>과거 / 미연결 차량</small>}</td>
          <td className="repair-description"><span>{row.description}</span><small>{row.vendor}{row.memo ? ` · ${row.memo}` : ''}</small>{row.source && <small className="repair-source">{row.source.sheet} · {row.source.cell}</small>}</td>
          <td className="repair-driver">{row.driver || '—'}</td>
          {COST_KEYS.map(key => <td className="repair-number" key={key}>{formatRepairAmount(row.costs[key])}</td>)}
          <td className="repair-number repair-row-total">{formatRepairAmount(repairTotal(row))}</td>
          <td><div className="repair-row-actions"><button type="button" disabled={busy} onClick={() => { setEditing({ ...row, costs: { ...row.costs } }); setEditError(''); }}>수정</button><button type="button" disabled={busy} onClick={() => void archive(row)}>{row.archived ? '복원' : '보관'}</button></div></td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={4}>조회 내역 합계 ({filtered.length}건)</th>{COST_KEYS.map(key => <td className="repair-number" key={key}>{formatRepairAmount(totals[key])}</td>)}<td className="repair-number">{formatRepairAmount(total)}</td><td /></tr></tfoot>
      </table>
    </div>
    <div className="repair-footer"><p>청연(VAT포함) 금액은 원본 그대로 보존합니다. 정비 이력 저장은 월별 청구 금액에 자동 합산되지 않습니다.</p><div><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></div>

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

    <Dialog.Root open={Boolean(editing)} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><Dialog.Portal><Dialog.Overlay className="repair-overlay" /><Dialog.Content className="repair-dialog" onInteractOutside={event => event.preventDefault()}>
      <div className="repair-dialog-heading"><Dialog.Title>{editing?.revision ? '정비내역 수정' : '정비내역 등록'}</Dialog.Title><button type="button" onClick={() => setEditing(null)} disabled={busy} aria-label="정비 편집 닫기"><X size={20} /></button></div>
      <Dialog.Description>정비일, 차량번호, 정비내용과 비용을 입력해 주세요.</Dialog.Description>
      {editing && <form onSubmit={save}><div className="repair-form-grid">
        <label>정비일<input type="date" required value={editing.date} onChange={event => setEditing({ ...editing, date: event.target.value })} />{!editing.date && editing.originalDate && <small>원본: {editing.originalDate}</small>}</label>
        <label>차량번호<input required list="repair-vehicle-options" value={editing.vehiclePlate} onChange={event => setEditing({ ...editing, vehiclePlate: event.target.value })} placeholder="직접 입력 또는 등록 차량 선택" /><datalist id="repair-vehicle-options">{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.licensePlate}>{vehicle.model}</option>)}</datalist></label>
        <label className="repair-form-wide">정비내용<textarea required rows={2} value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} /></label>
        <label>운전자<input value={editing.driver} onChange={event => setEditing({ ...editing, driver: event.target.value })} /></label>
        <label>정비업체<input value={editing.vendor} onChange={event => setEditing({ ...editing, vendor: event.target.value })} /></label>
        {COST_KEYS.map(key => <label key={key}>{COST_LABELS[key]} 금액 (원)<input type="number" min="0" step="0.01" value={editing.costs[key] ?? ''} placeholder="해당 없으면 비워두세요" onChange={event => setEditing({ ...editing, costs: { ...editing.costs, [key]: event.target.value === '' ? null : Number(event.target.value) } })} /></label>)}
        <label className="repair-form-wide">비고<textarea rows={2} value={editing.memo} onChange={event => setEditing({ ...editing, memo: event.target.value })} /></label>
      </div><p className="repair-form-total">합계 <strong>{formatRepairAmount(repairTotal(editing))}원</strong></p>
        {editing.source && <p className="repair-help">원본: {editing.source.fileName} / {editing.source.sheet} / {editing.source.cell}</p>}
        {editError && <div role="alert" className="repair-error">{editError}</div>}
        <div className="repair-dialog-actions"><button type="button" disabled={busy} onClick={() => setEditing(null)}>취소</button><button type="submit" className="repair-primary" disabled={busy}>{busy ? '저장 중…' : '정비내역 저장'}</button></div>
      </form>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
