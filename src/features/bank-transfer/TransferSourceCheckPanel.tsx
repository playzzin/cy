import React from 'react';
import { Link } from 'react-router-dom';
import { SOURCE_LABELS } from './transferModel';
import type { TransferRow } from './types';
import type { TransferSourceReport } from './transferSourceComparison';

const LINKS = { account: '/database/account-management', payroll: '/payroll/monthly-wage', rent: '/support/accommodation', support: '/payroll/support-team-incoming' };
export default function TransferSourceCheckPanel({ rows, loading, stale, report, error, crossDraftCount, onRun }: {
    rows: TransferRow[]; loading: boolean; stale: boolean; report?: TransferSourceReport; error?: string; crossDraftCount: number; onRun: () => void;
}) {
    const differences = report?.items.filter(item => item.status !== 'same') ?? [];
    return <section className="bt-source-check" aria-label="원본 및 중복 확인">
        <div className="bt-source-check-bar"><div><strong>원본 및 중복 확인</strong><p>{crossDraftCount ? `다른 저장 목록과 겹칠 수 있는 대상 ${crossDraftCount}건 · 미리보기에서 목록 이름을 확인하세요.` : '다른 저장 목록과 겹치는 항목이 없습니다.'}</p></div>
            <button disabled={loading || !rows.length} onClick={onRun}>{loading ? '원본 비교 중…' : '원본과 비교'}</button></div>
        <p className="bt-check-help">금액·계좌·상태를 조회해 차이를 표시합니다. 현재 송금 내용은 유지됩니다. 급여는 저장된 계산 원본과 비교하며, 미저장 변경·가불 세부 기준은 급여 탭에서 다시 조회해야 합니다.</p>
        {stale && <p role="status" className="bt-check-warning">목록이 변경되어 이전 비교 결과를 해제했습니다. 다시 비교해 주세요.</p>}
        {error && <p role="alert" className="bt-error">{error}</p>}
        {report && <details className="bt-comparison-results" open={differences.length > 0}>
            <summary>{new Date(report.checkedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} 비교 · 확인 항목 일치 {report.items.filter(item => item.status === 'same').length}건 · 차이/주의 {report.items.filter(item => item.status === 'different').length}건 · 확인 불가 {report.items.filter(item => item.status === 'unavailable').length}건</summary>
            {!differences.length ? <p>비교 가능한 금액·계좌·안내에 차이가 없습니다. 실제 은행 지급 여부를 확인한 결과는 아닙니다.</p> : <ul>{differences.map(item => {
                const row = rows.find(row => row.rowId === item.rowId); if (!row) return null;
                return <li key={item.rowId}><div><strong>{row.name}</strong><span>{SOURCE_LABELS[row.source]} · {row.period || '직접 입력'}</span><Link to={LINKS[row.source]}>원본 화면</Link></div>
                    {item.notes.map((note, index) => <p key={index}>{note}</p>)}{item.currentAccount && <small>현재 원본 계좌: {item.currentAccount}</small>}
                </li>;
            })}</ul>}
        </details>}
    </section>;
}
