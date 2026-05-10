import React, { useState } from 'react';
import { FilePlus2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { ExpenseLedgerDetailBoard } from './components/ExpenseLedgerDetailBoard';
import {
  buildDefaultYearMonth,
  formatCurrency,
  getSummaryTotal,
  hexToRgba,
  normalizeColor,
  useExpenseLedgerData
} from './hooks/useExpenseLedgerData';
import type { BillingScope, LedgerSummary } from './hooks/useExpenseLedgerData';

interface ExpenseLedgerPageProps {
  embedded?: boolean;
}

const tableColumns: Array<{ key: keyof LedgerSummary | 'total'; label: string; className?: string }> = [
  { key: 'accommodation', label: '숙소비' },
  { key: 'privateRoom', label: '개인숙소' },
  { key: 'electricity', label: '전기세' },
  { key: 'gas', label: '도시가스' },
  { key: 'water', label: '수도세' },
  { key: 'internet', label: '유선비' },
  { key: 'accommodationOther', label: '숙소기타' },
  { key: 'vehicleRent', label: '렌트료' },
  { key: 'vehicleFine', label: '과태료' },
  { key: 'vehicleRepair', label: '차량수리' },
  { key: 'vehicleOther', label: '차량기타' },
  { key: 'card', label: '카드값' },
  { key: 'otherClaim', label: '기타청구', className: 'text-amber-700' },
  { key: 'receivable', label: '받을 후청구', className: 'text-emerald-700' },
  { key: 'payable', label: '내야 할 후청구', className: 'text-red-600' },
  { key: 'total', label: '합계', className: 'font-black text-slate-950' }
];

const ExpenseLedgerPage: React.FC<ExpenseLedgerPageProps> = ({ embedded = false }) => {
  const [yearMonth, setYearMonth] = useState(buildDefaultYearMonth());
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const billingScope: BillingScope = 'posted';

  const {
    loading,
    teamOptions,
    summaries,
    totals,
    selectedClaims,
    statusCounts,
    loadData,
    selectedRawDocs
  } = useExpenseLedgerData(yearMonth, selectedTeamId, billingScope);

  const draftCount =
    statusCounts.accommodationDraft +
    statusCounts.vehicleDraft +
    statusCounts.cardDraft +
    statusCounts.claimDraft;
  const postedCount =
    statusCounts.accommodationConfirmed +
    statusCounts.vehiclePosted +
    statusCounts.cardPosted +
    statusCounts.claimCharged +
    statusCounts.claimSettled;

  const selectedSummary = summaries[0];

  return (
    <div className={`${embedded ? 'min-h-0' : 'min-h-screen'} bg-slate-100 p-4 xl:p-6`}>
      <div className="mx-auto max-w-[1900px] space-y-4">
        <div className="flex flex-col gap-3 border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-950">팀별 경비내역</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              청구완료와 정산완료로 확정된 숙소, 차량, 카드, 후청구 내역만 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <YearMonthPicker
              value={yearMonth}
              onChange={setYearMonth}
              inputClassName="h-10 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <Link
              to="/support/expense-claims"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800"
            >
              <FilePlus2 size={16} />
              후청구 입력
            </Link>
          </div>
        </div>

        <div className="grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-3">
          <div className="border border-slate-200 bg-white px-3 py-2">
            조회 기준: 청구완료/정산완료 내역
          </div>
          <div className="border border-slate-200 bg-white px-3 py-2">
            반영 문서: {postedCount.toLocaleString('ko-KR')}건
          </div>
          <div className="border border-slate-200 bg-white px-3 py-2">
            원장 제외 작성중 문서: {draftCount.toLocaleString('ko-KR')}건
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-300 pb-2">
          <button
            type="button"
            onClick={() => setSelectedTeamId('all')}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold transition-colors ${
              selectedTeamId === 'all'
                ? 'relative z-10 -mb-[9px] border border-slate-300 border-b-white bg-white text-blue-700'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            전체 집계
          </button>
          {teamOptions.map((team) => {
            const id = String(team.id ?? team.legacyId ?? '');
            if (!id) return null;
            const isSelected = selectedTeamId === id;
            const teamColor = normalizeColor(team.color);
            const tabStyle: React.CSSProperties = {
              borderTopColor: teamColor,
              borderTopWidth: '3px',
              borderLeftColor: isSelected ? hexToRgba(teamColor, 0.35) : 'transparent',
              borderRightColor: isSelected ? hexToRgba(teamColor, 0.35) : 'transparent',
              borderBottomColor: isSelected ? '#fff' : 'transparent',
              backgroundColor: isSelected ? hexToRgba(teamColor, 0.08) : undefined,
              boxShadow: isSelected ? `0 -2px 8px ${hexToRgba(teamColor, 0.14)}` : undefined
            };

            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedTeamId(id)}
                className={`rounded-t-lg border px-4 py-2 text-sm font-bold transition-colors ${
                  isSelected
                    ? 'relative z-10 -mb-[9px] border-slate-300 border-b-white bg-white text-slate-900 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]'
                    : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
                style={tabStyle}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: teamColor }} />
                  <span>{team.name}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative z-0 mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {[
            ['숙소', totals.accommodation + totals.utility],
            ['차량', totals.vehicle],
            ['카드', totals.card],
            ['기타청구', totals.otherClaim],
            ['받을 후청구', totals.receivable],
            ['내야 할 후청구', totals.payable],
            ['정산 반영 합계', totals.total]
          ].map(([label, amount]) => (
            <div key={String(label)} className="border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-black text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(Number(amount))}</div>
            </div>
          ))}
        </div>

        {selectedTeamId === 'all' ? (
          <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-pink-100 px-4 py-3 text-center text-base font-black text-slate-950">
              {yearMonth.replace('-', '년 ')}월 전체 팀별 공제/후청구 요약
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[1400px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs text-slate-700">
                    <th className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-3 py-2 text-left">팀</th>
                    {tableColumns.map((column) => (
                      <th key={column.key} className="border border-slate-300 px-3 py-2 text-right">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaries.length > 0 ? summaries.map((row) => (
                    <tr key={row.teamId || row.teamName} className="hover:bg-slate-50">
                      <td
                        className="sticky left-0 z-10 border border-slate-300 bg-white px-3 py-2 font-black text-slate-900"
                        style={{ boxShadow: `inset 4px 0 0 ${row.color}` }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                          {row.teamName}
                        </span>
                      </td>
                      {tableColumns.map((column) => {
                        const amount = column.key === 'total' ? getSummaryTotal(row) : Number(row[column.key] ?? 0);
                        return (
                          <td
                            key={column.key}
                            className={`border border-slate-300 px-3 py-2 text-right tabular-nums ${column.className ?? ''}`}
                            style={
                              column.key === 'receivable' && amount > 0
                                ? { backgroundColor: hexToRgba('#059669', 0.08) }
                                : column.key === 'payable' && amount > 0
                                  ? { backgroundColor: hexToRgba('#dc2626', 0.08) }
                                  : column.key === 'otherClaim' && amount > 0
                                    ? { backgroundColor: hexToRgba('#d97706', 0.08) }
                                    : undefined
                            }
                          >
                            {amount ? formatCurrency(amount) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={tableColumns.length + 1} className="border border-slate-300 px-4 py-10 text-center font-bold text-slate-500">
                        표시할 청구완료 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <section className="flex h-full flex-col border border-slate-200 bg-white shadow-sm">
              <div
                className="border-b border-slate-200 px-4 py-3 text-center text-sm font-black text-slate-900"
                style={{ backgroundColor: hexToRgba(selectedSummary?.color || '#94a3b8', 0.16) }}
              >
                {selectedSummary?.teamName || '팀'} 요약표
              </div>
              <div className="overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-600">
                      <th className="border border-slate-200 px-3 py-2 text-left">항목</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableColumns.filter((column) => column.key !== 'total').map((column) => {
                      const amount = selectedSummary ? Number(selectedSummary[column.key as keyof LedgerSummary] ?? 0) : 0;

                      return (
                        <tr key={column.key} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700">{column.label}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                            {amount ? formatCurrency(amount) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100">
                      <td className="border border-slate-200 px-3 py-3 font-black text-slate-900">총 합계</td>
                      <td className="border border-slate-200 px-3 py-3 text-right text-base font-black tabular-nums text-red-600">
                        {selectedSummary ? formatCurrency(totals.total) : '0'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="flex h-full min-h-[600px] flex-col bg-slate-50">
              <ExpenseLedgerDetailBoard
                teamName={selectedSummary?.teamName || '팀 미지정'}
                color={selectedSummary?.color || '#cbd5e1'}
                accommodationDocs={selectedRawDocs.accommodationDocs}
                vehicleDocs={selectedRawDocs.vehicleDocs}
                cardDocs={selectedRawDocs.cardDocs}
                receivableClaims={selectedClaims.receivable}
                payableClaims={selectedClaims.payable}
                otherClaims={selectedClaims.other}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseLedgerPage;
