import React, { useEffect, useState } from 'react';
import { useReferrers } from '../../hooks/useReferrers';
import Button from '../../components/ui/Button';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  PageHeader,
  StatusBadge,
  useRecruitingPermissions,
} from './RecruitingShared';
import type { RecruitingReferrer, RecruitingReferrerType } from '../../types/recruiting';

const emptyDraft: Partial<RecruitingReferrer> = {
  type: 'agency',
  name: '',
  contact: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  defaultIntroFeeIncomePerDay: 60000,
  defaultIntroFeePayoutPerDay: 60000,
  defaultIntroFeeMaxDays: 5,
  defaultDailyCommission: 5000,
  status: 'active',
  memo: '',
};

const typeLabel = (type: RecruitingReferrerType): string => ({
  agency: '소개소',
  worker: '작업자',
  office_staff: '사무실 직원',
  external: '외부인',
}[type]);

const RecruitingReferrersPage: React.FC = () => {
  const { referrers, loading, saving, error, save, remove } = useReferrers();
  const permissions = useRecruitingPermissions();
  const [draft, setDraft] = useState<Partial<RecruitingReferrer>>(emptyDraft);

  useEffect(() => {
    if (!draft.accountHolder && draft.name) {
      setDraft((prev) => ({ ...prev, accountHolder: prev.accountHolder || prev.name }));
    }
  }, [draft.name, draft.accountHolder]);

  const update = (key: keyof RecruitingReferrer, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!permissions.canManageReferrers) return;
    await save(draft);
    setDraft(emptyDraft);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="소개자 관리" description="소개소, 작업자, 사무실 직원 등 소개비 지급 대상자를 관리합니다." />
      <ErrorBox message={error} />

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select value={draft.type || 'agency'} onChange={(event) => update('type', event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="agency">소개소</option>
            <option value="worker">작업자</option>
            <option value="office_staff">사무실 직원</option>
            <option value="external">외부인</option>
          </select>
          <input value={draft.name || ''} onChange={(event) => update('name', event.target.value)} placeholder="소개자명" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={draft.contact || ''} onChange={(event) => update('contact', event.target.value)} placeholder="연락처" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={draft.status || 'active'} onChange={(event) => update('status', event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="active">사용</option>
            <option value="inactive">중지</option>
          </select>
          <input value={draft.bankName || ''} onChange={(event) => update('bankName', event.target.value)} placeholder="은행" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={draft.accountNumber || ''} onChange={(event) => update('accountNumber', event.target.value)} placeholder="계좌번호" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={draft.accountHolder || ''} onChange={(event) => update('accountHolder', event.target.value)} placeholder="예금주" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={draft.memo || ''} onChange={(event) => update('memo', event.target.value)} placeholder="메모" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" value={draft.defaultIntroFeeIncomePerDay || 0} onChange={(event) => update('defaultIntroFeeIncomePerDay', Number(event.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" value={draft.defaultIntroFeePayoutPerDay || 0} onChange={(event) => update('defaultIntroFeePayoutPerDay', Number(event.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" value={draft.defaultIntroFeeMaxDays || 0} onChange={(event) => update('defaultIntroFeeMaxDays', Number(event.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" value={draft.defaultDailyCommission || 0} onChange={(event) => update('defaultDailyCommission', Number(event.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDraft(emptyDraft)}>초기화</Button>
          <Button type="submit" disabled={!permissions.canManageReferrers} isLoading={saving}>{draft.id ? '수정 저장' : '소개자 등록'}</Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {referrers.length === 0 && !loading ? <EmptyState message="등록된 소개자가 없습니다." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3">연락처</th>
                  <th className="px-4 py-3">계좌</th>
                  <th className="px-4 py-3 text-right">수입/일</th>
                  <th className="px-4 py-3 text-right">지급/일</th>
                  <th className="px-4 py-3 text-right">수수료/일</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{typeLabel(row.type)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{row.name}</td>
                    <td className="px-4 py-3">{row.contact || '-'}</td>
                    <td className="px-4 py-3">{[row.bankName, row.accountNumber, row.accountHolder].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.defaultIntroFeeIncomePerDay)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.defaultIntroFeePayoutPerDay)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.defaultDailyCommission)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(row)}>수정</Button>
                        <Button type="button" variant="danger" size="sm" disabled={!permissions.canManageReferrers} onClick={() => row.id && remove(row.id)}>삭제</Button>
                      </div>
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

export default RecruitingReferrersPage;
