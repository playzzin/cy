import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightFromBracket,
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faCircleExclamation,
  faClock,
  faDesktop,
  faFilter,
  faGlobe,
  faHistory,
  faRotate,
  faSearch,
  faShieldHalved,
  faUser,
  faUserPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { loginLogService } from '../../services/loginLogService';
import type { LoginLog, LoginLogAction, LoginLogStatus } from '../../types/loginLog';

type ActionFilter = 'all' | LoginLogAction;
type StatusFilter = 'all' | LoginLogStatus;

const ACTION_META: Record<LoginLogAction, { label: string; icon: any; badge: string; text: string }> = {
  login_success: {
    label: '로그인 성공',
    icon: faCircleCheck,
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
  },
  login_failed: {
    label: '로그인 실패',
    icon: faCircleExclamation,
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    text: 'text-rose-700',
  },
  logout: {
    label: '로그아웃',
    icon: faArrowRightFromBracket,
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
    text: 'text-slate-700',
  },
  signup_success: {
    label: '회원가입',
    icon: faUserPlus,
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    text: 'text-indigo-700',
  },
};

const STATUS_META: Record<LoginLogStatus, { label: string; badge: string }> = {
  success: { label: '성공', badge: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '실패', badge: 'bg-rose-100 text-rose-700' },
  info: { label: '정보', badge: 'bg-slate-100 text-slate-700' },
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

const includesText = (source: unknown, keyword: string): boolean =>
  String(source || '').toLowerCase().includes(keyword);

const buildSearchText = (log: LoginLog): string => [
  log.actor.uid,
  log.actor.displayName,
  log.actor.email,
  log.email,
  log.actionLabel,
  log.provider,
  log.method,
  log.client.browser,
  log.client.os,
  log.client.path,
  log.client.userAgent,
  log.summaryText,
  log.errorCode,
  log.errorMessage,
].join(' ');

const filterLogs = (
  logs: LoginLog[],
  filters: {
    action: ActionFilter;
    status: StatusFilter;
    provider: string;
    keyword: string;
    fromDate: string;
    toDate: string;
  }
): LoginLog[] => {
  const keyword = filters.keyword.trim().toLowerCase();
  return logs.filter((log) => {
    if (filters.action !== 'all' && log.action !== filters.action) return false;
    if (filters.status !== 'all' && log.status !== filters.status) return false;
    if (filters.provider && log.provider !== filters.provider) return false;

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

const DetailPanel: React.FC<{ log: LoginLog; onClose: () => void }> = ({ log, onClose }) => {
  const [showRaw, setShowRaw] = useState(false);
  const meta = ACTION_META[log.action] || ACTION_META.login_success;
  const status = STATUS_META[log.status] || STATUS_META.info;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${meta.badge}`}>
            <FontAwesomeIcon icon={meta.icon} />
            {meta.label}
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-900">로그인 상세 기록</h2>
          <p className="mt-1 text-sm text-slate-500">{formatDateTime(log.createdAt)}</p>
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
            <div className="text-xs font-bold text-slate-400">상태</div>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${status.badge}`}>
              {status.label}
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-400">사용자</div>
            <div className="mt-1 font-bold text-slate-800">{log.actor.displayName || '-'}</div>
            <div className="break-all text-xs text-slate-500">{log.actor.email || log.actor.uid || '-'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-400">접속 방식</div>
            <div className="mt-1 font-bold text-slate-800">{log.provider}</div>
            <div className="text-xs text-slate-500">{log.method}</div>
          </div>
        </div>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-black text-slate-900">
            <FontAwesomeIcon icon={faShieldHalved} className={meta.text} />
            기록 요약
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

        {log.errorMessage && (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="font-black text-rose-800">실패 정보</h3>
            <div className="mt-2 text-sm text-rose-700">{log.errorCode || '-'}</div>
            <div className="mt-1 break-all text-sm font-semibold text-rose-900">{log.errorMessage}</div>
          </section>
        )}

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-black text-slate-900">
            <FontAwesomeIcon icon={faDesktop} className="text-slate-500" />
            접속 환경
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ['브라우저', log.client.browser],
              ['운영체제', log.client.os],
              ['플랫폼', log.client.platform || '-'],
              ['언어', log.client.language || '-'],
              ['타임존', log.client.timezone || '-'],
              ['화면/뷰포트', `${log.client.screen || '-'} / ${log.client.viewport || '-'}`],
              ['접속 경로', log.client.path || '-'],
              ['이전 경로', log.client.referrer || '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold text-slate-400">{label}</div>
                <div className="mt-1 break-all text-sm font-bold text-slate-800">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setShowRaw((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <FontAwesomeIcon icon={showRaw ? faChevronDown : faChevronRight} />
            원본 로그 보기
          </button>
          {showRaw && (
            <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(log, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </aside>
  );
};

const LoginLogPage: React.FC = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    action: 'all' as ActionFilter,
    status: 'all' as StatusFilter,
    provider: '',
    keyword: '',
    fromDate: '',
    toDate: '',
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = loginLogService.subscribeRecentLogs(
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

  const providers = useMemo(
    () => Array.from(new Set(logs.map((log) => log.provider).filter(Boolean))).sort(),
    [logs]
  );

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total: logs.length,
      today: logs.filter((log) => {
        const created = toDate(log.createdAt);
        return created ? format(created, 'yyyy-MM-dd') === today : false;
      }).length,
      success: logs.filter((log) => log.action === 'login_success').length,
      failed: logs.filter((log) => log.action === 'login_failed').length,
      logout: logs.filter((log) => log.action === 'logout').length,
    };
  }, [logs]);

  const loadOnce = async () => {
    setLoading(true);
    try {
      const nextLogs = await loginLogService.getRecentLogs(500);
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
            Authentication Audit Trail
          </div>
          <h1 className="mt-3 text-3xl font-black text-slate-900">로그인 접근 로그</h1>
          <p className="mt-2 text-sm text-slate-500">
            언제, 누가, 어떤 방식과 환경으로 로그인했는지 성공·실패·로그아웃 기록을 추적합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOnce}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <FontAwesomeIcon icon={faRotate} spin={loading} />
          새로고침
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="전체 로그" value={stats.total.toLocaleString('ko-KR')} icon={faShieldHalved} tone="bg-slate-100 text-slate-700" />
        <StatCard label="오늘 접속" value={stats.today.toLocaleString('ko-KR')} icon={faClock} tone="bg-cyan-50 text-cyan-700" />
        <StatCard label="로그인 성공" value={stats.success.toLocaleString('ko-KR')} icon={faCircleCheck} tone="bg-emerald-50 text-emerald-700" />
        <StatCard label="로그인 실패" value={stats.failed.toLocaleString('ko-KR')} icon={faCircleExclamation} tone="bg-rose-50 text-rose-700" />
        <StatCard label="로그아웃" value={stats.logout.toLocaleString('ko-KR')} icon={faArrowRightFromBracket} tone="bg-slate-50 text-slate-700" />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
          <FontAwesomeIcon icon={faFilter} />
          로그 필터
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr]">
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="사용자, 이메일, 경로, 브라우저 검색"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
          <select
            value={filters.action}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value as ActionFilter }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          >
            <option value="all">전체 작업</option>
            <option value="login_success">로그인 성공</option>
            <option value="login_failed">로그인 실패</option>
            <option value="logout">로그아웃</option>
            <option value="signup_success">회원가입</option>
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StatusFilter }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          >
            <option value="all">전체 상태</option>
            <option value="success">성공</option>
            <option value="failed">실패</option>
            <option value="info">정보</option>
          </select>
          <select
            value={filters.provider}
            onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          >
            <option value="">전체 방식</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="접속일 시작"
          />
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            aria-label="접속일 종료"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          로그인 로그를 불러오지 못했습니다. {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(460px,0.75fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="font-black text-slate-900">접속 이력</div>
            <div className="text-sm font-semibold text-slate-500">{filteredLogs.length.toLocaleString('ko-KR')}건 표시</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs font-black uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">작업</th>
                  <th className="px-4 py-3">접속일시</th>
                  <th className="px-4 py-3">사용자</th>
                  <th className="px-4 py-3">방식</th>
                  <th className="px-4 py-3">환경</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const meta = ACTION_META[log.action] || ACTION_META.login_success;
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
                          <div className="font-bold text-slate-900">
                            <FontAwesomeIcon icon={faUser} className="mr-2 text-slate-400" />
                            {log.actor.displayName || log.email || '-'}
                          </div>
                          <div className="mt-1 break-all text-xs text-slate-400">{log.actor.email || log.actor.uid || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800">{log.provider}</div>
                          <div className="mt-1 text-xs text-slate-400">{log.method}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800">
                            <FontAwesomeIcon icon={faGlobe} className="mr-2 text-slate-400" />
                            {log.client.browser}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{log.client.os} · {log.client.viewport}</div>
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
                      조건에 맞는 로그인 로그가 없습니다.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      로그인 로그를 불러오는 중입니다.
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
            로그를 선택하면 접속 상세가 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginLogPage;
