import React, { useId, useState } from 'react';
import type { TeamSettlementDeductionItem } from '../../types/teamSettlement';

const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const manDays = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
type InvoiceWorker = NonNullable<TeamSettlementDeductionItem['invoiceDetails']>[number];

export function TeamSettlementInvoiceDetail({ items }: { items: TeamSettlementDeductionItem[] }) {
  const [expanded, setExpanded] = useState<'fee' | 'claim' | null>(null);
  const detailId = useId();
  const workers = new Map<string, InvoiceWorker>();
  items.flatMap(item => item.invoiceDetails ?? []).forEach(row => {
    const previous = workers.get(row.workerId);
    workers.set(row.workerId, previous ? { ...previous,
      manDay: previous.manDay + row.manDay, claimAmount: previous.claimAmount + row.claimAmount,
      recruiterFee: previous.recruiterFee + row.recruiterFee, invoiceAmount: previous.invoiceAmount + row.invoiceAmount
    } : { ...row });
  });
  const rows = [...workers.values()].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko'));
  const feeRows = rows.filter(row => row.recruiterFee > 0);
  const amount = items.reduce((sum, item) => sum + item.amount, 0);
  const sections = [
    { key: 'fee' as const, title: '인력소개비', rows: feeRows, amount: feeRows.reduce((sum, row) => sum + row.recruiterFee, 0), value: (row: InvoiceWorker) => row.recruiterFee },
    { key: 'claim' as const, title: '청구금액', rows, amount: rows.reduce((sum, row) => sum + row.claimAmount, 0), value: (row: InvoiceWorker) => row.claimAmount }
  ];
  return <div className="mt-2" role="region" aria-label="대납청구서 공제 내역">
    <div className="overflow-auto">
      <table aria-label="대납청구금액 요약" className="w-full border-collapse text-xs">
        <colgroup><col style={{ width: '27%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '31%' }} /><col style={{ width: '17%' }} /></colgroup>
        <thead><tr className="bg-slate-50 text-slate-600">
          <th scope="col" className="border px-2 py-2 text-left">항목</th>
          <th scope="col" className="border px-1 py-2 text-right">인원</th>
          <th scope="col" className="border px-1 py-2 text-right">공수</th>
          <th scope="col" className="border px-2 py-2 text-right">금액</th>
          <th scope="col" className="border px-1 py-2 text-center">상세</th>
        </tr></thead>
        <tbody>{sections.map(section => <React.Fragment key={section.key}>
          <tr>
            <th scope="row" className="border px-2 py-2 text-left font-semibold">{section.title}</th>
            <td className="border px-1 py-2 text-right">{section.rows.length}명</td>
            <td className="border px-1 py-2 text-right">{manDays(section.rows.reduce((sum, row) => sum + row.manDay, 0))}</td>
            <td className="border px-2 py-2 text-right font-bold">{money(section.amount)}</td>
            <td className="border px-1 py-2 text-center">
              <button type="button" aria-label={`${section.title} 상세`} aria-expanded={expanded === section.key} aria-controls={`${detailId}-${section.key}`}
                className="rounded border bg-white px-2 py-1 text-slate-700" onClick={() => setExpanded(previous => previous === section.key ? null : section.key)}>
                {expanded === section.key ? '닫기' : '상세'}
              </button>
            </td>
          </tr>
          {expanded === section.key && <tr><td colSpan={5} className="border bg-slate-50 p-2">
            <div id={`${detailId}-${section.key}`} role="region" aria-label={`${section.title} 인원별 상세`}>
              <div className="mb-2 font-semibold text-slate-700">{section.title} 인원별 금액</div>
              <table aria-label={`${section.title} 인원별 금액`} className="w-full border-collapse bg-white">
                <thead><tr className="text-slate-600">
                  <th scope="col" className="border px-2 py-2 text-left">이름</th>
                  <th scope="col" className="border px-2 py-2 text-right">공수</th>
                  <th scope="col" className="border px-2 py-2 text-right">{section.title}</th>
                </tr></thead>
                <tbody>{section.rows.length ? section.rows.map(row => <tr key={row.workerId}>
                  <td className="border px-2 py-2">{row.workerName}</td>
                  <td className="border px-2 py-2 text-right">{manDays(row.manDay)}</td>
                  <td className="border px-2 py-2 text-right">{money(section.value(row))}</td>
                </tr>) : <tr><td colSpan={3} className="border px-2 py-3 text-center text-slate-500">내역 없음</td></tr>}</tbody>
                <tfoot><tr className="bg-slate-50 font-bold"><th scope="row" className="border px-2 py-2 text-left">합계</th>
                  <td className="border px-2 py-2 text-right">{manDays(section.rows.reduce((sum, row) => sum + row.manDay, 0))}</td>
                  <td className="border px-2 py-2 text-right">{money(section.amount)}</td>
                </tr></tfoot>
              </table>
            </div>
          </td></tr>}
        </React.Fragment>)}</tbody>
      </table>
    </div>
    <div role="group" aria-label="소개비 포함 대납청구금액 합계" className="mt-2 flex flex-wrap justify-between gap-2 rounded border bg-slate-50 px-2 py-2 text-sm font-bold">
      <span>대납청구금액 합계</span><span>{money(amount)}</span>
    </div>
    <p className="mt-2 text-xs text-slate-500">청구금액(소개비 제외) + 인력소개비 = 대납청구금액. 소개비 인원·공수는 소개비가 발생한 인원 기준입니다.</p>
  </div>;
}
