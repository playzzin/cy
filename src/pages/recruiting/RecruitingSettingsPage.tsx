import React, { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import { serviceWorkerReferralService } from '../../services/serviceWorkerReferralService';
import { DEFAULT_SERVICE_REFERRAL_SETTINGS, ServiceReferralSettings } from '../../types/recruiting';
import { ErrorBox, formatCurrency, PageHeader, useRecruitingPermissions } from './RecruitingShared';

const RecruitingSettingsPage: React.FC = () => {
  const permissions = useRecruitingPermissions();
  const [settings, setSettings] = useState<ServiceReferralSettings>(DEFAULT_SERVICE_REFERRAL_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await serviceWorkerReferralService.getSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const update = (key: keyof ServiceReferralSettings, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!permissions.canManageSettings) return;
    setSaving(true);
    try {
      await serviceWorkerReferralService.saveSettings({
        ...settings,
        introFeeIncomePerDay: Number(settings.introFeeIncomePerDay || 0),
        introFeePayoutPerDay: Number(settings.introFeePayoutPerDay || 0),
        introFeeMaxDays: Number(settings.introFeeMaxDays || 0),
        dailyCommissionPerDay: Number(settings.dailyCommissionPerDay || 0),
        confirmAfterWorkDays: Number(settings.confirmAfterWorkDays || 0),
        countMode: 'unique_work_date',
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="수익모델 관리" description="소개비 수입, 소개비 지급, 일일수수료, 확정 조건을 관리합니다." />
      <ErrorBox message={error} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-500">소개비 수입/일</span>
            <input type="number" value={settings.introFeeIncomePerDay} onChange={(event) => update('introFeeIncomePerDay', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">소개비 지급/일</span>
            <input type="number" value={settings.introFeePayoutPerDay} onChange={(event) => update('introFeePayoutPerDay', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">소개비 최대 인정일</span>
            <input type="number" value={settings.introFeeMaxDays} onChange={(event) => update('introFeeMaxDays', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">일일 수수료</span>
            <input type="number" value={settings.dailyCommissionPerDay} onChange={(event) => update('dailyCommissionPerDay', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">확정 기준 근무일</span>
            <input type="number" value={settings.confirmAfterWorkDays} onChange={(event) => update('confirmAfterWorkDays', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">일수 계산 방식</span>
            <input value="동일 날짜 다중 출력 1일 1회 인정" readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
          </label>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          현재 기본 모델은 소개비 수입 {formatCurrency(settings.introFeeIncomePerDay)} × 최대 {settings.introFeeMaxDays}일,
          소개비 지급 {formatCurrency(settings.introFeePayoutPerDay)} × 최대 {settings.introFeeMaxDays}일,
          일일수수료 {formatCurrency(settings.dailyCommissionPerDay)} × 실제 근무일입니다.
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={refresh} isLoading={loading}>다시 불러오기</Button>
          <Button type="button" onClick={save} isLoading={saving} disabled={!permissions.canManageSettings}>설정 저장</Button>
        </div>
      </div>
    </div>
  );
};

export default RecruitingSettingsPage;
