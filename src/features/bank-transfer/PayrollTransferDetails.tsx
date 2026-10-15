import React from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import type { TransferCandidate } from './types';
import { isPayrollTransferDetail } from './payrollTransferDetail';
import type { PayrollDetailLoadState } from './usePayrollDetailRecovery';
import TransferAmountSummary from './TransferAmountSummary';

const amount = (value?: number) => value === undefined ? '내역 없음' : `${value.toLocaleString('ko-KR')}원`;

export default function PayrollTransferDetails({ row, onLoadDetail, loadState, onQueryPayroll, onExpand, expanded }: {
    row: TransferCandidate; onLoadDetail?: () => void; loadState?: PayrollDetailLoadState;
    onQueryPayroll?: () => void; onExpand?: () => void; expanded?: boolean;
}) {
    if (row.source !== 'payroll') return null;
    const detail = isPayrollTransferDetail(row.payrollDetail) ? row.payrollDetail : undefined;
    const lines = detail ? [...detail.deductions, ...detail.taxes] : [];
    const lineTotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const changed = detail && row.amount !== detail.originalAmount;
    return <details className="bt-payroll-detail" open={expanded || undefined} onDragStart={event => event.stopPropagation()} onToggle={event => {
        if (event.currentTarget.open && !detail && !loadState?.loading && !loadState?.error) onLoadDetail?.();
    }}>
        <summary aria-label={`${row.name} 급여 상세보기`}><FileText size={14} /><span>급여 상세보기</span>{detail && <small>{detail.totalManDay === undefined ? detail.salaryLabel : `${detail.totalManDay}공수 · ${detail.salaryLabel}`}</small>}<ChevronDown size={14} className="bt-detail-chevron" /></summary>
        {!detail ? <div className="bt-detail-content"><p>이전에 저장한 목록에는 상세 내역이 없습니다. 저장된 이체금액과 계좌를 유지하며 급여 원본을 확인합니다.</p>
            {loadState?.loading ? <p role="status">{row.period} 급여 원본에서 상세내역을 불러오고 있습니다…</p> : <>
                {loadState?.error && <p role="alert">{loadState.error}</p>}
                <div className="bt-detail-actions">{onLoadDetail && <button onClick={onLoadDetail} aria-label={`${row.name} 급여 상세 다시 불러오기`}>상세내역 다시 불러오기</button>}
                    {onQueryPayroll && <button onClick={onQueryPayroll}>급여에서 다시 조회</button>}</div>
            </>}
        </div> : <div className="bt-detail-content">
            {onExpand && <button className="bt-expand-detail" onClick={onExpand} aria-label={`${row.name} 급여 내역 넓게 보기`}>넓게 보기</button>}
            <div className="bt-detail-caption"><strong>{row.period} · {row.name}</strong><span>{detail.isFinalized ? '확정 당시 내역' : '불러온 시점의 내역'}</span></div>
            {detail.restoredFromSource && <p className="bt-detail-edited">이전 목록에 없던 상세를 현재 급여 원본에서 연결했습니다. 기존 이체금액·계좌·메모는 유지됩니다. 목록 저장 시 함께 보관됩니다.</p>}
            <TransferAmountSummary row={row} />
            <div className="bt-pay-summary">
                <div><span>총 급여</span><strong>{amount(detail.grossAmount)}</strong></div>
                <div><span>총 공제</span><strong>{amount(detail.totalDeduction)}</strong></div>
                <div><span>실지급액</span><strong>{amount(detail.netAmount)}</strong></div>
            </div>
            <div className="bt-detail-basis"><span>이번 이체 기준<strong>{detail.amountBasis}</strong></span><b>{amount(detail.originalAmount)}</b></div>
            {changed && <p className="bt-detail-edited" role="status">{detail.restoredFromSource ? `현재 급여 원본의 기준 금액은 ${amount(detail.originalAmount)}이며, 저장된 이체금액 ${amount(row.amount)}을 그대로 유지했습니다.` : `송금 목록에서 이체금액을 ${amount(row.amount)}으로 수정했습니다. 아래 급여 원본 내역은 유지됩니다.`}</p>}
            <h3>가불·공제·세금 내역</h3>
            {lines.length ? <dl className="bt-deduction-lines">{lines.map((line, index) => <div key={`${line.label}:${index}`}><dt>{line.label}{line.description && <small>{line.description}</small>}</dt><dd>{amount(line.amount)}</dd></div>)}</dl>
                : <p>{detail.totalDeduction === 0 ? '적용된 공제가 없습니다.' : '저장된 항목별 공제 내역이 없습니다.'}</p>}
            {detail.totalDeduction !== undefined && Math.abs(lineTotal - detail.totalDeduction) >= 1 && <p className="bt-detail-edited">항목 합계 {amount(lineTotal)} · 총 공제 {amount(detail.totalDeduction)}. 원본 급여에서 상세 항목을 확인해 주세요.</p>}
            <h3>근무 내역 <span>{detail.workEntries.length}건{detail.totalManDay !== undefined ? ` · ${detail.totalManDay}공수` : ''}</span></h3>
            {detail.workEntries.length ? <div className="bt-work-table" tabIndex={0} role="region" aria-label={`${row.name} 근무 내역`}><table><thead><tr><th>근무일</th><th>현장</th><th>공수</th><th>단가</th><th>금액</th></tr></thead><tbody>{detail.workEntries.map((entry, index) => <tr key={`${entry.date}:${index}`}><td>{entry.date || '—'}</td><td>{entry.siteName || '미지정'}</td><td>{entry.manDay}</td><td>{amount(entry.unitPrice)}</td><td>{amount(entry.amount)}</td></tr>)}</tbody></table></div>
                : <p>저장된 일자별 근무 내역이 없습니다.</p>}
            <p className="bt-detail-footnote">{new Date(detail.capturedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 불러온 내역 · 목록 저장 시 함께 보관됩니다.</p>
        </div>}
    </details>;
}
