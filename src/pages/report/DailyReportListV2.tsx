import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faSearch, faSortAmountDown, faSortAmountUp, faPenToSquare, faTrash, faSave, faThumbtack } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService, DailyReportWorker, DailyReportWorkerRow } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { confirm, toast } from '../../utils/swal';

interface DailyReportListV2Props {
    initialDate?: string;
}

const formatYmd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('ko-KR').format(value);
};

const compareKo = (a: string, b: string): number => {
    return a.localeCompare(b, 'ko');
};

type RowDraft = {
    workerId?: string; // New Worker ID if changed
    workerName?: string;
    workerTeamName?: string;
    salaryModel: string;
    manDay: string;
    unitPrice: string;
    workContent: string;
    siteType: string;
    paymentType: string;
};

const DailyReportListV2: React.FC<DailyReportListV2Props> = ({ initialDate }) => {
    const todayStr = formatYmd(new Date());

    const [rows, setRows] = useState<DailyReportWorkerRow[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(initialDate || todayStr);
    const [endDate, setEndDate] = useState(initialDate || todayStr);
    const [selectedTeamId, setSelectedTeamId] = useState(''); // 해당팀 (Report Team)
    const [selectedWorkerTeamId, setSelectedWorkerTeamId] = useState(''); // 소속팀 (Worker Team)
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');
    const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('desc');

    const [sortMode, setSortMode] = useState<'date' | 'name' | 'site'>('date');
    const [nameSortOrder, setNameSortOrder] = useState<'asc' | 'desc'>('asc');
    const [siteSortOrder, setSiteSortOrder] = useState<'asc' | 'desc'>('asc');

    const [isEditMode, setIsEditMode] = useState(false);
    const [isFixed, setIsFixed] = useState(false); // 가로 틀고정 상태

    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

    const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
    const [rowSavingKeys, setRowSavingKeys] = useState<Set<string>>(new Set());

    const [bulkManDay, setBulkManDay] = useState('');
    const [bulkUnitPrice, setBulkUnitPrice] = useState('');
    const [bulkSalaryModel, setBulkSalaryModel] = useState('');
    const [bulkWorkContent, setBulkWorkContent] = useState('');
    const [bulkSiteType, setBulkSiteType] = useState('');
    const [bulkPaymentType, setBulkPaymentType] = useState('');
    const [bulkWorkerTeamName, setBulkWorkerTeamName] = useState('');

    useEffect(() => {
        (async () => {
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
                console.error('[DailyReportListV2] Failed to fetch initial data', error);
            }
        })();
    }, []);

    const fetchRows = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            // Client-side filtering strategy: Fetch ALL for range
            const data = await dailyReportService.getReportWorkerRowsByRange({
                startDate,
                endDate
            });
            setRows(data);
        } catch (error) {
            console.error('[DailyReportListV2] Failed to fetch rows', error);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchRows();
    }, [fetchRows]);

    const getRowKey = useCallback((r: DailyReportWorkerRow) => {
        return `${String(r.reportId)}::${String(r.workerId)} `;
    }, []);

    const rowByKey = useMemo(() => {
        const map = new Map<string, DailyReportWorkerRow>();
        for (const r of rows) {
            map.set(getRowKey(r), r);
        }
        return map;
    }, [rows, getRowKey]);

    const teamCanonicalIdMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const t of teams) {
            const id = t.id ? String(t.id) : '';
            const legacyId = t.legacyId ? String(t.legacyId) : '';
            if (id) map.set(id, id);
            if (legacyId && id) map.set(legacyId, id);
            if (legacyId && !map.has(legacyId)) map.set(legacyId, legacyId);
        }
        return map;
    }, [teams]);

    const siteCanonicalIdMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of sites) {
            const id = s.id ? String(s.id) : '';
            const legacyId = s.legacyId ? String(s.legacyId) : '';
            if (id) map.set(id, id);
            if (legacyId && id) map.set(legacyId, id);
            if (legacyId && !map.has(legacyId)) map.set(legacyId, legacyId);
        }
        return map;
    }, [sites]);

    const normalizeTeamId = useCallback((id?: string | null) => {
        const raw = id ? String(id) : '';
        if (!raw) return '';
        return teamCanonicalIdMap.get(raw) ?? raw;
    }, [teamCanonicalIdMap]);

    const normalizeSiteId = useCallback((id?: string | null) => {
        const raw = id ? String(id) : '';
        if (!raw) return '';
        return siteCanonicalIdMap.get(raw) ?? raw;
    }, [siteCanonicalIdMap]);

    const getFiltered = useCallback((criteria: { teamId?: string; siteId?: string; workerTeamId?: string }) => {
        const wantTeam = criteria.teamId ? normalizeTeamId(criteria.teamId) : '';
        const wantSite = criteria.siteId ? normalizeSiteId(criteria.siteId) : '';
        const wantWorkerTeam = criteria.workerTeamId ? normalizeTeamId(criteria.workerTeamId) : '';

        return rows.filter(r => {
            if (wantTeam && normalizeTeamId(r.teamId) !== wantTeam) return false;
            if (wantSite && normalizeSiteId(r.siteId) !== wantSite) return false;
            if (wantWorkerTeam && normalizeTeamId(r.workerTeamId) !== wantWorkerTeam) return false;
            return true;
        });
    }, [rows, normalizeTeamId, normalizeSiteId]);

    // 1. Available Sites (Filtered by Report Team ONLY) - Worker Team selection does NOT constrain sites
    const availableSites = useMemo(() => {
        const filtered = getFiltered({ teamId: selectedTeamId });
        const siteIds = new Set(filtered.map(r => r.siteId ? String(r.siteId) : null).filter((id): id is string => !!id));
        return sites
            .filter(s => siteIds.has(String(s.id)) || (s.legacyId ? siteIds.has(String(s.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, sites, selectedTeamId]);

    // 2. Available Report Teams (Filtered by Site ONLY) - Worker Team selection does NOT constrain report teams
    const availableReportTeams = useMemo(() => {
        const filtered = getFiltered({ siteId: selectedSiteId });
        const teamIds = new Set(filtered.map(r => r.teamId ? String(r.teamId) : null).filter((id): id is string => !!id));
        return teams
            .filter(t => teamIds.has(String(t.id)) || (t.legacyId ? teamIds.has(String(t.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, teams, selectedSiteId]);

    // 3. Available Worker Teams (Filtered by Site & Report Team)
    const availableWorkerTeams = useMemo(() => {
        const filtered = getFiltered({ siteId: selectedSiteId, teamId: selectedTeamId });
        const teamIds = new Set(filtered.map(r => r.workerTeamId ? String(r.workerTeamId) : null).filter((id): id is string => !!id));
        return teams
            .filter(t => teamIds.has(String(t.id)) || (t.legacyId ? teamIds.has(String(t.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, teams, selectedSiteId, selectedTeamId]);

    // 4. Final Display Rows (Filtered by ALL selection + Search)
    const filteredRows = useMemo(() => {
        let result = getFiltered({
            siteId: selectedSiteId,
            teamId: selectedTeamId,
            workerTeamId: selectedWorkerTeamId
        });

        // Text Search (Worker Name Only)
        const q = workerSearch.trim().toLowerCase();
        if (q) {
            result = result.filter((r) => {
                const name = (r.workerName ?? '').toLowerCase();
                return name.includes(q);
            });
        }

        return result;
    }, [getFiltered, selectedSiteId, selectedTeamId, selectedWorkerTeamId, workerSearch]);

    const sortedRows = useMemo(() => {
        const copied = [...filteredRows];
        copied.sort((a, b) => {
            if (sortMode === 'name') {
                const nameDiff = nameSortOrder === 'asc'
                    ? compareKo(a.workerName ?? '', b.workerName ?? '')
                    : compareKo(b.workerName ?? '', a.workerName ?? '');
                if (nameDiff !== 0) return nameDiff;

                const dateDiff = (b.date ?? '').localeCompare(a.date ?? '', 'en');
                if (dateDiff !== 0) return dateDiff;

                const teamDiff = compareKo(a.teamName ?? '', b.teamName ?? '');
                if (teamDiff !== 0) return teamDiff;

                return compareKo(a.siteName ?? '', b.siteName ?? '');
            }

            if (sortMode === 'site') {
                const siteDiff = siteSortOrder === 'asc'
                    ? compareKo(a.siteName ?? '', b.siteName ?? '')
                    : compareKo(b.siteName ?? '', a.siteName ?? '');
                if (siteDiff !== 0) return siteDiff;

                const dateDiff = (b.date ?? '').localeCompare(a.date ?? '', 'en');
                if (dateDiff !== 0) return dateDiff;

                const teamDiff = compareKo(a.teamName ?? '', b.teamName ?? '');
                if (teamDiff !== 0) return teamDiff;

                return compareKo(a.workerName ?? '', b.workerName ?? '');
            }

            const diff = dateSortOrder === 'asc'
                ? (a.date ?? '').localeCompare(b.date ?? '', 'en')
                : (b.date ?? '').localeCompare(a.date ?? '', 'en');
            if (diff !== 0) return diff;
            const team = compareKo(a.teamName ?? '', b.teamName ?? '');
            if (team !== 0) return team;
            return compareKo(a.workerName ?? '', b.workerName ?? '');
        });
        return copied;
    }, [filteredRows, dateSortOrder, sortMode, nameSortOrder, siteSortOrder]);

    const visibleRowKeys = useMemo(() => {
        return sortedRows.map(getRowKey);
    }, [sortedRows, getRowKey]);

    useEffect(() => {
        setSelectedRowKeys((prev) => {
            if (prev.size === 0) return prev;
            const visibleSet = new Set(visibleRowKeys);
            const nextKeys = Array.from(prev).filter((k) => visibleSet.has(k));
            if (nextKeys.length === prev.size) return prev;
            return new Set(nextKeys);
        });
    }, [visibleRowKeys]);

    const isAllSelected = useMemo(() => {
        return visibleRowKeys.length > 0 && visibleRowKeys.every(k => selectedRowKeys.has(k));
    }, [visibleRowKeys, selectedRowKeys]);

    const toggleSelectAll = useCallback(() => {
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            const allSelected = visibleRowKeys.length > 0 && visibleRowKeys.every(k => next.has(k));
            if (allSelected) {
                visibleRowKeys.forEach(k => next.delete(k));
                return next;
            }

            visibleRowKeys.forEach(k => next.add(k));
            return next;
        });
    }, [visibleRowKeys]);

    const toggleSelectRow = useCallback((rowKey: string) => {
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const handleToggleEditMode = () => {
        setIsEditMode((prev) => {
            const next = !prev;
            if (!next) {
                setSelectedRowKeys(new Set());
                setIsBulkEditOpen(false);
                setRowDrafts({});
                setRowSavingKeys(new Set());
            }
            return next;
        });
    };

    const getRowInitialDraft = useCallback((r: DailyReportWorkerRow): RowDraft => {
        const baseManDay = Number.isFinite(r.manDay) ? String(r.manDay) : '0';
        const baseUnitPrice = Number.isFinite(r.unitPrice) ? String(r.unitPrice) : '0';
        return {
            workerName: r.workerName ?? '',
            workerTeamName: r.workerTeamName ?? '',
            salaryModel: String(r.salaryModel ?? r.payType ?? ''),
            manDay: baseManDay,
            unitPrice: baseUnitPrice,
            workContent: String(r.workContent ?? ''),
            siteType: String(r.siteType ?? ''),
            paymentType: String(r.paymentType ?? '')
        };
    }, []);

    const isRowDirty = useCallback((original: DailyReportWorkerRow, draft?: RowDraft) => {
        if (!draft) return false;

        // 1. Check Worker Change
        if (draft.workerId && String(draft.workerId) !== String(original.workerId)) return true;

        // 2. Check Name Change (Typo fix)
        if (draft.workerName !== undefined && draft.workerName !== original.workerName) return true;

        if (draft.salaryModel !== String(original.salaryModel ?? original.payType ?? '')) return true;
        if (Number(draft.manDay) !== (Number.isFinite(original.manDay) ? original.manDay : 0)) return true;
        if (Number(draft.unitPrice) !== (Number.isFinite(original.unitPrice) ? original.unitPrice : 0)) return true;
        if (draft.workContent !== (original.workContent ?? '')) return true;
        if (draft.siteType !== (original.siteType ?? '')) return true;
        if (draft.paymentType !== (original.paymentType ?? '')) return true;

        // Check workerTeamName change
        if (draft.workerTeamName !== undefined && draft.workerTeamName !== (original.workerTeamName ?? '')) return true;

        return false;
    }, []);

    const setRowDraft = useCallback((r: DailyReportWorkerRow, changes: Partial<RowDraft>) => {
        const key = getRowKey(r);
        setRowDrafts(prev => {
            const current = prev[key] || {
                workerName: r.workerName ?? '',
                workerTeamName: r.workerTeamName ?? '',
                salaryModel: String(r.salaryModel ?? r.payType ?? ''),
                manDay: String(Number.isFinite(r.manDay) ? r.manDay : 0),
                unitPrice: String(Number.isFinite(r.unitPrice) ? r.unitPrice : 0),
                workContent: r.workContent ?? '',
                siteType: r.siteType ?? '',
                paymentType: r.paymentType ?? ''
            };
            return {
                ...prev,
                [key]: { ...current, ...changes }
            };
        });
    }, [getRowKey]);

    const clearRowDraft = useCallback((rowKey: string) => {
        setRowDrafts((prev) => {
            if (!prev[rowKey]) return prev;
            const { [rowKey]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    // Worker Change Logic
    // Worker Change Logic
    const handleWorkerNameChange = useCallback((r: DailyReportWorkerRow, newName: string) => {
        // 1. Try to find match in allWorkers (exact first, then normalized without spaces - same as input tab)
        const trimmedName = newName.trim();
        const normalizedName = trimmedName.replace(/\s+/g, '');
        const matched = allWorkers.find(w => w.name === trimmedName)
            || (normalizedName ? allWorkers.find(w => w.name.replace(/\s+/g, '') === normalizedName) : undefined);

        if (matched) {
            // Check for duplicates ONLY within the same report (same reportId)
            // 같은 일보(reportId) 내에서만 중복 체크 (다른 날짜/현장에 같은 작업자가 있는 것은 정상)
            const isDuplicate = rows.some(existingRow => {
                // 같은 리포트 내에서만 체크
                if (existingRow.reportId !== r.reportId) return false;
                // 자신이 아닌 행 중에서
                if (getRowKey(existingRow) === getRowKey(r)) return false;
                // workerId가 같은 행이 있는지 확인 (draft가 있으면 draft 우선)
                const existingKey = getRowKey(existingRow);
                const existingDraft = rowDrafts[existingKey];
                const currentId = existingDraft?.workerId ?? existingRow.workerId;
                return String(currentId) === String(matched.id);
            });

            if (isDuplicate) {
                toast.warning(`'${newName}' 작업자는 같은 일보에 이미 포함되어 있습니다. (이름만 변경됨)`);
                setRowDraft(r, {
                    workerName: newName,
                    workerId: undefined, // 중복 방지를 위해 ID 매칭 해제
                    workerTeamName: '',
                    unitPrice: '0',
                    salaryModel: ''
                });
                return;
            }

            // 2. Lookup team from teams array
            // Try by teamId (checking both UUID and legacyId), then fallback to teamName
            let team = matched.teamId
                ? teams.find(t => t.id === matched.teamId || t.legacyId === matched.teamId)
                : undefined;

            // Fallback: if no team found by ID, try finding by name (try exact, then relaxed)
            if (!team && matched.teamName) {
                team = teams.find(t => t.name === matched.teamName);
                if (!team) {
                    const searchName = matched.teamName.replace(/\s+/g, '');
                    team = teams.find(t => t.name.replace(/\s+/g, '') === searchName);
                }
            }

            const resolvedTeamName = team?.name ?? matched.teamName ?? '';

            console.log('[DEBUG] Team lookup:', {
                teamId: matched.teamId,
                teamNameFromWorker: matched.teamName,
                teamFromArray: team ? { id: team.id, legacyId: team.legacyId, name: team.name } : null,
                resolvedTeamName
            });

            // Worker Found -> Auto-fill (단가, 급여방식, 작업팀 모두 채움)
            const draftUpdate = {
                workerName: newName,
                workerId: matched.id ? String(matched.id) : undefined,
                // 우선순위: 1. 팀 매칭 결과(resolvedTeamName) 2. 작업자 정보의 팀명(matched.teamName) 3. 작업자 정보의 팀유형(matched.teamType - 지원팀 등)
                workerTeamName: resolvedTeamName || matched.teamName || (matched.teamType === '지원팀' ? '지원팀' : ''),
                unitPrice: String(matched.unitPrice ?? 0),
                salaryModel: matched.payType || matched.salaryModel || '일급'
            };
            console.log('[DEBUG] Setting draft with:', draftUpdate);
            setRowDraft(r, draftUpdate);
        } else {
            // Worker Not Found -> Just update name only (타이핑 중에는 다른 필드 초기화하지 않음)
            setRowDraft(r, {
                workerName: newName
            });
        }
    }, [allWorkers, teams, setRowDraft, rows, rowDrafts, getRowKey]);

    const handleSaveRow = useCallback(async (r: DailyReportWorkerRow) => {
        const key = getRowKey(r);
        const draft = rowDrafts[key];
        if (!draft) return;

        const result = await confirm.save('저장하시겠습니까?');
        if (!result.isConfirmed) return;

        setRowSavingKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });

        try {
            // Prepare updates
            const updates: any = {};

            if (draft.workerId && String(draft.workerId) !== String(r.workerId)) {
                updates.workerId = draft.workerId;
            }
            if (draft.workerName !== undefined && draft.workerName !== r.workerName) {
                updates.name = draft.workerName;
            }
            // Resolve teamId from worker master when worker is changed
            if (draft.workerId) {
                const matchedWorker = allWorkers.find(w => String(w.id) === String(draft.workerId));
                if (matchedWorker?.teamId) {
                    updates.teamId = matchedWorker.teamId;
                }
            }

            updates.salaryModel = draft.salaryModel;
            updates.payType = draft.salaryModel; // sync
            updates.manDay = Number(draft.manDay);
            updates.unitPrice = Number(draft.unitPrice);
            updates.workContent = draft.workContent;
            updates.siteType = draft.siteType;
            updates.paymentType = draft.paymentType;
            updates.amount = updates.manDay * updates.unitPrice;

            await dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            toast.success('저장되었습니다.');
            clearRowDraft(key);

            // Optimistic Update
            setRows(prev => prev.map(row => {
                const isSameReport = row.reportId === r.reportId;
                const isSameWorker = row.workerId === r.workerId;

                if (isSameWorker) {
                    return { ...row, ...updates };
                }

                // Propagate Report-Level Fields (siteType)
                if (isSameReport && updates.siteType !== undefined) {
                    return { ...row, siteType: updates.siteType };
                }

                return row;
            }));
        } catch (error) {
            console.error(error);
            toast.error('저장 실패');
        } finally {
            setRowSavingKeys(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    }, [allWorkers, clearRowDraft, fetchRows, getRowKey, rowDrafts, confirm, toast]);

    const handleBulkApply = async () => {
        const selected = Array.from(selectedRowKeys)
            .map((k) => rowByKey.get(k))
            .filter((r): r is DailyReportWorkerRow => !!r);

        if (selected.length === 0) return;

        const parsedManDay = bulkManDay.trim() === '' ? null : Number(bulkManDay);
        const parsedUnitPrice = bulkUnitPrice.trim() === '' ? null : Number(bulkUnitPrice);
        const nextSalaryModel = bulkSalaryModel.trim() === '' ? null : bulkSalaryModel.trim();
        const nextWorkContent = bulkWorkContent.trim() === '' ? null : bulkWorkContent.trim();

        if (parsedManDay != null && (!Number.isFinite(parsedManDay) || parsedManDay < 0)) {
            alert('공수 값이 올바르지 않습니다.');
            return;
        }
        if (parsedUnitPrice != null && (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0)) {
            alert('단가 값이 올바르지 않습니다.');
            return;
        }

        if (parsedManDay == null && parsedUnitPrice == null && nextSalaryModel == null && nextWorkContent == null) {
            alert('변경할 값이 없습니다.');
            return;
        }

        const ok = await confirm.batch('일보', selected.length);
        if (!ok.isConfirmed) return;

        setIsLoading(true);
        try {
            const tasks = selected.map((r) => {
                const updates: Partial<DailyReportWorker> = {};
                if (parsedManDay != null) updates.manDay = parsedManDay;
                if (parsedUnitPrice != null) updates.unitPrice = parsedUnitPrice;
                if (nextSalaryModel != null) updates.salaryModel = nextSalaryModel;
                if (nextWorkContent != null) updates.workContent = nextWorkContent;
                if (bulkSiteType) updates.siteType = bulkSiteType;
                if (bulkPaymentType) updates.paymentType = bulkPaymentType;
                if (bulkWorkerTeamName.trim()) updates.workerTeamName = bulkWorkerTeamName.trim();
                return dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            });

            const batchSize = 10;
            for (let i = 0; i < tasks.length; i += batchSize) {
                await Promise.all(tasks.slice(i, i + batchSize));
            }

            toast.updated('일보');
            setSelectedRowKeys(new Set());
            setIsBulkEditOpen(false);
            setBulkManDay('');
            setBulkUnitPrice('');
            setBulkSalaryModel('');
            setBulkWorkContent('');
            setBulkSiteType('');
            setBulkPaymentType('');
            setBulkWorkerTeamName('');
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] bulk update failed', error);
            toast.error('일괄 수정에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const selected = Array.from(selectedRowKeys)
            .map((k) => rowByKey.get(k))
            .filter((r): r is DailyReportWorkerRow => !!r);

        if (selected.length === 0) return;

        const ok = await confirm.delete(`선택한 ${selected.length}건 삭제`);
        if (!ok.isConfirmed) return;

        setIsLoading(true);
        try {
            // Execute sequentially to prevent race conditions on Report Header Stats (Total ManDay updates)
            // Parallel execution causes multiple requests to read the same initial Total and overwrite each other's decrements.
            let successCount = 0;
            for (const r of selected) {
                try {
                    await dailyReportService.removeWorkerFromReport(r.reportId, r.workerId);
                    successCount++;
                } catch (e) {
                    console.error(`Failed to delete worker ${r.workerName} `, e);
                }
            }

            if (successCount === selected.length) {
                toast.deleted('일보', successCount);
            } else {
                toast.updated(`일보 ${successCount}건 삭제 완료(실패 ${selected.length - successCount}건)`);
            }

            setSelectedRowKeys(new Set());
            setIsBulkEditOpen(false);
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] bulk delete failed', error);
            toast.error('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const totals = useMemo(() => {
        const totalManDay = sortedRows.reduce((sum, r) => sum + (Number.isFinite(r.manDay) ? r.manDay : 0), 0);
        const totalAmount = sortedRows.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0);
        return { totalManDay, totalAmount };
    }, [sortedRows]);

    const dirtyRowCount = useMemo(() => {
        let count = 0;
        const keys = Object.keys(rowDrafts);
        for (const key of keys) {
            const draft = rowDrafts[key];
            const original = rowByKey.get(key);
            if (original && isRowDirty(original, draft)) {
                count++;
            }
        }
        return count;
    }, [rowDrafts, rowByKey, isRowDirty]);

    const handleSaveAllDirtyRows = async () => {
        if (dirtyRowCount === 0) return;

        const result = await confirm.save(`변경된 ${dirtyRowCount}건의 항목을 일괄 저장하시겠습니까?`);
        if (!result.isConfirmed) return;

        setIsLoading(true);
        try {
            const dirtyKeys = Object.keys(rowDrafts).filter(key => {
                const original = rowByKey.get(key);
                return original && isRowDirty(original, rowDrafts[key]);
            });

            const tasks = dirtyKeys.map(key => {
                const r = rowByKey.get(key)!;
                const draft = rowDrafts[key];

                const updates: any = {};
                if (draft.workerId && String(draft.workerId) !== String(r.workerId)) updates.workerId = draft.workerId;
                if (draft.workerName !== undefined && draft.workerName !== r.workerName) updates.name = draft.workerName;
                // Resolve teamId from worker master when worker is changed
                if (draft.workerId) {
                    const matchedWorker = allWorkers.find(w => String(w.id) === String(draft.workerId));
                    if (matchedWorker?.teamId) {
                        updates.teamId = matchedWorker.teamId;
                    }
                }

                updates.salaryModel = draft.salaryModel;
                updates.payType = draft.salaryModel;
                updates.manDay = Number(draft.manDay);
                updates.unitPrice = Number(draft.unitPrice);
                updates.workContent = draft.workContent;
                updates.siteType = draft.siteType;
                updates.paymentType = draft.paymentType;
                updates.amount = updates.manDay * updates.unitPrice;

                return dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            });

            // Execute in batches to avoid overwhelming the server
            // Use Promise.allSettled to ensure some successes even if others fail
            let successCount = 0;
            let failCount = 0;

            const batchSize = 5;
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batch = tasks.slice(i, i + batchSize);
                const results = await Promise.allSettled(batch);

                results.forEach(res => {
                    if (res.status === 'fulfilled') successCount++;
                    else {
                        failCount++;
                        console.error('[SaveAll] Row save failed:', res.reason);
                    }
                });
            }

            if (failCount === 0) {
                toast.success(`${successCount}건 저장 완료`);
            } else {
                toast.warning(`${successCount}건 저장, ${failCount}건 실패 (중복 등 확인 필요)`);
            }

            setRowDrafts({}); // Clear all drafts (Successful ones are updated via fetchRows, failed ones lost but safer than inconsistent state)
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] Save All Failed (Critical)', error);
            toast.error('일괄 저장 중 시스템 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };



    const handleSetPrevMonth = () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        d.setDate(1);
        const start = formatYmd(d);

        const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const end = formatYmd(endD);

        setStartDate(start);
        setEndDate(end);
    };

    const handleSetThisMonth = () => {
        const d = new Date();
        d.setDate(1);
        const start = formatYmd(d);

        const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const end = formatYmd(endD);

        setStartDate(start);
        setEndDate(end);
    };

    return (
        <div className="flex h-full flex-col flex-1 min-h-0 gap-4 p-1">
            <div className="flex-shrink-0 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-end">
                <div className="flex items-center gap-2 flex-wrap w-full">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="pl-10 pr-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                            />
                        </div>
                        <span className="text-slate-400">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                        />

                        <div className="flex gap-1">
                            <button
                                onClick={handleSetPrevMonth}
                                className="px-2 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                전달
                            </button>
                            <button
                                onClick={handleSetThisMonth}
                                className="px-2 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-100"
                            >
                                이달
                            </button>
                            <button
                                onClick={() => {
                                    const y = new Date();
                                    y.setDate(y.getDate() - 1);
                                    const yStr = formatYmd(y);
                                    setStartDate(yStr);
                                    setEndDate(yStr);
                                }}
                                className="px-2 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                어제
                            </button>
                            <button
                                onClick={() => {
                                    setStartDate(todayStr);
                                    setEndDate(todayStr);
                                }}
                                className="px-2 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                오늘
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setSortMode('date');
                                setDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                            }}
                            className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors border ${dateSortOrder === 'desc'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}
                            title="날짜 정렬"
                        >
                            <FontAwesomeIcon icon={dateSortOrder === 'desc' ? faSortAmountDown : faSortAmountUp} />
                        </button>

                        <button
                            onClick={() => {
                                setSortMode('name');
                                setNameSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            }}
                            className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors border ${sortMode === 'name'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                            title="가나다(이름) 정렬"
                        >
                            <span className="text-xs font-bold">이름순</span>
                            <FontAwesomeIcon icon={nameSortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
                        </button>

                        <button
                            onClick={() => {
                                setSortMode('site');
                                setSiteSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            }}
                            className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors border ${sortMode === 'site'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                            title="현장명 정렬"
                        >
                            <span className="text-xs font-bold">현장순</span>
                            <FontAwesomeIcon icon={siteSortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
                        </button>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]"
                        >
                            <option value="">전체 현장</option>
                            {[...availableSites].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => (
                                <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]"
                        >
                            <option value="">전체 해당팀</option>
                            {availableReportTeams.map((t) => (
                                <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedWorkerTeamId}
                            onChange={(e) => setSelectedWorkerTeamId(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px] bg-slate-50"
                        >
                            <option value="">전체 소속팀</option>
                            {availableWorkerTeams.map((t) => (
                                <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-48">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={workerSearch}
                            onChange={(e) => setWorkerSearch(e.target.value)}
                            placeholder="작업자 검색"
                            className="w-full pl-10 pr-4 py-2 border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                        />
                    </div>

                    <button
                        onClick={handleToggleEditMode}
                        className={`flex items - center gap - 2 px - 4 py - 2 rounded - lg text - sm font - bold shadow - sm whitespace - nowrap border transition - colors ${isEditMode
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            } `}
                    >
                        <FontAwesomeIcon icon={faPenToSquare} />
                        {isEditMode ? '수정 종료' : '수정모드'}
                    </button>

                    <button
                        onClick={() => setIsFixed(!isFixed)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${isFixed
                            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faThumbtack} className={isFixed ? 'rotate-45' : ''} />
                        {isFixed ? '틀고정 해제' : '틀고정 활성'}
                    </button>

                    {isEditMode && (
                        <>
                            <button
                                onClick={() => setIsBulkEditOpen(true)}
                                disabled={selectedRowKeys.size === 0}
                                className={`px - 4 py - 2 rounded - lg text - sm font - bold shadow - sm whitespace - nowrap border transition - colors ${selectedRowKeys.size > 0
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    } `}
                                title="선택 항목 일괄 수정"
                            >
                                일괄수정 ({selectedRowKeys.size})
                            </button>

                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedRowKeys.size === 0}
                                className={`flex items - center gap - 2 px - 4 py - 2 rounded - lg text - sm font - bold shadow - sm whitespace - nowrap border transition - colors ${selectedRowKeys.size > 0
                                    ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    } `}
                                title="선택 항목 삭제"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                                삭제
                            </button>
                        </>
                    )}

                    <button
                        onClick={fetchRows}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95 ml-auto"
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        조회
                    </button>

                    {dirtyRowCount > 0 && (
                        <button
                            onClick={handleSaveAllDirtyRows}
                            disabled={isLoading}
                            className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95 ml-2 animate-pulse"
                            title="변경된 모든 항목 저장"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            전체 저장 ({dirtyRowCount})
                        </button>
                    )}

                    <div className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 ml-2">
                        <span className="text-xs font-light text-slate-300">Total</span>
                        <span className="font-bold text-lg">{totals.totalManDay.toFixed(1)}</span>
                        <span className="text-xs">공수</span>
                        <span className="ml-2 text-xs font-light text-slate-300">|</span>
                        <span className="font-bold text-lg">{formatNumber(Math.round(totals.totalAmount))}</span>
                        <span className="text-xs">원</span>
                    </div>
                </div>
            </div>

            {isEditMode && isBulkEditOpen && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end">
                    <div className="text-sm font-bold text-slate-700">선택 항목 일괄 수정</div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">공수</label>
                        <input
                            type="number"
                            value={bulkManDay}
                            onChange={(e) => setBulkManDay(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[160px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">단가</label>
                        <input
                            type="number"
                            value={bulkUnitPrice}
                            onChange={(e) => setBulkUnitPrice(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[160px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">급여방식</label>
                        <input
                            type="text"
                            value={bulkSalaryModel}
                            onChange={(e) => setBulkSalaryModel(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[200px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">현장구분</label>
                        <select
                            value={bulkSiteType}
                            onChange={(e) => setBulkSiteType(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[120px]"
                        >
                            <option value="">(변경없음)</option>
                            <option value="도급">도급</option>
                            <option value="직영">직영</option>
                            <option value="지원">지원</option>
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">결제구분</label>
                        <select
                            value={bulkPaymentType}
                            onChange={(e) => setBulkPaymentType(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[120px]"
                        >
                            <option value="">(변경없음)</option>
                            <option value="노무">노무</option>
                            <option value="계산서">계산서</option>
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">작업팀명</label>
                        <input
                            type="text"
                            value={bulkWorkerTeamName}
                            onChange={(e) => setBulkWorkerTeamName(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[150px]"
                        />
                    </div>

                    <div className="flex flex-col flex-1 min-w-[240px]">
                        <label className="text-[11px] text-slate-500">비고</label>
                        <input
                            type="text"
                            value={bulkWorkContent}
                            onChange={(e) => setBulkWorkContent(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm"
                        />
                    </div>

                    <button
                        onClick={handleBulkApply}
                        disabled={selectedRowKeys.size === 0}
                        className={`px-5 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap transition-colors ${selectedRowKeys.size > 0
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        적용
                    </button>

                    <button
                        onClick={() => setIsBulkEditOpen(false)}
                        className="px-5 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    >
                        닫기
                    </button>
                </div>
            )}

            <div
                className="flex-1 min-h-0 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200"
                style={{ maxHeight: 'calc(100vh - 260px)' }}
            >
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-2"></div>
                        <span className="text-sm font-medium">불러오는 중...</span>
                    </div>
                ) : sortedRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <FontAwesomeIcon icon={faSearch} className="text-4xl mb-3 opacity-20" />
                        <span className="text-sm">조건에 맞는 작업자 내역이 없습니다.</span>
                    </div>
                ) : (
                    <table className="min-w-[1050px] w-full text-sm text-left text-slate-700">
                        <thead className="bg-slate-50 sticky top-0 z-30 border-b border-slate-200">
                            <tr>
                                {isEditMode && (
                                    <th className={`px-4 py-3 whitespace-nowrap w-[48px] ${isFixed ? 'sticky left-0 z-40 bg-slate-50 border-r border-slate-200' : ''}`}>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                            title="전체 선택"
                                        />
                                    </th>
                                )}
                                <th className={`px-4 py-3 whitespace-nowrap w-[100px] ${isFixed ? `sticky z-40 bg-slate-50 border-r border-slate-200 ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`}>날짜</th>
                                <th className={`px-4 py-3 whitespace-nowrap w-[180px] ${isFixed ? `sticky z-40 bg-slate-50 border-r border-slate-200 ${isEditMode ? 'left-[148px]' : 'left-[100px]'}` : ''}`}>현장</th>
                                <th className="px-4 py-3 whitespace-nowrap">현장구분</th>
                                <th className="px-4 py-3 whitespace-nowrap">결제구분</th>
                                <th className="px-4 py-3 whitespace-nowrap">담당팀</th>
                                <th className={`px-4 py-3 whitespace-nowrap w-[120px] ${isFixed ? `sticky z-40 bg-slate-50 border-r-2 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isEditMode ? 'left-[328px]' : 'left-[280px]'}` : ''}`}>이름</th>
                                <th className="px-4 py-3 whitespace-nowrap">작업팀</th>
                                <th className="px-4 py-3 whitespace-nowrap">급여방식</th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">공수</th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">단가</th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">금액</th>
                                <th className="px-4 py-3 whitespace-nowrap">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((r, idx) => (
                                (() => {
                                    const rowKey = getRowKey(r);
                                    const draft = rowDrafts[rowKey];
                                    const saving = rowSavingKeys.has(rowKey);
                                    const dirty = isRowDirty(r, draft);

                                    const effectiveManDay = draft ? Number(draft.manDay) : (Number.isFinite(r.manDay) ? r.manDay : 0);
                                    const effectiveUnitPrice = draft ? Number(draft.unitPrice) : (Number.isFinite(r.unitPrice) ? r.unitPrice : 0);
                                    const previewAmount = Number.isFinite(effectiveManDay) && Number.isFinite(effectiveUnitPrice)
                                        ? effectiveManDay * effectiveUnitPrice
                                        : (Number.isFinite(r.amount) ? r.amount : 0);

                                    const effectiveSalaryModel = draft ? draft.salaryModel : String(r.salaryModel ?? r.payType ?? '');
                                    const effectiveWorkContent = draft ? draft.workContent : String(r.workContent ?? '');

                                    return (
                                        <tr
                                            key={`${r.reportId}_${r.workerId}_${idx}`}
                                            className={`border-b border-slate-100 hover:bg-slate-50 ${selectedRowKeys.has(rowKey) ? 'bg-indigo-50/50' : ''} ${dirty ? 'ring-1 ring-indigo-200' : ''} transition-colors`}
                                        >
                                            {isEditMode && (
                                                <td className={`px-4 py-3 whitespace-nowrap w-[48px] ${isFixed ? 'sticky left-0 z-20 bg-white border-r border-slate-100' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                                        checked={selectedRowKeys.has(rowKey)}
                                                        onChange={() => toggleSelectRow(rowKey)}
                                                        title="선택"
                                                    />
                                                </td>
                                            )}
                                            <td className={`px-4 py-3 whitespace-nowrap text-slate-500 w-[100px] ${isFixed ? `sticky z-20 bg-white border-r border-slate-100 ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`}>{r.date ?? ''}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap w-[180px] ${isFixed ? `sticky z-20 bg-white border-r border-slate-100 ${isEditMode ? 'left-[148px]' : 'left-[100px]'}` : ''}`}>{r.siteName ?? ''}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <select
                                                        value={draft ? draft.siteType : (r.siteType ?? '')}
                                                        onChange={(e) => setRowDraft(r, { siteType: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[80px] bg-white"
                                                    >
                                                        <option value="">-</option>
                                                        <option value="도급">도급</option>
                                                        <option value="직영">직영</option>
                                                        <option value="지원">지원</option>
                                                    </select>
                                                ) : (
                                                    (r.siteType ?? '')
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <select
                                                        value={draft ? draft.paymentType : (r.paymentType ?? '')}
                                                        onChange={(e) => setRowDraft(r, { paymentType: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[80px] bg-white"
                                                    >
                                                        <option value="">-</option>
                                                        <option value="노무">노무</option>
                                                        <option value="계산서">계산서</option>
                                                    </select>
                                                ) : (
                                                    (r.paymentType ?? '')
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">{r.teamName ?? ''}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap font-semibold w-[120px] ${isFixed ? `sticky z-20 bg-white border-r-2 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isEditMode ? 'left-[328px]' : 'left-[280px]'}` : ''}`}>
                                                {isEditMode ? (
                                                    <>
                                                        <input
                                                            list="worker-list-v2"
                                                            type="text"
                                                            value={draft ? (draft.workerName ?? r.workerName) : r.workerName}
                                                            onChange={(e) => handleWorkerNameChange(r, e.target.value)}
                                                            disabled={saving}
                                                            className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[100px] bg-white"
                                                        />
                                                        <datalist id="worker-list-v2">
                                                            {allWorkers.map((w) => (
                                                                <option key={w.id} value={w.name}>{w.teamName ? `(${w.teamName})` : ''}</option>
                                                            ))}
                                                        </datalist>
                                                    </>
                                                ) : (
                                                    r.workerName
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={draft ? (draft.workerTeamName ?? r.workerTeamName ?? '') : (r.workerTeamName ?? '')}
                                                        onChange={(e) => setRowDraft(r, { workerTeamName: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[120px] bg-white"
                                                        placeholder="작업팀"
                                                    />
                                                ) : (
                                                    (r.workerTeamName ?? '')
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={effectiveSalaryModel}
                                                        onChange={(e) => setRowDraft(r, { salaryModel: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[140px] bg-white"
                                                    />
                                                ) : (
                                                    (r.salaryModel ?? r.payType ?? '')
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                {isEditMode ? (
                                                    <input
                                                        type="number"
                                                        value={draft ? draft.manDay : (Number.isFinite(r.manDay) ? String(r.manDay) : '0')}
                                                        onChange={(e) => setRowDraft(r, { manDay: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[90px] text-right bg-white"
                                                    />
                                                ) : (
                                                    (Number.isFinite(r.manDay) ? r.manDay : 0).toFixed(1)
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                {isEditMode ? (
                                                    <input
                                                        type="number"
                                                        value={draft ? draft.unitPrice : (Number.isFinite(r.unitPrice) ? String(r.unitPrice) : '0')}
                                                        onChange={(e) => setRowDraft(r, { unitPrice: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-[120px] text-right bg-white"
                                                    />
                                                ) : (
                                                    formatNumber(Math.round(Number.isFinite(r.unitPrice) ? r.unitPrice : 0))
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right font-bold">
                                                {formatNumber(Math.round(previewAmount))}
                                            </td>
                                            <td className="px-4 py-3 min-w-[300px]">
                                                {isEditMode ? (
                                                    <div className="flex flex-col gap-2">
                                                        <textarea
                                                            value={effectiveWorkContent}
                                                            onChange={(e) => setRowDraft(r, { workContent: e.target.value })}
                                                            disabled={saving}
                                                            className="px-2 py-1.5 border border-slate-300 rounded text-sm w-full bg-white min-h-[60px] resize-y"
                                                            placeholder="작업 내용 입력"
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => handleSaveRow(r)}
                                                                disabled={!dirty || saving}
                                                                className={`px-3 py-1.5 rounded text-xs font-bold border ${(!dirty || saving)
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                    : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                                                    }`}
                                                            >
                                                                저장
                                                            </button>
                                                            <button
                                                                onClick={() => clearRowDraft(rowKey)}
                                                                disabled={saving}
                                                                className={`px-3 py-1.5 rounded text-xs font-bold border ${saving
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                취소
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="max-h-[60px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-200">
                                                        {(r.workContent ?? '') || <span className="text-slate-300 italic">내역 없음</span>}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })()
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default DailyReportListV2;
