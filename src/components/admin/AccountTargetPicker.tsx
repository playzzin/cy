import React, { useState } from 'react';
import { AccountTarget, searchAccountTargets } from '../../utils/accountTargetMatching';

export default function AccountTargetPicker({ targets, selectedId, onSelect, disabled, label = '연결 대상 검색' }: {
    targets: AccountTarget[]; selectedId: string; onSelect: (id: string) => void; disabled?: boolean; label?: string;
}) {
    const [query, setQuery] = useState('');
    const [availableOnly, setAvailableOnly] = useState(true);
    const filtered = searchAccountTargets(targets, query).filter(target => !availableOnly || !target.blocked);
    return <div className="um-target-picker">
        <div className="um-search"><input aria-label={label} value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} placeholder="이름, 연락처, 이메일, 회사 검색" />{query && <button type="button" aria-label={`${label} 지우기`} disabled={disabled} onClick={() => setQuery('')}>×</button>}</div>
        <div className="um-target-tools"><label className="um-checkbox"><input type="checkbox" checked={availableOnly} disabled={disabled} onChange={event => setAvailableOnly(event.target.checked)} />연결 가능한 대상만</label><span className="um-muted">{filtered.length}개 · 일치하는 대상 우선</span></div>
        <div className="um-target-options" role="group" aria-label="연결 대상 후보">
            {filtered.slice(0, 60).map(target => <button type="button" key={target.id} className="um-target-option" disabled={disabled || target.blocked} aria-pressed={selectedId === target.id} onClick={() => onSelect(target.id)}>
                <span><strong>{target.name}</strong><small>{target.detail || '추가 정보 없음'}</small></span>
                <span className="um-target-reasons">{target.blocked ? <span className="um-badge um-warning">다른 계정에 연결됨</span> : target.reasons.map(reason => <span key={reason} className="um-badge um-good">{reason}</span>)}{selectedId === target.id && <span className="um-badge">선택됨</span>}</span>
            </button>)}
            {!filtered.length && <p className="um-empty">조건에 맞는 대상이 없습니다. 검색어나 필터를 바꿔 보세요.</p>}
        </div>
        {filtered.length > 60 && <p className="um-muted">상위 60개를 표시합니다. 검색하면 더 빠르게 찾을 수 있습니다.</p>}
    </div>;
}
