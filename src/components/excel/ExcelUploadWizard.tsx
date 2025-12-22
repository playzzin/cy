import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt, faCheckCircle, faSpinner, faExclamationTriangle,
    faFileExcel, faArrowRight, faDatabase, faTimes
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

export interface ExcelWizardProps<T> {
    title: string;
    description?: string;
    fields: FieldDef[];
    onValidate: (row: any) => Promise<ValidationResult> | ValidationResult; // Row-level validation
    onSaveBatch: (rows: T[], options?: { overwrite: boolean }) => Promise<{ success: number; failed: number; skipped?: number }>;
    sampleFileName?: string; // For "Download Template" (Todo)
}

// --- Steps ---
type Step = 'UPLOAD' | 'MAPPING' | 'PREVIEW' | 'SAVING' | 'COMPLETE';

const ExcelUploadWizard = <T extends Record<string, any>>({
    title,
    description,
    fields,
    onValidate,
    onSaveBatch
}: ExcelWizardProps<T>) => {

    // State
    const [step, setStep] = useState<Step>('UPLOAD');
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<any[]>([]); // Raw Excel JSON
    const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({}); // fieldKey -> excelHeader
    const [previewData, setPreviewData] = useState<(T & { _validation?: ValidationResult })[]>([]);

    // Progress State
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<string[]>([]);
    const [resultSummary, setResultSummary] = useState({ success: 0, failed: 0, skipped: 0, total: 0 });

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
        const mapped = await Promise.all(rawRows.map(async (row) => {
            const newRow: any = {};
            fields.forEach(f => {
                const header = fieldMapping[f.key];
                if (header) {
                    newRow[f.key] = row[header];
                }
            });

            // Run Validation
            const validation = await onValidate(newRow);
            return { ...newRow, _validation: validation };
        }));

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

        const validRows = previewData.filter(d => d._validation?.isValid).map(({ _validation, ...rest }) => rest as T);
        const total = validRows.length;
        const BATCH_SIZE = 50;
        let processed = 0;
        let successTotal = 0;
        let failTotal = 0;
        let skippedTotal = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = validRows.slice(i, i + BATCH_SIZE);
            try {
                const { success, failed, skipped = 0 } = await onSaveBatch(batch, { overwrite });
                successTotal += success;
                failTotal += failed;
                skippedTotal += skipped;
                setLog(prev => [`[Batch ${Math.floor(i / BATCH_SIZE) + 1}] 성공: ${success}, 건너뜀: ${skipped}, 실패: ${failed}`, ...prev.slice(0, 4)]);
            } catch (err) {
                console.error(err);
                setLog(prev => [`[Error] 배치 처리 중 오류 발생`, ...prev]);
                failTotal += batch.length;
            }

            processed += batch.length;
            setProgress(Math.round((processed / total) * 100));
            // Slight delay for UI
            await new Promise(r => setTimeout(r, 50));
        }

        setResultSummary({ success: successTotal, failed: failTotal, skipped: skippedTotal, total });
        setStep('COMPLETE');
    };


    // --- Renderers ---


    if (step === 'UPLOAD') {
        // ... (Keep existing UPLOAD render logic)
        return (
            <div className="p-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center hover:bg-slate-100 transition-colors"
                onDragOver={handleFileDrop} onDrop={handleFileDrop}
            >
                <div className="mb-4 text-brand-500 text-5xl">
                    <FontAwesomeIcon icon={faCloudUploadAlt} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{title} 마법사</h3>
                <p className="text-slate-500 mb-6">{description || '엑셀 파일을 이곳으로 드래그하거나 클릭하여 업로드하세요.'}</p>
                <label className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-bold cursor-pointer transition-all">
                    파일 선택 (.xlsx)
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
                </label>

                {/* Guide for Fields */}
                <div className="mt-8 text-left max-w-lg mx-auto bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">💡 엑셀 파일 권장 헤더</h4>
                    <div className="flex flex-wrap gap-2">
                        {fields.map(f => (
                            <span key={f.key} className={`text-xs px-2 py-1 rounded border ${f.required ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                {f.label}{f.required && '*'}
                            </span>
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

        return (
            <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-slate-800">데이터 확인</h3>
                        <p className="text-xs text-slate-500">
                            신규 <span className="text-green-600 font-bold">{newCount}</span>,
                            변경 <span className="text-blue-600 font-bold">{updateCount}</span>,
                            오류 <span className="text-red-500 font-bold">{invalidCount}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
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
                        <div className="flex gap-2">
                            <button onClick={() => setStep('MAPPING')} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded bg-white">설정 변경</button>
                            <button onClick={handleUpload} className="px-4 py-1.5 text-sm bg-brand-600 text-white rounded font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50" disabled={validCount === 0}>
                                {validCount}건 업로드 시작
                            </button>
                        </div>
                    </div>
                </div>
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
        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                    <FontAwesomeIcon icon={faCheckCircle} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">업로드 완료!</h3>
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
                <button onClick={() => { setStep('UPLOAD'); setRawFile(null); setPreviewData([]); }} className="px-6 py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">
                    다른 파일 업로드하기
                </button>
            </div>
        );
    }

    return null;
};

export default ExcelUploadWizard;
