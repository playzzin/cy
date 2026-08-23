import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxArchive,
  faCalendarDay,
  faChevronDown,
  faChevronRight,
  faClock,
  faFilter,
  faRotateRight,
  faSearch,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supportCancellationLogService } from '../../services/supportCancellationLogService';
import {
  SUPPORT_CANCELLATION_REASON_LABELS,
  SUPPORT_CANCELLATION_REASON_OPTIONS,
  type SupportCancellationLog,
  type SupportCancellationReason,
  type SupportCancellationResourceType,
} from '../../types/supportCancellationLog';

type ReasonFilter = 'all' | SupportCancellationReason;

interface SupportCancellationHistoryProps {
  resourceType: SupportCancellationResourceType;
  title: string;
  description?: string;
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const formatDateTime = (value: unknown): string => {
  const date = toDate(value);
  return date ? format(date, 'yyyy-MM-dd HH:mm:ss', { locale: ko }) : '-';
};

const formatAmount = (value?: number): string => {
  if (value === undefined || Number.isNaN(value)) return '-';
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
};

const normalizeText = (value: unknown): string => String(value ?? '').toLowerCase();

const getCardNumberLabel = (log: SupportCancellationLog): string => {
  if (log.resourceType !== 'card') return '';
  const snapshot = (log.snapshot || {}) as Record<string, unknown>;
  return String(snapshot.maskedNumber || snapshot.last4 || '').trim();
};

const buildSearchText = (log: SupportCancellationLog): string => [
  log.resourceLabel,
  log.reasonLabel,
  log.processedDate,
  log.statusBefore,
  log.statusAfter,
  log.assigneeName,
  log.teamName,
  log.billingTargetName,
  log.note,
  log.actor?.name,
  log.actor?.email,
  getCardNumberLabel(log),
].join(' ');

const filterLogs = (
  logs: SupportCancellationLog[],
  filters: {
    keyword: string;
    reason: ReasonFilter;
    fromDate: string;
    toDate: string;
  }
): SupportCancellationLog[] => {
  const keyword = filters.keyword.trim().toLowerCase();
  return logs.filter((log) => {
    if (filters.reason !== 'all' && log.reason !== filters.reason) return false;
    if (filters.fromDate && log.processedDate < filters.fromDate) return false;
    if (filters.toDate && log.processedDate > filters.toDate) return false;
    if (keyword && !normalizeText(buildSearchText(log)).includes(keyword)) return false;
    return true;
  });
};

const StatCard: React.FC<{ label: string; value: string | number; icon: any; tone: string }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
    </div>
  </div>
);

export const SupportCancellationHistory: React.FC<SupportCancellationHistoryProps> = ({
  resourceType,
  title,
  description = '사용취소, 만료, 정지, 중간정리 등 처리 완료 내역을 다시 확인합니다.',
}) => {
  const [logs, setLogs] = useState<SupportCancellationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    keyword: '',
    reason: 'all' as ReasonFilter,
    fromDate: '',
    toDate: '',
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = supportCancellationLogService.subscribeRecentLogs(
      (nextLogs) => {
        setLogs(nextLogs);
        setLoading(false);
        setError(null);
      },
      resourceType,
      500,
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [resourceType]);

  const filteredLogs = useMemo(() => filterLogs(logs, filters), [logs, filters]);
  const reasonOptions = SUPPORT_CANCELLATION_REASON_OPTIONS[resourceType];

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total: logs.length,
      filtered: filteredLogs.length,
      today: logs.filter((log) => log.processedDate === today).length,
      amount: filteredLogs.reduce((sum, log) => sum + Number(log.settlementAmount ?? 0), 0),
    };
  }, [logs, filteredLogs]);

  const refresh = async () => {
    setLoading(true);
    try {
      const nextLogs = await supportCancellationLogService.getRecentLogs(resourceType, 500);
      setLogs(nextLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500 shadow-sm">
            <FontAwesomeIcon icon={faBoxArchive} />
            Support Close History
          </div>
          <h2 className="mt-3 text-2xl font-black text-slate-900">{title}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <FontAwesomeIcon icon={faRotateRight} spin={loading} />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 처리" value={stats.total.toLocaleString('ko-KR')} icon={faBoxArchive} tone="bg-slate-100 text-slate-700" />
        <StatCard label="오늘 처리" value={stats.today.toLocaleString('ko-KR')} icon={faClock} tone="bg-cyan-50 text-cyan-700" />
        <StatCard label="조회 결과" value={stats.filtered.toLocaleString('ko-KR')} icon={faFilter} tone="bg-indigo-50 text-indigo-700" />
        <StatCard label="정산 합계" value={formatAmount(stats.amount)} icon={faCalendarDay} tone="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
          <FontAwesomeIcon icon={faFilter} />
          처리내역 필터
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr]">
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="대상, 사유, 처리자, 내역 검색"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
          <select
            value={filters.reason}
            onChange={(event) => setFilters((current) => ({ ...current, reason: event.target.value as ReasonFilter }))}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          >
            <option value="all">전체 사유</option>
            {reasonOptions.map((reason) => (
              <option key={reason} value={reason}>{SUPPORT_CANCELLATION_REASON_LABELS[reason]}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="처리일 시작"
          />
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="처리일 종료"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          처리내역을 불러오지 못했습니다: {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="font-black text-slate-900">처리 이력</div>
          <div className="text-sm font-semibold text-slate-500">{filteredLogs.length.toLocaleString('ko-KR')}건 표시</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-xs font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">처리일</th>
                <th className="px-4 py-3">대상</th>
                <th className="px-4 py-3">사유</th>
                <th className="px-4 py-3">처리자</th>
                <th className="px-4 py-3">정산</th>
                <th className="px-4 py-3">내역</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-bold text-slate-600">
                        {log.processedDate || '-'}
                        <div className="mt-1 font-sans text-[11px] font-semibold text-slate-400">
                          {formatDateTime(log.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-900">{log.resourceLabel || '-'}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          {getCardNumberLabel(log) && <span>카드번호: {getCardNumberLabel(log)}</span>}
                          {log.assigneeName && <span>사용자: {log.assigneeName}</span>}
                          {log.teamName && <span>팀: {log.teamName}</span>}
                          {log.billingTargetName && <span>청구: {log.billingTargetName}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                          {log.reasonLabel}
                        </span>
                        {(log.statusBefore || log.statusAfter) && (
                          <div className="mt-2 text-xs font-semibold text-slate-400">
                            {log.statusBefore || '-'} → {log.statusAfter || '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800">
                          <FontAwesomeIcon icon={faUser} className="mr-2 text-slate-400" />
                          {log.actor.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{log.actor.email || log.actor.uid}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-black text-slate-700">
                        {formatAmount(log.settlementAmount)}
                      </td>
                      <td className="max-w-md px-4 py-4">
                        <div className="line-clamp-2 text-sm font-semibold leading-6 text-slate-700">{log.note || '-'}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRow(log.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="상세 보기"
                        >
                          <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_1fr]">
                            <div>
                              <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">처리 내역</div>
                              <div className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{log.note || '-'}</div>
                            </div>
                            <div>
                              <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">처리 당시 정보</div>
                              <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                                {JSON.stringify(log.snapshot || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    조건에 맞는 처리내역이 없습니다.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    처리내역을 불러오는 중입니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
