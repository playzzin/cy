import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    FileSearch,
    LoaderCircle,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    X,
} from 'lucide-react';
import type { Vehicle } from '../../types/vehicle';
import type { CommitVehicleTollImportsResult, VehicleTollUsageAnalysis } from '../../types/vehicleTollImport';
import { vehicleTollImportService } from '../../services/vehicleTollImportService';
import AiDocumentDropzone from '../common/AiDocumentDropzone';

interface VehicleTollImportModalProps {
    yearMonth: string;
    files?: File[];
    vehicles: Vehicle[];
    onClose: () => void;
    onCommitted: (result: CommitVehicleTollImportsResult) => void;
}

interface ReviewRow {
    analysis: VehicleTollUsageAnalysis;
    selected: boolean;
    selectedVehicleId: string;
    autoMatchedByFileName: boolean;
    expenseDate: string;
    amount: number;
}

const MAX_COMMIT_ITEMS = 20;
const rowKey = (analysis: Pick<VehicleTollUsageAnalysis, 'fileIndex' | 'entryIndex'>): string => `${analysis.fileIndex}:${analysis.entryIndex}`;
const formatAmount = (amount: number): string => Number(amount || 0).toLocaleString('ko-KR');
const isValidDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getMonthEndDate = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    return `${yearMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
};
const confidenceClass = (confidence: number): string => {
    if (confidence >= 0.9) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (confidence >= 0.7) return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-rose-200 bg-rose-50 text-rose-700';
};
const normalizeVehiclePlate = (value: string): string => String(value || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^0-9A-Z\uAC00-\uD7A3]/g, '');

const findVehicleByFileNameSuffix = (suffix: string, vehicles: Vehicle[]): Vehicle | undefined => {
    if (!/^\d{4}$/.test(suffix)) return undefined;
    const matches = vehicles.filter((vehicle) => normalizeVehiclePlate(vehicle.licensePlate).endsWith(suffix));
    return matches.length === 1 ? matches[0] : undefined;
};

const VehicleTollImportModal: React.FC<VehicleTollImportModalProps> = ({
    yearMonth,
    files = [],
    vehicles,
    onClose,
    onCommitted,
}) => {
    const [status, setStatus] = useState<'upload' | 'analyzing' | 'review' | 'committing' | 'done' | 'failed'>(files.length > 0 ? 'analyzing' : 'upload');
    const [selectedFiles, setSelectedFiles] = useState<File[]>(files);
    const [rows, setRows] = useState<ReviewRow[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [resultMessage, setResultMessage] = useState('');
    const [progress, setProgress] = useState({ completedFiles: 0, totalFiles: files.length, currentFileName: '' });
    const startedRef = useRef(false);

    const sortedVehicles = useMemo(() => vehicles
        .slice()
        .sort((left, right) => left.licensePlate.localeCompare(right.licensePlate, 'ko', { numeric: true })), [vehicles]);
    const vehicleById = useMemo(() => new Map(sortedVehicles.map((vehicle) => [String(vehicle.id), vehicle])), [sortedVehicles]);
    const previewUrls = useMemo(() => selectedFiles.map((file, fileIndex) => ({
        fileIndex,
        url: URL.createObjectURL(file),
    })), [selectedFiles]);

    useEffect(() => () => previewUrls.forEach((preview) => URL.revokeObjectURL(preview.url)), [previewUrls]);

    const analyze = useCallback(async () => {
        try {
            vehicleTollImportService.validateFiles(selectedFiles);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '통행료 이용내역 파일을 확인해 주세요.');
            setStatus('upload');
            return;
        }

        setStatus('analyzing');
        setErrorMessage('');
        setResultMessage('');
        setProgress({ completedFiles: 0, totalFiles: selectedFiles.length, currentFileName: '' });
        try {
            const analyses = await vehicleTollImportService.analyzeFiles(selectedFiles, setProgress);
            const seenKeys = new Set<string>();
            const nextRows = analyses.map((rawAnalysis): ReviewRow => {
                const duplicateInSelection = seenKeys.has(rawAnalysis.dedupeKey);
                seenKeys.add(rawAnalysis.dedupeKey);
                const analysis = duplicateInSelection
                    ? {
                        ...rawAnalysis,
                        duplicate: true,
                        warnings: Array.from(new Set([
                            ...rawAnalysis.warnings,
                            '같은 분석 묶음에 중복된 통행료 이용내역이 있어 제외했습니다.',
                        ])),
                    }
                    : rawAnalysis;
                const statementStartDate = analysis.statementPeriod.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
                const fileNameVehicle = findVehicleByFileNameSuffix(analysis.fileNameVehicleSuffix, sortedVehicles);
                return {
                    analysis,
                    selected: !analysis.duplicate && analysis.amount > 0,
                    selectedVehicleId: fileNameVehicle ? String(fileNameVehicle.id) : '',
                    autoMatchedByFileName: Boolean(fileNameVehicle),
                    expenseDate: statementStartDate.startsWith(yearMonth) ? statementStartDate : `${yearMonth}-01`,
                    amount: analysis.amount,
                };
            });
            setRows(nextRows);
            setStatus('review');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '통행료 이용내역 분석에 실패했습니다.');
            setStatus('failed');
        }
    }, [selectedFiles, sortedVehicles, yearMonth]);

    useEffect(() => {
        if (startedRef.current || files.length === 0) return;
        startedRef.current = true;
        void analyze();
    }, [analyze, files.length]);

    const handleFilesChange = (nextFiles: File[]) => {
        if (nextFiles.length > 0) {
            try {
                vehicleTollImportService.validateFiles(nextFiles);
            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : '통행료 이용내역 파일을 확인해 주세요.');
                return;
            }
        }
        setSelectedFiles(nextFiles);
        setRows([]);
        setErrorMessage('');
        setResultMessage('');
        setStatus('upload');
    };

    const updateRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
        setRows((current) => current.map((row) => rowKey(row.analysis) === key ? { ...row, ...patch } : row));
    }, []);

    const getRowIssues = useCallback((row: ReviewRow): string[] => {
        if (!row.selected) return [];
        const issues: string[] = [];
        if (row.analysis.duplicate) issues.push('이미 등록했거나 중복된 통행료 이용내역입니다.');
        if (!row.selectedVehicleId || !vehicleById.has(row.selectedVehicleId)) issues.push('연결할 차량을 선택해 주세요.');
        if (!isValidDate(row.expenseDate)) {
            issues.push('대장 반영일을 확인해 주세요.');
        } else if (!row.expenseDate.startsWith(`${yearMonth}-`)) {
            issues.push(`${yearMonth} 대장에 포함되는 반영일만 등록할 수 있습니다.`);
        }
        if (!Number.isFinite(row.amount) || row.amount <= 0) issues.push('통행료 금액을 확인해 주세요.');
        return issues;
    }, [vehicleById, yearMonth]);

    const selectedRows = rows.filter((row) => row.selected);
    const invalidCount = selectedRows.filter((row) => getRowIssues(row).length > 0).length;
    const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const fileNameMatchedCount = rows.filter((row) => row.autoMatchedByFileName).length;
    const vehicleSelectionNeededCount = rows.filter((row) => !row.analysis.duplicate && !row.selectedVehicleId).length;
    const duplicateCount = rows.filter((row) => row.analysis.duplicate).length;
    const tooManySelected = selectedRows.length > MAX_COMMIT_ITEMS;
    const canCommit = status === 'review' && selectedRows.length > 0 && invalidCount === 0 && !tooManySelected;
    const currentStep = status === 'upload' ? 0 : status === 'analyzing' || status === 'failed' ? 1 : 2;

    const handleCommit = async () => {
        if (!canCommit) return;
        setStatus('committing');
        setErrorMessage('');
        try {
            const result = await vehicleTollImportService.commit({
                operationId: vehicleTollImportService.createOperationId(),
                items: selectedRows.map((row) => {
                    return {
                        fileIndex: row.analysis.fileIndex,
                        entryIndex: row.analysis.entryIndex,
                        vehicleId: row.selectedVehicleId,
                        manualMatch: !row.autoMatchedByFileName,
                        expenseDate: row.expenseDate,
                        amount: Math.round(row.amount),
                        analysis: row.analysis,
                    };
                }),
            });
            setResultMessage(`${result.createdCount}건을 등록했습니다.${result.duplicateCount > 0 ? ` 중복 ${result.duplicateCount}건은 건너뛰었습니다.` : ''}`);
            setStatus('done');
            onCommitted(result);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '통행료 대장 등록에 실패했습니다.');
            setStatus('review');
        }
    };

    const allSelectableSelected = rows.filter((row) => !row.analysis.duplicate).length > 0
        && rows.filter((row) => !row.analysis.duplicate).every((row) => row.selected);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="vehicle-toll-import-title">
            <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        <h2 id="vehicle-toll-import-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900 sm:text-lg">
                            <Sparkles className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                            통행료 명세서 총액 AI 등록
                            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700">Gemini</span>
                        </h2>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm">{yearMonth} 대장 · 명세서 파일별 총액을 차량별 비용 한 건으로 등록합니다.</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={status === 'committing'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40" title="닫기" aria-label="닫기">
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-6">
                    {['파일 업로드', 'AI 분석', '검토 및 등록'].map((label, index) => (
                        <div key={label} className={`flex items-center gap-2 text-xs font-extrabold ${index <= currentStep ? 'text-indigo-700' : 'text-slate-400'}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${index <= currentStep ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-400'}`}>{index + 1}</span>
                            <span className="truncate">{label}</span>
                        </div>
                    ))}
                </div>

                {status === 'upload' && (
                    <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_320px] sm:p-6">
                        <AiDocumentDropzone
                            files={selectedFiles}
                            title="통행료 명세서를 올려 주세요"
                            description="교통카드·하이패스 명세서를 올리면 파일별 총 금액만 읽어 차량 통합관리대장에 한 건으로 등록합니다."
                            maxFiles={20}
                            onFilesChange={handleFilesChange}
                        />
                        <aside className="border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-extrabold text-slate-900">분석 및 등록 기준</h3>
                            <dl className="mt-4 space-y-3 text-xs leading-5">
                                <div><dt className="font-bold text-slate-500">대상 월</dt><dd className="mt-1 font-extrabold text-slate-800">{yearMonth}</dd></div>
                                <div><dt className="font-bold text-slate-500">파일별 총액</dt><dd className="mt-1 font-semibold text-slate-700">명세서 헤더의 총 건수·총 금액만 추출해 파일당 한 건으로 등록합니다.</dd></div>
                                <div><dt className="font-bold text-slate-500">차량 연결</dt><dd className="mt-1 font-semibold text-slate-700">교통카드 명세서에는 차량번호가 없으므로 차량을 직접 선택합니다.</dd></div>
                                <div><dt className="font-bold text-slate-500">중복 방지</dt><dd className="mt-1 font-semibold text-slate-700">카드번호·조회기간·총액으로 이미 등록한 명세서를 제외합니다.</dd></div>
                            </dl>
                            {errorMessage && <p className="mt-4 border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">{errorMessage}</p>}
                            <button type="button" onClick={() => void analyze()} disabled={selectedFiles.length === 0} className="mt-5 w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                                {selectedFiles.length}건 업로드 후 분석
                            </button>
                        </aside>
                    </div>
                )}

                {(status === 'analyzing' || status === 'committing') && (
                    <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <LoaderCircle className="h-10 w-10 animate-spin text-indigo-600" />
                        <h3 className="mt-4 text-base font-extrabold text-slate-900">{status === 'analyzing' ? '통행료 이용내역을 분석하고 있습니다' : '확인한 통행료를 등록하고 있습니다'}</h3>
                        <p className="mt-2 max-w-xl text-sm text-slate-500">
                            {status === 'analyzing'
                                ? `${progress.completedFiles} / ${progress.totalFiles} 완료${progress.currentFileName ? ` · ${progress.currentFileName}` : ''}`
                                : '중복 여부와 차량 연결을 서버 트랜잭션으로 확인합니다.'}
                        </p>
                        {status === 'analyzing' && <div className="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress.totalFiles ? (progress.completedFiles / progress.totalFiles) * 100 : 4}%` }} /></div>}
                    </div>
                )}

                {status === 'failed' && (
                    <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <AlertTriangle className="h-10 w-10 text-rose-500" />
                        <h3 className="mt-4 font-extrabold text-slate-900">분석하지 못했습니다</h3>
                        <p className="mt-2 max-w-2xl text-sm text-rose-700">{errorMessage}</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => setStatus('upload')} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">파일 다시 선택</button>
                            <button type="button" onClick={() => void analyze()} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700"><RefreshCw className="h-4 w-4" /> 다시 분석</button>
                        </div>
                    </div>
                )}

                {status === 'done' && (
                    <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                        <h3 className="mt-4 text-lg font-extrabold text-slate-900">통행료 등록 완료</h3>
                        <p className="mt-2 text-sm font-semibold text-slate-600">{resultMessage}</p>
                        <button type="button" onClick={onClose} className="mt-6 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800">확인</button>
                    </div>
                )}

                {status === 'review' && (
                    <>
                        <section className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 sm:grid-cols-5">
                            {[
                                ['명세서', `${rows.length}건`],
                                ['파일명 자동 연결', `${fileNameMatchedCount}건`],
                                ['차량 선택 필요', `${vehicleSelectionNeededCount}건`],
                                ['중복 제외', `${duplicateCount}건`],
                                ['등록 합계', `${formatAmount(selectedTotal)}원`],
                            ].map(([label, value]) => <div key={label} className="border-r border-slate-200 px-3 py-2.5 last:border-r-0 sm:px-4"><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-0.5 text-sm font-extrabold text-slate-900">{value}</p></div>)}
                        </section>
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 sm:px-6">
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                    <input type="checkbox" checked={allSelectableSelected} onChange={(event) => setRows((current) => current.map((row) => row.analysis.duplicate ? row : { ...row, selected: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    등록 가능한 항목 전체 선택
                                </label>
                                <span className="text-[11px] font-semibold text-slate-500">금액·반영일·차량을 확인한 뒤 등록해 주세요.</span>
                            </div>
                            <div className="divide-y divide-slate-200">
                                {rows.map((row) => {
                                    const key = rowKey(row.analysis);
                                    const issues = getRowIssues(row);
                                    const selectedVehicle = vehicleById.get(row.selectedVehicleId);
                                    const preview = previewUrls.find((item) => item.fileIndex === row.analysis.fileIndex);
                                    const warnings = row.analysis.warnings;
                                    return (
                                        <article key={key} className={`px-4 py-4 sm:px-6 ${row.selected ? 'bg-white' : 'bg-slate-50/80'}`}>
                                            <div className="grid gap-4 xl:grid-cols-[minmax(210px,0.9fr)_minmax(360px,1.6fr)_minmax(300px,1.1fr)]">
                                                <div className="min-w-0">
                                                    <div className="flex items-start gap-3">
                                                        <input type="checkbox" checked={row.selected} disabled={row.analysis.duplicate} onChange={(event) => updateRow(key, { selected: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40" aria-label={`${row.analysis.originalFileName} 등록 선택`} />
                                                        <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{row.analysis.originalFileName}</p><p className="mt-1 text-xs font-semibold text-slate-500">{row.analysis.provider || '발급기관 미확인'} · 명세서 총액</p></div>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                                                        <span className={`rounded border px-2 py-1 text-[11px] font-extrabold ${confidenceClass(row.analysis.confidence)}`}>신뢰도 {Math.round(row.analysis.confidence * 100)}%</span>
                                                        {row.analysis.duplicate ? <span className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-extrabold text-rose-700">중복 제외</span> : row.autoMatchedByFileName ? <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-700">파일명 차량번호 자동 연결</span> : row.selectedVehicleId ? <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-700">차량 연결 완료</span> : <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-700">차량 선택 필요</span>}
                                                        {preview && <button type="button" onClick={() => window.open(preview.url, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"><ExternalLink className="h-3.5 w-3.5" /> 원본 보기</button>}
                                                    </div>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <div><label className="text-[11px] font-bold text-slate-500">명세서 조회기간</label><p className="mt-2 text-sm font-extrabold text-slate-900">{row.analysis.statementPeriod || '미확인'}</p></div>
                                                    <div><label className="text-[11px] font-bold text-slate-500">총 이용 건수</label><p className="mt-2 text-sm font-extrabold text-slate-900">{row.analysis.totalCount > 0 ? `${formatAmount(row.analysis.totalCount)}건` : '미확인'}</p></div>
                                                    <div><label className="text-[11px] font-bold text-slate-500">명세서 총 금액</label><div className="mt-1 flex items-center gap-1"><input type="number" min={0} step={100} value={row.amount || ''} onChange={(event) => updateRow(key, { amount: Number(event.target.value) || 0 })} className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-right text-sm font-extrabold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-500">원</span></div></div>
                                                    <div><label className="text-[11px] font-bold text-slate-500">대장 반영일</label><input type="date" aria-label={`${row.analysis.originalFileName} 대장 반영일`} min={`${yearMonth}-01`} max={getMonthEndDate(yearMonth)} value={row.expenseDate} onChange={(event) => updateRow(key, { expenseDate: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                                                    <div><label className="text-[11px] font-bold text-slate-500">교통카드 번호</label><p className="mt-2 text-sm font-bold text-slate-800">{row.analysis.cardNumber || '미확인'}</p></div>
                                                </div>
                                                <div className="min-w-0">
                                                    <label className="text-[11px] font-bold text-slate-500">대상 차량 연결</label>
                                                    <select value={row.selectedVehicleId} onChange={(event) => updateRow(key, { selectedVehicleId: event.target.value, autoMatchedByFileName: false })} disabled={!row.selected} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"><option value="">차량을 선택해 주세요</option>{sortedVehicles.map((vehicle) => <option key={vehicle.id} value={String(vehicle.id)}>{vehicle.licensePlate} · {vehicle.model || '모델 미입력'}</option>)}</select>
                                                    {selectedVehicle && <div className={`mt-2 rounded-md border px-2.5 py-2 text-xs font-bold ${row.autoMatchedByFileName ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" /><span>{row.autoMatchedByFileName ? `파일명 끝번호 ${row.analysis.fileNameVehicleSuffix}로 자동 연결했습니다. 원본을 확인해 주세요.` : '수동 차량 연결 — 원본 명세서를 확인해 주세요.'}</span></div></div>}
                                                    {(issues.length > 0 || warnings.length > 0) && <div className="mt-2 space-y-1">{issues.map((issue) => <p key={`issue-${issue}`} className="flex items-start gap-1 text-[11px] font-bold text-rose-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{issue}</p>)}{warnings.slice(0, 3).map((warning) => <p key={`warning-${warning}`} className="flex items-start gap-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{warning}</p>)}</div>}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                        <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                            {errorMessage && <p className="mb-2 text-sm font-bold text-rose-700">{errorMessage}</p>}
                            {tooManySelected && <p className="mb-2 text-sm font-bold text-rose-700">한 번에 최대 {MAX_COMMIT_ITEMS}건까지 등록할 수 있습니다. 선택 항목을 나누어 등록해 주세요.</p>}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs font-semibold text-slate-500">선택 {selectedRows.length}건 · 확인 필요 {invalidCount}건 · 합계 <strong className="text-slate-900">{formatAmount(selectedTotal)}원</strong></div><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setStatus('upload')} className="rounded-md border border-slate-300 px-3 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50">파일 다시 선택</button><button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">취소</button><button type="button" onClick={() => void handleCommit()} disabled={!canCommit} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"><FileSearch className="h-4 w-4" /> {selectedRows.length}건 대장 등록</button></div></div>
                        </footer>
                    </>
                )}
            </div>
        </div>
    );
};

export default VehicleTollImportModal;
