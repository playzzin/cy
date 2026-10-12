import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, FileText, RotateCcw, Settings2, UserRound } from 'lucide-react';
import type { ClaimListChange, ClaimListEdit, DelegatedClaim } from '../../features/delegated-receipts/model';
import { entryKindLabels, isSeparateEntry, getClaimTotals, summarizeClaimAmounts } from '../../features/delegated-receipts/model';
import { groupClaimsBySite, ReceiptSiteGroup } from '../../features/delegated-receipts/siteGroups';
import { depositLabels, getDelegation, getDepositState, recipientLabel, recipientLabels } from '../../features/delegated-receipts/depositState';
import { getRecipientLabels, getWorkerColor, ReceiptDirectory, validTeamColor } from '../../features/delegated-receipts/teamDirectory';
import { siteMemoService, SiteMemo, SiteMemoTarget } from '../../features/delegated-receipts/siteMemoService';
import { getContrastingTextColor } from '../../utils/color';
import DelegatedMemoSticker, { MemoButton } from './DelegatedMemoSticker';
import RecipientSelect from './RecipientSelect';
import ReceiptChoiceSelect from './ReceiptChoiceSelect';
import { delegationChoices } from './receiptChoiceOptions';
import './DelegatedWorkerLedger.css';

export function DepositBadge({ claim }: { claim: DelegatedClaim }) {
  return <span className={`dr-badge dr-deposit-${getDepositState(claim).status}`}>{depositLabels[getDepositState(claim).status]}</span>;
}
export function SiteIdentity({ name, color }: { name: string; color?: string }) {
  return <span className="dr-team-site" style={{ '--dr-site-color': validTeamColor(color) } as React.CSSProperties}><span className="dr-site-avatar" aria-hidden="true"><Building2 size={18} /></span><span className="dr-site-name">{name}</span></span>;
}
function WorkerIdentity({ claim, directory }: { claim: DelegatedClaim; directory: ReceiptDirectory }) {
  const separate = isSeparateEntry(claim);
  const Icon = claim.entryKind === 'buyback' ? RotateCcw : claim.entryKind === 'invoice' ? FileText : UserRound;
  return <span className="dr-worker-identity" style={{ '--dr-worker-color': separate ? (claim.entryKind === 'buyback' ? '#b46b12' : '#4379b2') : getWorkerColor(claim, directory) } as React.CSSProperties}><span className="dr-worker-avatar" aria-hidden="true"><Icon size={18} /></span><strong className="dr-worker-name">{claim.workerName}{separate && <small className="dr-entry-kind">{entryKindLabels[claim.entryKind!]}</small>}</strong></span>;
}
const won = (value: number | null) => value === null ? '금액 미설정' : `${value.toLocaleString('ko-KR')}원`;
const delegationLabels = { delegate: '위임', direct: '직불', unknown: '미확인' };
const fieldLabels = { delegation: '입금방법', recipient: '받는 계좌', status: '입금여부' };
const fieldOptions = { delegation: delegationLabels, recipient: recipientLabels, status: depositLabels };
type SelectField = 'delegation' | 'recipient' | 'status';
type RowSave = { phase: 'saving' | 'saved' | 'error'; edit: ClaimListEdit };
type MemoTarget = { kind: 'worker'; id: string } | ({ kind: 'site' } & SiteMemoTarget);
type Update = (id: string, edit: ClaimListEdit) => Promise<void>;
const editFor = (change: ClaimListChange): ClaimListEdit => ({ id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `list-${Date.now()}-${Math.random().toString(36).slice(2)}`, recordedAt: new Date().toISOString(), change });

