import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faCalendarAlt, faUsers, faCheckSquare, faSquare, faUndo, faPaste, faArrowRight, faExclamationTriangle, faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { authService } from '../../services/authService';

interface GridRow {
    id: string; // Worker ID
    name: string;
    role: string;
    teamId: string;
    teamName: string;

    // Input Fields
    selected: boolean;
    siteId: string;
    manDay: number;
    workContent: string;
    status: 'attendance' | 'absent' | 'half';
}

const DailyReportDirectInput: React.FC = () => {
    // Data States
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);

    // UI States
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [rows, setRows] = useState<GridRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Batch Action States
    const [batchSiteId, setBatchSiteId] = useState('');
    const [batchWorkContent, setBatchWorkContent] = useState('');

    // Smart Import States
    const [isSmartMode, setIsSmartMode] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [smartParsedData, setSmartParsedData] = useState<any[]>([]);
    const [smartHeaders, setSmartHeaders] = useState<string[]>([]);
    const [smartMapping, setSmartMapping] = useState<{ [index: number]: string }>({});

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [teamsData, sitesData, workersData] = await Promise.all([
                teamService.getTeams(),
                siteService.getSites(),
                manpowerService.getWorkers()
            ]);
            setTeams(teamsData);
            setSites(sitesData);
            setAllWorkers(workersData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    // Load Workers into Grid when Team Changes
    useEffect(() => {
        if (selectedTeamId) {
            loadTeamWorkers(selectedTeamId);
        } else if (!isSmartMode) {
            setRows([]);
        }
    }, [selectedTeamId, allWorkers]);

    const loadTeamWorkers = (teamId: string) => {
        // '퇴사' 상태가 아닌 작업자만 로드
        const teamWorkers = allWorkers.filter(w => w.teamId === teamId && w.status !== '퇴사' && w.status !== '퇴사자');
        const newRows: GridRow[] = teamWorkers.map(w => ({
            id: w.id || '',
            name: w.name,
            role: w.role || '작업자',
            teamId: w.teamId || '',
            teamName: w.teamName || '',
            selected: false,
            siteId: '', // Default empty
            manDay: 1.0, // Default 1.0
            workContent: '',
            status: 'attendance'
        }));
        setRows(newRows);
    };

    // --- Smart Import Logic ---
    const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setPasteData(text);
        parseSmartData(text);
    };

    /* Old Text Area Logic Removed
    const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setPasteData(text);
        parseSmartData(text);
    }; 
    */

    const parseSmartData = (text: string) => {
        const lines = text.trim().split('\n');
        if (lines.length === 0) return;

        // Detect delimiter
        const firstLine = lines[0];
        let delimiter = '\t';
        if (!firstLine.includes('\t') && firstLine.match(/\s{2,}/)) delimiter = '   ';

        const rows = lines.map(row => delimiter === '   ' ? row.split(/\s{2,}/) : row.split(delimiter));
        if (rows.length === 0) return;

        // Header Heuristic
        const headerRow = rows[0];
        setSmartHeaders(headerRow);

        // Map Columns (Order matches priority for substring checks)
        const FIELD_MAPPING: { [key: string]: string[] } = {
            responsibleTeamName: ['담당팀', '해당팀', '현장담당', '관리팀'], // MUST be before siteName ('현장') and teamName ('팀')
            date: ['날짜', '일자', 'Date'],
            siteName: ['현장', '현장명', '현장이름'],
            name: ['이름', '성명', '작업자'],
            teamName: ['팀', '팀명', '소속'],
            manDay: ['공수', '품'],
            workContent: ['작업', '내용', '작업내용'],
            payType: ['급여', '지급Request', '구분', '급여구분', '유형']
        };

        const newMapping: { [index: number]: string } = {};
        headerRow.forEach((header, index) => {
            const clean = header.trim();
            for (const [field, synonyms] of Object.entries(FIELD_MAPPING)) {
                if (synonyms.some(s => clean.includes(s))) {
                    newMapping[index] = field;
                    break;
                }
            }
        });
        setSmartMapping(newMapping);

        // Debug Mapping
        console.log('Smart Mapping Result:', newMapping);

        // Process Data
        const parsed = rows.slice(1).map((row, idx) => {
            const raw: any = {};
            Object.entries(newMapping).forEach(([colIdx, field]) => {
                raw[field] = row[parseInt(colIdx)]?.trim();
            });

            // Resolving IDs
            const matchedTeam = teams.find(t => t.name === raw.teamName || (raw.teamName && t.name.includes(raw.teamName)));
            const matchedSite = sites.find(s => s.name === raw.siteName || (raw.siteName && s.name.includes(raw.siteName)));

            // Worker Matching: Name matched AND (Team matched OR no team specified)
            const matchedWorker = allWorkers.find(w =>
                w.name === raw.name &&
                (!matchedTeam || w.teamId === matchedTeam.id)
            );

            // Date Normalization
            let dateVal = raw.date;
            if (dateVal && dateVal.includes('.')) dateVal = dateVal.replace(/\./g, '-');
            if (!dateVal) dateVal = new Date().toISOString().split('T')[0];

            return {
                id: idx,
                date: dateVal,
                raw,
                matchedTeam,
                matchedSite,
                matchedWorker,
                manDay: parseFloat(raw.manDay) || 1.0,
                workContent: raw.workContent || '',
                valid: !!(matchedTeam && matchedSite && matchedWorker)
            };
        });
        setSmartParsedData(parsed);
    };

    const handleSmartSave = async () => {
        // 1. Check for items to process (Include invalid ones for auto-creation)
        if (smartParsedData.length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }

        const confirmData = window.confirm(`총 ${smartParsedData.length}건의 데이터를 처리하시겠습니까?\n(없는 팀, 현장, 작업자는 자동으로 생성됩니다.)`);
        if (!confirmData) return;

        setSaving(true);
        try {
            const currentUser = authService.getCurrentUser();

            // --- Step 1: Identify & Create Missing Teams (Working & Responsible) ---
            const uniqueNewTeams = Array.from(new Set([
                ...smartParsedData
                    .filter(d => d.raw.teamName)
                    .map(d => d.raw.teamName),
                ...smartParsedData
                    .filter(d => d.raw.responsibleTeamName)
                    .map(d => d.raw.responsibleTeamName)
            ]));

            const teamMap = new Map<string, string>(); // Name -> ID
            // Add existing teams to map
            teams.forEach(t => teamMap.set(t.name, t.id || ''));

            for (const teamName of uniqueNewTeams) {
                try {
                    const newId = await teamService.addTeam({
                        name: teamName,
                        type: 'normal',
                        leaderId: '',
                        leaderName: '',
                        memberCount: 0
                    });
                    teamMap.set(teamName, newId);
                    console.log(`Created Team: ${teamName}`);
                } catch (e) {
                    console.error(`Failed to create team ${teamName}`, e);
                }
            }

            // --- Step 2: Identify & Create Missing Sites ---
            const uniqueNewSites = Array.from(new Set(
                smartParsedData
                    .filter(d => !d.matchedSite && d.raw.siteName)
                    .map(d => d.raw.siteName)
            ));

            const siteMap = new Map<string, string>(); // Name -> ID
            const siteResponsibleMap = new Map<string, { id: string, name: string }>(); // SiteID -> ResponsibleTeam Info
            sites.forEach(s => {
                siteMap.set(s.name, s.id || '');
                if (s.responsibleTeamId) {
                    siteResponsibleMap.set(s.id || '', { id: s.responsibleTeamId, name: s.responsibleTeamName || '' });
                }
            });

            for (const siteName of uniqueNewSites) {
                try {
                    // Find the first Team associated with this Site in the pasted data
                    const associatedRow = smartParsedData.find(d => d.raw.siteName === siteName);
                    let responsibleTeamId = '';
                    let responsibleTeamName = '';

                    if (associatedRow && associatedRow.raw.responsibleTeamName) {
                        responsibleTeamName = associatedRow.raw.responsibleTeamName;
                        responsibleTeamId = teamMap.get(responsibleTeamName) || '';
                    }

                    const newId = await siteService.addSite({
                        name: siteName,
                        code: 'AUTO-' + Math.floor(Math.random() * 10000),
                        status: 'active',
                        address: ''
                    });

                    siteMap.set(siteName, newId);
                    if (responsibleTeamId) {
                        siteResponsibleMap.set(newId, { id: responsibleTeamId, name: responsibleTeamName });
                    }
                    console.log(`Created Site: ${siteName} (Resp Team: ${responsibleTeamName})`);
                } catch (e) {
                    console.error(`Failed to create site ${siteName}`, e);
                }
            }

            // --- Step 3: Identify & Create Missing Workers ---
            const workerMap = new Map<string, string>(); // Name_TeamId -> WorkerId
            allWorkers.forEach(w => workerMap.set(`${w.name}_${w.teamId}`, w.id || ''));

            const newWorkersToCreate = new Map<string, { name: string, teamId: string, payType: string }>();

            smartParsedData.forEach(item => {
                const teamId = item.matchedTeam?.id || teamMap.get(item.raw.teamName);
                const name = item.raw.name;

                if (teamId && name) {
                    const key = `${name}_${teamId}`;
                    // If NOT in existing DB AND NOT matched
                    if (!item.matchedWorker && !workerMap.has(key)) {
                        newWorkersToCreate.set(key, {
                            name,
                            teamId,
                            payType: item.raw.payType || ''
                        });
                    }
                }
            });

            for (const [key, info] of newWorkersToCreate) {
                try {
                    const newId = await manpowerService.addWorker({
                        name: info.name,
                        teamId: info.teamId,
                        teamType: 'normal',
                        role: '작업자',
                        salaryModel: info.payType || '일급제', // Save extracted Salary Model
                        idNumber: '000000-0000000',
                        address: '주소미상',
                        status: 'active',
                        unitPrice: 0
                    });
                    workerMap.set(key, newId);
                    console.log(`Created Worker: ${info.name}`);
                } catch (e) {
                    console.error(`Failed to create worker ${info.name}`, e);
                }
            }

            // --- Step 4: Construct Daily Reports ---
            const grouped = new Map<string, any[]>();

            // Re-process items with ID Maps
            const processedItems = smartParsedData.map(item => {
                const teamId = item.matchedTeam?.id || teamMap.get(item.raw.teamName);
                const siteId = item.matchedSite?.id || siteMap.get(item.raw.siteName);
                const workerKey = `${item.raw.name}_${teamId}`;
                const workerId = item.matchedWorker?.id || workerMap.get(workerKey);

                return {
                    ...item,
                    finalTeamId: teamId,
                    finalSiteId: siteId,
                    finalWorkerId: workerId,
                    finalTeamName: item.matchedTeam?.name || item.raw.teamName,
                    finalSiteName: item.matchedSite?.name || item.raw.siteName,
                    finalWorkerName: item.matchedWorker?.name || item.raw.name
                };
            });

            // Filter only fully resolved items
            const finalValidItems = processedItems.filter(i => i.finalTeamId && i.finalSiteId && i.finalWorkerId);

            finalValidItems.forEach(item => {
                const key = `${item.date}_${item.finalSiteId}_${item.finalTeamId}`;
                const existing = grouped.get(key) || [];
                existing.push(item);
                grouped.set(key, existing);
            });

            const reportsToSave: Omit<DailyReport, 'id'>[] = [];

            grouped.forEach((items, key) => {
                const first = items[0];
                const totalManDay = items.reduce((sum, i) => sum + i.manDay, 0);

                // Get Responsible Team for this Site
                const respInfo = siteResponsibleMap.get(first.finalSiteId);

                reportsToSave.push({
                    date: first.date,
                    teamId: first.finalTeamId,
                    teamName: first.finalTeamName,
                    siteId: first.finalSiteId,
                    siteName: first.finalSiteName,
                    responsibleTeamId: respInfo?.id || '',
                    responsibleTeamName: respInfo?.name || '',
                    writerId: currentUser?.uid || 'unknown',
                    workers: items.map(i => ({
                        workerId: i.finalWorkerId,
                        name: i.finalWorkerName,
                        role: '작업자',
                        status: i.manDay === 1 ? 'attendance' : i.manDay === 0.5 ? 'half' : 'attendance',
                        manDay: i.manDay,
                        workContent: i.workContent || '',
                        teamId: first.finalTeamId
                    })),
                    totalManDay
                });
            });

            if (reportsToSave.length > 0) {
                await dailyReportService.addReportsBatch(reportsToSave);
                alert(`${reportsToSave.length}건의 일보 저장 완료!\n(신규 생성: 팀 ${uniqueNewTeams.length}, 현장 ${uniqueNewSites.length}, 작업자 ${newWorkersToCreate.size})`);
            } else {
                alert("저장할 데이터가 생성되지 않았습니다.");
            }

            // Cleanup
            setPasteData('');
            setSmartParsedData([]);
            setIsSmartMode(false);
            fetchInitialData();

        } catch (error) {
            console.error("Smart Save Error:", error);
            alert("저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };


    // --- Legacy Manual Functions ---
    const handleLoadPreviousDay = async () => {
        if (!selectedTeamId) {
            alert("팀을 먼저 선택해주세요.");
            return;
        }

        setLoading(true);
        try {
            const lastDate = await dailyReportService.getLastReportDate(selectedTeamId);
            if (!lastDate) {
                alert("이전 작업 기록이 없습니다.");
                setLoading(false);
                return;
            }

            const reports = await dailyReportService.getReports(lastDate, selectedTeamId);
            const newRows = [...rows];
            let matchCount = 0;

            reports.forEach(report => {
                report.workers.forEach(prevWorker => {
                    const rowIndex = newRows.findIndex(r => r.id === prevWorker.workerId);
                    if (rowIndex !== -1) {
                        newRows[rowIndex] = {
                            ...newRows[rowIndex],
                            siteId: report.siteId,
                            manDay: prevWorker.manDay,
                            workContent: prevWorker.workContent || '',
                            status: prevWorker.status
                        };
                        matchCount++;
                    }
                });
            });

            setRows(newRows);
            alert(`${lastDate} 기록을 불러왔습니다. (${matchCount}명 적용)`);
        } catch (error) {
            console.error("Failed to load previous day:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        const allSelected = rows.every(r => r.selected);
        setRows(rows.map(r => ({ ...r, selected: !allSelected })));
    };

    const toggleRowSelection = (id: string) => {
        setRows(rows.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
    };

    const updateRow = (id: string, field: keyof GridRow, value: any) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const applyBatchSite = () => {
        if (!batchSiteId) return;
        setRows(rows.map(r => r.selected ? { ...r, siteId: batchSiteId } : r));
    };

    const applyBatchContent = () => {
        if (!batchWorkContent) return;
        setRows(rows.map(r => r.selected ? { ...r, workContent: batchWorkContent } : r));
    };

    const setBatchStatus = (status: 'attendance' | 'absent' | 'half') => {
        const manDay = status === 'attendance' ? 1.0 : status === 'half' ? 0.5 : 0;
        setRows(rows.map(r => r.selected ? { ...r, status, manDay } : r));
    };

    const handleSave = async () => {
        const validRows = rows.filter(r => r.status !== 'absent' && r.manDay > 0);
        if (validRows.length === 0) {
            alert("저장할 공수 데이터가 없습니다.");
            return;
        }
        const invalidRows = validRows.filter(r => !r.siteId);
        if (invalidRows.length > 0) {
            alert(`현장이 선택되지 않은 작업자가 ${invalidRows.length}명 있습니다.`);
            return;
        }

        setSaving(true);
        try {
            const reportsBySite = new Map<string, GridRow[]>();
            validRows.forEach(row => {
                const existing = reportsBySite.get(row.siteId) || [];
                existing.push(row);
                reportsBySite.set(row.siteId, existing);
            });

            const reportsToSave: Omit<DailyReport, 'id'>[] = [];
            const currentUser = authService.getCurrentUser();

            reportsBySite.forEach((siteRows, siteId) => {
                const site = sites.find(s => s.id === siteId);
                const team = teams.find(t => t.id === selectedTeamId);
                if (!site || !team) return;

                const totalManDay = siteRows.reduce((sum: number, r: GridRow) => sum + r.manDay, 0);

                reportsToSave.push({
                    date,
                    teamId: team.id || '',
                    teamName: team.name,
                    siteId: site.id || '',
                    siteName: site.name,
                    responsibleTeamId: site.responsibleTeamId,
                    responsibleTeamName: site.responsibleTeamName,
                    companyId: site.companyId,
                    companyName: site.companyName,
                    writerId: currentUser?.uid || 'unknown',
                    workers: siteRows.map((r: GridRow) => ({
                        workerId: r.id,
                        name: r.name,
                        role: r.role,
                        status: r.status,
                        manDay: r.manDay,
                        workContent: r.workContent,
                        teamId: r.teamId
                    })),
                    totalManDay
                });
            });

            await dailyReportService.addReportsBatch(reportsToSave);
            alert("일보가 저장되었습니다.");
        } catch (error) {
            console.error("Save failed:", error);
            alert("저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const totalSelected = rows.filter(r => r.selected).length;
    const totalManDay = rows.reduce((sum, r) => sum + (r.status !== 'absent' ? r.manDay : 0), 0);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Top Toolbar */}
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4 bg-gray-50">
                {!isSmartMode ? (
                    <>
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-500" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} className="text-gray-500" />
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[150px]"
                            >
                                <option value="">팀 선택...</option>
                                {teams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </>
                ) : (
                    <div className="text-lg font-bold text-indigo-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPaste} />
                        스마트 일보 대량 등록
                    </div>
                )}

                {!isSmartMode && (
                    <button
                        onClick={handleLoadPreviousDay}
                        disabled={loading || !selectedTeamId}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faUndo} />
                        전일 복사
                    </button>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setIsSmartMode(!isSmartMode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-bold transition-all ${isSmartMode ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        <FontAwesomeIcon icon={faPaste} />
                        {isSmartMode ? '기본 모드로 돌아가기' : '엑셀 붙여넣기 모드'}
                    </button>

                    {!isSmartMode && (
                        <>
                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-sm font-bold">
                                총 공수: {totalManDay.toFixed(1)}
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                {saving ? '저장 중...' : '일보 저장'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Smart Import Body */}
            {isSmartMode ? (
                <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                    <div className="bg-indigo-50 border border-indigo-200 rounded p-4 text-sm text-indigo-800">
                        💡 <strong>사용 방법:</strong> 엑셀에서 데이터를 복사하여 붙여넣으세요. (날짜, 현장명, 이름, 팀명, 공수 데이터가 자동으로 매핑됩니다.)
                    </div>
                    <div className="flex-1 flex gap-4 overflow-hidden">
                        {/* Input Area */}
                        {/* Input Area */}
                        <div className="w-1/3 flex flex-col">
                            <label className="font-semibold text-gray-700 mb-2">데이터 붙여넣기</label>
                            <div className="text-xs text-gray-500 mb-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                                <strong>권장 헤더 (이대로 넣으면 정확합니다):</strong><br />
                                날짜 | 현장명 | 담당팀 | 이름 | 팀명 | 공수 | 작업내용 | 구분
                            </div>
                            <textarea
                                className="flex-1 border p-4 rounded resize-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                placeholder={`[권장 포맷 예시]\n날짜\t현장명\t담당팀\t이름\t팀명\t공수\t작업내용\t구분\n2024-11-20\t현대건설\tA관리팀\t홍길동\tA팀\t1.0\t배관작업\t월급제\n2024-11-20\tGS건설\tB관리팀\t김철수\tB팀\t1.5\t전기작업\t일급제`}
                                value={pasteData}
                                onChange={handlePaste}
                            />
                        </div>
                        {/* Preview Area */}
                        <div className="w-2/3 flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <label className="font-semibold text-gray-700">미리보기 ({smartParsedData.length}건)</label>
                                <button
                                    onClick={handleSmartSave}
                                    disabled={smartParsedData.filter(d => d.valid).length === 0 || saving}
                                    className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                    일괄 등록 실행
                                </button>
                            </div>
                            <div className="flex-1 border rounded overflow-auto bg-gray-50">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-gray-200 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2">상태</th>
                                            <th className="px-3 py-2">날짜</th>
                                            <th className="px-3 py-2">현장</th>
                                            <th className="px-3 py-2">팀</th>
                                            <th className="px-3 py-2">작업자</th>
                                            <th className="px-3 py-2">공수</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {smartParsedData.map((row, idx) => (
                                            <tr key={idx} className={row.valid ? '' : 'bg-red-50'}>
                                                <td className="px-3 py-2">
                                                    {row.valid ? <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" /> : <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" title="매칭 실패 (현장/팀/이름 확인)" />}
                                                </td>
                                                <td className="px-3 py-2">{row.date}</td>
                                                <td className="px-3 py-2">
                                                    {row.matchedSite ? <span className="text-green-600">{row.matchedSite.name}</span> : <span className="text-red-400">{row.raw.siteName} (매칭X)</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.matchedTeam ? <span className="text-green-600">{row.matchedTeam.name}</span> : <span className="text-red-400">{row.raw.teamName} (매칭X)</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.matchedWorker ? <span className="text-green-600">{row.matchedWorker.name}</span> : <span className="text-red-400">{row.raw.name} (매칭X)</span>}
                                                </td>
                                                <td className="px-3 py-2">{row.manDay}</td>
                                            </tr>
                                        ))}
                                        {smartParsedData.length === 0 && (
                                            <tr><td colSpan={6} className="text-center py-10 text-gray-400">데이터가 없습니다.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Batch Action Bar (Visible when rows selected) */}
                    {totalSelected > 0 && (
                        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-4 animate-fade-in">
                            <span className="text-sm font-bold text-blue-800">{totalSelected}명 선택됨</span>

                            <div className="h-4 w-px bg-blue-200"></div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={batchSiteId}
                                    onChange={(e) => setBatchSiteId(e.target.value)}
                                    className="border border-blue-200 rounded px-2 py-1 text-sm"
                                >
                                    <option value="">현장 일괄 선택...</option>
                                    {sites.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}{s.companyName ? ` (${s.companyName})` : ''}</option>
                                    ))}
                                </select>
                                <button onClick={applyBatchSite} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">적용</button>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="작업내용 일괄 입력..."
                                    value={batchWorkContent}
                                    onChange={(e) => setBatchWorkContent(e.target.value)}
                                    className="border border-blue-200 rounded px-2 py-1 text-sm w-40"
                                />
                                <button onClick={applyBatchContent} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">적용</button>
                            </div>

                            <div className="flex items-center gap-1 ml-auto">
                                <button onClick={() => setBatchStatus('attendance')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200">출근 (1.0)</button>
                                <button onClick={() => setBatchStatus('half')} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded border border-yellow-200">반공수 (0.5)</button>
                                <button onClick={() => setBatchStatus('absent')} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200">결근 (0)</button>
                            </div>
                        </div>
                    )}

                    {/* Main Grid */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 border-b border-gray-200 w-10 text-center">
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-blue-600">
                                            <FontAwesomeIcon icon={rows.length > 0 && rows.every(r => r.selected) ? faCheckSquare : faSquare} />
                                        </button>
                                    </th>
                                    <th className="p-3 border-b border-gray-200 w-24">이름</th>
                                    <th className="p-3 border-b border-gray-200 w-20">직책</th>
                                    <th className="p-3 border-b border-gray-200 w-48">현장</th>
                                    <th className="p-3 border-b border-gray-200 w-24">공수</th>
                                    <th className="p-3 border-b border-gray-200">작업내용</th>
                                    <th className="p-3 border-b border-gray-200 w-24">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-400">
                                            {selectedTeamId ? "팀원이 없습니다." : "팀을 선택해주세요."}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map(row => (
                                        <tr key={row.id} className={`hover:bg-gray-50 ${row.selected ? 'bg-blue-50/50' : ''}`}>
                                            <td className="p-3 text-center">
                                                <button onClick={() => toggleRowSelection(row.id)} className={`${row.selected ? 'text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}>
                                                    <FontAwesomeIcon icon={row.selected ? faCheckSquare : faSquare} />
                                                </button>
                                            </td>
                                            <td className="p-3 font-medium text-gray-800">{row.name}</td>
                                            <td className="p-3 text-gray-500">{row.role}</td>
                                            <td className="p-3">
                                                <select
                                                    value={row.siteId}
                                                    onChange={(e) => updateRow(row.id, 'siteId', e.target.value)}
                                                    className={`w-full border rounded px-2 py-1 text-sm ${!row.siteId ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                                                >
                                                    <option value="">현장 선택</option>
                                                    {sites.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}{s.companyName ? ` (${s.companyName})` : ''}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={row.manDay}
                                                    onChange={(e) => updateRow(row.id, 'manDay', parseFloat(e.target.value))}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={row.workContent}
                                                    onChange={(e) => updateRow(row.id, 'workContent', e.target.value)}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                                    placeholder="작업내용 입력"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <select
                                                    value={row.status}
                                                    onChange={(e) => {
                                                        const status = e.target.value as any;
                                                        const manDay = status === 'attendance' ? 1.0 : status === 'half' ? 0.5 : 0;
                                                        updateRow(row.id, 'status', status);
                                                        updateRow(row.id, 'manDay', manDay);
                                                    }}
                                                    className={`w-full border rounded px-2 py-1 text-sm ${row.status === 'absent' ? 'text-red-600 bg-red-50 border-red-200' :
                                                        row.status === 'half' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                                            'text-green-600 bg-green-50 border-green-200'
                                                        }`}
                                                >
                                                    <option value="attendance">출근</option>
                                                    <option value="half">반공수</option>
                                                    <option value="absent">결근</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default DailyReportDirectInput;