import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Check,
    Droplets,
    FileImage,
    FileText,
    Flame,
    LoaderCircle,
    RefreshCw,
    X,
    Zap,
} from 'lucide-react';
import { Accommodation, UtilityRecord } from '../../types/accommodation';
import {
    AccommodationElectricityBillMatchResult,
    AccommodationUtilityBillApplyItem,
    AccommodationUtilityBillType,
} from '../../types/accommodationElectricityBillImport';
import {
    accommodationElectricityBillService,
    accommodationGasBillService,
    accommodationWaterBillService,
} from '../../services/accommodationElectricityBillService';
import {
    findDuplicateAccommodationSelections,
    matchElectricityBillToAccommodation,
} from '../../utils/accommodationElectricityBillMatching';
import { hasAccommodationUtilityBillSource } from '../../utils/accommodationUtilityDeduplication';
import AiDocumentDropzone from '../common/AiDocumentDropzone';

interface AccommodationUtilityBillImportModalProps {
    utilityType?: AccommodationUtilityBillType;
    yearMonth: string;
    files?: File[];
    accommodations: Accommodation[];
    records: UtilityRecord[];
    blockedAccommodationIds: Set<string>;
    onClose: () => void;
    onApply: (items: AccommodationUtilityBillApplyItem[]) => void;
}

interface ReviewAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256?: string;
    provider: string;
    customerName: string;
    accountNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    billAmount: number;
    usageAmount: number;
    confidence: number;
    warnings: string[];
}

interface ReviewRow {
    analysis: ReviewAnalysis;
    match: AccommodationElectricityBillMatchResult;
    selected: boolean;
    selectedAccommodationId: string;
    billAmount: number;
    billingYearMonth: string;
}

const formatAmount = (amount: number): string => Number(amount || 0).toLocaleString('ko-KR');

const getConfidenceStyle = (confidence: number): string => {
    if (confidence >= 0.9) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (confidence >= 0.7) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
};

const UTILITY_REVIEW_CONFIG = {
    electricity: {
        billLabel: '전기요금',
        costLabel: '전기세',
        accountLabel: '고객번호',
        usageUnit: 'kWh',
        Icon: Zap,
        accentTextClass: 'text-indigo-700',
        accentIconClass: 'text-indigo-600',
        accentBarClass: 'bg-indigo-600',
        accentButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
    },
    gas: {
        billLabel: '가스요금',
        costLabel: '가스비',
        accountLabel: '납부자번호',
        usageUnit: 'm³',
        Icon: Flame,
        accentTextClass: 'text-amber-700',
        accentIconClass: 'text-amber-600',
        accentBarClass: 'bg-amber-600',
        accentButtonClass: 'bg-amber-600 hover:bg-amber-700',
    },
    water: {
        billLabel: '수도요금',
        costLabel: '수도료',
        accountLabel: '수용가번호',
        usageUnit: 'm³',
        Icon: Droplets,
        accentTextClass: 'text-cyan-700',
        accentIconClass: 'text-cyan-600',
        accentBarClass: 'bg-cyan-600',
        accentButtonClass: 'bg-cyan-600 hover:bg-cyan-700',
    },
} as const;

