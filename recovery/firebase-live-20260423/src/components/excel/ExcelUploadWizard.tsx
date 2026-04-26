import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt, faCheckCircle, faSpinner, faExclamationTriangle,
    faFileExcel, faArrowRight, faDatabase, faTimes, faDownload, faCog
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';

// --- Types ---
export interface FieldDef {
    key: string;            // Internal key (e.g., 'name')
    label: string;          // Display label (e.g., '이름')
    required?: boolean;     // Is mandatory?
    aliases?: string[];     // Auto-match headers (e.g., ['성명', '작업자명'])
    example?: string;       // Example value for guide
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    status?: 'NEW' | 'UPDATE' | 'IDENTICAL';
    changes?: { field: string; oldValue: any; newValue: any }[];
}

export interface SampleDataRow {
    [key: string]: string | number;
}

export interface ExcelWizardProps<T> {
    title: string;
    description?: string;
    fields: FieldDef[];
    onValidate: (row: any) => Promise<ValidationResult> | ValidationResult; // Row-level validation
    onSaveBatch: (rows: T[], options?: { overwrite: boolean }) => Promise<{ success: number; failed: number; skipped?: number }>;
    sampleFileName?: string; // 샘플 파일명 (확장자 제외)
    sampleData?: SampleDataRow[]; // 샘플 데이터 (2-3개 예시 행)
    defaultBatchSize?: number; // 배치 크기 (기본 50)
}

// 에러 로그 타입
interface ErrorLogEntry {
    rowIndex: number;
    rowData: Record<string, any>;
    errors: string[];
    warnings: string[];
    status: 'NEW' | 'UPDATE' | 'IDENTICAL' | 'ERROR';
    timestamp: string;
}

// --- Steps ---
type Step = 'UPLOAD' | 'MAPPING' | 'PREVIEW' | 'SAVING' | 'COMPLETE';