const WorkerAccordion = React.memo(function WorkerAccordion({ claim, directory, selected, canWrite, onSelect, onUpdate, onMemo }: {
  claim: DelegatedClaim; directory: ReceiptDirectory; selected: boolean; canWrite: boolean;
  onSelect: (id: string) => void; onUpdate: Update; onMemo: (target: MemoTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [draft, setDraft] = useState<string>();
  const [saved, setSaved] = useState<RowSave>();
  const busy = useRef(false);
  const panelId = useId();
  const amountFormId = useId();
  const locked = Boolean(saved && saved.phase !== 'saved');
  const state = getDepositState(claim);
  const accountLabels = getRecipientLabels(claim, directory);
  const total = getClaimTotals(claim);
  const save = async (edit: ClaimListEdit) => {
    if (!canWrite || busy.current) return;
    busy.current = true; setSaved({ phase: 'saving', edit });
    try { await onUpdate(claim.id, edit); if (edit.change.field === 'grossAmount') setDraft(undefined); setSaved({ phase: 'saved', edit }); }
    catch { setSaved({ phase: 'error', edit }); }
    finally { busy.current = false; }
  };
  const change = (value: ClaimListChange) => void save(editFor(value));
  const clean = (draft ?? String(claim.grossAmount ?? '')).replace(/,/g, '').trim();
  const amount = clean === '' ? null : Number(clean);
  const valid = clean === '' || (/^\d+$/.test(clean) && Number.isSafeInteger(amount));
  const dirty = draft !== undefined && (!valid || amount !== claim.grossAmount);
  const control = (field: SelectField) => {
    const current = field === 'delegation' ? getDelegation(claim) : state[field];
    const value = saved && saved.phase !== 'saved' && saved.edit.change.field === field ? saved.edit.change.value : current;
    if (field === 'recipient') return <div className="dr-inline-field dr-inline-recipient"><span>받는 계좌</span><RecipientSelect label={`${claim.workerName} 받는 계좌`} value={value as typeof state.recipient} labels={accountLabels} disabled={locked} saveCustom onChange={value => { if (value !== 'keep') change({ field: 'recipient', value }); }} /></div>;
    if (field === 'delegation') return <div className="dr-inline-field dr-inline-delegation"><span>입금방법</span><ReceiptChoiceSelect label={`${claim.workerName} 입금방법`} value={String(value)} options={delegationChoices} disabled={locked} onChange={value => change({ field: 'delegation', value: value as 'delegate' | 'direct' | 'unknown' })} /></div>;
    return <label className={`dr-inline-field dr-inline-${field}`}><span>{fieldLabels[field]}</span><select aria-label={`${claim.workerName} ${fieldLabels[field]}`} value={value} disabled={locked}
      className={field === 'status' ? `dr-deposit-${value}` : ''} onChange={event => change({ field, value: event.target.value } as ClaimListChange)}>
      {Object.entries(fieldOptions[field]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>;
  };
  return <article className={`dr-worker-accordion ${selected ? 'dr-row-selected' : ''}`} aria-label={`${claim.workerName} 내역`}>
    <div className="dr-worker-summary">
      <div className="dr-worker-person">{canWrite && <input type="checkbox" aria-label={`${claim.workerName} 선택`} checked={selected} onChange={() => onSelect(claim.id)} />}
        <button type="button" className="dr-worker-expand" aria-label={`${claim.workerName} ${isSeparateEntry(claim) ? entryKindLabels[claim.entryKind!] : '작업자'}`} aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(value => !value); setVisited(true); }}>
          <WorkerIdentity claim={claim} directory={directory} /><ChevronDown className={open ? 'dr-accordion-chevron-open' : ''} size={16} />
        </button>
      </div>
      {canWrite ? <>{control('delegation')}{control('recipient')}{control('status')}<div className="dr-accordion-amount"><span>세전 금액 (원)</span><form id={amountFormId} className="dr-inline-amount" onSubmit={event => { event.preventDefault(); if (dirty && valid && !locked) change({ field: 'grossAmount', value: amount }); }}>
        <label className="dr-inline-money-input"><input aria-label={`${claim.workerName} 세전 금액`} inputMode="numeric" placeholder="미확정" disabled={locked} aria-invalid={!valid} value={draft ?? claim.grossAmount?.toLocaleString('ko-KR') ?? ''}
          onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && !locked) { event.preventDefault(); setDraft(undefined); } }} /></label>
      </form></div></> : <>
        <div className="dr-inline-field dr-inline-delegation"><span>입금방법</span><span className="dr-worker-value">{delegationLabels[getDelegation(claim)]}</span></div>
        <div className="dr-inline-field dr-inline-recipient"><span>받는 계좌</span><span className="dr-worker-value">{recipientLabel(state.recipient, accountLabels)}</span></div>
        <div className="dr-inline-field dr-inline-status"><span>입금여부</span><DepositBadge claim={claim} /></div>
        <div className="dr-accordion-amount"><span>세전 금액 (원)</span><span className="dr-worker-summary-amount">{won(claim.grossAmount)}</span></div>
      </>}
      <MemoButton label={claim.workerName} memo={claim.memo} canWrite={canWrite} disabled={saved?.phase === 'saving'} onClick={() => onMemo({ kind: 'worker', id: claim.id })} />
    </div>
    {dirty && <div className="dr-worker-amount-feedback">{!valid ? <small role="alert">0원 이상의 정수를 입력하세요.</small> : <small>{claim.taxRate !== undefined && claim.taxRate !== null ? `설정 세율 ${claim.taxRate}%로 세후 금액도 다시 계산합니다.` : '세전 금액 수정 중'}</small>}<div className="dr-inline-amount-actions"><button type="button" disabled={locked} onClick={() => setDraft(undefined)}>취소</button><button type="submit" form={amountFormId} disabled={!valid || locked} aria-label={`${claim.workerName} 세전 금액 저장`}>저장</button></div></div>}
    {saved && <div className={`dr-inline-feedback dr-worker-save-feedback dr-inline-${saved.phase}`} role={saved.phase === 'error' ? 'alert' : 'status'}>{saved.phase === 'saving' ? '저장 중…' : saved.phase === 'saved' ? <><Check size={14} />저장됨</> : <><span>저장 확인 실패</span><button onClick={() => void save(saved.edit)} aria-label={`${claim.workerName} 목록 변경 다시 저장`}>다시 저장</button></>}</div>}
    {visited && <div id={panelId} hidden={!open} className="dr-worker-editor"><p className="dr-worker-received">기록된 입금액 <b>{won(total.received)}</b> · 받을 예정 <b>{won(claim.expectedAmount)}</b>{claim.taxRate != null && <span> · 적용 세율 {claim.taxRate}%</span>}</p></div>}
  </article>;
});

