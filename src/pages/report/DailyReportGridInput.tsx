import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faCalendarAlt, faTimes, faMinus, faComment, faExclamationTriangle, faSpinner, faEraser, faFloppyDisk, faUpload, faImage, faTrash } from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';
import SingleSelectPopover from '../../components/common/SingleSelectPopover';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { dispatchService, DispatchAssignment } from '../../services/dispatchService';

import { AnalyzedDailyReport, geminiService, KakaoAnalyzeContext } from '../../services/geminiService';
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
    workerTeamId?: string; // Original Team ID of the worker
    workerTeamName?: string; // Original Team Name of the worker
}

interface Ledger {
    id: string;
    siteId: string;
    rows: GridRow[];
    description: string; // Ledger-level Work Content
}

const normalizeSalaryType = (value?: string | null): string => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    if (normalized === '일급') return '일급제';
    if (normalized === '월급') return '월급제';
    return normalized;
};

const resolveWorkerSalaryType = (worker?: Partial<Worker> | null): string => {
    if (!worker) return '일급제';

    const teamType = normalizeSalaryType(worker.teamType);
    if (teamType === '지원팀') return '지원팀';
    if (teamType === '용역팀') return '용역팀';

    const salaryModel = normalizeSalaryType(worker.salaryModel);
    if (salaryModel) return salaryModel;

    const payType = normalizeSalaryType(worker.payType);
    if (payType) return payType;

    return '일급제';
};

const resolveReportWorkerSalaryType = (
    reportWorker?: { payType?: string | null; salaryModel?: string | null } | null,
    worker?: Partial<Worker> | null
): string => {
    const payType = normalizeSalaryType(reportWorker?.payType);
    if (payType) return payType;

    const salaryModel = normalizeSalaryType(reportWorker?.salaryModel);
    if (salaryModel) return salaryModel;

    return resolveWorkerSalaryType(worker);
};

