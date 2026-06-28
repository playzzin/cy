import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { companyService } from '../../services/companyService';
import { teamService, type Team } from '../../services/teamService';
import { teamSettlementService } from '../../services/teamSettlementService';
import {
  TeamSettlementComparisonPanel,
  MONTH_BUTTON_OPTIONS,
  TeamSettlementDetailTables,
  TeamSettlementExecutiveSummary,
  TeamSettlementPortfolioPanel,
  TeamSettlementProfitBridge,
  TeamSettlementRankingPanel,
  TeamSettlementScenarioSimulator,
  TeamSettlementSiteStatisticTable,
  TeamSettlementWarningPanel,
  TeamSettlementWorkerStatisticTable,
  buildDetailExportRows,
  buildExecutiveSummaryExportRows,
  buildSiteExportRows,
  buildSiteStatisticRows,
  buildTeamExportRows,
  buildAggregateTotals,
  buildDefaultYearMonth,
  buildDetailBreakdown,
  buildTeamStats,
  buildWarningExportRows,
  buildWarningRows,
  buildWorkerExportRows,
  buildYearMonthValue,
  exportRowsToExcel,
  formatAverageCurrency,
  formatCompactCurrency,
  formatCurrency,
  formatManDay,
  formatPercent,
  loadWorkerStatisticRowsForStats,
  mergeWorkerStatisticRows,
  parseYearMonthValue,
  printStatisticsReport,
  type ExcelSheetRows,
  type LoadState,
  type TeamSettlementAggregateTotals,
  type TeamSettlementWorkerStatisticRow,
  type TeamSettlementStatRow
} from './TeamSettlementStatisticsPage';

type AnnualMonthStatRow = TeamSettlementStatRow & {
  month: number;
  yearMonth: string;
};

export type TeamSettlementAnnualStatisticsView = 'monthly' | 'management';

export type TeamSettlementAnnualStatisticsPageProps = {
  view?: TeamSettlementAnnualStatisticsView;
};

const loadConstructionTeams = async (): Promise<Team[]> => {
  const [teamList, constructionCompanies] = await Promise.all([
    teamService.getTeams(),
    companyService.getCompaniesByType('시공사')
  ]);

  const companyIdSet = new Set(constructionCompanies.map((company) => company.id).filter(Boolean));
  const companyNameSet = new Set(constructionCompanies.map((company) => company.name).filter(Boolean));
  const constructionTeams = teamList.filter((team) => {
    if (team.companyId && companyIdSet.has(team.companyId)) return true;
    if (team.companyName && companyNameSet.has(team.companyName)) return true;
    return false;
  });
  const siteTeams = constructionTeams.filter((team) => {
    const type = String(team.type ?? '').trim();
    return type === '시공팀' || type === '시공사팀';
  });

  return siteTeams.length > 0 ? siteTeams : constructionTeams;
};

