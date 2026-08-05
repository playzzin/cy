import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faCheck,
  faCircleExclamation,
  faFileInvoiceDollar,
  faFilter,
  faHandHoldingDollar,
  faRotateRight,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { settlementAlertService } from '../../services/settlementAlertService';
import {
  normalizeYearMonth,
  summarizeSettlementAlerts,
} from '../../features/settlement-alerts/settlementAlertRules';
import type {
  SettlementAlertDomain,
  SettlementAlertSeverity,
  SettlementAlertStateStatus,
  SettlementAlertWithState,
} from '../../features/settlement-alerts/settlementAlertTypes';

type AlertFilter = 'all' | 'risk' | 'receivable' | 'payable' | 'billing' | 'data' | 'resolved';
type DomainFilter = 'all' | SettlementAlertDomain;

const filterOptions: Array<{ value: AlertFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'risk', label: '고위험' },
  { value: 'receivable', label: '받을 돈' },
  { value: 'payable', label: '내야 할 돈' },
  { value: 'billing', label: '미확정 청구' },
  { value: 'data', label: '데이터 누락' },
  { value: 'resolved', label: '해결됨' },
];

const domainOptions: Array<{ value: DomainFilter; label: string }> = [
  { value: 'all', label: '전체 영역' },
  { value: 'tax', label: '세금계산서' },
  { value: 'expense', label: '경비' },
  { value: 'vehicle', label: '차량' },
  { value: 'card', label: '카드' },
  { value: 'accommodation', label: '숙소' },
  { value: 'support', label: '지원공수' },
];

const domainLabels: Record<SettlementAlertDomain, string> = {
  tax: '세금계산서',
  expense: '경비',
  vehicle: '차량',
  card: '카드',
  accommodation: '숙소',
  support: '지원공수',
};

const severityLabels: Record<SettlementAlertSeverity, string> = {
  critical: '긴급',
  high: '주의',
  medium: '확인',
  low: '낮음',
};

const statusLabels: Record<SettlementAlertStateStatus, string> = {
  open: '미처리',
  acknowledged: '확인',
  snoozed: '보류',
  resolved: '해결',
};

const severityClasses: Record<SettlementAlertSeverity, string> = {
  critical: 'bg-rose-50 text-rose-700 ring-rose-200',
  high: 'bg-amber-50 text-amber-700 ring-amber-200',
  medium: 'bg-sky-50 text-sky-700 ring-sky-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const statusClasses: Record<SettlementAlertStateStatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  acknowledged: 'bg-blue-50 text-blue-700',
  snoozed: 'bg-violet-50 text-violet-700',
  resolved: 'bg-emerald-50 text-emerald-700',
};

const formatCurrency = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
};

const directionLabel = (alert: SettlementAlertWithState): string => {
  if (alert.direction === 'receivable') return '받을 돈';
  if (alert.direction === 'payable') return '내야 할 돈';
  return '확인 필요';
};

const alertMatchesFilter = (alert: SettlementAlertWithState, filter: AlertFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'risk') return alert.severity === 'critical' || alert.severity === 'high';
  if (filter === 'receivable') return alert.direction === 'receivable';
  if (filter === 'payable') return alert.direction === 'payable';
  if (filter === 'billing') return alert.type === 'missing_billing' || alert.type === 'unconfirmed_billing';
  if (filter === 'data') return alert.type === 'data_gap' || alert.type === 'amount_anomaly';
  return alert.stateStatus === 'resolved';
};

const StatTile: React.FC<{
  label: string;
  value: string;
  caption: string;
  icon: IconDefinition;
  tone: 'rose' | 'amber' | 'emerald' | 'sky';
}> = ({ label, value, caption, icon, tone }) => {
  const toneClasses = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-black tabular-nums text-slate-950">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClasses}`}>
          <FontAwesomeIcon icon={icon} />
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{caption}</p>
    </div>
  );
};

