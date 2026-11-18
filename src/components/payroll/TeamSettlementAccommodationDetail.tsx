import React, { useState } from 'react';
import type { buildTeamSettlementAccommodationDetail } from '../../utils/teamSettlementAccommodationDetail';

const money = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
export function TeamSettlementAccommodationDetail({ detail, addressStatus, expandedKey, onToggle }: {
  detail: ReturnType<typeof buildTeamSettlementAccommodationDetail>;
  addressStatus: 'loading' | 'ready' | 'error';
  expandedKey?: string | null;
  onToggle?: (key: string) => void;
}) {
  const [localExpanded, setLocalExpanded] = useState<string | null>(null);
  const expanded = expandedKey === undefined ? localExpanded : expandedKey;
  const toggle = (key: string) => onToggle ? onToggle(key) : setLocalExpanded(previous => previous === key ? null : key);
  return <div role="region" aria-label="숙소 주소별 상세">
    <div className="text-sm font-semibold text-slate-800">숙소 주소별 합계</div>
    <p className="mt-1 text-xs text-slate-500">같은 주소와 상세주소(숙소명·호수)끼리 합산합니다. 더상세에서 전기·가스·월세·공과금을 확인합니다.</p>
    {addressStatus === 'loading' && <p role="status" className="mt-2 text-xs text-slate-500">숙소 주소를 불러오는 중입니다.</p>}
    {addressStatus === 'error' && <p role="alert" className="mt-2 text-xs text-amber-700">숙소 주소를 불러오지 못했습니다. 경비 원본 다시 조회를 눌러 주세요.</p>}
    <div className="mt-3 overflow-auto">
      <table aria-label="숙소 주소별 합계" className="w-full text-xs border-collapse">
        <thead><tr className="bg-slate-50 text-slate-600">
          <th scope="col" className="border px-2 py-2 text-left w-[35%]">주소</th>
          <th scope="col" className="border px-2 py-2 text-left w-[25%]">상세주소</th>
          <th scope="col" className="border px-2 py-2 text-right w-[25%]">합계</th>
          <th scope="col" className="border px-2 py-2 text-center w-[15%]">더상세</th>
        </tr></thead>
        <tbody>{detail.addresses.length === 0 ? <tr><td colSpan={4} className="border px-2 py-3 text-slate-500">내역 없음</td></tr> : detail.addresses.map(row => <React.Fragment key={row.key}>
          <tr className="bg-white">
            <td data-label="주소" className="border px-2 py-2 break-words">
              <div className="font-medium text-slate-800">{row.address}</div>
            </td>
            <td data-label="상세주소" className="border px-2 py-2 break-words">{row.detailAddress}</td>
            <td data-label="합계" className="border px-2 py-2 text-right font-semibold">{money(row.amount)}</td>
            <td data-label="더상세" className="border px-2 py-2 text-center">
              <button type="button" aria-label={`${row.address} ${row.detailAddress} 더상세`.replace(/\s+/g, ' ')} aria-expanded={expanded === row.key}
                className="rounded border bg-white px-2 py-1 text-slate-700"
                onClick={() => toggle(row.key)}>
                {expanded === row.key ? '닫기' : '더상세'}
              </button>
            </td>
          </tr>
          {expanded === row.key && <tr><td colSpan={4} className="border bg-slate-50 p-2">
            {row.notes.map(note => <p key={note} className="mb-2 text-xs text-amber-700">{note}</p>)}
            <table aria-label={`${row.address} ${row.detailAddress} 비용 내역`} className="w-full border-collapse bg-white">
              <thead><tr className="text-slate-600">
                <th scope="col" className="border px-2 py-2 text-left w-[20%]">항목</th>
                <th scope="col" className="border px-2 py-2 text-right w-[30%]">금액</th>
                <th scope="col" className="border px-2 py-2 text-left">세부내역</th>
              </tr></thead>
              <tbody>{row.costs.map(cost => <tr key={cost.category}>
                <th scope="row" className="border px-2 py-2 text-left font-medium">{cost.category}</th>
                <td data-label="금액" className="border px-2 py-2 text-right">{money(cost.amount)}</td>
                <td data-label="세부내역" className="border px-2 py-2 text-slate-500 break-words">
                  {cost.lines.length ? cost.lines.map((line, index) => <div key={index}>{line.label} · {money(line.amount)}</div>) : '—'}
                </td>
              </tr>)}</tbody>
              <tfoot><tr className="font-semibold"><th scope="row" className="border px-2 py-2 text-left">주소 합계</th><td className="border px-2 py-2 text-right">{money(row.amount)}</td><td className="border" /></tr></tfoot>
            </table>
          </td></tr>}
        </React.Fragment>)}</tbody>
      </table>
    </div>
    <div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-600">숙소 전체 합계</span><strong>{money(detail.totalAmount)}</strong></div>
  </div>;
}
