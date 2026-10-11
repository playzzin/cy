import React, { useMemo, useRef, useState } from 'react';
import { Building2, Check, UserRound } from 'lucide-react';
import type { ClaimListChange, ClaimListEdit, DelegatedClaim } from '../../features/delegated-receipts/model';
import { getClaimTotals, summarizeClaimAmounts } from '../../features/delegated-receipts/model';
import { groupClaimsBySite, ReceiptSiteGroup } from '../../features/delegated-receipts/siteGroups';
import { depositLabels, getDelegation, getDepositState, recipientLabels } from '../../features/delegated-receipts/depositState';
import { getWorkerColor, ReceiptDirectory, validTeamColor } from '../../features/delegated-receipts/teamDirectory';
import DelegatedMemoSticker from './DelegatedMemoSticker';
import './DelegatedWorkerLedger.css';

export function DepositBadge({ claim }: { claim: DelegatedClaim }) {
  const state = getDepositState(claim);
  return <span className={`dr-badge dr-deposit-${state.status}`}><span aria-hidden="true" />{depositLabels[state.status]}</span>;
}
export function SiteIdentity({ name, color }: { name: string; color?: string }) {
  return <span className="dr-team-site" style={{ '--dr-site-color': validTeamColor(color) } as React.CSSProperties}>
    <span className="dr-site-avatar" aria-hidden="true"><Building2 size={18} strokeWidth={2} /></span>
    <span className="dr-site-name">{name}</span>
  </span>;
}
function WorkerIdentity({ claim, directory }: { claim: DelegatedClaim; directory: ReceiptDirectory }) {
  const color = getWorkerColor(claim, directory);
  return <span className="dr-worker-identity" style={{ '--dr-worker-color': color } as React.CSSProperties}>
    <span className="dr-worker-avatar" aria-hidden="true"><UserRound size={18} strokeWidth={2} /></span>
    <strong className="dr-worker-name">{claim.workerName}</strong>
  </span>;
}
const won = (value: number | null) => value === null ? '금액 미설정' : `${value.toLocaleString('ko-KR')}원`;
const delegationLabels = { delegate: '위임', direct: '직불', unknown: '미확인' };
const fieldLabels = { delegation: '입금방법', recipient: '받는 계좌', status: '입금여부' };
const fieldOptions = { delegation: delegationLabels, recipient: recipientLabels, status: depositLabels };
type SelectField = 'delegation' | 'recipient' | 'status';
type RowSave = { phase: 'saving' | 'saved' | 'error'; edit: ClaimListEdit };

function SiteGroupHeading({ group }: { group: ReceiptSiteGroup }) {
  const gross = summarizeClaimAmounts(group.claims).gross;
  const complete = group.claims.filter(claim => getDepositState(claim).status === 'complete').length;
  return <div className="dr-site-group-heading"><h3><SiteIdentity name={group.name} color={group.color} /></h3><div className="dr-site-group-totals"><span><b>{group.claims.length}건</b></span><span>입금완료 <b>{complete}/{group.claims.length}건</b></span><span>세전 합계 <b>{won(gross.amount)}</b>{gross.amount !== null && gross.missing > 0 && <small>미확정 {gross.missing}건 제외</small>}</span></div></div>;
}

