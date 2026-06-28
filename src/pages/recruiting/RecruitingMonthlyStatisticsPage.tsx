import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Button from '../../components/ui/Button';
import { useRecruitingStatistics } from '../../hooks/useRecruitingStatistics';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  MonthToolbar,
  PageHeader,
} from './RecruitingShared';

const RecruitingMonthlyStatisticsPage: React.FC = () => {
  const { yearMonth, setYearMonth, statistics, loading, error, refresh, downloadExcel } = useRecruitingStatistics();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="월별 통계" description="소개자별 실적, 달성률, 현장별 투입, 월별 수익성을 분석합니다." />
      <MonthToolbar
        yearMonth={yearMonth}
        onChange={setYearMonth}
        onRefresh={refresh}
        loading={loading}
        actions={<Button type="button" variant="secondary" onClick={downloadExcel}>통계서 다운로드</Button>}
      />
      <ErrorBox message={error} />

      {!statistics ? <EmptyState message="통계 데이터를 불러오는 중입니다." /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-black text-slate-800">소개자별 순수익</div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics.referrerRows} margin={{ top: 8, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="referrerName" angle={-25} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="introIncomeTotal" name="수입" fill="#2563EB" />
                    <Bar dataKey="netProfit" name="순수익" fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-black text-slate-800">월별 수익 흐름</div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statistics.monthlyRows} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="yearMonth" />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="introIncomeTotal" name="수입" stroke="#2563EB" strokeWidth={2} />
                    <Line type="monotone" dataKey="netProfit" name="순수익" stroke="#059669" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-800">소개자별 실적</div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">소개자</th>
                    <th className="px-4 py-3 text-right">유입 인원</th>
                    <th className="px-4 py-3 text-right">5일 달성</th>
                    <th className="px-4 py-3 text-right">달성률</th>
                    <th className="px-4 py-3 text-right">중도중지</th>
                    <th className="px-4 py-3 text-right">중지율</th>
                    <th className="px-4 py-3 text-right">수입</th>
                    <th className="px-4 py-3 text-right">비용</th>
                    <th className="px-4 py-3 text-right">순수익</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statistics.referrerRows.map((row) => (
                    <tr key={row.referrerId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">{row.referrerName}</td>
                      <td className="px-4 py-3 text-right">{row.workerCount}</td>
                      <td className="px-4 py-3 text-right">{row.achievedCount}</td>
                      <td className="px-4 py-3 text-right">{row.achievementRate}%</td>
                      <td className="px-4 py-3 text-right">{row.stoppedCount}</td>
                      <td className="px-4 py-3 text-right">{row.stopRate}%</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.introIncomeTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.introPayoutTotal + row.dailyCommissionTotal)}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-700">{formatCurrency(row.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-800">현장별 용역 투입</div>
            <div className="overflow-x-auto">
              <table className="min-w-[800px] w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">현장</th>
                    <th className="px-4 py-3 text-right">인원수</th>
                    <th className="px-4 py-3 text-right">근무일수</th>
                    <th className="px-4 py-3 text-right">공수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statistics.siteRows.map((row) => (
                    <tr key={row.siteName} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{row.siteName}</td>
                      <td className="px-4 py-3 text-right">{row.workerCount}</td>
                      <td className="px-4 py-3 text-right">{row.workDays}</td>
                      <td className="px-4 py-3 text-right">{row.manDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitingMonthlyStatisticsPage;
