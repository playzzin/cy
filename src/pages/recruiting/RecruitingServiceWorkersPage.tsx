import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { useReferrers } from '../../hooks/useReferrers';
import { useServiceWorkers } from '../../hooks/useServiceWorkers';
import { settlementTargetService, type SettlementTarget } from '../../services/settlementTargetService';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  PageHeader,
  StatusBadge,
  useRecruitingPermissions,
} from './RecruitingShared';
import type { ServiceWorkerCandidate, ServiceWorkerReferral } from '../../types/recruiting';

type ReferrerSelectionOption = {
  key: string;
  label: string;
  referrerId?: string;
  settlementTargetId?: string;
};

const getSettlementTargetLabel = (target: SettlementTarget): string =>
  `${target.name}${target.companyName ? ` · ${target.companyName}` : ''} · 정산 대상자`;

const getCandidateSourceLabel = (candidate: ServiceWorkerCandidate): string => {
  if (candidate.source === 'daily_reports') return '출력일보';
  if (candidate.source === 'merged') return '통합DB+출력일보';
  return '통합DB';
};

const getCandidateWorkLabel = (candidate: ServiceWorkerCandidate): string => {
  if (!candidate.firstWorkDate) return '';
  const lastDate = candidate.lastWorkDate && candidate.lastWorkDate !== candidate.firstWorkDate
    ? `~${candidate.lastWorkDate}`
    : '';
  return `${candidate.firstWorkDate}${lastDate} · ${candidate.workDays || 0}일`;
};

