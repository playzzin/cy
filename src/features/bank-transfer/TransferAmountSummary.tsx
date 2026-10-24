import React from 'react';
import { originalTransferAmount } from './transferWorkflow';
import type { TransferCandidate } from './types';

export default function TransferAmountSummary({ row }: { row: TransferCandidate }) {
    const original = originalTransferAmount(row);
    const amount = (value: number) => `${value.toLocaleString('ko-KR')}원`;
    return <div className="bt-amount-summary">
        <div><span>원본 금액</span><strong>{original === undefined ? row.source === 'account' ? '직접 입력' : '이전 내역 없음' : amount(original)}</strong></div>
        <div><span>조정 금액</span><strong>{original === undefined ? '—' : `${row.amount - original > 0 ? '+' : ''}${amount(row.amount - original)}`}</strong></div>
        <div><span>최종 송금액</span><strong>{amount(row.amount)}</strong></div>
        {row.adjustmentReason && <p>변경 사유: {row.adjustmentReason}</p>}
    </div>;
}