const AccommodationUtilityBillImportModal: React.FC<AccommodationUtilityBillImportModalProps> = ({
    utilityType = 'electricity',
    yearMonth,
    files = [],
    accommodations,
    records,
    blockedAccommodationIds,
    onClose,
    onApply,
}) => {
    const utilityConfig = UTILITY_REVIEW_CONFIG[utilityType];
    const {
        billLabel,
        costLabel,
        accountLabel,
        usageUnit,
        Icon,
        accentTextClass,
        accentIconClass,
        accentBarClass,
        accentButtonClass,
    } = utilityConfig;
    const [status, setStatus] = useState<'upload' | 'analyzing' | 'review' | 'failed'>(files.length > 0 ? 'analyzing' : 'upload');
    const [selectedFiles, setSelectedFiles] = useState<File[]>(files);
    const [rows, setRows] = useState<ReviewRow[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState({ completedFiles: 0, totalFiles: files.length, currentFileName: '' });
    const startedRef = useRef(false);

    const previewUrls = useMemo(() => selectedFiles.map((file, fileIndex) => ({
        fileIndex,
        mimeType: String(file.type || '').toLowerCase(),
        url: URL.createObjectURL(file),
    })), [selectedFiles]);

    useEffect(() => () => {
        previewUrls.forEach((preview) => URL.revokeObjectURL(preview.url));
    }, [previewUrls]);

    const recordByAccommodationId = useMemo(() => {
        const map = new Map<string, UtilityRecord>();
        records.forEach((record) => {
            if (record.accommodationId) map.set(String(record.accommodationId), record);
        });
        return map;
    }, [records]);

    const availableAccommodations = useMemo(() => accommodations
        .filter((accommodation) => recordByAccommodationId.has(String(accommodation.id)))
        .sort((left, right) => left.name.localeCompare(right.name, 'ko', { numeric: true })), [accommodations, recordByAccommodationId]);

    const analyze = useCallback(async () => {
        const service = utilityType === 'gas'
            ? accommodationGasBillService
            : utilityType === 'water'
                ? accommodationWaterBillService
                : accommodationElectricityBillService;
        try {
            service.validateFiles(selectedFiles);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `${billLabel} 청구서 파일을 확인해 주세요.`);
            setStatus('upload');
            return;
        }
        setStatus('analyzing');
        setErrorMessage('');
        setProgress({ completedFiles: 0, totalFiles: selectedFiles.length, currentFileName: '' });
        try {
            let analyses: ReviewAnalysis[];
            if (utilityType === 'gas') {
                analyses = (await accommodationGasBillService.analyzeFiles(yearMonth, selectedFiles, setProgress)).map((analysis) => ({
                    ...analysis,
                    accountNumber: analysis.payerNumber,
                    billAmount: analysis.gasAmount,
                    usageAmount: analysis.usageCubicMeters,
                }));
            } else if (utilityType === 'water') {
                analyses = (await accommodationWaterBillService.analyzeFiles(yearMonth, selectedFiles, setProgress)).map((analysis) => ({
                    ...analysis,
                    accountNumber: analysis.consumerNumber,
                    billAmount: analysis.waterAmount,
                    usageAmount: analysis.usageCubicMeters,
                }));
            } else {
                analyses = (await accommodationElectricityBillService.analyzeFiles(yearMonth, selectedFiles, setProgress)).map((analysis) => ({
                    ...analysis,
                    accountNumber: analysis.customerNumber,
                    billAmount: analysis.electricityAmount,
                    usageAmount: analysis.usageKwh,
                }));
            }
            setRows(analyses.map((analysis) => {
                const match = matchElectricityBillToAccommodation(analysis, availableAccommodations);
                return {
                    analysis,
                    match,
                    selected: analysis.billAmount > 0,
                    selectedAccommodationId: match.selectedAccommodationId,
                    billAmount: analysis.billAmount,
                    billingYearMonth: analysis.billingYearMonth,
                };
            }));
            setStatus('review');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `${billLabel} 청구서 분석에 실패했습니다.`);
            setStatus('failed');
        }
    }, [availableAccommodations, billLabel, selectedFiles, utilityType, yearMonth]);

    useEffect(() => {
        if (startedRef.current || files.length === 0) return;
        startedRef.current = true;
        void analyze();
    }, [analyze, files.length]);

    const handleFilesChange = (nextFiles: File[]) => {
        if (nextFiles.length > 0) {
            const service = utilityType === 'gas'
                ? accommodationGasBillService
                : utilityType === 'water'
                    ? accommodationWaterBillService
                    : accommodationElectricityBillService;
            try {
                service.validateFiles(nextFiles);
            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : `${billLabel} 청구서 파일을 확인해 주세요.`);
                return;
            }
        }
        setSelectedFiles(nextFiles);
        setRows([]);
        setErrorMessage('');
        setStatus('upload');
    };

    const updateRow = useCallback((fileIndex: number, patch: Partial<ReviewRow>) => {
        setRows((current) => current.map((row) => (
            row.analysis.fileIndex === fileIndex ? { ...row, ...patch } : row
        )));
    }, []);

    const selectedAccommodationIds = rows
        .filter((row) => row.selected)
        .map((row) => row.selectedAccommodationId);
    const duplicateAccommodationIds = findDuplicateAccommodationSelections(selectedAccommodationIds);
    const duplicateSourceFileHashes = new Set<string>();
    const seenSourceFileHashes = new Set<string>();
    rows.filter((row) => row.selected).forEach((row) => {
        const sha256 = String(row.analysis.sourceFileSha256 || '').trim().toLowerCase();
        if (!sha256) return;
        if (seenSourceFileHashes.has(sha256)) duplicateSourceFileHashes.add(sha256);
        seenSourceFileHashes.add(sha256);
    });

    const getRowIssues = useCallback((row: ReviewRow): string[] => {
        if (!row.selected) return [];
        const issues: string[] = [];
        const accommodation = availableAccommodations.find((item) => item.id === row.selectedAccommodationId);
        if (!row.selectedAccommodationId || !recordByAccommodationId.has(row.selectedAccommodationId)) {
            issues.push('숙소를 선택해 주세요.');
        }
        if (!Number.isFinite(row.billAmount) || row.billAmount <= 0) {
            issues.push('청구금액을 확인해 주세요.');
        }
        if (row.billingYearMonth !== yearMonth) {
            issues.push(`청구월이 대장 월(${yearMonth})과 다릅니다.`);
        }
        if (duplicateAccommodationIds.has(row.selectedAccommodationId)) {
            issues.push('같은 숙소가 두 번 선택되었습니다.');
        }
        const sourceFileSha256 = String(row.analysis.sourceFileSha256 || '').trim().toLowerCase();
        if (sourceFileSha256 && duplicateSourceFileHashes.has(sourceFileSha256)) {
            issues.push('동일한 청구서 파일이 두 번 첨부되었습니다.');
        }
        if (hasAccommodationUtilityBillSource(records, utilityType, row.selectedAccommodationId, {
            sourceFileName: row.analysis.originalFileName,
            sourceFileSha256,
            billingYearMonth: row.billingYearMonth,
            provider: row.analysis.provider,
        })) {
            issues.push('이미 대장에 반영된 동일 청구서 파일입니다.');
        }
        if (blockedAccommodationIds.has(row.selectedAccommodationId)) {
            issues.push('이미 청구 처리된 숙소입니다. 먼저 미청구로 변경해 주세요.');
        }
        if (accommodation?.costProfile?.[utilityType] === 'included') {
            issues.push(`${costLabel} 포함 숙소라 등록할 수 없습니다.`);
        }
        if (accommodation?.costProfile?.[utilityType] === 'fixed') {
            issues.push(`${costLabel} 고정 숙소입니다. 숙소 비용 설정을 먼저 확인해 주세요.`);
        }
        return issues;
    }, [availableAccommodations, blockedAccommodationIds, costLabel, duplicateAccommodationIds, duplicateSourceFileHashes, recordByAccommodationId, records, utilityType, yearMonth]);

    const selectedRows = rows.filter((row) => row.selected);
    const allRowsSelected = rows.length > 0 && selectedRows.length === rows.length;
    const invalidSelectedCount = selectedRows.filter((row) => getRowIssues(row).length > 0).length;
    const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.billAmount || 0), 0);
    const canApply = status === 'review' && selectedRows.length > 0 && invalidSelectedCount === 0;
    const currentStep = status === 'upload' ? 0 : status === 'analyzing' || status === 'failed' ? 1 : 2;

    const handleApply = () => {
        if (!canApply) return;
        const analyzedAt = new Date().toISOString();
        const items = selectedRows.map((row): AccommodationUtilityBillApplyItem => {
            const record = recordByAccommodationId.get(row.selectedAccommodationId)!;
            const common = {
                fileIndex: row.analysis.fileIndex,
                recordId: record.id,
                accommodationId: row.selectedAccommodationId,
            };
            const commonMeta = {
                sourceFileName: row.analysis.originalFileName,
                sourceFileSha256: row.analysis.sourceFileSha256,
                provider: row.analysis.provider,
                billingYearMonth: row.billingYearMonth,
                dueDate: row.analysis.dueDate,
                usagePeriodStart: row.analysis.usagePeriodStart,
                usagePeriodEnd: row.analysis.usagePeriodEnd,
                address: row.analysis.address,
                housingName: row.analysis.housingName,
                confidence: row.analysis.confidence,
                analyzedAt,
            };
            if (utilityType === 'gas') {
                return {
                    ...common,
                    utilityType: 'gas',
                    gasAmount: Math.round(row.billAmount),
                    meta: {
                        ...commonMeta,
                        payerNumber: row.analysis.accountNumber,
                        usageCubicMeters: row.analysis.usageAmount,
                    },
                };
            }
            if (utilityType === 'water') {
                return {
                    ...common,
                    utilityType: 'water',
                    waterAmount: Math.round(row.billAmount),
                    meta: {
                        ...commonMeta,
                        consumerNumber: row.analysis.accountNumber,
                        usageCubicMeters: row.analysis.usageAmount,
                    },
                };
            }
            return {
                ...common,
                utilityType: 'electricity',
                electricityAmount: Math.round(row.billAmount),
                meta: {
                    ...commonMeta,
                    customerNumber: row.analysis.accountNumber,
                    usageKwh: row.analysis.usageAmount,
                },
            };
        });
        onApply(items);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="utility-import-title">
            <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        <h2 id="utility-import-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900 sm:text-lg">
                            <Icon className={`h-5 w-5 ${accentIconClass}`} aria-hidden="true" />
                            {billLabel} 청구서 일괄등록
                            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700">고정밀 Gemini</span>
                        </h2>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm">{yearMonth} 대장 · 첨부 {selectedFiles.length}건 · 숙소 자동 매칭</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="닫기" aria-label="닫기">
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-6">
                    {['파일 업로드', 'AI 분석', '검수·반영'].map((label, index) => (
                        <div key={label} className={`flex items-center gap-2 text-xs font-extrabold ${index <= currentStep ? accentTextClass : 'text-slate-400'}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${index <= currentStep ? `${accentBarClass} border-transparent text-white` : 'border-slate-300 bg-white text-slate-400'}`}>{index + 1}</span>
                            <span className="truncate">{label}</span>
                        </div>
                    ))}
                </div>

                {status === 'upload' ? (
                    <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_320px] sm:p-6">
                        <AiDocumentDropzone
                            files={selectedFiles}
                            title={`${billLabel} 청구서를 끌어다 놓으세요`}
                            description="여러 장을 한 번에 올리면 파일별 금액과 주소를 분석해 숙소 대장과 연결합니다."
                            maxFiles={20}
                            onFilesChange={handleFilesChange}
                        />
                        <aside className="border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-extrabold text-slate-900">등록 기준</h3>
                            <dl className="mt-4 space-y-3 text-xs">
                                <div><dt className="font-bold text-slate-500">대장 월</dt><dd className="mt-1 font-extrabold text-slate-800">{yearMonth}</dd></div>
                                <div><dt className="font-bold text-slate-500">분석 항목</dt><dd className="mt-1 font-semibold leading-5 text-slate-700">주소·동호수·{accountLabel}·청구금액·사용량</dd></div>
                                <div><dt className="font-bold text-slate-500">매칭 정책</dt><dd className="mt-1 font-semibold leading-5 text-slate-700">주소와 동호수가 정확한 항목만 자동 연결하고, 중복 숙소와 다른 청구월은 검수 대상으로 남깁니다.</dd></div>
                                <div><dt className="font-bold text-slate-500">인식 모델</dt><dd className="mt-1 font-semibold text-indigo-700">AI 설정의 문서 OCR 모델</dd></div>
                            </dl>
                            {errorMessage && <p className="mt-4 border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">{errorMessage}</p>}
                            <button
                                type="button"
                                onClick={() => void analyze()}
                                disabled={selectedFiles.length === 0}
                                className={`mt-5 w-full rounded-md px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${accentButtonClass}`}
                            >
                                {selectedFiles.length}건 업로드 후 분석
                            </button>
                        </aside>
                    </div>
                ) : status === 'analyzing' ? (
                    <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <LoaderCircle className={`h-10 w-10 animate-spin ${accentIconClass}`} aria-hidden="true" />
                        <div className="mt-5 text-lg font-extrabold text-slate-900">Gemini 분석 중</div>
                        <div className="mt-2 text-sm font-semibold text-slate-500">{progress.completedFiles} / {progress.totalFiles}건</div>
                        <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full transition-all ${accentBarClass}`} style={{ width: `${progress.totalFiles > 0 ? (progress.completedFiles / progress.totalFiles) * 100 : 0}%` }} />
                        </div>
                        {progress.currentFileName && <div className="mt-3 max-w-lg truncate text-xs text-slate-400">{progress.currentFileName}</div>}
                    </div>
                ) : status === 'failed' ? (
                    <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center px-6 text-center">
                        <AlertTriangle className="h-11 w-11 text-rose-500" aria-hidden="true" />
                        <div className="mt-4 text-lg font-extrabold text-slate-900">분석하지 못했습니다</div>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-rose-700">{errorMessage}</p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => setStatus('upload')} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">파일 다시 선택</button>
                            <button type="button" onClick={() => void analyze()} className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold text-white ${accentButtonClass}`}>
                                <RefreshCw className="h-4 w-4" /> 다시 분석
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
                            <div className="px-3 py-3 text-center sm:px-5">
                                <div className="text-[11px] font-bold text-slate-500">등록 선택</div>
                                <div className="mt-1 text-base font-extrabold text-slate-900 sm:text-lg">{selectedRows.length}건</div>
                                <button
                                    type="button"
                                    onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: !allRowsSelected })))}
                                    className="mt-1 text-[10px] font-extrabold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                                >
                                    {allRowsSelected ? '전체 제외' : '전체 포함'}
                                </button>
                            </div>
                            <div className="border-x border-slate-200 px-3 py-3 text-center sm:px-5">
                                <div className="text-[11px] font-bold text-slate-500">검수 필요</div>
                                <div className={`mt-1 text-base font-extrabold sm:text-lg ${invalidSelectedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{invalidSelectedCount}건</div>
                            </div>
                            <div className="px-3 py-3 text-center sm:px-5">
                                <div className="text-[11px] font-bold text-slate-500">선택 총액</div>
                                <div className={`mt-1 text-base font-extrabold sm:text-lg ${accentTextClass}`}>{formatAmount(selectedTotal)}원</div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="hidden grid-cols-[36px_80px_minmax(190px,1.25fr)_150px_minmax(220px,1fr)_150px] gap-3 border-b border-slate-200 bg-white px-5 py-2.5 text-[11px] font-extrabold text-slate-500 lg:grid">
                                <span />
                                <span>원본</span>
                                <span>분석 결과</span>
                                <span>청구 정보</span>
                                <span>숙소 매칭</span>
                                <span>검수 상태</span>
                            </div>
                            {rows.map((row) => {
                                const preview = previewUrls.find((item) => item.fileIndex === row.analysis.fileIndex);
                                const issues = getRowIssues(row);
                                const matchReasons = row.match.candidates.find((candidate) => candidate.accommodationId === row.selectedAccommodationId)?.reasons || [];
                                const combinedWarnings = Array.from(new Set([...row.analysis.warnings, ...row.match.warnings]));
                                return (
                                    <div key={`${row.analysis.fileIndex}-${row.analysis.originalFileName}`} className={`grid gap-3 border-b border-slate-100 px-4 py-4 lg:grid-cols-[36px_80px_minmax(190px,1.25fr)_150px_minmax(220px,1fr)_150px] lg:px-5 ${row.selected ? 'bg-white' : 'bg-slate-50/80 opacity-70'}`}>
                                        <div className="flex items-start justify-between lg:block">
                                            <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100" title={row.selected ? '등록 제외' : '등록 포함'}>
                                                <input type="checkbox" checked={row.selected} onChange={(event) => updateRow(row.analysis.fileIndex, { selected: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                            </label>
                                            <span className="text-xs font-bold text-slate-400 lg:hidden">#{row.analysis.fileIndex + 1}</span>
                                        </div>

                                        <a href={preview?.url} target="_blank" rel="noreferrer" className="group flex min-h-[72px] items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50" title="원본 열기">
                                            {preview?.mimeType.startsWith('image/') ? (
                                                <img src={preview.url} alt="" className="h-[72px] w-full object-cover transition group-hover:scale-105" />
                                            ) : (
                                                <FileText className="h-7 w-7 text-slate-400" aria-hidden="true" />
                                            )}
                                        </a>

                                        <div className="min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 truncate text-sm font-extrabold text-slate-800" title={row.analysis.originalFileName}>{row.analysis.originalFileName}</div>
                                                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-extrabold ${getConfidenceStyle(row.analysis.confidence)}`}>{Math.round(row.analysis.confidence * 100)}%</span>
                                            </div>
                                            <div className="mt-2 text-xs font-bold text-slate-700">{row.analysis.housingName || '동·호 미인식'}</div>
                                            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500" title={row.analysis.address}>{row.analysis.address || '주소 미인식'}</div>
                                            <div className="mt-1 text-[11px] text-slate-400">{accountLabel} {row.analysis.accountNumber || '-'}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-2">
                                            <label className="block">
                                                <span className="mb-1 block text-[10px] font-bold text-slate-500">청구금액</span>
                                                <div className="relative">
                                                    <input type="text" inputMode="numeric" value={row.billAmount ? formatAmount(row.billAmount) : ''} onChange={(event) => updateRow(row.analysis.fileIndex, { billAmount: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 })} className="w-full rounded-md border border-slate-200 px-2.5 py-2 pr-7 text-right text-sm font-extrabold text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                                                    <span className="absolute right-2 top-2.5 text-xs font-bold text-slate-400">원</span>
                                                </div>
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-[10px] font-bold text-slate-500">청구월</span>
                                                <input type="month" value={row.billingYearMonth} onChange={(event) => updateRow(row.analysis.fileIndex, { billingYearMonth: event.target.value })} className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                                            </label>
                                            <div className="col-span-2 text-[11px] text-slate-500 lg:pt-1">사용량 {formatAmount(row.analysis.usageAmount)}{usageUnit} · 납기 {row.analysis.dueDate || '-'}</div>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="block text-[10px] font-bold text-slate-500">대장 숙소</label>
                                            <select value={row.selectedAccommodationId} onChange={(event) => updateRow(row.analysis.fileIndex, { selectedAccommodationId: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                                                <option value="">숙소 선택</option>
                                                {availableAccommodations.map((accommodation) => (
                                                    <option key={accommodation.id} value={accommodation.id}>{accommodation.name}</option>
                                                ))}
                                            </select>
                                            {matchReasons.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {matchReasons.map((reason) => <span key={reason} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{reason}</span>)}
                                                </div>
                                            )}
                                            {row.selectedAccommodationId && (
                                                <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{availableAccommodations.find((item) => item.id === row.selectedAccommodationId)?.address}</div>
                                            )}
                                        </div>

                                        <div>
                                            {issues.length === 0 && row.selected ? (
                                                <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-extrabold text-emerald-700"><Check className="h-3.5 w-3.5" /> 등록 가능</div>
                                            ) : !row.selected ? (
                                                <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-500">제외</div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {issues.map((issue) => <div key={issue} className="flex gap-1.5 text-[11px] font-bold leading-4 text-rose-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{issue}</div>)}
                                                </div>
                                            )}
                                            {combinedWarnings.length > 0 && (
                                                <div className="mt-2 space-y-1 border-t border-amber-100 pt-2">
                                                    {combinedWarnings.map((warning) => <div key={warning} className="text-[10px] font-medium leading-4 text-amber-700">{warning}</div>)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <FileImage className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                적용 후 대장의 변경사항 저장을 눌러야 최종 저장됩니다.
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setStatus('upload')} className="rounded-md border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">파일 다시 선택</button>
                                <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">취소</button>
                                <button type="button" onClick={handleApply} disabled={!canApply} className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${accentButtonClass}`}>
                                    <Check className="h-4 w-4" /> {selectedRows.length}건 대장 반영
                                </button>
                            </div>
                        </footer>
                    </>
                )}
            </div>
        </div>
    );
};

export default AccommodationUtilityBillImportModal;