function SelectionCheckbox({ label, checked, partial, onChange }: { label: string; checked: boolean; partial: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = partial; }, [partial]);
  return <input ref={ref} type="checkbox" aria-label={label} aria-checked={partial ? 'mixed' : checked} checked={checked} onChange={onChange} />;
}

const SiteAccordion = React.memo(function SiteAccordion({ group, directory, canWrite, selectedIds, onSelect, onSelectSite, onUpdate, onMemo, memo, memoDisabled, expandCommand, onSiteSettings }: {
  group: ReceiptSiteGroup; directory: ReceiptDirectory; canWrite: boolean; selectedIds: string[]; onSelect: (id: string) => void; onUpdate: Update; onMemo: (target: MemoTarget) => void;
  onSelectSite: (ids: string[]) => void;
  memo: string; memoDisabled: boolean; expandCommand: { expanded: boolean; version: number };
  onSiteSettings?: (claim: DelegatedClaim) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const panelId = useId();
  const selectedCount = group.claims.filter(claim => selectedIds.includes(claim.id)).length;
  const workers = group.claims.filter(claim => !isSeparateEntry(claim));
  const separate = group.claims.filter(isSeparateEntry);
  useEffect(() => { if (expandCommand.version) { setOpen(expandCommand.expanded); if (expandCommand.expanded) setVisited(true); } }, [expandCommand]);
  const totals = useMemo(() => ({ gross: summarizeClaimAmounts(group.claims).gross, complete: group.claims.filter(claim => getDepositState(claim).status === 'complete').length }), [group.claims]);
  return <section className="dr-site-accordion" aria-label={`${group.name} 내역`} style={{ '--dr-group-color': group.color, '--dr-group-text': getContrastingTextColor(group.color, '#ffffff', '#000000') } as React.CSSProperties}>
    <div className="dr-site-accordion-header">{canWrite && <label className="dr-site-selection"><SelectionCheckbox label={`${group.name} 현장 전체 선택`} checked={selectedCount === group.claims.length} partial={selectedCount > 0 && selectedCount < group.claims.length} onChange={() => onSelectSite(group.claims.map(claim => claim.id))} /><span className="dr-sr-only">현장 선택</span></label>}<h3><button type="button" className="dr-site-expand" aria-label={`${group.name} 현장`} aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(value => !value); setVisited(true); }}>
      <SiteIdentity name={group.name} color={group.color} /><span className="dr-site-accordion-totals"><span>{workers.length}명{separate.length > 0 && ` · 별도 ${separate.length}건`}</span><span>입금완료 {totals.complete}/{group.claims.length}건</span><span>세전 합계 <b>{won(totals.gross.amount)}</b>{totals.gross.missing > 0 && <small>미확정 {totals.gross.missing}건</small>}</span></span><ChevronDown className={open ? 'dr-accordion-chevron-open' : ''} size={20} />
    </button></h3>{onSiteSettings && <button className="dr-site-settings-button" type="button" aria-label={`${group.name} 현장 설정`} onClick={() => onSiteSettings(group.claims[0])}><Settings2 size={16} /><span>현장 설정</span></button>}<MemoButton label={`${group.name} 현장`} memo={memo} canWrite={canWrite} disabled={memoDisabled} onClick={() => onMemo({ kind: 'site', key: group.key, month: group.claims[0].month, name: group.name })} /></div>
    {visited && <div id={panelId} hidden={!open} className="dr-site-workers"><div className="dr-worker-column-headings" aria-hidden="true"><span>작업자</span><span>입금방법</span><span>받는 계좌</span><span>입금여부</span><span>세전 금액 (원)</span><span>메모</span></div>{[workers, separate].map((entries, index) => entries.length > 0 && <React.Fragment key={index}>{index === 1 && <div className="dr-separate-heading"><FileText size={16} />바이백·계산서 <span>{entries.length}건</span></div>}{entries.map(claim => <WorkerAccordion key={claim.id} claim={claim} directory={directory} canWrite={canWrite} selected={selectedIds.includes(claim.id)} onSelect={onSelect} onUpdate={onUpdate} onMemo={onMemo} />)}</React.Fragment>)}</div>}
  </section>;
});