export default function DelegatedWorkerLedger({ claims, directory, canWrite, selectedIds, onSelect, onUpdate }: {
  claims: DelegatedClaim[]; directory: ReceiptDirectory; canWrite: boolean; selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onUpdate: (id: string, edit: ClaimListEdit) => Promise<void>;
}) {
  const [rowSaves, setRowSaves] = useState<Record<string, RowSave>>({});
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const clearAmount = (id: string) => setAmountDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
  const clearMemo = (id: string) => setMemoDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
  const busyRows = useRef(new Set<string>());
  const save = async (id: string, edit: ClaimListEdit) => {
    if (!canWrite || busyRows.current.has(id)) return;
    busyRows.current.add(id);
    setRowSaves(previous => ({ ...previous, [id]: { phase: 'saving', edit } }));
    try {
      await onUpdate(id, edit);
      if (edit.change.field === 'grossAmount') clearAmount(id);
      if (edit.change.field === 'memo') clearMemo(id);
      setRowSaves(previous => ({ ...previous, [id]: { phase: 'saved', edit } }));
    } catch {
      setRowSaves(previous => ({ ...previous, [id]: { phase: 'error', edit } }));
    } finally { busyRows.current.delete(id); }
  };
  const change = (id: string, value: ClaimListChange) => {
    const edit = { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `list-${Date.now()}-${Math.random().toString(36).slice(2)}`, recordedAt: new Date().toISOString(), change: value };
    void save(id, edit);
  };
  const control = (claim: DelegatedClaim, field: SelectField, mobile = false) => {
    const saved = rowSaves[claim.id];
    const current = field === 'delegation' ? getDelegation(claim) : getDepositState(claim)[field];
    const value = saved && saved.phase !== 'saved' && saved.edit.change.field === field ? saved.edit.change.value : current;
    return <label className={`dr-inline-field dr-inline-${field}`}><span>{fieldLabels[field]}</span>
      <select aria-label={`${claim.workerName}${mobile ? ' 모바일' : ''} ${fieldLabels[field]}`} className={field === 'status' ? `dr-deposit-${value}` : ''}
        value={value} disabled={Boolean(saved && saved.phase !== 'saved')} onChange={event => change(claim.id, { field, value: event.target.value } as ClaimListChange)}>
        {Object.entries(fieldOptions[field]).map(([option, label]) => <option key={option} value={option}>{label}</option>)}
      </select></label>;
  };
  const amountControl = (claim: DelegatedClaim, mobile = false) => {
    const draft = amountDrafts[claim.id];
    const clean = (draft ?? String(claim.grossAmount ?? '')).replace(/,/g, '').trim();
    const amount = clean === '' ? null : Number(clean);
    const valid = clean === '' || (/^\d+$/.test(clean) && Number.isSafeInteger(amount));
    const dirty = draft !== undefined && (!valid || amount !== claim.grossAmount);
    const locked = Boolean(rowSaves[claim.id] && rowSaves[claim.id].phase !== 'saved');
    return <form className="dr-inline-amount" onSubmit={event => { event.preventDefault(); if (dirty && valid && !locked) change(claim.id, { field: 'grossAmount', value: amount }); }}>
      <label className="dr-inline-money-input"><input aria-label={`${claim.workerName}${mobile ? ' 모바일' : ''} 세전 금액`} inputMode="numeric" placeholder="미확정" disabled={locked} aria-invalid={!valid}
        value={draft ?? claim.grossAmount?.toLocaleString('ko-KR') ?? ''} onChange={event => setAmountDrafts(previous => ({ ...previous, [claim.id]: event.target.value }))}
        onKeyDown={event => { if (event.key === 'Escape' && !locked) { event.preventDefault(); clearAmount(claim.id); } }} /></label>
      {dirty && <><div className="dr-inline-amount-actions"><button type="button" disabled={locked} onClick={() => clearAmount(claim.id)}>취소</button><button type="submit" disabled={!valid || locked} aria-label={`${claim.workerName}${mobile ? ' 모바일' : ''} 세전 금액 저장`}>저장</button></div>
        {!valid ? <small role="alert">0원 이상의 정수를 입력하세요.</small> : claim.taxRate !== undefined && claim.taxRate !== null && <small>설정 세율 {claim.taxRate}%로 세후 금액도 다시 계산합니다.</small>}</>}
    </form>;
  };
  const feedback = (claim: DelegatedClaim) => {
    const saved = rowSaves[claim.id];
    if (!saved) return null;
    return <div className={`dr-inline-feedback dr-inline-${saved.phase}`} role={saved.phase === 'error' ? 'alert' : 'status'}>
      {saved.phase === 'saving' ? '저장 중…' : saved.phase === 'saved' ? <><Check size={14} />저장됨</> : <><span>저장 확인 실패</span><button onClick={() => void save(claim.id, saved.edit)} aria-label={`${claim.workerName} 목록 변경 다시 저장`}>다시 저장</button></>}
    </div>;
  };
  const memoSticker = (claim: DelegatedClaim, mobile = false) => {
    return <DelegatedMemoSticker label={`${claim.workerName}${mobile ? ' 모바일' : ''}`} memo={claim.memo} draft={memoDrafts[claim.id]}
      canWrite={canWrite} locked={Boolean(rowSaves[claim.id] && rowSaves[claim.id].phase !== 'saved')}
      onStart={() => setMemoDrafts(previous => ({ ...previous, [claim.id]: claim.memo }))}
      onChange={value => setMemoDrafts(previous => ({ ...previous, [claim.id]: value }))}
      onSave={() => change(claim.id, { field: 'memo', value: memoDrafts[claim.id] })} onCancel={() => clearMemo(claim.id)}
      onDelete={() => change(claim.id, { field: 'memo', value: '' })} />;
  };
  const toggle = (id: string) => onSelect(selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id].slice(0, 400));
  const allSelected = claims.length > 0 && claims.length <= 400 && claims.every(claim => selectedIds.includes(claim.id));
  const groups = useMemo(() => groupClaimsBySite(claims, directory), [claims, directory]);
  const groupStyle = (group: ReceiptSiteGroup) => ({ '--dr-group-color': group.color } as React.CSSProperties);
  return <div className="dr-worker-ledger">
    {canWrite && <label className="dr-select-all"><input type="checkbox" checked={allSelected} onChange={event => onSelect(event.target.checked ? claims.slice(0, 400).map(claim => claim.id) : [])} />현재 목록 선택 {claims.length > 400 && '(최대 400건)'}</label>}
    <div className="dr-table-wrap"><table className="dr-table" aria-label="현장별 작업자 내역"><thead><tr>{canWrite && <th scope="col"><span className="dr-sr-only">선택</span></th>}<th scope="col">작업자</th><th scope="col">입금방법 / 받는 계좌</th><th scope="col" className="dr-align-right">세전 금액 (원)</th><th scope="col">입금여부</th><th scope="col">메모</th></tr></thead>{groups.map(group => <tbody key={group.key} className="dr-site-group" style={groupStyle(group)} aria-label={`${group.name} 내역`}>
      <tr className="dr-site-group-head"><th scope="rowgroup" colSpan={canWrite ? 6 : 5}><SiteGroupHeading group={group} /></th></tr>
      {group.claims.map(claim => {
        const state = getDepositState(claim);
        return <tr key={claim.id} className={selectedIds.includes(claim.id) ? 'dr-row-selected' : ''}>
          {canWrite && <td className="dr-checkbox-cell"><input type="checkbox" aria-label={`${claim.workerName} 선택`} checked={selectedIds.includes(claim.id)} onChange={() => toggle(claim.id)} /></td>}
          <td><WorkerIdentity claim={claim} directory={directory} />{feedback(claim)}</td>
          <td>{canWrite ? <div className="dr-inline-payment">{control(claim, 'delegation')}{control(claim, 'recipient')}</div> : <><span className="dr-delegation-label">{delegationLabels[getDelegation(claim)]}</span> {recipientLabels[state.recipient]}</>}</td>
          <td className="dr-align-right dr-number">{canWrite ? amountControl(claim) : won(claim.grossAmount)}</td>
          <td>{canWrite ? control(claim, 'status') : <DepositBadge claim={claim} />}</td>
          <td className="dr-memo-cell">{memoSticker(claim)}</td>
        </tr>;
      })}
    </tbody>)}</table></div>
    <div className="dr-mobile-list">{groups.map(group => <section className="dr-mobile-site-group" key={group.key} style={groupStyle(group)} aria-label={`${group.name} 모바일 내역`}><SiteGroupHeading group={group} /><div className="dr-site-group-workers">{group.claims.map(claim => {
      const state = getDepositState(claim); const total = getClaimTotals(claim);
      return <article className={`dr-worker-card ${selectedIds.includes(claim.id) ? 'dr-row-selected' : ''}`} key={claim.id}>
        <div className="dr-worker-heading"><div className="dr-worker-select">{canWrite && <input type="checkbox" aria-label={`${claim.workerName} 모바일 선택`} checked={selectedIds.includes(claim.id)} onChange={() => toggle(claim.id)} />}<WorkerIdentity claim={claim} directory={directory} /></div>{!canWrite && <DepositBadge claim={claim} />}</div>
        {canWrite ? <div className="dr-inline-mobile">{control(claim, 'delegation', true)}{control(claim, 'status', true)}{control(claim, 'recipient', true)}</div> : <div className="dr-worker-meta"><b>{delegationLabels[getDelegation(claim)]}</b><span>·</span>{recipientLabels[state.recipient]}</div>}
        <dl className="dr-worker-amounts"><div><dt>세전 금액 (원)</dt><dd>{canWrite ? amountControl(claim, true) : won(claim.grossAmount)}</dd></div><div><dt>기록된 입금액</dt><dd>{claim.receipts.length ? won(total.received) : '미기록'}</dd></div></dl>
        {feedback(claim)}<div className="dr-mobile-memo">{memoSticker(claim, true)}</div>
      </article>;
    })}</div></section>)}</div>
  </div>;
}
