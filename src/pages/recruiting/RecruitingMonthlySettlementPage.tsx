import React, { useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { useMonthlySettlement } from '../../hooks/useMonthlySettlement';
import { useAuth } from '../../contexts/AuthContext';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  MonthToolbar,
  PageHeader,
  StatusBadge,
  useRecruitingPermissions,
} from './RecruitingShared';
import type { ServiceReferralMonthlySettlement } from '../../types/recruiting';

const RecruitingMonthlySettlementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const permissions = useRecruitingPermissions();
  const {
    yearMonth,
    setYearMonth,
    settlements,
    lines,
    loading,
    saving,
    error,
    refresh,
    calculate,
    updateSettlement,
    confirm,
    markPaid,
    overrideDailyLine,
    downloadMonthlyExcel,
    downloadReferrerExcel,
  } = useMonthlySettlement();
  const [drafts, setDrafts] = useState<Record<string, Partial<ServiceReferralMonthlySettlement>>>({});

  const totals = useMemo(() => ({
    income: settlements.reduce((sum, item) => sum + Number(item.introIncomeTotal || 0), 0),
    payout: settlements.reduce((sum, item) => sum + Number(item.introPayoutTotal || 0), 0),
    commission: settlements.reduce((sum, item) => sum + Number(item.dailyCommissionTotal || 0), 0),
    payable: settlements.reduce((sum, item) => sum + Number(item.payableTotal || 0), 0),
    net: settlements.reduce((sum, item) => sum + Number(item.netProfit || 0), 0),
  }), [settlements]);

  const updateDraft = (id: string, key: keyof ServiceReferralMonthlySettlement, value: unknown) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  };

  const saveSettlementDraft = async (row: ServiceReferralMonthlySettlement) => {
    if (!row.id) return;
    const draft = drafts[row.id] || {};
    await updateSettlement(row.id, {
      adjustmentAmount: Number(draft.adjustmentAmount ?? row.adjustmentAmount),
      memo: String(draft.memo ?? row.memo ?? ''),
      payableTotal: row.introPayoutTotal + row.dailyCommissionTotal + Number(draft.adjustmentAmount ?? row.adjustmentAmount),
      netProfit: row.introIncomeTotal - row.introPayoutTotal - row.dailyCommissionTotal - Number(draft.adjustmentAmount ?? row.adjustmentAmount),
    });
    setDrafts((prev) => ({ ...prev, [row.id || '']: {} }));
  };

  const handleOverride = async (lineId: string, currentPayout: number, currentCommission: number) => {
    const payout = window.prompt('소개비 지급액을 입력하세요.', String(currentPayout));
    if (payout === null) return;
    const commission = window.prompt('일일수수료를 입력하세요.', String(currentCommission));
    if (commission === null) return;
    const reason = window.prompt('수정 사유를 입력하세요.', '정산 금액 수동 수정') || '정산 금액 수동 수정';
    await overrideDailyLine(lineId, {
      introPayoutAmount: Number(payout || 0),
      dailyCommissionAmount: Number(commission || 0),
      reason,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="월별 정산" description="소개자별 정산을 생성하고 확정·지급 완료까지 처리합니다." />
      <MonthToolbar
        yearMonth={yearMonth}
        onChange={setYearMonth}
        onRefresh={refresh}
        loading={loading}
        actions={(
          <>
            <Button type="button" onClick={calculate} isLoading={saving} disabled={!permissions.canSettle}>정산 생성/재계산</Button>
            <Button type="button" variant="secondary" onClick={downloadMonthlyExcel}>월별 정산서</Button>
          </>
        )}
      />
      <ErrorBox message={error} />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-700"><div className="text-xs font-bold">수입</div><div className="text-xl font-black">{formatCurrency(totals.income)}</div></div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-orange-700"><div className="text-xs font-bold">소개비 지급</div><div className="text-xl font-black">{formatCurrency(totals.payout)}</div></div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-orange-700"><div className="text-xs font-bold">일일수수료</div><div className="text-xl font-black">{formatCurrency(totals.commission)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700"><div className="text-xs font-bold">지급액</div><div className="text-xl font-black">{formatCurrency(totals.payable)}</div></div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700"><div className="text-xs font-bold">순수익</div><div className="text-xl font-black">{formatCurrency(totals.net)}</div></div>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {settlements.length === 0 ? <EmptyState message="정산 데이터가 없습니다. 정산 생성/재계산을 실행하세요." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1300px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3 text-right">인원</th>
                  <th className="px-4 py-3 text-right">근무일</th>
                  <th className="px-4 py-3 text-right">수입</th>
                  <th className="px-4 py-3 text-right">소개비</th>
                  <th className="px-4 py-3 text-right">수수료</th>
                  <th className="px-4 py-3 text-right">조정</th>
                  <th className="px-4 py-3 text-right">지급액</th>
                  <th className="px-4 py-3 text-right">순수익</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((row) => {
                  const id = row.id || '';
                  const draft = drafts[id] || {};
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">{row.referrerName}</td>
                      <td className="px-4 py-3 text-right">{row.totalWorkers}</td>
                      <td className="px-4 py-3 text-right">{row.totalWorkDays}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.introIncomeTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.introPayoutTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.dailyCommissionTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" value={draft.adjustmentAmount ?? row.adjustmentAmount} onChange={(event) => updateDraft(id, 'adjustmentAmount', Number(event.target.value))} className="w-28 rounded border border-slate-300 px-2 py-1 text-right" />
                      </td>
                      <td className="px-4 py-3 text-right font-black">{formatCurrency(row.payableTotal)}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-700">{formatCurrency(row.netProfit)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <input value={draft.memo ?? row.memo ?? ''} onChange={(event) => updateDraft(id, 'memo', event.target.value)} className="w-40 rounded border border-slate-300 px-2 py-1" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => saveSettlementDraft(row)} disabled={!permissions.canSettle}>저장</Button>
                          <Button type="button" size="sm" onClick={() => id && confirm(id, currentUser?.uid)} disabled={!permissions.canSettle || row.status === 'paid'}>확정</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => id && markPaid(id, currentUser?.uid)} disabled={!permissions.canSettle || row.status !== 'confirmed'}>지급</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => downloadReferrerExcel(row.referrerId)}>엑셀</Button>
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-800">작업자별 상세 라인</div>
        {lines.length === 0 ? <EmptyState message="정산 상세 라인이 없습니다." /> : (
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-[1300px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3">작업자</th>
                  <th className="px-4 py-3">현장</th>
                  <th className="px-4 py-3 text-right">공수</th>
                  <th className="px-4 py-3 text-right">일차</th>
                  <th className="px-4 py-3 text-right">수입</th>
                  <th className="px-4 py-3 text-right">지급</th>
                  <th className="px-4 py-3 text-right">수수료</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{line.date}</td>
                    <td className="px-4 py-3">{line.referrerName}</td>
                    <td className="px-4 py-3 font-semibold">{line.workerName}</td>
                    <td className="px-4 py-3">{line.siteNames.join(', ') || '-'}</td>
                    <td className="px-4 py-3 text-right">{line.manDay}</td>
                    <td className="px-4 py-3 text-right">{line.introDayIndex || '-'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(line.introIncomeAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(line.introPayoutAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(line.dailyCommissionAmount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={line.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" size="sm" variant="secondary" disabled={!permissions.canSettle || !line.id} onClick={() => line.id && handleOverride(line.id, line.introPayoutAmount, line.dailyCommissionAmount)}>금액 수정</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitingMonthlySettlementPage;
