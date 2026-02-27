import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faCalendarAlt, faTimes, faMinus, faComment, faExclamationTriangle, faCheckCircle, faSpinner, faClipboardCheck, faEraser, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
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
    unitPrice: number | null;
    payType: string; // 급여구분 (New)
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
    onAddRow: (ledgerId: string) => void; // Added prop
}> = ({ ledger, ledgerIndex, sites, teams, workerMap, onUpdate, onDelete, onAddRow }) => {

    const hotRef = useRef<any>(null);
    const isEditingNameCellRef = useRef(false);
    const duplicateInputNamesRef = useRef<Set<string>>(new Set());

    const buildDuplicateInputNames = useCallback((rows: GridRow[]): Set<string> => {
        const counts = new Map<string, number>();
        rows.forEach((row) => {
            const normalized = String(row.name ?? '').replace(/\s+/g, '').trim();
            if (!normalized) return;
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        });
        const duplicates = new Set<string>();
        counts.forEach((count, name) => {
            if (count > 1) duplicates.add(name);
        });
        return duplicates;
    }, []);

    const buildDuplicateInputNamesFromNames = useCallback((names: unknown[]): Set<string> => {
        const counts = new Map<string, number>();
        names.forEach((name) => {
            const normalized = String(name ?? '').replace(/\s+/g, '').trim();
            if (!normalized) return;
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        });
        const duplicates = new Set<string>();
        counts.forEach((count, name) => {
            if (count > 1) duplicates.add(name);
        });
        return duplicates;
    }, []);

    const syncDuplicateFromHot = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot) return;
        try {
            if (!hot.isDestroyed) {
                const colValues = hot.getDataAtCol(0) as unknown[];
                duplicateInputNamesRef.current = buildDuplicateInputNamesFromNames(colValues);
            }
        } catch {
        }
    }, [buildDuplicateInputNamesFromNames]);

    useEffect(() => {
        duplicateInputNamesRef.current = buildDuplicateInputNames(ledger.rows);
    }, [buildDuplicateInputNames, ledger.rows]);

    useLayoutEffect(() => {
        let cancelled = false;
        let boundHot: any = null;

        const handleAfterBeginEditing = (_row: number, col: number) => {
            isEditingNameCellRef.current = col === 0;
            if (col === 0) {
                syncDuplicateFromHot();
            }
            try {
                if (boundHot && !boundHot.isDestroyed) {
                    boundHot.render();
                }
            } catch {
            }
        };

        const handleAfterEndEditing = () => {
            syncDuplicateFromHot();
            try {
                if (boundHot && !boundHot.isDestroyed) {
                    boundHot.render();
                }
            } catch {
            }

            requestAnimationFrame(() => {
                isEditingNameCellRef.current = false;
                syncDuplicateFromHot();
                try {
                    if (boundHot && !boundHot.isDestroyed) {
                        boundHot.render();
                    }
                } catch {
                }
            });
        };

        const tryBindHooks = () => {
            if (cancelled) return;
            const hot = hotRef.current?.hotInstance;
            if (!hot) {
                requestAnimationFrame(tryBindHooks);
                return;
            }
            boundHot = hot;
            hot.addHook('afterBeginEditing', handleAfterBeginEditing);
            hot.addHook('afterEndEditing', handleAfterEndEditing);
        };

        tryBindHooks();

        return () => {
            cancelled = true;
            if (!boundHot) return;
            try {
                if (!boundHot.isDestroyed) {
                    boundHot.removeHook('afterBeginEditing', handleAfterBeginEditing);
                    boundHot.removeHook('afterEndEditing', handleAfterEndEditing);
                }
            } catch {
            }
        };
    }, []);

    // Convert rows to 2D array for Handsontable
    const tableData = useMemo(() => {
        // Order: [Name, ManDay, TeamName, UnitPrice, PayType]
        return ledger.rows.map(row => [row.name, row.manDay, row.teamName, row.unitPrice, row.payType]);
    }, [ledger.rows]);

    // Handle cell changes
    const handleAfterChange = useCallback((changes: any, source: string) => {
        if (!changes || source === 'loadData') return;

        // Deep copy to prevent mutation issues
        const newRows = ledger.rows.map(row => ({ ...row }));

        let didChangeName = false;

        changes.forEach(([row, col, oldValue, newValue]: [number, number, any, any]) => {
            if (row >= newRows.length) return;

            if (col === 0) { // Name column
                didChangeName = true;
                const rawName = newValue?.toString() || '';
                const searchName = rawName.replace(/\s+/g, ''); // Remove spaces for search
                newRows[row].name = rawName;

                if (searchName) {
                    const matchedWorker = workerMap.get(searchName);
                    console.log('[DEBUG] Searching worker:', searchName, 'Found:', matchedWorker);
                    if (matchedWorker) {
                        newRows[row].workerId = matchedWorker.id || '';
                        newRows[row].unitPrice = matchedWorker.unitPrice || 0;
                        newRows[row].payType = matchedWorker.payType || matchedWorker.salaryModel || '일급'; // Map PayType
                        newRows[row].role = matchedWorker.role || '작업자';

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
                        // User requested not to show 0/Ilgeup by default for unknown? 
                        // "단가 급여도 이름 써지면 나타나게 해줘" -> implied if known?
                        // If unknown, we probably shouldn't auto-fill "0" based on request "0 일급으로 나타나지 말고"
                        // But if they are ReadOnly, user can't see anything.
                        // Assuming unknown workers are allowed but manual entry is blocked? 
                        // No, if manual entry blocked, unknown workers are useless.
                        // But user said "automatically written so block selection".
                        // Logic: If Unknown, maybe leave empty or allow edit?
                        // For now, adhere to "Don't show 0/Ilgeup".
                        newRows[row].unitPrice = null;
                        newRows[row].payType = '';
                        newRows[row].role = '작업자';
                    }
                } else {
                    // Name is empty - clear all related fields
                    newRows[row].workerId = '';
                    newRows[row].unitPrice = null;
                    newRows[row].payType = '';
                    newRows[row].role = '작업자';
                    newRows[row].teamName = '';
                    newRows[row].teamId = '';
                    newRows[row].description = '';
                }
            } else if (col === 1) { // ManDay column
                newRows[row].manDay = Number(newValue) || 1;
            } else if (col === 3) { // UnitPrice column (Index 3)
                // ReadOnly but just in case
                newRows[row].unitPrice = Number(newValue) || 0;
            } else if (col === 4) { // PayType column (Index 4)
                newRows[row].payType = newValue?.toString() || '';
            }
            // col 2 is TeamName (ReadOnly), ignore logic
        });

        if (didChangeName) {
            syncDuplicateFromHot();
            try {
                const hot = hotRef.current?.hotInstance;
                if (hot && !hot.isDestroyed) {
                    hot.render();
                }
            } catch {
            }
        }

        onUpdate(ledger.id, { rows: newRows });
    }, [buildDuplicateInputNames, ledger.id, ledger.rows, onUpdate, teams, workerMap]);

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
            // No empty rows, append to end
            insertIndex = newRows.length;
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
                    payType: worker.payType || worker.salaryModel || '일급',
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

    // Calculate Total Man Day
    const totalManDay = ledger.rows.reduce((sum, r) => {
        // Only count rows with name
        if (!r.name || r.name.trim() === '') return sum;
        return sum + (Number(r.manDay) || 0);
    }, 0);

    return (
        <div className={`border rounded-lg overflow-hidden shadow-sm flex flex-col w-[415px] bg-white transition-all ${isSiteMissing ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'}`}>
            {/* Ledger Header - Compact */}
            <div className={`px-2 py-1 flex flex-col shrink-0 ${isSiteMissing ? 'bg-red-500' : 'bg-[#4A192C]'} text-white transition-colors`}>
                <div className="flex justify-between items-center w-full">
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
                        <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded font-bold" title="총 공수">
                            {totalManDay.toFixed(1)}공수
                        </span>
                        {unknownWorkersCount > 0 && (
                            <span className="bg-yellow-400 text-slate-900 text-[10px] px-1.5 rounded-full font-bold flex items-center gap-1" title="등록되지 않은 작업자 수">
                                <FontAwesomeIcon icon={faExclamationTriangle} /> {unknownWorkersCount}
                            </span>
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

                {/* Site Metadata Display Row */}
                {selectedSite && (
                    <div className="mt-1 pb-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/90 border-t border-white/20 pt-1">
                        {/* Client (발주사) */}
                        {selectedSite.clientCompanyName && selectedSite.clientCompanyName.trim() !== '' && (
                            <div className="flex items-center gap-1" title="발주사 (Client)">
                                <span>🏢</span>
                                <span className="opacity-70 text-[9px]">발주:</span>
                                <span className="font-medium">{selectedSite.clientCompanyName}</span>
                            </div>
                        )}
                        {/* Constructor (시공사) */}
                        {selectedSite.companyName && selectedSite.companyName.trim() !== '' && selectedSite.companyName !== selectedSite.partnerName && (
                            <div className="flex items-center gap-1" title="시공사 (Constructor)">
                                <span>🏗️</span>
                                <span className="opacity-70 text-[9px]">시공:</span>
                                <span className="font-medium">{selectedSite.companyName}</span>
                            </div>
                        )}
                        {/* Partner (협력사) */}
                        {selectedSite.partnerName && selectedSite.partnerName.trim() !== '' && (
                            <div className="flex items-center gap-1" title="협력사 (Partner)">
                                <span>🤝</span>
                                <span className="opacity-70 text-[9px]">협력:</span>
                                <span className="font-medium">{selectedSite.partnerName}</span>
                            </div>
                        )}
                        {/* Site Type (현장구분) */}
                        {selectedSite.siteType && selectedSite.siteType.trim() !== '' && (
                            <div className="flex items-center gap-1" title="현장구분 (Site Type)">
                                <span>🏷️</span>
                                <span className="opacity-70 text-[9px]">구분:</span>
                                <span className="font-medium">{selectedSite.siteType}</span>
                            </div>
                        )}
                        {/* Payment Method (결제부분) */}
                        {selectedSite.paymentMethod && selectedSite.paymentMethod.trim() !== '' && (
                            <div className="flex items-center gap-1" title="결제부분 (Payment Method)">
                                <span>💳</span>
                                <span className="opacity-70 text-[9px]">결제:</span>
                                <span className="font-medium">{selectedSite.paymentMethod}</span>
                            </div>
                        )}
                        {/* Responsible Team (시공팀 - Click to Add) */}
                        {selectedSite.responsibleTeamName && (
                            <button
                                onClick={() => {
                                    const team = siteTeams.find(t => t.id === selectedSite.responsibleTeamId);
                                    if (team) handleAddTeamMembers(team);
                                }}
                                disabled={!siteTeams.find(t => t.id === selectedSite.responsibleTeamId)}
                                className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                title="시공팀 (클릭하여 팀원 일괄 추가)"
                            >
                                <span>👷</span>
                                <span className="opacity-70 text-[9px]">팀:</span>
                                <span className="font-medium underline decoration-dotted">{selectedSite.responsibleTeamName}</span>
                            </button>
                        )}
                    </div>
                )}


            </div>

            {/* Handsontable Grid */}
            <div className="handsontable-container relative">
                <HotTable
                    ref={hotRef}
                    data={tableData}
                    colHeaders={['이름', '공수', '팀명', '단가', '급여']}
                    columns={[
                        { type: 'text', width: 80 }, // Name (0)
                        { type: 'numeric', width: 50 }, // ManDay (1)
                        { type: 'text', width: 80, readOnly: true, className: 'htDimmed' }, // TeamName (2)
                        { type: 'numeric', width: 80, numericFormat: { pattern: '0,0' }, readOnly: true, className: 'htDimmed' }, // UnitPrice (3)
                        { type: 'text', width: 60 }, // PayType (4)
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
                    // Prevent Selection on Team Column (Index 2 now)
                    beforeOnCellMouseDown={(event: MouseEvent, coords: any) => {
                        // Prevent click on Team(2), UnitPrice(3)
                        if (coords.col >= 2 && coords.col <= 3) {
                            event.stopImmediatePropagation();
                        }
                    }}
                    afterSelection={(r: number, c: number) => {
                        // Skip read-only columns (2, 3)
                        // If user creates a selection on col 1 (ManDay), and moves right?
                        // Or logic: if selection lands on 2,3,4 -> move to next row col 0?
                        if (c >= 2 && c <= 3) {
                            const hot = hotRef.current?.hotInstance;
                            if (hot) {
                                // Move to next row, first column
                                hot.selectCell(r + 1, 0);
                            }
                        }
                    }}
                    // IME-friendly settings
                    imeFastEdit={true}
                    // Dynamic Cell Styling
                    cells={(row, col, prop) => {
                        const cellProperties: any = {};
                        if (col === 0) {
                            const hot = hotRef.current?.hotInstance;
                            const rawName = hot ? hot.getDataAtCell(row, 0) : '';
                            const normalized = String(rawName ?? '').replace(/\s+/g, '').trim();
                            if (normalized) {
                                const matchedWorker = workerMap.get(normalized);
                                if (!matchedWorker) {
                                    cellProperties.className = 'unknown-worker-cell';
                                    cellProperties.title = "등록되지 않은 이름입니다. 확인해주세요.";
                                } else if (isEditingNameCellRef.current) {
                                    if (duplicateInputNamesRef.current.has(normalized)) {
                                        cellProperties.className = 'duplicate-worker-cell';
                                        cellProperties.title = "동일 이름이 2회 이상 입력되었습니다.";
                                    }
                                }
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
                        placeholder="이 현장의 금일 작업내용을 입력하세요"
                        className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                        onClick={() => onAddRow(ledger.id)}
                        className="px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                        title="행 추가"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        행 추가
                    </button>
                </div>
            </div>

            {/* <style> moved to main component for consistency */}
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
                console.log('[DEBUG] Master Data Loaded. Workers:', workersData.length, 'Teams:', teamsData.length);
                if (workersData.length > 0) console.log('[DEBUG] Sample Worker:', workersData[0]);

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

    // --- Auto-Save Logic (Moved to Top to fix hoisting) ---
    const stateRef = useRef({ ledgers, date });
    const [hasTempData, setHasTempData] = useState(false);

    useEffect(() => {
        stateRef.current = { ledgers, date };
    }, [ledgers, date]);

    const performSave = useCallback(() => {
        try {
            const current = stateRef.current;
            // Don't save if empty default state (1 empty ledger)
            const isInitialEmpty = current.ledgers.length === 0 || (current.ledgers.length === 1
                && !current.ledgers[0].siteId
                && current.ledgers[0].rows.every(r => !r.name || r.name.trim() === ''));

            if (isInitialEmpty) return;

            const tempData = {
                ledgers: current.ledgers,
                date: current.date,
                savedAt: Date.now()
            };
            localStorage.setItem('daily_report_temp_data', JSON.stringify(tempData));
            setHasTempData(true);
        } catch (e) {
            console.error("Temp save failed", e);
        }
    }, []);

    const loadTempData = useCallback(async () => {
        try {
            const tempDataStr = localStorage.getItem('daily_report_temp_data');
            if (!tempDataStr) return false;

            const tempData = JSON.parse(tempDataStr);

            // 24h Expiry
            if (Date.now() - tempData.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('daily_report_temp_data');
                return false;
            }

            // Auto-restore
            setLedgers(tempData.ledgers);
            if (tempData.date) setDate(tempData.date);
            setHasTempData(true);
            return true;
        } catch (e) {
            console.error("Failed to load temp data", e);
            localStorage.removeItem('daily_report_temp_data');
            return false;
        }
    }, []);

    const clearTempData = useCallback(() => {
        localStorage.removeItem('daily_report_temp_data');
        setHasTempData(false);
    }, []);

    // Auto-Save Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            performSave();
        }, 1000);
        return () => clearTimeout(timer);
    }, [ledgers, date, performSave]);

    // Save on Unmount/Refresh
    useEffect(() => {
        const handleBeforeUnload = () => {
            performSave();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            performSave();
        };
    }, [performSave]);

    // --- Fetch & Load Logic ---
    const fetchReportsForDate = useCallback(async (targetDate: string) => {
        try {
            setFetching(true);
            const reports = await dailyReportService.getReports(targetDate);

            if (reports.length === 0) {
                return null;
            }

            // Group by Site to create Ledgers
            // Note: In GridInput, we generally assume 1 Ledger = 1 Site
            // But reports are comprised of multiple documents (1 per team per site)
            // So we group by siteId.
            const siteGroups = new Map<string, DailyReport[]>();
            reports.forEach(r => {
                if (!r.siteId) return;
                const list = siteGroups.get(r.siteId) || [];
                list.push(r);
                siteGroups.set(r.siteId, list);
            });

            const newLedgers: Ledger[] = [];

            siteGroups.forEach((siteReports, siteId) => {
                const site = sites.find(s => s.id === siteId);

                // Aggregate Work Content (Report Level)
                const uniqueContent = Array.from(new Set(
                    siteReports.map(r => r.workContent).filter(Boolean)
                )).join(', ');

                // Aggregate Workers
                const aggregatedRows: GridRow[] = [];

                siteReports.forEach(report => {
                    const reportTeamId = report.teamId || '';
                    const reportTeamName = report.teamName || (teams.find(t => t.id === reportTeamId)?.name) || '';

                    report.workers.forEach(w => {
                        // Resolve Payload
                        // PayType / SalaryModel prioritization: 
                        // If saved in report, use it. If not, fallback to worker master.
                        // Try both properties for legacy compatibility
                        const wId = w.workerId || '';
                        const wName = w.name || (w as any).workerName || '';

                        const workerBase = workers.find(wk => wk.id === wId) || workers.find(wk => wk.name === wName);

                        // Resolve IDs/Names with Fallbacks
                        const finalWorkerName = wName || workerBase?.name || '';
                        const finalTeamId = w.teamId || (w as any).workerTeamId || workerBase?.teamId || reportTeamId;
                        const finalTeamName = (w as any).teamName || (teams.find(t => t.id === finalTeamId)?.name) || reportTeamName;

                        aggregatedRows.push({
                            id: Math.random().toString(36).substr(2, 9),
                            teamId: finalTeamId,
                            teamName: finalTeamName,
                            workerId: wId,
                            name: finalWorkerName,
                            manDay: (w as any).gongsu || w.manDay || 0,
                            unitPrice: w.unitPrice ?? 0,
                            payType: (w as any).payType || (w as any).salaryModel || '일급',
                            role: w.role || '작업자',
                            description: w.workContent || (w as any).workDescription || ''
                        });
                    });
                });

                // Pad rows to min 20
                const rows = [...aggregatedRows];
                const needed = 20 - rows.length;
                if (needed > 0) {
                    rows.push(...createEmptyRows(needed));
                } else {
                    // Always add a few buffer rows
                    rows.push(...createEmptyRows(5));
                }

                newLedgers.push({
                    id: Date.now().toString() + Math.random(),
                    siteId: siteId,
                    rows: rows,
                    description: uniqueContent
                });
            });

            return newLedgers;

        } catch (error) {
            console.error("Failed to fetch reports for date", error);
            return null;
        } finally {
            setFetching(false);
        }
    }, [sites, teams, workers]);

    // Initialize & Watch Date
    useEffect(() => {
        const run = async () => {
            // 1. Fetch Master Data first (if not ready)
            // (Assumes master data is relatively static or loaded via separate effect, 
            // but we need it for mapping. efficient check?)
            if (sites.length === 0 || teams.length === 0) {
                await fetchMasterData();
            }

            setFetching(true);

            // 2. Try Fetch Server Data
            const serverLedgers = await fetchReportsForDate(date);

            if (serverLedgers && serverLedgers.length > 0) {
                setLedgers(serverLedgers);
                // If server data exists, we ignore temp data to avoid confusion/overwriting valid DB data with old draft
                setHasTempData(false);
            } else {
                // 3. If No Server Data, Try Temp Data (only if date matches or just load draft?)
                // Usually draft is date-specific. 
                const loaded = await loadTempData();
                if (loaded) {
                    // Check if temp data date matches current selected date
                    const tempDataStr = localStorage.getItem('daily_report_temp_data');
                    if (tempDataStr) {
                        const parsed = JSON.parse(tempDataStr);
                        if (parsed.date !== date) {
                            // Date mismatch (User changed date), so we shouldn't show temp data from another day?
                            // Or we ask? For now, if date doesn't match, maybe just clear/ignore and show empty?
                            // Implementing behavior: specific date draft stays on specific date. 
                            // But `loadTempData` sets the Date state to saved date. 
                            // This creates a loop if we change date -> loadTempData changes date back.

                            // FIX: `loadTempData` should NOT force date change if we are navigating dates.
                            // But here we are reacting to `date` change.

                            // Let's allow `loadTempData` but only if it matches current `date`?
                            // OR: The requirement 'Refactor Daily Report Save' handled auto-load.
                            // Here: We want to load data for THIS date.

                            // If `loadTempData` logic pulls from a single slot 'daily_report_temp_data', 
                            // it represents the "Last Draft".

                            if (parsed.date === date) {
                                // Match! Keep it.
                            } else {
                                // Mismatch.
                                // If we just selected this date, and there is no server data, 
                                // and temp data is for another date, we should probably show Empty.
                                setLedgers([{
                                    id: Date.now().toString(),
                                    siteId: '',
                                    rows: createEmptyRows(20),
                                    description: ''
                                }]);
                                setHasTempData(false); // Don't show banner for mismatched date
                            }
                        }
                    }
                } else {
                    // No Server, No Temp -> Empty
                    setLedgers([{
                        id: Date.now().toString(),
                        siteId: '',
                        rows: createEmptyRows(20),
                        description: ''
                    }]);
                }
            }
            setFetching(false);
        };
        run();
    }, [date, fetchMasterData, fetchReportsForDate]); // Remove loadTempData from dependency to avoid loop

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
            unitPrice: null,
            payType: '', // Added
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

    const handleReset = useCallback(async () => {
        const result = await Swal.fire({
            title: '작성 내용 초기화',
            text: '현재 입력된 모든 내용을 삭제하고 새로 시작하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '초기화',
            cancelButtonText: '취소',
            confirmButtonColor: '#d33'
        });

        if (result.isConfirmed) {
            setLedgers([{
                id: Date.now().toString(),
                siteId: '',
                rows: createEmptyRows(20),
                description: ''
            }]);
        }
    }, []);

    const addRowToLedger = useCallback((id: string) => {
        setLedgers(prev => prev.map(ledger => {
            if (ledger.id !== id) return ledger;
            return {
                ...ledger,
                rows: [...ledger.rows, ...createEmptyRows(5)] // Add 5 rows at a time
            };
        }));
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
                        // 사용자가 직접 입력한 payType을 우선적으로 사용
                        salaryModel: r.payType || (() => {
                            const matchedWorker = workers.find(w => w.id === r.workerId);
                            if (matchedWorker?.teamType === '지원팀') return '지원팀';
                            if (matchedWorker?.teamType === '용역팀') return '용역팀';
                            return matchedWorker?.salaryModel || '일급제';
                        })(),
                        // payType도 사용자 입력 값을 그대로 사용
                        payType: r.payType || (() => {
                            const matchedWorker = workers.find(w => w.id === r.workerId);
                            return matchedWorker?.payType || matchedWorker?.salaryModel || '일급';
                        })(),
                        workerId: r.workerId || 'unknown',
                        name: r.name,
                        role: r.role,
                        status: 'attendance' as const,
                        manDay: r.manDay,
                        workContent: r.description, // User removed individual work content input, but logic remains if needed
                        teamId: r.teamId, // ✅ 작업자의 실제 소속팀 저장 (인력교류 추적용)
                        unitPrice: r.unitPrice ?? 0
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
                        responsibleTeamId: site?.responsibleTeamId || '',
                        responsibleTeamName: site?.responsibleTeamName || '',

                        // Site Metadata Saving (Corrected Mapping)
                        // DailyReport.companyId refers to CLIENT (발주사) based on services/dailyReportService.ts
                        companyId: site?.clientCompanyId || '',
                        companyName: site?.clientCompanyName || '',

                        // DailyReport.constructorCompanyId refers to CONSTRUCTOR (시공사)
                        constructorCompanyId: site?.companyId || '',
                        constructorCompanyName: site?.companyName || '',

                        // Partner (협력사)
                        partnerId: site?.partnerId || '',
                        partnerName: site?.partnerName != null ? String(site.partnerName) : '',

                        workContent: ledger.description || '' // Report Level Work Content
                    });
                });
            }

            // Clear Temp Data on Success
            clearTempData();

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
            const e = error as any;
            const code = typeof e?.code === 'string' ? e.code : '';
            const message = typeof e?.message === 'string' ? e.message : '';
            alert(`저장 중 오류가 발생했습니다.${code ? `\n${code}` : ''}${message ? `\n${message}` : ''}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTempSave = () => {
        try {
            localStorage.setItem('daily_report_temp_data', JSON.stringify(ledgers));
            localStorage.setItem('daily_report_temp_date', date);

            // Add visual feedback
            const toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
            toast.fire({
                icon: 'success',
                title: '임시 저장되었습니다.'
            });

        } catch (e) {
            console.error("Temp save failed", e);
            Swal.fire('Error', '임시 저장에 실패했습니다. (저장 공간 부족 등)', 'error');
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
            Swal.fire('Info', 'API 키 설정이 필요합니다. (/settings/ai)', 'info');
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
                        payType: worker?.payType || worker?.salaryModel || '일급',
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
                        onClick={handleReset}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-colors"
                        title="모든 장부를 삭제하고 빈 장부 1개로 초기화합니다"
                    >
                        <FontAwesomeIcon icon={faEraser} /> 초기화
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

            {/* Temp Data Banner */}
            {hasTempData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 mx-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faFloppyDisk} className="text-blue-600" />
                        <span className="text-blue-800 font-medium text-sm">
                            임시 저장된 데이터를 불러왔습니다.
                            (저장 시각: {new Date(JSON.parse(localStorage.getItem('daily_report_temp_data') || '{}').savedAt || Date.now()).toLocaleString()})
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            clearTempData();
                            handleReset();
                        }}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                        임시데이터 삭제
                    </button>
                </div>
            )}

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
                            onAddRow={addRowToLedger}
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

            {/* Styles for Grid */}
            <style>{`
                .handsontable-container .handsontable {
                    font-size: 12px;
                }
                .handsontable-container .handsontable th {
                    background-color: #4A192C; /* Default Header */
                    color: white !important;
                    font-weight: bold !important;
                    font-size: 11px;
                }
                
                /* Default Styles */
                .handsontable-container .handsontable td:nth-child(1) { /* Name */
                    background-color: #E0F7FA;
                }
                .handsontable-container .handsontable td:nth-child(2) { /* ManDay */
                    background-color: #FCE4EC;
                    text-align: center;
                }
                .handsontable-container .handsontable td:nth-child(3) { /* Team Column */
                    background-color: #F5F5F5;
                    color: #64748b;
                    font-size: 11px;
                }

                /* Warning Styles */
                .handsontable-container .handsontable td.unknown-worker-cell {
                    background-color: #fca5a5 !important;
                    color: #7f1d1d !important;
                    font-weight: bold;
                    border: 1px solid #ef4444 !important;
                }
                .handsontable-container .handsontable td.duplicate-worker-cell {
                    background-color: #fef08a !important; 
                    color: #854d0e !important;
                    font-weight: bold;
                    border: 1px solid #eab308 !important;
                }
            `}</style>

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