const TeamSettlementAnnualCharts: React.FC<{ rows: AnnualMonthStatRow[] }> = ({ rows }) => {
  const chartRows = rows.map((row) => ({
    name: `${row.month}월`,
    총수입: row.incomeTotal,
    총지출: row.outgoingTotal,
    경비: row.expenseTotal,
    정산잔액: row.net,
    현장총공수: Number(formatManDay(row.directManDay)),
    인원총공수: Number(formatManDay(row.teamWorkerManDay))
  }));

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-extrabold text-slate-900">월별 총수입 추이</div>
        <div className="mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
              <Tooltip formatter={(value: any, name: any) => [`${formatCurrency(Number(value))}원`, name]} />
              <Legend />
              <Line type="monotone" dataKey="총수입" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="총지출" stroke="#64748b" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="정산잔액" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-extrabold text-slate-900">현장총공수 / 인원총공수 비교</div>
        <div className="mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: any, name: any) => [`${formatManDay(Number(value))}공수`, name]} />
              <Legend />
              <Bar dataKey="현장총공수" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="인원총공수" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export const TeamSettlementAnnualStatisticsPage: React.FC<TeamSettlementAnnualStatisticsPageProps> = ({ view = 'monthly' }) => {
  const [searchParams] = useSearchParams();
  const [year, setYear] = useState<number>(() => {
    const queryYear = Number(searchParams.get('year'));
    return Number.isFinite(queryYear) && queryYear >= 2000 && queryYear <= 2100
      ? queryYear
      : parseYearMonthValue(buildDefaultYearMonth()).year;
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => searchParams.get('teamId') ?? '');
  const [annualStats, setAnnualStats] = useState<AnnualMonthStatRow[]>([]);
  const [previousAnnualTotals, setPreviousAnnualTotals] = useState<TeamSettlementAggregateTotals | null>(null);
  const [annualWorkerStats, setAnnualWorkerStats] = useState<TeamSettlementWorkerStatisticRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set());

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.id ?? '').trim() === selectedTeamId),
    [teams, selectedTeamId]
  );

  useEffect(() => {
    let cancelled = false;

    const loadTeams = async () => {
      try {
        const rows = await loadConstructionTeams();
        if (cancelled) return;
        setTeams(rows);
      } catch (error) {
        console.error(error);
        if (!cancelled) setTeams([]);
      }
    };

    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (teams.length === 0) return;
    if (selectedTeam) return;

    const firstTeamId = String(teams[0]?.id ?? '').trim();
    if (firstTeamId) setSelectedTeamId(firstTeamId);
  }, [teams, selectedTeam]);

  const loadAnnualRowsForYear = useCallback(async (targetYear: number): Promise<AnnualMonthStatRow[]> => {
    if (!selectedTeam) {
      return [];
    }

    const teamId = String(selectedTeam.id ?? '').trim();
    if (!teamId) {
      return [];
    }

    return Promise.all(
      MONTH_BUTTON_OPTIONS.map(async (month): Promise<AnnualMonthStatRow> => {
        const yearMonth = buildYearMonthValue(targetYear, month);
        const doc = await teamSettlementService.getTeamSettlement({ yearMonth, teamId });
        return {
          ...buildTeamStats(selectedTeam, doc),
          month,
          yearMonth
        };
      })
    );
  }, [selectedTeam]);

  const loadAnnualStatistics = useCallback(async () => {
    if (!selectedTeam) {
      setAnnualStats([]);
      setPreviousAnnualTotals(null);
      setAnnualWorkerStats([]);
      return;
    }

    setLoadState({ status: 'loading' });
    try {
      const [rows, previousRows] = await Promise.all([
        loadAnnualRowsForYear(year),
        loadAnnualRowsForYear(year - 1)
      ]);
      setAnnualStats(rows);
      setPreviousAnnualTotals(buildAggregateTotals(previousRows));
      const monthlyWorkers = await Promise.all(
        rows.map((row) => loadWorkerStatisticRowsForStats(row.yearMonth, [row]))
      );
      setAnnualWorkerStats(mergeWorkerStatisticRows(monthlyWorkers.flat()));
      setLoadState({ status: 'idle' });
    } catch (error) {
      console.error(error);
      setAnnualStats([]);
      setPreviousAnnualTotals(null);
      setAnnualWorkerStats([]);
      setLoadState({ status: 'error', message: '팀별 연간 통계를 불러오지 못했습니다.' });
    }
  }, [loadAnnualRowsForYear, selectedTeam, year]);

  useEffect(() => {
    void loadAnnualStatistics();
  }, [loadAnnualStatistics]);

  const totals = useMemo(() => buildAggregateTotals(annualStats), [annualStats]);
  const warningRows = useMemo(() => buildWarningRows(annualStats), [annualStats]);
  const siteStats = useMemo(() => buildSiteStatisticRows(annualStats), [annualStats]);

  const handleTeamChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeamId(event.target.value);
    setExpandedMonths(new Set());
  }, []);

  const handleYearChange = useCallback((delta: number) => {
    setYear((prev) => prev + delta);
    setExpandedMonths(new Set());
  }, []);

  const toggleMonth = useCallback((yearMonthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(yearMonthKey)) next.delete(yearMonthKey);
      else next.add(yearMonthKey);
      return next;
    });
  }, []);

  const buildExportSheets = useCallback((): ExcelSheetRows[] => [
    {
      name: '경영요약',
      rows: buildExecutiveSummaryExportRows(
        totals,
        annualStats,
        siteStats,
        annualWorkerStats,
        warningRows,
        `${selectedTeam?.name || '팀 미지정'} · ${year}년 전체`
      )
    },
    { name: '월별 연간 통계', rows: buildTeamExportRows(annualStats).map((row, index) => ({ 월: `${annualStats[index]?.month ?? index + 1}월`, ...row })) },
    { name: '현장별 연간 통계', rows: buildSiteExportRows(siteStats) },
    { name: '인원별 연간 통계', rows: buildWorkerExportRows(annualWorkerStats) },
    { name: '상세내역', rows: buildDetailExportRows(annualStats, (row) => `${(row as AnnualMonthStatRow).month}월`) },
    { name: '경고 항목', rows: buildWarningExportRows(warningRows) }
  ], [annualStats, annualWorkerStats, selectedTeam?.name, siteStats, totals, warningRows, year]);

  const handleDownloadExcel = useCallback(() => {
    const teamName = selectedTeam?.name || '팀';
    exportRowsToExcel(`팀정산_연간통계_${teamName}_${year}.xlsx`, buildExportSheets());
  }, [buildExportSheets, selectedTeam?.name, year]);

  const handlePrintPdf = useCallback(() => {
    printStatisticsReport({
      title: '팀별 연간 통계',
      subtitle: `${selectedTeam?.name || '팀 미지정'} · ${year}년 전체`,
      sections: buildExportSheets()
    });
  }, [buildExportSheets, selectedTeam?.name, year]);

  const metricCards = [
    { label: '연간 총수입', value: `${formatCurrency(totals.incomeTotal)}원`, note: `매출 ${formatCurrency(totals.salesTotal)} + 추가 ${formatCurrency(totals.additionsTotal)}`, icon: <TrendingUp size={18} /> },
    { label: '연간 총지출', value: `${formatCurrency(totals.outgoingTotal)}원`, note: `매입 ${formatCurrency(totals.purchasesTotal)} + 공제 ${formatCurrency(totals.deductionsTotal)}`, icon: <TrendingDown size={18} /> },
    { label: '연간 정산차익', value: `${formatCurrency(totals.grossProfit)}원`, note: `차익률 ${formatPercent(totals.operatingNetRate)}`, icon: <WalletCards size={18} /> },
    { label: '연간 잔액', value: `${formatCurrency(totals.net)}원`, note: `정산율 ${formatPercent(totals.netRate)}`, icon: <BarChart3 size={18} /> },
    { label: '현장총공수', value: `${formatManDay(totals.directManDay)}공수`, note: '도급/직영 현장 기준', icon: <BarChart3 size={18} /> },
    { label: '인원총공수', value: `${formatManDay(totals.teamWorkerManDay)}공수`, note: '급여 기준 인원공수', icon: <WalletCards size={18} /> },
    { label: '팀평균단가', value: formatAverageCurrency(totals.teamAverageUnitPrice), note: `인원공수 ${formatManDay(totals.teamWorkerManDay)}`, icon: <BarChart3 size={18} /> },
    { label: '현장쓰꾸미', value: formatAverageCurrency(totals.siteSkkumiUnitPrice), note: `도급/직영 공수 ${formatManDay(totals.directManDay)}`, icon: <TrendingUp size={18} /> }
  ];
  const pageTitle = view === 'management' ? '팀정산 연간 경영' : '팀별 연간 통계';
  const pageDescription = view === 'management'
    ? '연간 경영 요약부터 인원별 상세 통계까지 별도 페이지에서 조회합니다.'
    : '팀 하나를 선택해 1월부터 12월까지 월별 정산 현황과 상세내역을 조회합니다.';
  const tabSearchParams = new URLSearchParams();
  tabSearchParams.set('year', String(year));
  if (selectedTeamId) tabSearchParams.set('teamId', selectedTeamId);
  const tabSearch = `?${tabSearchParams.toString()}`;
  const navigationTabs: Array<{
    key: TeamSettlementAnnualStatisticsView;
    label: string;
    description: string;
    to: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'monthly',
      label: '월별 연간 통계',
      description: '월별 정산표와 상세 내역',
      to: `/payroll/team-settlement-annual-statistics${tabSearch}`,
      icon: <BarChart3 size={16} />
    },
    {
      key: 'management',
      label: '연간 경영',
      description: '요약, 진단, 현장·인원 통계',
      to: `/payroll/team-settlement-annual-statistics/management${tabSearch}`,
      icon: <WalletCards size={16} />
    }
  ];

  return (
    <div id="team-annual-statistics-page" className="w-full p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{pageDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            onClick={handleDownloadExcel}
            disabled={loadState.status === 'loading' || !selectedTeam}
          >
            <FileSpreadsheet size={16} />
            엑셀 출력
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            onClick={handlePrintPdf}
            disabled={loadState.status === 'loading' || !selectedTeam}
          >
            <Printer size={16} />
            PDF 출력
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            onClick={loadAnnualStatistics}
            disabled={loadState.status === 'loading' || !selectedTeam}
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </div>

      <div className="mt-6 border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {navigationTabs.map((tab) => {
            const selected = view === tab.key;
            return (
              <NavLink
                key={tab.key}
                to={tab.to}
                end={tab.key === 'monthly'}
                className={`mb-[-1px] inline-flex min-w-[180px] items-center gap-3 border-b-2 px-4 py-3 text-left transition ${selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  }`}
              >
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${selected
                  ? 'border-blue-100 bg-blue-50'
                  : 'border-slate-200 bg-white'
                  }`}>
                  {tab.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{tab.label}</span>
                  <span className="block truncate text-xs font-semibold opacity-80">{tab.description}</span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-bold text-slate-800">조회 조건</div>
        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-white"
              onClick={() => handleYearChange(-1)}
              aria-label={`${year - 1}년`}
            >
              {'<'}
            </button>
            <div className="min-w-[84px] text-center text-sm font-extrabold text-slate-900">{year}년</div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-white"
              onClick={() => handleYearChange(1)}
              aria-label={`${year + 1}년`}
            >
              {'>'}
            </button>
          </div>

          <select
            className="h-10 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
            value={selectedTeamId}
            onChange={handleTeamChange}
          >
            {teams.length === 0 ? (
              <option value="">선택할 팀 없음</option>
            ) : (
              teams.map((team) => {
                const teamId = String(team.id ?? '').trim();
                return (
                  <option key={teamId} value={teamId}>
                    {team.name || '팀 미지정'}
                  </option>
                );
              })
            )}
          </select>

          <div className="text-sm font-semibold text-slate-500">
            {selectedTeam ? `${selectedTeam.name || '팀 미지정'} · ${year}년 전체` : '팀을 선택하세요'}
          </div>
        </div>
      </div>

      {loadState.status === 'error' && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {loadState.message}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-500">{card.label}</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900">{card.value}</div>
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                {card.icon}
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500">{card.note}</div>
          </div>
        ))}
      </div>

      {view === 'management' ? (
        <>
          <TeamSettlementExecutiveSummary
            title="연간 경영 요약"
            subtitle="선택 팀의 12개월 정산 흐름을 수익성, 비용, 공수, 단가 기준으로 자동 진단합니다."
            periodLabel={`${selectedTeam?.name || '팀 미지정'} · ${year}년`}
            totals={totals}
            rows={annualStats}
            siteRows={siteStats}
            workerRows={annualWorkerStats}
            warnings={warningRows}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-3">
            <TeamSettlementProfitBridge totals={totals} />
            <TeamSettlementPortfolioPanel
              rows={annualStats}
              siteRows={siteStats}
              workerRows={annualWorkerStats}
              primaryLabel="월"
              getLabel={(row) => `${(row as AnnualMonthStatRow).month}월`}
            />
            <TeamSettlementScenarioSimulator totals={totals} />
          </div>

          <TeamSettlementComparisonPanel
            title="전년 대비"
            current={totals}
            previous={previousAnnualTotals}
            previousLabel={`${year - 1}년 대비`}
          />

          <TeamSettlementAnnualCharts rows={annualStats} />

          <TeamSettlementRankingPanel
            rows={annualStats}
            title="월별 순위 요약"
            primaryLabel="월"
            getLabel={(row) => `${(row as AnnualMonthStatRow).month}월`}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <TeamSettlementWarningPanel warnings={warningRows} />
            <TeamSettlementSiteStatisticTable rows={siteStats} />
          </div>

          <div className="mt-4">
            <TeamSettlementWorkerStatisticTable rows={annualWorkerStats} />
          </div>
        </>
      ) : (
        <div id="team-annual-statistics" className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">월별 연간 정산 현황</div>
            <div className="mt-0.5 text-xs text-slate-500">월별 상세 버튼을 열면 매출, 매입, 공제, 추가, 현장별 쓰꾸미 상세를 확인할 수 있습니다.</div>
          </div>
          <div className="text-xs font-bold text-slate-500">
            {loadState.status === 'loading' ? '불러오는 중' : `${year}년 전체`}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1420px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-600">
                <th className="px-3 py-3 text-left">월</th>
                <th className="px-3 py-3 text-right">총수입</th>
                <th className="px-3 py-3 text-right">총지출</th>
                <th className="px-3 py-3 text-right">급여</th>
                <th className="px-3 py-3 text-right">경비</th>
                <th className="px-3 py-3 text-right">정산차익</th>
                <th className="px-3 py-3 text-right">정산잔액</th>
                <th className="px-3 py-3 text-right">현장총공수</th>
                <th className="px-3 py-3 text-right">인원총공수</th>
                <th className="px-3 py-3 text-right">팀평균단가</th>
                <th className="px-3 py-3 text-right">현장쓰꾸미</th>
                <th className="px-3 py-3 text-center">상태</th>
                <th className="px-3 py-3 text-center">상세</th>
              </tr>
            </thead>
            <tbody>
              {annualStats.length === 0 && loadState.status !== 'loading' ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-400" colSpan={13}>
                    연간 통계를 조회할 팀을 선택하세요.
                  </td>
                </tr>
              ) : (
                annualStats.map((row) => {
                  const expanded = expandedMonths.has(row.yearMonth);
                  const detail = expanded ? buildDetailBreakdown(row) : null;
                  return (
                    <React.Fragment key={row.yearMonth}>
                      <tr className="border-t border-slate-100 bg-white text-slate-800 hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="font-extrabold text-slate-900">{row.month}월</div>
                          <div className="mt-1 text-xs text-slate-500">매출+추가 / 매입+공제 · 정산율 {formatPercent(row.netRate)}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{formatCurrency(row.incomeTotal)}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(row.outgoingTotal)}</td>
                        <td className="px-3 py-3 text-right text-blue-700">{formatCurrency(row.payrollTotal)}</td>
                        <td className="px-3 py-3 text-right text-amber-700">{formatCurrency(row.expenseTotal)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${row.grossProfit < 0 ? 'text-rose-700' : 'text-cyan-700'}`}>
                          {formatCurrency(row.grossProfit)}
                        </td>
                        <td className={`px-3 py-3 text-right font-extrabold ${row.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {formatCurrency(row.net)}
                        </td>
                        <td className="px-3 py-3 text-right">{formatManDay(row.directManDay)}</td>
                        <td className="px-3 py-3 text-right">{formatManDay(row.teamWorkerManDay)}</td>
                        <td className="px-3 py-3 text-right">{formatAverageCurrency(row.teamAverageUnitPrice)}</td>
                        <td className="px-3 py-3 text-right">{formatAverageCurrency(row.siteSkkumiUnitPrice)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`rounded-full border px-2 py-1 text-xs font-bold ${row.doc.confirmedAt
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}>
                            {row.doc.confirmedAt ? '확정' : '미확정'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            onClick={() => toggleMonth(row.yearMonth)}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            상세
                          </button>
                        </td>
                      </tr>
                      {expanded && detail && (
                        <tr className="border-t border-slate-100 bg-slate-50">
                          <td className="px-4 py-4" colSpan={13}>
                            <TeamSettlementDetailTables
                              detail={detail}
                              totals={{
                                salesTotal: row.salesTotal,
                                purchasesTotal: row.purchasesTotal,
                                deductionsTotal: row.deductionsTotal,
                                additionsTotal: row.additionsTotal,
                                directSalesTotal: row.directSalesTotal
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
};

export default TeamSettlementAnnualStatisticsPage;