const ExcelUploadWizard = <T extends Record<string, any>>({
    title,
    description,
    fields,
    onValidate,
    onSaveBatch,
    sampleFileName,
    sampleData,
    defaultBatchSize = 50
}: ExcelWizardProps<T>) => {

    // State
    const [step, setStep] = useState<Step>('UPLOAD');
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<any[]>([]); // Raw Excel JSON
    const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({}); // fieldKey -> excelHeader
    const [previewData, setPreviewData] = useState<(T & { _validation?: ValidationResult; _rowIndex?: number })[]>([]);

    // Progress State
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<string[]>([]);
    const [resultSummary, setResultSummary] = useState({ success: 0, failed: 0, skipped: 0, total: 0 });

    // Error Log State (상세 에러 로그)
    const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);

    // Settings State
    const [batchSize, setBatchSize] = useState(defaultBatchSize);
    const [showSettings, setShowSettings] = useState(false);

    const downloadSampleExcel = () => {
        const headers = fields.map(f => f.label);
        let dataRows: any[];

        if (sampleData && sampleData.length > 0) {
            dataRows = sampleData.map(row => {
                const converted: Record<string, any> = {};
                fields.forEach(f => {
                    converted[f.label] = row[f.key] ?? '';
                });
                return converted;
            });
        } else {
            // Default sample generation using example values
            const row1: Record<string, any> = {};
            const row2: Record<string, any> = {};
            fields.forEach(f => {
                row1[f.label] = f.example || `예시_${f.label}`;
                row2[f.label] = f.example ? `${f.example}_2` : `예시_${f.label}_2`;
            });
            dataRows = [row1, row2];
        }

        const ws = XLSX.utils.json_to_sheet(dataRows, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '데이터');
        const fileName = sampleFileName || 'sample_upload_template';
        XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // --- 1. File Upload Logic ---
    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            // Read Headers
            const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[];
            // Read Data
            const data = XLSX.utils.sheet_to_json(ws);

            setRawFile(file);
            setExcelHeaders(headers);
            setRawRows(data);

            // Auto mapping
            const initialMapping: Record<string, string> = {};
            fields.forEach(field => {
                const matched = headers.find(h =>
                    h === field.label ||
                    field.aliases?.includes(h) ||
                    h.includes(field.label) // Fuzzy
                );
                if (matched) initialMapping[field.key] = matched;
            });
            setFieldMapping(initialMapping);

            setStep('MAPPING');
        };
        reader.readAsBinaryString(file);
    };

    // --- 2. Mapping Logic ---
    const handleMappingChange = (fieldKey: string, header: string) => {
        setFieldMapping(prev => ({ ...prev, [fieldKey]: header }));
    };

    const proceedToPreview = async () => {
        // validate mapping
        const missingRequired = fields.filter(f => f.required && !fieldMapping[f.key]);
        if (missingRequired.length > 0) {
            Swal.fire('Error', `필수 항목이 연결되지 않았습니다: ${missingRequired.map(f => f.label).join(', ')}`, 'error');
            return;
        }

        // Transform Data
        const mapped = await Promise.all(rawRows.map(async (row, index) => {
            const newRow: any = {};
            fields.forEach(f => {
                const header = fieldMapping[f.key];
                if (header) {
                    newRow[f.key] = row[header];
                }
            });

            // Run Validation
            const validation = await onValidate(newRow);
            return { ...newRow, _validation: validation, _rowIndex: index + 2 }; // +2 for Excel row (1-indexed + header)
        }));

        // 에러 로그 초기화 및 유효하지 않은 행 기록
        const initialErrors: ErrorLogEntry[] = mapped
            .filter(row => !row._validation?.isValid || row._validation?.warnings?.length > 0)
            .map(row => ({
                rowIndex: row._rowIndex,
                rowData: Object.fromEntries(fields.map(f => [f.label, row[f.key]])),
                errors: row._validation?.errors || [],
                warnings: row._validation?.warnings || [],
                status: row._validation?.isValid
                    ? (row._validation?.status || 'NEW')
                    : 'ERROR',
                timestamp: new Date().toISOString()
            }));
        setErrorLogs(initialErrors);

        setPreviewData(mapped);
        setStep('PREVIEW');
    };

    // State for Overwrite
    const [overwrite, setOverwrite] = useState(false);

    // --- 3. Batch Save Logic ---
    const handleUpload = async () => {
        setStep('SAVING');
        setLog([]);
        setProgress(0);

        // Filter out IDENTICAL rows automatically, maybe?
        // Or leave it to `onSaveBatch` to handle provided the flag?
        // Let's pass all valid rows but the handler decides.
        // Actually, if IDENTICAL, we shouldn't even send it usually, but let's send it as skipped.

        const validRows = previewData.filter(d => d._validation?.isValid).map(({ _validation, _rowIndex, ...rest }) => rest as T);
        const total = validRows.length;
        let processed = 0;
        let successTotal = 0;
        let failTotal = 0;
        let skippedTotal = 0;
        const batchErrors: ErrorLogEntry[] = [];

        for (let i = 0; i < total; i += batchSize) {
            const batch = validRows.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            try {
                const { success, failed, skipped = 0 } = await onSaveBatch(batch, { overwrite });
                successTotal += success;
                failTotal += failed;
                skippedTotal += skipped;
                setLog(prev => [`[Batch ${batchNumber}] 성공: ${success}, 건너뜀: ${skipped}, 실패: ${failed}`, ...prev.slice(0, 9)]);

                // 실패 건수가 있으면 에러 로그에 추가
                if (failed > 0) {
                    batchErrors.push({
                        rowIndex: i + 1,
                        rowData: { batch: batchNumber, count: batch.length },
                        errors: [`배치 ${batchNumber}에서 ${failed}건 저장 실패`],
                        warnings: [],
                        status: 'ERROR',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (err: any) {
                console.error(err);
                const errorMsg = err?.message || '알 수 없는 오류';
                setLog(prev => [`[Error] 배치 ${batchNumber} 처리 중 오류: ${errorMsg}`, ...prev]);
                failTotal += batch.length;

                batchErrors.push({
                    rowIndex: i + 1,
                    rowData: { batch: batchNumber, count: batch.length },
                    errors: [`배치 처리 오류: ${errorMsg}`],
                    warnings: [],
                    status: 'ERROR',
                    timestamp: new Date().toISOString()
                });
            }

            processed += batch.length;
            setProgress(Math.round((processed / total) * 100));
            // Slight delay for UI
            await new Promise(r => setTimeout(r, 50));
        }

        // 에러 로그 업데이트 (기존 + 배치 에러)
        setErrorLogs(prev => [...prev, ...batchErrors]);

        setResultSummary({ success: successTotal, failed: failTotal, skipped: skippedTotal, total });
        setStep('COMPLETE');
    };

    // --- 에러 로그 다운로드 함수 ---
    const downloadErrorLog = () => {
        if (errorLogs.length === 0) {
            Swal.fire('알림', '다운로드할 에러 로그가 없습니다.', 'info');
            return;
        }

        // CSV 형식으로 변환
        const headers = ['행번호', '상태', '에러', '경고', '데이터', '시간'];
        const csvRows = [headers.join(',')];

        errorLogs.forEach(entry => {
            const row = [
                entry.rowIndex,
                entry.status,
                `"${entry.errors.join('; ').replace(/"/g, '""')}"`,
                `"${entry.warnings.join('; ').replace(/"/g, '""')}"`,
                `"${JSON.stringify(entry.rowData).replace(/"/g, '""')}"`,
                entry.timestamp
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Korean
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `upload_error_log_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // --- 엑셀 형식 에러 로그 다운로드 ---
    const downloadErrorLogAsExcel = () => {
        if (errorLogs.length === 0) {
            Swal.fire('알림', '다운로드할 에러 로그가 없습니다.', 'info');
            return;
        }

        const data = errorLogs.map(entry => ({
            '행번호': entry.rowIndex,
            '상태': entry.status,
            '에러': entry.errors.join('; '),
            '경고': entry.warnings.join('; '),
            '데이터': JSON.stringify(entry.rowData),
            '시간': entry.timestamp
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '에러로그');
        XLSX.writeFile(wb, `upload_error_log_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };


    // --- Renderers ---


    if (step === 'UPLOAD') {
        return (
            <div className="p-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center hover:bg-slate-100 transition-colors"
                onDragOver={handleFileDrop} onDrop={handleFileDrop}
            >
                <div className="mb-4 text-brand-500 text-5xl">
                    <FontAwesomeIcon icon={faCloudUploadAlt} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{title} 마법사</h3>
                <p className="text-slate-500 mb-6">{description || '엑셀 파일을 이곳으로 드래그하거나 클릭하여 업로드하세요.'}</p>
                <div className="flex justify-center gap-3">
                    <label className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-bold cursor-pointer transition-all">
                        <FontAwesomeIcon icon={faCloudUploadAlt} /> 파일 선택 (.xlsx)
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
                    </label>
                    {sampleData && (
                        <button
                            type="button"
                            onClick={downloadSampleExcel}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faDownload} /> 샘플 양식 다운로드
                        </button>
                    )}
                </div>

                {/* Guide for Fields */}
                <div className="mt-8 text-left max-w-2xl mx-auto bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">💡 엑셀 파일 권장 헤더</h4>
                    <p className="text-xs text-slate-500 mb-3">
                        아래 필드를 포함하는 엑셀 파일을 업로드해주세요. <span className="text-red-500 font-bold">빨간색*</span>은 필수 항목입니다.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {fields.map(f => (
                            <div key={f.key} className="group relative">
                                <span className={`text-xs px-2 py-1 rounded border ${f.required ? 'bg-red-50 border-red-200 text-red-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    {f.label}{f.required && '*'}
                                </span>
                                <div className="absolute bottom-full mb-2 w-48 bg-slate-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <div className="font-bold">{f.label}</div>
                                    {f.aliases && f.aliases.length > 0 && <div className="text-slate-300">별칭: {f.aliases.join(', ')}</div>}
                                    {f.example && <div>예시: {f.example}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'MAPPING') {
        // ... (Keep existing MAPPING render logic)
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm">2</span>
                    데이터 연결 (컬럼 매핑)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fields.map(field => (
                        <div key={field.key} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <select
                                className={`w-full text-sm rounded border-slate-300 ${!fieldMapping[field.key] && field.required ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                                value={fieldMapping[field.key] || ''}
                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                            >
                                <option value="">(선택 안함)</option>
                                {excelHeaders.map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                            {fieldMapping[field.key] && (
                                <p className="text-[10px] text-brand-600 mt-1 truncate">
                                    <FontAwesomeIcon icon={faArrowRight} className="mr-1" />
                                    {rawRows[0]?.[fieldMapping[field.key]] || '(예시 없음)'}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={() => setStep('UPLOAD')} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">이전</button>
                    <button onClick={proceedToPreview} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">다음: 데이터 확인</button>
                </div>
            </div>
        );
    }

    if (step === 'PREVIEW') {
        const validCount = previewData.filter(d => d._validation?.isValid).length;
        const invalidCount = previewData.length - validCount;
        const updateCount = previewData.filter(d => d._validation?.status === 'UPDATE').length;
        const newCount = previewData.filter(d => d._validation?.status === 'NEW').length;
        const warningCount = previewData.filter(d => (d._validation?.warnings?.length ?? 0) > 0).length;

        return (
            <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-slate-800">데이터 확인</h3>
                        <p className="text-xs text-slate-500">
                            신규 <span className="text-green-600 font-bold">{newCount}</span>,
                            변경 <span className="text-blue-600 font-bold">{updateCount}</span>,
                            경고 <span className="text-orange-500 font-bold">{warningCount}</span>,
                            오류 <span className="text-red-500 font-bold">{invalidCount}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* 설정 토글 버튼 */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`px-3 py-1.5 text-sm rounded border transition-colors ${showSettings ? 'bg-slate-200 border-slate-400' : 'bg-white border-slate-300 hover:bg-slate-50'}`}
                            title="업로드 설정"
                        >
                            <FontAwesomeIcon icon={faCog} className="mr-1" />
                            설정
                        </button>

                        {updateCount > 0 && (
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer bg-blue-50 px-3 py-1.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={overwrite}
                                    onChange={e => setOverwrite(e.target.checked)}
                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                />
                                중복 데이터 덮어쓰기
                            </label>
                        )}

                        {/* 에러/경고 로그 다운로드 버튼 */}
                        {errorLogs.length > 0 && (
                            <button
                                onClick={downloadErrorLogAsExcel}
                                className="px-3 py-1.5 text-sm text-orange-600 border border-orange-300 rounded bg-orange-50 hover:bg-orange-100 transition-colors"
                                title="에러/경고 로그 다운로드"
                            >
                                <FontAwesomeIcon icon={faDownload} className="mr-1" />
                                로그 ({errorLogs.length})
                            </button>
                        )}

                        <div className="flex gap-2">
                            <button onClick={() => setStep('MAPPING')} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded bg-white">설정 변경</button>
                            <button onClick={handleUpload} className="px-4 py-1.5 text-sm bg-brand-600 text-white rounded font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50" disabled={validCount === 0}>
                                {validCount}건 업로드 시작
                            </button>
                        </div>
                    </div>
                </div>

                {/* 설정 패널 */}
                {showSettings && (
                    <div className="p-4 border-b border-slate-200 bg-slate-100">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-700">배치 크기:</label>
                                <select
                                    value={batchSize}
                                    onChange={(e) => setBatchSize(Number(e.target.value))}
                                    className="text-sm border-slate-300 rounded"
                                >
                                    <option value={10}>10건</option>
                                    <option value={25}>25건</option>
                                    <option value={50}>50건</option>
                                    <option value={100}>100건</option>
                                    <option value={200}>200건</option>
                                </select>
                                <span className="text-xs text-slate-500">(대용량 처리 시 작은 값 권장)</span>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 sticky top-0 z-10 font-bold text-slate-700">
                            <tr>
                                <th className="p-2 border-b w-24 text-center">상태</th>
                                {fields.map(f => (
                                    <th key={f.key} className="p-2 border-b">{f.label}</th>
                                ))}
                                <th className="p-2 border-b">메세지</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {previewData.slice(0, 100).map((row, idx) => {
                                const status = row._validation?.status;
                                let rowClass = 'hover:bg-slate-50';
                                if (!row._validation?.isValid) rowClass = 'bg-red-50 hover:bg-red-100';
                                else if (status === 'UPDATE') rowClass = 'bg-blue-50/30 hover:bg-blue-50';
                                else if (status === 'IDENTICAL') rowClass = 'bg-slate-50 opacity-60';

                                return (
                                    <tr key={idx} className={rowClass}>
                                        <td className="p-2 text-center">
                                            {status === 'NEW' && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">신규</span>}
                                            {status === 'UPDATE' && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">변경</span>}
                                            {status === 'IDENTICAL' && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">동일</span>}
                                            {!status && !row._validation?.isValid && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">오류</span>}
                                        </td>
                                        {fields.map(f => {
                                            const change = row._validation?.changes?.find(c => c.field === f.key);
                                            return (
                                                <td key={f.key} className="p-2 truncate max-w-[150px]" title={String(row[f.key] || '')}>
                                                    <div>{String(row[f.key] || '')}</div>
                                                    {change && (
                                                        <div className="text-[10px] text-red-500 line-through opacity-70">
                                                            {String(change.oldValue || '(공란)')}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="p-2 text-slate-500">
                                            {row._validation?.errors.length ? (
                                                <span className="text-red-600 font-bold">{row._validation.errors.join(', ')}</span>
                                            ) : (
                                                row._validation?.warnings.length ? (
                                                    <span className="text-orange-500">{row._validation.warnings.join(', ')}</span>
                                                ) : <span className="text-green-400">OK</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {previewData.length > 100 && (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            ...외 {previewData.length - 100}건 (성능을 위해 100건만 표시됩니다)
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (step === 'SAVING') {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="w-20 h-20 border-4 border-slate-100 border-t-brand-500 rounded-full animate-spin mb-6"></div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">데이터 저장 중...</h3>
                <p className="text-slate-500 mb-8">{progress}% 완료</p>

                <div className="w-full max-w-md bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                    <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="w-full max-w-md bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 h-32 overflow-y-auto">
                    {log.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            </div>
        );
    }

    if (step === 'COMPLETE') {
        const hasErrors = errorLogs.some(e => e.status === 'ERROR') || resultSummary.failed > 0;

        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl ${hasErrors ? 'bg-orange-100 text-orange-500' : 'bg-green-100 text-green-500'}`}>
                    <FontAwesomeIcon icon={hasErrors ? faExclamationTriangle : faCheckCircle} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                    {hasErrors ? '업로드 완료 (일부 오류)' : '업로드 완료!'}
                </h3>
                <div className="flex justify-center gap-8 my-6">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">{resultSummary.success}</p>
                        <p className="text-sm text-slate-500">성공</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-red-500">{resultSummary.failed}</p>
                        <p className="text-sm text-slate-500">실패</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-orange-500">{resultSummary.skipped}</p>
                        <p className="text-sm text-slate-500">중복 (건너뜀)</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-slate-700">{resultSummary.total}</p>
                        <p className="text-sm text-slate-500">총 요청</p>
                    </div>
                </div>

                {/* 에러 로그 다운로드 버튼 */}
                {errorLogs.length > 0 && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg inline-block">
                        <p className="text-sm text-orange-800 mb-3">
                            총 <strong>{errorLogs.length}</strong>건의 에러/경고 로그가 있습니다.
                        </p>
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={downloadErrorLogAsExcel}
                                className="px-4 py-2 text-sm bg-orange-500 text-white rounded font-bold hover:bg-orange-600 transition-colors"
                            >
                                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                                엑셀로 다운로드
                            </button>
                            <button
                                onClick={downloadErrorLog}
                                className="px-4 py-2 text-sm border border-orange-400 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                            >
                                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                                CSV 다운로드
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-center gap-3">
                    <button
                        onClick={() => {
                            setStep('UPLOAD');
                            setRawFile(null);
                            setPreviewData([]);
                            setErrorLogs([]);
                            setLog([]);
                        }}
                        className="px-6 py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700"
                    >
                        다른 파일 업로드하기
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default ExcelUploadWizard;
