import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faCalendarAlt, faTimes, faMinus, faComment, faExclamationTriangle, faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { geminiService } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';

// Register all Handsontable modules
registerAllModules();

interface GridRow {
    id: string;
    teamId: string;
    teamName: string;
    workerId: string;
    name: string;
    manDay: number;
    unitPrice: number;
    role: string;
    description: string; // 작업내용
}

interface Ledger {
    id: string;
    siteId: string;
    rows: GridRow[];
    description: string; // Ledger-level Work Content
}

// --- Child Component: DailyReportTable ---
const DailyReportTable: React.FC<{
    ledger: Ledger;
    ledgerIndex: number;
    sites: Site[];
    teams: Team[];
    workerMap: Map<string, Worker>;
    onUpdate: (ledgerId: string, updates: Partial<Ledger>) => void;
    onDelete: (ledgerId: string) => void;
}> = ({ ledger, ledgerIndex, sites, teams, workerMap, onUpdate, onDelete }) => {

    const hotRef = useRef<any>(null);

    // Convert rows to 2D array for Handsontable
    const tableData = useMemo(() => {
        return ledger.rows.map(row => [row.name, row.manDay, row.teamName]);
    }, [ledger.rows]);

    // Handle cell changes
    const handleAfterChange = useCallback((changes: any, source: string) => {
        if (!changes || source === 'loadData') return;

        // Deep copy to prevent mutation issues
        const newRows = ledger.rows.map(row => ({ ...row }));

        changes.forEach(([row, col, oldValue, newValue]: [number, number, any, any]) => {
            if (row >= newRows.length) return;

            if (col === 0) { // Name column
                const rawName = newValue?.toString() || '';
                const searchName = rawName.replace(/\s+/g, ''); // Remove spaces for search
                newRows[row].name = rawName;

                if (searchName) {
                    const matchedWorker = workerMap.get(searchName);
                    if (matchedWorker) {
                        newRows[row].workerId = matchedWorker.id || '';
                        newRows[row].unitPrice = matchedWorker.unitPrice || 0;
                        newRows[row].role = matchedWorker.role || '작업자';
                        // Auto-fill description with default role if empty -> Removed as per user request
                        // if (!newRows[row].description) newRows[row].description = matchedWorker.role || '';

                        const team = matchedWorker.teamId ? teams.find(t => t.id === matchedWorker.teamId) : undefined;
                        if (team) {
                            newRows[row].teamName = team.name;
                            newRows[row].teamId = team.id || '';
                        } else {
                            newRows[row].teamName = matchedWorker.teamName || '';
                            newRows[row].teamId = matchedWorker.teamId || '';
                        }
                    } else {
                        // Name exists but NO match found -> Worker ID empty (Unknown Worker)
                        newRows[row].workerId = '';
                        if (!newRows[row].unitPrice) newRows[row].unitPrice = 0;
                        if (!newRows[row].role) newRows[row].role = '작업자';
                    }
                } else {
                    // Name is empty - clear all related fields
                    newRows[row].workerId = '';
                    newRows[row].unitPrice = 0;
                    newRows[row].role = '작업자';
                    newRows[row].teamName = '';
                    newRows[row].teamId = '';
                    newRows[row].description = '';
                }
            } else if (col === 1) { // ManDay column
                newRows[row].manDay = Number(newValue) || 1;
            }
        });

        onUpdate(ledger.id, { rows: newRows });
    }, [ledger.id, ledger.rows, workerMap, teams, onUpdate]);

    const selectedSite = sites.find(s => s.id === ledger.siteId);

    // Filter teams assigned to this site (via Site.responsibleTeamId)
    const siteTeams = useMemo(() => {
        if (!ledger.siteId) return [];
        const site = sites.find(s => s.id === ledger.siteId);
        if (!site || !site.responsibleTeamId) return [];
        return teams.filter(t => t.id === site.responsibleTeamId);
    }, [ledger.siteId, sites, teams]);

    const handleAddTeamMembers = (team: Team) => {
        // Find all workers in this team
        const teamWorkers = Array.from(workerMap.values()).filter(w => w.teamId === team.id);

        if (teamWorkers.length === 0) {
            Swal.fire('Info', '해당 팀에 등록된 작업자가 없습니다.', 'info');
            return;
        }

        // Deep copy rows to modify
        const newRows = [...ledger.rows];

        // Find first empty row to start inserting
        let insertIndex = newRows.findIndex(r => !r.name || r.name.trim() === '');
        if (insertIndex === -1) {
            // No empty rows, append to end (though usually we have spare rows)
            insertIndex = newRows.length;
            // Logic to expand rows is simpler if we just fill available empty slots or tell user to add rows
            // For now, let's fill available slots
        }

        let filledCount = 0;
        teamWorkers.forEach(worker => {
            // Find next empty slot
            const targetIndex = newRows.findIndex((r, idx) => idx >= insertIndex && (!r.name || r.name.trim() === ''));

            if (targetIndex !== -1) {
                newRows[targetIndex] = {
                    ...newRows[targetIndex],
                    workerId: worker.id || '',
                    name: worker.name,
                    manDay: 1.0,
                    teamId: team.id || '',
                    teamName: team.name,
                    unitPrice: worker.unitPrice || 0,
                    role: worker.role || '작업자',
                    description: ''
                };
                filledCount++;
            }
        });

        if (filledCount < teamWorkers.length) {
            Swal.fire('Warning', `빈 행이 부족하여 ${teamWorkers.length - filledCount}명을 추가하지 못했습니다. 행을 추가해주세요.`, 'warning');
        }

        onUpdate(ledger.id, { rows: newRows });
    };

    // Check if this ledger has critical issues (missing site)
    const isSiteMissing = !ledger.siteId;

    // Count unknown workers for summary badge
    const unknownWorkersCount = ledger.rows.filter(r => r.name.trim() !== '' && !r.workerId).length;

    return (
        <div className={`border rounded-lg overflow-hidden shadow-sm flex flex-col w-[320px] bg-white transition-all ${isSiteMissing ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'}`}>
            {/* Ledger Header - Compact */}
            <div className={`px-2 py-1 flex justify-between items-center shrink-0 ${isSiteMissing ? 'bg-red-500' : 'bg-[#4A192C]'} text-white transition-colors`}>
                <div className="flex items-center gap-2 flex-1">
                    <span className="font-bold text-xs whitespace-nowrap">장부{ledgerIndex}</span>
                    <select
                        value={ledger.siteId}
                        onChange={(e) => onUpdate(ledger.id, { siteId: e.target.value })}
                        className={`text-slate-900 border-none rounded px-2 py-1 text-xs font-bold focus:ring-2 flex-1 ${isSiteMissing ? 'bg-red-50 focus:ring-red-300' : 'bg-white focus:ring-blue-500'}`}
                    >
                        <option value="" disabled>⚠️ 현장 필수 선택</option>
                        {sites.map(site => (
                            <option key={site.id} value={site.id}>{site.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    {unknownWorkersCount > 0 && (
                        <span className="bg-yellow-400 text-slate-900 text-[10px] px-1.5 rounded-full font-bold flex items-center gap-1" title="등록되지 않은 작업자 수">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> {unknownWorkersCount}
                        </span>
                    )}
                    {/* Team Quick Add Buttons */}
                    {siteTeams.length > 0 && (
                        <div className="flex gap-1 ml-2 px-2 border-l border-white/20">
                            {siteTeams.map(team => (
                                <button
                                    key={team.id}
                                    onClick={() => handleAddTeamMembers(team)}
                                    className="px-2 py-0.5 bg-white/20 hover:bg-white/40 text-white text-[10px] rounded transition-colors"
                                    title={`${team.name} 팀원 전체 추가`}
                                >
                                    {team.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => onDelete(ledger.id)}
                        className="ml-1 text-white/70 hover:text-white"
                        title="장부 삭제"
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>

            {/* Handsontable Grid */}
            <div className="handsontable-container relative">
                <HotTable
                    ref={hotRef}
                    data={tableData}
                    colHeaders={['이름', '공수', '팀명']}
                    columns={[
                        { type: 'text', width: 90 },
                        { type: 'numeric', width: 50 },
                        { type: 'text', width: 90, readOnly: true, className: 'htDimmed' },
                    ]}
                    rowHeaders={false}
                    width="100%"
                    height="auto"
                    stretchH="all"
                    autoWrapRow={true}
                    autoWrapCol={true}
                    licenseKey="non-commercial-and-evaluation"
                    // Excel-like settings
                    enterBeginsEditing={true}
                    enterMoves={{ row: 1, col: 0 }}
                    tabMoves={{ row: 0, col: 1 }}
                    fillHandle={true}
                    // Event handlers
                    afterChange={handleAfterChange}
                    // Prevent Selection on Team Column (Index 2)
                    beforeOnCellMouseDown={(event: MouseEvent, coords: any) => {
                        // Prevent click on Team column (col 2)
                        if (coords.col === 2) {
                            event.stopImmediatePropagation();
                        }
                    }}
                    afterSelection={(r: number, c: number) => {
                        // If somehow selected (e.g. Tab), move to next row, first column
                        if (c === 2) {
                            const hot = hotRef.current?.hotInstance;
                            if (hot) {
                                // If it's the last row, maybe just stay or add row? 
                                // For now, just go to next row col 0
                                hot.selectCell(r + 1, 0);
                            }
                        }
                    }}
                    // IME-friendly settings
                    imeFastEdit={true}
                    // Dynamic Cell Styling
                    cells={(row, col, prop) => {
                        const cellProperties: any = {};
                        if (row < ledger.rows.length) {
                            const rowData = ledger.rows[row];

                            // Highlight Name column if Name exists but WorkerId is missing
                            if (col === 0 && rowData.name.trim() !== '' && !rowData.workerId) {
                                cellProperties.className = 'unknown-worker-cell';
                                cellProperties.title = "등록되지 않은 이름입니다. 확인해주세요.";
                            }
                        }
                        return cellProperties;
                    }}
                />
            </div>

            {/* Ledger Footer - Work Content Input */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 shrink-0">
                        <FontAwesomeIcon icon={faComment} className="mr-1" />
                        작업내용
                    </span>
                    <input
                        type="text"
                        value={ledger.description || ''}
                        onChange={(e) => onUpdate(ledger.id, { description: e.target.value })}
                        placeholder="이 현장의 금일 작업내용을 입력하세요 (장부 전체 적용)"
                        className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Custom Styles */}
            <style>{`
                .handsontable-container .handsontable {
                    font-size: 12px;
                }
                .handsontable-container .handsontable th {
                    background-color: ${isSiteMissing ? '#ef4444' : '#4A192C'} !important;
                    color: white !important;
                    font-weight: bold !important;
                    font-size: 11px;
                }
                /* Default Styles */
                .handsontable-container .handsontable td:first-child {
                    background-color: #E0F7FA;
                }
                .handsontable-container .handsontable td:nth-child(2) {
                    background-color: #FCE4EC;
                    text-align: center;
                }
                .handsontable-container .handsontable td:nth-child(3) {
                    background-color: #F5F5F5;
                    color: #64748b;
                    font-size: 11px;
                }
                
                /* Warning Styles */
                .handsontable-container .handsontable td.unknown-worker-cell {
                    background-color: #fca5a5 !important; /* Red-300 */
                    color: #7f1d1d !important; /* Red-900 */
                    font-weight: bold;
                    border: 1px solid #ef4444 !important;
                }
            `}</style>
        </div>
    );
};


// --- Main Component ---
const DailyReportGridInput: React.FC = () => {
    const { currentUser } = useAuth();
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Optimize lookups
    const workerMap = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach(w => map.set(w.name.replace(/\s+/g, ''), w));
        return map;
    }, [workers]);

    // Validation Summary
    const validationSummary = useMemo(() => {
        let missingSites = 0;
        let unknownWorkers = 0;
        let totalWorkers = 0;

        ledgers.forEach(ledger => {
            if (!ledger.siteId) missingSites++;
            ledger.rows.forEach(r => {
                if (r.name.trim() !== '') {
                    totalWorkers++;
                    if (!r.workerId) unknownWorkers++;
                }
            });
        });

        return { missingSites, unknownWorkers, totalWorkers };
    }, [ledgers]);

    const fetchMasterData = useCallback(
        async (options?: { rematchLedgers?: boolean }) => {
            try {
                setFetching(true);
                const [sitesData, teamsData, workersData] = await Promise.all([
                    siteService.getSites(),
                    teamService.getTeams(),
                    manpowerService.getWorkers()
                ]);
                setSites(sitesData);
                setTeams(teamsData);
                setWorkers(workersData);

                if (options?.rematchLedgers) {
                    const workerByName = new Map<string, Worker>();
                    workersData.forEach(w => workerByName.set(w.name.replace(/\s+/g, ''), w));

                    const teamById = new Map<string, Team>();
                    teamsData.forEach(t => {
                        if (t.id) teamById.set(t.id, t);
                    });

                    setLedgers(prev =>
                        prev.map(ledger => ({
                            ...ledger,
                            rows: ledger.rows.map(row => {
                                if (row.name.trim().length === 0) return row;
                                if (row.workerId.trim().length > 0) return row;

                                const key = row.name.replace(/\s+/g, '');
                                const matchedWorker = workerByName.get(key);
                                if (!matchedWorker) return row;

                                const matchedTeam = matchedWorker.teamId ? teamById.get(matchedWorker.teamId) : undefined;

                                return {
                                    ...row,
                                    workerId: matchedWorker.id ?? '',
                                    unitPrice: matchedWorker.unitPrice ?? 0,
                                    role: matchedWorker.role || '작업자',
                                    teamId: matchedTeam?.id ?? matchedWorker.teamId ?? '',
                                    teamName: matchedTeam?.name ?? matchedWorker.teamName ?? ''
                                };
                            })
                        }))
                    );
                }
            } catch (error) {
                console.error('Failed to fetch master data', error);
            } finally {
                setFetching(false);
            }
        },
        []
    );

    // Fetch Initial Data
    useEffect(() => {
        const run = async () => {
            await fetchMasterData();

            setLedgers(prev => {
                if (prev.length === 0) {
                    return [{
                        id: Date.now().toString(),
                        siteId: '',
                        rows: createEmptyRows(20),
                        description: ''
                    }];
                }
                return prev;
            });
        };

        run().catch(error => console.error('Failed to fetch initial data', error));
    }, [fetchMasterData]);

    useEffect(() => {
        const masterDataChangedEventName = 'smart-construction:master-data-changed';

        const onMasterDataChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{
                workers?: boolean;
                teams?: boolean;
                sites?: boolean;
                companies?: boolean;
            }>;

            if (customEvent.detail?.workers || customEvent.detail?.teams || customEvent.detail?.sites) {
                fetchMasterData({ rematchLedgers: true }).catch(error => console.error('Failed to refresh master data', error));
            }
        };

        window.addEventListener(masterDataChangedEventName, onMasterDataChanged);
        return () => window.removeEventListener(masterDataChangedEventName, onMasterDataChanged);
    }, [fetchMasterData]);

    const createEmptyRows = (count: number): GridRow[] => {
        return Array(count).fill(null).map(() => ({
            id: Math.random().toString(36).substr(2, 9),
            teamId: '',
            teamName: '',
            workerId: '',
            name: '',
            manDay: 1.0,
            unitPrice: 0,
            role: '작업자',
            description: ''
        }));
    };

    const addLedger = useCallback(() => {
        const newLedger: Ledger = {
            id: Date.now().toString(),
            siteId: '',
            rows: createEmptyRows(20),
            description: ''
        };
        setLedgers(prev => [...prev, newLedger]);
    }, []);

    const removeLedger = useCallback((id: string) => {
        setLedgers(prev => prev.filter(l => l.id !== id));
    }, []);

    const removeLastLedger = useCallback(() => {
        setLedgers(prev => {
            if (prev.length === 0) return prev;
            return prev.slice(0, -1);
        });
    }, []);

    const updateLedger = useCallback((id: string, updates: Partial<Ledger>) => {
        setLedgers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, []);

    const addRowsToAllLedgers = useCallback(() => {
        setLedgers(prev => prev.map(ledger => ({
            ...ledger,
            rows: [...ledger.rows, ...createEmptyRows(10)]
        })));
    }, []);

    const handleSaveAll = async () => {
        // Validation check before save
        if (validationSummary.missingSites > 0) {
            Swal.fire('Warning', '현장이 선택되지 않은 장부가 있습니다.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const allReports: Omit<DailyReport, 'id'>[] = [];
            const involvedTeamIds = new Set<string>();

            for (const ledger of ledgers) {
                if (!ledger.siteId) continue;

                const validRows = ledger.rows.filter(r => r.name.trim() !== '');
                if (validRows.length === 0) continue;

                // Group by Team within this Ledger
                const groups: { [key: string]: GridRow[] } = {};
                validRows.forEach(row => {
                    const key = row.teamId || 'no-team';
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(row);
                });

                const site = sites.find(s => s.id === ledger.siteId);

                Object.entries(groups).forEach(([teamKey, rows]) => {
                    const realTeamId = teamKey === 'no-team' ? '' : teamKey;
                    const team = teams.find(t => t.id === realTeamId);

                    involvedTeamIds.add(realTeamId);

                    const totalManDay = rows.reduce((sum, r) => sum + r.manDay, 0);
                    const reportWorkers = rows.map(r => ({
                        salaryModel: (() => {
                            const matchedWorker = workers.find(w => w.id === r.workerId);
                            if (matchedWorker?.teamType === '지원팀') return '지원팀';
                            if (matchedWorker?.teamType === '용역팀') return '용역팀';
                            return matchedWorker?.salaryModel || '일급제';
                        })(),
                        workerId: r.workerId || 'unknown',
                        name: r.name,
                        role: r.role,
                        status: 'attendance' as const,
                        manDay: r.manDay,
                        workContent: r.description, // User removed individual work content input, but logic remains if needed
                        teamId: realTeamId,
                        unitPrice: r.unitPrice
                    }));

                    allReports.push({
                        date,
                        teamId: realTeamId,
                        teamName: team?.name || '',
                        siteId: ledger.siteId,
                        siteName: site?.name || '',
                        writerId: currentUser?.uid || 'unknown',
                        workers: reportWorkers,
                        totalManDay,
                        responsibleTeamId: site?.responsibleTeamId,
                        responsibleTeamName: site?.responsibleTeamName,
                        workContent: ledger.description || '' // Report Level Work Content
                    });
                });
            }

            if (allReports.length > 0) {
                // Use overwriteReports to delete existing reports for these teams/date before saving
                // This prevents duplicates if user clicks save multiple times
                await dailyReportService.overwriteReports(date, allReports, Array.from(involvedTeamIds));
                alert(`${allReports.length}건의 일보가 저장되었습니다.`);
            } else {
                alert('저장할 데이터가 없습니다. (현장 선택 및 이름 입력 필수)');
            }

        } catch (error) {
            console.error("Save failed", error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // --- AI & Drag Drop Logic ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Check if leaving the window/container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processKakaoImage(file);
    };

    const handleKakaoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processKakaoImage(file);
        }
        e.target.value = '';
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
            const newLedgers: Ledger[] = [];
            let totalUnknowns = 0;

            for (const report of analyzedReports) {
                // Find matching Site
                const site = sites.find(s => s.name === report.siteName) ||
                    sites.find(s => s.name.includes(report.siteName || '') || (report.siteName || '').includes(s.name));
                const siteId = site?.id || '';

                // Create rows
                const rows = createEmptyRows(20); // Base rows

                report.workers.forEach((w, idx) => {
                    const worker = workers.find(wk => wk.name === w.name);
                    if (!worker) totalUnknowns++;

                    rows[idx] = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: w.name,
                        manDay: w.manDay || 1,
                        teamId: worker?.teamId || '',
                        teamName: worker?.teamType === '지원팀' ? '지원' : (worker ? (teams.find(t => t.id === worker.teamId)?.name || '') : ''),
                        workerId: worker?.id || '',
                        unitPrice: worker?.unitPrice || 0,
                        role: w.role || worker?.role || '작업자',
                        description: w.workContent || '' // AI content or Empty
                    };
                });

                // Aggregate Work Content from workers to Site Level
                const aggregatedContent = Array.from(new Set(
                    report.workers.map(w => w.workContent).filter(Boolean)
                )).join(', ');

                newLedgers.push({
                    id: Date.now().toString() + Math.random(),
                    siteId,
                    rows: rows,
                    description: aggregatedContent // [MODIFIED] Set Site Level Content from AI
                });
            }

            if (newLedgers.length === 0) {
                Swal.fire('Info', '인식된 데이터가 없습니다.', 'info');
                return;
            }

            // Append new ledgers
            setLedgers(prev => {
                if (prev.length === 1 && !prev[0].siteId && prev[0].rows.every(r => !r.name)) {
                    return newLedgers;
                }
                return [...prev, ...newLedgers];
            });

            // Show result feedback
            let message = `${newLedgers.length}개의 장부가 생성되었습니다.`;
            if (totalUnknowns > 0) {
                message += `\n⚠️ 식별되지 않은 작업자 ${totalUnknowns}명이 있습니다. 빨간색으로 표시된 항목을 확인해주세요.`;
                Swal.fire({
                    title: 'AI 분석 완료 (확인 필요)',
                    text: message,
                    icon: 'warning',
                    confirmButtonText: '확인'
                });
            } else {
                Swal.fire('Success', message, 'success');
            }

        } catch (error) {
            console.error("AI Analysis Failed", error);
            Swal.fire('Error', '이미지 분석에 실패했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const hasWarnings = validationSummary.unknownWorkers > 0 || validationSummary.missingSites > 0;

    return (
        <div
            className="flex flex-col h-full bg-slate-50 overflow-hidden relative"
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

            {/* Warning Banner */}
            {hasWarnings && (
                <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 flex items-center justify-between shrink-0 animate-fade-in-down">
                    <div className="flex items-center gap-3 text-orange-800">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                        </div>
                        <div>
                            <p className="font-bold text-sm">확인이 필요한 항목이 있습니다</p>
                            <p className="text-xs text-orange-700">
                                {validationSummary.missingSites > 0 && <span>• 현장 미지정: <b>{validationSummary.missingSites}</b>건 </span>}
                                {validationSummary.unknownWorkers > 0 && <span>• 미등록 작업자: <b>{validationSummary.unknownWorkers}</b>명 </span>}
                                <span>(빨간색 표시를 확인해주세요)</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0 outline-none"
                        />
                    </div>
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                        {!hasWarnings ? (
                            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 font-bold flex items-center gap-1">
                                <FontAwesomeIcon icon={faCheckCircle} /> AI 분석 준비 완료
                            </span>
                        ) : (
                            <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 font-bold flex items-center gap-1">
                                <FontAwesomeIcon icon={faExclamationTriangle} /> 확인 필요
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 flex items-center gap-2 shadow-sm transition-colors font-bold"
                    >
                        <FontAwesomeIcon icon={faComment} /> 카톡 분석
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleKakaoUpload} />

                    <button
                        onClick={addLedger}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <FontAwesomeIcon icon={faPlus} /> 장부 추가
                    </button>
                    <button
                        onClick={removeLastLedger}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <FontAwesomeIcon icon={faMinus} /> 장부 삭제
                    </button>
                    <button
                        onClick={addRowsToAllLedgers}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <FontAwesomeIcon icon={faPlus} /> 행 10개 추가
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <FontAwesomeIcon icon={faSave} className={loading ? "animate-spin" : ""} />
                        {loading ? '저장 중...' : '전체 저장'}
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-wrap gap-4 items-start content-start">
                    {ledgers.map((ledger, index) => (
                        <DailyReportTable
                            key={ledger.id}
                            ledger={ledger}
                            ledgerIndex={index + 1}
                            sites={sites}
                            teams={teams}
                            workerMap={workerMap}
                            onUpdate={updateLedger}
                            onDelete={removeLedger}
                        />
                    ))}

                    {ledgers.length === 0 && (
                        <div className="w-full text-center py-20 text-slate-400 border-2 border-dashed border-slate-300 rounded-xl">
                            <p className="text-xl mb-4">작성된 장부가 없습니다.</p>
                            <button
                                onClick={addLedger}
                                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                            >
                                + 새 장부 추가하기
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-40 backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center">
                        <div className="animate-spin text-indigo-600 mb-3">
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" size="2x" />
                        </div>
                        <span className="font-bold text-slate-700">처리 중입니다...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyReportGridInput;
