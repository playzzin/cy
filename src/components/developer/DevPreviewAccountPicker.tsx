import React, { useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Check, ChevronDown, Eye, History, Loader2, RefreshCw, Search, Users, X } from 'lucide-react';
import type { PositionItem } from '../../types/menu';
import type { PreviewAccount } from './DevUserPreview';
import './DevPreviewAccountPicker.css';

export type PreviewChoice = { positionId: string; uid: string };
interface Props {
    accounts: PreviewAccount[];
    positions: PositionItem[];
    positionId: string;
    uid: string;
    recent: PreviewChoice[];
    loading: boolean;
    busy: boolean;
    error: string;
    onConfirm: (choice: PreviewChoice) => void;
    onClose: () => void;
    onRestoreFocus: () => void;
    onReload: () => void;
}
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s/g, '');

export default function DevPreviewAccountPicker({ accounts, positions, positionId, uid, recent, loading, busy, error, onConfirm, onClose, onRestoreFocus, onReload }: Props) {
    const [draftPosition, setDraftPosition] = useState(positionId);
    const [draftUid, setDraftUid] = useState(uid);
    const [query, setQuery] = useState('');
    const search = useRef<HTMLInputElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const availablePositions = positions.filter(item => item.id !== 'full');
    const candidates = useMemo(() => accounts.filter(account => account.positionIds.includes(draftPosition))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko')), [accounts, draftPosition]);
    const results = candidates.filter(account => normalize(account.displayName + account.scopeLabel).includes(normalize(query)));
    const selected = candidates.find(account => account.uid === draftUid);
    const active = accounts.find(account => account.uid === uid);
    const positionName = availablePositions.find(item => item.id === draftPosition)?.name || '직책';
    const sameChoice = positionId === draftPosition && uid === draftUid;
    const recentChoices = recent.flatMap(choice => {
        const account = accounts.find(item => item.uid === choice.uid && item.positionIds.includes(choice.positionId));
        const position = availablePositions.find(item => item.id === choice.positionId);
        return account && position ? [{ ...choice, account, position }] : [];
    }).slice(0, 4);
    const choosePosition = (id: string) => {
        const matches = accounts.filter(account => account.positionIds.includes(id));
        const remembered = recent.find(choice => choice.positionId === id && matches.some(account => account.uid === choice.uid));
        setDraftPosition(id);
        setDraftUid(id === positionId ? uid : remembered?.uid || (matches.length === 1 ? matches[0].uid : ''));
        setQuery('');
    };

    return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
        <Dialog.Portal>
            <Dialog.Overlay className="dev-account-picker__overlay" />
            <Dialog.Content className="dev-account-picker" id="dev-preview-picker"
                onOpenAutoFocus={event => { event.preventDefault(); (window.innerWidth <= 600 ? closeButton.current : search.current)?.focus({ preventScroll: true }); }}
                onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus(); }}>
                <div className="dev-account-picker__handle" aria-hidden="true" />
                <header className="dev-account-picker__header">
                    <span className="dev-account-picker__heading-icon"><Users size={22} /></span>
                    <div className="dev-account-picker__heading-copy">
                        <Dialog.Title>사용자 시점으로 보기</Dialog.Title>
                        <Dialog.Description>직책과 사용자를 선택해 실제 메뉴와 담당 업무를 확인하세요.</Dialog.Description>
                    </div>
                    <Dialog.Close ref={closeButton} className="dev-account-picker__icon-button" aria-label="계정 선택 닫기"><X size={20} /></Dialog.Close>
                </header>
                {active && <div className="dev-account-picker__current"><span className="dev-account-picker__live-dot" />
                    <span>{busy ? '화면 준비 중' : '현재 보는 사용자'}</span><strong>{active.displayName}</strong>
                    <span className="dev-account-picker__current-scope">{active.scopeLabel}</span>
                </div>}
                <div className="dev-account-picker__body">
                    <aside className="dev-account-picker__positions">
                        <h3>직책 선택</h3>
                        <div className="dev-account-picker__role-list" role="group" aria-label="직책 선택">
                            {availablePositions.map(position => <button type="button" key={position.id}
                                className="dev-account-picker__role" aria-pressed={draftPosition === position.id}
                                onClick={() => choosePosition(position.id)}>
                                <span>{position.name}</span><span className="dev-account-picker__count">{loading ? '–' : accounts.filter(account => account.positionIds.includes(position.id)).length}</span>
                            </button>)}
                        </div>
                        <label className="dev-account-picker__mobile-role"><span>직책 선택</span>
                            <select aria-label="직책" value={draftPosition} onChange={event => choosePosition(event.target.value)}>
                                {availablePositions.map(position => <option key={position.id} value={position.id}>{position.name} · {accounts.filter(account => account.positionIds.includes(position.id)).length}명</option>)}
                            </select><ChevronDown size={16} aria-hidden="true" />
                        </label>
                        <div className="dev-account-picker__role-note"><Eye size={16} /><p>선택한 사용자의<br />조회 범위로 표시됩니다.</p></div>
                    </aside>
                    <section className="dev-account-picker__users" aria-label="사용자 선택">
                        <div className="dev-account-picker__list-heading"><h3>{positionName} <span>{loading ? '확인 중' : `${candidates.length}명`}</span></h3>
                            <button type="button" className="dev-account-picker__icon-button" aria-label="사용자 목록 새로고침" title="사용자 목록 새로고침" disabled={loading} onClick={onReload}><RefreshCw size={16} className={loading ? 'dev-account-picker__spin' : undefined} /></button>
                        </div>
                        <div className="dev-account-picker__search"><Search size={18} aria-hidden="true" />
                            <input ref={search} type="search" aria-label="이름 또는 담당 팀 검색" placeholder="이름 또는 담당 팀 검색" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
                            {query && <button type="button" className="dev-account-picker__icon-button" aria-label="검색어 지우기" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={16} /></button>}
                        </div>
                        {recentChoices.length > 0 && !query && <div className="dev-account-picker__recent">
                            <span><History size={13} />최근 확인</span>
                            <div>{recentChoices.map(choice => <button type="button" key={choice.positionId + ':' + choice.uid}
                                aria-label={`최근 확인: ${choice.account.displayName} · ${choice.position.name}`}
                                onClick={() => { setDraftPosition(choice.positionId); setDraftUid(choice.uid); setQuery(''); }}>
                                {choice.account.displayName}<small>{choice.position.name}</small>
                            </button>)}</div>
                        </div>}
                        {error && <div className="dev-account-picker__error" role="alert">{error}</div>}
                        <div className="dev-account-picker__results" aria-busy={loading}>
                            {loading ? <div className="dev-account-picker__skeletons" role="status" aria-label="사용자 목록 불러오는 중">{[0, 1, 2].map(index => <div key={index} className="dev-account-picker__skeleton"><span /><span /></div>)}</div>
                                : results.length ? <ul aria-label={`${positionName} 사용자 목록`}>{results.map(account => {
                                    const isCurrent = account.uid === uid && draftPosition === positionId;
                                    const isSelected = account.uid === draftUid;
                                    return <li key={account.uid}><button type="button" className="dev-account-picker__account" aria-pressed={isSelected}
                                        aria-label={`${account.displayName} · ${account.scopeLabel}`} onClick={() => setDraftUid(account.uid)}>
                                        <span className="dev-account-picker__avatar" aria-hidden="true">{Array.from(account.displayName.trim())[0] || '?'}</span>
                                        <span className="dev-account-picker__account-copy"><strong>{account.displayName}</strong><span>{account.scopeLabel || '담당 정보 미등록'}</span></span>
                                        {isCurrent && <span className="dev-account-picker__current-badge">현재</span>}
                                        <span className="dev-account-picker__selection" aria-hidden="true">{isSelected && <Check size={14} strokeWidth={3} />}</span>
                                    </button></li>;
                                })}</ul> : <div className="dev-account-picker__empty" role="status">
                                    <span>{query ? <Search size={26} /> : <Users size={26} />}</span>
                                    <strong>{query ? '검색 결과가 없습니다' : '연결된 사용자가 없습니다'}</strong>
                                    <p>{query ? '이름이나 담당 팀을 바꿔 검색해 보세요.' : '다른 직책을 선택하거나 계정 연결 상태를 확인해 주세요.'}</p>
                                    {query && <button type="button" onClick={() => setQuery('')}>검색 초기화</button>}
                                </div>}
                        </div>
                        <span className="dev-account-picker__sr-only" role="status" aria-live="polite">{loading ? '사용자 목록 확인 중' : `${results.length}명의 사용자${selected ? `, ${selected.displayName} 선택됨` : ''}`}</span>
                    </section>
                </div>
                <footer className="dev-account-picker__footer">
                    <p><Eye size={15} /><span>조회 전용 <span>· 저장·승인·발송은 차단됩니다</span></span></p>
                    <div className="dev-account-picker__confirm-row"><div className="dev-account-picker__summary"><strong>{selected?.displayName || '확인할 사용자를 선택하세요'}</strong><span>{selected ? `${positionName} · ${selected.scopeLabel}` : '선택 후 아래 화면으로 전환됩니다'}</span></div>
                        <button type="button" className="dev-account-picker__confirm" disabled={!selected || loading || (busy && sameChoice)} onClick={() => selected && onConfirm({ positionId: draftPosition, uid: selected.uid })}>
                            {busy && sameChoice ? <><Loader2 size={17} className="dev-account-picker__spin" />전환 중…</> : <>{sameChoice && !error ? '현재 화면 계속 보기' : '이 사용자로 보기'}<ArrowRight size={17} /></>}
                        </button>
                    </div>
                </footer>
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
