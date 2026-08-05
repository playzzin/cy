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
import type {
    CommitVehicleFineImportsResult,
    VehicleFineNoticeAnalysis,
} from '../../types/vehicleFineImport';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';
import {
    isManualVehicleFineMatch,
    matchVehicleFineNoticeToVehicle,
    normalizeVehiclePlate,
    type VehicleFineMatchResult,
} from '../../utils/vehicleFineMatching';
import AiDocumentDropzone from '../common/AiDocumentDropzone';

interface VehicleFineImportModalProps {
    yearMonth: string;
    files?: File[];
    vehicles: Vehicle[];
    onClose: () => void;
    onCommitted: (result: CommitVehicleFineImportsResult) => void;
}

interface ReviewRow {
    analysis: VehicleFineNoticeAnalysis;
    match: VehicleFineMatchResult;
    selected: boolean;
    selectedVehicleId: string;
    vehicleConfirmed: boolean;
    expenseDate: string;
    payableAmount: number;
}

const formatAmount = (amount: number): string => Number(amount || 0).toLocaleString('ko-KR');
const isValidDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getMonthEndDate = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    const day = new Date(year, month, 0).getDate();
    return `${yearMonth}-${String(day).padStart(2, '0')}`;
};

const confidenceClass = (confidence: number): string => {
    if (confidence >= 0.9) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (confidence >= 0.7) return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-rose-200 bg-rose-50 text-rose-700';
};

const noticeTypeLabel = (type: VehicleFineNoticeAnalysis['noticeType']): string => {
    if (type === 'PARKING_FINE') return '주정차 과태료';
    if (type === 'TRAFFIC_FINE') return '교통 과태료';
    return '기타 과태료';
};

const plateSourceLabel = (source: VehicleFineNoticeAnalysis['plateSource']): string => {
    if (source === 'VIOLATION_VEHICLE') return '위반차량';
    if (source === 'CHARGED_VEHICLE') return '부과대상';
    if (source === 'PLATE_IMAGE') return '차량 사진';
    return '출처 불명';
};

