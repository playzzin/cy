import React, { useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Search, Users, Wallet, X } from 'lucide-react';
import type { AdvanceSummaryTeam, AdvanceSummaryWorker } from '../utils/advanceSummary';
import { normalizeHexColor } from '../../../utils/color';
import '../../../components/common/ResponsiveDetailDialog.css';
import './AdvancePrepaymentDialog.css';

interface Props {
    workers: AdvanceSummaryWorker[];
    teams: AdvanceSummaryTeam[];
    initialWorkerId: string;
    initialTeamId?: string;
    amounts: Map<string, number>;
    month: string;
    onSave: (workerId: string, amount: number, expectedAmount: number) => Promise<void>;
    onClose: () => void;
}
const searchKey = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
const won = (amount: number) => amount.toLocaleString('ko-KR');
const teamStyle = (color?: string | null) => ({ '--prepay-team-color': normalizeHexColor(color, '#0b8d69') } as React.CSSProperties);

export default function AdvancePrepaymentDialog({ workers, teams, initialWorkerId, initialTeamId = '', amounts, month, onSave, onClose }: Props) {
    const choices = useMemo(() => workers.flatMap(worker => {
        const team = worker.teamId ? teams.find(candidate => candidate.id === worker.teamId || candidate.legacyId === worker.teamId) : undefined;
        return worker.id && team ? [{ id: worker.id, name: worker.name || '이름 미등록', team }] : [];
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.team.name.localeCompare(b.team.name, 'ko')), [workers, teams]);
    const [workerId, setWorkerId] = useState(initialWorkerId);
    const [teamId, setTeamId] = useState(() => choices.find(worker => worker.id === initialWorkerId)?.team.id
        || teams.find(team => team.id === initialTeamId || team.legacyId === initialTeamId)?.id || '');
    const [query, setQuery] = useState('');
    const [originalAmounts] = useState(() => new Map(amounts));
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef(false);
    const returnFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const matches = (worker: typeof choices[number], filterTeam: string, filterQuery: string) =>
        (!filterTeam || worker.team.id === filterTeam) && searchKey(`${worker.name} ${worker.team.name}`).includes(searchKey(filterQuery));
    const visibleWorkers = choices.filter(worker => matches(worker, teamId, query));
    const selectedWorker = visibleWorkers.find(worker => worker.id === workerId);
    const activeTeam = selectedWorker?.team || teams.find(team => team.id === teamId);
    const draft = workerId ? drafts[workerId] ?? String(originalAmounts.get(workerId) || '') : '';
    const amount = Number(draft.replace(/,/g, ''));
    const valid = draft.trim() !== '' && Number.isSafeInteger(amount) && amount >= 0;
    const changeFilter = (nextTeam: string, nextQuery: string) => {
        setTeamId(nextTeam); setQuery(nextQuery); setError('');
        if (!choices.some(worker => worker.id === workerId && matches(worker, nextTeam, nextQuery))) setWorkerId('');
    };
    const updateDraft = (value: string) => { setDrafts(current => ({ ...current, [workerId]: value })); setError(''); };
    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending.current || !selectedWorker || !valid) return;
        pending.current = true; setSaving(true); setError('');
        try { await onSave(workerId, amount, originalAmounts.get(workerId) || 0); }
        catch { setError('선입금을 저장하지 못했습니다. 다른 화면의 변경 여부와 권한을 확인하고 다시 입력해 주세요.'); }
        finally { pending.current = false; setSaving(false); }
    };
    return <Dialog.Root open onOpenChange={open => { if (!open && !pending.current) onClose(); }}><Dialog.Portal>
        <Dialog.Overlay className="cy-detail-dialog__overlay" />
        <Dialog.Content className="cy-detail-dialog as-prepayment-dialog" style={teamStyle(activeTeam?.color)} onCloseAutoFocus={event => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}>
            <header className="cy-detail-dialog__header">
                <div className="as-prepay-title"><span className="as-prepay-icon"><Wallet size={22} aria-hidden="true" /></span><div><Dialog.Title>선입금 수기 입력</Dialog.Title><Dialog.Description>{month} 선입금</Dialog.Description></div></div>
                <button type="button" className="cy-detail-dialog__close" aria-label="선입금 입력 닫기" disabled={saving} onClick={onClose}><X size={18} /></button>
            </header>
            <form className="as-prepay-form" onSubmit={save} aria-busy={saving}>
                <div className="cy-detail-dialog__body as-prepay-body">
                    <div className="as-prepay-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="선입금 작업자 검색" placeholder="이름 또는 팀 검색" value={query} disabled={saving} onChange={event => changeFilter(teamId, event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></div>
                    <div className="as-prepay-teams" role="group" aria-label="선입금 팀 선택">
                        <button type="button" aria-pressed={!teamId} disabled={saving} onClick={() => changeFilter('', query)}><Users size={14} aria-hidden="true" />전체 팀 <small>{choices.length}</small></button>
                        {teams.map(team => ({ ...team, count: choices.filter(worker => worker.team.id === team.id).length })).filter(team => team.count > 0).map(team =>
                            <button key={team.id} type="button" aria-label={`${team.name} 선택`} aria-pressed={teamId === team.id} disabled={saving} style={teamStyle(team.color)} onClick={() => changeFilter(team.id, query)}>
                                <span className="as-prepay-dot" />{team.name}<small>{team.count}</small>
                            </button>)}
                    </div>
                    <div className="as-prepay-workspace">
                        <section className="as-prepay-picker" aria-label="선입금 작업자 선택">
                            <div className="as-prepay-section-title"><strong>작업자 선택</strong><span>{visibleWorkers.length}명</span></div>
                            <div className="as-prepay-workers" role="group" aria-label="선입금 작업자 목록">
                                {visibleWorkers.map(worker => <button key={worker.id} type="button" className="as-prepay-worker" aria-label={`${worker.team.name} ${worker.name} 선택`} aria-pressed={workerId === worker.id} disabled={saving} style={teamStyle(worker.team.color)}
                                    onClick={() => { setWorkerId(worker.id); setError(''); }}>
                                    <span className="as-prepay-avatar" aria-hidden="true">{worker.name.slice(0, 1)}</span>
                                    <span className="as-prepay-worker-info"><strong>{worker.name}</strong><small><span className="as-prepay-dot" />{worker.team.name}</small></span>
                                    <span className="as-prepay-worker-amount">{won(originalAmounts.get(worker.id) || 0)}원</span>
                                    <span className="as-prepay-check" aria-hidden="true">{workerId === worker.id && <Check size={13} />}</span>
                                </button>)}
                                {visibleWorkers.length === 0 && <div className="as-prepay-empty" role="status"><Users size={26} aria-hidden="true" /><strong>작업자가 없습니다.</strong><span>팀이나 검색어를 변경해 주세요.</span></div>}
                            </div>
                        </section>
                        <section className="as-prepay-entry" aria-label="선입금 금액 입력">
                            <div className="as-prepay-recipient"><span className="as-prepay-section-title">입력 대상</span><strong>{selectedWorker?.name || '작업자를 선택해 주세요'}</strong>{selectedWorker && <span className="as-prepay-team-badge"><span className="as-prepay-dot" />{selectedWorker.team.name}</span>}</div>
                            <div className="as-prepay-existing"><span>기존 선입금</span><strong>{won(selectedWorker ? originalAmounts.get(workerId) || 0 : 0)}원</strong></div>
                            <label className="as-prepay-amount-label" htmlFor="prepayment-amount">선입금 금액</label>
                            <div className="as-prepay-amount"><input id="prepayment-amount" aria-label="선입금 금액" inputMode="numeric" autoComplete="off" value={draft ? draft.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} disabled={saving || !selectedWorker}
                                onChange={event => updateDraft(event.target.value.replace(/[^0-9]/g, ''))} placeholder="0" /><span>원</span></div>
                            <div className="as-prepay-quick" aria-label="선입금 금액 더하기">{[50000, 100000, 500000].map(increment => <button key={increment} type="button" disabled={saving || !selectedWorker || !Number.isSafeInteger(amount + increment)} onClick={() => updateDraft(String(amount + increment))}>+{increment / 10000}만</button>)}<button type="button" disabled={saving || !selectedWorker} onClick={() => updateDraft('0')}>0원</button></div>
                            <p className="as-prepay-help">선택한 월의 총액으로 저장합니다.<br />기존 금액을 지우려면 0원을 입력하세요.</p>
                        </section>
                    </div>
                    {error && <p role="alert" className="as-memo-error">{error}</p>}
                </div>
                <footer className="as-prepay-footer"><span>{selectedWorker ? `${selectedWorker.name} · ${valid ? won(amount) : '0'}원` : '작업자 선택 후 금액을 입력하세요'}</span><button type="button" disabled={saving} onClick={onClose}>닫기</button><button type="submit" className="as-prepay-save" disabled={saving || !selectedWorker || !valid}><Check size={16} aria-hidden="true" />{saving ? '저장 중' : '선입금 저장'}</button></footer>
            </form>
        </Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
}
