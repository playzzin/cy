import React, { useId, useState } from 'react';
import type { TeamSettlementDeductionItem } from '../../types/teamSettlement';

const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const manDays = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const uniqueDates = (dates: string[] = []) => [...new Set(dates)].sort();
type InvoiceWorker = NonNullable<TeamSettlementDeductionItem['invoiceDetails']>[number];

export function TeamSettlementInvoiceDetail({ items, expandedKey, onToggle }: { items: TeamSettlementDeductionItem[]; expandedKey?: string | null; onToggle?: (key: string) => void }) {
  const [localExpanded, setLocalExpanded] = useState<string | null>(null);
  const expanded = expandedKey === undefined ? localExpanded : expandedKey;
  const toggle = (key: string) => onToggle ? onToggle(key) : setLocalExpanded(previous => previous === key ? null : key);
  const detailId = useId();
  const workers = new Map<string, InvoiceWorker>();
  items.flatMap(item => item.invoiceDetails ?? []).forEach(row => {
    const key = `${row.invoiceType || 'daily'}:${row.workerId}`;
    const previous = workers.get(key);
    workers.set(key, previous ? { ...previous,
      recruiterFeeDates: uniqueDates([...(previous.recruiterFeeDates || []), ...(row.recruiterFeeDates || [])]),
      manDay: previous.manDay + row.manDay, claimAmount: previous.claimAmount + row.claimAmount,
      recruiterFee: previous.recruiterFee + row.recruiterFee, invoiceAmount: previous.invoiceAmount + row.invoiceAmount
    } : { ...row });
  });
  const rows = [...workers.values()].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko'));
  const dailyRows = rows.filter(row => row.invoiceType !== 'service');
  const serviceRows = rows.filter(row => row.invoiceType === 'service');
  const feeRows = rows.filter(row => row.recruiterFee > 0);
  const amount = items.reduce((sum, item) => sum + item.amount, 0);
  const sections = [
    { key: 'fee' as const, title: '인력소개비', rows: feeRows, amount: feeRows.reduce((sum, row) => sum + row.recruiterFee, 0), value: (row: InvoiceWorker) => row.recruiterFee },
    { key: 'claim' as const, title: '일급제', rows: dailyRows, amount: dailyRows.reduce((sum, row) => sum + row.claimAmount, 0), value: (row: InvoiceWorker) => row.claimAmount },
    { key: 'service' as const, title: '용역비', rows: serviceRows, amount: serviceRows.reduce((sum, row) => sum + row.claimAmount, 0), value: (row: InvoiceWorker) => row.claimAmount }
  ];
  return <div className="mt-2" role="region" aria-label="대납청구서 공제 내역">
    <div className="overflow-auto">
      <table aria-label="대납청구비 요약" className="w-full border-collapse text-xs">
        <colgroup><col style={{ width: '28%' }} /><col style={{ width: '22%' }} /><col style={{ width: '33%' }} /><col style={{ width: '17%' }} /></colgroup>
        <thead><tr className="bg-slate-50 text-slate-600">
          <th scope="col" className="border px-2 py-2 text-left">항목</th>
          <th scope="col" className="border px-1 py-2 text-right">인원/공수</th>
          <th scope="col" className="border px-2 py-2 text-right">금액</th>
          <th scope="col" className="border px-1 py-2 text-center">상세</th>
        </tr></thead>
        <tbody>{sections.map(section => <React.Fragment key={section.key}>
          <tr>
            <th scope="row" className="border px-2 py-2 text-left font-semibold">{section.title}</th>
            <td className="border px-1 py-2 text-right">{section.key === 'fee'
              ? `${new Set(section.rows.map(row => row.workerId)).size}명`
              : `${manDays(section.rows.reduce((sum, row) => sum + row.manDay, 0))}공수`}</td>
            <td className="border px-2 py-2 text-right font-bold">{money(section.amount)}</td>
            <td className="border px-1 py-2 text-center">
              <button type="button" aria-label={`${section.title} 상세`} aria-expanded={expanded === section.key} aria-controls={`${detailId}-${section.key}`}
                className="rounded border bg-white px-2 py-1 text-slate-700" onClick={() => toggle(section.key)}>
                {expanded === section.key ? '닫기' : '상세'}
              </button>
            </td>
          </tr>
          {expanded === section.key && <tr><td colSpan={4} className="border bg-slate-50 p-2">
            <div id={`${detailId}-${section.key}`} role="region" aria-label={`${section.title} 인원별 상세`}>
              <div className="mb-2 font-semibold text-slate-700">{section.title} 인원별 금액</div>
              <table aria-label={`${section.title} 인원별 금액`} className="w-full border-collapse bg-white">
                <thead><tr className="text-slate-600">
                  <th scope="col" className="border px-2 py-2 text-left">이름</th>
                  <th scope="col" className="border px-2 py-2 text-right">{section.key === 'fee' ? '발생일수' : '공수'}</th>
                  {section.key === 'fee' && <th scope="col" className="border px-2 py-2 text-left">발생일</th>}
                  <th scope="col" className="border px-2 py-2 text-right">{section.title}</th>
                </tr></thead>
                <tbody>{section.rows.length ? section.rows.map(row => <tr key={`${row.invoiceType || 'daily'}:${row.workerId}`}>
                  <td className="border px-2 py-2">{row.workerName}{section.key === 'fee' && serviceRows.length > 0 && <span className="ml-1 text-slate-500">({row.invoiceType === 'service' ? '용역' : '일급제'})</span>}</td>
                  <td className="border px-2 py-2 text-right">{section.key === 'fee' ? uniqueDates(row.recruiterFeeDates).length ? `${uniqueDates(row.recruiterFeeDates).length}일` : '미지정' : manDays(row.manDay)}</td>
                  {section.key === 'fee' && <td className="border px-2 py-2 text-left break-words">{uniqueDates(row.recruiterFeeDates).map(date => date.slice(5).replace('-', '/')).join(', ') || '발생일 지정 필요'}</td>}
                  <td className="border px-2 py-2 text-right">{money(section.value(row))}</td>
                </tr>) : <tr><td colSpan={section.key === 'fee' ? 4 : 3} className="border px-2 py-3 text-center text-slate-500">내역 없음</td></tr>}</tbody>
                <tfoot><tr className="bg-slate-50 font-bold"><th scope="row" className="border px-2 py-2 text-left">합계</th>
                  <td className="border px-2 py-2 text-right">{section.key === 'fee' ? `${section.rows.reduce((sum, row) => sum + uniqueDates(row.recruiterFeeDates).length, 0)}일` : manDays(section.rows.reduce((sum, row) => sum + row.manDay, 0))}</td>
                  {section.key === 'fee' && <td className="border px-2 py-2 text-left">{section.rows.some(row => !row.recruiterFeeDates?.length) ? `미지정 ${section.rows.filter(row => !row.recruiterFeeDates?.length).length}명` : '지정된 발생일 기준'}</td>}
                  <td className="border px-2 py-2 text-right">{money(section.amount)}</td>
                </tr></tfoot>
              </table>
            </div>
          </td></tr>}
        </React.Fragment>)}</tbody>
      </table>
    </div>
    <div role="group" aria-label="소개비 포함 대납청구비 합계" className="mt-2 flex flex-wrap justify-between gap-2 rounded border bg-slate-50 px-2 py-2 text-sm font-bold">
      <span>대납청구비 합계</span><span>{money(amount)}</span>
    </div>
    <p className="mt-2 text-xs text-slate-500">일급제 + 용역비 + 인력소개비 = 대납청구비. 일급제와 용역비에는 소개비가 포함되지 않습니다. 소개비 인원은 중복 없이 세며, 일급제 발생일은 지정한 청구일, 용역 발생일은 용역 청구서의 소개비 부과일 기준입니다.</p>
  </div>;
}
