import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowDown,
    faArrowUp,
    faCircleCheck,
    faCircleExclamation,
    faFileExcel,
    faFilePdf,
    faFilter,
    faMagnifyingGlass,
    faRotate,
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { AuditLog, auditService } from '../../services/auditService';
import { FileTransferDirection, FileTransferKind, FileTransferStatus } from '../../services/fileTransferAuditService';

type DirectionFilter = 'all' | FileTransferDirection;
type StatusFilter = 'all' | FileTransferStatus;

interface FileTransferDetails {
    fileKind?: FileTransferKind;
    direction?: FileTransferDirection;
    status?: FileTransferStatus;
    source?: string;
    operation?: string;
    fileNames?: string[];
    fileCount?: number;
    fileSize?: number;
    recordCount?: number;
    errorMessage?: string;
    [key: string]: unknown;
}

interface FileTransferLogPageProps {
    kind: FileTransferKind;
}

const KIND_META: Record<FileTransferKind, { title: string; description: string; icon: typeof faFileExcel; badge: string }> = {
    excel: {
        title: '엑셀 업로드·다운로드 로그',
        description: '엑셀 파일의 등록, 양식·오류 파일 다운로드, 처리 결과를 추적합니다.',
        icon: faFileExcel,
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    pdf: {
        title: 'PDF 업로드·다운로드 로그',
        description: 'PDF 파일 선택·처리와 PDF 파일 다운로드 이력을 추적합니다.',
        icon: faFilePdf,
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
    },
};

const readDetails = (log: AuditLog): FileTransferDetails => (
    log.details && typeof log.details === 'object' ? log.details as FileTransferDetails : {}
);

const normalizeFileNames = (value: unknown): string[] => (
    Array.isArray(value)
        ? value.map((name) => typeof name === 'string' ? name.trim() : '').filter(Boolean)
        : []
);

const formatFileSize = (value: unknown): string => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '-';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (log: AuditLog): string => {
    try {
        return format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss');
    } catch {
        return '-';
    }
};

const directionLabel = (direction: FileTransferDirection | undefined): string => direction === 'download' ? '다운로드' : '업로드';
const operationLabel = (operation: unknown): string => {
    if (operation === 'sample_template') return '샘플 양식 다운로드';
    if (operation === 'error_log') return '오류 로그 다운로드';
    if (operation === 'import_completed') return '일괄 등록 완료';
    if (operation === 'selected') return '파일 선택';
    if (operation === 'invoice_download') return '청구서 다운로드';
    return typeof operation === 'string' && operation ? operation : '파일 처리';
};

const FileTransferLogPage: React.FC<FileTransferLogPageProps> = ({ kind }) => {
    const meta = KIND_META[kind];
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [keyword, setKeyword] = useState('');
    const [direction, setDirection] = useState<DirectionFilter>('all');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const allLogs = await auditService.getLogs(1000, 'FILE_TRANSFER');
            setLogs(allLogs.filter((log) => readDetails(log).fileKind === kind));
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : '파일 전송 로그를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [kind]);

    useEffect(() => {
        void loadLogs();
    }, [loadLogs]);

    const filteredLogs = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return logs.filter((log) => {
            const details = readDetails(log);
            if (direction !== 'all' && details.direction !== direction) return false;
            if (status !== 'all' && details.status !== status) return false;
            if (!query) return true;
            const text = [
                log.actorName,
                log.actorEmail,
                details.source,
                details.operation,
                ...normalizeFileNames(details.fileNames),
            ].filter(Boolean).join(' ').toLowerCase();
            return text.includes(query);
        });
    }, [direction, keyword, logs, status]);

    const stats = useMemo(() => ({
        total: logs.length,
        uploads: logs.filter((log) => readDetails(log).direction === 'upload' && readDetails(log).status === 'success').length,
        downloads: logs.filter((log) => readDetails(log).direction === 'download' && readDetails(log).status === 'success').length,
        failed: logs.filter((log) => readDetails(log).status === 'failure').length,
    }), [logs]);

    return (
        <div className="mx-auto max-w-[1800px] p-6">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black shadow-sm ${meta.badge}`}><FontAwesomeIcon icon={meta.icon} /> File Transfer Audit</div>
                    <h1 className="mt-3 text-3xl font-black text-slate-900">{meta.title}</h1>
                    <p className="mt-2 text-sm text-slate-500">{meta.description}</p>
                </div>
                <button type="button" onClick={loadLogs} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"><FontAwesomeIcon icon={faRotate} spin={loading} /> 새로고침</button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {([
                    ['전체 로그', stats.total, meta.icon, 'bg-slate-100 text-slate-700'],
                    ['업로드 성공', stats.uploads, faArrowUp, 'bg-blue-50 text-blue-700'],
                    ['다운로드 성공', stats.downloads, faArrowDown, 'bg-emerald-50 text-emerald-700'],
                    ['실패', stats.failed, faCircleExclamation, 'bg-rose-50 text-rose-700'],
                ] as Array<[string, number, IconDefinition, string]>).map(([label, value, icon, tone]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><FontAwesomeIcon icon={icon} /></span><div><div className="text-xs font-bold text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-900">{value.toLocaleString('ko-KR')}</div></div></div></div>
                ))}
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><FontAwesomeIcon icon={faFilter} /> 로그 필터</div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <label className="relative"><FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="파일명, 작업 화면, 작업자로 검색" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" /></label>
                    <select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"><option value="all">전체 작업</option><option value="upload">업로드</option><option value="download">다운로드</option></select>
                    <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"><option value="all">전체 결과</option><option value="success">성공</option><option value="failure">실패</option></select>
                </div>
            </div>

            {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="font-black text-slate-900">파일 전송 이력</div><div className="text-sm font-semibold text-slate-500">{filteredLogs.length.toLocaleString('ko-KR')}건 표시</div></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-white text-xs font-black uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">작업</th><th className="px-5 py-3">일시</th><th className="px-5 py-3">파일</th><th className="px-5 py-3">처리 화면</th><th className="px-5 py-3">작업자</th><th className="px-5 py-3">상세</th></tr></thead><tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => {
                        const details = readDetails(log);
                        const names = normalizeFileNames(details.fileNames);
                        const failed = details.status === 'failure';
                        const isExpanded = expandedId === log.id;
                        return <React.Fragment key={log.id}><tr className="hover:bg-slate-50"><td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black ${failed ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><FontAwesomeIcon icon={failed ? faCircleExclamation : faCircleCheck} />{directionLabel(details.direction)} · {operationLabel(details.operation)}</span></td><td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{formatDate(log)}</td><td className="px-5 py-4"><div className="max-w-[300px] truncate font-bold text-slate-900">{names[0] || '-'}</div><div className="mt-1 text-xs text-slate-400">{names.length > 1 ? `외 ${names.length - 1}개` : formatFileSize(details.fileSize)}</div></td><td className="px-5 py-4 font-semibold text-slate-700">{typeof details.source === 'string' ? details.source : '-'}</td><td className="px-5 py-4"><div className="font-bold text-slate-900">{log.actorName || '-'}</div><div className="mt-1 text-xs text-slate-400">{log.actorEmail || log.actorId || '-'}</div></td><td className="px-5 py-4"><button type="button" onClick={() => setExpandedId(isExpanded ? null : (log.id || null))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{isExpanded ? '닫기' : '보기'}</button></td></tr>{isExpanded && <tr className="bg-slate-50"><td colSpan={6} className="px-5 py-5"><div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3"><div><div className="text-xs font-bold text-slate-400">파일 수 / 크기</div><div className="mt-1 font-bold text-slate-800">{typeof details.fileCount === 'number' ? `${details.fileCount}개` : `${names.length}개`} / {formatFileSize(details.fileSize)}</div></div><div><div className="text-xs font-bold text-slate-400">처리 건수</div><div className="mt-1 font-bold text-slate-800">{typeof details.recordCount === 'number' ? `${details.recordCount.toLocaleString('ko-KR')}건` : '-'}</div></div><div><div className="text-xs font-bold text-slate-400">결과</div><div className={`mt-1 font-bold ${failed ? 'text-rose-700' : 'text-emerald-700'}`}>{failed ? (typeof details.errorMessage === 'string' ? details.errorMessage : '처리에 실패했습니다.') : '성공'}</div></div></div>{names.length > 0 && <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600"><div className="mb-2 font-bold text-slate-500">파일 목록</div>{names.map((name) => <div key={name} className="break-all">{name}</div>)}</div>}</td></tr>}</React.Fragment>;
                    })}
                    {!loading && filteredLogs.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">조건에 맞는 파일 전송 로그가 없습니다.</td></tr>}
                    {loading && <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">파일 전송 로그를 불러오는 중입니다.</td></tr>}
                </tbody></table></div>
            </div>
        </div>
    );
};

export const ExcelTransferLogPage: React.FC = () => <FileTransferLogPage kind="excel" />;
export const PdfTransferLogPage: React.FC = () => <FileTransferLogPage kind="pdf" />;