// --- Child Component: DailyReportTable ---
const DailyReportTable: React.FC<{
    ledger: Ledger;
    ledgerIndex: number;
    sites: Site[];
    teams: Team[];
    workerMap: Map<string, Worker & { isDuplicateName?: boolean }>;
    globalDuplicateNames: Set<string>;
    onUpdate: (ledgerId: string, updates: Partial<Ledger>) => void;
    onDelete: (ledgerId: string) => void;
    onAddRow: (ledgerId: string) => void; 
}> = ({ ledger, ledgerIndex, sites, teams, workerMap, globalDuplicateNames, onUpdate, onDelete, onAddRow }) => {

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
        return ledger.rows.map(row => [row.name, row.manDay, row.teamName, row.unitPrice, row.payType]);
    }, [ledger.rows]);

    const handleAfterChange = useCallback((changes: any, source: string) => {
        if (!changes || source === 'loadData') return;

        const newRows = ledger.rows.map(row => ({ ...row }));
        let didChangeName = false;

        changes.forEach(([row, col, oldValue, newValue]: [number, number, any, any]) => {
            if (row >= newRows.length) return;

            if (col === 0) { // Name column
                didChangeName = true;
                const rawName = newValue?.toString() || '';
                const searchName = rawName.replace(/\s+/g, ''); 
                newRows[row].name = rawName;

                if (searchName) {
                    const matchedWorker = workerMap.get(searchName);
                    if (matchedWorker) {
                        newRows[row].workerId = matchedWorker.id || '';
                        newRows[row].unitPrice = matchedWorker.unitPrice || 0;
                        newRows[row].payType = resolveWorkerSalaryType(matchedWorker);
                        newRows[row].role = matchedWorker.role || '작업자';

                        const team = matchedWorker.teamId ? teams.find(t => t.id === matchedWorker.teamId) : undefined;
                        if (team) {
                            newRows[row].teamName = team.name;
                            newRows[row].teamId = team.id || '';
                            newRows[row].workerTeamName = team.name;
                            newRows[row].workerTeamId = team.id || '';
                        } else {
                            const masterTeamName = matchedWorker.teamName || (matchedWorker as any).workerTeamName || '';
                            const masterTeamId = matchedWorker.teamId || (matchedWorker as any).workerTeamId || '';
                            newRows[row].teamName = masterTeamName;
                            newRows[row].teamId = masterTeamId;
                            newRows[row].workerTeamName = masterTeamName;
                            newRows[row].workerTeamId = masterTeamId;
                        }
                    } else {
                        newRows[row].workerId = '';
                        newRows[row].unitPrice = null;
                        newRows[row].payType = '';
                        newRows[row].role = '작업자';
                    }
                } else {
                    newRows[row].workerId = '';
                    newRows[row].unitPrice = null;
                    newRows[row].payType = '';
                    newRows[row].role = '작업자';
                    newRows[row].teamName = '';
                    newRows[row].teamId = '';
                    newRows[row].description = '';
                }
            } else if (col === 1) { 
                newRows[row].manDay = Number(newValue) || 1;
            } else if (col === 3) { 
                newRows[row].unitPrice = Number(newValue) || 0;
            } else if (col === 4) { 
                newRows[row].payType = newValue?.toString() || '';
            }
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
    }, [syncDuplicateFromHot, ledger.id, ledger.rows, onUpdate, teams, workerMap]);

    const normalizedLedgerSiteId = String(ledger.siteId ?? '').trim();
    const siteOptions = useMemo(
        () =>
            sites
                .map((site) => ({
                    id: String(site.id ?? '').trim(),
                    name: String(site.name ?? '').trim()
                }))
                .filter((site) => Boolean(site.id) && Boolean(site.name)),
        [sites]
    );
    const selectedSite = sites.find((s) => String(s.id ?? '').trim() === normalizedLedgerSiteId);

    const siteTeams = useMemo(() => {
        if (!normalizedLedgerSiteId) return [];
        const site = sites.find((s) => String(s.id ?? '').trim() === normalizedLedgerSiteId);
        if (!site || !site.responsibleTeamId) return [];
        return teams.filter(t => t.id === site.responsibleTeamId);
    }, [normalizedLedgerSiteId, sites, teams]);

    const handleAddTeamMembers = (team: Team) => {
        const teamWorkers = Array.from(workerMap.values()).filter(w => w.teamId === team.id);
        if (teamWorkers.length === 0) {
            Swal.fire('Info', '해당 팀에 등록된 작업자가 없거나 모두 퇴사 상태입니다.', 'info');
            return;
        }
        const newRows = [...ledger.rows];
        let insertIndex = newRows.findIndex(r => !r.name || r.name.trim() === '');
        if (insertIndex === -1) insertIndex = newRows.length;

        let filledCount = 0;
        teamWorkers.forEach(worker => {
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
                    payType: resolveWorkerSalaryType(worker),
                    role: worker.role || '작업자',
                    description: '',
                    workerTeamId: team.id || '',
                    workerTeamName: team.name
                };
                filledCount++;
            }
        });
        if (filledCount < teamWorkers.length) {
            Swal.fire('Warning', `빈 행이 부족하여 ${teamWorkers.length - filledCount}명을 추가하지 못했습니다. 행을 추가해주세요.`, 'warning');
        }
        onUpdate(ledger.id, { rows: newRows });
    };

    const isSiteMissing = !ledger.siteId;
    const unknownWorkersCount = ledger.rows.filter(r => r.name.trim() !== '' && !r.workerId).length;
    const totalManDay = ledger.rows.reduce((sum, r) => {
        if (!r.name || r.name.trim() === '') return sum;
        return sum + (Number(r.manDay) || 0);
    }, 0);

    return (
        <div className={`border rounded-lg overflow-hidden shadow-sm flex flex-col w-[415px] bg-white transition-all ${isSiteMissing ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'}`}>
            <div className={`px-2 py-1 flex flex-col shrink-0 ${isSiteMissing ? 'bg-red-500' : 'bg-[#4A192C]'} text-white transition-colors`}>
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="font-bold text-xs whitespace-nowrap">장부{ledgerIndex}</span>
                        <div style={{ minWidth: 180, flex: 1 }}>
                            <SingleSelectPopover
                                options={siteOptions}
                                selectedId={normalizedLedgerSiteId || null}
                                onSelect={(siteId) => onUpdate(ledger.id, { siteId: String(siteId ?? '').trim() })}
                                renderSelected={(selectedOption) => (
                                    <span className="text-slate-800 font-medium">{selectedOption.name}</span>
                                )}
                                placeholder="현장명을 검색/선택하세요"
                            />
                        </div>
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
                        <button onClick={() => onDelete(ledger.id)} className="ml-1 text-white/70 hover:text-white" title="장부 삭제">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                </div>

                {selectedSite && (
                    <div className="mt-1 pb-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/90 border-t border-white/20 pt-1">
                        {selectedSite.clientCompanyName && selectedSite.clientCompanyName.trim() !== '' && (
                            <div className="flex items-center gap-1" title="발주사">
                                <span>🏢</span>
                                <span className="opacity-70 text-[9px]">발주:</span>
                                <span className="font-medium">{selectedSite.clientCompanyName}</span>
                            </div>
                        )}
                        {selectedSite.companyName && selectedSite.companyName.trim() !== '' && selectedSite.companyName !== selectedSite.partnerName && (
                            <div className="flex items-center gap-1" title="시공사">
                                <span>🏗️</span>
                                <span className="opacity-70 text-[9px]">시공:</span>
                                <span className="font-medium">{selectedSite.companyName}</span>
                            </div>
                        )}
                        {selectedSite.partnerName && selectedSite.partnerName.trim() !== '' && (
                            <div className="flex items-center gap-1" title="협력사">
                                <span>🤝</span>
                                <span className="opacity-70 text-[9px]">협력:</span>
                                <span className="font-medium">{selectedSite.partnerName}</span>
                            </div>
                        )}
                        {selectedSite.responsibleTeamName && (
                            <button
                                onClick={() => {
                                    const team = siteTeams.find(t => t.id === selectedSite.responsibleTeamId);
                                    if (team) handleAddTeamMembers(team);
                                }}
                                disabled={!siteTeams.find(t => t.id === selectedSite.responsibleTeamId)}
                                className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                title="현장담당팀 (클릭하여 팀원 일괄 추가)"
                            >
                                <span>👷</span>
                                <span className="opacity-70 text-[9px]">현장담당팀:</span>
                                <span className="font-medium underline decoration-dotted">{selectedSite.responsibleTeamName}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="handsontable-container relative">
                <HotTable
                    ref={hotRef}
                    data={tableData}
                    colHeaders={['이름', '공수', '소속팀', '단가', '급여']}
                    columns={[
                        { type: 'text', width: 80 }, 
                        { type: 'numeric', width: 50 }, 
                        { type: 'text', width: 80, readOnly: true, className: 'htDimmed' }, 
                        { type: 'numeric', width: 80, numericFormat: { pattern: '0,0' }, readOnly: true, className: 'htDimmed' }, 
                        { type: 'text', width: 60 }, 
                    ]}
                    rowHeaders={false}
                    width="100%"
                    height="auto"
                    stretchH="all"
                    autoWrapRow={true}
                    autoWrapCol={true}
                    licenseKey="non-commercial-and-evaluation"
                    enterBeginsEditing={true}
                    enterMoves={{ row: 1, col: 0 }}
                    tabMoves={{ row: 0, col: 1 }}
                    fillHandle={true}
                    afterChange={handleAfterChange}
                    beforeOnCellMouseDown={(event: MouseEvent, coords: any) => {
                        if (coords.col >= 2 && coords.col <= 3) event.stopImmediatePropagation();
                    }}
                    afterSelection={(r: number, c: number) => {
                        if (c >= 2 && c <= 3) {
                            const hot = hotRef.current?.hotInstance;
                            if (hot) hot.selectCell(r + 1, 0);
                        }
                    }}
                    imeFastEdit={true}
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
                                    cellProperties.title = "등록되지 않았거나 퇴사한 작업자입니다. 확인해주세요.";
                                } else if (matchedWorker.isDuplicateName) {
                                    cellProperties.className = 'duplicate-worker-cell';
                                    cellProperties.title = `동명이인이 존재합니다 (${matchedWorker.teamName}). 정확한 인원인지 확인해주세요.`;
                                } else if (globalDuplicateNames.has(normalized)) {
                                    cellProperties.className = 'duplicate-worker-cell';
                                    cellProperties.title = "당일 다른 장부(현장)에 동일 이름이 이미 입력되었습니다.";
                                } else if (isEditingNameCellRef.current) {
                                    if (duplicateInputNamesRef.current.has(normalized)) {
                                        cellProperties.className = 'duplicate-worker-cell';
                                        cellProperties.title = "이 장부 내에 동일 이름이 2회 이상 입력되었습니다.";
                                    }
                                }
                            }
                        }
                        return cellProperties;
                    }}
                />
            </div>

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

    useEffect(() => {
        const unsubscribe = manpowerService.subscribeWorkers((newWorkers) => {
            setWorkers(newWorkers);
        });
        return () => unsubscribe();
    }, []);

    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [weather, setWeather] = useState('맑음');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [isKakaoModalOpen, setIsKakaoModalOpen] = useState(false);
    const [isKakaoFileDragging, setIsKakaoFileDragging] = useState(false);
    const [kakaoText, setKakaoText] = useState('');
    const [kakaoFile, setKakaoFile] = useState<File | null>(null);
    const kakaoFileInputRef = useRef<HTMLInputElement>(null);

    const normalizeSiteId = useCallback((value: unknown): string => String(value ?? '').trim(), []);

    const buildWorkerSearchMap = useCallback((workerList: Worker[]) => {
        const map = new Map<string, Worker & { isDuplicateName?: boolean }>();
        const activeWorkers = workerList.filter(w => w.status !== '퇴사' && w.status !== '퇴사자');
        const nameCounts = new Map<string, number>();
        activeWorkers.forEach(w => {
            const key = w.name.replace(/\s+/g, '');
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        });
        activeWorkers.forEach(w => {
            const key = w.name.replace(/\s+/g, '');
            const isDuplicate = nameCounts.get(key)! > 1;
            map.set(key, { ...w, isDuplicateName: isDuplicate });
        });
        return map;
    }, []);

    const workerMap = useMemo(() => buildWorkerSearchMap(workers), [workers, buildWorkerSearchMap]);

    const globalDuplicateNames = useMemo(() => {
        const counts = new Map<string, number>();
        ledgers.forEach(ledger => {
            ledger.rows.forEach(row => {
                const normalized = String(row.name ?? '').replace(/\s+/g, '').trim();
                if (!normalized) return;
                counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
            });
        });
        const duplicates = new Set<string>();
        counts.forEach((count, name) => {
            if (count > 1) duplicates.add(name);
        });
        return duplicates;
    }, [ledgers]);

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
                    manpowerService.getWorkers(true)
                ]);
                setSites(sitesData);
                setTeams(teamsData);
                setWorkers(workersData);

                if (options?.rematchLedgers) {
                    const workerByName = buildWorkerSearchMap(workersData);
                    const teamById = new Map<string, Team>();
                    teamsData.forEach(t => { if (t.id) teamById.set(t.id, t); });

                    setLedgers(prev =>
                        prev.map(ledger => ({
                            ...ledger,
                            rows: ledger.rows.map(row => {
                                if (row.name.trim().length === 0 || row.workerId.trim().length > 0) return row;
                                const key = row.name.replace(/\s+/g, '');
                                const matchedWorker = workerByName.get(key);
                                if (!matchedWorker) return row;
                                const matchedTeam = matchedWorker.teamId ? teamById.get(matchedWorker.teamId) : undefined;
                                return {
                                    ...row,
                                    workerId: matchedWorker.id ?? '',
                                    unitPrice: matchedWorker.unitPrice ?? 0,
                                    payType: row.payType || resolveWorkerSalaryType(matchedWorker),
                                    role: matchedWorker.role || '작업자',
                                    teamId: matchedTeam?.id ?? matchedWorker.teamId ?? (matchedWorker as any).workerTeamId ?? '',
                                    teamName: matchedTeam?.name ?? matchedWorker.teamName ?? (matchedWorker as any).workerTeamName ?? '',
                                    workerTeamId: matchedTeam?.id ?? matchedWorker.teamId ?? (matchedWorker as any).workerTeamId ?? '',
                                    workerTeamName: matchedTeam?.name ?? matchedWorker.teamName ?? (matchedWorker as any).workerTeamName ?? ''
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
        [buildWorkerSearchMap]
    );

    const stateRef = useRef({ ledgers, date });
    const [hasTempData, setHasTempData] = useState(false);

    useEffect(() => {
        stateRef.current = { ledgers, date };
    }, [ledgers, date]);

    const performSave = useCallback(() => {
        try {
            const current = stateRef.current;
            const isInitialEmpty = current.ledgers.length === 0 || (current.ledgers.length === 1 && !current.ledgers[0].siteId && current.ledgers[0].rows.every(r => !r.name || r.name.trim() === ''));
            if (isInitialEmpty) return;
            const tempData = { ledgers: current.ledgers, date: current.date, savedAt: Date.now() };
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
            if (Date.now() - tempData.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('daily_report_temp_data');
                return false;
            }
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

    useEffect(() => {
        const timer = setTimeout(() => { performSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [ledgers, date, performSave]);

    useEffect(() => {
        const handleBeforeUnload = () => { performSave(); };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            performSave();
        };
    }, [performSave]);

    const fetchReportsForDate = useCallback(async (targetDate: string) => {
        try {
            setFetching(true);
            const reports = await dailyReportService.getReports(targetDate);
            if (reports.length === 0) return null;

            const siteGroups = new Map<string, DailyReport[]>();
            reports.forEach(r => {
                const siteIdKey = normalizeSiteId(r.siteId);
                if (!siteIdKey) return;
                const list = siteGroups.get(siteIdKey) || [];
                list.push(r);
                siteGroups.set(siteIdKey, list);
            });

            const newLedgers: Ledger[] = [];
            siteGroups.forEach((siteReports, siteId) => {
                const uniqueContent = Array.from(new Set(siteReports.map(r => r.workContent).filter(Boolean))).join(', ');
                const aggregatedRows: GridRow[] = [];
                siteReports.forEach(report => {
                    const reportTeamId = report.teamId || '';
                    const reportTeamName = report.teamName || (teams.find(t => t.id === reportTeamId)?.name) || '';
                    report.workers.forEach(w => {
                        const wId = w.workerId || '';
                        const wName = w.name || (w as any).workerName || '';
                        const workerBase = workers.find(wk => wk.id === wId) || workers.find(wk => wk.name === wName);
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
                            payType: resolveReportWorkerSalaryType(w as any, workerBase),
                            role: w.role || '작업자',
                            description: w.workContent || (w as any).workDescription || '',
                            workerTeamId: finalTeamId,
                            workerTeamName: finalTeamName
                        });
                    });
                });
                const rows = [...aggregatedRows];
                const needed = 20 - rows.length;
                if (needed > 0) rows.push(...createEmptyRows(needed));
                else rows.push(...createEmptyRows(5));

                newLedgers.push({ id: Date.now().toString() + Math.random(), siteId, rows: rows, description: uniqueContent });
            });
            return newLedgers;
        } catch (error) {
            console.error("Failed to fetch reports for date", error);
            return null;
        } finally {
            setFetching(false);
        }
    }, [normalizeSiteId, sites, teams, workers]);

    useEffect(() => {
        const run = async () => {
            if (sites.length === 0 || teams.length === 0) await fetchMasterData();
            setFetching(true);
            const serverLedgers = await fetchReportsForDate(date);
            if (serverLedgers && serverLedgers.length > 0) {
                setLedgers(serverLedgers);
                setHasTempData(false);
            } else {
                const loaded = await loadTempData();
                if (!loaded) {
                    setLedgers([{ id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }]);
                } else {
                    const tempDataStr = localStorage.getItem('daily_report_temp_data');
                    if (tempDataStr) {
                        const parsed = JSON.parse(tempDataStr);
                        if (parsed.date !== date) {
                            setLedgers([{ id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }]);
                            setHasTempData(false);
                        }
                    }
                }
            }
            setFetching(false);
        };
        run();
    }, [date, fetchMasterData, fetchReportsForDate]);

    useEffect(() => {
        const onMasterDataChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ workers?: boolean; teams?: boolean; sites?: boolean; }>;
            if (customEvent.detail?.workers || customEvent.detail?.teams || customEvent.detail?.sites) {
                fetchMasterData({ rematchLedgers: true }).catch(err => console.error(err));
            }
        };
        window.addEventListener('smart-construction:master-data-changed', onMasterDataChanged);
        return () => window.removeEventListener('smart-construction:master-data-changed', onMasterDataChanged);
    }, [fetchMasterData]);

    const createEmptyRows = (count: number): GridRow[] => {
        return Array(count).fill(null).map(() => ({
            id: Math.random().toString(36).substr(2, 9),
            teamId: '', teamName: '', workerId: '', name: '', manDay: 1.0, unitPrice: null, payType: '', role: '작업자', description: '', workerTeamId: '', workerTeamName: ''
        }));
    };

    const normalizeLookupText = useCallback((value?: string | null): string => {
        return String(value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const buildKakaoAnalyzeContext = useCallback((): KakaoAnalyzeContext => ({
        today: date,
        sites: sites.map(s => s.name).filter(Boolean),
        teams: teams.map(t => t.name).filter(Boolean),
        workers: workers.map(w => w.name).filter(Boolean)
    }), [date, sites, teams, workers]);

    const findSiteByAnalyzedName = useCallback((siteName?: string | null): Site | undefined => {
        const normalized = normalizeLookupText(siteName);
        if (!normalized) return undefined;
        return sites.find(s => normalizeLookupText(s.name) === normalized)
            || sites.find(s => {
                const candidate = normalizeLookupText(s.name);
                return Boolean(candidate) && (candidate.includes(normalized) || normalized.includes(candidate));
            });
    }, [normalizeLookupText, sites]);

    const findWorkerByAnalyzedName = useCallback((workerName?: string | null): (Worker & { isDuplicateName?: boolean }) | undefined => {
        const normalized = normalizeLookupText(workerName);
        if (!normalized) return undefined;
        return workerMap.get(normalized) || workers.find(w => normalizeLookupText(w.name) === normalized);
    }, [normalizeLookupText, workerMap, workers]);

    const getScheduleWorkerIds = useCallback((assignment: DispatchAssignment): string[] => {
        const directWorkerIds = Array.isArray(assignment.workerIds) ? assignment.workerIds : [];
        const supportTeams = Array.isArray(assignment.supportTeams) ? assignment.supportTeams : [];
        const supportTeamIds = new Set(
            [
                ...(Array.isArray(assignment.supportTeamIds) ? assignment.supportTeamIds : []),
                ...supportTeams.map(team => team.id)
            ]
                .map(normalizeSiteId)
                .filter(Boolean)
        );
        const supportTeamNames = new Set(
            supportTeams
                .map(team => normalizeLookupText(team.name))
                .filter(Boolean)
        );

        const supportWorkerIds = workers
            .filter(worker => {
                const workerId = normalizeSiteId(worker.id);
                if (!workerId) return false;
                if (worker.isActive === false) return false;
                const status = String(worker.status ?? '');
                if (status === '퇴사' || status === '퇴사자' || status === 'inactive' || status === '출입금지') return false;
                const workerTeamId = normalizeSiteId(worker.teamId);
                const workerTeamName = normalizeLookupText(worker.teamName);
                return Boolean(
                    (workerTeamId && supportTeamIds.has(workerTeamId)) ||
                    (workerTeamName && supportTeamNames.has(workerTeamName))
                );
            })
            .map(worker => normalizeSiteId(worker.id));

        return Array.from(new Set([...directWorkerIds, ...supportWorkerIds].map(normalizeSiteId).filter(Boolean)));
    }, [normalizeLookupText, normalizeSiteId, workers]);

    const appendAnalyzedReports = useCallback((analyzedReports: AnalyzedDailyReport[]) => {
        const newLedgers: Ledger[] = [];
        let totalUnknowns = 0;

        for (const report of analyzedReports) {
            const reportWorkers = Array.isArray(report.workers)
                ? report.workers.filter(w => normalizeLookupText(w?.name))
                : [];
            if (reportWorkers.length === 0) continue;

            const site = findSiteByAnalyzedName(report.siteName);
            const siteId = site?.id || '';
            const rows = createEmptyRows(Math.max(20, reportWorkers.length + 5));

            for (const [idx, analyzedWorker] of reportWorkers.entries()) {
                const worker = findWorkerByAnalyzedName(analyzedWorker.name);
                if (!worker) totalUnknowns++;

                const matchedTeam = worker?.teamId ? teams.find(t => t.id === worker.teamId) : undefined;
                const isSupportTeam = worker?.teamType === '지원팀';
                const analyzedManDay = Number(analyzedWorker.manDay);
                const manDay = Number.isFinite(analyzedManDay) && analyzedManDay > 0 ? analyzedManDay : 1;
                const workerWorkContent = analyzedWorker.workContent || report.workContent || '';
                const workerTeamName = isSupportTeam
                    ? '지원'
                    : (matchedTeam?.name || worker?.teamName || analyzedWorker.teamName || report.teamName || '');

                rows[idx] = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: analyzedWorker.name,
                    manDay,
                    teamId: worker?.teamId || '',
                    teamName: workerTeamName,
                    workerId: worker?.id || '',
                    unitPrice: worker?.unitPrice || 0,
                    payType: resolveWorkerSalaryType(worker),
                    role: analyzedWorker.role || worker?.role || '작업자',
                    description: workerWorkContent,
                    workerTeamId: worker?.teamId || '',
                    workerTeamName
                };
            }

            const aggregatedContent = report.workContent
                || Array.from(new Set(reportWorkers.map(w => w.workContent).filter(Boolean))).join(', ');
            newLedgers.push({ id: Date.now().toString() + Math.random(), siteId, rows, description: aggregatedContent });
        }

        if (newLedgers.length > 0) {
            setLedgers(prev => {
                if (prev.length === 1 && !prev[0].siteId && prev[0].rows.every(r => !r.name)) return newLedgers;
                return [...prev, ...newLedgers];
            });
        }

        return { ledgerCount: newLedgers.length, totalUnknowns };
    }, [findSiteByAnalyzedName, findWorkerByAnalyzedName, normalizeLookupText, teams]);

    const appendScheduleAssignments = useCallback((assignments: DispatchAssignment[]) => {
        const siteById = new Map<string, Site>();
        sites.forEach(site => {
            const siteId = normalizeSiteId(site.id);
            const legacyId = normalizeSiteId(site.legacyId);
            if (siteId) siteById.set(siteId, site);
            if (legacyId) siteById.set(legacyId, site);
        });

        const workerById = new Map<string, Worker>();
        workers.forEach(worker => {
            const workerId = normalizeSiteId(worker.id);
            const legacyId = normalizeSiteId(worker.legacyId);
            if (workerId) workerById.set(workerId, worker);
            if (legacyId) workerById.set(legacyId, worker);
        });

        const teamById = new Map<string, Team>();
        teams.forEach(team => {
            const teamId = normalizeSiteId(team.id);
            const legacyId = normalizeSiteId(team.legacyId);
            if (teamId) teamById.set(teamId, team);
            if (legacyId) teamById.set(legacyId, team);
        });

        const scheduleGroups = new Map<string, {
            siteId: string;
            siteName: string;
            descriptionParts: string[];
            rows: GridRow[];
            workerKeys: Set<string>;
        }>();

        let totalUnknowns = 0;
        let totalWorkers = 0;
        let skippedSiteCount = 0;
        let emptyScheduleCount = 0;
        let duplicateWorkerCount = 0;

        assignments.forEach((assignment) => {
            const siteId = normalizeSiteId(assignment.siteId);
            const matchedSite = (siteId ? siteById.get(siteId) : undefined) || findSiteByAnalyzedName(assignment.siteName);
            const resolvedSiteId = normalizeSiteId(matchedSite?.id) || siteId;
            const resolvedSiteName = matchedSite?.name || assignment.siteName || '';
            const siteKey = resolvedSiteId || normalizeLookupText(resolvedSiteName);

            if (!siteKey) {
                skippedSiteCount += 1;
                return;
            }

            if (!scheduleGroups.has(siteKey)) {
                scheduleGroups.set(siteKey, {
                    siteId: resolvedSiteId,
                    siteName: resolvedSiteName,
                    descriptionParts: [],
                    rows: [],
                    workerKeys: new Set<string>()
                });
            }

            const group = scheduleGroups.get(siteKey)!;
            const note = String(assignment.note || '').trim();
            if (note && !group.descriptionParts.includes(note)) {
                group.descriptionParts.push(note);
            }

            const workerIds = getScheduleWorkerIds(assignment);
            if (workerIds.length === 0) {
                emptyScheduleCount += 1;
                return;
            }

            workerIds.forEach((workerId) => {
                const worker = workerById.get(workerId);
                const workerKey = worker?.id ? `worker:${worker.id}` : `unknown:${workerId}`;
                if (group.workerKeys.has(workerKey)) {
                    duplicateWorkerCount += 1;
                    return;
                }
                group.workerKeys.add(workerKey);

                if (!worker) totalUnknowns += 1;

                const workerTeamId = normalizeSiteId(worker?.teamId);
                const assignmentTeamId = normalizeSiteId(assignment.teamId);
                const resolvedTeamId = workerTeamId || assignmentTeamId;
                const matchedTeam = resolvedTeamId ? teamById.get(resolvedTeamId) : undefined;
                const resolvedTeamName = matchedTeam?.name || worker?.teamName || assignment.teamName || '';

                group.rows.push({
                    id: Math.random().toString(36).substr(2, 9),
                    teamId: resolvedTeamId,
                    teamName: resolvedTeamName,
                    workerId: worker?.id || '',
                    name: worker?.name || workerId,
                    manDay: 1.0,
                    unitPrice: worker?.unitPrice ?? 0,
                    payType: worker ? resolveWorkerSalaryType(worker) : '',
                    role: worker?.role || '작업자',
                    description: note,
                    workerTeamId: workerTeamId || resolvedTeamId,
                    workerTeamName: matchedTeam?.name || worker?.teamName || resolvedTeamName
                });
                totalWorkers += 1;
            });
        });

        const newLedgers = Array.from(scheduleGroups.values()).map((group) => {
            const rows = [...group.rows];
            const emptyRowCount = rows.length >= 20 ? 5 : 20 - rows.length;
            rows.push(...createEmptyRows(emptyRowCount));
            return {
                id: Date.now().toString() + Math.random(),
                siteId: group.siteId,
                rows,
                description: group.descriptionParts.join(', ')
            } satisfies Ledger;
        });

        if (newLedgers.length > 0) {
            setLedgers(prev => {
                if (prev.length === 1 && !prev[0].siteId && prev[0].rows.every(r => !r.name)) return newLedgers;
                return [...prev, ...newLedgers];
            });
        }

        return {
            ledgerCount: newLedgers.length,
            totalWorkers,
            totalUnknowns,
            skippedSiteCount,
            emptyScheduleCount,
            duplicateWorkerCount
        };
    }, [findSiteByAnalyzedName, getScheduleWorkerIds, normalizeLookupText, normalizeSiteId, sites, teams, workers]);

    const addLedger = useCallback(() => {
        setLedgers(prev => [...prev, { id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }]);
    }, []);

    const removeLedger = useCallback((id: string) => { setLedgers(prev => prev.filter(l => l.id !== id)); }, []);
    const removeLastLedger = useCallback(() => { setLedgers(prev => prev.length > 0 ? prev.slice(0, -1) : prev); }, []);
    const updateLedger = useCallback((id: string, updates: Partial<Ledger>) => { setLedgers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l)); }, []);
    const handleReset = useCallback(async () => {
        const result = await Swal.fire({ title: '작성 내용 초기화', text: '현재 입력된 모든 내용을 삭제하고 새로 시작하시겠습니까?', icon: 'warning', showCancelButton: true, confirmButtonText: '초기화', cancelButtonText: '취소', confirmButtonColor: '#d33' });
        if (result.isConfirmed) setLedgers([{ id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }]);
    }, []);
    const addRowToLedger = useCallback((id: string) => {
        setLedgers(prev => prev.map(l => l.id !== id ? l : { ...l, rows: [...l.rows, ...createEmptyRows(5)] }));
    }, []);

    const handleSaveAll = async () => {
        if (validationSummary.missingSites > 0) { Swal.fire('Warning', '현장이 선택되지 않은 장부가 있습니다.', 'warning'); return; }
        setLoading(true);
        try {
            const allReports: Omit<DailyReport, 'id'>[] = [];
            const involvedTeamIds = new Set<string>();
            let skippedGroupCount = 0;
            for (const ledger of ledgers) {
                const normalizedLedgerSiteId = normalizeSiteId(ledger.siteId);
                if (!normalizedLedgerSiteId) continue;
                const validRows = ledger.rows.filter(r => r.name.trim() !== '');
                if (validRows.length === 0) continue;
                const groups: { [key: string]: GridRow[] } = {};
                validRows.forEach(row => { const key = normalizeSiteId(row.teamId) || 'no-team'; if (!groups[key]) groups[key] = []; groups[key].push(row); });
                const site = sites.find((s) => normalizeSiteId(s.id) === normalizedLedgerSiteId);
                for (const [teamKey, rows] of Object.entries(groups)) {
                    const realTeamId = teamKey === 'no-team' ? '' : normalizeSiteId(teamKey);
                    const fallbackTeamId = normalizeSiteId(site?.responsibleTeamId) || normalizeSiteId(rows[0]?.workerTeamId) || normalizeSiteId(rows[0]?.teamId);
                    const resolvedTeamId = realTeamId || fallbackTeamId;
                    const team = teams.find((t) => normalizeSiteId(t.id) === resolvedTeamId);
                    if (!resolvedTeamId) { skippedGroupCount += 1; continue; }
                    involvedTeamIds.add(resolvedTeamId);
                    const totalManDay = rows.reduce((sum, r) => sum + r.manDay, 0);
                    const reportWorkers = rows.map(r => {
                        const matchedWorker = workers.find(w => w.id === r.workerId);
                        const resolvedSalaryType = normalizeSalaryType(r.payType) || resolveWorkerSalaryType(matchedWorker);
                        return { salaryModel: resolvedSalaryType, payType: resolvedSalaryType, workerId: r.workerId || 'unknown', name: r.name, role: r.role, status: 'attendance' as const, manDay: r.manDay, workContent: r.description, teamId: normalizeSiteId(r.teamId) || resolvedTeamId, unitPrice: r.unitPrice ?? 0, workerTeamId: normalizeSiteId(r.workerTeamId) || normalizeSiteId(r.teamId) || resolvedTeamId, workerTeamName: r.workerTeamName || r.teamName || team?.name || site?.responsibleTeamName || '' };
                    });
                    allReports.push({ date, teamId: resolvedTeamId, teamName: team?.name || site?.responsibleTeamName || rows[0]?.teamName || '', siteId: normalizedLedgerSiteId, siteName: site?.name || '', writerId: currentUser?.uid || 'unknown', workers: reportWorkers, totalManDay, responsibleTeamId: normalizeSiteId(site?.responsibleTeamId) || resolvedTeamId, responsibleTeamName: site?.responsibleTeamName || team?.name || '', companyId: site?.clientCompanyId || '', companyName: site?.clientCompanyName || '', constructorCompanyId: site?.companyId || '', constructorCompanyName: site?.companyName || '', partnerId: site?.partnerId || '', partnerName: site?.partnerName != null ? String(site.partnerName) : '', workContent: ledger.description || '' });
                }
            }
            if (allReports.length > 0) {
                await dailyReportService.overwriteReports(date, allReports, Array.from(involvedTeamIds));
                clearTempData();
                alert(`${allReports.length}건의 일보가 저장되었습니다.`);
            } else {
                alert('저장할 데이터가 없습니다.');
            }
        } catch (error) { console.error(error); alert('저장 중 오류가 발생했습니다.'); } finally { setLoading(false); }
    };

    const showAnalysisResult = useCallback((ledgerCount: number, totalUnknowns: number) => {
        if (ledgerCount === 0) {
            Swal.fire('Info', '인식된 일보 데이터가 없습니다.', 'info');
            return;
        }

        let message = `${ledgerCount}개의 장부가 입력되었습니다.`;
        if (totalUnknowns > 0) {
            message += `\n⚠️ 식별되지 않은 작업자 ${totalUnknowns}명이 있습니다. 빨간색으로 표시된 항목을 확인해주세요.`;
            Swal.fire({ title: 'AI 분석 완료 (확인 필요)', text: message, icon: 'warning', confirmButtonText: '확인' });
            return;
        }
        Swal.fire('Success', message, 'success');
    }, []);

    const showScheduleAnalysisResult = useCallback((result: {
        ledgerCount: number;
        totalWorkers: number;
        totalUnknowns: number;
        skippedSiteCount: number;
        emptyScheduleCount: number;
        duplicateWorkerCount: number;
    }) => {
        if (result.ledgerCount === 0) {
            Swal.fire('Info', '입력할 수 있는 저장 일정이 없습니다.', 'info');
            return;
        }

        const details = [
            `${result.ledgerCount}개의 장부와 ${result.totalWorkers}명의 작업자가 입력되었습니다.`
        ];

        if (result.totalUnknowns > 0) details.push(`마스터에서 찾지 못한 작업자 ${result.totalUnknowns}명은 확인이 필요합니다.`);
        if (result.skippedSiteCount > 0) details.push(`현장을 식별하지 못한 일정 ${result.skippedSiteCount}건은 제외했습니다.`);
        if (result.emptyScheduleCount > 0) details.push(`작업자 없는 일정 ${result.emptyScheduleCount}건은 현장 장부만 생성했습니다.`);
        if (result.duplicateWorkerCount > 0) details.push(`같은 현장에 중복 배정된 작업자 ${result.duplicateWorkerCount}건은 한 번만 넣었습니다.`);

        const hasWarnings = result.totalUnknowns > 0 || result.skippedSiteCount > 0;
        Swal.fire({
            title: hasWarnings ? '일정 분석 완료 (확인 필요)' : '일정 분석 완료',
            text: details.join('\n'),
            icon: hasWarnings ? 'warning' : 'success',
            confirmButtonText: '확인'
        });
    }, []);

    const handleScheduleAnalyzeClick = useCallback(async () => {
        if (fetching) {
            Swal.fire('Info', '기준 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'info');
            return;
        }

        setLoading(true);
        try {
            const dispatch = await dispatchService.getDispatchByDate(date);
            const assignments = Array.isArray(dispatch?.assignments) ? dispatch.assignments : [];
            if (assignments.length === 0) {
                Swal.fire('Info', `${date}에 저장된 현장 일정이 없습니다.`, 'info');
                return;
            }

            const result = appendScheduleAssignments(assignments);
            showScheduleAnalysisResult(result);
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : '일정 분석에 실패했습니다.';
            Swal.fire('Error', `일정 분석에 실패했습니다.\n${message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [appendScheduleAssignments, date, fetching, showScheduleAnalysisResult]);

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
            const analyzedReports = await geminiService.analyzeKakaoImage(file, buildKakaoAnalyzeContext());
            const result = appendAnalyzedReports(analyzedReports);
            showAnalysisResult(result.ledgerCount, result.totalUnknowns);
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : '이미지 분석에 실패했습니다.';
            Swal.fire('Error', `이미지 분석에 실패했습니다.\n${message}`, 'error');
        } finally { setLoading(false); }
    };

    const processKakaoText = async (text: string) => {
        const normalizedText = text.trim();
        if (!normalizedText) {
            Swal.fire('Info', '분석할 카톡 텍스트를 입력해주세요.', 'info');
            return;
        }
        const apiKey = geminiService.getKey();
        if (!apiKey) {
            Swal.fire('Info', 'API 키 설정이 필요합니다. (/settings/ai)', 'info');
            return;
        }

        setLoading(true);
        try {
            const analyzedReports = await geminiService.analyzeKakaoText(normalizedText, buildKakaoAnalyzeContext());
            const result = appendAnalyzedReports(analyzedReports);
            showAnalysisResult(result.ledgerCount, result.totalUnknowns);
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : '텍스트 분석에 실패했습니다.';
            Swal.fire('Error', `텍스트 분석에 실패했습니다.\n${message}`, 'error');
        } finally { setLoading(false); }
    };

    const formatFileSize = useCallback((bytes: number): string => {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
        if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }, []);

    const resetKakaoModal = useCallback(() => {
        setKakaoText('');
        setKakaoFile(null);
        setIsKakaoFileDragging(false);
        if (kakaoFileInputRef.current) kakaoFileInputRef.current.value = '';
    }, []);

    const closeKakaoModal = useCallback(() => {
        setIsKakaoModalOpen(false);
        resetKakaoModal();
    }, [resetKakaoModal]);

    const handleKakaoAnalyzeClick = useCallback(() => {
        setIsKakaoModalOpen(true);
    }, []);

    const selectKakaoFile = useCallback((file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            Swal.fire('Error', '이미지 파일만 가능합니다.', 'error');
            return;
        }
        setKakaoFile(file);
    }, []);

    const handleKakaoModalAnalyze = useCallback(async () => {
        const text = kakaoText.trim();
        const file = kakaoFile;

        if (!text && !file) {
            Swal.fire('Info', '카톡 텍스트를 입력하거나 스크린샷을 첨부해주세요.', 'info');
            return;
        }

        setIsKakaoModalOpen(false);
        if (file) {
            resetKakaoModal();
            await processKakaoImage(file);
            return;
        }

        resetKakaoModal();
        await processKakaoText(text);
    }, [kakaoFile, kakaoText, resetKakaoModal]);

    const hasWarnings = validationSummary.unknownWorkers > 0 || validationSummary.missingSites > 0;

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processKakaoImage(file); }}>
            {isDragging && (
                <div className="absolute inset-0 bg-yellow-400/80 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                    <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
                        <FontAwesomeIcon icon={faComment} className="text-6xl text-yellow-500 mb-4" />
                        <h2 className="text-3xl font-bold text-slate-800">카톡 이미지 떨어뜨리기</h2>
                        <p className="text-xl text-slate-500 mt-2">AI가 자동으로 일보를 작성합니다!</p>
                    </div>
                </div>
            )}

            {isKakaoModalOpen && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) closeKakaoModal();
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsKakaoFileDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const relatedTarget = e.relatedTarget as Node | null;
                        if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                            setIsKakaoFileDragging(false);
                        }
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsKakaoFileDragging(false);
                        selectKakaoFile(e.dataTransfer.files?.[0]);
                    }}
                >
                    <div
                        className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-yellow-300 text-slate-900 shadow-sm">
                                    <FontAwesomeIcon icon={faComment} className="text-lg" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">카톡 일보 분석</h2>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">이미지 우선</span>
                                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">현장/작업내용/인원 추출</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeKakaoModal}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                                aria-label="닫기"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <div className="grid gap-5 px-6 py-5 md:grid-cols-[1.08fr_0.92fr]">
                            <div className="flex min-h-[310px] flex-col">
                                <div className="mb-2 flex items-center justify-between">
                                    <label htmlFor="kakao-analysis-textarea" className="text-sm font-black text-slate-800">카톡 텍스트</label>
                                    <span className="text-xs font-semibold text-slate-400">{kakaoText.trim().length.toLocaleString()}자</span>
                                </div>
                                <textarea
                                    id="kakao-analysis-textarea"
                                    value={kakaoText}
                                    onChange={(e) => setKakaoText(e.target.value)}
                                    className="min-h-[282px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-100"
                                    placeholder={`현장: 파주
단종: 탑엔지니어링
작업내용: 동바리 해체 정리
인원: 김해용 홍명진 김군희 총 3명`}
                                />
                            </div>

                            <div className="flex min-h-[310px] flex-col">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-black text-slate-800">카톡 스크린샷</span>
                                    {kakaoFile && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setKakaoFile(null);
                                                if (kakaoFileInputRef.current) kakaoFileInputRef.current.value = '';
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                            삭제
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => kakaoFileInputRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsKakaoFileDragging(true);
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const relatedTarget = e.relatedTarget as Node | null;
                                        if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                                            setIsKakaoFileDragging(false);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsKakaoFileDragging(false);
                                        selectKakaoFile(e.dataTransfer.files?.[0]);
                                    }}
                                    className={`flex min-h-[282px] flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 text-center transition ${
                                        isKakaoFileDragging
                                            ? 'border-yellow-400 bg-yellow-50 ring-4 ring-yellow-100'
                                            : kakaoFile
                                                ? 'border-emerald-300 bg-emerald-50'
                                                : 'border-slate-300 bg-white hover:border-yellow-300 hover:bg-yellow-50/50'
                                    }`}
                                >
                                    <input
                                        ref={kakaoFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => selectKakaoFile(e.target.files?.[0])}
                                    />
                                    <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-xl ${
                                        kakaoFile ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        <FontAwesomeIcon icon={kakaoFile ? faImage : faUpload} className="text-2xl" />
                                    </div>
                                    {kakaoFile ? (
                                        <>
                                            <span className="max-w-full truncate text-sm font-black text-slate-900">{kakaoFile.name}</span>
                                            <span className="mt-1 text-xs font-semibold text-slate-500">{formatFileSize(kakaoFile.size)}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-base font-black text-slate-800">이미지 드롭 또는 선택</span>
                                            <span className="mt-2 text-xs font-semibold text-slate-500">PNG, JPG, WebP</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-semibold text-slate-500">
                                {kakaoFile ? '선택된 스크린샷으로 분석합니다.' : kakaoText.trim() ? '입력된 텍스트로 분석합니다.' : '분석할 카톡 내용을 준비하세요.'}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeKakaoModal}
                                    className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    onClick={handleKakaoModalAnalyze}
                                    disabled={!kakaoFile && !kakaoText.trim()}
                                    className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                                >
                                    분석해서 입력
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {hasWarnings && (
                <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 flex items-center justify-between shrink-0 animate-fade-in-down">
                    <div className="flex items-center gap-3 text-orange-800">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><FontAwesomeIcon icon={faExclamationTriangle} /></div>
                        <div>
                            <p className="font-bold text-sm">확인이 필요한 항목이 있습니다</p>
                            <p className="text-xs text-orange-700">{validationSummary.missingSites > 0 && <span>• 현장 미지정: <b>{validationSummary.missingSites}</b>건 </span>}{validationSummary.unknownWorkers > 0 && <span>• 미등록 작업자: <b>{validationSummary.unknownWorkers}</b>명 </span>}<span>(빨간색 표시를 확인해주세요)</span></p>
                        </div>
                    </div>
                </div>
            )}

            <div className="sticky-toolbar-wrapper">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky-toolbar z-[20]">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0 outline-none" />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1">
                            <span className="text-[10px] font-bold text-slate-400">날씨</span>
                            <select value={weather} onChange={(e) => setWeather(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-700 p-0 focus:ring-0 cursor-pointer">
                                <option value="맑음">맑음 ☀️</option><option value="흐림">흐림 ☁️</option><option value="비">비 ☔</option><option value="눈">눈 ❄️</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                             {globalDuplicateNames.size > 0 && (
                                <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
                                    <FontAwesomeIcon icon={faExclamationTriangle} /> 이름중복 {globalDuplicateNames.size}종
                                </span>
                            )}
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">총 {validationSummary.totalWorkers}명</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleScheduleAnalyzeClick} disabled={loading || fetching} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors font-bold"><FontAwesomeIcon icon={faCalendarAlt} /> 일정 분석</button>
                        <button onClick={handleKakaoAnalyzeClick} className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 flex items-center gap-2 shadow-sm transition-colors font-bold"><FontAwesomeIcon icon={faComment} /> 카톡 분석</button>
                        <button onClick={addLedger} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors"><FontAwesomeIcon icon={faPlus} /> 장부 추가</button>
                        <button onClick={removeLastLedger} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 shadow-sm transition-colors"><FontAwesomeIcon icon={faMinus} /> 장부 삭제</button>
                        <button onClick={handleReset} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-colors" title="초기화"><FontAwesomeIcon icon={faEraser} /> 초기화</button>
                        <button onClick={handleSaveAll} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"><FontAwesomeIcon icon={faSave} className={loading ? "animate-spin" : ""} />{loading ? '저장 중...' : '전체 저장'}</button>
                    </div>
                </div>
            </div>

            {hasTempData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 mx-6 flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2"><FontAwesomeIcon icon={faFloppyDisk} className="text-blue-600" /><span className="text-blue-800 font-medium text-sm">임시 저장된 데이터를 불러왔습니다.</span></div>
                    <button onClick={() => { clearTempData(); handleReset(); }} className="text-xs text-red-500 hover:text-red-700 underline">임시데이터 삭제</button>
                </div>
            )}

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
                            globalDuplicateNames={globalDuplicateNames}
                            onUpdate={updateLedger}
                            onDelete={removeLedger}
                            onAddRow={addRowToLedger}
                        />
                    ))}
                    {ledgers.length === 0 && (
                        <div className="w-full text-center py-20 text-slate-400 border-2 border-dashed border-slate-300 rounded-xl">
                            <p className="text-xl mb-4">작성된 장부가 없습니다.</p>
                            <button onClick={addLedger} className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">+ 새 장부 추가하기</button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .sticky-toolbar-wrapper { position: sticky; top: 0; z-index: 20; }
                .sticky-toolbar { position: sticky; top: 0; z-index: 20; background: white; }
                .handsontable-container .handsontable { font-size: 12px; }
                .handsontable-container .handsontable th { background-color: #4A192C; color: white !important; font-weight: bold !important; font-size: 11px; position: sticky !important; top: 0; z-index: 2; }
                .handsontable-container .handsontable td:nth-child(1) { background-color: #E0F7FA; }
                .handsontable-container .handsontable td:nth-child(2) { background-color: #FCE4EC; text-align: center; }
                .handsontable-container .handsontable td:nth-child(3) { background-color: #F5F5F5; color: #64748b; font-size: 11px; }
                .handsontable-container .handsontable td.unknown-worker-cell { background-color: #fca5a5 !important; color: #7f1d1d !important; font-weight: bold; border: 1px solid #ef4444 !important; }
                .handsontable-container .handsontable td.duplicate-worker-cell { background-color: #fef08a !important; color: #854d0e !important; font-weight: bold; border: 1px solid #eab308 !important; }
            `}</style>

            {loading && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-40 backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center">
                        <div className="animate-spin text-indigo-600 mb-3"><FontAwesomeIcon icon={faSpinner} className="animate-spin" size="2x" /></div>
                        <span className="font-bold text-slate-700">처리 중입니다...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyReportGridInput;
