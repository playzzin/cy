import React, { useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { ExpenseDetailBoard } from './components/ExpenseDetailBoard';
import { ExpenseClaimForm } from './components/ExpenseClaimForm';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { toast } from '../../utils/swal';
import {
  useExpenseLedgerData,
  buildDefaultYearMonth,
  formatCurrency,
  hexToRgba,
  getSummaryTotal,
  getCategoryLabel,
  getStatusLabel
} from './hooks/useExpenseLedgerData';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type { BillingScope, LedgerSummary } from './hooks/useExpenseLedgerData';

interface ExpenseLedgerPageProps {
  embedded?: boolean;
}

const ExpenseLedgerPage: React.FC<ExpenseLedgerPageProps> = ({ embedded = false }) => {
  const [yearMonth, setYearMonth] = useState(buildDefaultYearMonth());
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [billingScope, setBillingScope] = useState<BillingScope>('all');

  const {
    loading,
    teamOptions,
    siteOptions,
    resolveTeam,
    summaries,
    totals,
    groupedClaims,
    selectedClaims,
    statusCounts,
    cardLabelOptions,
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

  const handleDeleteClaim = async (claim: TeamExpenseClaim) => {
    const ok = window.confirm(`${claim.description} ${formatCurrency(claim.amount)}원을 삭제할까요?`);
    if (!ok) return;
    try {
      await teamExpenseLedgerService.deleteClaim(claim.id);
      toast.success('삭제되었습니다.');
      await loadData();
    } catch (error) {
      console.error('[ExpenseLedgerPage] delete claim failed', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleUpdateClaimStatus = async (claim: TeamExpenseClaim, status: TeamExpenseClaim['status']) => {
    try {
      await teamExpenseLedgerService.saveClaim({
        id: claim.id,
        yearMonth: claim.yearMonth,
        date: claim.date,
        claimType: claim.claimType,
        payerTeamId: claim.payerTeamId,
        payerTeamName: claim.payerTeamName,
        chargeToTeamId: claim.chargeToTeamId,
        chargeToTeamName: claim.chargeToTeamName,
        siteId: claim.siteId,
        siteName: claim.siteName,
        cardLabel: claim.cardLabel,
        category: claim.category,
        description: claim.description,
        amount: claim.amount,
        status,
        memo: claim.memo
      });
      toast.success('청구 상태가 변경되었습니다.');
      await loadData();
    } catch (error) {
      console.error('[ExpenseLedgerPage] update claim status failed', error);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

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
    { key: 'receivable', label: '후청구 받을금액', className: 'text-emerald-700' },
    { key: 'payable', label: '후청구 내야함', className: 'text-red-600' },
    { key: 'total', label: '합계', className: 'font-black text-slate-950' }
  ];

  return (
    <div className={`${embedded ? 'min-h-0' : 'min-h-screen'} bg-slate-100 p-4 xl:p-6`}>
      <div className="mx-auto max-w-[1900px] space-y-4">
        {/* 상단 컨트롤 바 */}
        <div className="flex flex-col gap-3 border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-950">팀별 경비내역 (원장)</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              월별 팀 기준으로 숙소, 차량, 카드 청구와 상대팀 후청구 경비를 상세 조회합니다.
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
            <div className="inline-flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {[
                ['all', '전체 청구'],
                ['posted', '확정/정산만']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBillingScope(value as BillingScope)}
                  className={`px-3 text-xs font-black transition ${
                    billingScope === value
                      ? 'rounded-md bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-3">
          <div className="border border-slate-200 bg-white px-3 py-2">
            정산 범위: {billingScope === 'all' ? '작성중 문서 포함' : '확정/청구완료/정산완료만'}
          </div>
          <div className="border border-slate-200 bg-white px-3 py-2">
            반영 문서: {postedCount.toLocaleString('ko-KR')}건
          </div>
          <div className="border border-slate-200 bg-white px-3 py-2">
            작성중 문서: {draftCount.toLocaleString('ko-KR')}건
          </div>
        </div>

        {/* 팀 탭 내비게이션 */}
        <div className="flex flex-wrap gap-1 border-b border-slate-300 pb-2">
          <button
            onClick={() => setSelectedTeamId('all')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
              selectedTeamId === 'all'
                ? 'bg-white text-blue-700 border border-slate-300 border-b-white -mb-[9px] z-10 relative'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            전체 집계
          </button>
          {teamOptions.map((team) => {
            const id = String(team.id ?? team.legacyId ?? '');
            if (!id) return null;
            const isSelected = selectedTeamId === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedTeamId(id)}
                className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border ${
                  isSelected
                    ? 'bg-white border-slate-300 border-b-white text-slate-900 -mb-[9px] z-10 relative shadow-[0_-2px_4px_rgba(0,0,0,0.05)]'
                    : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
                style={isSelected ? { borderTopColor: team.color || '#3b82f6', borderTopWidth: '3px' } : {}}
              >
                {team.name}
              </button>
            );
          })}
        </div>

        {/* 요약 집계 카드 */}
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7 mt-4 relative z-0">
          {[
            ['숙소', totals.accommodation + totals.utility],
            ['차량', totals.vehicle],
            ['카드', totals.card],
            ['기타청구', totals.otherClaim],
            ['후청구 받을금액', totals.receivable],
            ['후청구 내야함', totals.payable],
            ['정산 반영 합계', totals.total]
          ].map(([label, amount]) => (
            <div key={String(label)} className="border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-black text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(Number(amount))}</div>
            </div>
          ))}
        </div>

        {/* 3단 레이아웃 그리드 (팀 선택 시) 또는 전체 요약 (전체 선택 시) */}
        {selectedTeamId === 'all' ? (
          <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-pink-100 px-4 py-3 text-center text-base font-black text-slate-950">
              {yearMonth.replace('-', '년 ')}월 전체 팀별 공제/후청구 요약
            </div>
            <div className="overflow-auto">
              <table className="min-w-[1400px] w-full border-collapse text-sm">
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
                  {summaries.length > 0 ? (
                    summaries.map((row) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={tableColumns.length + 1} className="border border-slate-300 px-4 py-10 text-center font-bold text-slate-500">
                        표시할 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1.2fr)_minmax(0,1fr)]">
            {/* 1. 좌측: 팀 총괄표 */}
            <section className="border border-slate-200 bg-white shadow-sm flex flex-col h-full">
              <div className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-900">
                {summaries[0]?.teamName || '팀'} 요약표
              </div>
              <div className="p-0 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-600">
                      <th className="border border-slate-200 px-3 py-2 text-left">항목</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableColumns.filter(c => c.key !== 'total').map(column => {
                      const amount = summaries[0] ? Number(summaries[0][column.key as keyof LedgerSummary] ?? 0) : 0;
                      return (
                        <tr key={column.key} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700">{column.label}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                            {amount ? formatCurrency(amount) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td className="border border-slate-200 px-3 py-3 font-black text-slate-900">총 합계</td>
                      <td className="border border-slate-200 px-3 py-3 text-right tabular-nums font-black text-slate-900 text-base text-red-600">
                        {summaries[0] ? formatCurrency(totals.total) : '0'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* 2. 중앙: 상세내역 (Phase 2에서 고도화) */}
            <section className="bg-slate-50 flex flex-col h-full min-h-[600px]">
              <ExpenseDetailBoard
                teamName={summaries[0]?.teamName || '팀 미지정'}
                color={summaries[0]?.color || '#cbd5e1'}
                accommodationDocs={selectedRawDocs.accommodationDocs}
                vehicleDocs={selectedRawDocs.vehicleDocs}
                cardDocs={selectedRawDocs.cardDocs}
                receivableClaims={selectedClaims.receivable}
                payableClaims={selectedClaims.payable}
                otherClaims={selectedClaims.other}
              />
            </section>

            {/* 3. 우측: 후청구 관리 */}
            <section className="border border-slate-200 bg-white shadow-sm flex flex-col h-full">
              <div className="border-b border-slate-200 bg-blue-100 px-4 py-3 text-center text-sm font-black text-slate-900">
                지원 외 식대/경비 후청구 내역
              </div>
              <ExpenseClaimForm
                yearMonth={yearMonth}
                teamOptions={teamOptions}
                siteOptions={siteOptions}
                cardLabelOptions={cardLabelOptions}
                defaultPayerTeamId={selectedTeamId !== 'all' ? selectedTeamId : undefined}
                onSuccess={loadData}
              />

              <div className="flex-1 overflow-auto p-4 bg-slate-100">
                {groupedClaims.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {groupedClaims.map((group) => {
                      const rows = group.rows;
                      const teamName = group.counterpartyTeamName;
                      const team = resolveTeam(undefined, teamName);
                      const isOther = group.direction === 'other';
                      const color = isOther ? '#d97706' : (team as any)?.color || '#64748b';
                      const subtotal = group.total;
                      const isReceivable = group.direction === 'receivable';
                      const headerTone = isOther
                        ? 'bg-amber-200 text-amber-950'
                        : isReceivable
                          ? 'bg-emerald-200 text-emerald-950'
                          : 'bg-rose-200 text-rose-950';
                      const headerLabel = isOther ? '기타청구' : isReceivable ? '받을 후청구' : '내야 할 후청구';
                      return (
                        <div key={group.id} className="overflow-hidden border-2 border-slate-900 bg-white">
                          <div className="flex">
                            <div className={`flex-1 border-r-2 border-b-2 border-slate-900 px-2 py-1 text-center text-xs font-black ${headerTone}`}>
                              {headerLabel}
                            </div>
                            <div className="flex-1 border-b-2 border-slate-900 px-2 py-1 flex items-center justify-between" style={{ backgroundColor: color }}>
                              <span className="text-xs font-black text-white px-1 mix-blend-difference">{teamName}</span>
                              <span className="text-xs font-black text-white px-1 mix-blend-difference">{formatCurrency(subtotal)}</span>
                            </div>
                          </div>
                          <table className="w-full border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-50 border-b-2 border-slate-900">
                                <th className="border-r border-slate-300 px-1 py-1 w-10">날짜</th>
                                <th className="border-r border-slate-300 px-1 py-1 w-16">사용카드</th>
                                <th className="border-r border-slate-300 px-1 py-1 w-20">현장명</th>
                                <th className="border-r border-slate-300 px-1 py-1 text-left">내용</th>
                                <th className="border-r border-slate-300 px-1 py-1 w-16 text-right">금액</th>
                                <th className="w-6"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((claim) => (
                                <tr key={claim.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                  <td className="border-r border-slate-200 p-1 text-center">{claim.date.slice(5)}</td>
                                  <td className="border-r border-slate-200 p-1 text-center">{claim.cardLabel || '-'}</td>
                                  <td className="border-r border-slate-200 p-1 text-center truncate max-w-[80px]" title={claim.siteName}>{claim.siteName || '-'}</td>
                                  <td className="border-r border-slate-200 p-1">
                                    <div className="font-bold text-slate-800">{claim.description}</div>
                                    <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                                      <span>({isOther ? '청구대상 없음' : isReceivable ? claim.chargeToTeamName : claim.payerTeamName})</span>
                                      <span>{getCategoryLabel(claim.category)}</span>
                                      <select
                                        value={claim.status}
                                        onChange={(event) => handleUpdateClaimStatus(claim, event.target.value as TeamExpenseClaim['status'])}
                                        className="h-5 rounded border border-slate-200 bg-white px-1 text-[9px] font-bold text-slate-600 outline-none"
                                        title={getStatusLabel(claim.status)}
                                      >
                                        <option value="draft">작성중</option>
                                        <option value="charged">청구완료</option>
                                        <option value="settled">정산완료</option>
                                      </select>
                                    </div>
                                  </td>
                                  <td className="border-r border-slate-200 p-1 text-right font-black tabular-nums">{formatCurrency(claim.amount)}</td>
                                  <td className="w-6 p-1 text-center align-middle">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClaim(claim)}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs font-bold text-slate-500">
                    등록된 후청구 경비가 없습니다.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseLedgerPage;
