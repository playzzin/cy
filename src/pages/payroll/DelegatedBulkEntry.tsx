import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { buildBulkClaims, BulkEntryRow, entryAmounts, newEntryId, pasteEntryAmounts } from '../../features/delegated-receipts/bulkEntry';
import type { DelegatedClaim, DelegationType, DepositStatus, RecipientKind } from '../../features/delegated-receipts/model';
import { depositLabels, recipientLabels } from '../../features/delegated-receipts/depositState';
import { ReceiptDirectory, validTeamColor } from '../../features/delegated-receipts/teamDirectory';
import './DelegatedBulkEntry.css';

interface Props {
  month: string; directory: ReceiptDirectory; existingClaims: DelegatedClaim[]; directoryError?: string;
  onSave: (claims: DelegatedClaim[]) => Promise<{ added: number; skipped: number }>;
  onComplete: (month: string, count: number) => void; onBusy: (busy: boolean) => void; onClose: () => void;
}
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const delegationLabels: Record<DelegationType, string> = { delegate: '위임', direct: '직불', unknown: '미확인' };
const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export default function DelegatedBulkEntry({ month: initialMonth, directory, existingClaims, directoryError, onSave, onComplete, onBusy, onClose }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [siteId, setSiteId] = useState('');
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [defaults, setDefaults] = useState({ delegation: 'delegate' as DelegationType, recipient: 'unknown' as RecipientKind, status: 'unknown' as DepositStatus, taxRate: '' });
  const [rows, setRows] = useState<BulkEntryRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const savingRef = useRef(false);
  const pending = useRef<DelegatedClaim[] | null>(null);
  const amountInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const picker = useRef<HTMLElement>(null);
  useEffect(() => { if (pickerOpen && rows.length) picker.current?.scrollIntoView?.({ block: 'nearest' }); }, [pickerOpen, rows.length]);
  const locked = saving || retry;
  const workers = useMemo(() => [...(directory.workers ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [directory]);
  const sites = useMemo(() => [...directory.sites].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [directory]);
  const visibleWorkers = workers.filter(worker => normalize(worker.name).includes(normalize(search)));
  const availableWorkers = visibleWorkers.filter(worker => !rows.some(row => row.siteId === siteId && row.workerId === worker.id));
  const sameNameCounts = useMemo(() => workers.reduce((map, worker) => map.set(normalize(worker.name), (map.get(normalize(worker.name)) || 0) + 1), new Map<string, number>()), [workers]);
  const workerLabel = (id: string) => {
    const worker = workers.find(worker => worker.id === id);
    const team = directory.teams.find(team => team.id === worker?.teamId);
    return worker ? `${worker.name}${(sameNameCounts.get(normalize(worker.name)) || 0) > 1 ? ` · ${team?.name || '팀 미지정'} · ${worker.id.slice(-6)}` : ''}` : '작업자';
  };
  const amounts = rows.map(row => { try { return entryAmounts(row); } catch { return null; } });
  const missingGross = amounts.filter(value => value?.grossAmount === null).length;
  const missingExpected = amounts.filter(value => value?.expectedAmount === null).length;
  const invalidAmounts = amounts.some(value => value === null);
  const totalGross = amounts.reduce((sum, value) => sum + (value?.grossAmount ?? 0), 0);
  const totalExpected = amounts.reduce((sum, value) => sum + (value?.expectedAmount ?? 0), 0);
  const overlaps = rows.filter(row => {
    const site = sites.find(site => site.id === row.siteId); const worker = workers.find(worker => worker.id === row.workerId);
    return existingClaims.some(claim => claim.month === month && (claim.siteId ? claim.siteId === row.siteId : normalize(claim.siteName) === normalize(site?.name || '')) && (claim.workerId ? claim.workerId === row.workerId : normalize(claim.workerName) === normalize(worker?.name || '')));
  }).length;
  const update = (id: string, patch: Partial<BulkEntryRow>) => { setRows(previous => previous.map(row => row.id === id ? { ...row, ...patch } : row)); setError(''); };
  const amountEvents = (index: number, field: 'gross' | 'expected') => ({
    ref: (element: HTMLInputElement | null) => { amountInputs.current[`${rows[index].id}-${field}`] = element; },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const next = rows[index + (event.shiftKey ? -1 : 1)];
      if (next) { amountInputs.current[`${next.id}-${field}`]?.focus(); amountInputs.current[`${next.id}-${field}`]?.select(); }
    },
    onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData.getData('text');
      if (!/[\t\n\r]/.test(text)) return;
      event.preventDefault();
      try { setRows(pasteEntryAmounts(rows, index, field, text)); setError(''); }
      catch (failure) { setError(failure instanceof Error ? failure.message : '붙여넣을 금액을 확인해 주세요.'); }
    },
  });
  const addChosen = () => {
    if (!siteId) { setError('먼저 현장을 선택해 주세요.'); return; }
    const ids = chosen.filter(id => !rows.some(row => row.siteId === siteId && row.workerId === id));
    if (!ids.length) { setError('추가할 작업자를 선택해 주세요.'); return; }
    if (rows.length + ids.length > 100) { setError('한 번에 100행까지 등록할 수 있습니다. 선택 인원을 줄여 주세요.'); return; }
    setRows(previous => [...previous, ...ids.map(workerId => ({ id: newEntryId(), siteId, workerId, gross: '', expected: '', memo: '', ...defaults }))]);
    setChosen([]); setPickerOpen(false); setError('');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    try {
      if (!pending.current) pending.current = buildBulkClaims(rows, month, directory, newEntryId(), new Date().toISOString());
    } catch (failure) { setError(failure instanceof Error ? failure.message : '입력 내용을 확인해 주세요.'); return; }
    savingRef.current = true; setSaving(true); onBusy(true); setError('');
    try {
      await onSave(pending.current);
      onComplete(month, pending.current.length);
    } catch {
      setRetry(true);
      setError('저장 결과를 확인하지 못했습니다. 입력 내용은 보관되어 있습니다. 다시 저장 확인을 누르면 이미 등록된 행은 중복 없이 확인합니다.');
    } finally { savingRef.current = false; setSaving(false); onBusy(false); }
  };
  return <form className="dr-bulk-entry" onSubmit={save} onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault(); }}>
    <div className="dr-bulk-scroll">
      <fieldset disabled={locked} className="dr-bulk-controls">
        <div className="dr-bulk-period"><label>귀속월<input aria-label="등록 귀속월" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><p>현장을 고르고 작업자를 선택한 뒤, 아래 표에서 한 번에 등록하세요.</p></div>
        <button type="button" className="dr-button dr-bulk-picker-toggle" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}><Plus size={17} />현장·작업자 선택{rows.length > 0 && <span>현재 {rows.length}행</span>}</button>
        {pickerOpen && <section ref={picker} className="dr-bulk-picker" aria-label="등록 대상 선택">
          <label className="dr-bulk-site-label"><span><Building2 size={16} />현장 선택</span><select aria-label="추가할 현장" value={siteId} onChange={event => { setSiteId(event.target.value); setChosen([]); }}><option value="">현장을 선택하세요</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <div className="dr-bulk-worker-picker"><label className="dr-bulk-search"><Search size={16} /><input aria-label="등록할 작업자 검색" placeholder="작업자 이름 검색" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <div className="dr-bulk-worker-tools"><span>작업자 {visibleWorkers.length}명</span><button type="button" className="dr-text-button" disabled={!siteId} onClick={() => setChosen(previous => Array.from(new Set([...previous, ...availableWorkers.map(worker => worker.id)])))}>검색 결과 전체 선택</button><button type="button" className="dr-text-button" onClick={() => setChosen([])}>선택 해제</button></div>
            <div className="dr-bulk-workers">{visibleWorkers.map(worker => {
              const added = rows.some(row => row.siteId === siteId && row.workerId === worker.id);
              return <label key={worker.id} className={chosen.includes(worker.id) ? 'dr-bulk-worker-selected' : ''}><input type="checkbox" checked={chosen.includes(worker.id)} disabled={!siteId || added} onChange={event => setChosen(previous => event.target.checked ? [...previous, worker.id] : previous.filter(id => id !== worker.id))} /><UserRound size={17} style={{ color: validTeamColor(worker.color) }} /><span>{workerLabel(worker.id)}</span>{added && <small>추가됨</small>}</label>;
            })}{!visibleWorkers.length && <p>선택할 작업자가 없습니다.</p>}</div>
          </div>
          <div className="dr-bulk-defaults"><span>새 행 기본값</span><label>입금방식<select value={defaults.delegation} onChange={event => setDefaults({ ...defaults, delegation: event.target.value as DelegationType })}>{Object.entries(delegationLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>받는 계좌<select value={defaults.recipient} onChange={event => setDefaults({ ...defaults, recipient: event.target.value as RecipientKind })}>{Object.entries(recipientLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>입금여부<select value={defaults.status} onChange={event => setDefaults({ ...defaults, status: event.target.value as DepositStatus })}>{Object.entries(depositLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>세율 (%)<input aria-label="새 행 세율" inputMode="decimal" placeholder="직접 금액 입력" value={defaults.taxRate} onChange={event => setDefaults({ ...defaults, taxRate: event.target.value })} /></label></div>
          {directoryError && <p role="alert">{directoryError}</p>}
          <button type="button" className="dr-button dr-button-primary dr-bulk-add" disabled={!siteId || !chosen.length} onClick={addChosen}><Plus size={17} />선택한 {chosen.length}명 행 추가</button>
        </section>}
      </fieldset>
      {rows.length > 0 ? <fieldset disabled={locked} className="dr-bulk-grid-fieldset"><div className="dr-bulk-grid-heading"><h3>등록할 내역 <span>{rows.length}행</span></h3><p>원 단위 · 금액 여러 행 붙여넣기 · Enter로 다음 행</p></div>
        <div className="dr-bulk-table-wrap"><table className="dr-bulk-table" aria-label="일괄 등록표"><thead><tr><th>작업자 / 현장</th><th>세전 금액</th><th>받을 예정 / 세율</th><th>입금방식</th><th>받는 계좌</th><th>입금여부</th><th>메모</th><th><span className="dr-sr-only">삭제</span></th></tr></thead><tbody>{rows.map((row, index) => {
          const worker = workers.find(worker => worker.id === row.workerId); const site = sites.find(site => site.id === row.siteId); const team = directory.teams.find(team => team.id === site?.responsibleTeamId);
          const prefix = `${index + 1}행`;
          return <tr key={row.id}><td className="dr-bulk-identity"><strong><span className="dr-bulk-row-number">{index + 1}</span><UserRound size={18} style={{ color: validTeamColor(worker?.color) }} />{workerLabel(row.workerId)}</strong><label><Building2 size={16} style={{ color: validTeamColor(team?.color) }} /><select aria-label={`${prefix} 현장`} value={row.siteId} onChange={event => update(row.id, { siteId: event.target.value })}>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label></td>
            <td data-label="세전 금액"><input {...amountEvents(index, 'gross')} aria-label={`${prefix} 세전 금액`} inputMode="numeric" placeholder="미확정" value={row.gross} onChange={event => update(row.id, { gross: event.target.value })} /></td>
            <td data-label="받을 예정 / 세율"><input {...amountEvents(index, 'expected')} aria-label={`${prefix} 받을 예정 금액`} inputMode="numeric" placeholder="미확정" value={row.taxRate.trim() ? amounts[index]?.expectedAmount?.toLocaleString('ko-KR') ?? '' : row.expected} onChange={event => update(row.id, { expected: event.target.value, taxRate: '' })} /><label className="dr-bulk-tax">세율<input aria-label={`${prefix} 세율`} inputMode="decimal" placeholder="직접" value={row.taxRate} onChange={event => update(row.id, { taxRate: event.target.value })} />%</label></td>
            <td data-label="입금방식"><select aria-label={`${prefix} 입금방식`} value={row.delegation} onChange={event => update(row.id, { delegation: event.target.value as DelegationType })}>{Object.entries(delegationLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></td>
            <td data-label="받는 계좌"><select aria-label={`${prefix} 받는 계좌`} value={row.recipient} onChange={event => update(row.id, { recipient: event.target.value as RecipientKind })}>{Object.entries(recipientLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></td>
            <td data-label="입금여부"><select className={`dr-bulk-status-${row.status}`} aria-label={`${prefix} 입금여부`} value={row.status} onChange={event => update(row.id, { status: event.target.value as DepositStatus })}>{Object.entries(depositLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></td>
            <td className="dr-bulk-memo" data-label="메모"><textarea aria-label={`${prefix} 메모`} rows={2} maxLength={2000} placeholder="메모 추가" value={row.memo} onChange={event => update(row.id, { memo: event.target.value })} /></td>
            <td className="dr-bulk-remove"><button type="button" className="dr-icon-button" aria-label={`${prefix} 삭제`} onClick={() => setRows(previous => previous.filter(value => value.id !== row.id))}><Trash2 size={17} /></button></td></tr>;
        })}</tbody></table></div>
        <button type="button" className="dr-text-button dr-bulk-more" onClick={() => { setPickerOpen(true); }}><Plus size={16} />다른 작업자·현장 추가</button>
      </fieldset> : <div className="dr-bulk-empty"><UserRound size={26} /><p>현장과 작업자를 선택하면 여기에 입력 행이 만들어집니다.</p></div>}
      {overlaps > 0 && <p className="dr-bulk-warning">이미 조회된 같은 월·현장·작업자 내역 {overlaps}건이 있습니다. 이번 내역은 별도 행으로 추가됩니다.</p>}
      {error && <p role="alert" className="dr-alert">{error}</p>}
    </div>
    <footer className="dr-bulk-footer"><div className="dr-bulk-totals" aria-live="polite"><strong>{rows.length}행 합계</strong><span>세전 <b>{invalidAmounts || !Number.isSafeInteger(totalGross) ? '입력 확인' : rows.length > 0 && missingGross === rows.length ? '미확정' : money(totalGross)}</b>{missingGross > 0 && missingGross < rows.length && <small>미확정 {missingGross}건 제외</small>}</span><span>받을 예정 <b>{invalidAmounts || !Number.isSafeInteger(totalExpected) ? '입력 확인' : rows.length > 0 && missingExpected === rows.length ? '미확정' : money(totalExpected)}</b>{missingExpected > 0 && missingExpected < rows.length && <small>미확정 {missingExpected}건 제외</small>}</span></div><div className="dr-bulk-footer-actions"><button type="button" className="dr-button" disabled={saving} onClick={onClose}>닫기</button><button type="submit" className="dr-button dr-button-primary" disabled={saving || !rows.length}><Check size={17} />{saving ? '저장 중…' : retry ? '다시 저장 확인' : `${rows.length}행 한 번에 등록`}</button></div></footer>
  </form>;
}
