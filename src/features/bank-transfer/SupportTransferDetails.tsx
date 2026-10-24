import React from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import type { TransferCandidate } from './types';
import { isSupportTransferDetail } from './supportTransferDetail';
import type { SupportDetailLoadState } from './useSupportDetailRecovery';
import TransferAmountSummary from './TransferAmountSummary';

const amount = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const manDays = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });

export default function SupportTransferDetails({ row, onLoadDetail, loadState, onExpand, expanded }: {
    row: TransferCandidate;
    onLoadDetail?: () => void;
    loadState?: SupportDetailLoadState;
    onExpand?: () => void;
    expanded?: boolean;
}) {
    if (row.source !== 'support') return null;
    const detail = isSupportTransferDetail(row.supportDetail) ? row.supportDetail : undefined;
    return <details className="bt-payroll-detail bt-support-detail" open={expanded || undefined} onDragStart={event => event.stopPropagation()} onToggle={event => {
        if (event.currentTarget.open && !detail && !loadState?.loading && !loadState?.error) onLoadDetail?.();
    }}>
        <summary aria-label={`${row.name} 외부지원비 상세보기`}><FileText size={14} /><span>외부지원비 상세보기</span>{detail && <small>{manDays(detail.totalManDay)}공수 · {detail.siteCount}개 현장</small>}<ChevronDown size={14} className="bt-detail-chevron" /></summary>
        {!detail ? <div className="bt-detail-content">
            {loadState?.loading ? <p role="status">{row.period} 지원비 원본에서 상세내역을 불러오고 있습니다…</p> : <>
                <p>저장된 이체금액과 계좌를 유지하면서 해당 월·팀의 상세내역을 불러옵니다.</p>
                {loadState?.error && <p role="alert">{loadState.error}</p>}
                {onLoadDetail && <button type="button" onClick={onLoadDetail} aria-label={`${row.name} 지원비 상세 다시 불러오기`}>상세내역 다시 불러오기</button>}
            </>}
        </div> : <div className="bt-detail-content">
            {onExpand && <button className="bt-expand-detail" onClick={onExpand} aria-label={`${row.name} 지원비 내역 넓게 보기`}>넓게 보기</button>}
            <div className="bt-detail-caption"><strong>{row.period} · {row.name}</strong><span>불러온 시점의 내역</span></div>
            {detail.restoredFromSource && <p className="bt-detail-edited">이전 저장본에 없던 상세내역을 현재 지원비 원본에서 불러왔습니다. 기존 이체금액과 계좌는 유지됩니다. 목록 저장을 누르면 이 내역도 함께 보관됩니다.</p>}
            <TransferAmountSummary row={row} />
            <div className="bt-pay-summary">
                <div><span>청구금액</span><strong>{amount(detail.billingAmount)}</strong></div>
                <div><span>추가금액</span><strong>{amount(detail.additionalAmount)}</strong></div>
                <div><span>후청구 경비</span><strong>{amount(detail.expenseAmount)}</strong></div>
            </div>
            <div className="bt-detail-basis"><span>총 지원비<strong>청구금액 + 추가금액 + 후청구 경비</strong></span><b>{amount(detail.originalAmount)}</b></div>
            {row.amount !== detail.originalAmount && <p className="bt-detail-edited" role="status">{detail.restoredFromSource
                ? `현재 원본 지원비는 ${amount(detail.originalAmount)}이며, 저장된 이체금액 ${amount(row.amount)}을 그대로 유지했습니다.`
                : `송금 목록에서 이체금액을 ${amount(row.amount)}으로 수정했습니다. 아래 지원비 원본 내역은 유지됩니다.`}</p>}
            <h3>일자별 지원 내역 <span>{detail.workEntries.length}건 · {manDays(detail.totalManDay)}공수</span></h3>
            {detail.workEntries.length ? <div className="bt-work-table bt-support-work" tabIndex={0} role="region" aria-label={`${row.name} 일자별 지원 내역`}><table>
                <thead><tr><th>지원일</th><th>현장 / 담당팀</th><th>작업자</th><th>공수</th><th>청구단가</th><th>청구금액</th></tr></thead>
                <tbody>{detail.workEntries.map((entry, index) => <tr key={`${entry.date}:${index}`}>
                    <td>{entry.date || '—'}</td><td>{entry.siteName || '미지정'}<small>{entry.targetTeamName}</small></td><td>{entry.workerName}</td><td>{manDays(entry.manDay)}</td><td>{amount(entry.unitPrice)}<small>{entry.rateSource}</small></td><td>{amount(entry.amount)}</td>
                </tr>)}</tbody>
            </table></div> : <p>저장된 일자별 지원 내역이 없습니다.</p>}
            <p className="bt-detail-footnote">각 작업자의 공수 × 청구단가를 원 단위로 반올림하여 합산한 금액입니다.</p>
            <h3>추가금액</h3>
            <dl className="bt-deduction-lines"><div><dt>{detail.adjustmentScope === 'merged' ? '여러 담당팀 통합 정산 추가금액' : '담당팀 정산 추가금액'}<small>외부지원온곳 화면에 입력한 월별 추가금액</small></dt><dd>{amount(detail.additionalAmount)}</dd></div></dl>
            <h3>후청구 경비 <span>{detail.expenseEntries.length}건</span></h3>
            {detail.expenseEntries.length ? <div className="bt-work-table bt-support-expenses" tabIndex={0} role="region" aria-label={`${row.name} 후청구 경비 내역`}><table>
                <thead><tr><th>발생일</th><th>현장 / 경비 내용</th><th>상태</th><th>금액</th></tr></thead>
                <tbody>{detail.expenseEntries.map((entry, index) => <tr key={`${entry.date}:${index}`}>
                    <td>{entry.date || '—'}</td><td>{entry.siteName || '미지정'}<small>{[entry.category, entry.description].filter(Boolean).join(' · ') || '내용 없음'}</small></td><td>{entry.status === 'settled' ? '정산완료' : '청구완료'}</td><td>{amount(entry.amount)}</td>
                </tr>)}</tbody>
            </table></div> : <p>이번 지원비에 반영된 후청구 경비가 없습니다.</p>}
            <p className="bt-detail-footnote">{new Date(detail.capturedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 불러온 내역 · 목록 저장 시 함께 보관됩니다.</p>
        </div>}
    </details>;
}
