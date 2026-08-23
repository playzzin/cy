import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Car,
  CreditCard,
  Landmark,
  ReceiptText,
  RefreshCw,
  Sigma,
  type LucideIcon
} from 'lucide-react';
import MonthNavigator from '../../components/common/MonthNavigator';
import { ExpenseLedgerDetailBoard } from './components/ExpenseLedgerDetailBoard';
import {
  formatCurrency,
  getSummaryTotal,
  hexToRgba,
  normalizeColor,
  useExpenseLedgerData
} from './hooks/useExpenseLedgerData';
import type { BillingScope, LedgerSummary } from './hooks/useExpenseLedgerData';
import { resolveIcon } from '../../constants/iconMap';
import {
  getSupportManagementYearMonth,
  rememberSupportManagementYearMonth,
  subscribeSupportManagementYearMonth,
} from '../../utils/supportManagementState';

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
  { key: 'vehicleRent', label: '렌트비' },
  { key: 'vehicleLease', label: '리스비' },
  { key: 'vehicleFuel', label: '주유비' },
  { key: 'vehicleRepair', label: '수리비' },
  { key: 'vehicleToll', label: '통행료' },
  { key: 'vehicleFine', label: '과태료' },
  { key: 'vehicleOther', label: '기타' },
  { key: 'card', label: '카드값' },
  { key: 'otherClaim', label: '기타청구', className: 'text-amber-700' },
  { key: 'officeExpense', label: '사무실경비', className: 'text-sky-700' },
  { key: 'receivable', label: '받을 후청구', className: 'text-emerald-700' },
  { key: 'payable', label: '내야 할 후청구', className: 'text-red-600' },
  { key: 'total', label: '합계', className: 'font-black text-slate-950' }
];

type SummaryCard = {
  label: string;
  amount: number;
  icon: LucideIcon;
  tone: string;
};

const SUMMARY_HIGHLIGHT_STORAGE_PREFIX = 'expense-ledger-summary-highlights-v1';

const getSummaryHighlightStorageKey = (yearMonth: string, teamId: string): string =>
  `${SUMMARY_HIGHLIGHT_STORAGE_PREFIX}:${yearMonth}:${teamId}`;

