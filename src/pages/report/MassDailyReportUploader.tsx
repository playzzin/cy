import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt, faArrowRight, faCheckCircle, faSpinner,
    faExclamationTriangle, faFileExcel, faLink, faDatabase,
    faTable
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { dailyReportService } from '../../services/dailyReportService';
import { siteService } from '../../services/siteService';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';

// --- Types ---
type UploadStep = 'upload' | 'mapping' | 'preview' | 'uploading' | 'complete';

interface SystemField {
    key: string;
    label: string;
    required: boolean;
    description: string;
    aliases: string[]; // For auto-mapping
}

const SYSTEM_FIELDS: SystemField[] = [
    { key: 'date', label: '날짜', required: true, description: 'YYYY-MM-DD 형식', aliases: ['날짜', '작업일', '일자', 'Date'] },
    { key: 'siteName', label: '현장명', required: true, description: '현장이 없으면 자동 생성됨', aliases: ['현장', '현장명', 'Site'] },
    { key: 'teamName', label: '팀명', required: true, description: '팀이 없으면 자동 생성됨', aliases: ['팀', '팀명', '업체', 'Team'] },
    { key: 'workerName', label: '작업자명', required: true, description: '작업자 이름', aliases: ['이름', '작업자', '성명', 'Name'] },
    { key: 'manDay', label: '공수', required: true, description: '기본 1.0', aliases: ['공수', '품', 'ManDay'] },
    { key: 'role', label: '직종/역할', required: false, description: '예: 기공, 조공', aliases: ['직종', '역할', 'Role'] },
    { key: 'workContent', label: '작업내용', required: false, description: '상세 작업 내용', aliases: ['작업내용', '내용', 'Content'] },
    { key: 'payType', label: '지급구분', required: false, description: '월급제 / 일급제 / 팀기성', aliases: ['지급구분', '구분', 'PayType'] },
    { key: 'note', label: '비고', required: false, description: '기타 메모', aliases: ['비고', 'Note'] },
];

