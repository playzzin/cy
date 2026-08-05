import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faCalendarAlt, faTimes, faMinus, faComment, faExclamationTriangle, faSpinner, faEraser, faFloppyDisk, faUpload, faImage, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useSearchParams } from 'react-router-dom';
import { siteService, Site } from '../../services/siteService';
import SingleSelectPopover from '../../components/common/SingleSelectPopover';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { dispatchService, DispatchAssignment } from '../../services/dispatchService';
import {
    applyDailyReportSiteSnapshotToReport,
    buildDailyReportSiteSnapshot,
} from '../../utils/dailyReportSiteSnapshot';
import { getOpenSites } from '../../utils/siteStatus';

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
    responsibleTeamId?: string;
    responsibleTeamName?: string;
    siteManagerId?: string;
    siteManagerName?: string;
}

type ReviewCandidateSource = 'schedule' | 'kakao';
type ReviewCandidateAction = 'add-worker' | 'update-worker' | 'exclude-worker' | 'site-cancel';
type ReviewCandidateStatus = 'pending' | 'applied' | 'ignored';
type ReviewCandidateConfidence = 'high' | 'medium' | 'low';

interface ReviewCandidate {
    id: string;
    source: ReviewCandidateSource;
    action: ReviewCandidateAction;
    status: ReviewCandidateStatus;
    confidence: ReviewCandidateConfidence;
    siteId: string;
    siteName: string;
    responsibleTeamId?: string;
    responsibleTeamName?: string;
    row?: GridRow;
    originalRow?: GridRow;
    summary: string;
    detail?: string;
    originalText?: string;
    createdAt: number;
}

interface DailyReportMasterData {
    sites: Site[];
    teams: Team[];
    companies: Company[];
    workers: Worker[];
}

