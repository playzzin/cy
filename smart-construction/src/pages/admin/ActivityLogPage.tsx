
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHistory, faFilter, faSearch, faSync, faChevronDown, faChevronRight, faUser, faTag, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { auditService, AuditLog } from '../../services/auditService';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const CATEGORIES = ['ALL', 'MANPOWER', 'SITE', 'SYSTEM', 'PAYROLL', 'AUTH', 'USER'];

const ActivityLogPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await auditService.getLogs(100, filterCategory === 'ALL' ? undefined : filterCategory);
            setLogs(data);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
    }, [filterCategory]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'text-green-600 bg-green-50';
        if (action.includes('DELETE')) return 'text-red-600 bg-red-50';
        if (action.includes('UPDATE')) return 'text-blue-600 bg-blue-50';
        if (action.includes('LOGIN')) return 'text-purple-600 bg-purple-50';
        return 'text-slate-600 bg-slate-50';
    };

    return (
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col h-[calc(100vh-100px)]">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-slate-100 rounded-lg text-slate-600">
                            <FontAwesomeIcon icon={faHistory} />
                        </span>
                        시스템 활동 로그 (Activity Logs)
                    </h1>
                    <p className="text-slate-500 mt-1 ml-12">사용자 활동 및 데이터 변경 이력을 조회합니다.</p>
                </div>
                <button
                    onClick={loadLogs}
                    className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <FontAwesomeIcon icon={faSync} spin={loading} className={loading ? 'text-indigo-500' : 'text-slate-600'} />
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <FontAwesomeIcon icon={faFilter} /> 필터:
                </div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c === 'ALL' ? '전체 카테고리' : c}</option>)}
                </select>

                <div className="ml-auto text-sm text-slate-400">
                    최근 100건의 로그를 표시합니다.
                </div>
            </div>

            {/* Log Table */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium sticky top-0">
                            <tr>
                                <th className="px-6 py-4 w-12 text-center">#</th>
                                <th className="px-6 py-4">일시</th>
                                <th className="px-6 py-4">사용자</th>
                                <th className="px-6 py-4">카테고리</th>
                                <th className="px-6 py-4">활동 내용 (Action)</th>
                                <th className="px-6 py-4">대상 (Target)</th>
                                <th className="px-6 py-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map((log, index) => (
                                <React.Fragment key={log.id || index}>
                                    <tr
                                        onClick={() => toggleRow(log.id!)}
                                        className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 text-center text-slate-400">
                                            {logs.length - index}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-mono">
                                            {log.timestamp ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss', { locale: ko }) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700">{log.actorName || 'Unknown'}</span>
                                                <span className="text-xs text-slate-400">{log.actorEmail}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                                {log.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold border border-transparent ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 font-medium">
                                            {log.targetName || log.targetId || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-400">
                                            <FontAwesomeIcon icon={expandedRows.has(log.id!) ? faChevronDown : faChevronRight} size="xs" />
                                        </td>
                                    </tr>
                                    {expandedRows.has(log.id!) && log.details && (
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={7} className="px-6 py-4">
                                                <div className="bg-white p-4 rounded-lg border border-slate-200 font-mono text-xs text-indigo-900 overflow-x-auto shadow-inner">
                                                    <div className="flex items-center gap-2 mb-2 text-indigo-500 font-bold border-b border-indigo-100 pb-1">
                                                        <FontAwesomeIcon icon={faInfoCircle} /> 상세 정보 (JSON)
                                                    </div>
                                                    <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        기록된 로그가 없습니다.
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

export default ActivityLogPage;
