import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { geminiService } from '../../services/geminiService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faCalendarAlt, faSpinner, faPlus, faComment, faCloudUploadAlt } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';

// Register Handsontable modules
registerAllModules();

const DailyReportV2Page: React.FC = () => {
    const hotRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Dropdown Sources
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [siteNames, setSiteNames] = useState<string[]>([]);
    const [workerNames, setWorkerNames] = useState<string[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchReports();
    }, [date]);

    const fetchInitialData = async () => {
        try {
            const [fetchedTeams, fetchedSites, fetchedWorkers] = await Promise.all([
                teamService.getTeams(),
                siteService.getSites(),
                manpowerService.getWorkers()
            ]);

            setTeams(fetchedTeams);
            setSites(fetchedSites);
            setWorkers(fetchedWorkers);

            setTeamNames(fetchedTeams.map(t => t.name));
            setSiteNames(fetchedSites.map(s => s.name));
            setWorkerNames(fetchedWorkers.map(w => w.name));

        } catch (error) {
            console.error("Error fetching initial data:", error);
            Swal.fire('Error', '기초 데이터를 불러오는데 실패했습니다.', 'error');
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const reports = await dailyReportService.getReportsByRange(date, date);
            const gridData: any[] = [];

            reports.forEach(report => {
                report.workers.forEach(worker => {
                    gridData.push({
                        id: report.id,
                        workerId: worker.workerId,
                        team: report.teamName,
                        site: report.siteName,
                        name: worker.name,
                        role: worker.role,
                        manDay: worker.manDay,
                        unitPrice: worker.unitPrice || 0,
                        amount: (worker.manDay || 0) * (worker.unitPrice || 0),
                        note: worker.workContent || ''
                    });
                });
            });

            // Fill with empty rows if few
            while (gridData.length < 20) {
                gridData.push({});
            }

            setData(gridData);

        } catch (error) {
            console.error("Error fetching reports:", error);
            Swal.fire('Error', '일보 데이터를 불러오는데 실패했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const hot = hotRef.current?.hotInstance;
            const sourceData = hot?.getSourceData();

            if (!sourceData) return;

            // Group by Team and Site to create/update reports
            const reportsToSave = new Map<string, any>();

            for (const row of sourceData) {
                if (!row.team || !row.site || !row.name) continue;

                const team = teams.find(t => t.name === row.team);
                const site = sites.find(s => s.name === row.site);

                // Try to find worker by name
                let worker = workers.find(w => w.name === row.name);

                if (!team || !site) continue;

                const key = `${team.id}_${site.id}`;

                if (!reportsToSave.has(key)) {
                    reportsToSave.set(key, {
                        date: date,
                        teamId: team.id,
                        teamName: team.name,
                        siteId: site.id,
                        siteName: site.name,
                        workers: [],
                        totalManDay: 0,
                        writerId: 'system'
                    });
                }

                const report = reportsToSave.get(key);

                report.workers.push({
                    workerId: worker ? worker.id : 'unknown_' + Date.now(),
                    name: row.name,
                    role: row.role || (worker ? worker.role : '조공'),
                    status: 'attendance',
                    manDay: parseFloat(row.manDay) || 0,
                    unitPrice: parseInt(row.unitPrice) || 0,
                    workContent: row.note || '',
                    teamId: worker ? worker.teamId : undefined,
                    salaryModel: worker?.teamType === '지원팀' ? '지원팀' : worker?.teamType === '용역팀' ? '용역팀' : (worker?.salaryModel || '일급제')
                });

                report.totalManDay += parseFloat(row.manDay) || 0;
            }

            for (const report of Array.from(reportsToSave.values())) {
                for (const worker of report.workers) {
                    await dailyReportService.addWorkerToReport(
                        report.date,
                        report.teamId,
                        report.teamName,
                        report.siteId,
                        report.siteName,
                        worker
                    );
                }
            }

            Swal.fire('Success', '일보가 저장되었습니다.', 'success');
            fetchReports();

        } catch (error) {
            console.error("Error saving reports:", error);
            Swal.fire('Error', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // AI & Drag Drop Logic
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            processKakaoImage(file);
        }
    };

    const handleKakaoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processKakaoImage(file);
        }
        e.target.value = ''; // Reset
    };

    const processKakaoImage = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            Swal.fire('Error', '이미지 파일만 가능합니다.', 'error');
            return;
        }

        const apiKey = geminiService.getKey();
        if (!apiKey) {
            Swal.fire('Info', 'API 키 설정이 필요합니다.', 'info');
            return;
        }

        setLoading(true);
        try {
            const analyzedReports = await geminiService.analyzeKakaoImage(file);

            // Convert analyzed data to grid rows
            const newRows: any[] = [];

            for (const report of analyzedReports) {
                // Find matching Site
                // Priority: Exact > Contains
                const site = sites.find(s => s.name === report.siteName) ||
                    sites.find(s => s.name.includes(report.siteName || '') || (report.siteName || '').includes(s.name));
                const siteName = site?.name || report.siteName || ''; // Use matched or raw
                const siteResponsibleTeam = site?.responsibleTeamName || '';

                for (const w of report.workers) {
                    const worker = workers.find(wk => wk.name === w.name);

                    let teamName = siteResponsibleTeam || '미지정';
                    if (worker?.teamType === '지원팀') teamName = '지원';
                    // If worker has a specific team and it's not support, use that? 
                    // Usually Report is mostly about Site's team, but if worker is borrowed...
                    // Let's stick to site's team or simple logic for now.

                    newRows.push({
                        team: teamName,
                        site: siteName,
                        name: w.name,
                        role: w.role || worker?.role || '작업자',
                        manDay: w.manDay,
                        unitPrice: worker?.unitPrice || 0,
                        amount: (typeof w.manDay === 'number' ? w.manDay : 1) * (worker?.unitPrice || 0),
                        note: ''
                    });
                }
            }

            if (newRows.length === 0) {
                Swal.fire('Info', '인식된 데이터가 없습니다.', 'info');
                return;
            }

            // Append to existing data
            setData(prev => {
                // Filter out trailing empty rows from prev to make space
                const nonEmpty = prev.filter(r => r.name || r.site || r.team);
                const combined = [...nonEmpty, ...newRows];
                // Pad to at least 20
                while (combined.length < 20) combined.push({});
                return combined;
            });

            Swal.fire('Success', `${newRows.length}명의 데이터가 추가되었습니다.`, 'success');

        } catch (error) {
            console.error("AI Analysis Failed", error);
            Swal.fire('Error', '이미지 분석에 실패했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handsontable Settings
    const hotSettings = {
        data: data,
        colHeaders: ['팀', '현장', '성명', '공종', '공수', '단가', '금액', '비고'],
        columns: [
            { data: 'team', type: 'dropdown', source: teamNames },
            { data: 'site', type: 'dropdown', source: siteNames },
            { data: 'name', type: 'autocomplete', source: workerNames, strict: false },
            { data: 'role', type: 'text' },
            { data: 'manDay', type: 'numeric', numericFormat: { pattern: '0.0' } },
            { data: 'unitPrice', type: 'numeric', numericFormat: { pattern: '0,0' } },
            { data: 'amount', type: 'numeric', numericFormat: { pattern: '0,0' }, readOnly: true },
            { data: 'note', type: 'text' }
        ],
        rowHeaders: true,
        width: '100%',
        height: 'auto',
        licenseKey: 'non-commercial-and-evaluation',
        contextMenu: true,
        minSpareRows: 5,
        afterChange: (changes: any, source: any) => {
            if (source === 'loadData') return;
            if (!changes) return;

            const hot = hotRef.current?.hotInstance;
            if (!hot) return;

            changes.forEach(([row, prop, oldValue, newValue]: any) => {
                // Auto-calculate Amount
                if (prop === 'manDay' || prop === 'unitPrice') {
                    const manDay = hot.getDataAtRowProp(row, 'manDay');
                    const unitPrice = hot.getDataAtRowProp(row, 'unitPrice');
                    const amount = (parseFloat(manDay) || 0) * (parseInt(unitPrice) || 0);
                    hot.setDataAtRowProp(row, 'amount', amount);
                }

                // Auto-fill Role/UnitPrice if Name changes
                if (prop === 'name' && newValue) {
                    const worker = workers.find(w => w.name === newValue);
                    if (worker) {
                        if (!hot.getDataAtRowProp(row, 'role')) hot.setDataAtRowProp(row, 'role', worker.role);
                        if (!hot.getDataAtRowProp(row, 'unitPrice')) hot.setDataAtRowProp(row, 'unitPrice', worker.unitPrice);
                    }
                }
            });
        }
    };

    return (
        <div
            className="flex flex-col h-full bg-slate-50 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-yellow-400/80 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                    <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
                        <FontAwesomeIcon icon={faComment} className="text-6xl text-yellow-500 mb-4" />
                        <h2 className="text-3xl font-bold text-slate-800">카톡 이미지 떨어뜨리기</h2>
                        <p className="text-xl text-slate-500 mt-2">AI가 자동으로 일보를 작성합니다!</p>
                    </div>
                </div>
            )}

            {/* Header Toolbar */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold text-slate-800">일보 등록 (Spreadsheet)</h1>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg font-bold hover:bg-yellow-500 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <FontAwesomeIcon icon={faComment} />
                        카톡 분석 (AI)
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleKakaoUpload}
                        className="hidden"
                        accept="image/*"
                    />

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        저장하기
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden p-4">
                    <HotTable
                        ref={hotRef}
                        settings={hotSettings}
                    />
                </div>

                {loading && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-40 backdrop-blur-[1px]">
                        <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center">
                            <div className="animate-spin text-indigo-600 mb-3">
                                <FontAwesomeIcon icon={faSpinner} size="2x" />
                            </div>
                            <span className="font-bold text-slate-700">처리 중입니다...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportV2Page;