const DAILY_REPORT_TEMP_STORAGE_KEY = 'daily_report_temp_data';
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getLocalDateInputValue = (date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDateInputParam = (value?: string | null): string | null => {
    const trimmed = String(value ?? '').trim();
    return DATE_INPUT_PATTERN.test(trimmed) ? trimmed : null;
};

interface DailyReportTempState {
    ledgers: Ledger[];
    date: string;
    reviewCandidates: ReviewCandidate[];
    scheduleSnapshot: Ledger[];
    kakaoSnapshot: Ledger[];
}

const isInitialTempState = (state: DailyReportTempState): boolean => (
    (state.ledgers.length === 0 || (
        state.ledgers.length === 1
        && !state.ledgers[0].siteId
        && state.ledgers[0].rows.every(row => !row.name || row.name.trim() === '')
    ))
    && state.reviewCandidates.length === 0
    && state.scheduleSnapshot.length === 0
    && state.kakaoSnapshot.length === 0
);

const getTempStateSignature = (state: DailyReportTempState): string => (
    JSON.stringify(state)
);

const REVIEW_SOURCE_LABELS: Record<ReviewCandidateSource, string> = {
    schedule: '일정',
    kakao: '카톡'
};

const REVIEW_ACTION_LABELS: Record<ReviewCandidateAction, string> = {
    'add-worker': '추가',
    'update-worker': '변경',
    'exclude-worker': '미투입',
    'site-cancel': '데마'
};

const REVIEW_CONFIDENCE_LABELS: Record<ReviewCandidateConfidence, string> = {
    high: '높음',
    medium: '보통',
    low: '확인필요'
};

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

const normalizeWorkerName = (value?: string | null): string => {
    return String(value ?? '').replace(/\s+/g, '').trim();
};

const isRetiredWorker = (worker?: Partial<Worker> | null): boolean => {
    const status = String(worker?.status ?? '').trim();
    return status === '퇴사' || status === '퇴사자' || status === 'inactive' || worker?.isActive === false;
};

// --- Child Component: DailyReportTable ---
const DailyReportTable: React.FC<{
    ledger: Ledger;
    ledgerIndex: number;
    sites: Site[];
    teams: Team[];
    companies: Company[];
    workerMap: Map<string, Worker & { isDuplicateName?: boolean }>;
    retiredWorkerMap: Map<string, Worker>;
    globalDuplicateNames: Set<string>;
    onUpdate: (ledgerId: string, updates: Partial<Ledger>) => void;
    onDelete: (ledgerId: string) => void;
    onAddRow: (ledgerId: string) => void; 
}> = ({ ledger, ledgerIndex, sites, teams, companies, workerMap, retiredWorkerMap, globalDuplicateNames, onUpdate, onDelete, onAddRow }) => {

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
        const retiredWorkerNames = new Set<string>();

        changes.forEach(([row, col, oldValue, newValue]: [number, number, any, any]) => {
            if (row >= newRows.length) return;

            if (col === 0) { // Name column
                didChangeName = true;
                const rawName = newValue?.toString() || '';
                const searchName = normalizeWorkerName(rawName); 
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
                        const retiredWorker = retiredWorkerMap.get(searchName);
                        if (retiredWorker) {
                            retiredWorkerNames.add(retiredWorker.name || rawName);
                        }
                        newRows[row].workerId = '';
                        newRows[row].unitPrice = null;
                        newRows[row].payType = '';
                        newRows[row].role = '작업자';
                        newRows[row].teamName = '';
                        newRows[row].teamId = '';
                        newRows[row].workerTeamName = '';
                        newRows[row].workerTeamId = '';
                    }
                } else {
                    newRows[row].workerId = '';
                    newRows[row].unitPrice = null;
                    newRows[row].payType = '';
                    newRows[row].role = '작업자';
                    newRows[row].teamName = '';
                    newRows[row].teamId = '';
                    newRows[row].description = '';
                    newRows[row].workerTeamName = '';
                    newRows[row].workerTeamId = '';
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

        if (retiredWorkerNames.size > 0) {
            const names = Array.from(retiredWorkerNames);
            void Swal.fire({
                title: '퇴사자',
                text: names.length === 1
                    ? `${names[0]}님은 퇴사자로 등록되어 있습니다. 신규 등록이 필요한지, 기존 작업자를 재직으로 변경할지 확인해주세요.`
                    : `다음 작업자는 퇴사자로 등록되어 있습니다: ${names.join(', ')}. 신규 등록이 필요한지, 기존 작업자를 재직으로 변경할지 확인해주세요.`,
                icon: 'warning',
                confirmButtonText: '확인'
            });
        }

        onUpdate(ledger.id, { rows: newRows });
    }, [syncDuplicateFromHot, ledger.id, ledger.rows, onUpdate, teams, workerMap, retiredWorkerMap]);

    const normalizedLedgerSiteId = String(ledger.siteId ?? '').trim();
    const selectedSite = sites.find((s) => String(s.id ?? '').trim() === normalizedLedgerSiteId);
    const selectedSiteOption = selectedSite
        ? {
            id: String(selectedSite.id ?? '').trim(),
            name: String(selectedSite.name ?? '').trim()
        }
        : null;
    const siteOptions = useMemo(
        () =>
            getOpenSites(sites)
                .map((site) => ({
                    id: String(site.id ?? '').trim(),
                    name: String(site.name ?? '').trim()
                }))
                .filter((site) => Boolean(site.id) && Boolean(site.name)),
        [sites]
    );
    const selectedSiteSnapshot = useMemo(() => buildDailyReportSiteSnapshot({
        site: selectedSite,
        siteId: normalizedLedgerSiteId,
        teams,
        companies,
        fallback: {
            responsibleTeamId: ledger.responsibleTeamId,
            responsibleTeamName: ledger.responsibleTeamName,
            siteManagerId: ledger.siteManagerId,
            siteManagerName: ledger.siteManagerName,
        },
    }), [companies, ledger.responsibleTeamId, ledger.responsibleTeamName, ledger.siteManagerId, ledger.siteManagerName, normalizedLedgerSiteId, selectedSite, teams]);
    const ledgerResponsibleTeamId = selectedSiteSnapshot.responsibleTeamId;
    const ledgerResponsibleTeamName = selectedSiteSnapshot.responsibleTeamName;
    const ledgerSiteManagerName = selectedSiteSnapshot.siteManagerName;
    const ledgerSiteType = selectedSiteSnapshot.siteType;
    const ledgerPaymentMethod = selectedSiteSnapshot.paymentType;
    const siteSnapshotDisplayItems = [
        { label: '발주', title: '발주사', value: selectedSiteSnapshot.clientCompanyName },
        { label: '시공', title: '시공사', value: selectedSiteSnapshot.constructorCompanyName },
        { label: '협력', title: '협력사', value: selectedSiteSnapshot.partnerName },
        { label: '책임자', title: '현장책임자', value: ledgerSiteManagerName },
        { label: '구분', title: '현장 구분', value: ledgerSiteType },
        { label: '결제방식', title: '결제방식', value: ledgerPaymentMethod },
    ];

    const siteTeams = useMemo(() => {
        if (!ledgerResponsibleTeamId && !ledgerResponsibleTeamName) return [];
        return teams.filter(t =>
            t.id === ledgerResponsibleTeamId ||
            t.legacyId === ledgerResponsibleTeamId ||
            String(t.name ?? '').trim() === ledgerResponsibleTeamName
        );
    }, [ledgerResponsibleTeamId, ledgerResponsibleTeamName, teams]);

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
    const retiredWorkersCount = ledger.rows.filter(r => {
        const name = normalizeWorkerName(r.name);
        return name !== '' && !r.workerId && retiredWorkerMap.has(name);
    }).length;
    const unknownWorkersCount = ledger.rows.filter(r => {
        const name = normalizeWorkerName(r.name);
        return name !== '' && !r.workerId && !retiredWorkerMap.has(name);
    }).length;
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
                                selectedOptionOverride={selectedSiteOption}
                                onSelect={(siteId) => {
                                    const nextSiteId = String(siteId ?? '').trim();
                                    const nextSite = sites.find((site) => String(site.id ?? '').trim() === nextSiteId);
                                    onUpdate(ledger.id, {
                                        siteId: nextSiteId,
                                        responsibleTeamId: String(nextSite?.responsibleTeamId ?? '').trim(),
                                        responsibleTeamName: String(nextSite?.responsibleTeamName ?? '').trim(),
                                        siteManagerId: String((nextSite as any)?.siteManagerId ?? '').trim(),
                                        siteManagerName: String((nextSite as any)?.siteManagerName ?? '').trim()
                                    });
                                }}
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
                        {retiredWorkersCount > 0 && (
                            <span className="bg-orange-400 text-white text-[10px] px-1.5 rounded-full font-bold flex items-center gap-1" title="퇴사자로 등록된 작업자 수">
                                <FontAwesomeIcon icon={faExclamationTriangle} /> 퇴사 {retiredWorkersCount}
                            </span>
                        )}
                        <button onClick={() => onDelete(ledger.id)} className="ml-1 text-white/70 hover:text-white" title="장부 삭제">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                </div>

                {selectedSite && (
                    <div className="mt-1 pb-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/90 border-t border-white/20 pt-1">
                        {siteSnapshotDisplayItems.map((item) => {
                            const isMissing = item.value.trim() === '';
                            return (
                                <div key={item.label} className="flex items-center gap-1" title={item.title}>
                                    <span className="opacity-70 text-[9px]">{item.label}:</span>
                                    <span className={`font-medium ${isMissing ? 'text-white/55' : ''}`}>
                                        {isMissing ? '미지정' : item.value}
                                    </span>
                                </div>
                            );
                        })}
                        {ledgerResponsibleTeamName ? (
                            <button
                                onClick={() => {
                                    const team = siteTeams.find(t =>
                                        t.id === ledgerResponsibleTeamId ||
                                        t.legacyId === ledgerResponsibleTeamId ||
                                        String(t.name ?? '').trim() === ledgerResponsibleTeamName
                                    );
                                    if (team) handleAddTeamMembers(team);
                                }}
                                disabled={!siteTeams.find(t =>
                                    t.id === ledgerResponsibleTeamId ||
                                    t.legacyId === ledgerResponsibleTeamId ||
                                    String(t.name ?? '').trim() === ledgerResponsibleTeamName
                                )}
                                className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                title="현장담당팀 (클릭하여 팀원 일괄 추가)"
                            >
                                <span className="opacity-70 text-[9px]">현장담당팀:</span>
                                <span className="font-medium underline decoration-dotted">{ledgerResponsibleTeamName}</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1" title="현장담당팀">
                                <span className="opacity-70 text-[9px]">현장담당팀:</span>
                                <span className="font-medium text-white/55">미지정</span>
                            </div>
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
                    cells={(row, col, _prop) => {
                        const cellProperties: any = {};
                        if (col === 0) {
                            const hot = hotRef.current?.hotInstance;
                            const rawName = hot ? hot.getDataAtCell(row, 0) : '';
                            const normalized = String(rawName ?? '').replace(/\s+/g, '').trim();
                            if (normalized) {
                                const matchedWorker = workerMap.get(normalized);
                                if (!matchedWorker) {
                                    const retiredWorker = retiredWorkerMap.get(normalized);
                                    if (retiredWorker) {
                                        cellProperties.className = 'retired-worker-cell';
                                        cellProperties.title = "퇴사자로 등록된 작업자입니다. 신규 등록 또는 재직 전환 여부를 확인해주세요.";
                                    } else {
                                        cellProperties.className = 'unknown-worker-cell';
                                        cellProperties.title = "등록되지 않은 작업자입니다. 확인해주세요.";
                                    }
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
    const [searchParams, setSearchParams] = useSearchParams();
    const urlDate = normalizeDateInputParam(searchParams.get('date'));
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const reportInputSites = useMemo(() => getOpenSites(sites), [sites]);

    const [date, setDate] = useState(() => urlDate ?? getLocalDateInputValue());
    const [weather, setWeather] = useState('맑음');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [isKakaoModalOpen, setIsKakaoModalOpen] = useState(false);
    const [isKakaoFileDragging, setIsKakaoFileDragging] = useState(false);
    const [kakaoText, setKakaoText] = useState('');
    const [kakaoFile, setKakaoFile] = useState<File | null>(null);
    const [reviewCandidates, setReviewCandidates] = useState<ReviewCandidate[]>([]);
    const [scheduleSnapshot, setScheduleSnapshot] = useState<Ledger[]>([]);
    const [kakaoSnapshot, setKakaoSnapshot] = useState<Ledger[]>([]);
    const [loadErrorMessage, setLoadErrorMessage] = useState('');
    const masterDataRef = useRef<DailyReportMasterData>({ sites: [], teams: [], companies: [], workers: [] });
    const reportLoadRequestIdRef = useRef(0);
    const syncedUrlDateRef = useRef(urlDate);
    const kakaoFileInputRef = useRef<HTMLInputElement>(null);

    const normalizeSiteId = useCallback((value: unknown): string => String(value ?? '').trim(), []);

    const buildWorkerSearchMap = useCallback((workerList: Worker[]) => {
        const map = new Map<string, Worker & { isDuplicateName?: boolean }>();
        const activeWorkers = workerList.filter(w => !isRetiredWorker(w));
        const nameCounts = new Map<string, number>();
        activeWorkers.forEach(w => {
            const key = normalizeWorkerName(w.name);
            if (!key) return;
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        });
        activeWorkers.forEach(w => {
            const key = normalizeWorkerName(w.name);
            if (!key) return;
            const isDuplicate = nameCounts.get(key)! > 1;
            map.set(key, { ...w, isDuplicateName: isDuplicate });
        });
        return map;
    }, []);

    const workerMap = useMemo(() => buildWorkerSearchMap(workers), [workers, buildWorkerSearchMap]);
    const retiredWorkerMap = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach(worker => {
            if (!isRetiredWorker(worker)) return;
            const key = normalizeWorkerName(worker.name);
            if (key && !map.has(key)) {
                map.set(key, worker);
            }
        });
        return map;
    }, [workers]);

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

    useEffect(() => {
        if (urlDate === syncedUrlDateRef.current) {
            return;
        }

        syncedUrlDateRef.current = urlDate;
        const nextDate = urlDate ?? getLocalDateInputValue();
        if (nextDate !== date) {
            setDate(nextDate);
        }
    }, [date, urlDate]);

    useEffect(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'input');
            next.set('date', date);
            return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
    }, [date, setSearchParams]);

    const handleDateInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
        const nextDate = normalizeDateInputParam(event.currentTarget.value);
        if (!nextDate) return;

        setDate(nextDate);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'input');
            next.set('date', nextDate);
            return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
    }, [setSearchParams]);

    useEffect(() => {
        masterDataRef.current = { sites, teams, companies, workers };
    }, [sites, teams, companies, workers]);

    const validationSummary = useMemo(() => {
        let missingSites = 0;
        let unknownWorkers = 0;
        let retiredWorkers = 0;
        let totalWorkers = 0;
        ledgers.forEach(ledger => {
            if (!ledger.siteId) missingSites++;
            ledger.rows.forEach(r => {
                const normalizedName = normalizeWorkerName(r.name);
                if (normalizedName !== '') {
                    totalWorkers++;
                    if (!r.workerId) {
                        if (retiredWorkerMap.has(normalizedName)) {
                            retiredWorkers++;
                        } else {
                            unknownWorkers++;
                        }
                    }
                }
            });
        });
        return { missingSites, unknownWorkers, retiredWorkers, totalWorkers };
    }, [ledgers, retiredWorkerMap]);

    const fetchMasterData = useCallback(
        async (options?: { rematchLedgers?: boolean }) => {
            try {
                const [sitesData, teamsData, companiesData, workersData] = await Promise.all([
                    siteService.getSites(),
                    teamService.getTeams(),
                    companyService.getCompanies(),
                    manpowerService.getWorkers(true)
                ]);
                const masterData = {
                    sites: sitesData,
                    teams: teamsData,
                    companies: companiesData,
                    workers: workersData
                };
                masterDataRef.current = masterData;
                setSites(sitesData);
                setTeams(teamsData);
                setCompanies(companiesData);
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
                return masterData;
            } catch (error) {
                console.error('Failed to fetch master data', error);
                return null;
            }
        },
        [buildWorkerSearchMap]
    );

    const stateRef = useRef<DailyReportTempState>({ ledgers, date, reviewCandidates, scheduleSnapshot, kakaoSnapshot });
    const ignoredTempStateSignaturesRef = useRef<Set<string>>(new Set());
    const [hasTempData, setHasTempData] = useState(false);

    useEffect(() => {
        stateRef.current = { ledgers, date, reviewCandidates, scheduleSnapshot, kakaoSnapshot };
    }, [ledgers, date, reviewCandidates, scheduleSnapshot, kakaoSnapshot]);

    const performSave = useCallback(() => {
        try {
            const current = stateRef.current;
            const currentSignature = getTempStateSignature(current);
            if (ignoredTempStateSignaturesRef.current.has(currentSignature)) return;
            if (isInitialTempState(current)) return;
            const tempData = {
                ledgers: current.ledgers,
                date: current.date,
                reviewCandidates: current.reviewCandidates,
                scheduleSnapshot: current.scheduleSnapshot,
                kakaoSnapshot: current.kakaoSnapshot,
                savedAt: Date.now()
            };
            ignoredTempStateSignaturesRef.current.clear();
            localStorage.setItem(DAILY_REPORT_TEMP_STORAGE_KEY, JSON.stringify(tempData));
            setHasTempData(true);
        } catch (e) {
            console.error("Temp save failed", e);
        }
    }, []);

    const loadTempData = useCallback(async (targetDate: string) => {
        try {
            const tempDataStr = localStorage.getItem(DAILY_REPORT_TEMP_STORAGE_KEY);
            if (!tempDataStr) return false;
            const tempData = JSON.parse(tempDataStr);
            if (Date.now() - tempData.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(DAILY_REPORT_TEMP_STORAGE_KEY);
                setHasTempData(false);
                return false;
            }
            if (tempData.date && tempData.date !== targetDate) {
                setHasTempData(false);
                return false;
            }
            setLedgers(tempData.ledgers);
            if (Array.isArray(tempData.reviewCandidates)) setReviewCandidates(tempData.reviewCandidates);
            if (Array.isArray(tempData.scheduleSnapshot)) setScheduleSnapshot(tempData.scheduleSnapshot);
            if (Array.isArray(tempData.kakaoSnapshot)) setKakaoSnapshot(tempData.kakaoSnapshot);
            ignoredTempStateSignaturesRef.current.clear();
            setHasTempData(true);
            return true;
        } catch (e) {
            console.error("Failed to load temp data", e);
            localStorage.removeItem(DAILY_REPORT_TEMP_STORAGE_KEY);
            setHasTempData(false);
            return false;
        }
    }, []);

    const clearTempData = useCallback((stateToIgnore?: DailyReportTempState) => {
        localStorage.removeItem(DAILY_REPORT_TEMP_STORAGE_KEY);
        ignoredTempStateSignaturesRef.current.add(getTempStateSignature(stateRef.current));
        if (stateToIgnore) {
            ignoredTempStateSignaturesRef.current.add(getTempStateSignature(stateToIgnore));
        }
        setHasTempData(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => { performSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [ledgers, date, reviewCandidates, scheduleSnapshot, kakaoSnapshot, performSave]);

    useEffect(() => {
        const handleBeforeUnload = () => { performSave(); };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            performSave();
        };
    }, [performSave]);

    const fetchReportsForDate = useCallback(async (targetDate: string, masterData?: DailyReportMasterData) => {
        const reportTeams = masterData?.teams ?? masterDataRef.current.teams;
        const reportWorkers = masterData?.workers ?? masterDataRef.current.workers;

        try {
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
                const responsibleReport = siteReports.find((report) => String(report.responsibleTeamName ?? report.responsibleTeamId ?? '').trim());
                const responsibleTeamId = String(responsibleReport?.responsibleTeamId ?? '').trim();
                const responsibleTeamName = String(responsibleReport?.responsibleTeamName ?? '').trim();
                const aggregatedRows: GridRow[] = [];
                siteReports.forEach(report => {
                    const reportTeamId = report.teamId || '';
                    const reportTeamName = report.teamName || (reportTeams.find(t => t.id === reportTeamId)?.name) || '';
                    report.workers.forEach(w => {
                        const wId = w.workerId || '';
                        const wName = w.name || (w as any).workerName || '';
                        const workerBase = reportWorkers.find(wk => wk.id === wId) || reportWorkers.find(wk => wk.name === wName);
                        const finalWorkerName = wName || workerBase?.name || '';
                        const finalTeamId = w.teamId || (w as any).workerTeamId || workerBase?.teamId || reportTeamId;
                        const finalTeamName = (w as any).teamName || (reportTeams.find(t => t.id === finalTeamId)?.name) || reportTeamName;

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

                newLedgers.push({
                    id: Date.now().toString() + Math.random(),
                    siteId,
                    rows,
                    description: uniqueContent,
                    responsibleTeamId,
                    responsibleTeamName
                });
            });
            return newLedgers;
        } catch (error) {
            console.error("Failed to fetch reports for date", error);
            throw error;
        }
    }, [normalizeSiteId]);

    useEffect(() => {
        const requestId = reportLoadRequestIdRef.current + 1;
        reportLoadRequestIdRef.current = requestId;
        let cancelled = false;
        const isCurrentRequest = () => !cancelled && reportLoadRequestIdRef.current === requestId;

        const run = async () => {
            setFetching(true);
            setLoadErrorMessage('');
            try {
                let masterData = masterDataRef.current;
                if (masterData.sites.length === 0 || masterData.teams.length === 0 || masterData.workers.length === 0) {
                    const loadedMasterData = await fetchMasterData();
                    if (!isCurrentRequest()) return;
                    if (!loadedMasterData) {
                        throw new Error('Failed to load daily report master data');
                    }
                    masterData = loadedMasterData;
                }

                const serverLedgers = await fetchReportsForDate(date, masterData);
                if (!isCurrentRequest()) return;

                if (serverLedgers && serverLedgers.length > 0) {
                    setLedgers(serverLedgers);
                    setReviewCandidates([]);
                    setScheduleSnapshot([]);
                    setKakaoSnapshot([]);
                    setHasTempData(false);
                } else {
                    const loaded = await loadTempData(date);
                    if (!isCurrentRequest()) return;
                    if (!loaded) {
                        setLedgers([{ id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }]);
                        setReviewCandidates([]);
                        setScheduleSnapshot([]);
                        setKakaoSnapshot([]);
                    }
                }
            } catch (error) {
                if (!isCurrentRequest()) return;
                console.error('[DailyReportGridInput] Failed to load daily report input data', error);
                setLoadErrorMessage('일보 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            } finally {
                if (isCurrentRequest()) {
                    setFetching(false);
                }
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [date, fetchMasterData, fetchReportsForDate, loadTempData]);

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

    const createEmptyRows = useCallback((count: number): GridRow[] => {
        return Array(count).fill(null).map(() => ({
            id: Math.random().toString(36).substr(2, 9),
            teamId: '', teamName: '', workerId: '', name: '', manDay: 1.0, unitPrice: null, payType: '', role: '작업자', description: '', workerTeamId: '', workerTeamName: ''
        }));
    }, []);

    const normalizeLookupText = useCallback((value?: string | null): string => {
        return String(value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const buildKakaoAnalyzeContext = useCallback((): KakaoAnalyzeContext => ({
        today: date,
        sites: reportInputSites.map(s => s.name).filter(Boolean),
        teams: teams.map(t => t.name).filter(Boolean),
        workers: workers.map(w => w.name).filter(Boolean)
    }), [date, reportInputSites, teams, workers]);

    const findSiteByAnalyzedName = useCallback((siteName?: string | null): Site | undefined => {
        const normalized = normalizeLookupText(siteName);
        if (!normalized) return undefined;
        return reportInputSites.find(s => normalizeLookupText(s.name) === normalized)
            || reportInputSites.find(s => {
                const candidate = normalizeLookupText(s.name);
                return Boolean(candidate) && (candidate.includes(normalized) || normalized.includes(candidate));
            });
    }, [normalizeLookupText, reportInputSites]);

    const findWorkerByAnalyzedName = useCallback((workerName?: string | null): (Worker & { isDuplicateName?: boolean }) | undefined => {
        const normalized = normalizeLookupText(workerName);
        if (!normalized) return undefined;
        return workerMap.get(normalized);
    }, [normalizeLookupText, workerMap]);

    const createCandidateId = useCallback((source: ReviewCandidateSource): string => {
        return `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }, []);

    const cloneLedgers = useCallback((sourceLedgers: Ledger[]): Ledger[] => {
        return sourceLedgers.map(ledger => ({
            ...ledger,
            rows: ledger.rows.map(row => ({ ...row }))
        }));
    }, []);

    const countLedgerWorkers = useCallback((sourceLedgers: Ledger[]): number => {
        return sourceLedgers.reduce((sum, ledger) => sum + ledger.rows.filter(row => row.name.trim()).length, 0);
    }, []);

    const findReviewRowIndex = useCallback((rows: GridRow[], target?: GridRow): number => {
        if (!target) return -1;
        const targetWorkerId = normalizeSiteId(target.workerId);
        const targetName = normalizeLookupText(target.name);
        if (!targetWorkerId && !targetName) return -1;

        return rows.findIndex(row => {
            if (!row.name.trim()) return false;
            if (targetWorkerId && normalizeSiteId(row.workerId) === targetWorkerId) return true;
            return Boolean(targetName) && normalizeLookupText(row.name) === targetName;
        });
    }, [normalizeLookupText, normalizeSiteId]);

    const findLedgerBySiteIndex = useCallback((sourceLedgers: Ledger[], siteId: string, siteName?: string): number => {
        const normalizedSiteId = normalizeSiteId(siteId);
        const normalizedSiteName = normalizeLookupText(siteName);
        return sourceLedgers.findIndex(ledger => {
            if (normalizedSiteId && normalizeSiteId(ledger.siteId) === normalizedSiteId) return true;
            if (!normalizedSiteName) return false;
            const site = sites.find(candidate => normalizeSiteId(candidate.id) === normalizeSiteId(ledger.siteId));
            return normalizeLookupText(site?.name) === normalizedSiteName;
        });
    }, [normalizeLookupText, normalizeSiteId, sites]);

    const hasCancelKeyword = useCallback((value?: string | null): boolean => {
        return /데마|대마|취소|안감|작업없|작업\s*없|철수|중단/.test(String(value ?? ''));
    }, []);

    const applyCandidateToLedgerState = useCallback((sourceLedgers: Ledger[], candidate: ReviewCandidate): Ledger[] => {
        const nextLedgers = sourceLedgers.map(ledger => ({
            ...ledger,
            rows: ledger.rows.map(row => ({ ...row }))
        }));

        let ledgerIndex = findLedgerBySiteIndex(nextLedgers, candidate.siteId, candidate.siteName);
        if (ledgerIndex === -1) {
            nextLedgers.push({
                id: Date.now().toString() + Math.random(),
                siteId: candidate.siteId,
                rows: createEmptyRows(20),
                description: '',
                responsibleTeamId: candidate.responsibleTeamId,
                responsibleTeamName: candidate.responsibleTeamName
            });
            ledgerIndex = nextLedgers.length - 1;
        }

        const ledger = nextLedgers[ledgerIndex];
        if (!ledger.responsibleTeamId && candidate.responsibleTeamId) ledger.responsibleTeamId = candidate.responsibleTeamId;
        if (!ledger.responsibleTeamName && candidate.responsibleTeamName) ledger.responsibleTeamName = candidate.responsibleTeamName;

        if (candidate.action === 'site-cancel') {
            ledger.rows = createEmptyRows(Math.max(20, ledger.rows.length));
            ledger.description = ledger.description ? `${ledger.description}, 데마` : '데마';
            return nextLedgers;
        }

        const targetRow = candidate.row || candidate.originalRow;
        if (!targetRow) return nextLedgers;

        const existingIndex = findReviewRowIndex(ledger.rows, targetRow);
        if (candidate.action === 'exclude-worker') {
            if (existingIndex >= 0) {
                ledger.rows[existingIndex] = createEmptyRows(1)[0];
            }
            return nextLedgers;
        }

        const nextRow = { ...targetRow, id: targetRow.id || Math.random().toString(36).substr(2, 9) };
        if (existingIndex >= 0) {
            ledger.rows[existingIndex] = {
                ...ledger.rows[existingIndex],
                ...nextRow,
                id: ledger.rows[existingIndex].id
            };
        } else {
            let emptyIndex = ledger.rows.findIndex(row => !row.name.trim());
            if (emptyIndex === -1) {
                ledger.rows.push(...createEmptyRows(5));
                emptyIndex = ledger.rows.findIndex(row => !row.name.trim());
            }
            ledger.rows[emptyIndex] = nextRow;
        }

        if (!ledger.description && candidate.detail) {
            ledger.description = candidate.detail;
        }

        return nextLedgers;
    }, [createEmptyRows, findLedgerBySiteIndex, findReviewRowIndex]);

    const applyReviewCandidate = useCallback((candidateId: string) => {
        setReviewCandidates(prev => {
            const candidate = prev.find(item => item.id === candidateId);
            if (!candidate || candidate.status !== 'pending') return prev;
            setLedgers(current => applyCandidateToLedgerState(current, candidate));
            return prev.map(item => item.id === candidateId ? { ...item, status: 'applied' } : item);
        });
    }, [applyCandidateToLedgerState]);

    const ignoreReviewCandidate = useCallback((candidateId: string) => {
        setReviewCandidates(prev => prev.map(item => item.id === candidateId ? { ...item, status: 'ignored' } : item));
    }, []);

    const applySafeReviewCandidates = useCallback(() => {
        setReviewCandidates(prev => {
            const safeCandidates = prev.filter(item =>
                item.status === 'pending' &&
                item.action === 'add-worker' &&
                item.confidence !== 'low'
            );
            if (safeCandidates.length === 0) return prev;

            setLedgers(current => safeCandidates.reduce((ledgers, candidate) => applyCandidateToLedgerState(ledgers, candidate), current));
            const appliedIds = new Set(safeCandidates.map(item => item.id));
            return prev.map(item => appliedIds.has(item.id) ? { ...item, status: 'applied' } : item);
        });
    }, [applyCandidateToLedgerState]);

    const clearReviewedCandidates = useCallback(() => {
        setReviewCandidates(prev => prev.filter(item => item.status === 'pending'));
    }, []);

    const getScheduleWorkerIds = useCallback((assignment: DispatchAssignment): string[] => {
        const directWorkerIds = Array.isArray(assignment.workerIds) ? assignment.workerIds : [];
        return Array.from(new Set(directWorkerIds.map(normalizeSiteId).filter(Boolean)));
    }, [normalizeSiteId]);

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
                const workerTeamName = matchedTeam?.name || worker?.teamName || analyzedWorker.teamName || report.teamName || (isSupportTeam ? 'support' : '');
                /*
                const workerTeamName = isSupportTeam
                    ? '지원'
                    : (matchedTeam?.name || worker?.teamName || analyzedWorker.teamName || report.teamName || '');
                */
                rows[idx] = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: analyzedWorker.name,
                    manDay,
                    teamId: worker?.teamId || '',
                    teamName: workerTeamName,
                    workerId: worker?.id || '',
                    unitPrice: worker?.unitPrice || 0,
                    payType: resolveWorkerSalaryType(worker),
                    /*
                    role: analyzedWorker.role || worker?.role || '작업자',
                    */
                    role: analyzedWorker.role || worker?.role || 'worker',
                    description: workerWorkContent,
                    workerTeamId: worker?.teamId || '',
                    workerTeamName
                };
            }

            const aggregatedContent = report.workContent
                || Array.from(new Set(reportWorkers.map(w => w.workContent).filter(Boolean))).join(', ');
            newLedgers.push({
                id: Date.now().toString() + Math.random(),
                siteId,
                rows,
                description: aggregatedContent,
                responsibleTeamId: normalizeSiteId(site?.responsibleTeamId),
                responsibleTeamName: String(site?.responsibleTeamName ?? '').trim()
            });
        }

        if (newLedgers.length > 0) {
            setLedgers(prev => {
                if (prev.length === 1 && !prev[0].siteId && prev[0].rows.every(r => !r.name)) return newLedgers;
                return [...prev, ...newLedgers];
            });
        }

        return { ledgerCount: newLedgers.length, totalUnknowns };
    }, [findSiteByAnalyzedName, findWorkerByAnalyzedName, normalizeLookupText, teams]);

    const appendAnalyzedReviewCandidates = useCallback((analyzedReports: AnalyzedDailyReport[], sourceText = '') => {
        const candidates: ReviewCandidate[] = [];
        const analyzedWorkerKeysBySite = new Map<string, Set<string>>();
        const reportedSiteKeys = new Set<string>();
        let totalUnknowns = 0;
        let missingCount = 0;
        let cancelCount = 0;

        const buildWorkerKey = (workerId?: string | null, workerName?: string | null) => {
            const normalizedWorkerId = normalizeSiteId(workerId);
            if (normalizedWorkerId) return `id:${normalizedWorkerId}`;
            const normalizedName = normalizeLookupText(workerName);
            return normalizedName ? `name:${normalizedName}` : '';
        };

        for (const report of analyzedReports) {
            const reportWorkers = Array.isArray(report.workers)
                ? report.workers.filter(w => normalizeLookupText(w?.name))
                : [];
            const site = findSiteByAnalyzedName(report.siteName);
            const siteId = normalizeSiteId(site?.id);
            const siteName = site?.name || report.siteName || '';
            const siteKey = siteId || normalizeLookupText(siteName);
            const aggregatedContent = report.workContent
                || Array.from(new Set(reportWorkers.map(w => w.workContent).filter(Boolean))).join(', ');

            if (siteKey) {
                reportedSiteKeys.add(siteKey);
                if (!analyzedWorkerKeysBySite.has(siteKey)) analyzedWorkerKeysBySite.set(siteKey, new Set<string>());
            }

            if (reportWorkers.length === 0) {
                if (siteKey && hasCancelKeyword(`${report.siteName || ''} ${report.workContent || ''} ${sourceText}`)) {
                    candidates.push({
                        id: createCandidateId('kakao'),
                        source: 'kakao',
                        action: 'site-cancel',
                        status: 'pending',
                        confidence: site ? 'medium' : 'low',
                        siteId,
                        siteName,
                        responsibleTeamId: normalizeSiteId(site?.responsibleTeamId),
                        responsibleTeamName: String(site?.responsibleTeamName ?? '').trim(),
                        summary: `${siteName || '현장 미확인'} 데마 후보`,
                        detail: aggregatedContent || '데마',
                        originalText: sourceText,
                        createdAt: Date.now()
                    });
                    cancelCount++;
                }
                continue;
            }

            for (const analyzedWorker of reportWorkers) {
                const worker = findWorkerByAnalyzedName(analyzedWorker.name);
                if (!worker) totalUnknowns++;

                const matchedTeam = worker?.teamId ? teams.find(t => t.id === worker.teamId) : undefined;
                const isSupportTeam = worker?.teamType === '吏?먰?';
                const analyzedManDay = Number(analyzedWorker.manDay);
                const manDay = Number.isFinite(analyzedManDay) && analyzedManDay > 0 ? analyzedManDay : 1;
                const workerWorkContent = analyzedWorker.workContent || aggregatedContent || '';
                const workerTeamName = matchedTeam?.name || worker?.teamName || analyzedWorker.teamName || report.teamName || (isSupportTeam ? 'support' : '');
                /*
                const workerTeamName = isSupportTeam
                    ? '지원'
                    : (matchedTeam?.name || worker?.teamName || analyzedWorker.teamName || report.teamName || '');
                */
                const row: GridRow = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: worker?.name || analyzedWorker.name,
                    manDay,
                    teamId: worker?.teamId || '',
                    teamName: workerTeamName,
                    workerId: worker?.id || '',
                    unitPrice: worker?.unitPrice || 0,
                    payType: worker ? resolveWorkerSalaryType(worker) : '',
                    /*
                    role: analyzedWorker.role || worker?.role || '?묒뾽??,
                    description: workerWorkContent,
                    workerTeamId: worker?.teamId || '',
                    workerTeamName
                };

                    */
                    role: analyzedWorker.role || worker?.role || 'worker',
                    description: workerWorkContent,
                    workerTeamId: worker?.teamId || '',
                    workerTeamName
                };

                const workerKey = buildWorkerKey(row.workerId, row.name);
                if (siteKey && workerKey) analyzedWorkerKeysBySite.get(siteKey)?.add(workerKey);

                const ledgerIndex = findLedgerBySiteIndex(ledgers, siteId, siteName);
                const existingRowIndex = ledgerIndex >= 0 ? findReviewRowIndex(ledgers[ledgerIndex].rows, row) : -1;
                const existingRow = ledgerIndex >= 0 && existingRowIndex >= 0 ? ledgers[ledgerIndex].rows[existingRowIndex] : undefined;
                const action: ReviewCandidateAction = existingRow ? 'update-worker' : 'add-worker';
                const manDayChanged = existingRow && Number(existingRow.manDay || 0) !== manDay;
                const confidence: ReviewCandidateConfidence = site && worker ? 'high' : worker ? 'medium' : 'low';

                candidates.push({
                    id: createCandidateId('kakao'),
                    source: 'kakao',
                    action,
                    status: 'pending',
                    confidence,
                    siteId,
                    siteName,
                    responsibleTeamId: normalizeSiteId(site?.responsibleTeamId),
                    responsibleTeamName: String(site?.responsibleTeamName ?? '').trim(),
                    row,
                    originalRow: existingRow,
                    summary: worker
                        ? `${row.name} ${action === 'add-worker' ? '추가 후보' : manDayChanged ? `${existingRow?.manDay} -> ${manDay}공수` : '출역 확인'}`
                        : `${row.name} 미등록 작업자 후보`,
                    detail: workerWorkContent,
                    originalText: sourceText,
                    createdAt: Date.now()
                });
            }
        }

        ledgers.forEach(ledger => {
            const site = sites.find(candidate => normalizeSiteId(candidate.id) === normalizeSiteId(ledger.siteId));
            const siteKey = normalizeSiteId(ledger.siteId) || normalizeLookupText(site?.name);
            if (!siteKey || !reportedSiteKeys.has(siteKey)) return;
            const analyzedKeys = analyzedWorkerKeysBySite.get(siteKey) || new Set<string>();

            ledger.rows.forEach(row => {
                if (!row.name.trim()) return;
                const rowKey = buildWorkerKey(row.workerId, row.name);
                if (!rowKey || analyzedKeys.has(rowKey)) return;
                candidates.push({
                    id: createCandidateId('kakao'),
                    source: 'kakao',
                    action: 'exclude-worker',
                    status: 'pending',
                    confidence: 'low',
                    siteId: normalizeSiteId(ledger.siteId),
                    siteName: site?.name || '',
                    responsibleTeamId: ledger.responsibleTeamId,
                    responsibleTeamName: ledger.responsibleTeamName,
                    originalRow: row,
                    summary: `${row.name} 카톡 미확인`,
                    detail: '일정/현재 입력에는 있지만 카톡 분석에는 없는 작업자입니다.',
                    originalText: sourceText,
                    createdAt: Date.now()
                });
                missingCount++;
            });
        });

        if (candidates.length > 0) {
            setReviewCandidates(prev => [...prev, ...candidates]);
        }

        return { ledgerCount: candidates.length, totalUnknowns, missingCount, cancelCount };
    }, [createCandidateId, findLedgerBySiteIndex, findReviewRowIndex, findSiteByAnalyzedName, findWorkerByAnalyzedName, hasCancelKeyword, ledgers, normalizeLookupText, normalizeSiteId, sites, teams]);

    const buildKakaoSnapshotLedgers = useCallback((analyzedReports: AnalyzedDailyReport[]) => {
        const ledgerBySiteKey = new Map<string, Ledger>();
        let totalUnknowns = 0;

        analyzedReports.forEach((report, reportIndex) => {
            const reportWorkers = Array.isArray(report.workers)
                ? report.workers.filter(w => normalizeLookupText(w?.name))
                : [];
            if (reportWorkers.length === 0) return;

            const site = findSiteByAnalyzedName(report.siteName);
            const siteId = normalizeSiteId(site?.id);
            const siteName = site?.name || report.siteName || '';
            const siteKey = siteId || normalizeLookupText(siteName) || `unknown-site-${reportIndex}`;
            const aggregatedContent = report.workContent
                || Array.from(new Set(reportWorkers.map(w => w.workContent).filter(Boolean))).join(', ');

            if (!ledgerBySiteKey.has(siteKey)) {
                ledgerBySiteKey.set(siteKey, {
                    id: Date.now().toString() + Math.random(),
                    siteId,
                    rows: [],
                    description: aggregatedContent,
                    responsibleTeamId: normalizeSiteId(site?.responsibleTeamId),
                    responsibleTeamName: String(site?.responsibleTeamName ?? '').trim()
                });
            }

            const ledger = ledgerBySiteKey.get(siteKey)!;
            if (aggregatedContent && !ledger.description.includes(aggregatedContent)) {
                ledger.description = ledger.description ? `${ledger.description}, ${aggregatedContent}` : aggregatedContent;
            }

            reportWorkers.forEach((analyzedWorker) => {
                const worker = findWorkerByAnalyzedName(analyzedWorker.name);
                if (!worker) totalUnknowns += 1;

                const matchedTeam = worker?.teamId ? teams.find(t => t.id === worker.teamId) : undefined;
                const analyzedManDay = Number(analyzedWorker.manDay);
                const manDay = Number.isFinite(analyzedManDay) && analyzedManDay > 0 ? analyzedManDay : 1;
                const workerWorkContent = analyzedWorker.workContent || aggregatedContent || '';
                const workerTeamName = matchedTeam?.name || worker?.teamName || analyzedWorker.teamName || report.teamName || '';

                ledger.rows.push({
                    id: Math.random().toString(36).substr(2, 9),
                    teamId: worker?.teamId || '',
                    teamName: workerTeamName,
                    workerId: worker?.id || '',
                    name: worker?.name || analyzedWorker.name,
                    manDay,
                    unitPrice: worker?.unitPrice ?? 0,
                    payType: worker ? resolveWorkerSalaryType(worker) : '',
                    role: analyzedWorker.role || worker?.role || '작업자',
                    description: workerWorkContent,
                    workerTeamId: worker?.teamId || '',
                    workerTeamName
                });
            });
        });

        const snapshotLedgers = Array.from(ledgerBySiteKey.values()).map(ledger => {
            const rows = ledger.rows.map(row => ({ ...row }));
            const needed = 20 - rows.length;
            if (needed > 0) rows.push(...createEmptyRows(needed));
            else rows.push(...createEmptyRows(5));
            return { ...ledger, rows };
        });

        return { ledgers: snapshotLedgers, totalUnknowns };
    }, [createEmptyRows, findSiteByAnalyzedName, findWorkerByAnalyzedName, normalizeLookupText, normalizeSiteId, teams]);

    const appendKakaoOriginalLedgers = useCallback((analyzedReports: AnalyzedDailyReport[]) => {
        const { ledgers: analyzedLedgers, totalUnknowns } = buildKakaoSnapshotLedgers(analyzedReports);

        if (analyzedLedgers.length > 0) {
            setKakaoSnapshot(cloneLedgers(analyzedLedgers));
            setReviewCandidates([]);
            setLedgers(prev => {
                const isInitialEmpty = prev.length === 0 || (prev.length === 1 && !prev[0].siteId && prev[0].rows.every(row => !row.name.trim()));
                return isInitialEmpty ? cloneLedgers(analyzedLedgers) : [...prev, ...cloneLedgers(analyzedLedgers)];
            });
        }

        return {
            ledgerCount: analyzedLedgers.length,
            totalUnknowns,
            workerCount: countLedgerWorkers(analyzedLedgers)
        };
    }, [buildKakaoSnapshotLedgers, cloneLedgers, countLedgerWorkers]);

    const appendComparedKakaoCandidates = useCallback((analyzedReports: AnalyzedDailyReport[], sourceText = '') => {
        const { ledgers: nextKakaoSnapshot, totalUnknowns } = buildKakaoSnapshotLedgers(analyzedReports);
        setKakaoSnapshot(nextKakaoSnapshot);

        const candidates: ReviewCandidate[] = [];
        const reportedSiteKeys = new Set<string>();
        const cancelSiteKeys = new Set<string>();
        let missingCount = 0;
        let cancelCount = 0;

        const findSiteName = (siteId: string, fallbackName = '') => {
            const site = sites.find(candidate => normalizeSiteId(candidate.id) === normalizeSiteId(siteId));
            return site?.name || fallbackName;
        };

        const getLedgerSiteKey = (ledger: Ledger, fallbackName = '') => {
            return normalizeSiteId(ledger.siteId) || normalizeLookupText(findSiteName(ledger.siteId, fallbackName));
        };

        const getMatchedRow = (sourceLedgers: Ledger[], siteId: string, siteName: string, targetRow: GridRow): GridRow | undefined => {
            const ledgerIndex = findLedgerBySiteIndex(sourceLedgers, siteId, siteName);
            if (ledgerIndex < 0) return undefined;
            const rowIndex = findReviewRowIndex(sourceLedgers[ledgerIndex].rows, targetRow);
            return rowIndex >= 0 ? sourceLedgers[ledgerIndex].rows[rowIndex] : undefined;
        };

        const rowDetail = (label: string, row?: GridRow) => {
            if (!row || !row.name.trim()) return `${label}: 없음`;
            return `${label}: ${row.name} ${Number(row.manDay || 0)}공수`;
        };

        analyzedReports.forEach((report) => {
            const reportWorkers = Array.isArray(report.workers)
                ? report.workers.filter(w => normalizeLookupText(w?.name))
                : [];
            if (reportWorkers.length > 0) return;

            const site = findSiteByAnalyzedName(report.siteName);
            const siteId = normalizeSiteId(site?.id);
            const siteName = site?.name || report.siteName || '';
            const siteKey = siteId || normalizeLookupText(siteName);
            if (!siteKey || !hasCancelKeyword(`${report.siteName || ''} ${report.workContent || ''} ${sourceText}`)) return;

            reportedSiteKeys.add(siteKey);
            cancelSiteKeys.add(siteKey);
            candidates.push({
                id: createCandidateId('kakao'),
                source: 'kakao',
                action: 'site-cancel',
                status: 'pending',
                confidence: site ? 'medium' : 'low',
                siteId,
                siteName,
                responsibleTeamId: normalizeSiteId(site?.responsibleTeamId),
                responsibleTeamName: String(site?.responsibleTeamName ?? '').trim(),
                summary: `${siteName || '현장 미확인'} 데마 의심`,
                detail: report.workContent || sourceText,
                originalText: sourceText,
                createdAt: Date.now()
            });
            cancelCount += 1;
        });

        nextKakaoSnapshot.forEach((kakaoLedger) => {
            const siteName = findSiteName(kakaoLedger.siteId);
            const siteKey = getLedgerSiteKey(kakaoLedger, siteName);
            if (siteKey) reportedSiteKeys.add(siteKey);

            kakaoLedger.rows.forEach((kakaoRow) => {
                if (!kakaoRow.name.trim()) return;

                const currentRow = getMatchedRow(ledgers, kakaoLedger.siteId, siteName, kakaoRow);
                const scheduleRow = getMatchedRow(scheduleSnapshot, kakaoLedger.siteId, siteName, kakaoRow);
                const currentManDay = Number(currentRow?.manDay || 0);
                const kakaoManDay = Number(kakaoRow.manDay || 0);
                const scheduleManDay = Number(scheduleRow?.manDay || 0);
                const manDayChanged = Boolean(currentRow) && Math.abs(currentManDay - kakaoManDay) > 0.001;
                const manualChanged = Boolean(currentRow && scheduleRow) && Math.abs(currentManDay - scheduleManDay) > 0.001;
                const needsWorkerMatch = Boolean(currentRow && !currentRow.workerId && kakaoRow.workerId);
                const confidence: ReviewCandidateConfidence = kakaoLedger.siteId && kakaoRow.workerId ? 'high' : kakaoRow.workerId ? 'medium' : 'low';

                if (!currentRow) {
                    candidates.push({
                        id: createCandidateId('kakao'),
                        source: 'kakao',
                        action: 'add-worker',
                        status: 'pending',
                        confidence,
                        siteId: kakaoLedger.siteId,
                        siteName,
                        responsibleTeamId: kakaoLedger.responsibleTeamId,
                        responsibleTeamName: kakaoLedger.responsibleTeamName,
                        row: kakaoRow,
                        summary: `${kakaoRow.name} 카톡 추가 작업자`,
                        detail: [rowDetail('일정', scheduleRow), rowDetail('현재', currentRow), rowDetail('카톡', kakaoRow)].join(' / '),
                        originalText: sourceText,
                        createdAt: Date.now()
                    });
                    return;
                }

                if (manDayChanged || needsWorkerMatch) {
                    const detailParts = [rowDetail('일정', scheduleRow), rowDetail('현재', currentRow), rowDetail('카톡', kakaoRow)];
                    if (manualChanged) detailParts.push('현재 입력값이 일정과 달라 수동 수정 가능성이 있습니다.');

                    candidates.push({
                        id: createCandidateId('kakao'),
                        source: 'kakao',
                        action: 'update-worker',
                        status: 'pending',
                        confidence,
                        siteId: kakaoLedger.siteId,
                        siteName,
                        responsibleTeamId: kakaoLedger.responsibleTeamId,
                        responsibleTeamName: kakaoLedger.responsibleTeamName,
                        row: kakaoRow,
                        originalRow: currentRow,
                        summary: manDayChanged ? `${kakaoRow.name} 공수 차이` : `${kakaoRow.name} 작업자 정보 보완`,
                        detail: detailParts.join(' / '),
                        originalText: sourceText,
                        createdAt: Date.now()
                    });
                }
            });
        });

        ledgers.forEach((currentLedger) => {
            const siteName = findSiteName(currentLedger.siteId);
            const siteKey = getLedgerSiteKey(currentLedger, siteName);
            if (!siteKey || !reportedSiteKeys.has(siteKey) || cancelSiteKeys.has(siteKey)) return;

            const kakaoLedgerIndex = findLedgerBySiteIndex(nextKakaoSnapshot, currentLedger.siteId, siteName);
            const kakaoLedger = kakaoLedgerIndex >= 0 ? nextKakaoSnapshot[kakaoLedgerIndex] : undefined;
            if (!kakaoLedger) return;

            currentLedger.rows.forEach((currentRow) => {
                if (!currentRow.name.trim()) return;
                const kakaoRowIndex = findReviewRowIndex(kakaoLedger.rows, currentRow);
                if (kakaoRowIndex >= 0) return;

                const scheduleRow = getMatchedRow(scheduleSnapshot, currentLedger.siteId, siteName, currentRow);
                candidates.push({
                    id: createCandidateId('kakao'),
                    source: 'kakao',
                    action: 'exclude-worker',
                    status: 'pending',
                    confidence: 'low',
                    siteId: normalizeSiteId(currentLedger.siteId),
                    siteName,
                    responsibleTeamId: currentLedger.responsibleTeamId,
                    responsibleTeamName: currentLedger.responsibleTeamName,
                    originalRow: currentRow,
                    summary: `${currentRow.name} 카톡 미확인`,
                    detail: [rowDetail('일정', scheduleRow), rowDetail('현재', currentRow), '카톡: 없음'].join(' / '),
                    originalText: sourceText,
                    createdAt: Date.now()
                });
                missingCount += 1;
            });
        });

        setReviewCandidates(candidates);
        return {
            ledgerCount: candidates.length,
            totalUnknowns,
            missingCount,
            cancelCount,
            kakaoWorkerCount: countLedgerWorkers(nextKakaoSnapshot)
        };
    }, [buildKakaoSnapshotLedgers, countLedgerWorkers, createCandidateId, findLedgerBySiteIndex, findReviewRowIndex, findSiteByAnalyzedName, hasCancelKeyword, ledgers, normalizeLookupText, normalizeSiteId, scheduleSnapshot, sites]);

    const appendKakaoCancelTextCandidates = useCallback((text: string): number => {
        if (!hasCancelKeyword(text)) return 0;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const candidates: ReviewCandidate[] = [];

        reportInputSites.forEach(site => {
            const siteName = String(site.name ?? '').trim();
            const siteKey = normalizeLookupText(siteName);
            if (!siteKey) return;
            const matchedLine = lines.find(line => hasCancelKeyword(line) && normalizeLookupText(line).includes(siteKey));
            if (!matchedLine) return;

            candidates.push({
                id: createCandidateId('kakao'),
                source: 'kakao',
                action: 'site-cancel',
                status: 'pending',
                confidence: 'medium',
                siteId: normalizeSiteId(site.id),
                siteName,
                responsibleTeamId: normalizeSiteId(site.responsibleTeamId),
                responsibleTeamName: String(site.responsibleTeamName ?? '').trim(),
                summary: `${siteName} 데마 후보`,
                detail: matchedLine,
                originalText: text,
                createdAt: Date.now()
            });
        });

        if (candidates.length > 0) {
            setReviewCandidates(prev => [...prev, ...candidates]);
        }
        return candidates.length;
    }, [createCandidateId, hasCancelKeyword, normalizeLookupText, normalizeSiteId, reportInputSites]);

    const appendScheduleAssignments = useCallback((assignments: DispatchAssignment[]) => {
        const siteById = new Map<string, Site>();
        reportInputSites.forEach(site => {
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
        let supportTeamPlaceholderCount = 0;

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
            const supportTeamOptions = [
                ...(Array.isArray(assignment.supportTeams) ? assignment.supportTeams : []),
                ...(Array.isArray(assignment.supportTeamIds) ? assignment.supportTeamIds : [])
                    .map(teamId => {
                        const matchedTeam = teamById.get(normalizeSiteId(teamId));
                        return matchedTeam ? { id: normalizeSiteId(matchedTeam.id), name: matchedTeam.name, color: '' } : null;
                    })
                    .filter((team): team is { id: string; name: string; color: string } => Boolean(team))
            ];
            const supportTeamsForInput = new Map<string, { id: string; name: string }>();
            supportTeamOptions.forEach(team => {
                const supportTeamId = normalizeSiteId(team.id);
                const supportTeamName = String(team.name ?? '').trim();
                const supportTeamKey = supportTeamId || normalizeLookupText(supportTeamName);
                if (supportTeamKey && supportTeamName) {
                    supportTeamsForInput.set(supportTeamKey, { id: supportTeamId, name: supportTeamName });
                }
            });

            if (workerIds.length === 0 && supportTeamsForInput.size === 0) {
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

            supportTeamsForInput.forEach((supportTeam, supportTeamKey) => {
                const workerKey = `support-team:${supportTeamKey}`;
                if (group.workerKeys.has(workerKey)) {
                    duplicateWorkerCount += 1;
                    return;
                }
                group.workerKeys.add(workerKey);

                group.rows.push({
                    id: Math.random().toString(36).substr(2, 9),
                    teamId: supportTeam.id,
                    teamName: supportTeam.name,
                    workerId: '',
                    name: `[지원팀] ${supportTeam.name} 입력`,
                    manDay: 1.0,
                    unitPrice: null,
                    payType: '',
                    role: '지원팀입력',
                    description: note || '지원팀 실제 작업자 입력 필요',
                    workerTeamId: supportTeam.id,
                    workerTeamName: supportTeam.name
                });
                totalWorkers += 1;
                supportTeamPlaceholderCount += 1;
            });
        });

        const scheduleLedgers: Ledger[] = Array.from(scheduleGroups.values()).map((group) => {
            const site = reportInputSites.find((candidate) => normalizeSiteId(candidate.id) === normalizeSiteId(group.siteId));
            const rows = group.rows.map(row => ({ ...row }));
            const needed = 20 - rows.length;
            if (needed > 0) rows.push(...createEmptyRows(needed));
            else rows.push(...createEmptyRows(5));

            return {
                id: Date.now().toString() + Math.random(),
                siteId: group.siteId,
                rows,
                description: group.descriptionParts.join(', '),
                responsibleTeamId: normalizeSiteId(site?.responsibleTeamId),
                responsibleTeamName: String(site?.responsibleTeamName ?? '').trim()
            };
        });

        if (scheduleLedgers.length > 0) {
            setScheduleSnapshot(cloneLedgers(scheduleLedgers));
            setKakaoSnapshot([]);
            setReviewCandidates([]);
            setLedgers(prev => {
                const isInitialEmpty = prev.length === 0 || (prev.length === 1 && !prev[0].siteId && prev[0].rows.every(row => !row.name.trim()));
                return isInitialEmpty ? cloneLedgers(scheduleLedgers) : [...prev, ...cloneLedgers(scheduleLedgers)];
            });
        }

        return {
            ledgerCount: scheduleLedgers.length,
            totalWorkers,
            totalUnknowns,
            skippedSiteCount,
            emptyScheduleCount,
            duplicateWorkerCount,
            supportTeamPlaceholderCount
        };
    }, [cloneLedgers, createEmptyRows, findSiteByAnalyzedName, getScheduleWorkerIds, normalizeLookupText, normalizeSiteId, reportInputSites, teams, workers]);

    const addLedger = useCallback(() => {
        setLedgers(prev => [...prev, { id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }]);
    }, []);

    const removeLedger = useCallback((id: string) => { setLedgers(prev => prev.filter(l => l.id !== id)); }, []);
    const removeLastLedger = useCallback(() => { setLedgers(prev => prev.length > 0 ? prev.slice(0, -1) : prev); }, []);
    const updateLedger = useCallback((id: string, updates: Partial<Ledger>) => { setLedgers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l)); }, []);
    const handleReset = useCallback(async () => {
        const result = await Swal.fire({ title: '작성 내용 초기화', text: '현재 입력된 모든 내용을 삭제하고 새로 시작하시겠습니까?', icon: 'warning', showCancelButton: true, confirmButtonText: '초기화', cancelButtonText: '취소', confirmButtonColor: '#d33' });
        if (result.isConfirmed) {
            const nextLedgers = [{ id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }];
            clearTempData({
                ledgers: nextLedgers,
                date,
                reviewCandidates: [],
                scheduleSnapshot: [],
                kakaoSnapshot: [],
            });
            setLedgers(nextLedgers);
            setReviewCandidates([]);
            setScheduleSnapshot([]);
            setKakaoSnapshot([]);
        }
    }, [clearTempData, createEmptyRows, date]);

    const handleDeleteTempData = useCallback(async () => {
        const result = await Swal.fire({
            title: '임시데이터 삭제',
            text: '임시 저장된 데이터와 현재 입력 내용을 삭제하고 새로 시작하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소',
            confirmButtonColor: '#d33'
        });
        if (!result.isConfirmed) return;

        const nextLedgers = [{ id: Date.now().toString(), siteId: '', rows: createEmptyRows(20), description: '' }];
        clearTempData({
            ledgers: nextLedgers,
            date,
            reviewCandidates: [],
            scheduleSnapshot: [],
            kakaoSnapshot: [],
        });
        setLedgers(nextLedgers);
        setReviewCandidates([]);
        setScheduleSnapshot([]);
        setKakaoSnapshot([]);
    }, [clearTempData, createEmptyRows, date]);
    const addRowToLedger = useCallback((id: string) => {
        setLedgers(prev => prev.map(l => l.id !== id ? l : { ...l, rows: [...l.rows, ...createEmptyRows(5)] }));
    }, []);

    const handleSaveAll = async () => {
        if (loading) return;
        if (validationSummary.missingSites > 0) { Swal.fire('Warning', '현장이 선택되지 않은 장부가 있습니다.', 'warning'); return; }
        setLoading(true);
        try {
            const allReports: Omit<DailyReport, 'id'>[] = [];
            const involvedTeamIds = new Set<string>();
            let skippedGroupCount = 0;
            for (const ledger of ledgers) {
                const normalizedLedgerSiteId = normalizeSiteId(ledger.siteId);
                if (!normalizedLedgerSiteId) continue;
                const validRows = ledger.rows.filter(r => r.name.trim() !== '' && r.role !== '지원팀입력');
                if (validRows.length === 0) continue;
                const site = sites.find((s) => normalizeSiteId(s.id) === normalizedLedgerSiteId);
                const siteSnapshot = buildDailyReportSiteSnapshot({
                    site,
                    siteId: normalizedLedgerSiteId,
                    teams,
                    companies,
                    fallback: {
                        siteId: normalizedLedgerSiteId,
                        responsibleTeamId: ledger.responsibleTeamId,
                        responsibleTeamName: ledger.responsibleTeamName,
                        siteManagerId: ledger.siteManagerId,
                        siteManagerName: ledger.siteManagerName,
                    },
                });
                const siteType = siteSnapshot.siteType;
                const paymentType = siteSnapshot.paymentType;
                const ledgerResponsibleTeamId = siteSnapshot.responsibleTeamId || normalizeSiteId(ledger.responsibleTeamId);
                const ledgerResponsibleTeamName = siteSnapshot.responsibleTeamName || String(ledger.responsibleTeamName || '').trim();
                const ledgerResponsibleTeam =
                    teams.find((t) => normalizeSiteId(t.id) === ledgerResponsibleTeamId) ||
                    teams.find((t) => String(t.name ?? '').trim() === ledgerResponsibleTeamName);
                const reportResponsibleTeamId = ledgerResponsibleTeamId || normalizeSiteId(ledgerResponsibleTeam?.id);
                const reportResponsibleTeamName = ledgerResponsibleTeamName || String(ledgerResponsibleTeam?.name ?? '').trim();
                const groups: { [key: string]: GridRow[] } = {};
                validRows.forEach(row => {
                    const key = reportResponsibleTeamId || normalizeSiteId(row.teamId) || 'no-team';
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(row);
                });
                for (const [teamKey, rows] of Object.entries(groups)) {
                    const realTeamId = teamKey === 'no-team' ? '' : normalizeSiteId(teamKey);
                    const fallbackTeamId = reportResponsibleTeamId || normalizeSiteId(rows[0]?.workerTeamId) || normalizeSiteId(rows[0]?.teamId);
                    const resolvedTeamId = realTeamId || fallbackTeamId;
                    const team = teams.find((t) => normalizeSiteId(t.id) === resolvedTeamId);
                    if (!resolvedTeamId) { skippedGroupCount += 1; continue; }
                    involvedTeamIds.add(resolvedTeamId);
                    const totalManDay = rows.reduce((sum, r) => sum + r.manDay, 0);
                    const reportWorkers = rows.map(r => {
                        const matchedWorker = workers.find(w => w.id === r.workerId);
                        const resolvedSalaryType = normalizeSalaryType(r.payType) || resolveWorkerSalaryType(matchedWorker);
                        const workerTeamId = normalizeSiteId(r.workerTeamId) || normalizeSiteId(r.teamId) || resolvedTeamId;
                        const workerTeam = teams.find((t) => normalizeSiteId(t.id) === workerTeamId);
                        if (workerTeamId) involvedTeamIds.add(workerTeamId);
                        return { salaryModel: resolvedSalaryType, payType: resolvedSalaryType, workerId: r.workerId || 'unknown', name: r.name, role: r.role, status: 'attendance' as const, manDay: r.manDay, workContent: r.description, teamId: workerTeamId, unitPrice: r.unitPrice ?? 0, siteType, paymentType, workerTeamId, workerTeamName: r.workerTeamName || r.teamName || workerTeam?.name || team?.name || reportResponsibleTeamName || '' };
                    });
                    const reportSnapshot = {
                        ...siteSnapshot,
                        responsibleTeamId: reportResponsibleTeamId || resolvedTeamId,
                        responsibleTeamName: reportResponsibleTeamName || team?.name || '',
                    };
                    allReports.push(applyDailyReportSiteSnapshotToReport({
                        date,
                        teamId: resolvedTeamId,
                        teamName: team?.name || reportResponsibleTeamName || rows[0]?.teamName || '',
                        siteId: normalizedLedgerSiteId,
                        siteName: site?.name || '',
                        writerId: currentUser?.uid || 'unknown',
                        workers: reportWorkers,
                        totalManDay,
                        responsibleTeamId: reportSnapshot.responsibleTeamId,
                        responsibleTeamName: reportSnapshot.responsibleTeamName,
                        workContent: ledger.description || '',
                        siteType,
                        paymentType,
                    }, reportSnapshot));
                }
            }
            if (allReports.length > 0) {
                await dailyReportService.overwriteReports(date, allReports, Array.from(involvedTeamIds));
                clearTempData({
                    ...stateRef.current,
                    reviewCandidates: [],
                    scheduleSnapshot: [],
                    kakaoSnapshot: [],
                });
                setReviewCandidates([]);
                setScheduleSnapshot([]);
                setKakaoSnapshot([]);
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
        supportTeamPlaceholderCount: number;
    }) => {
        if (result.ledgerCount === 0) {
            Swal.fire('Info', '입력할 수 있는 저장 일정이 없습니다.', 'info');
            return;
        }

        const details = [
            `${result.ledgerCount}개의 장부와 ${result.totalWorkers}개의 작업자/지원팀 항목이 입력되었습니다.`
        ];

        if (result.totalUnknowns > 0) details.push(`마스터에서 찾지 못한 작업자 ${result.totalUnknowns}명은 확인이 필요합니다.`);
        if (result.supportTeamPlaceholderCount > 0) details.push(`지원팀 ${result.supportTeamPlaceholderCount}건은 지원팀명으로 표시했습니다. 실제 투입 작업자 이름으로 바꿔 입력해주세요.`);
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

    const showReviewAnalysisResult = useCallback((candidateCount: number, totalUnknowns: number) => {
        if (candidateCount === 0) {
            Swal.fire('Info', '입력할 카톡 일보 데이터가 없습니다.', 'info');
            return;
        }

        let message = `${candidateCount}개의 카톡 장부가 입력창에 추가되었습니다.`;
        if (totalUnknowns > 0) {
            message += `\n미등록/오타 가능성이 있는 작업자 ${totalUnknowns}명이 있습니다. 빨간색 표시를 확인하세요.`;
        }
        Swal.fire('카톡 분석 완료', message, totalUnknowns > 0 ? 'warning' : 'success');
    }, []);

    const showReviewScheduleResult = useCallback((result: {
        ledgerCount: number;
        totalWorkers: number;
        totalUnknowns: number;
        skippedSiteCount: number;
        emptyScheduleCount: number;
        duplicateWorkerCount: number;
    }) => {
        if (result.ledgerCount === 0) {
            Swal.fire('Info', '검토할 일정 후보가 없습니다.', 'info');
            return;
        }

        const details = [
            `${result.ledgerCount}개의 일정 후보를 검토함에 추가했습니다.`,
            `작업자 ${result.totalWorkers}명`
        ];
        if (result.totalUnknowns > 0) details.push(`마스터에서 찾지 못한 작업자 ${result.totalUnknowns}명은 확인이 필요합니다.`);
        if (result.skippedSiteCount > 0) details.push(`현장을 식별하지 못한 일정 ${result.skippedSiteCount}건은 제외했습니다.`);
        if (result.emptyScheduleCount > 0) details.push(`작업자가 없는 일정 ${result.emptyScheduleCount}건은 후보로 만들지 않았습니다.`);
        if (result.duplicateWorkerCount > 0) details.push(`중복 배정 작업자 ${result.duplicateWorkerCount}건은 한 번만 후보로 만들었습니다.`);

        Swal.fire('일정 분석 완료', details.join('\n'), result.totalUnknowns > 0 || result.skippedSiteCount > 0 ? 'warning' : 'success');
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
            const result = appendKakaoOriginalLedgers(analyzedReports);
            showReviewAnalysisResult(result.ledgerCount, result.totalUnknowns);
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
            const result = appendKakaoOriginalLedgers(analyzedReports);
            showReviewAnalysisResult(result.ledgerCount, result.totalUnknowns);
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

    const hasWarnings = validationSummary.unknownWorkers > 0 || validationSummary.retiredWorkers > 0 || validationSummary.missingSites > 0;
    const pendingReviewCount = reviewCandidates.filter(item => item.status === 'pending').length;
    const safePendingReviewCount = reviewCandidates.filter(item =>
        item.status === 'pending' &&
        item.action === 'add-worker' &&
        item.confidence !== 'low'
    ).length;
    const scheduleSnapshotWorkerCount = useMemo(() => countLedgerWorkers(scheduleSnapshot), [countLedgerWorkers, scheduleSnapshot]);
    const kakaoSnapshotWorkerCount = useMemo(() => countLedgerWorkers(kakaoSnapshot), [countLedgerWorkers, kakaoSnapshot]);

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processKakaoImage(file); }}>
            {isDragging && (
                <div className="absolute inset-0 bg-yellow-400/80 z-[9998] flex items-center justify-center backdrop-blur-sm pointer-events-none" style={{ zIndex: 9998 }}>
                    <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
                        <FontAwesomeIcon icon={faComment} className="text-6xl text-yellow-500 mb-4" />
                        <h2 className="text-3xl font-bold text-slate-800">카톡 이미지 떨어뜨리기</h2>
                        <p className="text-xl text-slate-500 mt-2">AI가 자동으로 일보를 작성합니다!</p>
                    </div>
                </div>
            )}

            {isKakaoModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
                    style={{ zIndex: 9999 }}
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
                            <p className="text-xs text-orange-700">{validationSummary.missingSites > 0 && <span>• 현장 미지정: <b>{validationSummary.missingSites}</b>건 </span>}{validationSummary.unknownWorkers > 0 && <span>• 미등록 작업자: <b>{validationSummary.unknownWorkers}</b>명 </span>}{validationSummary.retiredWorkers > 0 && <span>• 퇴사자: <b>{validationSummary.retiredWorkers}</b>명 </span>}<span>(표시된 셀을 확인해주세요)</span></p>
                        </div>
                    </div>
                </div>
            )}

            {loadErrorMessage && (
                <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm font-bold text-red-700">
                    {loadErrorMessage}
                </div>
            )}

            <div className="sticky-toolbar-wrapper">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky-toolbar z-[20]">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
                            <input
                                type="date"
                                value={date}
                                onChange={handleDateInputChange}
                                onInput={handleDateInputChange}
                                disabled={loading || fetching}
                                aria-label="일보작성 기준 날짜"
                                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                            />
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
                            {scheduleSnapshotWorkerCount > 0 && (
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-1 rounded-full font-bold">일정원본 {scheduleSnapshotWorkerCount}명</span>
                            )}
                            {kakaoSnapshotWorkerCount > 0 && (
                                <span className="bg-yellow-50 text-yellow-700 text-[10px] px-2 py-1 rounded-full font-bold">카톡원본 {kakaoSnapshotWorkerCount}명</span>
                            )}
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
                    <button onClick={handleDeleteTempData} className="text-xs text-red-500 hover:text-red-700 underline">임시데이터 삭제</button>
                </div>
            )}

            {reviewCandidates.length > 0 && (
                <div className="mx-6 mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-black text-slate-900">일정/카톡 비교 검토함</span>
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">대기 {pendingReviewCount}</span>
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">전체 {reviewCandidates.length}</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">일정 원본, 현재 입력창, 카톡 원본을 비교한 차이입니다. 최종 저장 기준은 항상 현재 입력창입니다.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={applySafeReviewCandidates}
                                disabled={safePendingReviewCount === 0}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                            >
                                안전 추가만 전체 반영 {safePendingReviewCount > 0 ? `(${safePendingReviewCount})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={clearReviewedCandidates}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                            >
                                처리완료 숨기기
                            </button>
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {reviewCandidates.map(candidate => {
                            const row = candidate.row || candidate.originalRow;
                            const isPending = candidate.status === 'pending';
                            const statusLabel = candidate.status === 'applied' ? '반영됨' : candidate.status === 'ignored' ? '무시됨' : '대기';
                            const statusClass = candidate.status === 'applied'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : candidate.status === 'ignored'
                                    ? 'bg-slate-100 text-slate-500 ring-slate-200'
                                    : candidate.confidence === 'low'
                                        ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                        : 'bg-blue-50 text-blue-700 ring-blue-200';

                            return (
                                <div key={candidate.id} className={`grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto] ${candidate.status !== 'pending' ? 'opacity-70' : ''}`}>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700">{REVIEW_SOURCE_LABELS[candidate.source]}</span>
                                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{REVIEW_ACTION_LABELS[candidate.action]}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusClass}`}>{statusLabel}</span>
                                            <span className="text-[11px] font-semibold text-slate-400">신뢰도 {REVIEW_CONFIDENCE_LABELS[candidate.confidence]}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                            <span className="font-black text-slate-900">{candidate.summary}</span>
                                            <span className="text-xs font-semibold text-slate-500">{candidate.siteName || '현장 미확인'}</span>
                                            {row?.manDay !== undefined && candidate.action !== 'site-cancel' && (
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-700">{row.manDay}공수</span>
                                            )}
                                            {row?.teamName && <span className="text-xs font-semibold text-slate-500">{row.teamName}</span>}
                                        </div>
                                        {candidate.detail && (
                                            <p className="mt-1 truncate text-xs font-medium text-slate-500">{candidate.detail}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        {isPending && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => applyReviewCandidate(candidate.id)}
                                                    className={`rounded-lg px-3 py-2 text-xs font-black text-white shadow-sm transition ${
                                                        candidate.action === 'exclude-worker' || candidate.action === 'site-cancel'
                                                            ? 'bg-amber-600 hover:bg-amber-700'
                                                            : 'bg-blue-600 hover:bg-blue-700'
                                                    }`}
                                                >
                                                    {candidate.action === 'exclude-worker' ? '미투입 반영' : candidate.action === 'site-cancel' ? '데마 처리' : '반영'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => ignoreReviewCandidate(candidate.id)}
                                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                                                >
                                                    무시
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
                            companies={companies}
                            workerMap={workerMap}
                            retiredWorkerMap={retiredWorkerMap}
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
                .handsontable-container .handsontable td.retired-worker-cell { background-color: #fed7aa !important; color: #7c2d12 !important; font-weight: bold; border: 1px solid #f97316 !important; }
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