const MassDailyReportUploader: React.FC = () => {
    const { currentUser } = useAuth();
    const [step, setStep] = useState<UploadStep>('upload');

    // Data State
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [rawExcelData, setRawExcelData] = useState<any[]>([]); // 10k rows potentially
    const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({}); // SystemKey -> ExcelHeader
    const [previewData, setPreviewData] = useState<any[]>([]);

    // Upload State
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<string[]>([]);
    const [uploadStats, setUploadStats] = useState({ success: 0, fail: 0, total: 0 });

    // --- Step 1: File Upload ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Read headers first
            const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (data.length === 0) return;

            const headers = data[0] as string[];
            setExcelHeaders(headers);

            // Read full data as objects
            const jsonData = XLSX.utils.sheet_to_json(ws);
            setRawExcelData(jsonData);

            // Auto-Map Logic
            const initialMapping: { [key: string]: string } = {};
            SYSTEM_FIELDS.forEach(field => {
                const match = headers.find(h => field.aliases.includes(h) || h.includes(field.label));
                if (match) initialMapping[field.key] = match;
            });
            setColumnMapping(initialMapping);

            setStep('mapping');
        };
        reader.readAsBinaryString(file);
    };

    // --- Step 2: Mapping Logic ---
    const handleMappingChange = (systemKey: string, excelHeader: string) => {
        setColumnMapping(prev => ({ ...prev, [systemKey]: excelHeader }));
    };

    const proceedToPreview = () => {
        // Validate required fields
        const missingRequired = SYSTEM_FIELDS.filter(f => f.required && !columnMapping[f.key]);
        if (missingRequired.length > 0) {
            Swal.fire('매핑 확인 필요', `필수 항목이 연결되지 않았습니다: ${missingRequired.map(f => f.label).join(', ')}`, 'warning');
            return;
        }

        // Generate Preview (First 5 Rows)
        const sample = rawExcelData.slice(0, 5).map(row => {
            const mappedRow: any = {};
            SYSTEM_FIELDS.forEach(field => {
                const excelKey = columnMapping[field.key];
                mappedRow[field.key] = excelKey ? row[excelKey] : '';
            });
            return mappedRow;
        });

        setPreviewData(sample);
        setStep('preview');
    };

    // --- Step 3: Execution ---
    const startUpload = async () => {
        setStep('uploading');
        setLog([]);
        setUploadStats({ success: 0, fail: 0, total: rawExcelData.length });

        // --- PRE-FETCH CACHE ---
        setLog(prev => [...prev, "시스템 데이터(현장, 팀) 로딩 중..."]);
        const [existingSites, existingTeams, existingWorkers] = await Promise.all([
            siteService.getSites(),
            teamService.getTeams(),
            manpowerService.getWorkers()
        ]);

        const siteMap = new Map(existingSites.map(s => [s.name, s]));
        const teamMap = new Map(existingTeams.map(t => [t.name, t]));
        const workerMap = new Map(existingWorkers.map(w => [w.name, w]));

        const BATCH_SIZE = 50; // Firestore limit 500 writes, safe size 50 docs (writes can assume multiple ops per doc)
        const totalRows = rawExcelData.length;
        let successCount = 0;
        let failCount = 0;

        // Process in Chunks
        for (let i = 0; i < totalRows; i += BATCH_SIZE) {
            const chunk = rawExcelData.slice(i, i + BATCH_SIZE);
            const batchReports: any[] = [];

            // Process Chunk
            for (const row of chunk) {
                try {
                    // Extract Mapped Data
                    const mapped: any = {};
                    SYSTEM_FIELDS.forEach(field => {
                        const excelKey = columnMapping[field.key] || '';
                        mapped[field.key] = excelKey ? row[excelKey] : undefined;
                    });

                    // Skip empty rows
                    if (!mapped.workerName) continue;

                    // 1. Resolve Site (Find or Create)
                    let siteName = (mapped.siteName || '미지정현장').toString().trim();
                    let siteId = '';

                    if (siteMap.has(siteName)) {
                        siteId = siteMap.get(siteName)!.id!;
                    } else {
                        // Create New Site on Fly (Wait for creation to ensure ID exists?)
                        // Ideally we should batch create sites, but for simplicity we create one by one or assume creation in service.
                        // To avoid awaits in loop, we optimistically create? No, needs ID.
                        // We must await creation if it's new.
                        const newId = await siteService.addSite({
                            name: siteName,
                            code: 'AUTO',
                            address: '',
                            status: 'active'
                        });
                        const newSite: any = { id: newId, name: siteName };
                        siteMap.set(siteName, newSite);
                        siteId = newId;
                        setLog(prev => [...prev, `[신규생성] 현장: ${siteName}`]);
                    }

                    // 2. Resolve Team (Find or Create)
                    let teamName = (mapped.teamName || '미지정팀').toString().trim();
                    let teamId = '';

                    if (teamMap.has(teamName)) {
                        teamId = teamMap.get(teamName)!.id!;
                    } else {
                        const newId = await teamService.addTeam({
                            name: teamName,
                            type: 'partner',
                            leaderId: 'unknown',
                            leaderName: '미지정'
                        });
                        const newTeam: any = { id: newId, name: teamName };
                        teamMap.set(teamName, newTeam);
                        teamId = newId;
                        setLog(prev => [...prev, `[신규생성] 팀: ${teamName}`]);
                    }

                    // 3. Prepare Report Object
                    const existingWorker = workerMap.get(mapped.workerName);

                    batchReports.push({
                        date: mapped.date || new Date().toISOString().split('T')[0], // Need cleaner Logic
                        siteId,
                        siteName,
                        teamId,
                        teamName,
                        totalManDay: parseFloat(mapped.manDay || '1'),
                        writerId: currentUser?.uid || 'system',
                        workers: [{
                            workerId: existingWorker ? existingWorker.id : `batch_${Date.now()}_${Math.random()}`,
                            name: mapped.workerName,
                            role: mapped.role || (existingWorker ? existingWorker.role : '조공'),
                            manDay: parseFloat(mapped.manDay || '1'),
                            workContent: mapped.workContent || '',
                            status: 'attendance',
                            teamId: existingWorker ? existingWorker.teamId : undefined,
                            payType: mapped.payType || '',
                            salaryModel: (mapped.payType || '일급제').toString().trim() || '일급제'
                        }]
                    });

                } catch (err) {
                    failCount++;
                }
            }

            // Save Batch
            if (batchReports.length > 0) {
                try {
                    // Use dailyReportService.addReportsBatch (Optimized)
                    // Note: addReportsBatch expects arrays of reports.
                    // If multiple workers are in same day/team/site, we should ideally merge them?
                    // For now, let's just save individual reports (legacy support).
                    // Or better, we just loop addWorkerToReport? No, that's too many reads.
                    // Let's use addReportsBatch (it creates separate docs).
                    await dailyReportService.addReportsBatch(batchReports);
                    successCount += batchReports.length;
                } catch (e) {
                    console.error('Batch Save Failed', e);
                    failCount += batchReports.length;
                    setLog(prev => [...prev, `[에러] 배치 저장 실패: ${i}~${i + BATCH_SIZE}`]);
                }
            }

            // Update Progress
            const currentProgress = Math.min(100, Math.round(((i + BATCH_SIZE) / totalRows) * 100));
            setProgress(currentProgress);
            setUploadStats({ success: successCount, fail: failCount, total: totalRows });

            // Artificial delay to prevent UI freeze and rate limits
            await new Promise(r => setTimeout(r, 50));
        }

        setStep('complete');
    };

    // --- UI Components ---
    return (
        <div className="max-w-6xl mx-auto p-8 h-full flex flex-col">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">대용량 엑셀 업로드 마법사</h1>
                <p className="text-slate-500 mt-2">10,000건 이상의 데이터도 안전하게 나누어 전송합니다.</p>
            </div>

            {/* Stepper */}
            <div className="flex items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                {[
                    { id: 'upload', label: '1. 파일 선택', icon: faFileExcel },
                    { id: 'mapping', label: '2. 항목 연결', icon: faLink },
                    { id: 'preview', label: '3. 데이터 검사', icon: faTable },
                    { id: 'uploading', label: '4. 저장 실행', icon: faDatabase },
                ].map((s, idx) => (
                    <div key={s.id} className={`flex items-center ${step === s.id ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 border ${step === s.id ? 'bg-blue-100 border-blue-500' : 'bg-slate-50 border-slate-200'}`}>
                            <FontAwesomeIcon icon={s.icon} />
                        </div>
                        <span className="mr-8">{s.label}</span>
                        {idx < 3 && <FontAwesomeIcon icon={faArrowRight} className="mr-8 text-slate-300" />}
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col p-8">

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center h-full border-4 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 transition-colors p-20 cursor-pointer relative">
                        <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" className="absolute inset-0 opacity-0 cursor-pointer" />
                        <FontAwesomeIcon icon={faCloudUploadAlt} className="text-6xl text-blue-400 mb-6" />
                        <h2 className="text-2xl font-bold text-slate-700 mb-2">엑셀 파일을 여기에 끌어다 놓으세요</h2>
                        <p className="text-slate-500">또는 클릭하셔서 파일을 선택하세요 (최대 50MB)</p>
                        <div className="mt-8 bg-blue-50 text-blue-700 px-4 py-2 rounded text-sm">
                            💡 Tip: 첫 번째 줄에 '날짜', '현장명', '팀명', '이름'이 있으면 자동 인식됩니다.
                        </div>
                    </div>
                )}

                {/* Step 2: Mapping */}
                {step === 'mapping' && (
                    <div className="h-full flex flex-col">
                        <h3 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-blue-500 pl-3">엑셀 항목과 시스템 항목을 연결합니다</h3>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-4 border-b">시스템 항목 (저장될 곳)</th>
                                        <th className="p-4 border-b text-center"><FontAwesomeIcon icon={faArrowRight} /></th>
                                        <th className="p-4 border-b">내 엑셀 파일 항목</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SYSTEM_FIELDS.map(field => (
                                        <tr key={field.key} className="border-b hover:bg-slate-50">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700">{field.label} {field.required && <span className="text-red-500">*</span>}</div>
                                                <div className="text-xs text-slate-400">{field.description}</div>
                                            </td>
                                            <td className="p-4 text-center text-slate-300">
                                                <FontAwesomeIcon icon={faLink} />
                                            </td>
                                            <td className="p-4">
                                                <select
                                                    className={`w-full p-2 border rounded-lg ${columnMapping[field.key] ? 'border-green-300 bg-green-50 text-green-700 font-bold' : 'border-slate-200 text-slate-400'}`}
                                                    value={columnMapping[field.key] || ''}
                                                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                                >
                                                    <option value="">(선택 안함)</option>
                                                    {excelHeaders.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={proceedToPreview} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition transform hover:scale-105">
                                데이터 검사하기 <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 'preview' && (
                    <div className="h-full flex flex-col">
                        <div className="mb-6 bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex items-start gap-4">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500 text-xl mt-1" />
                            <div>
                                <h3 className="font-bold text-yellow-800">최종 확인 (총 {rawExcelData.length.toLocaleString()}건)</h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    아래는 처음 5건의 데이터 미리보기입니다.<br />
                                    <strong>주의:</strong> '현장명'과 '팀명'이 시스템에 없는 경우, <strong>자동으로 신규 생성</strong>됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-xl shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr>
                                        {SYSTEM_FIELDS.map(f => (
                                            <th key={f.key} className="p-3 border-b whitespace-nowrap">{f.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="border-b hover:bg-slate-50">
                                            {SYSTEM_FIELDS.map(f => (
                                                <td key={f.key} className="p-3 border-r last:border-r-0 max-w-[200px] truncate">
                                                    {row[f.key] || <span className="text-slate-300 italic">(비어있음)</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-8 flex justify-between items-center">
                            <button onClick={() => setStep('mapping')} className="text-slate-500 hover:text-slate-800 font-medium">
                                ← 항목 연결 다시하기
                            </button>
                            <button onClick={startUpload} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition transform hover:scale-105 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCloudUploadAlt} />
                                {rawExcelData.length.toLocaleString()}건 저장 시작
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Uploading */}
                {(step === 'uploading' || step === 'complete') && (
                    <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto w-full">

                        {step === 'uploading' ? (
                            <div className="text-center mb-10">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-6xl text-blue-500 mb-6" />
                                <h2 className="text-3xl font-bold text-slate-800 mb-2">데이터 저장 중...</h2>
                                <p className="text-slate-500">창을 닫지 마세요. 100건씩 나누어 안전하게 저장하고 있습니다.</p>
                            </div>
                        ) : (
                            <div className="text-center mb-10">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-6xl text-green-500 mb-6" />
                                <h2 className="text-3xl font-bold text-slate-800 mb-2">저장 완료!</h2>
                                <p className="text-slate-500">모든 데이터 처리가 끝났습니다.</p>
                            </div>
                        )}

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-6 mb-4 overflow-hidden shadow-inner">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-6 rounded-full transition-all duration-300 relative flex items-center justify-center text-xs text-white font-bold"
                                style={{ width: `${progress}%` }}
                            >
                                {progress}%
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-6 w-full mb-8">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                <div className="text-slate-500 text-sm mb-1">총 데이터</div>
                                <div className="text-2xl font-bold text-slate-800">{uploadStats.total.toLocaleString()}</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm text-center">
                                <div className="text-green-600 text-sm mb-1">성공</div>
                                <div className="text-2xl font-bold text-green-700">{uploadStats.success.toLocaleString()}</div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm text-center">
                                <div className="text-red-600 text-sm mb-1">실패</div>
                                <div className="text-2xl font-bold text-red-700">{uploadStats.fail.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Live Logs */}
                        <div className="w-full bg-slate-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-sm text-green-400 shadow-inner">
                            {log.map((line, idx) => (
                                <div key={idx} className="mb-1 opacity-80">{'>'} {line}</div>
                            ))}
                            {step === 'uploading' && <div className="animate-pulse">{'>'} Processing...</div>}
                        </div>

                        {step === 'complete' && (
                            <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold">
                                추가 업로드 하기
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default MassDailyReportUploader;
