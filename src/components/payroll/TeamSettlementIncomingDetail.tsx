import React from 'react';
import type { TeamSettlementIncomingRow } from '../../services/teamSettlementIncomingService';

export const TeamSettlementIncomingDetail: React.FC<{ rows: TeamSettlementIncomingRow[]; direction?: 'incoming' | 'outgoing' }> = ({ rows, direction = 'incoming' }) => {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + row.manDay, 0);
  const totalAmount = rows.reduce((sum, row) => sum + (row.supportAmount ?? 0), 0);
  const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  const outgoing = direction === 'outgoing';
  return (
    <section className="mt-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3" aria-label={outgoing ? '지원 간 현장 상세' : '지원 온 팀 상세'}>
      <div className="font-semibold text-slate-800">{outgoing ? '지원 간 현장' : '지원 온 팀'}</div>
      <p className="mt-1 text-xs text-slate-500">선택 월의 출력일보 기준 · 공수 × 지원단가 · 저장된 정산 단가 우선</p>
      <div className="mt-2 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-orange-50 text-slate-700">
            {['날짜', '현장', outgoing ? '상대팀' : '지원팀', '공수', '지원단가', '지원금액'].map(label => <th key={label} scope="col" className="whitespace-nowrap border px-3 py-2 text-left">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} className="bg-white">
            <td data-label="날짜" className="whitespace-nowrap border px-3 py-2">{row.date}</td>
            <td data-label="현장" className="border px-3 py-2">{row.siteName || '현장 미지정'}</td>
            <td data-label={outgoing ? '상대팀' : '지원팀'} className="border px-3 py-2 font-semibold">{row.teamName}</td>
            <td data-label="공수" className="whitespace-nowrap border px-3 py-2 text-right">{format(row.manDay)}공</td>
            <td data-label="지원단가" className="whitespace-nowrap border px-3 py-2 text-right">{row.supportRate === undefined ? '-' : `${format(row.supportRate)}원`}</td>
            <td data-label="지원금액" className="whitespace-nowrap border px-3 py-2 text-right">{row.supportAmount === undefined ? '-' : `${format(row.supportAmount)}원`}</td>
          </tr>)}</tbody>
          <tfoot><tr className="bg-orange-50 font-semibold">
            <th scope="row" colSpan={3} className="border px-3 py-2 text-left">지원 공수 합계</th>
            <td className="whitespace-nowrap border px-3 py-2 text-right">{format(total)}공</td>
            <td className="border px-3 py-2" />
            <td className="whitespace-nowrap border px-3 py-2 text-right">{format(totalAmount)}원</td>
          </tr></tfoot>
        </table>
      </div>
    </section>
  );
};
