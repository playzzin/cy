import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBoxesStacked,
    faFloppyDisk,
    faMagnifyingGlass,
    faPlus,
    faPen,
    faRotateLeft,
    faRotateRight,
    faScrewdriverWrench,
    faTrash,
    faUsers,
    faWrench
} from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { supportSharedDataService } from '../../services/supportSharedDataService';
import { DEFAULT_EQUIPMENT_ITEMS, EQUIPMENT_CATALOG_VERSION, EquipmentItem, upgradeEquipmentCatalog } from './teamEquipmentCatalog';
import './TeamEquipmentStatusPage.css';

interface ForemanEquipmentMetric {
    id: string;
    name: string;
    quantities: Record<string, number>;
    note: string;
}

interface TeamEquipmentMetric {
    id: string;
    quantities: Record<string, number>;
    note: string;
    foremen?: ForemanEquipmentMetric[];
    useForemanTotals?: boolean;
}

interface TeamEquipmentRecord extends TeamEquipmentMetric {
    teamName: string;
    teamColor: string;
    foremen: ForemanEquipmentMetric[];
    isForemanBreakdown: boolean;
    useForemanTotals: boolean;
}

type PersistedEquipmentState = {
    catalogVersion?: number;
    items?: EquipmentItem[];
    rows?: Record<string, TeamEquipmentMetric>;
};

type NormalizedEquipmentState = {
    catalogVersion: number;
    items: EquipmentItem[];
    rows: Record<string, TeamEquipmentMetric>;
};

type LegacyEquipmentInput = {
    id?: string;
    impact?: boolean | number;
    skill?: boolean | number;
    note?: string;
};

const STORAGE_KEY = 'team_equipment_inventory_v2';
const LEGACY_STORAGE_KEY = 'team_equipment_status_v1';
const MIGRATION_KEY = 'team_equipment_inventory_firestore_migrated_v1';
const DEFAULT_TEAM_COLOR = '#94a3b8';
const FOREMAN_BREAKDOWN_TEAM_NAME = '이재욱팀';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const normalizeComparableText = (value: unknown): string => normalizeKey(value).replace(/\s+/g, '').toLowerCase();

const normalizeColor = (value: unknown): string => {
    const color = normalizeKey(value);
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    if (/^#[0-9a-fA-F]{3}$/.test(color)) return color;
    return DEFAULT_TEAM_COLOR;
};

const toQuantity = (value: unknown): number => {
    const next = Number(value);
    if (!Number.isFinite(next)) return 0;
    return Math.max(0, Math.floor(next));
};

const createEmptyQuantities = (items: EquipmentItem[]): Record<string, number> => (
    items.reduce<Record<string, number>>((acc, item) => {
        acc[item.id] = 0;
        return acc;
    }, {})
);

const createEquipmentId = (name: string, existingIds: Set<string>): string => {
    const base = normalizeKey(name)
        .toLowerCase()
        .replace(/[^0-9a-z가-힣]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'equipment';
    let id = base;
    let index = 2;
    while (existingIds.has(id)) {
        id = `${base}_${index}`;
        index += 1;
    }
    return id;
};

const createForemanId = (name: string, existingIds: Set<string>): string => {
    const baseName = normalizeKey(name)
        .toLowerCase()
        .replace(/[^0-9a-z가-힣]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'foreman';
    const base = `foreman_${baseName}`;
    let id = base;
    let index = 2;
    while (existingIds.has(id)) {
        id = `${base}_${index}`;
        index += 1;
    }
    return id;
};

const normalizeItems = (items?: EquipmentItem[], fallbackToDefaults = true): EquipmentItem[] => {
    const byId = new Map<string, EquipmentItem>();
    if (fallbackToDefaults) {
        DEFAULT_EQUIPMENT_ITEMS.forEach((item) => byId.set(item.id, item));
    }
    (items ?? []).forEach((item) => {
        const id = normalizeKey(item.id);
        const name = normalizeKey(item.name);
        if (!id || !name) return;
        byId.set(id, { id, name });
    });
    return Array.from(byId.values());
};

const normalizeForeman = (id: string, value: Partial<ForemanEquipmentMetric> | undefined, items: EquipmentItem[]): ForemanEquipmentMetric => {
    const sourceQuantities = value?.quantities ?? {};
    const quantities = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.id] = toQuantity(sourceQuantities[item.id]);
        return acc;
    }, {});

    return {
        id,
        name: normalizeKey(value?.name) || '반장',
        quantities,
        note: normalizeKey(value?.note)
    };
};

const normalizeForemen = (foremen: unknown, items: EquipmentItem[]): ForemanEquipmentMetric[] => {
    if (!Array.isArray(foremen)) return [];

    const existingIds = new Set<string>();
    return foremen.reduce<ForemanEquipmentMetric[]>((acc, value) => {
        if (!value || typeof value !== 'object') return acc;
        const source = value as Partial<ForemanEquipmentMetric>;
        const name = normalizeKey(source.name);
        if (!name) return acc;

        const rawId = normalizeKey(source.id);
        const id = rawId && !existingIds.has(rawId)
            ? rawId
            : createForemanId(name, existingIds);
        existingIds.add(id);
        acc.push(normalizeForeman(id, { ...source, name }, items));
        return acc;
    }, []);
};

const foremanHasData = (foreman: ForemanEquipmentMetric): boolean => (
    Boolean(foreman.note) || Object.values(foreman.quantities).some((quantity) => toQuantity(quantity) > 0)
);

const normalizeMetric = (id: string, value: Partial<TeamEquipmentMetric> | undefined, items: EquipmentItem[]): TeamEquipmentMetric => {
    const sourceQuantities = value?.quantities ?? {};
    const quantities = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.id] = toQuantity(sourceQuantities[item.id]);
        return acc;
    }, {});
    const foremen = normalizeForemen(value?.foremen, items);

    return {
        id,
        quantities,
        note: normalizeKey(value?.note),
        foremen,
        useForemanTotals: Boolean(value?.useForemanTotals) || foremen.some(foremanHasData)
    };
};