const EmptyState: React.FC<{ loading: boolean }> = ({ loading }) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center">
    <FontAwesomeIcon
      icon={loading ? faRotateRight : faCheck}
      className={`text-3xl ${loading ? 'animate-spin text-slate-400' : 'text-emerald-500'}`}
    />
    <p className="mt-4 text-base font-bold text-slate-800">
      {loading ? '정산 경고를 불러오는 중입니다.' : '표시할 정산 경고가 없습니다.'}
    </p>
  </div>
);

const SettlementAlertCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [yearMonth, setYearMonth] = useState(() => normalizeYearMonth(new Date()));
  const [alerts, setAlerts] = useState<SettlementAlertWithState[]>([]);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await settlementAlertService.getAlerts({ yearMonth, includeResolved });
      setAlerts(result.alerts);
    } catch (loadError) {
      console.error('Failed to load settlement alerts:', loadError);
      setError(loadError instanceof Error ? loadError.message : '정산 경고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [includeResolved, yearMonth]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const summary = useMemo(() => summarizeSettlementAlerts(alerts), [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (domainFilter !== 'all' && alert.domain !== domainFilter) return false;
      return alertMatchesFilter(alert, filter);
    });
  }, [alerts, domainFilter, filter]);

  const updateAlertStatus = async (
    alert: SettlementAlertWithState,
    status: SettlementAlertStateStatus
  ) => {
    setUpdatingId(alert.id);
    setError('');
    try {
      await settlementAlertService.updateAlertState(alert.id, {
        yearMonth: alert.yearMonth,
        status,
        updatedBy: currentUser?.uid,
        updatedByName: currentUser?.displayName || currentUser?.email || undefined,
      });
      await loadAlerts();
    } catch (updateError) {
      console.error('Failed to update settlement alert:', updateError);
      setError(updateError instanceof Error ? updateError.message : '정산 경고 상태를 저장하지 못했습니다.');
    } finally {
      setUpdatingId(null);
    }
  };

  const openSource = (alert: SettlementAlertWithState) => {
    if (!alert.actionUrl) return;
    navigate(alert.actionUrl);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase text-rose-600">Settlement Alert Center</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
              정산 누락/이상금액 경고센터
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              지원공수, 차량, 숙소, 카드, 경비, 세금계산서에서 받을 돈과 내야 할 돈의 위험 신호를 모아 봅니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
              <span className="whitespace-nowrap">월</span>
              <input
                type="month"
                value={yearMonth}
                onChange={(event) => setYearMonth(event.target.value)}
                className="min-w-[140px] border-0 bg-transparent text-sm font-bold text-slate-900 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadAlerts()}
              disabled={loading}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <FontAwesomeIcon icon={faRotateRight} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="열린 경고"
            value={`${summary.openCount.toLocaleString('ko-KR')}건`}
            caption={`전체 ${summary.total.toLocaleString('ko-KR')}건 중 미처리`}
            icon={faTriangleExclamation}
            tone="rose"
          />
          <StatTile
            label="받아야 할 돈"
            value={formatCurrency(summary.receivableAmount)}
            caption="미수금과 미확정 청구 기준"
            icon={faHandHoldingDollar}
            tone="emerald"
          />
          <StatTile
            label="내야 할 돈"
            value={formatCurrency(summary.payableAmount)}
            caption="과입금 등 지급 방향 항목"
            icon={faFileInvoiceDollar}
            tone="amber"
          />
          <StatTile
            label="미확정 청구"
            value={`${summary.unconfirmedCount.toLocaleString('ko-KR')}건`}
            caption={`긴급 ${summary.critical.toLocaleString('ko-KR')}건 · 주의 ${summary.high.toLocaleString('ko-KR')}건`}
            icon={faCircleExclamation}
            tone="sky"
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700">
                <FontAwesomeIcon icon={faFilter} />
                필터
              </span>
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFilter(option.value);
                    if (option.value === 'resolved') setIncludeResolved(true);
                  }}
                  className={`min-h-[36px] rounded-lg px-3 text-sm font-bold transition ${
                    filter === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={domainFilter}
                onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-500"
              >
                {domainOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeResolved}
                  onChange={(event) => setIncludeResolved(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                해결 포함
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
        </section>

        {filteredAlerts.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <>
            <section className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="w-28 px-4 py-3 text-left text-xs font-black uppercase text-slate-500">위험</th>
                      <th className="w-32 px-4 py-3 text-left text-xs font-black uppercase text-slate-500">영역</th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">내용</th>
                      <th className="w-36 px-4 py-3 text-right text-xs font-black uppercase text-slate-500">금액</th>
                      <th className="w-24 px-4 py-3 text-left text-xs font-black uppercase text-slate-500">상태</th>
                      <th className="w-64 px-4 py-3 text-right text-xs font-black uppercase text-slate-500">처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAlerts.map((alert) => (
                      <tr key={alert.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${severityClasses[alert.severity]}`}>
                            {severityLabels[alert.severity]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-slate-900">{domainLabels[alert.domain]}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{directionLabel(alert)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-slate-950">{alert.title}</p>
                          <p className="mt-1 max-w-3xl text-sm font-medium leading-5 text-slate-600">{alert.description}</p>
                          <p className="mt-2 text-xs font-semibold text-slate-400">
                            {[alert.siteName, alert.teamName, alert.companyName].filter(Boolean).join(' · ') || alert.sourceCollection}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-black tabular-nums text-slate-900">
                          {formatCurrency(alert.amount)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusClasses[alert.stateStatus]}`}>
                            {statusLabels[alert.stateStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void updateAlertStatus(alert, 'acknowledged')}
                              disabled={updatingId === alert.id || alert.stateStatus === 'resolved'}
                              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <FontAwesomeIcon icon={faCheck} />
                              확인
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateAlertStatus(alert, 'resolved')}
                              disabled={updatingId === alert.id || alert.stateStatus === 'resolved'}
                              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              <FontAwesomeIcon icon={faCheck} />
                              해결
                            </button>
                            <button
                              type="button"
                              onClick={() => openSource(alert)}
                              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-700"
                            >
                              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                              원본
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-3 md:hidden">
              {filteredAlerts.map((alert) => (
                <article key={alert.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${severityClasses[alert.severity]}`}>
                          {severityLabels[alert.severity]}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusClasses[alert.stateStatus]}`}>
                          {statusLabels[alert.stateStatus]}
                        </span>
                      </div>
                      <h2 className="mt-3 text-base font-black leading-6 text-slate-950">{alert.title}</h2>
                    </div>
                    <p className="shrink-0 text-right text-sm font-black tabular-nums text-slate-900">
                      {formatCurrency(alert.amount)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-5 text-slate-600">{alert.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <span>{domainLabels[alert.domain]}</span>
                    <span>{directionLabel(alert)}</span>
                    {(alert.siteName || alert.teamName || alert.companyName) && (
                      <span>{[alert.siteName, alert.teamName, alert.companyName].filter(Boolean).join(' · ')}</span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => void updateAlertStatus(alert, 'acknowledged')}
                      disabled={updatingId === alert.id || alert.stateStatus === 'resolved'}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-black text-slate-700 disabled:opacity-45"
                    >
                      <FontAwesomeIcon icon={faCheck} />
                      확인
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAlertStatus(alert, 'resolved')}
                      disabled={updatingId === alert.id || alert.stateStatus === 'resolved'}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs font-black text-white disabled:bg-slate-300"
                    >
                      <FontAwesomeIcon icon={faCheck} />
                      해결
                    </button>
                    <button
                      type="button"
                      onClick={() => openSource(alert)}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 text-xs font-black text-white"
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      원본
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

export default SettlementAlertCenterPage;
