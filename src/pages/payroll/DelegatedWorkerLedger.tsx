import React from 'react';
import { ChevronRight, UserRound } from 'lucide-react';
import type { DelegatedClaim } from '../../features/delegated-receipts/model';
import { getClaimTotals } from '../../features/delegated-receipts/model';
import { depositLabels, getDelegation, getDepositState, recipientLabels } from '../../features/delegated-receipts/depositState';
import { getSiteTeam, ReceiptDirectory, recipientDetail, validTeamColor } from '../../features/delegated-receipts/teamDirectory';

export function DepositBadge({ claim }: { claim: DelegatedClaim }) {
  const state = getDepositState(claim);
  return <span className={`dr-badge dr-deposit-${state.status}`}><span aria-hidden="true" />{depositLabels[state.status]}</span>;
}
export function SiteTeamLabel({ claim, directory }: { claim: DelegatedClaim; directory: ReceiptDirectory }) {
  const team = getSiteTeam(claim, directory);
  return <span className="dr-team-site" style={{ borderColor: validTeamColor(team?.color) }}>
    <span className="dr-team-dot" style={{ backgroundColor: validTeamColor(team?.color) }} aria-hidden="true" />
    <span>{claim.siteName}<small>{team?.name || '담당 팀 연결 필요'}</small></span>
  </span>;
}
function WorkerIdentity({ claim, directory }: { claim: DelegatedClaim; directory: ReceiptDirectory }) {
  const color = validTeamColor(getSiteTeam(claim, directory)?.color);
  return <span className="dr-worker-identity" style={{ '--dr-worker-color': color } as React.CSSProperties}>
    <span className="dr-worker-avatar" aria-hidden="true"><UserRound size={18} strokeWidth={2} /></span>
    <strong className="dr-worker-name">{claim.workerName}</strong>
  </span>;
}
const won = (value: number | null) => value === null ? '금액 미설정' : `${value.toLocaleString('ko-KR')}원`;
const delegationLabels = { delegate: '위임', direct: '직불', unknown: '구분 확인' };

export default function DelegatedWorkerLedger({ claims, directory, canWrite, selectedIds, onSelect, onOpen }: {
  claims: DelegatedClaim[]; directory: ReceiptDirectory; canWrite: boolean; selectedIds: string[];
  onSelect: (ids: string[]) => void; onOpen: (claim: DelegatedClaim) => void;
}) {
  const toggle = (id: string) => onSelect(selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id].slice(0, 400));
  const allSelected = claims.length > 0 && claims.length <= 400 && claims.every(claim => selectedIds.includes(claim.id));
  return <>
    {canWrite && <label className="dr-select-all"><input type="checkbox" checked={allSelected} onChange={event => onSelect(event.target.checked ? claims.slice(0, 400).map(claim => claim.id) : [])} />현재 목록 선택 {claims.length > 400 && '(최대 400건)'}</label>}
    <div className="dr-table-wrap"><table className="dr-table"><thead><tr>{canWrite && <th><span className="dr-sr-only">선택</span></th>}<th>작업자 / 현장·팀</th><th>입금방법 / 받는 계좌</th><th className="dr-align-right">원본 금액 / 받을 예정</th><th>입금여부</th><th><span className="dr-sr-only">상세 보기</span></th></tr></thead><tbody>
      {claims.map(claim => {
        const state = getDepositState(claim); const total = getClaimTotals(claim);
        return <tr key={claim.id} className={selectedIds.includes(claim.id) ? 'dr-row-selected' : ''}>
          {canWrite && <td className="dr-checkbox-cell"><input type="checkbox" aria-label={`${claim.workerName} 선택`} checked={selectedIds.includes(claim.id)} onChange={() => toggle(claim.id)} /></td>}
          <td><WorkerIdentity claim={claim} directory={directory} /><SiteTeamLabel claim={claim} directory={directory} /></td>
          <td><span className="dr-delegation-label">{delegationLabels[getDelegation(claim)]}</span> {recipientLabels[state.recipient]}<span className="dr-cell-sub">{recipientDetail(claim, state.recipient, directory)}</span></td>
          <td className="dr-align-right dr-number">{won(claim.grossAmount ?? claim.expectedAmount)}<span className="dr-cell-sub">{claim.grossAmount !== null ? `세전 · 받을 예정 ${won(claim.expectedAmount)}` : '원본 세후 금액'}</span></td>
          <td><DepositBadge claim={claim} /><span className="dr-cell-sub">{state.basis}{claim.receipts.length > 0 ? ` · 기록 ${won(total.received)}` : ' · 금액 미기록'}</span></td>
          <td><button className="dr-row-button" onClick={() => onOpen(claim)} aria-label={`${claim.workerName} 입금 및 내역`}>{canWrite ? '확인 · 내역' : '내역 보기'}<ChevronRight size={14} /></button></td>
        </tr>;
      })}
    </tbody></table></div>
    <div className="dr-mobile-list">{claims.map(claim => {
      const state = getDepositState(claim); const total = getClaimTotals(claim); const team = getSiteTeam(claim, directory);
      return <article className={`dr-worker-card ${selectedIds.includes(claim.id) ? 'dr-row-selected' : ''}`} key={claim.id} style={{ borderLeft: `4px solid ${validTeamColor(team?.color)}` }}>
        <div className="dr-worker-heading"><div className="dr-worker-select">{canWrite && <input type="checkbox" aria-label={`${claim.workerName} 모바일 선택`} checked={selectedIds.includes(claim.id)} onChange={() => toggle(claim.id)} />}<WorkerIdentity claim={claim} directory={directory} /></div><DepositBadge claim={claim} /></div>
        <SiteTeamLabel claim={claim} directory={directory} />
        <div className="dr-worker-meta"><b>{delegationLabels[getDelegation(claim)]}</b><span>·</span>{recipientLabels[state.recipient]}</div>
        <p className="dr-recipient-detail">{recipientDetail(claim, state.recipient, directory)}</p>
        <dl className="dr-worker-amounts"><div><dt>{claim.grossAmount !== null ? '원본 세전' : '원본 세후'}</dt><dd>{won(claim.grossAmount ?? claim.expectedAmount)}</dd></div><div><dt>받을 예정</dt><dd>{won(claim.expectedAmount)}</dd></div><div><dt>기록된 입금액</dt><dd>{claim.receipts.length ? won(total.received) : '미기록'}</dd></div></dl>
        <div className="dr-worker-footer"><span>{state.basis}</span><button className="dr-button" onClick={() => onOpen(claim)} aria-label={`${claim.workerName} 모바일 입금 및 내역`}>확인 · 내역<ChevronRight size={16} /></button></div>
      </article>;
    })}</div>
  </>;
}
