import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faRobot, faPaste, faFileExcel, faExclamationTriangle, faSpinner, faCheck, faTrash } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { geminiService } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

registerAllModules();

interface ReportRow {
    date: string;
    siteName: string;
    teamName: string;
    workerName: string;
    manDay: number;
    unitPrice: number;
    role: string;
    content: string;
    note: string;
    // IDs for validation/saving
    siteId?: string;
    teamId?: string;
    workerId?: string;
}

const DailyReportExcelPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const hotRef = useRef<any>(null);
    const [loading, setLoading] = useState(false);

    // Lookups
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);

    useEffect(() => {
        Promise.all([
            siteService.getSites(),
            teamService.getTeams(),
            manpowerService.getWorkers()
        ]).then(([s, t, w]) => {
            setSites(s);
            setTeams(t);
            setWorkers(w);
        });
    }, []);

    // Initial Data
    const generateEmptyRows = (count: number): ReportRow[] => {
        return Array(count).fill(null).map(() => ({
            date: new Date().toISOString().slice(0, 10),
            siteName: '',
            teamName: '',
            workerName: '',
            manDay: 1.0,
            unitPrice: 0,
            role: '조공',
            content: '',
            note: ''
        }));
    };

    const [data, setData] = useState<ReportRow[]>(generateEmptyRows(50));

    // Data Processing & Validation
    const validateAndProcessData = (rows: ReportRow[]) => {
        return rows.map(row => {
            // Find IDs based on Names
            const site = sites.find(s => s.name === row.siteName);
            const team = teams.find(t => t.name === row.teamName);
            // Worker search (exact match or remove spaces)
            const cleanName = row.workerName.replace(/\s+/g, '');
            const worker = workers.find(w => w.name.replace(/\s+/g, '') === cleanName);

            return {
                ...row,
                siteId: site?.id,
                teamId: team?.id,
                workerId: worker?.id,
                // Auto-fill logic can go here (e.g. if Worker found but Team empty, fill Team)
                teamName: (!row.teamName && worker && worker.teamName) ? worker.teamName : row.teamName,
                // If Unit Price 0, fill from worker
                unitPrice: (row.unitPrice === 0 && worker) ? worker.unitPrice : row.unitPrice,
                role: (!row.role && worker) ? (worker.role || '조공') : (row.role || '조공')
            };
        });
    };

    // AI Analysis Handler
    const handleAIAnalysis = async () => {
        const apiKey = geminiService.getKey();
        const { value: formValues } = await Swal.fire({
            title: '카톡/일보 텍스트 AI 분석',
            html: `
                <textarea id="ai-input" class="swal2-textarea" placeholder="카톡 내용이나 일보 텍스트를 붙여넣으세요..." style="height: 200px; width: 90%;"></textarea>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    ${apiKey ? '✅ Gemini API Key가 감지되었습니다.' : '⚠ API Key가 필요합니다.'}
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'AI 분석 실행',
            cancelButtonText: '취소',
            width: 600,
            preConfirm: () => (document.getElementById('ai-input') as HTMLTextAreaElement).value
        });

        if (formValues) {
            if (!apiKey) {
                Swal.fire('Error', 'API Key가 없습니다. 설정에서 키를 등록해주세요.', 'error');
                return;
            }

            setLoading(true);
            try {
                // Determine if it's multiple reports or single
                // We'll use a generic "analyzeDailyReportText" which might return one object.
                // Or maybe we need a "Bulk" version? 
                // Let's assume the user pastes one or more.
                // Ideally geminiService.analyzeDailyReportText should return an ARRAY of reports if multiple found.
                // Current implementation returns ONE object.
                // I might need to ask Gemini to return Array.
                // But let's try with current service.
                const result = await geminiService.analyzeDailyReportText(formValues);

                // Map result to rows
                // Result structure: { teamName, siteName, date, workers: [...] }
                // We need to fill multiple rows.

                const newRows: ReportRow[] = [];
                const reportDate = result.date || new Date().toISOString().slice(0, 10);

                result.workers.forEach(w => {
                    newRows.push({
                        date: reportDate,
                        siteName: result.siteName || '',
                        teamName: w.teamName || result.teamName || '',
                        workerName: w.name,
                        manDay: w.manDay,
                        unitPrice: 0, // Inferred later
                        role: w.role || '조공', // Inferred later
                        content: w.workContent || '',
                        note: '',
                        siteId: undefined,
                        teamId: undefined,
                        workerId: undefined
                    });
                });

                // Merge into current grid
                const processed = validateAndProcessData(newRows);

                // Find first empty row
                const currentData = [...data];
                let insertIndex = 0;
                while (insertIndex < currentData.length && currentData[insertIndex].siteName) {
                    insertIndex++;
                }

                processed.forEach((item, idx) => {
                    if (insertIndex + idx < currentData.length) {
                        currentData[insertIndex + idx] = item;
                    } else {
                        currentData.push(item);
                    }
                });

                setData(currentData);
                Swal.fire('Success', `${processed.length}명의 데이터가 분석되었습니다.`, 'success');

            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'AI 분석 중 오류가 발생했습니다.', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    // Save Validation
    const handleSave = async () => {
        // Filter valid rows
        const validRows = data.filter(r => r.workerName && r.workerName.trim() !== '');

        if (validRows.length === 0) {
            Swal.fire('Info', '저장할 데이터가 없습니다.', 'info');
            return;
        }

        // Validate Critical Fields
        const invalidRows = validRows.filter(r => !r.siteName || !r.teamName); // We rely on Names, IDs resolved during save is better
        // Actually Handsontable data might not have IDs if user just typed "Site A".
        // We resolve IDs now.

        const resolvedRows = validateAndProcessData(validRows);
        const badRows = resolvedRows.filter(r => !r.siteId || !r.teamId);

        if (badRows.length > 0) {
            Swal.fire({
                title: '검증 실패',
                text: `${badRows.length}건의 데이터에 현장명 또는 팀명이 유효하지 않습니다. 빨간색 셀을 확인해주세요.`,
                icon: 'warning'
            });
            // Update data to show red cells? 
            // We should update the state with resolved IDs so renderer knows.
            // But we need to keep the user's text too.
            // The renderer relies on mapping names to IDs validation. 
            // We'll update the data state with what we found.
            // Actually, we should update the whole grid with resolved info to give feedback.
            return;
        }

        setLoading(true);
        try {
            // Group by Key (Date + Site + Team)
            const groups: { [key: string]: typeof resolvedRows } = {};

            resolvedRows.forEach(row => {
                const key = `${row.date}_${row.siteId}_${row.teamId}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(row);
            });

            // Save sequentially or parallel
            let count = 0;
            for (const key in groups) {
                const groupRows = groups[key];
                const first = groupRows[0];

                await dailyReportService.addReport({
                    date: first.date,
                    siteId: first.siteId!,
                    siteName: first.siteName,
                    teamId: first.teamId!,
                    teamName: first.teamName,
                    totalManDay: groupRows.reduce((acc, cur) => acc + cur.manDay, 0),
                    writerId: currentUser?.uid || 'unknown',
                    workers: groupRows.map(r => ({
                        salaryModel: (() => {
                            const matchedWorker = workers.find(w => w.id === r.workerId);
                            if (matchedWorker?.teamType === '지원팀') return '지원팀';
                            if (matchedWorker?.teamType === '용역팀') return '용역팀';
                            return matchedWorker?.salaryModel || '일급제';
                        })(),
                        workerId: r.workerId || 'unknown', // Unknown worker is allowed? Maybe.
                        name: r.workerName,
                        role: r.role || '조공',
                        manDay: r.manDay,
                        unitPrice: r.unitPrice,
                        workContent: r.content,
                        status: 'attendance'
                    }))
                });
                count++;
            }

            Swal.fire('Success', `${count}건의 일보가 저장되었습니다.`, 'success');
            // Clear or Redirect?
            // navigate('/report/list');
            setData(generateEmptyRows(50)); // Reset

        } catch (error) {
            console.error(error);
            Swal.fire('Error', '저장 실패', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                        <FontAwesomeIcon icon={faFileExcel} size="lg" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">스마트 일보 입력 (v3)</h1>
                        <p className="text-sm text-slate-500">AI로 분석된 데이터를 그리드에서 수정 후 저장하세요.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleAIAnalysis} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition flex items-center gap-2">
                        <FontAwesomeIcon icon={faRobot} /> AI 일보 분석
                    </button>
                    <button onClick={handleSave} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition flex items-center gap-2">
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />} 저장
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow border border-slate-200 overflow-hidden relative">
                <HotTable
                    ref={hotRef}
                    data={data}
                    colHeaders={['날짜', '현장명', '팀명', '작업자명', '공수', '단가', '직종', '작업내용', '비고']}
                    columns={[
                        { data: 'date', type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true, width: 100 },
                        { data: 'siteName', type: 'dropdown', source: sites.map(s => s.name), width: 120 },
                        { data: 'teamName', type: 'dropdown', source: teams.map(t => t.name), width: 100 },
                        { data: 'workerName', type: 'text', width: 100 },
                        { data: 'manDay', type: 'numeric', numericFormat: { pattern: '0.0' }, width: 60 },
                        { data: 'unitPrice', type: 'numeric', numericFormat: { pattern: '0,0' }, width: 80 },
                        { data: 'role', type: 'dropdown', source: ['기공', '조공', '팀장', '준기공'], width: 70 },
                        { data: 'content', type: 'text', width: 200 },
                        { data: 'note', type: 'text', width: 100 },
                    ]}
                    rowHeaders={true}
                    width="100%"
                    height="100%"
                    stretchH="all"
                    contextMenu={true}
                    autoWrapRow={true}
                    autoWrapCol={true}
                    licenseKey="non-commercial-and-evaluation"
                    minSpareRows={1}
                    // Renderer for validation styling
                    cells={(row, col, prop) => {
                        const cellProps: any = {};
                        if (row < data.length) {
                            const rowData = data[row];
                            // Check valid Site
                            if (prop === 'siteName' && rowData.siteName && !sites.find(s => s.name === rowData.siteName)) {
                                cellProps.className = 'bg-red-100 text-red-600 font-bold';
                            }
                            // Check valid Team
                            if (prop === 'teamName' && rowData.teamName && !teams.find(t => t.name === rowData.teamName)) {
                                cellProps.className = 'bg-red-100 text-red-600 font-bold';
                            }
                            // Check Worker
                            if (prop === 'workerName' && rowData.workerName && !workers.find(w => w.name.replace(/\s/g, '') === rowData.workerName.replace(/\s/g, ''))) {
                                cellProps.className = 'bg-yellow-50 text-orange-600 font-bold'; // Warning only (can save unknown)
                            }
                        }
                        return cellProps;
                    }}
                />
            </div>
        </div>
    );
};

export default DailyReportExcelPage;
