import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowRight,
    faClockRotateLeft,
    faFilter,
    faListCheck,
    faRotate,
    faSearch,
    faShieldHalved,
    faUserGear,
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { auditService, AuditLog } from '../../services/auditService';

type ActionFilter = 'all' | 'USER_ACCESS_UPDATED' | 'MENU_ACCESS_UPDATED';

const ACTION_META = {
    USER_ACCESS_UPDATED: {
        label: '사용자 권한 변경',
        icon: faUserGear,
        badge: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    MENU_ACCESS_UPDATED: {
        label: '메뉴 권한 변경',
        icon: faListCheck,
        badge: 'border-sky-200 bg-sky-50 text-sky-700',
    },
} as const;

const asText = (value: unknown, fallback = '-'): string => {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    return normalized || fallback;
};

const toStringList = (value: unknown): string[] => (
    Array.isArray(value)
        ? value.map((item) => asText(item, '')).filter(Boolean)
        : []
);

const formatRoles = (value: unknown): string => {
    const roles = toStringList(value);
    return roles.length > 0 ? roles.join(', ') : '전체 공개';
};

const formatDateTime = (log: AuditLog): string => {
    try {
        return format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss');
    } catch {
        return '-';
    }
};

const getSearchText = (log: AuditLog): string => {
    const details = log.details && typeof log.details === 'object'
        ? JSON.stringify(log.details)
        : '';
    return [
        log.actorName,
        log.actorEmail,
        log.targetName,
        log.targetId,
        log.action,
        details,
    ].filter(Boolean).join(' ').toLowerCase();
};

const UserAccessDetail: React.FC<{ details: Record<string, unknown> }> = ({ details }) => {
    const before = (details.before || {}) as Record<string, unknown>;
    const after = (details.after || {}) as Record<string, unknown>;
    const rows = [
        ['시스템 역할', asText(before.systemRole), asText(after.systemRole)],
        ['기본 직책', asText(before.position), asText(after.position)],
        ['추가 직책', formatRoles(before.additionalPositions), formatRoles(after.additionalPositions)],
    ];

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                    <tr><th className="px-4 py-3">항목</th><th className="px-4 py-3">변경 전</th><th className="px-4 py-3">변경 후</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map(([label, beforeValue, afterValue]) => (
                        <tr key={label}>
                            <td className="px-4 py-3 font-bold text-slate-700">{label}</td>
                            <td className="px-4 py-3 text-slate-500">{beforeValue}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{afterValue}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface MenuChange {
    siteName?: string;
    menuText?: string;
    beforeRoles?: string[];
    afterRoles?: string[];
}

const MenuAccessDetail: React.FC<{ details: Record<string, unknown> }> = ({ details }) => {
    const changes = Array.isArray(details.changes) ? details.changes as MenuChange[] : [];
    const totalChanges = typeof details.changeCount === 'number' ? details.changeCount : changes.length;
    const truncated = details.truncated === true;

    return (
        <div className="space-y-3">
            <div className="text-sm text-slate-500">총 <strong className="text-slate-800">{totalChanges.toLocaleString('ko-KR')}건</strong>의 메뉴 접근 권한이 변경되었습니다.</div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-black text-slate-500">
                        <tr><th className="px-4 py-3">사이트</th><th className="px-4 py-3">메뉴</th><th className="px-4 py-3">변경 전</th><th className="px-4 py-3">변경 후</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {changes.map((change, index) => (
                            <tr key={`${change.siteName}-${change.menuText}-${index}`}>
                                <td className="px-4 py-3 text-slate-500">{change.siteName || '-'}</td>
                                <td className="px-4 py-3 font-bold text-slate-800">{change.menuText || '-'}</td>
                                <td className="px-4 py-3 text-slate-500">{formatRoles(change.beforeRoles)}</td>
                                <td className="px-4 py-3 font-bold text-slate-900">{formatRoles(change.afterRoles)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {truncated && <p className="text-xs font-semibold text-amber-700">변경 건수가 많아 최근 기록에는 처음 100건만 상세로 저장했습니다.</p>}
        </div>
    );
};

const PermissionChangeLogPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [keyword, setKeyword] = useState('');
    const [action, setAction] = useState<ActionFilter>('all');

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const nextLogs = await auditService.getLogs(500, 'PERMISSION');
            setLogs(nextLogs);
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : '권한 변경 로그를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLogs();
    }, [loadLogs]);

    const filteredLogs = useMemo(() => {
        const search = keyword.trim().toLowerCase();
        return logs.filter((log) => {
            if (action !== 'all' && log.action !== action) return false;
            return !search || getSearchText(log).includes(search);
        });
    }, [action, keyword, logs]);

    const stats = useMemo(() => ({
        total: logs.length,
        user: logs.filter((log) => log.action === 'USER_ACCESS_UPDATED').length,
        menu: logs.filter((log) => log.action === 'MENU_ACCESS_UPDATED').length,
    }), [logs]);

    return (
        <div className="mx-auto max-w-[1800px] p-6">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500 shadow-sm">
                        <FontAwesomeIcon icon={faShieldHalved} /> Permission Audit Trail
                    </div>
                    <h1 className="mt-3 text-3xl font-black text-slate-900">권한 변경 로그</h1>
                    <p className="mt-2 text-sm text-slate-500">사용자 역할·직책과 메뉴 접근 권한의 변경 전후 값을 추적합니다.</p>
                </div>
                <button type="button" onClick={loadLogs} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                    <FontAwesomeIcon icon={faRotate} spin={loading} /> 새로고침
                </button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {([
                    ['전체 로그', stats.total, faClockRotateLeft, 'bg-slate-100 text-slate-700'],
                    ['사용자 권한 변경', stats.user, faUserGear, 'bg-violet-50 text-violet-700'],
                    ['메뉴 권한 변경', stats.menu, faListCheck, 'bg-sky-50 text-sky-700'],
                ] as Array<[string, number, IconDefinition, string]>).map(([label, value, icon, tone]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><FontAwesomeIcon icon={icon} /></span>
                            <div><div className="text-xs font-bold text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-900">{value.toLocaleString('ko-KR')}</div></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><FontAwesomeIcon icon={faFilter} /> 로그 필터</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="relative">
                        <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="작업자, 대상 사용자, 메뉴 이름으로 검색" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                    </label>
                    <select value={action} onChange={(event) => setAction(event.target.value as ActionFilter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15">
                        <option value="all">전체 변경</option>
                        <option value="USER_ACCESS_UPDATED">사용자 권한</option>
                        <option value="MENU_ACCESS_UPDATED">메뉴 권한</option>
                    </select>
                </div>
            </div>

            {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="font-black text-slate-900">변경 이력</div><div className="text-sm font-semibold text-slate-500">{filteredLogs.length.toLocaleString('ko-KR')}건 표시</div></div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                        <thead className="bg-white text-xs font-black uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">변경 종류</th><th className="px-5 py-3">일시</th><th className="px-5 py-3">작업자</th><th className="px-5 py-3">대상</th><th className="px-5 py-3 w-20">상세</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.map((log) => {
                                const meta = ACTION_META[log.action as keyof typeof ACTION_META] || ACTION_META.USER_ACCESS_UPDATED;
                                const details = log.details && typeof log.details === 'object' ? log.details as Record<string, unknown> : {};
                                const isExpanded = expandedId === log.id;
                                return <React.Fragment key={log.id}>
                                    <tr className="hover:bg-slate-50">
                                        <td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black ${meta.badge}`}><FontAwesomeIcon icon={meta.icon} />{meta.label}</span></td>
                                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{formatDateTime(log)}</td>
                                        <td className="px-5 py-4"><div className="font-bold text-slate-900">{log.actorName || '-'}</div><div className="mt-1 text-xs text-slate-400">{log.actorEmail || log.actorId || '-'}</div></td>
                                        <td className="px-5 py-4"><div className="font-bold text-slate-900">{log.targetName || log.targetId || '-'}</div><div className="mt-1 text-xs text-slate-400">{log.targetId || '-'}</div></td>
                                        <td className="px-5 py-4"><button type="button" onClick={() => setExpandedId(isExpanded ? null : (log.id || null))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">{isExpanded ? '닫기' : '보기'} <FontAwesomeIcon icon={faArrowRight} /></button></td>
                                    </tr>
                                    {isExpanded && <tr className="bg-slate-50"><td colSpan={5} className="px-5 py-5">{log.action === 'MENU_ACCESS_UPDATED' ? <MenuAccessDetail details={details} /> : <UserAccessDetail details={details} />}</td></tr>}
                                </React.Fragment>;
                            })}
                            {!loading && filteredLogs.length === 0 && <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-500">조건에 맞는 권한 변경 로그가 없습니다.</td></tr>}
                            {loading && <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-500">권한 변경 로그를 불러오는 중입니다.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PermissionChangeLogPage;