const loadSummaryHighlights = (yearMonth: string, teamId: string): Set<string> => {
  if (typeof window === 'undefined' || teamId === 'all') return new Set();
  try {
    const saved = JSON.parse(window.localStorage.getItem(getSummaryHighlightStorageKey(yearMonth, teamId)) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
};

const saveSummaryHighlights = (yearMonth: string, teamId: string, itemKeys: Set<string>): void => {
  if (typeof window === 'undefined' || teamId === 'all') return;
  try {
    window.localStorage.setItem(getSummaryHighlightStorageKey(yearMonth, teamId), JSON.stringify([...itemKeys]));
  } catch {
    // 저장 공간을 사용할 수 없을 때에도 화면 선택 동작은 유지한다.
  }
};

const ExpenseLedgerPage: React.FC<ExpenseLedgerPageProps> = ({ embedded = false }) => {
  const [yearMonth, setYearMonth] = useState(getSupportManagementYearMonth);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [highlightedSummaryItemKeys, setHighlightedSummaryItemKeys] = useState<Set<string>>(() => new Set());
  const billingScope: BillingScope = 'posted';

  useEffect(() => {
    rememberSupportManagementYearMonth(yearMonth);
  }, [yearMonth]);

  useEffect(() => subscribeSupportManagementYearMonth(setYearMonth), []);

  const {
    loading,
    teamOptions,
    summaries,
    totals,
    selectedClaims,
    statusCounts,
    allCategoryOptions,
    loadData,
    selectedRawDocs,
    rawDocs
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
  const selectedTeamColor = normalizeColor(selectedSummary?.color || '#94a3b8');

  useEffect(() => {
    setHighlightedSummaryItemKeys(loadSummaryHighlights(yearMonth, selectedTeamId));
  }, [selectedTeamId, yearMonth]);

  const toggleSummaryItemHighlight = (itemKey: string) => {
    setHighlightedSummaryItemKeys((previous) => {
      const next = new Set(previous);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      saveSummaryHighlights(yearMonth, selectedTeamId, next);
      return next;
    });
  };
  const allSummaryColumnTotals = useMemo(
    () =>
      tableColumns.reduce((acc, column) => {
        acc[column.key] = summaries.reduce(
          (sum, row) => sum + (column.key === 'total' ? getSummaryTotal(row) : Number(row[column.key] ?? 0)),
          0
        );
        return acc;
      }, {} as Record<(typeof tableColumns)[number]['key'], number>),
    [summaries]
  );

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      { label: '숙소', amount: totals.accommodation + totals.utility, icon: Building2, tone: '#059669' },
      { label: '차량', amount: totals.vehicle, icon: Car, tone: '#2563eb' },
      { label: '카드', amount: totals.card, icon: CreditCard, tone: '#7c3aed' },
      { label: '기타청구', amount: totals.otherClaim, icon: ReceiptText, tone: '#d97706' },
      { label: '사무실경비', amount: totals.officeExpense, icon: Landmark, tone: '#0284c7' },
      { label: '받을 후청구', amount: totals.receivable, icon: ArrowDownLeft, tone: '#059669' },
      { label: '내야 할 후청구', amount: totals.payable, icon: ArrowUpRight, tone: '#dc2626' },
      { label: '정산 반영 합계', amount: totals.total, icon: Sigma, tone: '#0f172a' }
    ],
    [totals.accommodation, totals.card, totals.officeExpense, totals.otherClaim, totals.payable, totals.receivable, totals.total, totals.utility, totals.vehicle]
  );

  const loadingDetailState = (
    <div role="status" className="flex min-h-[240px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-500 shadow-sm">
      <span className="inline-flex items-center gap-2">
        <RefreshCw size={16} className="animate-spin text-blue-600" />
        상세내역을 불러오는 중입니다.
      </span>
    </div>
  );

  return (
    <div className={embedded ? 'min-h-0 w-full' : 'min-h-screen bg-slate-50 p-4 xl:p-6'}>
      <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row lg:items-center lg:justify-between ${embedded ? 'gap-2 px-3 py-2' : 'gap-3 p-4'}`}>
          <div>
            <h1 className={embedded ? 'text-sm font-black text-slate-950' : 'text-xl font-black text-slate-950'}>팀별 경비내역</h1>
            <p className={embedded ? 'hidden' : 'mt-1 text-sm font-medium text-slate-500'}>
              카드·숙소·차량 대장에서 저장한 경비와 청구완료·정산완료 후청구 내역을 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!embedded && (
              <div className="w-full min-w-[180px] sm:w-[180px]">
                <MonthNavigator
                  value={yearMonth}
                  onChange={setYearMonth}
                  disabled={loading}
                  ariaLabel="경비내역 조회월"
                />
              </div>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>

        <div className={embedded
          ? 'support-scroll-x flex gap-2 text-xs font-bold text-slate-600'
          : 'grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-3'}>
          <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            조회 기준: 저장 반영·청구완료·정산완료 내역
          </div>
          <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            반영 문서: {postedCount.toLocaleString('ko-KR')}건
          </div>
          <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            원장 제외 작성중 문서: {draftCount.toLocaleString('ko-KR')}건
          </div>
        </div>

        <div className="support-scroll-x rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="경비내역 팀 선택">
          <div className="support-scroll-inner inline-flex gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={selectedTeamId === 'all'}
              onClick={() => {
                setSelectedTeamId('all');
                setHighlightedSummaryItemKeys(new Set());
              }}
              className={`h-10 rounded-md border px-4 text-sm font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                selectedTeamId === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              전체 집계
            </button>
            {teamOptions.map((team) => {
              const id = String(team.id ?? team.legacyId ?? '');
              if (!id) return null;
              const isSelected = selectedTeamId === id;
              const teamColor = normalizeColor(team.color);
              const teamIcon = resolveIcon(team.iconKey || team.icon || 'fa-users', faUsers);
              const tabStyle: React.CSSProperties = isSelected
                ? {
                    borderColor: hexToRgba(teamColor, 0.45),
                    backgroundColor: hexToRgba(teamColor, 0.12),
                    color: '#0f172a',
                    boxShadow: `0 8px 18px -16px ${teamColor}`
                  }
                : {
                    borderColor: hexToRgba(teamColor, 0.28),
                    backgroundColor: '#fff'
                  };

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedTeamId(id);
                    setHighlightedSummaryItemKeys(new Set());
                  }}
                  className="h-10 rounded-md border px-4 text-sm font-extrabold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  style={tabStyle}
                  title={team.name}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] shadow-sm"
                      style={{
                        borderColor: hexToRgba(teamColor, 0.35),
                        backgroundColor: hexToRgba(teamColor, 0.12),
                        color: teamColor,
                      }}
                      aria-hidden="true"
                      data-team-visual="true"
                      title={`팀 색상 ${teamColor}`}
                    >
                      <FontAwesomeIcon icon={teamIcon} data-testid="team-icon" />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white"
                        style={{ backgroundColor: teamColor }}
                      />
                    </span>
                    <span className="whitespace-nowrap">{team.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            <RefreshCw size={16} className="animate-spin" />
            경비내역을 불러오는 중입니다.
          </div>
        )}

        <div className="relative z-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {summaryCards.map(({ label, amount, icon: Icon, tone }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm" style={{ boxShadow: `inset 3px 0 0 ${tone}` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-500">{label}</div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: hexToRgba(tone, 0.1), color: tone }}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="mt-2 text-lg font-black tabular-nums text-slate-950">{formatCurrency(amount)}</div>
            </div>
          ))}
        </div>

        {selectedTeamId === 'all' ? (
          <>
            <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-busy={loading}>
              <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-base font-black text-slate-950">
                  {yearMonth.replace('-', '년 ')}월 전체 팀별 공제/후청구 요약
                </div>
                <div className="text-xs font-bold text-slate-500">
                  {summaries.length.toLocaleString('ko-KR')}개 팀
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[1650px] border-collapse text-sm">
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
                    {loading ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1} className="border border-slate-300 px-4 py-10 text-center font-bold text-slate-500">
                          경비내역을 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : summaries.length > 0 ? summaries.map((row) => (
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
                                      : column.key === 'officeExpense' && amount > 0
                                        ? { backgroundColor: hexToRgba('#0284c7', 0.08) }
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
                          표시할 원장 청구/청구완료 내역이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {summaries.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-400 bg-slate-100 text-sm font-black text-slate-950">
                        <td className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-3 py-3 text-left">
                          가로 합계
                        </td>
                        {tableColumns.map((column) => {
                          const amount = allSummaryColumnTotals[column.key] ?? 0;
                          return (
                            <td
                              key={column.key}
                              className={`border border-slate-300 px-3 py-3 text-right tabular-nums ${column.className ?? ''}`}
                            >
                              {amount ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>

            <section className="min-h-[600px] bg-slate-50">
              {loading ? loadingDetailState : (
                <ExpenseLedgerDetailBoard
                  teamName="전체 팀"
                  color="#64748b"
                  accommodationDocs={rawDocs.accommodationDocs}
                  vehicleDocs={rawDocs.vehicleDocs}
                  cardDocs={rawDocs.cardDocs}
                  receivableClaims={[]}
                  payableClaims={[]}
                  otherClaims={[]}
                  officeClaims={[]}
                  categoryOptions={allCategoryOptions}
                  showClaims={false}
                  showTeamColumn
                />
              )}
            </section>
          </>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <section className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-busy={loading}>
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
                    {loading ? (
                      <tr>
                        <td colSpan={2} className="border border-slate-200 px-4 py-8 text-center font-bold text-slate-500">
                          경비내역을 불러오는 중입니다.
                        </td>
                      </tr>
                      ) : tableColumns.filter((column) => column.key !== 'total').map((column) => {
                      const amount = selectedSummary ? Number(selectedSummary[column.key as keyof LedgerSummary] ?? 0) : 0;
                      const isHighlighted = highlightedSummaryItemKeys.has(column.key);

                      return (
                        <tr
                          key={column.key}
                          className={isHighlighted ? 'transition-colors' : 'hover:bg-slate-50 transition-colors'}
                          style={isHighlighted ? {
                            backgroundColor: hexToRgba(selectedTeamColor, 0.2),
                            boxShadow: `inset 4px 0 0 ${selectedTeamColor}`
                          } : undefined}
                        >
                          <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700">
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isHighlighted}
                                onChange={() => toggleSummaryItemHighlight(column.key)}
                                className="h-4 w-4 rounded border-slate-300"
                                style={{ accentColor: selectedTeamColor }}
                                aria-label={`${column.label} 팀색상 표시`}
                              />
                              <span>{column.label}</span>
                            </label>
                          </td>
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
              {loading ? loadingDetailState : (
                <ExpenseLedgerDetailBoard
                  teamName={selectedSummary?.teamName || '팀 미지정'}
                  color={selectedSummary?.color || '#cbd5e1'}
                  accommodationDocs={selectedRawDocs.accommodationDocs}
                  vehicleDocs={selectedRawDocs.vehicleDocs}
                  cardDocs={selectedRawDocs.cardDocs}
                  receivableClaims={selectedClaims.receivable}
                  payableClaims={selectedClaims.payable}
                  otherClaims={selectedClaims.other}
                  officeClaims={selectedClaims.office}
                  categoryOptions={allCategoryOptions}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseLedgerPage;
