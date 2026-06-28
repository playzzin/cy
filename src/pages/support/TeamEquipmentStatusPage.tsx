import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBoxesStacked,
    faChevronDown,
    faChevronRight,
    faFloppyDisk,
    faMagnifyingGlass,
    faPlus,
    faRotateLeft,
    faRotateRight,
    faScrewdriverWrench,
    faTrash,
    faUsers,
    faWrench
} from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';

interface EquipmentItem {
    id: string;
    name: string;
}

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
    items?: EquipmentItem[];
    rows?: Record<string, TeamEquipmentMetric>;
};

type LegacyEquipmentInput = {
    id?: string;
    impact?: boolean | number;
    skill?: boolean | number;
    note?: string;
};

const STORAGE_KEY = 'team_equipment_inventory_v2';
const LEGACY_STORAGE_KEY = 'team_equipment_status_v1';
const DEFAULT_TEAM_COLOR = '#94a3b8';
const FOREMAN_BREAKDOWN_TEAM_NAME = '이재욱팀';
const DEFAULT_EQUIPMENT_ITEMS: EquipmentItem[] = [
    { id: 'impact', name: '임팩' },
    { id: 'skill', name: '스킬' }
];

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

const loadSavedState = (): { items: EquipmentItem[]; rows: Record<string, TeamEquipmentMetric> } => {
    if (typeof window === 'undefined') {
        return { items: DEFAULT_EQUIPMENT_ITEMS, rows: {} };
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as PersistedEquipmentState : null;
        if (parsed && typeof parsed === 'object') {
            const items = normalizeItems(parsed.items, !Array.isArray(parsed.items));
            const rows = Object.entries(parsed.rows ?? {}).reduce<Record<string, TeamEquipmentMetric>>((acc, [id, value]) => {
                const key = normalizeKey(id);
                if (!key) return acc;
                acc[key] = normalizeMetric(key, value as Partial<TeamEquipmentMetric>, items);
                return acc;
            }, {});
            return { items, rows };
        }
    } catch (error) {
        console.warn('[TeamEquipmentStatusPage] Failed to load equipment inventory:', error);
    }

    try {
        const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const legacyParsed = legacyRaw ? JSON.parse(legacyRaw) : null;
        if (!legacyParsed || typeof legacyParsed !== 'object') {
            return { items: DEFAULT_EQUIPMENT_ITEMS, rows: {} };
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

        return { items: DEFAULT_EQUIPMENT_ITEMS, rows };
    } catch (error) {
        console.warn('[TeamEquipmentStatusPage] Failed to migrate legacy equipment status:', error);
        return { items: DEFAULT_EQUIPMENT_ITEMS, rows: {} };
    }
};

const persistState = (items: EquipmentItem[], records: TeamEquipmentRecord[]) => {
    if (typeof window === 'undefined') return;

    const payload: PersistedEquipmentState = {
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
    };
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

const inputClassName = (changed = false) => (
    `h-10 w-24 rounded-lg border px-2.5 py-2 text-right text-sm font-black tabular-nums text-slate-900 outline-none transition-colors ${
        changed
            ? 'border-sky-400 bg-sky-50'
            : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
    }`
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
    const [newForemanNames, setNewForemanNames] = useState<Record<string, string>>({});
    const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(() => new Set());
    const [changedIds, setChangedIds] = useState<Set<string>>(() => new Set());
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
            const savedState = loadSavedState();
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
            setExpandedTeamIds((prev) => {
                const next = new Set(prev);
                nextRecords
                    .filter((record) => record.isForemanBreakdown)
                    .forEach((record) => next.add(record.id));
                return next;
            });
            setChangedIds(new Set());
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

    const equipmentTotals = useMemo(() => {
        return equipmentItems.map((item) => ({
            ...item,
            total: records.reduce((sum, record) => {
                const quantities = getRecordDisplayQuantities(record, equipmentItems);
                return sum + toQuantity(quantities[item.id]);
            }, 0)
        }));
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

    const saveRecord = (id: string) => {
        persistState(equipmentItems, records);
        setChangedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        showToast('저장되었습니다.');
    };

    const saveAll = () => {
        persistState(equipmentItems, records);
        setChangedIds(new Set());
        showToast('장비 수량을 저장했습니다.');
    };

    const addEquipmentItem = () => {
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

        setEquipmentItems(nextItems);
        setRecords(nextRecords);
        setNewEquipmentName('');
        persistState(nextItems, nextRecords);
        showToast(`${name} 항목을 추가했습니다.`);
    };

    const addForeman = (teamId: string) => {
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

        setRecords(nextRecords);
        setNewForemanNames((prev) => ({ ...prev, [teamId]: '' }));
        setExpandedTeamIds((prev) => new Set(prev).add(teamId));
        persistState(equipmentItems, nextRecords);
        showToast(`${name} 반장 메뉴를 추가했습니다.`);
    };

    const removeForeman = (teamId: string, foreman: ForemanEquipmentMetric) => {
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

        setRecords(nextRecords);
        persistState(equipmentItems, nextRecords);
        showToast(`${foreman.name} 반장 메뉴를 삭제했습니다.`);
    };

    const removeEquipmentItem = (item: EquipmentItem) => {
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

        setEquipmentItems(nextItems);
        setRecords(nextRecords);
        persistState(nextItems, nextRecords);
        showToast(`${item.name} 항목을 삭제했습니다.`);
    };

    const resetEquipmentData = () => {
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
        setRecords(nextRecords);
        setChangedIds(new Set());
        persistState(equipmentItems, nextRecords);
        showToast('장비 수량과 비고를 초기화했습니다.');
    };

    const tableMinWidth = Math.max(820, 480 + equipmentItems.length * 150);

    return (
        <div className="min-h-screen w-[calc(100vw-30px)] max-w-full overflow-x-hidden bg-slate-50 px-3 py-4 text-slate-900 sm:w-full sm:p-6 xl:p-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
                <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-100">
                                <FontAwesomeIcon icon={faScrewdriverWrench} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                    시공팀 장비 수량 현황
                                </h1>
                                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                                    시공팀만 표시하고, 장비별 보유 수량과 비고를 팀별로 저장합니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/support/vehicles')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
                                차량 관리
                            </button>
                            <button
                                type="button"
                                onClick={() => setRefreshKey((prev) => prev + 1)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <FontAwesomeIcon icon={faRotateRight} className={loading ? 'spin' : ''} />
                                팀정보 새로고침
                            </button>
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                                시공팀 전용 · 팀색상 자동반영 · 수량 로컬저장
                            </div>
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {equipmentTotals.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-500">
                                    <FontAwesomeIcon icon={item.id === 'impact' ? faWrench : faBoxesStacked} />
                                    <span className="truncate">{item.name}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeEquipmentItem(item)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-xs text-red-600 transition-colors hover:bg-red-100"
                                    title={`${item.name} 삭제`}
                                    aria-label={`${item.name} 삭제`}
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                            <strong className="mt-2 block text-3xl font-black tracking-tight text-slate-950">
                                {item.total.toLocaleString('ko-KR')}
                            </strong>
                        </div>
                    ))}
                </section>

                <main className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="grid gap-2 xl:grid-cols-[minmax(220px,1fr)_minmax(240px,360px)_auto_auto] xl:items-center">
                        <label className="relative block min-w-0">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="팀명 또는 비고 검색"
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <div className="flex min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <input
                                value={newEquipmentName}
                                onChange={(event) => setNewEquipmentName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addEquipmentItem();
                                    }
                                }}
                                placeholder="장비 항목 추가"
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={addEquipmentItem}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                추가
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={saveAll}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-700"
                        >
                            <FontAwesomeIcon icon={faFloppyDisk} />
                            전체 저장
                        </button>

                        <button
                            type="button"
                            onClick={resetEquipmentData}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition-colors hover:bg-red-100"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            수량 초기화
                        </button>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-500">
                            <FontAwesomeIcon icon={faBoxesStacked} />
                            항목 관리
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {equipmentItems.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-400">
                                    등록된 장비 항목이 없습니다. 위 입력창에서 항목을 추가하세요.
                                </div>
                            ) : equipmentTotals.map((item) => (
                                <div
                                    key={item.id}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm"
                                >
                                    <span>{item.name}</span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                        {item.total.toLocaleString('ko-KR')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeEquipmentItem(item)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                                        title={`${item.name} 삭제`}
                                        aria-label={`${item.name} 삭제`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                        상단 현황은 현재 조회된 시공팀 전체의 장비별 총수량입니다. 항목은 위 입력창에서 추가하고, 항목 관리의 삭제 버튼으로 제거할 수 있습니다.
                    </div>

                    {loadError && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                            {loadError}
                        </div>
                    )}

                    <div className="support-scroll-x mt-4 rounded-2xl border border-slate-200">
                        <table className="w-full border-collapse bg-white text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
                            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-black">팀</th>
                                    {equipmentItems.map((item) => (
                                        <th key={item.id} className="px-3 py-3 text-right text-xs font-black">
                                            {item.name}
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-left text-xs font-black">비고</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={equipmentItems.length + 3} className="px-3 py-16 text-center text-sm font-bold text-slate-400">
                                            팀 정보를 불러오는 중입니다.
                                        </td>
                                    </tr>
                                ) : visibleRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={equipmentItems.length + 3} className="px-3 py-8">
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                                                표시할 시공팀이 없습니다.
                                            </div>
                                        </td>
                                    </tr>
                                ) : visibleRecords.map((record) => {
                                    const changed = changedIds.has(record.id);
                                    const expanded = expandedTeamIds.has(record.id);
                                    const displayQuantities = getRecordDisplayQuantities(record, equipmentItems);
                                    const lockTeamInputs = record.isForemanBreakdown && record.useForemanTotals;
                                    const foremanTotals = calculateForemanTotals(record.foremen, equipmentItems);

                                    return (
                                        <React.Fragment key={record.id}>
                                            <tr className={`border-b border-slate-100 transition-colors ${changed ? 'bg-sky-50' : 'bg-white hover:bg-slate-50'}`}>
                                                <td className="px-3 py-2 font-black text-slate-900">
                                                    <span className="inline-flex items-center gap-2">
                                                        {record.isForemanBreakdown && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedTeamIds((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(record.id)) {
                                                                        next.delete(record.id);
                                                                    } else {
                                                                        next.add(record.id);
                                                                    }
                                                                    return next;
                                                                })}
                                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-xs text-blue-700 transition-colors hover:bg-blue-100"
                                                                aria-expanded={expanded}
                                                                aria-label={`${record.teamName} 반장별 하위메뉴 ${expanded ? '접기' : '펼치기'}`}
                                                                title={`반장별 하위메뉴 ${expanded ? '접기' : '펼치기'}`}
                                                            >
                                                                <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
                                                            </button>
                                                        )}
                                                        <span
                                                            className="inline-block h-5 w-1.5 rounded-full shadow-sm"
                                                            style={{ backgroundColor: record.teamColor }}
                                                            aria-hidden="true"
                                                        />
                                                        <span className="min-w-0">
                                                            <span className="flex items-center gap-2">
                                                                <span className="truncate">{record.teamName}</span>
                                                                {record.isForemanBreakdown && (
                                                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">
                                                                        반장별
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {record.isForemanBreakdown && (
                                                                <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                                                                    반장 {record.foremen.length.toLocaleString('ko-KR')}명 · {record.useForemanTotals ? '하위 합계 적용' : '팀 직접 입력'}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </span>
                                                </td>
                                                {equipmentItems.map((item) => (
                                                    <td key={item.id} className="px-3 py-2 text-right">
                                                        {lockTeamInputs ? (
                                                            <span className="inline-flex h-10 w-24 items-center justify-end rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-sm font-black tabular-nums text-blue-800">
                                                                {toQuantity(displayQuantities[item.id]).toLocaleString('ko-KR')}
                                                            </span>
                                                        ) : (
                                                            <input
                                                                value={displayQuantities[item.id] ?? 0}
                                                                type="number"
                                                                min={0}
                                                                step={1}
                                                                onChange={(event) => updateQuantity(record.id, item.id, event.target.value)}
                                                                className={inputClassName(changed)}
                                                            />
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2">
                                                    <input
                                                        value={record.note}
                                                        onChange={(event) => updateNote(record.id, event.target.value)}
                                                        placeholder="비고 입력"
                                                        className={`w-full min-w-[220px] rounded-lg border px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-colors ${
                                                            changed
                                                                ? 'border-sky-400 bg-white'
                                                                : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                                                        }`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => saveRecord(record.id)}
                                                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                                                                changed
                                                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            <FontAwesomeIcon icon={faFloppyDisk} />
                                                            저장
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {record.isForemanBreakdown && expanded && (
                                                <tr className="border-b border-blue-100 bg-blue-50/40">
                                                    <td colSpan={equipmentItems.length + 3} className="px-3 py-3">
                                                        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
                                                            <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/70 p-3 xl:flex-row xl:items-center xl:justify-between">
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="text-sm font-black text-blue-900">이재욱팀 반장별 하위메뉴</span>
                                                                        {equipmentItems.map((item) => (
                                                                            <span key={item.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700">
                                                                                {item.name} {toQuantity(foremanTotals[item.id]).toLocaleString('ko-KR')}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    <div className="mt-1 text-xs font-semibold text-blue-700/80">
                                                                        반장별 입력값 합계가 이재욱팀 행과 상단 총수량에 반영됩니다.
                                                                    </div>
                                                                </div>

                                                                <div className="flex min-w-0 gap-2">
                                                                    <input
                                                                        value={newForemanNames[record.id] ?? ''}
                                                                        onChange={(event) => setNewForemanNames((prev) => ({ ...prev, [record.id]: event.target.value }))}
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                addForeman(record.id);
                                                                            }
                                                                        }}
                                                                        placeholder="반장명 추가"
                                                                        className="min-w-0 flex-1 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addForeman(record.id)}
                                                                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700"
                                                                    >
                                                                        <FontAwesomeIcon icon={faPlus} />
                                                                        반장 추가
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {record.foremen.length === 0 ? (
                                                                <div className="p-5 text-center text-sm font-bold text-slate-400">
                                                                    등록된 반장 하위메뉴가 없습니다. 반장명을 추가하면 장비별 수량을 입력할 수 있습니다.
                                                                </div>
                                                            ) : (
                                                                <div className="support-scroll-x">
                                                                    <table className="w-full border-collapse text-sm" style={{ minWidth: `${Math.max(700, 360 + equipmentItems.length * 130)}px` }}>
                                                                        <thead className="bg-white text-slate-500">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left text-xs font-black">반장</th>
                                                                                {equipmentItems.map((item) => (
                                                                                    <th key={item.id} className="px-3 py-2 text-right text-xs font-black">
                                                                                        {item.name}
                                                                                    </th>
                                                                                ))}
                                                                                <th className="px-3 py-2 text-left text-xs font-black">비고</th>
                                                                                <th className="px-3 py-2 text-right text-xs font-black">관리</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {record.foremen.map((foreman) => (
                                                                                <tr key={foreman.id} className="border-t border-slate-100">
                                                                                    <td className="px-3 py-2 font-black text-slate-800">
                                                                                        {foreman.name}
                                                                                    </td>
                                                                                    {equipmentItems.map((item) => (
                                                                                        <td key={item.id} className="px-3 py-2 text-right">
                                                                                            <input
                                                                                                value={foreman.quantities[item.id] ?? 0}
                                                                                                type="number"
                                                                                                min={0}
                                                                                                step={1}
                                                                                                onChange={(event) => updateForemanQuantity(record.id, foreman.id, item.id, event.target.value)}
                                                                                                className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm font-black tabular-nums text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                                                            />
                                                                                        </td>
                                                                                    ))}
                                                                                    <td className="px-3 py-2">
                                                                                        <input
                                                                                            value={foreman.note}
                                                                                            onChange={(event) => updateForemanNote(record.id, foreman.id, event.target.value)}
                                                                                            placeholder="비고 입력"
                                                                                            className="w-full min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-3 py-2">
                                                                                        <div className="flex justify-end">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => removeForeman(record.id, foreman)}
                                                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-xs text-red-600 transition-colors hover:bg-red-100"
                                                                                                title={`${foreman.name} 반장 삭제`}
                                                                                                aria-label={`${foreman.name} 반장 삭제`}
                                                                                            >
                                                                                                <FontAwesomeIcon icon={faTrash} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                        <span>조회 {visibleRecords.length.toLocaleString('ko-KR')} / {records.length.toLocaleString('ko-KR')}팀</span>
                        <span className="inline-flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faUsers} />
                            시공팀만 표시
                        </span>
                    </div>
                </main>
            </div>

            <div
                className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-slate-300 transition-all ${
                    toastVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
                }`}
            >
                {toastMessage}
            </div>
        </div>
    );
};

export default TeamEquipmentStatusPage;
