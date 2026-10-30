import React from 'react';
import type { Worker } from '../../../services/manpowerService';
import { ADVANCE_REQUEST_ROUNDS, ADVANCE_REQUEST_CATEGORY_LABELS, type AdvanceRequestCategory } from '../../../types/advanceRequestCategory';
import { normalizeHexColor } from '../../../utils/color';

interface Props {
    workers: Worker[];
    selectedWorkerId: string;
    category: AdvanceRequestCategory;
    onCategory: (value: 'first' | 'second') => void;
    onSelect: (id: string) => void;
    amountFor: (id: string) => string;
    onAmount: (id: string, value: string) => void;
    onSubmit: () => void;
    canSubmit: boolean;
    saving: boolean;
    loading: boolean;
    search: string;
    onSearch: (value: string) => void;
}

export default function AdvanceRequestMobileInput(props: Props) {
    return <section className="advance-mobile-input" aria-label="작업자별 가불 신청">
        <fieldset disabled={props.saving}><legend>신청 회차</legend>
            <div className="advance-mobile-rounds">{ADVANCE_REQUEST_ROUNDS.map(round => <button type="button" key={round}
                aria-pressed={props.category === round} onClick={() => props.onCategory(round)}>{ADVANCE_REQUEST_CATEGORY_LABELS[round]}</button>)}</div>
        </fieldset>
        <input type="search" aria-label="작업자 검색" placeholder="이름 검색" value={props.search} onChange={event => props.onSearch(event.target.value)} />
        <div className="advance-mobile-workers">
            {props.loading ? <p role="status">불러오는 중</p> : props.workers.length === 0 ? <p>작업자 없음</p> : props.workers.map(worker => <div key={worker.id}
                className={`advance-mobile-worker${props.selectedWorkerId === worker.id ? ' is-selected' : ''}`}>
                <button type="button" className="advance-mobile-name" onClick={() => props.onSelect(worker.id!)} disabled={props.saving}>
                    <span className="advance-mobile-team-color" style={{ backgroundColor: normalizeHexColor(worker.color, '#94a3b8') }} role="img" aria-label={worker.teamName || '팀 미배정'} />
                    <span>{worker.name}</span>
                </button>
                <label className="advance-mobile-amount"><span className="sr-only">{worker.name} {ADVANCE_REQUEST_CATEGORY_LABELS[props.category]} 신청 금액</span>
                    <input aria-label={`${worker.name} ${ADVANCE_REQUEST_CATEGORY_LABELS[props.category]} 신청 금액`} inputMode="numeric" placeholder="0" value={props.amountFor(worker.id!)} disabled={props.saving}
                        onFocus={() => props.onSelect(worker.id!)} onChange={event => props.onAmount(worker.id!, event.target.value)} /><span>원</span>
                </label>
                <button type="button" className="advance-mobile-submit" aria-label={`${worker.name} 가불 신청`}
                    disabled={props.selectedWorkerId !== worker.id || !props.canSubmit || props.saving} onClick={props.onSubmit}>신청</button>
            </div>)}
        </div>
    </section>;
}
