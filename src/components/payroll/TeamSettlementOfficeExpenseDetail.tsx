import React from 'react';
import type { calculateTeamSettlementOfficeExpense } from '../../utils/teamSettlementOfficeExpense';

type Props = {
  detail: ReturnType<typeof calculateTeamSettlementOfficeExpense> & { savedAmount: number };
};
const money = (value: number) => value.toLocaleString('ko-KR');

export const TeamSettlementOfficeExpenseDetail: React.FC<Props> = ({ detail }) => (
  <div>
    <div className="text-sm font-semibold text-slate-800">사무실비 상세</div>
    <div className="text-xs text-slate-500 mt-1">{detail.memo}</div>
    <div className="mt-3 overflow-auto">
      <table className="w-full text-xs border-collapse" aria-label="현장별 사무실비">
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            <th scope="col" className="text-left px-2 py-2 border">현장</th>
            <th scope="col" className="text-left px-2 py-2 border">구분</th>
            <th scope="col" className="text-right px-2 py-2 border">공수</th>
            <th scope="col" className="text-right px-2 py-2 border">공수당 단가</th>
            <th scope="col" className="text-right px-2 py-2 border">사무실비</th>
          </tr>
        </thead>
        <tbody>
          {detail.sites.length === 0 ? (
            <tr><td className="px-2 py-2 border text-slate-500" colSpan={5}>데이터 없음</td></tr>
          ) : detail.sites.map((site) => (
            <tr key={site.id} className="bg-white">
              <td data-label="현장" className="px-2 py-2 border font-medium">{site.siteName}</td>
              <td data-label="구분" className="px-2 py-2 border">{site.kind}</td>
              <td data-label="공수" className="px-2 py-2 border text-right">{site.manDay.toFixed(1)}</td>
              <td data-label="공수당 단가" className="px-2 py-2 border text-right">{money(site.rate)}원</td>
              <td data-label="사무실비" className="px-2 py-2 border text-right">{money(site.amount)}원</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="mt-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-600">총공수</span>
        <strong>{detail.totalManDay.toFixed(1)}</strong>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-slate-600">사무실비 합계</span>
        <strong>{money(detail.savedAmount)}원</strong>
      </div>
      {detail.totalAmount !== detail.savedAmount && (
        <p className="mt-2 text-xs text-amber-700">저장된 사무실비와 현장별 계산 합계가 다릅니다. 재집계 시 확인해 주세요.</p>
      )}
    </div>
  </div>
);
