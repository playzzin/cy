import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, FileText, Plus, RotateCcw, Search, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { buildBulkClaims, BulkEntryRow, entryAmounts, newEntryId, pasteEntryAmounts } from '../../features/delegated-receipts/bulkEntry';
import { DelegatedClaim, DelegationType, DepositStatus, RecipientKind, EntryKind, entryKindLabels, isSeparateEntry } from '../../features/delegated-receipts/model';
import { SiteTaxSetting, siteTaxRate } from '../../features/delegated-receipts/siteTax';
import { depositLabels } from '../../features/delegated-receipts/depositState';
import { getRecipientLabels, getWorkerTeam, ReceiptDirectory, validTeamColor } from '../../features/delegated-receipts/teamDirectory';
import ReceiptColorFilter from './ReceiptColorFilter';
import RecipientSelect from './RecipientSelect';
import ReceiptChoiceSelect from './ReceiptChoiceSelect';
import { delegationChoices } from './receiptChoiceOptions';
import './DelegatedBulkEntry.css';

interface Props {
  month: string; directory: ReceiptDirectory; existingClaims: DelegatedClaim[]; directoryError?: string;
  onSave: (claims: DelegatedClaim[]) => Promise<{ added: number; skipped: number }>;
  onComplete: (month: string, count: number) => void; onBusy: (busy: boolean) => void; onClose: () => void;
  siteTaxes?: SiteTaxSetting[];
}
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export default function DelegatedBulkEntry({ month: initialMonth, directory, existingClaims, directoryError, onSave, onComplete, onBusy, onClose, siteTaxes = [] }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [siteId, setSiteId] = useState('');
  const [search, setSearch] = useState('');
  const [workerTeam, setWorkerTeam] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [siteEditing, setSiteEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [rows, setRows] = useState<BulkEntryRow[]>([]);
  const [focusRow, setFocusRow] = useState('');
  const [error, setError] = useState('');
  const [pickerError, setPickerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const savingRef = useRef(false);
  const pending = useRef<DelegatedClaim[] | null>(null);
  const amountInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const picker = useRef<HTMLElement>(null);
  const workerPicker = useRef<HTMLDivElement>(null);
  const ledger = useRef<HTMLFieldSetElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (pickerOpen) picker.current?.scrollIntoView?.({ block: 'nearest' }); }, [pickerOpen]);
  useEffect(() => { if (!pickerOpen) ledger.current?.scrollIntoView?.({ block: 'start' }); }, [pickerOpen]);
  useEffect(() => { if (focusRow) { amountInputs.current[`${focusRow}-name`]?.focus(); setFocusRow(''); } }, [focusRow]);
  useEffect(() => { if (error) feedback.current?.scrollIntoView?.({ block: 'nearest' }); }, [error]);
  useEffect(() => { if (siteId) workerPicker.current?.scrollIntoView?.({ block: 'nearest' }); }, [siteId]);
  const locked = saving || retry;
  const workers = useMemo(() => [...(directory.workers ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [directory]);
  const sites = useMemo(() => [...directory.sites].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [directory]);
  const workerTeams = useMemo(() => new Map(workers.map(worker => [worker.id, getWorkerTeam(worker, directory)])), [workers, directory]);
  const teamCounts = useMemo(() => workers.reduce((counts, worker) => {
    const teamId = workerTeams.get(worker.id)?.id || 'unassigned';
    counts.set(teamId, (counts.get(teamId) || 0) + 1); return counts;
  }, new Map<string, number>()), [workers, workerTeams]);
  const entryTeams = useMemo(() => directory.teams.filter(team => team.isCheongyeon).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [directory]);
  const entryTeamIds = useMemo(() => new Set(entryTeams.map(team => team.id)), [entryTeams]);
  const eligibleWorkers = workers.filter(worker => entryTeamIds.has(workerTeams.get(worker.id)?.id || ''));
  const teamOptions = [{ value: '', label: `청연이엔지 전체 팀 · ${eligibleWorkers.length}명` }, ...entryTeams.map(team => ({ value: team.id, label: `${team.name} · ${teamCounts.get(team.id) || 0}명`, color: team.color }))];
  const visibleWorkers = eligibleWorkers.filter(worker => {
    const team = workerTeams.get(worker.id);
    return (!workerTeam || (team?.id || 'unassigned') === workerTeam)
      && normalize([worker.name, team?.name || worker.teamName, team?.leaderName].filter(Boolean).join(' ')).includes(normalize(search));
  });
  const visibleSites = sites.filter(site => normalize([site.name, directory.teams.find(team => team.id === site.responsibleTeamId)?.name].filter(Boolean).join(' ')).includes(normalize(siteSearch)));
  const selectedSite = sites.find(site => site.id === siteId);
  const selectedSiteTeam = directory.teams.find(team => team.id === selectedSite?.responsibleTeamId);
  const capacity = 100 - rows.length;
  const siteWorkerCount = rows.filter(row => row.siteId === siteId && (!row.entryKind || row.entryKind === 'worker')).length;
  const availableWorkers = visibleWorkers.filter(worker => !rows.some(row => row.siteId === siteId && row.workerId === worker.id));
  const sameNameCounts = useMemo(() => workers.reduce((map, worker) => map.set(normalize(worker.name), (map.get(normalize(worker.name)) || 0) + 1), new Map<string, number>()), [workers]);
  const workerLabel = (id: string) => {
    const worker = workers.find(worker => worker.id === id);
    const team = workerTeams.get(id);
    return worker ? `${worker.name}${(sameNameCounts.get(normalize(worker.name)) || 0) > 1 ? ` · ${team?.name || '팀 미지정'} · ${worker.id.slice(-6)}` : ''}` : '작업자';
  };
  const amounts = rows.map(row => { try { return entryAmounts(row); } catch { return null; } });
  const missingGross = amounts.filter(value => value?.grossAmount === null).length;
  const missingExpected = amounts.filter(value => value?.expectedAmount === null).length;
  const invalidAmounts = amounts.some(value => value === null);
  const totalGross = amounts.reduce((sum, value) => sum + (value?.grossAmount ?? 0), 0);
  const totalExpected = amounts.reduce((sum, value) => sum + (value?.expectedAmount ?? 0), 0);
  const overlaps = rows.filter(row => {
    if (row.entryKind && row.entryKind !== 'worker') return false;
    const site = sites.find(site => site.id === row.siteId); const worker = workers.find(worker => worker.id === row.workerId);
    return existingClaims.some(claim => !isSeparateEntry(claim) && claim.month === month && (claim.siteId ? claim.siteId === row.siteId : normalize(claim.siteName) === normalize(site?.name || '')) && (claim.workerId ? claim.workerId === row.workerId : normalize(claim.workerName) === normalize(worker?.name || '')));
  }).length;
  const update = (id: string, patch: Partial<BulkEntryRow>) => { setRows(previous => previous.map(row => row.id === id ? { ...row, ...patch } : row)); setError(''); };
  const blankRow = (): BulkEntryRow => ({ id: newEntryId(), siteId, workerId: '', gross: '', expected: '', memo: '', taxRate: siteTaxRate(siteId, siteTaxes), delegation: 'delegate', recipient: 'unknown', status: 'unknown' });
  const addWorkers = (ids: string[]) => {
    if (locked || !siteId) return;
    const next = [...new Set(ids)].filter(id => !rows.some(row => row.siteId === siteId && row.workerId === id));
    if (next.length > capacity) { setPickerError(`현재 ${capacity}명까지 더 추가할 수 있습니다. 팀이나 이름으로 범위를 좁혀 선택해 주세요.`); return; }
    setRows(previous => [...previous, ...next.map(workerId => ({ ...blankRow(), workerId }))]);
    setPickerError(''); setError('');
  };
  const addSeparate = (entryKind: Exclude<EntryKind, 'worker'>) => {
    if (locked || !siteId || !capacity) return;
    const row = { ...blankRow(), entryKind, entryName: '' };
    setRows(previous => [...previous, row]);
    setPickerOpen(false); setFocusRow(row.id); setError(''); setPickerError('');
  };
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
        <div className="dr-bulk-period">
          <label>귀속월<input aria-label="등록 귀속월" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
          <p>선택하면 바로 행 추가 · 각 행에서 개별 입력 후 한 번에 등록</p>
          <span className="dr-bulk-capacity">등록할 내역 <b>{rows.length}</b> / 100행</span>
        </div>
        <div className="dr-bulk-add-toolbar" role="group" aria-label="등록할 행 추가">
          <button type="button" className="dr-button" aria-expanded={pickerOpen} aria-controls="dr-bulk-target-picker" onClick={() => setPickerOpen(!pickerOpen)} disabled={!rows.length && pickerOpen}><UserRound size={17} />{pickerOpen ? '현장·작업자 선택 접기' : '현장·작업자 추가'}</button>
          <button type="button" className="dr-button dr-bulk-add-buyback" disabled={!siteId || !capacity} onClick={() => addSeparate('buyback')}><RotateCcw size={17} />바이백 직접 입력</button>
          <button type="button" className="dr-button dr-bulk-add-invoice" disabled={!siteId || !capacity} onClick={() => addSeparate('invoice')}><FileText size={17} />계산서 직접 입력</button>
          <span className="dr-bulk-add-context"><Building2 size={16} style={{ color: validTeamColor(selectedSiteTeam?.color) }} />{selectedSite?.name || '먼저 현장을 선택하세요'}</span>
        </div>
        {pickerOpen && <section ref={picker} className="dr-bulk-picker" id="dr-bulk-target-picker" aria-label="등록 대상 선택">
          <div className={`dr-bulk-site-picker${selectedSite ? ' dr-bulk-site-chosen' : ''}${siteEditing ? ' dr-bulk-site-editing' : ''}`}>
            <h3><span className="dr-bulk-step">1</span>현장 선택{selectedSite && <button type="button" className="dr-bulk-site-edit" aria-expanded={siteEditing} onClick={() => setSiteEditing(!siteEditing)}>{siteEditing ? '접기' : '현장 변경'}</button>}</h3>
            <label className="dr-bulk-field">현장 찾기<span className="dr-bulk-search"><Search size={17} /><input aria-label="등록할 현장 검색" placeholder="현장명 또는 담당 팀 검색" value={siteSearch} onChange={event => setSiteSearch(event.target.value)} />{siteSearch && <button type="button" aria-label="현장 검색 지우기" onClick={() => setSiteSearch('')}><X size={16} /></button>}</span></label>
            <label className="dr-bulk-field">등록 현장<select aria-label="추가할 현장" value={siteId} onChange={event => { setSiteId(event.target.value); setPickerError(''); setSiteEditing(false); }}><option value="">현장을 선택하세요</option>{selectedSite && !visibleSites.some(site => site.id === siteId) && <option value={siteId}>{selectedSite.name} · 선택됨</option>}{visibleSites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            {!visibleSites.length && <p className="dr-bulk-hint">검색에 맞는 현장이 없습니다.</p>}
            {selectedSite ? <div className="dr-bulk-site-summary"><Building2 size={22} style={{ color: validTeamColor(selectedSiteTeam?.color) }} /><div><strong>{selectedSite.name}</strong><span>{selectedSiteTeam?.name || '담당 팀 미지정'}</span></div></div> : <p className="dr-bulk-hint">현장을 선택하면 내역을 추가할 수 있습니다.</p>}
          </div>
          <div ref={workerPicker} className="dr-bulk-worker-picker">
            <h3><span className="dr-bulk-step">2</span>작업자 선택 <span className="dr-bulk-selected-count">{siteWorkerCount}명 입력표에 추가됨</span></h3>
            <div className="dr-bulk-worker-filters">
              <div className="dr-bulk-field"><span>소속 팀 · 청연이엔지</span><ReceiptColorFilter label="작업자 소속 팀" kind="team" value={workerTeam} options={teamOptions} onChange={setWorkerTeam} /></div>
              <label className="dr-bulk-field">작업자·팀 찾기<span className="dr-bulk-search"><Search size={17} /><input aria-label="등록할 작업자 검색" placeholder="작업자·팀·팀장 이름 검색" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="작업자 검색 지우기" onClick={() => setSearch('')}><X size={16} /></button>}</span></label>
            </div>
            <div className="dr-bulk-worker-tools"><span aria-live="polite">검색 결과 <b>{visibleWorkers.length}명</b></span><button type="button" className="dr-text-button" disabled={!siteId || !availableWorkers.length || capacity === 0} onClick={() => addWorkers(availableWorkers.map(worker => worker.id))}>검색 결과 전체 추가</button>{(workerTeam || search) && <button type="button" className="dr-text-button" onClick={() => { setWorkerTeam(''); setSearch(''); }}>검색 초기화</button>}</div>
            {selectedSiteTeam && entryTeamIds.has(selectedSiteTeam.id) && teamCounts.has(selectedSiteTeam.id) && workerTeam !== selectedSiteTeam.id && <button type="button" className="dr-bulk-team-shortcut" onClick={() => { setWorkerTeam(selectedSiteTeam.id); setSearch(''); }}><UsersRound size={15} style={{ color: validTeamColor(selectedSiteTeam.color) }} />현장 담당 팀 작업자 보기</button>}
            <div className="dr-bulk-workers" role="group" aria-label="작업자 검색 결과">{visibleWorkers.map(worker => {
              const added = rows.some(row => row.siteId === siteId && row.workerId === worker.id);
              const team = workerTeams.get(worker.id);
              return <label key={worker.id} className={added ? 'dr-bulk-worker-selected' : ''}><input type="checkbox" aria-label={`${workerLabel(worker.id)}${added ? ' 추가됨' : ''}`} checked={added} disabled={!siteId || added || !capacity} onChange={() => addWorkers([worker.id])} /><UserRound size={18} style={{ color: validTeamColor(worker.color) }} /><span><b>{worker.name}</b><small>{team?.name || worker.teamName || '팀 미지정'}{(sameNameCounts.get(normalize(worker.name)) || 0) > 1 && ` · ${worker.id.slice(-6)}`}</small></span>{added && <small className="dr-bulk-already-added">추가됨</small>}</label>;
            })}{!visibleWorkers.length && <p className="dr-bulk-no-results">{!entryTeams.length ? '청연이엔지 소속으로 등록된 팀이 없습니다. 팀의 소속 회사를 확인해 주세요.' : '검색에 맞는 작업자가 없습니다. 팀이나 이름을 바꿔 보세요.'}</p>}</div>
            <p className="dr-bulk-hint">선택한 작업자는 아래 입력표에 바로 추가됩니다. 삭제는 입력표에서 할 수 있습니다.</p>
          </div>
          {directoryError && <p role="alert">{directoryError}</p>}
          {pickerError && <p role="alert" className="dr-bulk-picker-error">{pickerError}</p>}
        </section>}
      </fieldset>
      {rows.length > 0 ? <fieldset ref={ledger} disabled={locked} className="dr-bulk-grid-fieldset"><div className="dr-bulk-grid-heading"><h3><span className="dr-bulk-step">3</span>작업자·별도 항목 개별 입력 <span>{rows.length}행</span></h3><p>각 행에서 금액·입금방법·계좌·입금여부를 입력하세요.</p></div>
        <div className="dr-bulk-table-wrap"><table className="dr-bulk-table" aria-label="일괄 등록표"><thead><tr><th>작업자·항목 / 현장</th><th>세전 금액</th><th>받을 예정 / 세율</th><th>입금방식</th><th>받는 계좌</th><th>입금여부</th><th>메모</th><th><span className="dr-sr-only">삭제</span></th></tr></thead><tbody>{rows.map((row, index) => {
          const worker = workers.find(worker => worker.id === row.workerId); const site = sites.find(site => site.id === row.siteId); const team = directory.teams.find(team => team.id === site?.responsibleTeamId);
          const prefix = `${index + 1}행`; const separate = row.entryKind === 'buyback' || row.entryKind === 'invoice';
          return <tr key={row.id} className={separate ? `dr-bulk-row-${row.entryKind}` : undefined}><td className="dr-bulk-identity"><strong><span className="dr-bulk-row-number">{index + 1}</span>{row.entryKind === 'buyback' ? <RotateCcw size={18} /> : separate ? <FileText size={18} /> : <UserRound size={18} style={{ color: validTeamColor(worker?.color) }} />}{separate ? entryKindLabels[row.entryKind!] : workerLabel(row.workerId)}</strong>{separate && <input ref={element => { amountInputs.current[`${row.id}-name`] = element; }} className="dr-bulk-entry-name" aria-label={`${prefix} 항목명`} placeholder={row.entryKind === 'buyback' ? '바이백 항목명 (선택)' : '계산서 항목명 (선택)'} maxLength={120} value={row.entryName || ''} onChange={event => update(row.id, { entryName: event.target.value })} />}<label><Building2 size={16} style={{ color: validTeamColor(team?.color) }} /><select aria-label={`${prefix} 현장`} value={row.siteId} onChange={event => update(row.id, { siteId: event.target.value, taxRate: siteTaxRate(event.target.value, siteTaxes) })}>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label></td>
            <td data-label="세전 금액"><input {...amountEvents(index, 'gross')} aria-label={`${prefix} 세전 금액`} inputMode="numeric" placeholder="미확정" value={row.gross} onChange={event => update(row.id, { gross: event.target.value })} /></td>
            <td data-label="받을 예정 / 세율"><input {...amountEvents(index, 'expected')} aria-label={`${prefix} 받을 예정 금액`} inputMode="numeric" placeholder="미확정" value={row.taxRate.trim() ? amounts[index]?.expectedAmount?.toLocaleString('ko-KR') ?? '' : row.expected} onChange={event => update(row.id, { expected: event.target.value, taxRate: '' })} /><label className="dr-bulk-tax">세율<input aria-label={`${prefix} 세율`} inputMode="decimal" placeholder="직접" value={row.taxRate} onChange={event => update(row.id, { taxRate: event.target.value })} />%</label></td>
            <td data-label="입금방식"><ReceiptChoiceSelect label={`${prefix} 입금방식`} value={row.delegation} options={delegationChoices} onChange={value => update(row.id, { delegation: value as DelegationType })} /></td>
            <td data-label="받는 계좌"><RecipientSelect label={`${prefix} 받는 계좌`} value={row.recipient} labels={getRecipientLabels({ siteId: row.siteId, siteName: site?.name || '' }, directory)} onChange={value => update(row.id, { recipient: value as RecipientKind })} /></td>
            <td data-label="입금여부"><select className={`dr-bulk-status-${row.status}`} aria-label={`${prefix} 입금여부`} value={row.status} onChange={event => update(row.id, { status: event.target.value as DepositStatus })}>{Object.entries(depositLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></td>
            <td className="dr-bulk-memo" data-label="메모"><textarea aria-label={`${prefix} 메모`} rows={2} maxLength={2000} placeholder="메모 추가" value={row.memo} onChange={event => update(row.id, { memo: event.target.value })} /></td>
            <td className="dr-bulk-remove"><button type="button" className="dr-icon-button" aria-label={`${prefix} 삭제`} onClick={() => setRows(previous => previous.filter(value => value.id !== row.id))}><Trash2 size={17} /></button></td></tr>;
        })}</tbody></table></div>
        <div className="dr-bulk-grid-help"><span>금액은 원 단위 · 엑셀 금액 붙여넣기 · Enter로 다음 행</span><button type="button" className="dr-text-button dr-bulk-more" onClick={() => { setPickerOpen(true); picker.current?.scrollIntoView?.({ block: 'start' }); }}><Plus size={16} />다른 현장·작업자 추가</button></div>
      </fieldset> : null}
      {overlaps > 0 && <p className="dr-bulk-warning">이미 조회된 같은 월·현장·작업자 내역 {overlaps}건이 있습니다. 이번 내역은 별도 행으로 추가됩니다.</p>}
      {error && <p ref={feedback} role="alert" className="dr-alert">{error}</p>}
    </div>
    <footer className="dr-bulk-footer">
      <div className="dr-bulk-totals" aria-live="polite"><strong>{rows.length}행 합계</strong><span>세전 <b>{invalidAmounts || !Number.isSafeInteger(totalGross) ? '입력 확인' : rows.length > 0 && missingGross === rows.length ? '미확정' : money(totalGross)}</b>{missingGross > 0 && missingGross < rows.length && <small>미확정 {missingGross}건 제외</small>}</span><span>받을 예정 <b>{invalidAmounts || !Number.isSafeInteger(totalExpected) ? '입력 확인' : rows.length > 0 && missingExpected === rows.length ? '미확정' : money(totalExpected)}</b>{missingExpected > 0 && missingExpected < rows.length && <small>미확정 {missingExpected}건 제외</small>}</span></div>
      <div className="dr-bulk-footer-actions">
        {pickerOpen && rows.length > 0 ? <button type="button" className="dr-button" disabled={locked} onClick={() => setPickerOpen(false)}>입력표 보기</button> : <button type="button" className="dr-button" disabled={saving} onClick={onClose}>닫기</button>}
        <button key="save-rows" type="submit" className="dr-button dr-button-primary" disabled={saving || !rows.length}><Check size={17} />{saving ? '저장 중…' : retry ? '다시 저장 확인' : rows.length + '행 한 번에 등록'}</button>
      </div>
    </footer>
  </form>;
}