const RecruitingServiceWorkersPage: React.FC = () => {
  const {
    candidates,
    referrals,
    loading: serviceWorkersLoading,
    saving,
    error: serviceWorkersError,
    refresh: refreshServiceWorkers,
    createReferral,
    updateReferral,
    stopReferral,
  } = useServiceWorkers();
  const {
    referrers,
    loading: referrersLoading,
    error: referrersError,
    refresh: refreshReferrers,
  } = useReferrers();
  const permissions = useRecruitingPermissions();
  const [workerId, setWorkerId] = useState('');
  const [referrerSelection, setReferrerSelection] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Partial<ServiceWorkerReferral>>>({});
  const [settlementTargets, setSettlementTargets] = useState<SettlementTarget[]>([]);
  const [settlementTargetsLoading, setSettlementTargetsLoading] = useState(false);
  const [settlementTargetsError, setSettlementTargetsError] = useState<string | null>(null);

  const refreshSettlementTargets = useCallback(async () => {
    setSettlementTargetsLoading(true);
    setSettlementTargetsError(null);
    try {
      setSettlementTargets(await settlementTargetService.getTargets(true));
    } catch (err) {
      setSettlementTargetsError(err instanceof Error ? err.message : String(err));
    } finally {
      setSettlementTargetsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refreshServiceWorkers(),
      refreshReferrers(),
      refreshSettlementTargets(),
    ]);
  }, [refreshServiceWorkers, refreshReferrers, refreshSettlementTargets]);
  const loading = serviceWorkersLoading || referrersLoading || settlementTargetsLoading;
  const error = serviceWorkersError || referrersError || settlementTargetsError;
  const refresh = handleRefresh;

  useEffect(() => {
    void refreshSettlementTargets();
  }, [refreshSettlementTargets]);

  const availableCandidates = useMemo(
    () => candidates.filter((candidate) => !candidate.existingReferral || candidate.existingReferral.status === 'closed'),
    [candidates]
  );
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.workerId === workerId || candidate.workerName === workerId),
    [candidates, workerId]
  );
  const candidateSummary = useMemo(() => ({
    total: candidates.length,
    dailyReport: candidates.filter((candidate) => candidate.source === 'daily_reports').length,
    merged: candidates.filter((candidate) => candidate.source === 'merged').length,
    linked: candidates.filter((candidate) => candidate.existingReferral && candidate.existingReferral.status !== 'closed').length,
  }), [candidates]);
  const referrerOptions = useMemo<ReferrerSelectionOption[]>(() => {
    const targetById = new Map(
      settlementTargets
        .filter((target) => target.id && target.status === 'active')
        .map((target) => [target.id as string, target])
    );
    const linkedTargetIds = new Set<string>();
    const options: ReferrerSelectionOption[] = [];

    referrers
      .filter((referrer) => referrer.id && referrer.status === 'active')
      .forEach((referrer) => {
        const linkedTarget = referrer.linkedEntityId ? targetById.get(referrer.linkedEntityId) : undefined;
        if (linkedTarget?.id) linkedTargetIds.add(linkedTarget.id);
        options.push({
          key: `referrer:${referrer.id}`,
          referrerId: referrer.id,
          label: `${referrer.name}${linkedTarget ? ' · 정산 대상자' : ' · 소개자'}`,
        });
      });

    settlementTargets
      .filter((target) => target.id && target.status === 'active' && target.name && !linkedTargetIds.has(target.id))
      .forEach((target) => {
        options.push({
          key: `settlement-target:${target.id}`,
          settlementTargetId: target.id,
          label: getSettlementTargetLabel(target),
        });
      });

    return options.sort((left, right) => left.label.localeCompare(right.label, 'ko'));
  }, [referrers, settlementTargets]);
  const selectedReferrerOption = useMemo(
    () => referrerOptions.find((option) => option.key === referrerSelection) || null,
    [referrerOptions, referrerSelection]
  );

  const handleWorkerChange = (value: string) => {
    setWorkerId(value);
    const candidate = candidates.find((item) => item.workerId === value || item.workerName === value);
    if (candidate?.firstWorkDate) setStartDate(candidate.firstWorkDate);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workerId || !selectedReferrerOption || !permissions.canRegister) return;
    await createReferral({
      workerId,
      referrerId: selectedReferrerOption.referrerId,
      settlementTargetId: selectedReferrerOption.settlementTargetId,
      startDate,
      memo,
    });
    setWorkerId('');
    setReferrerSelection('');
    setMemo('');
  };

  const updateDraft = (id: string, key: keyof ServiceWorkerReferral, value: unknown) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value,
      },
    }));
  };

  const saveDraft = async (row: ServiceWorkerReferral) => {
    if (!row.id) return;
    const draft = drafts[row.id] || {};
    await updateReferral(row.id, {
      ...draft,
      introFeeIncomePerDay: Number(draft.introFeeIncomePerDay ?? row.introFeeIncomePerDay),
      introFeePayoutPerDay: Number(draft.introFeePayoutPerDay ?? row.introFeePayoutPerDay),
      introFeeMaxDays: Number(draft.introFeeMaxDays ?? row.introFeeMaxDays),
      dailyCommissionPerDay: Number(draft.dailyCommissionPerDay ?? row.dailyCommissionPerDay),
    });
    setDrafts((prev) => ({ ...prev, [row.id || '']: {} }));
  };

  const handleStop = async (row: ServiceWorkerReferral) => {
    if (!row.id) return;
    const stopDate = window.prompt('정산 중지일을 입력하세요. (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
    if (!stopDate) return;
    const reason = window.prompt('정산 중지 사유를 입력하세요.', '퇴사/팀변경/급여구분변경') || '정산 중지';
    await stopReferral(row.id, stopDate, reason);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader
        title="용역 등록/수정"
        description="통합DB의 용역팀 작업자와 소개자를 연결하고 정산 요율을 관리합니다."
        right={<Button type="button" variant="secondary" onClick={refresh} isLoading={loading}>새로고침</Button>}
      />
      <ErrorBox message={error} />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">등록 가능 후보</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{candidateSummary.total}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">출력일보 반영</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{candidateSummary.dailyReport}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">DB 병합 후보</div>
          <div className="mt-1 text-xl font-bold text-indigo-700">{candidateSummary.merged}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">이미 연결</div>
          <div className="mt-1 text-xl font-bold text-slate-700">{candidateSummary.linked}</div>
        </div>
      </div>

      <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select value={workerId} onChange={(event) => handleWorkerChange(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">용역팀 작업자 선택</option>
            {availableCandidates.map((candidate) => (
              <option key={candidate.workerId} value={candidate.workerId}>
                {candidate.workerName} · {candidate.teamName || '팀 미지정'} · {getCandidateSourceLabel(candidate)} {getCandidateWorkLabel(candidate)}
              </option>
            ))}
          </select>
          <select value={referrerSelection} onChange={(event) => setReferrerSelection(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">소개자 선택</option>
            {referrerOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="메모" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {selectedCandidate && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold">{getCandidateSourceLabel(selectedCandidate)}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span>근무이력 {getCandidateWorkLabel(selectedCandidate) || '-'}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span>현장 {(selectedCandidate.siteNames || []).slice(0, 3).join(', ') || '-'}</span>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={!permissions.canRegister || !workerId || !selectedReferrerOption} isLoading={saving}>용역 소개 연결</Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {referrals.length === 0 && !loading ? <EmptyState message="등록된 용역 소개 연결이 없습니다." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">작업자</th>
                  <th className="px-4 py-3">소개자</th>
                  <th className="px-4 py-3">시작/중지</th>
                  <th className="px-4 py-3 text-right">수입/일</th>
                  <th className="px-4 py-3 text-right">지급/일</th>
                  <th className="px-4 py-3 text-right">최대일</th>
                  <th className="px-4 py-3 text-right">수수료/일</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map((row) => {
                  const id = row.id || '';
                  const draft = drafts[id] || {};
                  return (
                    <tr key={id || `${row.workerId}:${row.referrerId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{row.workerName}</div>
                        <div className="text-xs text-slate-500">{row.workerTeamName || '-'}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{row.referrerName}</td>
                      <td className="px-4 py-3">
                        <div>{row.startDate}</div>
                        <div className="text-xs text-rose-600">{row.stopDate || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" value={draft.introFeeIncomePerDay ?? row.introFeeIncomePerDay} onChange={(event) => updateDraft(id, 'introFeeIncomePerDay', Number(event.target.value))} className="w-28 rounded border border-slate-300 px-2 py-1 text-right" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" value={draft.introFeePayoutPerDay ?? row.introFeePayoutPerDay} onChange={(event) => updateDraft(id, 'introFeePayoutPerDay', Number(event.target.value))} className="w-28 rounded border border-slate-300 px-2 py-1 text-right" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" value={draft.introFeeMaxDays ?? row.introFeeMaxDays} onChange={(event) => updateDraft(id, 'introFeeMaxDays', Number(event.target.value))} className="w-20 rounded border border-slate-300 px-2 py-1 text-right" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" value={draft.dailyCommissionPerDay ?? row.dailyCommissionPerDay} onChange={(event) => updateDraft(id, 'dailyCommissionPerDay', Number(event.target.value))} className="w-28 rounded border border-slate-300 px-2 py-1 text-right" />
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <input value={draft.memo ?? row.memo ?? ''} onChange={(event) => updateDraft(id, 'memo', event.target.value)} className="w-48 rounded border border-slate-300 px-2 py-1" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" disabled={!permissions.canRegister} onClick={() => saveDraft(row)}>저장</Button>
                          <Button type="button" size="sm" variant="danger" disabled={!permissions.canRegister || row.status === 'stopped'} onClick={() => handleStop(row)}>중지</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <td className="px-4 py-3" colSpan={10}>
                    기본 정산: 소개비 수입 {formatCurrency(60000)} × 최대 5일, 소개비 지급 {formatCurrency(60000)} × 최대 5일, 일일수수료 {formatCurrency(5000)} × 실제 근무일
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitingServiceWorkersPage;
