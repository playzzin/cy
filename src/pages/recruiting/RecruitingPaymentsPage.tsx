import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useReferralPayments } from '../../hooks/useReferralPayments';
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
import type { ServiceReferralPaymentStatus } from '../../types/recruiting';

const statusOptions: Array<{ value: ServiceReferralPaymentStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '지급예정' },
  { value: 'approved', label: '승인' },
  { value: 'paid', label: '지급완료' },
  { value: 'cancelled', label: '취소' },
];

const RecruitingPaymentsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const permissions = useRecruitingPermissions();
  const {
    yearMonth,
    setYearMonth,
    status,
    setStatus,
    payments,
    summary,
    trend,
    selectedIds,
    loading,
    saving,
    error,
    refresh,
    sync,
    approve,
    pay,
    cancel,
    bulkApprove,
    bulkPay,
    downloadExcel,
    toggleSelected,
  } = useReferralPayments();

  const allVisibleSelected = payments.length > 0 && payments.every((payment) => payment.id && selectedIds.includes(payment.id));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="지급관리" description="소개자별 정산 지급 승인, 지급 완료, 취소 및 지급 이력을 관리합니다." />
      <MonthToolbar
        yearMonth={yearMonth}
        onChange={setYearMonth}
        onRefresh={refresh}
        loading={loading}
        actions={(
          <>
            <select value={status} onChange={(event) => setStatus(event.target.value as ServiceReferralPaymentStatus | 'all')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={sync} isLoading={saving} disabled={!permissions.canManagePayments}>정산서 동기화</Button>
            <Button type="button" variant="secondary" onClick={bulkApprove} disabled={!permissions.canManagePayments || selectedIds.length === 0 || saving}>일괄 승인</Button>
            <Button type="button" onClick={() => bulkPay(currentUser?.uid)} disabled={!permissions.canManagePayments || selectedIds.length === 0 || saving}>일괄 지급</Button>
            <Button type="button" variant="secondary" onClick={downloadExcel}>Excel</Button>
          </>
        )}
      />
      <ErrorBox message={error} />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="지급대기금액" value={formatCurrency(summary?.pendingAmount)} note={`${formatNumber(summary?.pendingCount)}건`} tone="orange" />
        <StatCard label="금월지급액" value={formatCurrency(summary?.currentMonthPaidAmount)} note={`${formatNumber(summary?.paidCount)}건 지급완료`} tone="green" />
        <StatCard label="누적지급액" value={formatCurrency(summary?.cumulativePaidAmount)} tone="blue" />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 text-sm font-black text-slate-800">지급 추이</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="pendingAmount" name="대기" fill="#F59E0B" />
              <Bar dataKey="paidAmount" name="지급완료" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {payments.length === 0 && !loading ? <EmptyState message="지급 대상이 없습니다. 정산 확정 후 정산서 동기화를 실행하세요." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => payments.forEach((payment) => payment.id && toggleSelected(payment.id, event.target.checked))}
                      aria-label="전체 선택"
                    />
                  </th>
                  <th className="px-4 py-3">월</th>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3 text-right">지급금액</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">지급일</th>
                  <th className="px-4 py-3">계좌</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => {
                  const id = payment.id || '';
                  return (
                    <tr key={id || payment.settlementId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.includes(id)} disabled={!id} onChange={(event) => toggleSelected(id, event.target.checked)} aria-label={`${payment.referrerName} 선택`} />
                      </td>
                      <td className="px-4 py-3">{payment.yearMonth}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{payment.referrerName}</td>
                      <td className="px-4 py-3 text-right font-black">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={payment.paymentStatus} /></td>
                      <td className="px-4 py-3">{payment.paymentDate || '-'}</td>
                      <td className="px-4 py-3">{[payment.bankName, payment.accountNumber, payment.accountHolder].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="px-4 py-3">{payment.memo || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => approve(id)} disabled={!permissions.canManagePayments || !id || payment.paymentStatus !== 'pending'}>승인</Button>
                          <Button type="button" size="sm" onClick={() => pay(id, currentUser?.uid)} disabled={!permissions.canManagePayments || !id || !['pending', 'approved'].includes(payment.paymentStatus)}>지급</Button>
                          <Button type="button" size="sm" variant="danger" onClick={() => cancel(id)} disabled={!permissions.canManagePayments || !id || payment.paymentStatus === 'paid'}>취소</Button>
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

export default RecruitingPaymentsPage;
