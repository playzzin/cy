import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCar,
  faChevronDown,
  faChevronRight,
  faClock,
  faFileInvoiceDollar,
  faFilter,
  faHistory,
  faInfoCircle,
  faPenToSquare,
  faPlus,
  faSearch,
  faSync,
  faTrash,
  faUser,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { vehicleBillingLogService } from '../../services/vehicleBillingLogService';
import type {
  VehicleBillingFieldChange,
  VehicleBillingLineItemChange,
  VehicleBillingLog,
  VehicleBillingLogAction,
} from '../../types/vehicleBillingLog';

type ActionFilter = 'all' | VehicleBillingLogAction;

const ACTION_META: Record<VehicleBillingLogAction, { label: string; icon: any; badge: string }> = {
  created: {
    label: '저장',
    icon: faPlus,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  updated: {
    label: '수정',
    icon: faPenToSquare,
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  deleted: {
    label: '삭제',
    icon: faTrash,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  CONFIRMED: '확정',
  PAID: '지급완료',
  OVERDUE: '연체',
};

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

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return value.toLocaleString('ko-KR');
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value);
};

const includesText = (source: unknown, keyword: string): boolean =>
  String(source || '').toLowerCase().includes(keyword);

const buildSearchText = (log: VehicleBillingLog): string => [
  log.billingId,
  log.yearMonth,
  log.vehiclePlate,
  log.teamName,
  log.issuedToWorkerName,
  log.status,
  log.actor.name,
  log.actor.email,
  log.actionLabel,
  log.summaryText,
].join(' ');

const filterLogs = (
  logs: VehicleBillingLog[],
  filters: {
    action: ActionFilter;
    keyword: string;
    fromDate: string;
    toDate: string;
    yearMonth: string;
  }
): VehicleBillingLog[] => {
  const keyword = filters.keyword.trim().toLowerCase();

  return logs.filter((log) => {
    if (filters.action !== 'all' && log.action !== filters.action) return false;
    if (filters.yearMonth && log.yearMonth !== filters.yearMonth) return false;

    const createdDate = toDate(log.createdAt);
    const createdDay = createdDate ? format(createdDate, 'yyyy-MM-dd') : '';
    if (filters.fromDate && createdDay < filters.fromDate) return false;
    if (filters.toDate && createdDay > filters.toDate) return false;

    if (keyword && !includesText(buildSearchText(log), keyword)) return false;
    return true;
  });
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: any;
  tone: string;
}> = ({ label, value, icon, tone }) => (
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

const FieldChangeList: React.FC<{ changes: VehicleBillingFieldChange[] }> = ({ changes }) => {
  if (changes.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">기본 정보 변경 없음</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {changes.map((change) => (
        <div key={`${change.field}-${change.label}`} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-800">{change.label}</div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">{formatValue(change.before)}</div>
            <FontAwesomeIcon icon={faChevronRight} className="text-slate-400" />
            <div className="rounded-md bg-blue-50 px-3 py-2 font-bold text-blue-700">{formatValue(change.after)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const LineItemChangeTable: React.FC<{
  title: string;
  rows: VehicleBillingLineItemChange[];
  emptyText: string;
  tone: string;
}> = ({ title, rows, emptyText, tone }) => (
  <div className="rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{rows.length.toLocaleString('ko-KR')}건</span>
    </div>
    {rows.length === 0 ? (
      <div className="p-5 text-center text-sm text-slate-500">{emptyText}</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              <th className="px-4 py-3">항목</th>
              <th className="px-4 py-3">상세 변경</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{row.label}</div>
                  <div className="text-xs text-slate-400">{row.key}</div>
                </td>
                <td className="px-4 py-3">
                  {row.changes?.length ? (
                    <div className="space-y-1">
                      {row.changes.map((change) => (
                        <div key={`${row.key}-${change.field}`} className="text-xs text-slate-600">
                          <span className="font-bold text-slate-800">{change.label}</span>: {formatValue(change.before)} → {formatValue(change.after)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">항목 전체 변경</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const DetailPanel: React.FC<{ log: VehicleBillingLog; onClose: () => void }> = ({ log, onClose }) => {
  const [showJson, setShowJson] = useState(false);
  const meta = ACTION_META[log.action];

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${meta.badge}`}>
            <FontAwesomeIcon icon={meta.icon} />
            {meta.label}
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-900">{log.vehiclePlate} 차량 청구 상세</h2>
          <p className="mt-1 text-sm text-slate-500">{log.yearMonth} · {log.teamName || log.issuedToWorkerName || '청구대상 미지정'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 lg:hidden"
          aria-label="상세 닫기"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-400">변경일시</div>
            <div className="mt-1 font-bold text-slate-800">{formatDateTime(log.createdAt)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-400">처리자</div>
            <div className="mt-1 font-bold text-slate-800">{log.actor.name}</div>
            <div className="text-xs text-slate-500">{log.actor.email || log.actor.uid}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-400">청구서 ID</div>
            <div className="mt-1 break-all font-mono text-xs font-bold text-slate-800">{log.billingId}</div>
          </div>
        </div>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-black text-slate-900">
            <FontAwesomeIcon icon={faInfoCircle} className="text-indigo-600" />
            변동 요약
          </h3>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <ul className="space-y-2 text-sm font-semibold text-indigo-950">
              {log.summaryLines.map((line, index) => (
                <li key={`${line}-${index}`} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-black text-slate-900">기본 정보 변경</h3>
          <FieldChangeList changes={log.fieldChanges} />
        </section>

        <section className="grid grid-cols-1 gap-4">
          <LineItemChangeTable
            title="추가된 청구 항목"
            rows={log.lineItemChanges.added}
            emptyText="추가된 청구 항목이 없습니다."
            tone="bg-emerald-50 text-emerald-700"
          />
          <LineItemChangeTable
            title="수정된 청구 항목"
            rows={log.lineItemChanges.updated}
            emptyText="수정된 청구 항목이 없습니다."
            tone="bg-blue-50 text-blue-700"
          />
          <LineItemChangeTable
            title="삭제된 청구 항목"
            rows={log.lineItemChanges.removed}
            emptyText="삭제된 청구 항목이 없습니다."
            tone="bg-rose-50 text-rose-700"
          />
        </section>

        <section>
          <button
            type="button"
            onClick={() => setShowJson((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <FontAwesomeIcon icon={showJson ? faChevronDown : faChevronRight} />
            원본 스냅샷 보기
          </button>
          {showJson && (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(log.before || null, null, 2)}
              </pre>
              <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(log.after || null, null, 2)}
              </pre>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};

const VehicleBillingLogPage: React.FC = () => {
  const [logs, setLogs] = useState<VehicleBillingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    action: 'all' as ActionFilter,
    keyword: '',
    fromDate: '',
    toDate: '',
    yearMonth: '',
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = vehicleBillingLogService.subscribeRecentLogs(
      (nextLogs) => {
        setLogs(nextLogs);
        setLoading(false);
      },
      500,
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filteredLogs = useMemo(() => filterLogs(logs, filters), [logs, filters]);
  const selectedLog = useMemo(
    () => filteredLogs.find((log) => log.id === selectedId) || filteredLogs[0] || null,
    [filteredLogs, selectedId]
  );

  useEffect(() => {
    if (!selectedLog) {
      setSelectedId(null);
      return;
    }
    if (selectedId !== selectedLog.id) {
      setSelectedId(selectedLog.id || null);
    }
  }, [selectedId, selectedLog]);

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total: logs.length,
      created: logs.filter((log) => log.action === 'created').length,
      updated: logs.filter((log) => log.action === 'updated').length,
      deleted: logs.filter((log) => log.action === 'deleted').length,
      today: logs.filter((log) => {
        const created = toDate(log.createdAt);
        return created ? format(created, 'yyyy-MM-dd') === today : false;
      }).length,
    };
  }, [logs]);

  const loadOnce = async () => {
    setLoading(true);
    try {
      const nextLogs = await vehicleBillingLogService.getRecentLogs(500);
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
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500 shadow-sm">
            <FontAwesomeIcon icon={faHistory} />
            Vehicle Billing Audit Trail
          </div>
          <h1 className="mt-3 text-3xl font-black text-slate-900">차량 청구 변경 로그</h1>
          <p className="mt-2 text-sm text-slate-500">
            언제, 누가, 어떤 차량 청구서를 저장·수정·확정·취소했는지 변경 전후 값까지 추적합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOnce}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <FontAwesomeIcon icon={faSync} spin={loading} />
          새로고침
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="전체 로그" value={stats.total.toLocaleString('ko-KR')} icon={faFileInvoiceDollar} tone="bg-slate-100 text-slate-700" />
        <StatCard label="오늘 변동" value={stats.today.toLocaleString('ko-KR')} icon={faClock} tone="bg-cyan-50 text-cyan-700" />
        <StatCard label="저장" value={stats.created.toLocaleString('ko-KR')} icon={faPlus} tone="bg-emerald-50 text-emerald-700" />
        <StatCard label="수정" value={stats.updated.toLocaleString('ko-KR')} icon={faPenToSquare} tone="bg-blue-50 text-blue-700" />
        <StatCard label="삭제" value={stats.deleted.toLocaleString('ko-KR')} icon={faTrash} tone="bg-rose-50 text-rose-700" />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
          <FontAwesomeIcon icon={faFilter} />
          로그 필터
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr]">
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="차량번호, 팀, 처리자, 내용 검색"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
          <select
            value={filters.action}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value as ActionFilter }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          >
            <option value="all">전체 작업</option>
            <option value="created">저장</option>
            <option value="updated">수정</option>
            <option value="deleted">삭제</option>
          </select>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="변경일 시작"
          />
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="변경일 종료"
          />
          <input
            type="month"
            value={filters.yearMonth}
            onChange={(event) => setFilters((current) => ({ ...current, yearMonth: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="청구 월"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          로그를 불러오지 못했습니다: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(460px,0.75fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="font-black text-slate-900">변경 이력</div>
            <div className="text-sm font-semibold text-slate-500">{filteredLogs.length.toLocaleString('ko-KR')}건 표시</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs font-black uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">작업</th>
                  <th className="px-4 py-3">변경일시</th>
                  <th className="px-4 py-3">차량 청구서</th>
                  <th className="px-4 py-3">처리자</th>
                  <th className="px-4 py-3">요약</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const meta = ACTION_META[log.action];
                  const isSelected = selectedLog?.id === log.id;
                  const isExpanded = expandedRows.has(log.id || '');
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setSelectedId(log.id || null)}
                        className={`cursor-pointer transition ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black ${meta.badge}`}>
                            <FontAwesomeIcon icon={meta.icon} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">{log.vehiclePlate || '-'}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span><FontAwesomeIcon icon={faCar} /> {log.yearMonth || '-'}</span>
                            <span><FontAwesomeIcon icon={faUsers} /> {log.teamName || log.issuedToWorkerName || '청구대상 미지정'}</span>
                            {log.status && <span>{STATUS_LABELS[log.status] || log.status}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800">
                            <FontAwesomeIcon icon={faUser} className="mr-2 text-slate-400" />
                            {log.actor.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{log.actor.email || log.actor.uid}</div>
                        </td>
                        <td className="max-w-md px-4 py-4">
                          <div className="line-clamp-2 text-sm font-medium leading-6 text-slate-700">
                            {log.summaryLines.join(' ')}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">상세 변경 {log.changeCount.toLocaleString('ko-KR')}건</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (log.id) toggleRow(log.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="행 상세"
                          >
                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">요약</div>
                              <ul className="space-y-1 text-sm text-slate-700">
                                {log.summaryLines.map((line, index) => (
                                  <li key={`${log.id}-summary-${index}`}>- {line}</li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredLogs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      조건에 맞는 차량 청구 로그가 없습니다.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      로그를 불러오는 중입니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedLog ? (
          <DetailPanel log={selectedLog} onClose={() => setSelectedId(null)} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            로그를 선택하면 변경 상세가 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleBillingLogPage;
