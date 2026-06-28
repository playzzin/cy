import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Button from '../../components/ui/Button';
import { useReferralReceivables } from '../../hooks/useReferralReceivables';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  formatNumber,
  MonthToolbar,
  PageHeader,
  StatCard,
  StatusBadge,
  useRecruitingPermissions,
} from './RecruitingShared';
import type { ServiceReferralReceivableStatus } from '../../types/recruiting';

const statusOptions: Array<{ value: ServiceReferralReceivableStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'partial', label: '부분회수' },
  { value: 'overdue', label: '연체' },
  { value: 'closed', label: '완납' },
];

const RecruitingReceivablesPage: React.FC = () => {
  const permissions = useRecruitingPermissions();
  const {
    month,
    setMonth,
    status,
    setStatus,
    receivables,
    summary,
    statistics,
    loading,
    saving,
    error,
    refresh,
    generate,
    collect,
    close,
    downloadExcel,
  } = useReferralReceivables();

  const handleCollect = async (id: string, defaultAmount: number) => {
    const amount = window.prompt('회수 금액을 입력하세요.', String(defaultAmount));
    if (amount === null) return;
    const memo = window.prompt('회수 메모를 입력하세요.', '미수금 부분 회수') || '미수금 부분 회수';
    await collect(id, Number(amount || 0), memo);
  };

  const handleClose = async (id: string) => {
    const memo = window.prompt('완납 메모를 입력하세요.', '미수금 완납 처리') || '미수금 완납 처리';
    await close(id, memo);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="미수금관리" description="입금 차액과 월별 정산 수입 기준 미수금을 생성하고 회수 상태를 추적합니다." />
      <MonthToolbar
        yearMonth={month}
        onChange={setMonth}
        onRefresh={refresh}
        loading={loading}
        actions={(
          <>
            <select value={status} onChange={(event) => setStatus(event.target.value as ServiceReferralReceivableStatus | 'all')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={generate} isLoading={saving} disabled={!permissions.canManageReceivables}>미수금 자동 생성</Button>
            <Button type="button" variant="secondary" onClick={downloadExcel}>Excel</Button>
          </>
        )}
      />
      <ErrorBox message={error} />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="총 미수금" value={formatCurrency(summary?.totalReceivableAmount)} tone="rose" />
        <StatCard label="회수율" value={`${summary?.recoveryRate || 0}%`} tone="green" />
        <StatCard label="연체건수" value={`${formatNumber(summary?.overdueCount)}건`} tone="orange" />
        <StatCard label="회수예정금액" value={formatCurrency(summary?.expectedRecoveryAmount)} note={`${formatNumber(summary?.openCount)}건 미결`} tone="blue" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 text-sm font-black text-slate-800">월별 미수금 추이</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={statistics?.monthlyRows || []} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="receivableAmount" name="미수금" stroke="#E11D48" strokeWidth={2} />
                <Line type="monotone" dataKey="receivedAmount" name="회수액" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-black text-slate-800">월별 회수율</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={statistics?.monthlyRows || []} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis unit="%" />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line type="monotone" dataKey="recoveryRate" name="회수율" stroke="#2563EB" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 text-sm font-black text-slate-800">소개자별 미수금 순위</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statistics?.referrerRows || []} layout="vertical" margin={{ top: 8, right: 20, left: 80, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
                <YAxis dataKey="referrerName" type="category" width={100} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="receivableAmount" name="미수금" fill="#E11D48" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {receivables.length === 0 && !loading ? <EmptyState message="미수금 데이터가 없습니다. 미수금 자동 생성을 실행하세요." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">월</th>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3 text-right">예정금액</th>
                  <th className="px-4 py-3 text-right">입금금액</th>
                  <th className="px-4 py-3 text-right">미수금액</th>
                  <th className="px-4 py-3 text-right">연체일수</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receivables.map((row) => {
                  const id = row.id || '';
                  return (
                    <tr key={id || `${row.month}:${row.referrerId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{row.month}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{row.referrerName}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.expectedAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.receivedAmount)}</td>
                      <td className="px-4 py-3 text-right font-black text-rose-700">{formatCurrency(row.receivableAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(row.overdueDays)}일</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">{row.memo || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => handleCollect(id, row.receivableAmount)} disabled={!permissions.canManageReceivables || !id || row.status === 'closed'}>회수</Button>
                          <Button type="button" size="sm" onClick={() => handleClose(id)} disabled={!permissions.canManageReceivables || !id || row.status === 'closed'}>완납</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitingReceivablesPage;
