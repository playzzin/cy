import React from 'react';
import { useRecruitingDashboard } from '../../hooks/useRecruitingDashboard';
import {
  ErrorBox,
  formatCurrency,
  formatNumber,
  MonthToolbar,
  PageHeader,
  StatCard,
} from './RecruitingShared';

const RecruitingDashboardPage: React.FC = () => {
  const { yearMonth, setYearMonth, summary, loading, error, refresh } = useRecruitingDashboard();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader
        title="소개소 현황판"
        description="출력일보 기반 용역팀 소개비와 일일수수료 정산 현황을 확인합니다."
      />
      <MonthToolbar yearMonth={yearMonth} onChange={setYearMonth} onRefresh={refresh} loading={loading} />
      <ErrorBox message={error} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="이번달 소개비 수입" value={formatCurrency(summary?.introIncomeTotal)} tone="blue" />
        <StatCard label="이번달 소개비 지급" value={formatCurrency(summary?.introPayoutTotal)} tone="orange" />
        <StatCard label="이번달 일일수수료" value={formatCurrency(summary?.dailyCommissionTotal)} tone="orange" />
        <StatCard label="이번달 순수익" value={formatCurrency(summary?.netProfit)} tone="green" />
        <StatCard label="5일 달성 예정자" value={`${formatNumber(summary?.pendingWorkerCount)}명`} note="현재 pending 라인 보유 작업자" tone="slate" />
        <StatCard label="정산 중지 대상" value={`${formatNumber(summary?.stoppedCandidateCount)}명`} note="퇴사/급여구분 변경/수동중지 포함" tone="rose" />
        <StatCard label="지급 예정 건수" value={`${formatNumber(summary?.payableSettlementCount)}건`} tone="blue" />
        <StatCard label="지급 완료 건수" value={`${formatNumber(summary?.paidSettlementCount)}건`} tone="green" />
      </div>
    </div>
  );
};

export default RecruitingDashboardPage;
