import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Button from '../../components/ui/Button';
import { useReferralDeposits } from '../../hooks/useReferralDeposits';
import { useReferrers } from '../../hooks/useReferrers';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  MonthToolbar,
  PageHeader,
  StatCard,
  StatusBadge,
  useRecruitingPermissions,
} from './RecruitingShared';
import type { ServiceReferralDeposit } from '../../types/recruiting';

const emptyDraft: Partial<ServiceReferralDeposit> = {
  referrerId: '',
  referrerName: '',
  expectedAmount: 0,
  depositAmount: 0,
  depositDate: new Date().toISOString().slice(0, 10),
  evidenceFileUrl: '',
  memo: '',
};

const RecruitingDepositsPage: React.FC = () => {
  const permissions = useRecruitingPermissions();
  const { referrers } = useReferrers();
  const {
    yearMonth,
    setYearMonth,
    verified,
    setVerified,
    deposits,
    summary,
    trend,
    loading,
    saving,
    error,
    refresh,
    sync,
    saveDeposit,
    verifyDeposit,
    cancelDeposit,
    uploadEvidence,
    downloadExcel,
  } = useReferralDeposits();
  const [draft, setDraft] = useState<Partial<ServiceReferralDeposit>>(emptyDraft);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const activeReferrers = useMemo(() => referrers.filter((row) => row.status === 'active'), [referrers]);

  const updateDraft = (key: keyof ServiceReferralDeposit, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectReferrer = (referrerId: string) => {
    const referrer = activeReferrers.find((row) => row.id === referrerId);
    setDraft((prev) => ({
      ...prev,
      referrerId,
      referrerName: referrer?.name || '',
    }));
  };

  const submitDeposit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!permissions.canManageDeposits) return;
    let evidenceFileUrl = draft.evidenceFileUrl || '';
    if (evidenceFile) {
      evidenceFileUrl = await uploadEvidence(evidenceFile, draft.id || draft.depositId);
    }
    await saveDeposit({
      ...draft,
      yearMonth,
      expectedAmount: Number(draft.expectedAmount || 0),
      depositAmount: Number(draft.depositAmount || 0),
      evidenceFileUrl,
    });
    setDraft(emptyDraft);
    setEvidenceFile(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="입금관리" description="소개비 수입 예정액과 실제 입금을 확인하고 차액 발생 시 미수금을 자동 생성합니다." />
      <MonthToolbar
        yearMonth={yearMonth}
        onChange={setYearMonth}
        onRefresh={refresh}
        loading={loading}
        actions={(
          <>
            <select value={String(verified)} onChange={(event) => setVerified(event.target.value === 'all' ? 'all' : event.target.value === 'true')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">전체</option>
              <option value="false">미확인</option>
              <option value="true">확인</option>
            </select>
            <Button type="button" variant="secondary" onClick={sync} isLoading={saving} disabled={!permissions.canManageDeposits}>예정입금 동기화</Button>
            <Button type="button" variant="secondary" onClick={downloadExcel}>Excel</Button>
          </>
        )}
      />
      <ErrorBox message={error} />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="금월 예정입금" value={formatCurrency(summary?.expectedAmount)} tone="blue" />
        <StatCard label="금월 실제입금" value={formatCurrency(summary?.depositAmount)} tone="green" note={`입금률 ${summary?.depositRate || 0}%`} />
        <StatCard label="차액" value={formatCurrency(summary?.differenceAmount)} tone={(summary?.differenceAmount || 0) > 0 ? 'rose' : 'slate'} note={`${summary?.verifiedCount || 0}건 확인`} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submitDeposit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-black text-slate-800">{draft.id ? '입금 수정' : '입금 등록'}</div>
          <div className="space-y-3">
            <select value={draft.referrerId || ''} onChange={(event) => selectReferrer(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">소개자 선택</option>
              {activeReferrers.map((referrer) => <option key={referrer.id} value={referrer.id}>{referrer.name}</option>)}
            </select>
            <input value={draft.referrerName || ''} onChange={(event) => updateDraft('referrerName', event.target.value)} placeholder="소개자명" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" value={draft.expectedAmount || 0} onChange={(event) => updateDraft('expectedAmount', Number(event.target.value))} placeholder="예정입금" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" value={draft.depositAmount || 0} onChange={(event) => updateDraft('depositAmount', Number(event.target.value))} placeholder="실제입금" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="date" value={draft.depositDate || ''} onChange={(event) => updateDraft('depositDate', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="file" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={draft.memo || ''} onChange={(event) => updateDraft('memo', event.target.value)} placeholder="메모" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { setDraft(emptyDraft); setEvidenceFile(null); }}>초기화</Button>
              <Button type="submit" isLoading={saving} disabled={!permissions.canManageDeposits}>저장</Button>
            </div>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-black text-slate-800">입금 추이</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="expectedAmount" name="예정입금" stroke="#2563EB" strokeWidth={2} />
                <Line type="monotone" dataKey="depositAmount" name="실제입금" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {deposits.length === 0 && !loading ? <EmptyState message="입금 데이터가 없습니다. 예정입금 동기화 또는 입금 등록을 실행하세요." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">월</th>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3 text-right">예정입금</th>
                  <th className="px-4 py-3 text-right">실제입금</th>
                  <th className="px-4 py-3 text-right">차액</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">입금일</th>
                  <th className="px-4 py-3">증빙</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deposits.map((deposit) => {
                  const id = deposit.id || '';
                  const status = deposit.cancelled ? 'cancelled' : deposit.verified ? 'verified' : 'pending';
                  return (
                    <tr key={id || `${deposit.yearMonth}:${deposit.referrerId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{deposit.yearMonth}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{deposit.referrerName}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(deposit.expectedAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(deposit.depositAmount)}</td>
                      <td className="px-4 py-3 text-right font-black">{formatCurrency(deposit.difference)}</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3">{deposit.depositDate || '-'}</td>
                      <td className="px-4 py-3">{deposit.evidenceFileUrl ? <a className="font-semibold text-indigo-600" href={deposit.evidenceFileUrl} target="_blank" rel="noreferrer">보기</a> : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => setDraft(deposit)}>수정</Button>
                          <Button type="button" size="sm" onClick={() => verifyDeposit(id)} disabled={!permissions.canManageDeposits || !id || deposit.verified || deposit.cancelled}>확인</Button>
                          <Button type="button" size="sm" variant="danger" onClick={() => cancelDeposit(id)} disabled={!permissions.canManageDeposits || !id || deposit.cancelled}>취소</Button>
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

export default RecruitingDepositsPage;