const normalizePersistedState = (value: unknown): NormalizedEquipmentState | null => {
    if (!value || typeof value !== 'object') return null;
    const parsed = value as PersistedEquipmentState;
    const items = upgradeEquipmentCatalog(normalizeItems(parsed.items, !Array.isArray(parsed.items)), parsed.catalogVersion);
    const rows = Object.entries(parsed.rows ?? {}).reduce<Record<string, TeamEquipmentMetric>>((acc, [id, metric]) => {
        const key = normalizeKey(id);
        if (!key) return acc;
        acc[key] = normalizeMetric(key, metric as Partial<TeamEquipmentMetric>, items);
        return acc;
    }, {});
    return { catalogVersion: EQUIPMENT_CATALOG_VERSION, items, rows };
};

const hasLocalSavedState = (): boolean => (
    typeof window !== 'undefined'
    && Boolean(window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY))
);

const loadLocalSavedState = (): NormalizedEquipmentState => {
    if (typeof window === 'undefined') return { catalogVersion: EQUIPMENT_CATALOG_VERSION, items: DEFAULT_EQUIPMENT_ITEMS, rows: {} };

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const normalized = normalizePersistedState(raw ? JSON.parse(raw) : null);
        if (normalized) return normalized;
    } catch (error) {
        console.warn('[TeamEquipmentStatusPage] Failed to load local equipment inventory:', error);
    }

    try {
        const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const legacyParsed = legacyRaw ? JSON.parse(legacyRaw) : null;
        if (!legacyParsed || typeof legacyParsed !== 'object') {
            return { catalogVersion: EQUIPMENT_CATALOG_VERSION, items: DEFAULT_EQUIPMENT_ITEMS, rows: {} };
        }

        const entries = Array.isArray(legacyParsed)
            ? legacyParsed.map((item) => [String((item as LegacyEquipmentInput).id ?? ''), item] as const)
            : Object.entries(legacyParsed);

        const rows = entries.reduce<Record<string, TeamEquipmentMetric>>((acc, [id, value]) => {
            const key = normalizeKey(id);
            if (!key) return acc;
            const row = value as LegacyEquipmentInput;
            acc[key] = {
                id: key,
                quantities: {
                    impact: row.impact ? toQuantity(row.impact) || 1 : 0,
                    skill: row.skill ? toQuantity(row.skill) || 1 : 0
                },
                note: normalizeKey(row.note),
                foremen: [],
                useForemanTotals: false
            };
            return acc;
        }, {});

        return { catalogVersion: EQUIPMENT_CATALOG_VERSION, items: DEFAULT_EQUIPMENT_ITEMS, rows };
    } catch (error) {
        console.warn('[TeamEquipmentStatusPage] Failed to migrate legacy equipment status:', error);
        return { catalogVersion: EQUIPMENT_CATALOG_VERSION, items: DEFAULT_EQUIPMENT_ITEMS, rows: {} };
    }
};

const needsLocalMigration = (): boolean => (
    hasLocalSavedState()
    && typeof window !== 'undefined'
    && window.localStorage.getItem(MIGRATION_KEY) !== 'done'
);

const markLocalMigrationComplete = () => {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(MIGRATION_KEY, 'done');
    }
};

const mergeForemen = (
    sharedForemen: ForemanEquipmentMetric[],
    localForemen: ForemanEquipmentMetric[],
    items: EquipmentItem[]
): ForemanEquipmentMetric[] => {
    const merged = normalizeForemen(sharedForemen, items);
    localForemen.forEach((localForeman) => {
        const index = merged.findIndex((sharedForeman) => (
            sharedForeman.id === localForeman.id
            || normalizeComparableText(sharedForeman.name) === normalizeComparableText(localForeman.name)
        ));
        if (index < 0) {
            merged.push(normalizeForeman(localForeman.id, localForeman, items));
            return;
        }

        const sharedForeman = merged[index];
        merged[index] = {
            ...sharedForeman,
            quantities: items.reduce<Record<string, number>>((acc, item) => {
                const sharedQuantity = toQuantity(sharedForeman.quantities[item.id]);
                acc[item.id] = sharedQuantity > 0 ? sharedQuantity : toQuantity(localForeman.quantities[item.id]);
                return acc;
            }, {}),
            note: sharedForeman.note || localForeman.note
        };
    });
    return merged.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
};

const mergeEquipmentStates = (
    sharedState: NormalizedEquipmentState,
    localState: NormalizedEquipmentState
): NormalizedEquipmentState => {
    const items = normalizeItems([...localState.items, ...sharedState.items], false);
    const rowIds = new Set([...Object.keys(localState.rows), ...Object.keys(sharedState.rows)]);
    const rows = Array.from(rowIds).reduce<Record<string, TeamEquipmentMetric>>((acc, id) => {
        const sharedRow = sharedState.rows[id] ? normalizeMetric(id, sharedState.rows[id], items) : null;
        const localRow = localState.rows[id] ? normalizeMetric(id, localState.rows[id], items) : null;
        if (!sharedRow) {
            if (localRow) acc[id] = localRow;
            return acc;
        }
        if (!localRow) {
            acc[id] = sharedRow;
            return acc;
        }

        const foremen = mergeForemen(sharedRow.foremen ?? [], localRow.foremen ?? [], items);
        acc[id] = {
            id,
            quantities: items.reduce<Record<string, number>>((quantities, item) => {
                const sharedQuantity = toQuantity(sharedRow.quantities[item.id]);
                quantities[item.id] = sharedQuantity > 0 ? sharedQuantity : toQuantity(localRow.quantities[item.id]);
                return quantities;
            }, {}),
            note: sharedRow.note || localRow.note,
            foremen,
            useForemanTotals: Boolean(sharedRow.useForemanTotals || localRow.useForemanTotals || foremen.some(foremanHasData))
        };
        return acc;
    }, {});
    return { catalogVersion: EQUIPMENT_CATALOG_VERSION, items, rows };
};