const VehicleFineImportModal: React.FC<VehicleFineImportModalProps> = ({
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
        mimeType: String(file.type || '').toLowerCase(),
    })), [selectedFiles]);

    useEffect(() => () => previewUrls.forEach((preview) => URL.revokeObjectURL(preview.url)), [previewUrls]);

    const analyze = useCallback(async () => {
        try {
            vehicleFineImportService.validateFiles(selectedFiles);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '과태료 고지서 파일을 확인해 주세요.');
            setStatus('upload');
            return;
        }
        setStatus('analyzing');
        setErrorMessage('');
        setResultMessage('');
        setProgress({ completedFiles: 0, totalFiles: selectedFiles.length, currentFileName: '' });
        try {
            const analyses = await vehicleFineImportService.analyzeFiles(
                selectedFiles,
                setProgress,
                sortedVehicles.map((vehicle) => vehicle.licensePlate),
            );
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
                            '같은 고지서가 현재 선택 파일에 중복 포함되어 제외되었습니다.',
                        ])),
                    }
                    : rawAnalysis;
                const match = matchVehicleFineNoticeToVehicle(analysis, sortedVehicles);
                const matchedAnalysis = !analysis.duplicate && match.status === 'auto_matched' && match.matchedLicensePlate
                    ? { ...analysis, licensePlate: normalizeVehiclePlate(match.matchedLicensePlate) }
                    : analysis;
                return {
                    analysis: matchedAnalysis,
                    match,
                    selected: !matchedAnalysis.duplicate && matchedAnalysis.payableAmount > 0,
                    selectedVehicleId: match.selectedVehicleId,
                    vehicleConfirmed: match.status === 'auto_matched' || !match.selectedVehicleId,
                    expenseDate: matchedAnalysis.dueDate.startsWith(yearMonth)
                        ? matchedAnalysis.dueDate
                        : matchedAnalysis.violationDate.startsWith(yearMonth)
                            ? matchedAnalysis.violationDate
                            : `${yearMonth}-01`,
                    payableAmount: matchedAnalysis.payableAmount,
                };
            });
            setRows(nextRows);
            setStatus('review');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '과태료 고지서 분석에 실패했습니다.');
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
                vehicleFineImportService.validateFiles(nextFiles);
            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : '과태료 고지서 파일을 확인해 주세요.');
                return;
            }
        }
        setSelectedFiles(nextFiles);
        setRows([]);
        setErrorMessage('');
        setResultMessage('');
        setStatus('upload');
    };

    const updateRow = useCallback((fileIndex: number, patch: Partial<ReviewRow>) => {
        setRows((current) => current.map((row) => (
            row.analysis.fileIndex === fileIndex ? { ...row, ...patch } : row
        )));
    }, []);

    const getRowIssues = useCallback((row: ReviewRow): string[] => {
        if (!row.selected) return [];
        const issues: string[] = [];
        if (row.analysis.duplicate) issues.push('이미 등록되었거나 중복 첨부된 고지서입니다.');
        if (!row.selectedVehicleId || !vehicleById.has(row.selectedVehicleId)) issues.push('연결할 차량을 선택해 주세요.');
        if (row.selectedVehicleId && !row.vehicleConfirmed) issues.push('추천 차량번호를 확인해 주세요.');
        if (!isValidDate(row.expenseDate)) {
            issues.push('대장 반영일을 확인해 주세요.');
        } else if (!row.expenseDate.startsWith(`${yearMonth}-`)) {
            issues.push(`${yearMonth} 대장에 포함되는 반영일만 등록할 수 있습니다.`);
        }
        if (!Number.isFinite(row.payableAmount) || row.payableAmount <= 0) issues.push('실제 납부할 과태료 금액을 확인해 주세요.');
        return issues;
    }, [vehicleById, yearMonth]);

    const selectedRows = rows.filter((row) => row.selected);
    const invalidCount = selectedRows.filter((row) => getRowIssues(row).length > 0).length;
    const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.payableAmount || 0), 0);
    const autoMatchedCount = rows.filter((row) => row.match.status === 'auto_matched').length;
    const reviewCount = rows.filter((row) => !row.analysis.duplicate && row.match.status !== 'auto_matched').length;
    const duplicateCount = rows.filter((row) => row.analysis.duplicate).length;
    const canCommit = status === 'review' && selectedRows.length > 0 && invalidCount === 0;
    const currentStep = status === 'upload' ? 0 : status === 'analyzing' || status === 'failed' ? 1 : 2;

    const handleCommit = async () => {
        if (!canCommit) return;
        setStatus('committing');
        setErrorMessage('');
        try {
            const operationId = vehicleFineImportService.createOperationId();
            const result = await vehicleFineImportService.commit({
                operationId,
                items: selectedRows.map((row) => {
                    const selectedVehicle = vehicleById.get(row.selectedVehicleId);
                    return {
                        fileIndex: row.analysis.fileIndex,
                        vehicleId: row.selectedVehicleId,
                        manualMatch: row.match.status !== 'auto_matched'
                            || isManualVehicleFineMatch(row.analysis.licensePlate, selectedVehicle),
                        expenseDate: row.expenseDate,
                        payableAmount: Math.round(row.payableAmount),
                        analysis: row.analysis,
                    };
                }),
            });
            setResultMessage(`${result.createdCount}건을 등록했습니다.${result.duplicateCount > 0 ? ` 중복 ${result.duplicateCount}건은 건너뛰었습니다.` : ''}`);
            setStatus('done');
            onCommitted(result);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '과태료 대장 등록에 실패했습니다.');
            setStatus('review');
        }
    };

    const allSelectableSelected = rows.filter((row) => !row.analysis.duplicate).length > 0
        && rows.filter((row) => !row.analysis.duplicate).every((row) => row.selected);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="vehicle-fine-import-title">
            <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        <h2 id="vehicle-fine-import-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900 sm:text-lg">
                            <Sparkles className="h-5 w-5 text-blue-600" aria-hidden="true" />
                            과태료 고지서 일괄등록
                            <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">고정밀 Gemini</span>
                        </h2>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm">{yearMonth} 대장 · 첨부 {selectedFiles.length}건 · 차량번호 자동 연결 · 중복 고지 차단</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={status === 'committing'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40" title="닫기" aria-label="닫기">
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-6">
                    {['파일 업로드', 'AI 분석', '검수·등록'].map((label, index) => (
                        <div key={label} className={`flex items-center gap-2 text-xs font-extrabold ${index <= currentStep ? 'text-blue-700' : 'text-slate-400'}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${index <= currentStep ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-400'}`}>{index + 1}</span>
                            <span className="truncate">{label}</span>
                        </div>
                    ))}
                </div>

                {status === 'upload' && (
                    <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_320px] sm:p-6">
                        <AiDocumentDropzone
                            files={selectedFiles}
                            title="과태료 고지서를 끌어다 놓으세요"
                            description="여러 고지서를 한 번에 올리면 부과대상·위반차량·차량 사진 번호판을 각각 판독해 차량 대장과 연결합니다."
                            maxFiles={20}
                            onFilesChange={handleFilesChange}
                        />
                        <aside className="border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-extrabold text-slate-900">분석·매칭 기준</h3>
                            <dl className="mt-4 space-y-3 text-xs">
                                <div><dt className="font-bold text-slate-500">대장 월</dt><dd className="mt-1 font-extrabold text-slate-800">{yearMonth}</dd></div>
                                <div><dt className="font-bold text-slate-500">차량번호 우선순위</dt><dd className="mt-1 font-semibold leading-5 text-slate-700">부과대상 → 위반차량 → 증거사진 번호판</dd></div>
                                <div><dt className="font-bold text-slate-500">판독 방식</dt><dd className="mt-1 font-semibold leading-5 text-slate-700">문서 전체 분석 후 차량번호 영역을 한 번 더 집중 판독합니다.</dd></div>
                                <div><dt className="font-bold text-slate-500">대장 연결</dt><dd className="mt-1 font-semibold leading-5 text-slate-700">정확 일치는 자동 연결하고, 한 글자 OCR 유사 차량은 미리 선택한 뒤 확인을 요구합니다.</dd></div>
                                <div><dt className="font-bold text-slate-500">인식 모델</dt><dd className="mt-1 font-semibold text-blue-700">AI 설정의 문서 OCR 모델</dd></div>
                            </dl>
                            {errorMessage && <p className="mt-4 border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">{errorMessage}</p>}
                            <button
                                type="button"
                                onClick={() => void analyze()}
                                disabled={selectedFiles.length === 0}
                                className="mt-5 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {selectedFiles.length}건 업로드 후 분석
                            </button>
                        </aside>
                    </div>
                )}

                {(status === 'analyzing' || status === 'committing') && (
                    <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" />
                        <h3 className="mt-4 text-base font-extrabold text-slate-900">
                            {status === 'analyzing' ? '고지서를 분석하고 있습니다' : '검수한 과태료를 등록하고 있습니다'}
                        </h3>
                        <p className="mt-2 max-w-xl text-sm text-slate-500">
                            {status === 'analyzing'
                                ? `${progress.completedFiles} / ${progress.totalFiles} 완료${progress.currentFileName ? ` · ${progress.currentFileName}` : ''}`
                                : '중복 확인과 차량 검증을 서버 트랜잭션으로 처리합니다.'}
                        </p>
                        {status === 'analyzing' && (
                            <div className="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress.totalFiles ? (progress.completedFiles / progress.totalFiles) * 100 : 4}%` }} />
                            </div>
                        )}
                    </div>
                )}

                {status === 'failed' && (
                    <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <AlertTriangle className="h-10 w-10 text-rose-500" />
                        <h3 className="mt-4 font-extrabold text-slate-900">분석하지 못했습니다</h3>
                        <p className="mt-2 max-w-2xl text-sm text-rose-700">{errorMessage}</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => setStatus('upload')} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">파일 다시 선택</button>
                            <button type="button" onClick={() => void analyze()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700">
                                <RefreshCw className="h-4 w-4" /> 다시 분석
                            </button>
                        </div>
                    </div>
                )}

                {status === 'done' && (
                    <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                        <h3 className="mt-4 text-lg font-extrabold text-slate-900">과태료 등록 완료</h3>
                        <p className="mt-2 text-sm font-semibold text-slate-600">{resultMessage}</p>
                        <p className="mt-1 text-xs text-slate-500">차량 통합관리대장의 위반일자 월 과태료 합계에 반영되었습니다.</p>
                        <button type="button" onClick={onClose} className="mt-6 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800">확인</button>
                    </div>
                )}

                {status === 'review' && (
                    <>
                        <section className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 sm:grid-cols-5">
                            {[
                                ['첨부', `${rows.length}건`],
                                ['자동 연결', `${autoMatchedCount}건`],
                                ['확인 필요', `${reviewCount}건`],
                                ['중복 제외', `${duplicateCount}건`],
                                ['등록 합계', `${formatAmount(selectedTotal)}원`],
                            ].map(([label, value]) => (
                                <div key={label} className="border-r border-slate-200 px-3 py-2.5 last:border-r-0 sm:px-4">
                                    <p className="text-[10px] font-bold text-slate-500">{label}</p>
                                    <p className="mt-0.5 text-sm font-extrabold text-slate-900">{value}</p>
                                </div>
                            ))}
                        </section>

                        <div className="flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 sm:px-6">
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={allSelectableSelected}
                                        onChange={(event) => setRows((current) => current.map((row) => row.analysis.duplicate ? row : { ...row, selected: event.target.checked }))}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    검수 가능 항목 전체 선택
                                </label>
                                <span className="text-[11px] font-semibold text-slate-500">금액과 차량을 확인한 뒤 등록하세요.</span>
                            </div>

                            <div className="divide-y divide-slate-200">
                                {rows.map((row) => {
                                    const issues = getRowIssues(row);
                                    const selectedVehicle = vehicleById.get(row.selectedVehicleId);
                                    const manualMatch = row.match.status !== 'auto_matched'
                                        || isManualVehicleFineMatch(row.analysis.licensePlate, selectedVehicle);
                                    const preview = previewUrls.find((item) => item.fileIndex === row.analysis.fileIndex);
                                    const warnings = Array.from(new Set([...row.analysis.warnings, ...row.match.warnings]));
                                    const plateCandidates = row.analysis.licensePlateCandidates || [];
                                    return (
                                        <article key={row.analysis.fileIndex} className={`px-4 py-4 sm:px-6 ${row.selected ? 'bg-white' : 'bg-slate-50/80'}`}>
                                            <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.9fr)_minmax(360px,1.6fr)_minmax(300px,1.1fr)]">
                                                <div className="min-w-0">
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={row.selected}
                                                            disabled={row.analysis.duplicate}
                                                            onChange={(event) => updateRow(row.analysis.fileIndex, { selected: event.target.checked })}
                                                            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                                            aria-label={`${row.analysis.originalFileName} 등록 선택`}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-extrabold text-slate-900">{row.analysis.originalFileName}</p>
                                                            <p className="mt-1 text-xs font-semibold text-slate-500">{row.analysis.issuer || '발급기관 미확인'} · {noticeTypeLabel(row.analysis.noticeType)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                                                        <span className={`rounded border px-2 py-1 text-[11px] font-extrabold ${confidenceClass(row.analysis.confidence)}`}>신뢰도 {Math.round(row.analysis.confidence * 100)}%</span>
                                                        {row.analysis.duplicate ? (
                                                            <span className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-extrabold text-rose-700">중복 제외</span>
                                                        ) : row.match.status === 'auto_matched' ? (
                                                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-700">자동 연결</span>
                                                        ) : (
                                                            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-700">차량 확인 필요</span>
                                                        )}
                                                        {preview && (
                                                            <button type="button" onClick={() => window.open(preview.url, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50">
                                                                <ExternalLink className="h-3.5 w-3.5" /> 원본 보기
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-500">추출 차량번호</label>
                                                        <p className="mt-1 text-base font-black text-slate-900">{row.analysis.licensePlate || '미확인'}</p>
                                                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                                            판독 기준: {plateSourceLabel(row.analysis.plateSource)}
                                                            {row.analysis.plateConfidence !== undefined ? ` · 번호 신뢰도 ${Math.round(row.analysis.plateConfidence * 100)}%` : ''}
                                                        </p>
                                                        {row.analysis.plateEvidence && <p className="mt-1 text-[10px] text-slate-500">근거: {row.analysis.plateEvidence}</p>}
                                                        {row.analysis.chargedTargetPlate && <p className="mt-1 text-[10px] font-semibold text-slate-600">부과대상: {row.analysis.chargedTargetPlate}</p>}
                                                        {row.analysis.violationVehiclePlate && <p className="mt-1 text-[10px] font-semibold text-slate-600">위반차량: {row.analysis.violationVehiclePlate}</p>}
                                                        {row.analysis.plateImagePlate && <p className="mt-1 text-[10px] font-semibold text-slate-600">사진 번호판: {row.analysis.plateImagePlate}</p>}
                                                        {plateCandidates.length > 1 && <p className="mt-1 text-[10px] font-bold text-amber-700">후보: {plateCandidates.join(' / ')}</p>}
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-500">실제 납부금액</label>
                                                        <div className="mt-1 flex items-center gap-1">
                                                            <input type="number" min={0} step={100} value={row.payableAmount || ''} onChange={(event) => updateRow(row.analysis.fileIndex, { payableAmount: Number(event.target.value) || 0 })} className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-right text-sm font-extrabold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                            <span className="text-xs font-bold text-slate-500">원</span>
                                                        </div>
                                                        {(row.analysis.originalAmount > 0 || row.analysis.reductionAmount > 0) && (
                                                            <p className="mt-1 text-[10px] font-medium text-slate-500">최초 {formatAmount(row.analysis.originalAmount)}원 · 감경 {formatAmount(row.analysis.reductionAmount)}원</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-500">대장 반영일</label>
                                                        <input
                                                            type="date"
                                                            aria-label={`${row.analysis.originalFileName} 대장 반영일`}
                                                            min={`${yearMonth}-01`}
                                                            max={getMonthEndDate(yearMonth)}
                                                            value={row.expenseDate}
                                                            onChange={(event) => updateRow(row.analysis.fileIndex, { expenseDate: event.target.value })}
                                                            className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-500">납부기한</label>
                                                        <p className="mt-2 text-sm font-bold text-slate-800">{row.analysis.dueDate || '미확인'}</p>
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <p className="text-xs font-semibold text-slate-700">{row.analysis.violationDescription || '위반내용 미확인'}</p>
                                                        <p className="mt-1 text-xs text-slate-500">{row.analysis.violationLocation || '위반장소 미확인'}</p>
                                                        <p className="mt-1 text-[11px] font-semibold text-slate-500">실제 위반일시 {row.analysis.violationDateTime || row.analysis.violationDate || '미확인'}</p>
                                                    </div>
                                                </div>

                                                <div className="min-w-0">
                                                    <label className="text-[11px] font-bold text-slate-500">대장 차량 연결</label>
                                                    <select
                                                        value={row.selectedVehicleId}
                                                        onChange={(event) => updateRow(row.analysis.fileIndex, {
                                                            selectedVehicleId: event.target.value,
                                                            vehicleConfirmed: Boolean(event.target.value),
                                                        })}
                                                        disabled={!row.selected}
                                                        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        <option value="">차량을 선택하세요</option>
                                                        {sortedVehicles.map((vehicle) => (
                                                            <option key={vehicle.id} value={String(vehicle.id)}>{vehicle.licensePlate} · {vehicle.model || '모델 미입력'}</option>
                                                        ))}
                                                    </select>
                                                    {selectedVehicle && (
                                                        <div className={`mt-2 rounded-md border px-2.5 py-2 text-xs font-bold ${manualMatch ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                                                            <div className="flex items-center gap-2">
                                                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                                                <span>{manualMatch ? '수동 매칭 검수' : '차량번호 일치'} · 과태료 {selectedVehicle.fineChargeTarget === 'DRIVER' ? '운전자 부과' : '청구대상 부과'}</span>
                                                            </div>
                                                            {!row.vehicleConfirmed && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRow(row.analysis.fileIndex, { vehicleConfirmed: true })}
                                                                    className="mt-2 w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs font-extrabold text-amber-800 hover:bg-amber-100"
                                                                >
                                                                    추천 차량 확인
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {(issues.length > 0 || warnings.length > 0) && (
                                                        <div className="mt-2 space-y-1">
                                                            {issues.map((issue) => <p key={`issue-${issue}`} className="flex items-start gap-1 text-[11px] font-bold text-rose-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{issue}</p>)}
                                                            {warnings.slice(0, 3).map((warning) => <p key={`warning-${warning}`} className="flex items-start gap-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{warning}</p>)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>

                        <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                            {errorMessage && <p className="mb-2 text-sm font-bold text-rose-700">{errorMessage}</p>}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs font-semibold text-slate-500">
                                    선택 {selectedRows.length}건 · 확인 필요 {invalidCount}건 · 합계 <strong className="text-slate-900">{formatAmount(selectedTotal)}원</strong>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => setStatus('upload')} className="rounded-md border border-slate-300 px-3 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-50">파일 다시 선택</button>
                                    <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">취소</button>
                                    <button type="button" onClick={() => void handleCommit()} disabled={!canCommit} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                                        <FileSearch className="h-4 w-4" /> {selectedRows.length}건 대장 등록
                                    </button>
                                </div>
                            </div>
                        </footer>
                    </>
                )}
            </div>
        </div>
    );
};

export default VehicleFineImportModal;
