import React from 'react';
import type { TransferCandidate } from './types';
import TransferAmountSummary from './TransferAmountSummary';

export default function RentTransferDetails({ row, expanded, onExpand }: { row: TransferCandidate; expanded?: boolean; onExpand?: () => void }) {
    if (row.source !== 'rent') return null;
    const detail = row.rentDetail;
    return <details className="bt-payroll-detail" open={expanded || undefined}>
        <summary aria-label={`${row.name} 월세 상세보기`}>월세 상세보기 <small>{row.period}</small></summary>
        <div className="bt-detail-content">
            {onExpand && <button className="bt-expand-detail" onClick={onExpand}>넓게 보기</button>}
            <TransferAmountSummary row={row} />
            <dl className="bt-deduction-lines"><div><dt>숙소 / 청구월</dt><dd>{detail?.roomName || row.name} / {detail?.billingMonth || row.period}</dd></div>
                <div><dt>임대인 / 예금주</dt><dd>{row.groupName} / {row.accountHolder}</dd></div>
                {detail?.address && <div><dt>주소</dt><dd>{detail.address}</dd></div>}
                <div><dt>금액 기준</dt><dd>{detail?.basis || row.detail}</dd></div>
                <div><dt>불러올 당시 지급 상태</dt><dd>{detail?.paymentStatus || '이전 내역 없음'}</dd></div></dl>
            <p>월세만 포함하며 관리비·공과금은 제외합니다. 이전 목록에 원본 금액이 없으면 월세 자료를 다시 조회해 확인하세요.</p>
        </div>
    </details>;
}