interface Props { claims: DelegatedClaim[]; directory: ReceiptDirectory; canWrite: boolean; selectedIds: string[]; onSelect: (ids: string[]) => void; onUpdate: Update; memoService?: typeof siteMemoService; onSiteSettings?: (claim: DelegatedClaim) => void; }
export default React.memo(function DelegatedWorkerLedger({ claims, directory, canWrite, selectedIds, onSelect, onUpdate, memoService = siteMemoService, onSiteSettings }: Props) {
  const groups = useMemo(() => groupClaimsBySite(claims, directory), [claims, directory]);
  const [expandCommand, setExpandCommand] = useState({ expanded: false, version: 0 });
  const [memos, setMemos] = useState<Record<string, SiteMemo>>({});
  const [memoLoading, setMemoLoading] = useState(true);
  const [memoError, setMemoError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeMemo, setActiveMemo] = useState<MemoTarget | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const month = claims[0]?.month;
  useEffect(() => {
    if (!month) return;
    let cancelled = false; setMemoLoading(true); setMemoError(false);
    memoService.list(month).then(values => { if (!cancelled) setMemos(Object.fromEntries(values.map(value => [value.key, value]))); })
      .catch(() => { if (!cancelled) setMemoError(true); }).finally(() => { if (!cancelled) setMemoLoading(false); });
    return () => { cancelled = true; };
  }, [month, memoService, retry]);
  const openMemo = useCallback((target: MemoTarget) => setActiveMemo(target), []);
  const toggleGroup = useCallback((ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.includes(id));
    const next = allSelected ? selectedIds.filter(id => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])];
    if (next.length > 400) { setSelectionError('한 번에 최대 400건까지 수정할 수 있습니다. 일부 선택을 해제한 뒤 다시 선택해 주세요.'); return; }
    setSelectionError(''); onSelect(next);
  }, [selectedIds, onSelect]);
  const toggle = useCallback((id: string) => toggleGroup([id]), [toggleGroup]);
  const currentSelected = claims.filter(claim => selectedIds.includes(claim.id)).length;
  const currentWorker = activeMemo?.kind === 'worker' ? claims.find(claim => claim.id === activeMemo.id) : undefined;
  const memo = activeMemo?.kind === 'site' ? memos[activeMemo.key]?.memo ?? '' : currentWorker?.memo ?? '';
  const saveMemo = async (value: string, operationId: string) => {
    if (!canWrite || !activeMemo) throw new Error('수정 권한을 확인해 주세요.');
    if (activeMemo.kind === 'worker') await onUpdate(activeMemo.id, { id: operationId, recordedAt: new Date().toISOString(), change: { field: 'memo', value } });
    else {
      const { kind, ...target } = activeMemo;
      const saved = await memoService.save(target, value, memos[target.key]?.revision ?? 0, operationId);
      setMemos(previous => ({ ...previous, [saved.key]: saved }));
    }
  };
  return <div className="dr-worker-ledger" role="region" aria-label="현장별 작업자 내역">
    <div className="dr-accordion-toolbar">{canWrite && <label className="dr-select-all"><SelectionCheckbox label="현재 목록 선택" checked={claims.length > 0 && currentSelected === claims.length} partial={currentSelected > 0 && currentSelected < claims.length} onChange={() => { setSelectionError(''); onSelect(currentSelected === Math.min(claims.length, 400) ? [] : claims.slice(0, 400).map(claim => claim.id)); }} />현재 목록 선택 {claims.length > 400 && '(앞 400건)'}</label>}<div><button onClick={() => setExpandCommand(value => ({ expanded: true, version: value.version + 1 }))}>현장 모두 펼치기</button><button onClick={() => setExpandCommand(value => ({ expanded: false, version: value.version + 1 }))}>모두 접기</button></div></div>
    {selectionError && <p className="dr-site-memo-error" role="alert">{selectionError}</p>}
    {memoError && <p className="dr-site-memo-error" role="alert">현장 메모를 불러오지 못했습니다. <button onClick={() => setRetry(value => value + 1)}>현장 메모 다시 조회</button></p>}
    <div className="dr-accordion-sites">{groups.map(group => <SiteAccordion key={group.key} group={group} directory={directory} canWrite={canWrite} selectedIds={selectedIds} onSelect={toggle} onSelectSite={toggleGroup} onUpdate={onUpdate} onMemo={openMemo} memo={memos[group.key]?.memo ?? ''} memoDisabled={memoLoading || memoError} expandCommand={expandCommand} onSiteSettings={onSiteSettings} />)}</div>
    {activeMemo && <DelegatedMemoSticker label={activeMemo.kind === 'site' ? `${activeMemo.name} 현장` : currentWorker?.workerName ?? '작업자'} context={activeMemo.kind === 'site' ? `${month} · 현장 공통 메모` : `${month} · ${currentWorker?.siteName} · ${currentWorker && isSeparateEntry(currentWorker) ? '별도 내역' : '작업자'} 메모`} memo={memo} canWrite={canWrite} onSave={saveMemo} onClose={() => setActiveMemo(null)} />}
  </div>;
});
