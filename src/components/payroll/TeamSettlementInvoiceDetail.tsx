import React from 'react';
import type { TeamSettlementDeductionItem } from '../../types/teamSettlement';

const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
export function TeamSettlementInvoiceDetail({ items }: { items: TeamSettlementDeductionItem[] }) {
  const rows = items.flatMap(item => item.invoiceDetails ?? []);
  const amount = items.reduce((sum, item) => sum + item.amount, 0);
  const fee = rows.reduce((sum, row) => sum + row.recruiterFee, 0);
  return <div className="mt-2" role="region" aria-label="대납청구서 공제 내역">
    <div className="mb-2 flex flex-wrap justify-between gap-1 text-xs text-slate-600">
      <span>청구 인원 {rows.length}명</span><span>인력소개비 {money(fee)} · 청구금액에 포함</span>
    </div>
    <div className="overflow-auto">
      <table aria-label="인원별 대납청구 공제" className="w-full border-collapse text-xs">
        <thead><tr className="bg-slate-50 text-slate-600">
          <th scope="col" className="border px-2 py-2 text-left w-[32%]">이름</th>
          <th scope="col" className="border px-2 py-2 text-right w-[34%]">인력소개비</th>
          <th scope="col" className="border px-2 py-2 text-right w-[34%]">청구금액</th>
        </tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.workerId}:${index}`}>
          <td data-label="이름" className="border px-2 py-2">{row.workerName}</td>
          <td data-label="인력소개비" className="border px-2 py-2 text-right">{money(row.recruiterFee)}</td>
          <td data-label="청구금액" className="border px-2 py-2 text-right">{money(row.invoiceAmount)}</td>
        </tr>) : <tr><td colSpan={3} className="border px-2 py-3 text-center text-slate-500">대납청구 내역 없음</td></tr>}</tbody>
        <tfoot><tr className="bg-slate-50 font-bold">
          <th scope="row" className="border px-2 py-2 text-left">합계</th>
          <td className="border px-2 py-2 text-right">{money(fee)}</td>
          <td className="border px-2 py-2 text-right">{money(amount)}</td>
        </tr></tfoot>
      </table>
    </div>
    <p className="mt-2 text-xs text-slate-500">대납청구서의 인원별 청구금액을 한 번만 공제합니다. 인력소개비는 별도로 더 차감하지 않습니다.</p>
  </div>;
}
