import React from 'react';
import type { TransferRow, TransferSource } from './types';
import { SOURCE_LABELS } from './transferModel';
import { ISSUE_LABELS, matchesTransferIssue, TransferIssueFilter, transferTotals } from './transferWorkflow';

export type ListFilters = { query: string; group: string; source: TransferSource | 'all'; issue: TransferIssueFilter };
export const emptyListFilters: ListFilters = { query: '', group: 'all', source: 'all', issue: 'all' };
export function filterTransferList(rows: TransferRow[], filters: ListFilters, notes: Map<string, string[]>) {
    const normalize = (text: string) => text.toLocaleLowerCase().replace(/[\s-]/g, '');
    const query = normalize(filters.query);
    return rows.filter(row => (filters.group === 'all' || (row.groupName || '소속 미지정') === filters.group)
        && (filters.source === 'all' || row.source === filters.source)
        && matchesTransferIssue(row, filters.issue, notes.get(row.rowId) ?? [])
        && (!query || normalize(`${row.name} ${row.groupName} ${row.accountHolder} ${row.bankName} ${row.accountNumber} ${row.period}`).includes(query)));
}
export default function TransferListReview({ rows, visible, selection, filters, onChange, notes }: {
    rows: TransferRow[]; visible: TransferRow[]; selection: Set<string>; filters: ListFilters;
    onChange: (value: ListFilters) => void; notes: Map<string, string[]>;
}) {
    const groups = [...new Set(rows.map(row => row.groupName || '소속 미지정'))].sort((a, b) => a.localeCompare(b, 'ko'));
    const selected = rows.filter(row => selection.has(row.rowId));
    const sum = (items: TransferRow[]) => `${items.length}건 · ${Number.isSafeInteger(transferTotals(items)) ? transferTotals(items).toLocaleString('ko-KR') + '원' : '합계 범위 초과'}`;
    return <div className="bt-list-review">
        <div className="bt-issue-filters" role="group" aria-label="송금 문제별 보기">{(Object.keys(ISSUE_LABELS) as TransferIssueFilter[]).map(issue => <button key={issue} aria-pressed={filters.issue === issue} onClick={() => onChange({ ...filters, issue })}>{ISSUE_LABELS[issue]} <b>{rows.filter(row => matchesTransferIssue(row, issue, notes.get(row.rowId) ?? [])).length}</b></button>)}</div>
        <p className="bt-filter-help">파일 생성 불가 항목은 수정이 필요합니다. 주의사항은 상세내역을 확인한 뒤 검토를 완료하세요.</p>
        <div className="bt-list-filter-fields"><input aria-label="담은 송금 목록 검색" placeholder="이름·계좌·대상 월 검색" value={filters.query} onChange={event => onChange({ ...filters, query: event.target.value })} />
            <select aria-label="송금 목록 팀·거래처" value={filters.group} onChange={event => onChange({ ...filters, group: event.target.value })}><option value="all">전체 팀·거래처</option>{groups.map(group => <option key={group}>{group}</option>)}</select>
            <select aria-label="송금 목록 지급 종류" value={filters.source} onChange={event => onChange({ ...filters, source: event.target.value as ListFilters['source'] })}><option value="all">전체 지급 종류</option>{Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button onClick={() => onChange(emptyListFilters)}>필터 초기화</button></div>
        <div className="bt-list-totals"><span>전체 목록<strong>{sum(rows)}</strong></span><span>검색 결과<strong>{sum(visible)}</strong></span><span>선택 항목<strong>{sum(selected)}</strong></span></div>
        <details className="bt-group-totals"><summary>팀·지급 종류별 합계 보기</summary><p>팀·거래처를 누르면 해당 목록으로 좁혀집니다.</p>
            <div>{Object.entries(SOURCE_LABELS).map(([key, label]) => <button key={key} aria-pressed={filters.source === key} onClick={() => onChange({ ...emptyListFilters, source: key as TransferSource })}>{label}<strong>{sum(rows.filter(row => row.source === key))}</strong></button>)}</div>
            <div>{groups.map(group => <button key={group} aria-pressed={filters.group === group} onClick={() => onChange({ ...emptyListFilters, group })}>{group}<strong>{sum(rows.filter(row => (row.groupName || '소속 미지정') === group))}</strong></button>)}</div>
        </details>
    </div>;
}