const buildPersistedState = (items: EquipmentItem[], records: TeamEquipmentRecord[]): PersistedEquipmentState => ({
        catalogVersion: EQUIPMENT_CATALOG_VERSION,
        items,
        rows: records.reduce<Record<string, TeamEquipmentMetric>>((acc, record) => {
            acc[record.id] = {
                id: record.id,
                quantities: record.quantities,
                note: record.note,
                foremen: record.foremen,
                useForemanTotals: record.useForemanTotals
            };
            return acc;
        }, {})
    });

const persistLocalState = (items: EquipmentItem[], records: TeamEquipmentRecord[]) => {
    if (typeof window === 'undefined') return;
    const payload = buildPersistedState(items, records);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const isConstructionTeam = (team: Team): boolean => normalizeKey(team.type) === '시공팀';
const isForemanBreakdownTeam = (teamName: unknown): boolean => (
    normalizeComparableText(teamName) === normalizeComparableText(FOREMAN_BREAKDOWN_TEAM_NAME)
);

const workerBelongsToTeam = (worker: Worker, team: Team): boolean => {
    const teamIds = [team.id, team.legacyId].map(normalizeComparableText).filter(Boolean);
    const teamNames = [team.name].map(normalizeComparableText).filter(Boolean);
    const workerTeamIds = [worker.teamId, (worker as any).team].map(normalizeComparableText).filter(Boolean);
    const workerTeamNames = [worker.teamName].map(normalizeComparableText).filter(Boolean);

    return workerTeamIds.some((id) => teamIds.includes(id)) || workerTeamNames.some((name) => teamNames.includes(name));
};

const isActiveWorker = (worker: Worker): boolean => {
    const status = normalizeComparableText(worker.status);
    if (worker.isActive === false) return false;
    return !['퇴사', 'inactive', '출입금지'].includes(status);
};

const isForemanWorker = (worker: Worker): boolean => normalizeKey(worker.role).includes('반장');

const buildForemenForTeam = (
    team: Team,
    workers: Worker[],
    savedForemen: ForemanEquipmentMetric[] | undefined,
    items: EquipmentItem[]
): ForemanEquipmentMetric[] => {
    const normalizedSaved = normalizeForemen(savedForemen, items);
    const savedById = new Map(normalizedSaved.map((foreman) => [foreman.id, foreman]));
    const savedByName = new Map(normalizedSaved.map((foreman) => [normalizeComparableText(foreman.name), foreman]));
    const existingIds = new Set(normalizedSaved.map((foreman) => foreman.id));
    const usedSavedIds = new Set<string>();

    const workerForemen = workers
        .filter((worker) => isActiveWorker(worker) && workerBelongsToTeam(worker, team) && isForemanWorker(worker))
        .sort((a, b) => normalizeKey(a.name).localeCompare(normalizeKey(b.name), 'ko-KR'))
        .reduce<ForemanEquipmentMetric[]>((acc, worker) => {
            const name = normalizeKey(worker.name);
            if (!name) return acc;

            const stableSourceId = normalizeKey(worker.id || worker.legacyId || name);
            const candidateId = createForemanId(stableSourceId, new Set<string>());
            const saved = savedById.get(candidateId) ?? savedByName.get(normalizeComparableText(name));
            if (saved) {
                usedSavedIds.add(saved.id);
            }

            const id = saved?.id || createForemanId(stableSourceId || name, existingIds);
            existingIds.add(id);
            acc.push(normalizeForeman(id, { ...(saved ?? {}), name }, items));
            return acc;
        }, []);

    const manuallyAddedForemen = normalizedSaved.filter((foreman) => !usedSavedIds.has(foreman.id));
    return [...workerForemen, ...manuallyAddedForemen]
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
};

const sortRecords = (records: TeamEquipmentRecord[]): TeamEquipmentRecord[] => (
    [...records].sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko-KR'))
);

const calculateForemanTotals = (foremen: ForemanEquipmentMetric[], items: EquipmentItem[]): Record<string, number> => (
    items.reduce<Record<string, number>>((acc, item) => {
        acc[item.id] = foremen.reduce((sum, foreman) => sum + toQuantity(foreman.quantities[item.id]), 0);
        return acc;
    }, {})
);

const getRecordDisplayQuantities = (record: TeamEquipmentRecord, items: EquipmentItem[]): Record<string, number> => (
    record.isForemanBreakdown && record.useForemanTotals
        ? calculateForemanTotals(record.foremen, items)
        : record.quantities
);

const TeamEquipmentStatusPage: React.FC = () => {
    const navigate = useNavigate();
    const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENT_ITEMS);
    const [records, setRecords] = useState<TeamEquipmentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [newEquipmentName, setNewEquipmentName] = useState('');
    const [showEquipmentManager, setShowEquipmentManager] = useState(false);
    const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
    const [equipmentNameDraft, setEquipmentNameDraft] = useState('');
    const [newForemanNames, setNewForemanNames] = useState<Record<string, string>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(() => new Set());
    const [saving, setSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimerRef = useRef<number | null>(null);

    const showToast = (message: string) => {
        setToastMessage(message);
        setToastVisible(true);
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
            setToastVisible(false);
        }, 1800);
    };

    const loadTeamRecords = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const teams = await teamService.getTeams();
            const localState = loadLocalSavedState();
            let savedState = localState;
            let loadWarning: string | null = null;
            let migratedLocalData = false;

            try {
                const sharedState = await supportSharedDataService.load<PersistedEquipmentState>('team_equipment_inventory');
                const normalizedSharedState = normalizePersistedState(sharedState);
                if (normalizedSharedState) {
                    if (needsLocalMigration()) {
                        savedState = mergeEquipmentStates(normalizedSharedState, localState);
                        await supportSharedDataService.save('team_equipment_inventory', savedState);
                        migratedLocalData = true;
                    } else {
                        savedState = normalizedSharedState;
                    }
                    markLocalMigrationComplete();
                } else if (hasLocalSavedState()) {
                    await supportSharedDataService.save('team_equipment_inventory', localState);
                    migratedLocalData = true;
                    markLocalMigrationComplete();
                }
            } catch (sharedDataError) {
                console.error('[TeamEquipmentStatusPage] Failed to load shared equipment inventory:', sharedDataError);
                loadWarning = '공용 DB를 불러오지 못해 이 브라우저의 임시 사본을 표시합니다. 새로고침 후 다시 확인해 주세요.';
            }

            const items = savedState.items;
            const constructionTeams = teams.filter(isConstructionTeam);
            let workers: Worker[] = [];

            if (constructionTeams.some((team) => isForemanBreakdownTeam(team.name))) {
                try {
                    workers = await manpowerService.getWorkers();
                } catch (workerError) {
                    console.warn('[TeamEquipmentStatusPage] Failed to load foreman workers:', workerError);
                    workers = [];
                }
            }

            const nextRecords = constructionTeams
                .map((team: Team) => {
                    const id = normalizeKey(team.id || team.legacyId || team.name);
                    const saved = savedState.rows[id];
                    const metric = normalizeMetric(id, saved, items);
                    const isForemanBreakdown = isForemanBreakdownTeam(team.name);
                    const foremen = isForemanBreakdown
                        ? buildForemenForTeam(team, workers, metric.foremen, items)
                        : [];

                    return {
                        ...metric,
                        foremen,
                        isForemanBreakdown,
                        useForemanTotals: isForemanBreakdown ? Boolean(metric.useForemanTotals) : false,
                        teamName: normalizeKey(team.name) || '-',
                        teamColor: normalizeColor(team.color)
                    };
                })
                .filter((record) => Boolean(record.id));

            setEquipmentItems(items);
            setRecords(sortRecords(nextRecords));
            persistLocalState(items, nextRecords);
            setLoadError(loadWarning);
            setChangedIds(new Set());
            if (migratedLocalData) {
                showToast('기존 장비 기록을 공용 DB로 이전했습니다.');
            }
        } catch (error) {
            console.error('[TeamEquipmentStatusPage] Failed to load teams:', error);
            setLoadError(error instanceof Error ? error.message : '팀 정보를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTeamRecords();
    }, [refreshKey]);

    useEffect(() => () => {
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
    }, []);

    const persistSharedState = async (items: EquipmentItem[], nextRecords: TeamEquipmentRecord[]): Promise<boolean> => {
        if (loadError) {
            showToast('공용 DB를 정상적으로 불러오지 못한 상태에서는 데이터 보호를 위해 저장할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
            return false;
        }
        setSaving(true);
        try {
            await supportSharedDataService.save('team_equipment_inventory', buildPersistedState(items, nextRecords));
            persistLocalState(items, nextRecords);
            setLoadError(null);
            return true;
        } catch (error) {
            console.error('[TeamEquipmentStatusPage] Failed to save shared equipment inventory:', error);
            showToast('공용 DB 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const equipmentTotals = useMemo(() => {
        const totals = { main: createEmptyQuantities(equipmentItems), subteams: createEmptyQuantities(equipmentItems) };
        records.forEach(record => {
            const group = record.isForemanBreakdown ? totals.main : totals.subteams;
            const quantities = getRecordDisplayQuantities(record, equipmentItems);
            equipmentItems.forEach(item => { group[item.id] += toQuantity(quantities[item.id]); });
        });
        return totals;
    }, [equipmentItems, records]);

    const visibleRecords = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return sortRecords(records).filter((record) => {
            const searchTarget = [
                record.teamName,
                record.note,
                ...record.foremen.flatMap((foreman) => [foreman.name, foreman.note])
            ].join(' ').toLowerCase();
            return !query || searchTarget.includes(query);
        });
    }, [records, searchTerm]);

    const updateQuantity = (teamId: string, equipmentId: string, value: string) => {
        setRecords((prev) => prev.map((record) => (
            record.id === teamId
                ? {
                    ...record,
                    quantities: {
                        ...record.quantities,
                        [equipmentId]: toQuantity(value)
                    }
                }
                : record
        )));
        setChangedIds((prev) => new Set(prev).add(teamId));
    };

    const updateForemanQuantity = (teamId: string, foremanId: string, equipmentId: string, value: string) => {
        setRecords((prev) => prev.map((record) => {
            if (record.id !== teamId) return record;
            const foremen = record.foremen.map((foreman) => (
                foreman.id === foremanId
                    ? {
                        ...foreman,
                        quantities: {
                            ...foreman.quantities,
                            [equipmentId]: toQuantity(value)
                        }
                    }
                    : foreman
            ));
            return {
                ...record,
                foremen,
                quantities: calculateForemanTotals(foremen, equipmentItems),
                useForemanTotals: true
            };
        }));
        setChangedIds((prev) => new Set(prev).add(teamId));
    };

    const updateForemanNote = (teamId: string, foremanId: string, note: string) => {
        setRecords((prev) => prev.map((record) => {
            if (record.id !== teamId) return record;
            const foremen = record.foremen.map((foreman) => (
                foreman.id === foremanId ? { ...foreman, note } : foreman
            ));
            return {
                ...record,
                foremen,
                useForemanTotals: true
            };
        }));
        setChangedIds((prev) => new Set(prev).add(teamId));
    };

    const updateNote = (teamId: string, note: string) => {
        setRecords((prev) => prev.map((record) => (
            record.id === teamId ? { ...record, note } : record
        )));
        setChangedIds((prev) => new Set(prev).add(teamId));
    };

    const saveRecord = async (id: string) => {
        if (loadError) {
            showToast('공용 DB를 정상적으로 불러오지 못한 상태에서는 데이터 보호를 위해 저장할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
            return;
        }
        const targetRecord = records.find((r) => r.id === id);
        if (!targetRecord) return;

        setSaving(true);
        try {
            const sharedState = await supportSharedDataService.load<PersistedEquipmentState>('team_equipment_inventory');
            const baseState = normalizePersistedState(sharedState) || buildPersistedState(equipmentItems, records);
            const nextState: PersistedEquipmentState = {
                catalogVersion: EQUIPMENT_CATALOG_VERSION,
                items: equipmentItems,
                rows: {
                    ...baseState.rows,
                    [id]: {
                        id: targetRecord.id,
                        quantities: targetRecord.quantities,
                        note: targetRecord.note,
                        foremen: targetRecord.foremen,
                        useForemanTotals: targetRecord.useForemanTotals
                    }
                }
            };
            await supportSharedDataService.save('team_equipment_inventory', nextState);
            persistLocalState(equipmentItems, records);
            setLoadError(null);
            setChangedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            showToast('저장되었습니다.');
        } catch (error) {
            console.error('[TeamEquipmentStatusPage] Failed to save team equipment record:', error);
            showToast('공용 DB 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    const saveAll = async () => {
        if (loadError) {
            showToast('공용 DB를 정상적으로 불러오지 못한 상태에서는 데이터 보호를 위해 저장할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
            return;
        }
        const saved = await persistSharedState(equipmentItems, records);
        if (!saved) return;
        setChangedIds(new Set());
        showToast('장비 수량을 저장했습니다.');
    };

    const addEquipmentItem = async () => {
        const name = normalizeKey(newEquipmentName);
        if (!name) {
            showToast('추가할 장비명을 입력하세요.');
            return;
        }

        const duplicate = equipmentItems.some((item) => item.name.localeCompare(name, 'ko-KR', { sensitivity: 'accent' }) === 0);
        if (duplicate) {
            showToast('이미 등록된 장비 항목입니다.');
            return;
        }

        const id = createEquipmentId(name, new Set(equipmentItems.map((item) => item.id)));
        const nextItems = [...equipmentItems, { id, name }];
        const nextRecords = records.map((record) => {
            const foremen = record.foremen.map((foreman) => ({
                ...foreman,
                quantities: {
                    ...foreman.quantities,
                    [id]: 0
                }
            }));
            return {
                ...record,
                foremen,
                quantities: {
                    ...record.quantities,
                    [id]: 0
                }
            };
        });

        const saved = await persistSharedState(nextItems, nextRecords);
        if (!saved) return;
        setEquipmentItems(nextItems);
        setRecords(nextRecords);
        setNewEquipmentName('');
        showToast(`${name} 항목을 추가했습니다.`);
    };

    const renameEquipmentItem = async () => {
        if (!editingEquipmentId || saving || loadError) return;
        const name = normalizeKey(equipmentNameDraft);
        if (!name) { showToast('장비명을 입력하세요.'); return; }
        if (equipmentItems.some(item => item.id !== editingEquipmentId && normalizeComparableText(item.name) === normalizeComparableText(name))) {
            showToast('이미 등록된 장비 이름입니다.');
            return;
        }
        setSaving(true);
        try {
            // A name edit must not also save unrelated, unsaved quantity edits.
            const shared = await supportSharedDataService.load<PersistedEquipmentState>('team_equipment_inventory');
            const base = normalizePersistedState(shared);
            const sourceItems = base?.items ?? equipmentItems;
            if (!sourceItems.some(item => item.id === editingEquipmentId)) throw new Error('Item no longer exists');
            if (sourceItems.some(item => item.id !== editingEquipmentId && normalizeComparableText(item.name) === normalizeComparableText(name))) {
                showToast('이미 등록된 장비 이름입니다.');
                return;
            }
            const nextItems = sourceItems.map(item => item.id === editingEquipmentId ? { ...item, name } : item);
            await supportSharedDataService.save('team_equipment_inventory', {
                catalogVersion: EQUIPMENT_CATALOG_VERSION,
                items: nextItems,
                rows: base?.rows ?? {},
            });
            setEquipmentItems(nextItems);
            setEditingEquipmentId(null);
            showToast('장비 이름을 변경했습니다. 기존 수량은 유지됩니다.');
        } catch (error) {
            console.error('[TeamEquipmentStatusPage] Failed to rename equipment:', error);
            showToast('장비 이름을 저장하지 못했습니다. 목록을 확인하고 다시 시도해 주세요.');
        } finally { setSaving(false); }
    };

    const addForeman = async (teamId: string) => {
        const name = normalizeKey(newForemanNames[teamId]);
        if (!name) {
            showToast('추가할 반장명을 입력하세요.');
            return;
        }

        const targetRecord = records.find((record) => record.id === teamId);
        if (!targetRecord) return;

        const duplicate = targetRecord.foremen.some((foreman) => (
            normalizeComparableText(foreman.name) === normalizeComparableText(name)
        ));
        if (duplicate) {
            showToast('이미 등록된 반장입니다.');
            return;
        }

        const id = createForemanId(name, new Set(targetRecord.foremen.map((foreman) => foreman.id)));
        const seedQuantities = targetRecord.foremen.length === 0
            ? equipmentItems.reduce<Record<string, number>>((acc, item) => {
                acc[item.id] = toQuantity(targetRecord.quantities[item.id]);
                return acc;
            }, {})
            : createEmptyQuantities(equipmentItems);
        const nextForeman: ForemanEquipmentMetric = {
            id,
            name,
            quantities: seedQuantities,
            note: ''
        };

        const nextRecords = records.map((record) => {
            if (record.id !== teamId) return record;
            const foremen = [...record.foremen, nextForeman].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
            return {
                ...record,
                foremen,
                quantities: calculateForemanTotals(foremen, equipmentItems),
                useForemanTotals: true
            };
        });

        const saved = await persistSharedState(equipmentItems, nextRecords);
        if (!saved) return;
        setRecords(nextRecords);
        setNewForemanNames((prev) => ({ ...prev, [teamId]: '' }));
        showToast(`${name} 반장 메뉴를 추가했습니다.`);
    };

    const removeForeman = async (teamId: string, foreman: ForemanEquipmentMetric) => {
        if (!window.confirm(`${foreman.name} 반장 하위메뉴를 삭제할까요? 입력된 수량도 함께 제거됩니다.`)) return;

        const nextRecords = records.map((record) => {
            if (record.id !== teamId) return record;
            const foremen = record.foremen.filter((item) => item.id !== foreman.id);
            return {
                ...record,
                foremen,
                quantities: calculateForemanTotals(foremen, equipmentItems),
                useForemanTotals: foremen.length > 0
            };
        });

        const saved = await persistSharedState(equipmentItems, nextRecords);
        if (!saved) return;
        setRecords(nextRecords);
        showToast(`${foreman.name} 반장 메뉴를 삭제했습니다.`);
    };

    const removeEquipmentItem = async (item: EquipmentItem) => {
        if (!window.confirm(`${item.name} 장비 항목을 삭제할까요? 입력된 수량도 함께 제거됩니다.`)) return;

        const nextItems = equipmentItems.filter((equipment) => equipment.id !== item.id);
        const nextRecords = records.map((record) => {
            const quantities = { ...record.quantities };
            delete quantities[item.id];
            const foremen = record.foremen.map((foreman) => {
                const foremanQuantities = { ...foreman.quantities };
                delete foremanQuantities[item.id];
                return { ...foreman, quantities: foremanQuantities };
            });
            return {
                ...record,
                foremen,
                quantities: record.isForemanBreakdown && record.useForemanTotals
                    ? calculateForemanTotals(foremen, nextItems)
                    : quantities
            };
        });

        const saved = await persistSharedState(nextItems, nextRecords);
        if (!saved) return;
        setEquipmentItems(nextItems);
        setRecords(nextRecords);
        showToast(`${item.name} 항목을 삭제했습니다.`);
    };

    const resetEquipmentData = async () => {
        if (!window.confirm('팀별 장비 수량과 비고를 초기화할까요? 장비 항목과 팀 정보는 유지됩니다.')) return;
        const nextRecords = records.map((record) => ({
            ...record,
            quantities: createEmptyQuantities(equipmentItems),
            note: '',
            foremen: record.foremen.map((foreman) => ({
                ...foreman,
                quantities: createEmptyQuantities(equipmentItems),
                note: ''
            })),
            useForemanTotals: record.isForemanBreakdown && record.foremen.length > 0
        }));
        const saved = await persistSharedState(equipmentItems, nextRecords);
        if (!saved) return;
        setRecords(nextRecords);
        setChangedIds(new Set());
        showToast('장비 수량과 비고를 초기화했습니다.');
    };

    const tableMinWidth = 222 + equipmentItems.length * 46;
    const controlsDisabled = loading || saving || Boolean(loadError);
    const visibleMainRecords = visibleRecords.filter(record => record.isForemanBreakdown);
    const visibleSubteamRecords = visibleRecords.filter(record => !record.isForemanBreakdown);
    const mainTeamCount = records.filter(record => record.isForemanBreakdown).length;
    const subteamCount = records.length - mainTeamCount;
    const isComposingKey = (event: React.KeyboardEvent<HTMLInputElement>) => (
        event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
    );
    const tableColumns = <colgroup>
        <col style={{ width: 100 }} />
        {equipmentItems.map(item => <col key={item.id} style={{ width: 46 }} />)}
        <col />
        <col style={{ width: 38 }} />
    </colgroup>;
    const tableHead = (name: string) => <thead><tr>
        <th scope="col">{name}</th>
        {equipmentItems.map(item => <th key={item.id} scope="col" title={item.name}>{item.name}</th>)}
        <th scope="col">비고</th><th scope="col"><span className="sr-only">관리</span></th>
    </tr></thead>;
    const renderTotals = (name: string, totals: Record<string, number>) => <section className="equipment-group-summary" aria-label={`${name} 총수량`}>
        <div className="equipment-summary-heading"><h3>{name} 총수량</h3>
            <strong aria-label={`${name} 전체 장비 수량`}>{equipmentItems.reduce((sum, item) => sum + totals[item.id], 0).toLocaleString('ko-KR')}<small>대</small></strong>
        </div>
        <div className="equipment-summary">
            {equipmentItems.map(item => <div key={item.id} className="equipment-total">
                <span><FontAwesomeIcon icon={item.id === 'impact' ? faWrench : faBoxesStacked} /> {item.name}</span>
                <strong aria-label={`${name} ${item.name} 총수량`}>{totals[item.id].toLocaleString('ko-KR')}<small>대</small></strong>
            </div>)}
        </div>
    </section>;
    const renderTeamRow = (record: TeamEquipmentRecord) => {
        const quantities = getRecordDisplayQuantities(record, equipmentItems);
        const locked = record.isForemanBreakdown && record.useForemanTotals;
        return <tr key={record.id} className={changedIds.has(record.id) ? 'is-changed' : ''}>
            <th scope="row"><div className="equipment-team-name" title={record.teamName}><i style={{ backgroundColor: record.teamColor }} /><span>{record.teamName}</span></div>
                {record.isForemanBreakdown && <small className="equipment-team-hint">{locked ? '반장별 합계' : '직접 입력'} · {record.foremen.length}명</small>}</th>
            {equipmentItems.map(item => <td key={item.id}>{locked
                ? <output className="equipment-derived" aria-label={`${record.teamName} ${item.name} 합계`}>{toQuantity(quantities[item.id])}</output>
                : <input type="number" min={0} step={1} aria-label={`${record.teamName} ${item.name} 수량`} value={quantities[item.id] ?? 0} disabled={controlsDisabled}
                    onChange={event => updateQuantity(record.id, item.id, event.target.value)} />}</td>)}
            <td><input className="equipment-note" aria-label={`${record.teamName} 비고`} value={record.note} placeholder="비고" disabled={controlsDisabled} onChange={event => updateNote(record.id, event.target.value)} /></td>
            <td><button type="button" className={`equipment-icon-button ${changedIds.has(record.id) ? 'equipment-primary' : ''}`} aria-label={`${record.teamName} 저장`} title="팀 저장" disabled={controlsDisabled} onClick={() => saveRecord(record.id)}><FontAwesomeIcon icon={faFloppyDisk} /></button></td>
        </tr>;
    };

    return (
        <div className="team-equipment-page">
            <div className="equipment-workspace">
                <header className="equipment-header">
                    <div className="equipment-heading">
                        <span className="equipment-heading-icon"><FontAwesomeIcon icon={faScrewdriverWrench} /></span>
                        <div><h1>시공팀 장비 수량 현황</h1><p>본팀과 새끼팀의 보유 장비를 각각 확인하세요.</p></div>
                    </div>
                    <div className="equipment-actions">
                        <button type="button" onClick={() => navigate('/support/vehicles')}><FontAwesomeIcon icon={faArrowLeft} /> 차량 관리</button>
                        <button type="button" disabled={loading || saving} onClick={() => setRefreshKey(prev => prev + 1)}><FontAwesomeIcon icon={faRotateRight} /> 팀정보 새로고침</button>
                    </div>
                </header>

                <div className="equipment-toolbar">
                    <label className="equipment-search"><FontAwesomeIcon icon={faMagnifyingGlass} />
                        <input aria-label="본팀·새끼팀·반장 검색" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="팀명, 반장명 또는 비고 검색" />
                    </label>
                    <span className="equipment-pending" role="status">{changedIds.size > 0 ? `${changedIds.size}팀 변경 · 저장 필요` : '시공팀 전체 보유 현황'}</span>
                    <button type="button" aria-expanded={showEquipmentManager} onClick={() => setShowEquipmentManager(prev => !prev)}><FontAwesomeIcon icon={faPen} /> 장비 항목 관리</button>
                    <button type="button" className="equipment-primary" onClick={saveAll} disabled={controlsDisabled}><FontAwesomeIcon icon={faFloppyDisk} /> {saving ? '저장 중…' : '전체 저장'}</button>
                </div>

                {showEquipmentManager && <section className="equipment-manager" aria-label="장비 항목 관리">
                    <div className="equipment-manager-heading"><div><h2>장비 항목 관리</h2><p>이름을 바꿔도 본팀·새끼팀의 기존 수량은 유지됩니다.</p></div>
                        <button type="button" className="equipment-danger" disabled={controlsDisabled} onClick={resetEquipmentData}><FontAwesomeIcon icon={faRotateLeft} /> 수량 초기화</button>
                    </div>
                    <div className="equipment-item-list">
                        {equipmentItems.map(item => <div key={item.id} className="equipment-item-editor">
                            {editingEquipmentId === item.id ? <>
                                <input autoFocus aria-label={`${item.name} 장비 이름`} value={equipmentNameDraft} disabled={controlsDisabled}
                                    onChange={event => setEquipmentNameDraft(event.target.value)}
                                    onKeyDown={event => {
                                        if (isComposingKey(event)) return;
                                        if (event.key === 'Enter') { event.preventDefault(); void renameEquipmentItem(); }
                                        if (event.key === 'Escape') setEditingEquipmentId(null);
                                    }} />
                                <button type="button" className="equipment-primary" disabled={controlsDisabled} onClick={renameEquipmentItem}>이름 저장</button>
                                <button type="button" disabled={saving} onClick={() => setEditingEquipmentId(null)}>취소</button>
                            </> : <>
                                <span>{item.name}</span>
                                <button type="button" className="equipment-icon-button" aria-label={`${item.name} 이름 수정`} title="이름 수정" disabled={controlsDisabled}
                                    onClick={() => { setEditingEquipmentId(item.id); setEquipmentNameDraft(item.name); }}><FontAwesomeIcon icon={faPen} /></button>
                                <button type="button" className="equipment-icon-button equipment-danger" aria-label={`${item.name} 삭제`} title="항목 삭제" disabled={controlsDisabled}
                                    onClick={() => removeEquipmentItem(item)}><FontAwesomeIcon icon={faTrash} /></button>
                            </>}
                        </div>)}
                    </div>
                    <div className="equipment-add-item">
                        <input aria-label="장비 항목 추가" value={newEquipmentName} disabled={controlsDisabled} onChange={event => setNewEquipmentName(event.target.value)} placeholder="새 장비 이름"
                            onKeyDown={event => { if (event.key === 'Enter' && !isComposingKey(event)) { event.preventDefault(); void addEquipmentItem(); } }} />
                        <button type="button" disabled={controlsDisabled} onClick={addEquipmentItem}><FontAwesomeIcon icon={faPlus} /> 항목 추가</button>
                    </div>
                </section>}

                {loadError && <div className="equipment-error" role="alert">{loadError}</div>}

                <div className="equipment-columns">
                    <section className="equipment-panel" aria-label="본팀 장비 현황">
                        <header className="equipment-panel-heading"><div><h2><FontAwesomeIcon icon={faUsers} /> 본팀</h2><p>이재욱팀 · 반장별 수량은 본팀 합계에 한 번만 반영됩니다.</p></div><span>{mainTeamCount}팀</span></header>
                        {renderTotals('본팀', equipmentTotals.main)}
                        <div className="equipment-table-scroll" tabIndex={0} aria-label="본팀 장비 표 스크롤">
                            <table className="equipment-table" style={{ minWidth: tableMinWidth }}>
                                {tableColumns}{tableHead('본팀')}
                                <tbody>
                                    {loading ? <tr><td colSpan={equipmentItems.length + 3} className="equipment-empty">팀 정보를 불러오는 중입니다.</td></tr>
                                    : visibleMainRecords.length === 0 ? <tr><td colSpan={equipmentItems.length + 3} className="equipment-empty">표시할 본팀이 없습니다.</td></tr>
                                    : visibleMainRecords.map(renderTeamRow)}
                                </tbody>
                            </table>
                        </div>
                        <footer className="equipment-panel-footer">조회 {visibleMainRecords.length.toLocaleString('ko-KR')} / {mainTeamCount.toLocaleString('ko-KR')}팀 · 총수량은 검색과 관계없이 표시됩니다.</footer>
                        {!loading && visibleMainRecords.map(record => {
                            const totals = calculateForemanTotals(record.foremen, equipmentItems);
                            return <section key={record.id} className="equipment-foreman-group" aria-label={`${record.teamName} 반장별 내역`}>
                                <div className="equipment-subteam-heading"><strong><i style={{ backgroundColor: record.teamColor }} />{record.teamName} <span>반장별</span></strong>
                                    <button type="button" className={changedIds.has(record.id) ? 'equipment-primary' : ''} disabled={controlsDisabled} onClick={() => saveRecord(record.id)} aria-label={`${record.teamName} 반장별 저장`}><FontAwesomeIcon icon={faFloppyDisk} /> 저장</button></div>
                                <div className="equipment-table-scroll" tabIndex={0} aria-label={`${record.teamName} 반장별 표 스크롤`}>
                                    <table className="equipment-table" style={{ minWidth: tableMinWidth }}>
                                        {tableColumns}{tableHead('반장')}
                                        <tbody>{record.foremen.length === 0
                                            ? <tr><td colSpan={equipmentItems.length + 3} className="equipment-empty">아래에서 반장을 추가하세요.</td></tr>
                                            : record.foremen.map(foreman => <tr key={foreman.id}>
                                                <th scope="row" title={foreman.name}><span className="equipment-foreman-name">{foreman.name}</span></th>
                                                {equipmentItems.map(item => <td key={item.id}><input type="number" min={0} step={1} aria-label={`${record.teamName} ${foreman.name} ${item.name} 수량`}
                                                    value={foreman.quantities[item.id] ?? 0} disabled={controlsDisabled} onChange={event => updateForemanQuantity(record.id, foreman.id, item.id, event.target.value)} /></td>)}
                                                <td><input className="equipment-note" aria-label={`${record.teamName} ${foreman.name} 비고`} value={foreman.note} placeholder="비고" disabled={controlsDisabled} onChange={event => updateForemanNote(record.id, foreman.id, event.target.value)} /></td>
                                                <td><button type="button" className="equipment-icon-button equipment-danger" aria-label={`${foreman.name} 반장 삭제`} title="반장 삭제" disabled={controlsDisabled} onClick={() => removeForeman(record.id, foreman)}><FontAwesomeIcon icon={faTrash} /></button></td>
                                            </tr>)}</tbody>
                                        <tfoot><tr><th scope="row">반장별 합계</th>{equipmentItems.map(item => <td key={item.id}><output aria-label={`${record.teamName} 반장별 ${item.name} 합계`}>{totals[item.id]}</output></td>)}<td colSpan={2} /></tr></tfoot>
                                    </table>
                                </div>
                                <div className="equipment-add-foreman"><input aria-label={`${record.teamName} 반장명 추가`} placeholder="반장명 추가" disabled={controlsDisabled} value={newForemanNames[record.id] ?? ''}
                                    onChange={event => setNewForemanNames(prev => ({ ...prev, [record.id]: event.target.value }))}
                                    onKeyDown={event => { if (event.key === 'Enter' && !isComposingKey(event)) { event.preventDefault(); void addForeman(record.id); } }} />
                                    <button type="button" disabled={controlsDisabled} onClick={() => addForeman(record.id)}><FontAwesomeIcon icon={faPlus} /> 반장 추가</button></div>
                            </section>;
                        })}
                    </section>

                    <section className="equipment-panel equipment-subteams" aria-label="새끼팀 장비 현황">
                        <header className="equipment-panel-heading"><div><h2><FontAwesomeIcon icon={faUsers} /> 새끼팀</h2><p>이재욱팀 외 시공팀의 보유 장비입니다.</p></div><span>{subteamCount}팀</span></header>
                        {renderTotals('새끼팀', equipmentTotals.subteams)}
                        <div className="equipment-table-scroll" tabIndex={0} aria-label="새끼팀 장비 표 스크롤">
                            <table className="equipment-table" style={{ minWidth: tableMinWidth }}>
                                {tableColumns}{tableHead('새끼팀')}
                                <tbody>
                                    {loading ? <tr><td colSpan={equipmentItems.length + 3} className="equipment-empty">팀 정보를 불러오는 중입니다.</td></tr>
                                    : visibleSubteamRecords.length === 0 ? <tr><td colSpan={equipmentItems.length + 3} className="equipment-empty">표시할 새끼팀이 없습니다.</td></tr>
                                    : visibleSubteamRecords.map(renderTeamRow)}
                                </tbody>
                            </table>
                        </div>
                        <footer className="equipment-panel-footer">조회 {visibleSubteamRecords.length.toLocaleString('ko-KR')} / {subteamCount.toLocaleString('ko-KR')}팀 · 총수량은 검색과 관계없이 표시됩니다.</footer>
                    </section>
                </div>
            </div>
            {toastVisible && <div className="equipment-toast" role="status">{toastMessage}</div>}
        </div>
    );
};

export default TeamEquipmentStatusPage;
