import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faCar,
    faCircleCheck,
    faClock,
    faFloppyDisk,
    faGaugeHigh,
    faOilCan,
    faRotateLeft,
    faRotateRight,
    faSearch,
    faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons';
import { Vehicle } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { supportSharedDataService } from '../../services/supportSharedDataService';
import { useRestrictedTeamWorkflow } from '../../routes/TeamWorkflowGate';
import { getTeamScopedRows } from '../../services/teamScopedReadService';
import { saveTeamVehicleOil } from '../../services/teamVehicleOilService';
import './EngineOilCyclePage.css';

type OilStatusType = 'danger' | 'warning' | 'normal';
type OilFilterType = OilStatusType | 'all';

interface EngineOilMetric {
    id: string;
    currentKm: number;
    lastOilKm: number;
    cycleKm: number;
}

interface EngineOilRecord extends EngineOilMetric {
    plate: string;
    team: string;
    teamColor: string;
}

interface EngineOilDraft {
    id: string;
    currentKm: string;
    lastOilKm: string;
    cycleKm: string;
}

interface OilStatus {
    type: OilStatusType;
    label: string;
    nextKm: number;
    remainKm: number;
}

interface TeamInfo {
    name: string;
    color: string;
}

type EngineOilMetricInput = {
    id?: string;
    currentKm?: number | string;
    lastOilKm?: number | string;
    cycleKm?: number | string;
};

const STORAGE_KEY = 'engine_oil_vehicle_metrics_v2';
const MIGRATION_KEY = 'engine_oil_vehicle_metrics_firestore_migrated_v1';
const DEFAULT_TEAM_COLOR = '#94a3b8';
const DEFAULT_CYCLE_KM = 8000;

const defaultMetric = (id: string, cycleKm = DEFAULT_CYCLE_KM): EngineOilMetric => ({
    id,
    currentKm: 0,
    lastOilKm: 0,
    cycleKm
});

const toNumber = (value: unknown): number => {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
};

const normalizeMetric = (id: string, value?: EngineOilMetricInput, fallbackCycle = DEFAULT_CYCLE_KM): EngineOilMetric => {
    const currentKm = Math.max(0, toNumber(value?.currentKm));
    const lastOilKm = Math.max(0, toNumber(value?.lastOilKm));
    const cycleKm = Math.max(1, toNumber(value?.cycleKm || fallbackCycle));

    return { id, currentKm, lastOilKm, cycleKm };
};

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const normalizeColor = (value: unknown): string => {
    const color = normalizeKey(value);
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    if (/^#[0-9a-fA-F]{3}$/.test(color)) return color;
    return DEFAULT_TEAM_COLOR;
};

const normalizeMetricMap = (value: unknown): Record<string, EngineOilMetric> => {
    if (!value || typeof value !== 'object') return {};
    const entries = Array.isArray(value)
        ? value.map((item) => [String((item as EngineOilMetricInput).id ?? ''), item] as const)
        : Object.entries(value);

    return entries.reduce<Record<string, EngineOilMetric>>((acc, [id, metric]) => {
        const key = normalizeKey(id);
        if (!key) return acc;
        acc[key] = normalizeMetric(key, metric as EngineOilMetricInput);
        return acc;
    }, {});
};

const mergeMetricMaps = (
    sharedMetrics: Record<string, EngineOilMetricInput>,
    localMetrics: Record<string, EngineOilMetric>
): Record<string, EngineOilMetric> => {
    const merged = normalizeMetricMap(sharedMetrics);
    Object.entries(localMetrics).forEach(([id, localMetric]) => {
        const sharedMetric = merged[id];
        if (!sharedMetric) {
            merged[id] = localMetric;
            return;
        }

        merged[id] = {
            id,
            currentKm: sharedMetric.currentKm > 0 ? sharedMetric.currentKm : localMetric.currentKm,
            lastOilKm: sharedMetric.lastOilKm > 0 ? sharedMetric.lastOilKm : localMetric.lastOilKm,
            // Preserve an explicitly saved cycle, including a previous default.
            cycleKm: toNumber(sharedMetrics[id]?.cycleKm) > 0 ? sharedMetric.cycleKm : localMetric.cycleKm
        };
    });
    return merged;
};

const needsLocalMigration = (): boolean => (
    typeof window !== 'undefined'
    && Boolean(window.localStorage.getItem(STORAGE_KEY))
    && window.localStorage.getItem(MIGRATION_KEY) !== 'done'
);

const markLocalMigrationComplete = () => {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(MIGRATION_KEY, 'done');
    }
};

const loadLocalSavedMetrics = (): Record<string, EngineOilMetric> => {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return normalizeMetricMap(raw ? JSON.parse(raw) : null);
    } catch (error) {
        console.warn('[EngineOilCyclePage] Failed to load local oil metrics:', error);
        return {};
    }
};

const buildMetricPayload = (records: EngineOilRecord[]) => (
    records.reduce<Record<string, EngineOilMetric>>((acc, record) => {
        acc[record.id] = {
            id: record.id,
            currentKm: record.currentKm,
            lastOilKm: record.lastOilKm,
            cycleKm: record.cycleKm
        };
        return acc;
    }, {})
);

const persistLocalMetrics = (records: EngineOilRecord[]) => {
    if (typeof window === 'undefined') return;
    const payload = buildMetricPayload(records);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const toDraft = (record: EngineOilRecord): EngineOilDraft => ({
    id: record.id,
    currentKm: String(record.currentKm),
    lastOilKm: String(record.lastOilKm),
    cycleKm: String(record.cycleKm)
});

const toDraftMap = (records: EngineOilRecord[]): Record<string, EngineOilDraft> => (
    records.reduce<Record<string, EngineOilDraft>>((acc, record) => {
        acc[record.id] = toDraft(record);
        return acc;
    }, {})
);

const formatKm = (value: number): string => `${Number(value || 0).toLocaleString('ko-KR')}km`;

const formatDraftKm = (value: string): string => {
    const [integer, fraction] = value.split('.');
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};

const getOilStatus = (record: EngineOilRecord): OilStatus => {
    const nextKm = Number(record.lastOilKm || 0) + Number(record.cycleKm || DEFAULT_CYCLE_KM);
    const remainKm = nextKm - Number(record.currentKm || 0);

    if (remainKm <= 1000) {
        return { type: 'danger', label: '즉시교체', nextKm, remainKm };
    }
    if (remainKm <= 3000) {
        return { type: 'warning', label: '교체예정', nextKm, remainKm };
    }
    return { type: 'normal', label: '정상', nextKm, remainKm };
};

const OIL_STATUS_ORDER: Record<OilStatusType, number> = { danger: 0, warning: 1, normal: 2 };

const compareByOilStatus = (a: EngineOilRecord, b: EngineOilRecord): number => {
    const left = getOilStatus(a);
    const right = getOilStatus(b);
    if (OIL_STATUS_ORDER[left.type] !== OIL_STATUS_ORDER[right.type]) return OIL_STATUS_ORDER[left.type] - OIL_STATUS_ORDER[right.type];
    if (left.remainKm !== right.remainKm) return left.remainKm - right.remainKm;
    return a.plate.localeCompare(b.plate, 'ko-KR');
};

const sortByTeamAndOilStatus = (records: EngineOilRecord[]): EngineOilRecord[] => {
    return [...records].sort((a, b) => {
        const teamCompare = a.team.localeCompare(b.team, 'ko-KR');
        if (teamCompare !== 0) return teamCompare;
        return compareByOilStatus(a, b);
    });
};

const parseDraft = (draft: EngineOilDraft): EngineOilMetric => (
    normalizeMetric(draft.id, {
        currentKm: draft.currentKm,
        lastOilKm: draft.lastOilKm,
        cycleKm: draft.cycleKm
    })
);

const buildLookup = <T extends { id?: unknown; legacyId?: unknown; name?: unknown }>(rows: T[]) => {
    const byId = new Map<string, T>();
    const byName = new Map<string, T>();
    rows.forEach((row) => {
        [row.id, row.legacyId].forEach((key) => {
            const normalized = normalizeKey(key);
            if (normalized) byId.set(normalized, row);
        });
        const name = normalizeKey(row.name);
        if (name && !byName.has(name)) byName.set(name, row);
    });
    return { byId, byName };
};

const buildTeamInfo = (team?: Team | null, fallbackName = '미배정', fallbackColor?: unknown): TeamInfo => ({
    name: normalizeKey(team?.name) || fallbackName,
    color: normalizeColor(team?.color || fallbackColor)
});

const resolveTeamInfo = (
    vehicle: Vehicle,
    workersById: Map<string, Worker>,
    workersByName: Map<string, Worker>,
    teamsById: Map<string, Team>,
    teamsByName: Map<string, Team>
): TeamInfo => {
    if (vehicle.currentAssigneeType === 'TEAM') {
        const name = normalizeKey(vehicle.currentAssigneeName);
        const team = teamsById.get(normalizeKey(vehicle.currentAssigneeId)) ?? teamsByName.get(name);
        return buildTeamInfo(team, name || '미배정');
    }

    if (vehicle.currentAssigneeType === 'WORKER') {
        const worker = workersById.get(normalizeKey(vehicle.currentAssigneeId)) ?? workersByName.get(normalizeKey(vehicle.currentAssigneeName));
        const team = teamsById.get(normalizeKey(worker?.teamId)) ?? teamsByName.get(normalizeKey(worker?.teamName));
        return buildTeamInfo(team, normalizeKey(worker?.teamName) || '개인배정', (worker as any)?.color);
    }

    if (vehicle.billingTargetType === 'TEAM') {
        const name = normalizeKey(vehicle.billingTargetName);
        const team = teamsById.get(normalizeKey(vehicle.billingTargetId)) ?? teamsByName.get(name);
        return buildTeamInfo(team, name || '미배정');
    }

    if (vehicle.billingTargetType === 'OFFICE' || vehicle.billingTargetType === 'OFFICE_STAFF') {
        return { name: '사무실', color: '#64748b' };
    }

    return { name: '미배정', color: DEFAULT_TEAM_COLOR };
};

const statusIcon = {
    danger: faTriangleExclamation,
    warning: faClock,
    normal: faCircleCheck
};

const statusClasses = {
    danger: {
        row: 'bg-red-50',
        firstCell: 'bg-red-100',
        badge: 'border-red-200 bg-red-600 text-white',
        text: 'text-red-700',
        border: 'border-red-200'
    },
    warning: {
        row: 'bg-amber-50',
        firstCell: 'bg-amber-100',
        badge: 'border-amber-200 bg-amber-400 text-slate-950',
        text: 'text-amber-700',
        border: 'border-amber-200'
    },
    normal: {
        row: 'bg-emerald-50',
        firstCell: 'bg-emerald-100',
        badge: 'border-emerald-200 bg-emerald-500 text-white',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
    }
};

const inputClassName = (changed = false) => (
    `w-full min-w-24 rounded-lg border px-2.5 py-2 text-right text-sm tabular-nums text-slate-900 outline-none transition-colors ${
        changed
            ? 'border-sky-400 bg-sky-50'
            : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-100'
    }`
);

const EngineOilCyclePage: React.FC = () => {
    const restricted = useRestrictedTeamWorkflow();
    const navigate = useNavigate();
    const [oilState, setOilState] = useState<{ records: EngineOilRecord[]; drafts: Record<string, EngineOilDraft> }>({
        records: [],
        drafts: {}
    });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeFilter, setActiveFilter] = useState<OilFilterType>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [globalCycleKm, setGlobalCycleKm] = useState(String(DEFAULT_CYCLE_KM));
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

    const loadVehicleRecords = async (isCancelled: () => boolean) => {
        setLoading(true);
        setLoadError(null);
        setOilState({ records: [], drafts: {} });
        setChangedIds(new Set());
        try {
            if (restricted) {
                const records = await getTeamScopedRows<EngineOilRecord>('vehicle_oil_summary');
                if (isCancelled()) return;
                if (!records) throw new Error('소속 팀 차량 조회 권한을 확인하지 못했습니다.');
                setOilState({ records, drafts: toDraftMap(records) });
                return;
            }
            const [vehicles, workers, teams] = await Promise.all([
                vehicleService.getVehicles(),
                manpowerService.getWorkers().catch(() => [] as Worker[]),
                teamService.getTeams().catch(() => [] as Team[])
            ]);

            const localMetrics = loadLocalSavedMetrics();
            let savedMetrics = localMetrics;
            let loadWarning: string | null = null;
            let migratedLocalData = false;

            try {
                const sharedMetrics = await supportSharedDataService.load<Record<string, EngineOilMetric>>('engine_oil_cycle');
                if (sharedMetrics) {
                    const normalizedSharedMetrics = normalizeMetricMap(sharedMetrics);
                    if (needsLocalMigration()) {
                        savedMetrics = mergeMetricMaps(sharedMetrics, localMetrics);
                        await supportSharedDataService.save('engine_oil_cycle', savedMetrics);
                        migratedLocalData = true;
                    } else {
                        savedMetrics = normalizedSharedMetrics;
                    }
                    markLocalMigrationComplete();
                } else if (Object.keys(localMetrics).length > 0) {
                    await supportSharedDataService.save('engine_oil_cycle', localMetrics);
                    migratedLocalData = true;
                    markLocalMigrationComplete();
                }
            } catch (sharedDataError) {
                console.error('[EngineOilCyclePage] Failed to load shared oil metrics:', sharedDataError);
                loadWarning = '공용 DB를 불러오지 못해 이 브라우저의 임시 사본을 표시합니다. 새로고침 후 다시 확인해 주세요.';
            }

            const workerLookup = buildLookup(workers);
            const teamLookup = buildLookup(teams);
            const records = vehicles
                .map((vehicle) => {
                    const id = normalizeKey(vehicle.id);
                    const saved = savedMetrics[id];
                    const metric = saved ? normalizeMetric(id, saved) : defaultMetric(id);
                    const team = resolveTeamInfo(vehicle, workerLookup.byId, workerLookup.byName, teamLookup.byId, teamLookup.byName);

                    return {
                        ...metric,
                        plate: normalizeKey(vehicle.licensePlate) || '-',
                        team: team.name,
                        teamColor: team.color
                    };
                })
                .filter((record) => Boolean(record.id));

            if (isCancelled()) return;
            setOilState({
                records,
                drafts: toDraftMap(records)
            });
            persistLocalMetrics(records);
            setLoadError(loadWarning);
            setChangedIds(new Set());
            if (migratedLocalData) {
                showToast('기존 오일 기록을 공용 DB로 이전했습니다.');
            }
        } catch (error) {
            if (isCancelled()) return;
            console.error('[EngineOilCyclePage] Failed to load vehicles:', error);
            setLoadError(error instanceof Error ? error.message : '차량 정보를 불러오지 못했습니다.');
        } finally {
            if (!isCancelled()) setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        void loadVehicleRecords(() => cancelled);
        return () => { cancelled = true; };
    }, [refreshKey, restricted]);

    const commitRecords = async (records: EngineOilRecord[], drafts?: Record<string, EngineOilDraft>, ids = records.map(record => record.id)): Promise<boolean> => {
        setSaving(true);
        try {
            if (restricted) {
                await saveTeamVehicleOil(Object.values(buildMetricPayload(records.filter(record => ids.includes(record.id)))));
            } else {
                await supportSharedDataService.save('engine_oil_cycle', buildMetricPayload(records));
                persistLocalMetrics(records);
            }
            setOilState((prev) => ({
                records,
                drafts: drafts ?? prev.drafts
            }));
            setLoadError(null);
            return true;
        } catch (error) {
            console.error('[EngineOilCyclePage] Failed to save shared oil metrics:', error);
            showToast(restricted ? '저장하지 못했습니다. 현재 소속·차량 배정을 확인하고 새로고침해 주세요.' : '공용 DB 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const setDraftValue = (id: string, field: keyof Omit<EngineOilDraft, 'id'>, value: string) => {
        setOilState((prev) => {
            const record = prev.records.find((item) => item.id === id);
            if (!record) return prev;
            return {
                ...prev,
                drafts: {
                    ...prev.drafts,
                    [id]: {
                        ...(prev.drafts[id] ?? toDraft(record)),
                        [field]: value
                    }
                }
            };
        });
        setChangedIds((prev) => new Set(prev).add(id));
    };

    const handleDistanceChange = (event: React.ChangeEvent<HTMLInputElement>, id: string, field: 'currentKm' | 'lastOilKm') => {
        const input = event.currentTarget;
        const raw = input.value.replace(/,/g, '');
        if (!/^\d*(?:\.\d*)?$/.test(raw)) return;

        const charactersBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/,/g, '').length;
        const formatted = formatDraftKm(raw);
        let caret = 0;
        let characters = 0;
        while (caret < formatted.length && characters < charactersBeforeCaret) {
            if (formatted[caret] !== ',') characters += 1;
            caret += 1;
        }
        input.value = formatted;
        input.setSelectionRange(caret, caret);
        setDraftValue(id, field, raw);
    };

    const counts = useMemo(() => {
        return oilState.records.reduce(
            (acc, record) => {
                acc[getOilStatus(record).type] += 1;
                return acc;
            },
            { danger: 0, warning: 0, normal: 0 }
        );
    }, [oilState.records]);

    const emergencyRecords = useMemo(
        () => sortByTeamAndOilStatus(oilState.records).filter((record) => getOilStatus(record).type === 'danger'),
        [oilState.records]
    );

    const visibleRecords = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return sortByTeamAndOilStatus(oilState.records).filter((record) => {
            const status = getOilStatus(record);
            const matchesFilter = activeFilter === 'all' || status.type === activeFilter;
            const matchesQuery = !query || `${record.plate} ${record.team}`.toLowerCase().includes(query);
            return matchesFilter && matchesQuery;
        });
    }, [activeFilter, oilState.records, searchTerm]);

    const saveRecord = async (id: string) => {
        const draft = oilState.drafts[id];
        if (!draft) return;

        const metric = parseDraft(draft);
        if (metric.lastOilKm > metric.currentKm) {
            showToast('최근교체거리는 현재거리보다 클 수 없습니다.');
            return;
        }

        const nextRecords = oilState.records.map((record) => (
            record.id === id ? { ...record, ...metric } : record
        ));
        const saved = await commitRecords(nextRecords, {
            ...oilState.drafts,
            [id]: toDraft(nextRecords.find((record) => record.id === id) as EngineOilRecord)
        }, [id]);
        if (!saved) return;
        setChangedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        showToast('저장되었습니다.');
    };

    const saveChangedRecords = async () => {
        const ids = Array.from(changedIds).filter((id) => (
            Boolean(oilState.drafts[id]) && oilState.records.some((record) => record.id === id)
        ));

        if (ids.length === 0) {
            showToast('저장할 변경사항이 없습니다.');
            return;
        }

        const metricsById = new Map<string, EngineOilMetric>();
        const invalidRecord = ids
            .map((id) => {
                const metric = parseDraft(oilState.drafts[id]);
                metricsById.set(id, metric);
                return metric.lastOilKm > metric.currentKm
                    ? oilState.records.find((record) => record.id === id)
                    : null;
            })
            .find((record): record is EngineOilRecord => Boolean(record));

        if (invalidRecord) {
            showToast(`${invalidRecord.plate} 최근교체거리는 현재거리보다 클 수 없습니다.`);
            return;
        }

        const nextRecords = oilState.records.map((record) => {
            const metric = metricsById.get(record.id);
            return metric ? { ...record, ...metric } : record;
        });
        const nextDrafts = { ...oilState.drafts };
        ids.forEach((id) => {
            const savedRecord = nextRecords.find((record) => record.id === id);
            if (savedRecord) nextDrafts[id] = toDraft(savedRecord);
        });

        const saved = await commitRecords(nextRecords, nextDrafts, ids);
        if (!saved) return;
        setChangedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
        showToast(`${ids.length.toLocaleString('ko-KR')}건 저장되었습니다.`);
    };

    const applyGlobalCycle = async () => {
        const cycleKm = Math.max(1, toNumber(globalCycleKm));
        if (!cycleKm) {
            showToast('전체교체주기를 입력하세요.');
            return;
        }

        const records = oilState.records.map((record) => ({ ...record, cycleKm }));
        const drafts = records.reduce<Record<string, EngineOilDraft>>((acc, record) => {
            const existing = oilState.drafts[record.id] ?? toDraft(record);
            acc[record.id] = { ...existing, cycleKm: String(cycleKm) };
            return acc;
        }, {});

        const saved = await commitRecords(records, drafts);
        if (!saved) return;
        setChangedIds(new Set());
        showToast(`전체교체주기를 ${cycleKm.toLocaleString('ko-KR')}km로 적용했습니다.`);
    };

    const resetOilData = async () => {
        if (!window.confirm('엔진오일 거리 기록만 초기화할까요? 차량번호와 팀은 차량 관리에서 다시 불러옵니다.')) return;
        const cycleKm = Math.max(1, toNumber(globalCycleKm) || DEFAULT_CYCLE_KM);
        const records = oilState.records.map((record) => ({
            ...record,
            ...defaultMetric(record.id, cycleKm)
        }));
        const saved = await commitRecords(records, toDraftMap(records));
        if (!saved) return;
        setChangedIds(new Set());
        showToast('엔진오일 기록을 초기화했습니다.');
    };

    const handleInlineKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
        const input = event.currentTarget;
        const caret = input.selectionStart;
        if (caret !== null && caret === input.selectionEnd) {
            if (event.key === 'Backspace' && input.value[caret - 1] === ',') {
                input.setSelectionRange(caret - 1, caret - 1);
            } else if (event.key === 'Delete' && input.value[caret] === ',') {
                input.setSelectionRange(caret + 1, caret + 1);
            }
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            void saveRecord(id);
        }
    };

    const filterButtonClassName = (filter: OilFilterType) => (
        `rounded-full border px-3 py-2 text-xs font-extrabold transition-colors sm:text-sm ${
            activeFilter === filter
                ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`
    );

    const summaryCards = [
        { filter: 'all' as const, label: '총 차량', value: oilState.records.length, icon: faCar, className: 'border-slate-200' },
        { filter: 'normal' as const, label: '정상', value: counts.normal, icon: faCircleCheck, className: statusClasses.normal.border },
        { filter: 'warning' as const, label: '교체예정', value: counts.warning, icon: faClock, className: statusClasses.warning.border },
        { filter: 'danger' as const, label: '즉시교체', value: counts.danger, icon: faTriangleExclamation, className: statusClasses.danger.border }
    ];

    return (
        <div className="engine-oil-page min-h-screen w-full min-w-0 max-w-full bg-slate-50 px-3 py-4 text-slate-900 sm:p-6 xl:p-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
                <header className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg text-white shadow-lg shadow-blue-100 sm:h-12 sm:w-12 sm:text-xl">
                                <FontAwesomeIcon icon={faOilCan} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="break-keep text-xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                    엔진오일 교체주기 관제표
                                </h1>
                                <p className="mt-2 max-w-3xl text-xs font-medium leading-5 text-slate-500 sm:text-sm sm:leading-6">
                                    차량번호와 팀은 차량 관리 데이터에서 자동으로 가져오고, 엔진오일 거리 기록만 차량별로 저장합니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {!restricted && <button
                                type="button"
                                onClick={() => navigate('/support/vehicles')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
                                차량 관리
                            </button>}
                            <button
                                type="button"
                                onClick={() => setRefreshKey((prev) => prev + 1)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <FontAwesomeIcon icon={faRotateRight} className={loading ? 'spin' : ''} />
                                차량정보 새로고침
                            </button>
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                                {restricted ? '내 팀 차량만 조회·수정' : '차량 관리 연동 · 차량번호/팀 자동반영 · 공용 DB 저장'}
                            </div>
                        </div>
                    </div>
                </header>

                <section aria-label="차량 상태 요약" className="grid grid-cols-4 gap-1.5 sm:gap-3">
                    {summaryCards.map((card) => (
                        <button
                            type="button"
                            key={card.filter}
                            onClick={() => setActiveFilter(card.filter)}
                            aria-pressed={activeFilter === card.filter}
                            className={`min-w-0 rounded-xl border bg-white px-1 py-2 text-center shadow-sm transition-colors sm:px-3 sm:text-left ${card.className} ${
                                activeFilter === card.filter ? 'ring-2 ring-blue-500/70' : ''
                            }`}
                        >
                            <span className="flex items-center justify-center gap-2 whitespace-nowrap text-xs font-bold text-slate-500 sm:justify-start sm:text-sm">
                                <FontAwesomeIcon icon={card.icon} className="hidden sm:inline" />
                                {card.label}
                            </span>
                            <strong className="mt-0.5 block text-xl font-black tabular-nums tracking-tight text-slate-950 sm:text-2xl">
                                {card.value.toLocaleString('ko-KR')}
                            </strong>
                        </button>
                    ))}
                </section>

                <main className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="grid gap-2 xl:grid-cols-[minmax(240px,1fr)_auto_auto_auto_auto] xl:items-center">
                        <label className="relative block min-w-0">
                            <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="차량번호 또는 팀 검색"
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setActiveFilter('all')} className={filterButtonClassName('all')}>전체</button>
                            <button type="button" onClick={() => setActiveFilter('danger')} className={filterButtonClassName('danger')}>즉시교체</button>
                            <button type="button" onClick={() => setActiveFilter('warning')} className={filterButtonClassName('warning')}>교체예정</button>
                            <button type="button" onClick={() => setActiveFilter('normal')} className={filterButtonClassName('normal')}>정상</button>
                        </div>

                        {!restricted && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="whitespace-nowrap text-xs font-black text-slate-500">전체교체주기</span>
                            <select
                                aria-label="전체교체주기"
                                value={globalCycleKm}
                                onChange={(event) => setGlobalCycleKm(event.target.value)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black text-slate-800 outline-none focus:border-blue-500"
                            >
                                <option value="5000">5,000km</option>
                                <option value="7000">7,000km</option>
                                <option value="8000">8,000km</option>
                                <option value="10000">10,000km</option>
                                <option value="15000">15,000km</option>
                            </select>
                            <button
                                type="button"
                                onClick={applyGlobalCycle}
                                disabled={saving}
                                className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition-colors hover:bg-blue-700"
                            >
                                전체 적용
                            </button>
                        </div>}

                        <button
                            type="button"
                            onClick={saveChangedRecords}
                            disabled={changedIds.size === 0 || saving}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
                                changedIds.size > 0 && !saving
                                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
                            }`}
                        >
                            <FontAwesomeIcon icon={faFloppyDisk} />
                            {changedIds.size > 0 ? `변경 ${changedIds.size.toLocaleString('ko-KR')}건 저장` : '일괄 저장'}
                        </button>

                        {!restricted && <button
                            type="button"
                            onClick={resetOilData}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition-colors hover:bg-red-100"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            오일기록 초기화
                        </button>}
                    </div>

                    <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                        상태 기준: 즉시교체 = 남은거리 1,000km 이하 / 교체예정 = 1,001~3,000km / 정상 = 3,001km 이상
                    </div>

                    {loadError && (
                        <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                            {loadError}
                        </div>
                    )}

                    {emergencyRecords.length > 0 && (
                        <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                            <h2 className="mb-3 flex items-center gap-2 text-base font-black text-red-800">
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                                즉시교체 차량
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {emergencyRecords.map((record) => {
                                    const status = getOilStatus(record);
                                    return (
                                        <button
                                            type="button"
                                            key={record.id}
                                            onClick={() => setActiveFilter('danger')}
                                            className="rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white shadow-sm"
                                        >
                                            {record.team} · {record.plate} · {formatKm(status.remainKm)}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <div className="engine-oil-table-container mt-4 lg:overflow-x-auto lg:rounded-2xl lg:border lg:border-slate-200">
                        <table role="table" aria-label="차량별 엔진오일 교체주기" className="engine-oil-table w-full border-collapse bg-white text-sm lg:min-w-[980px]">
                            <thead className="hidden bg-slate-100 text-slate-600 lg:sticky lg:top-0 lg:z-10 lg:table-header-group">
                                <tr role="row">
                                    <th scope="col" className="px-3 py-3 text-left text-xs font-black">상태</th>
                                    <th scope="col" className="px-3 py-3 text-left text-xs font-black">차량번호</th>
                                    <th scope="col" className="px-3 py-3 text-left text-xs font-black">팀</th>
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-black">현재거리</th>
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-black">최근교체</th>
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-black">다음교체</th>
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-black">남은거리</th>
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-black">교체주기</th>
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-black">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-3 py-16 text-center text-sm font-bold text-slate-400">
                                            차량 정보를 불러오는 중입니다.
                                        </td>
                                    </tr>
                                ) : visibleRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-3 py-8">
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                                                표시할 차량이 없습니다.
                                            </div>
                                        </td>
                                    </tr>
                                ) : visibleRecords.map((record) => {
                                    const draft = oilState.drafts[record.id] ?? toDraft(record);
                                    const status = getOilStatus(record);
                                    const changed = changedIds.has(record.id);
                                    const classes = statusClasses[status.type];

                                    return (
                                        <tr role="row" key={record.id} className={`engine-oil-record ${classes.row} border-b border-white`}>
                                            <td role="cell" className={`engine-oil-status px-3 py-2 ${classes.firstCell}`}>
                                                <span className={`inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-black ${classes.badge}`}>
                                                    <FontAwesomeIcon icon={statusIcon[status.type]} className="text-[11px]" />
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td role="cell" className="engine-oil-plate px-3 py-2 font-black text-slate-900">
                                                <span className="inline-flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faCar} className="text-slate-400" />
                                                    {record.plate}
                                                </span>
                                            </td>
                                            <td role="cell" className="engine-oil-field px-3 py-2 font-bold text-slate-800">
                                                <span className="engine-oil-field-label">팀</span>
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-5 w-1.5 rounded-full shadow-sm"
                                                        style={{ backgroundColor: record.teamColor }}
                                                        aria-hidden="true"
                                                    />
                                                    {record.team}
                                                </span>
                                            </td>
                                            <td role="cell" className="engine-oil-field px-3 py-2 text-right">
                                                <span className="engine-oil-field-label">현재거리 <span className="font-normal">(km)</span></span>
                                                <input
                                                    aria-label={`${record.plate} 현재거리`}
                                                    value={formatDraftKm(draft.currentKm)}
                                                    type="text"
                                                    inputMode="numeric"
                                                    onChange={(event) => handleDistanceChange(event, record.id, 'currentKm')}
                                                    onKeyDown={(event) => handleInlineKeyDown(event, record.id)}
                                                    className={inputClassName(changed)}
                                                />
                                            </td>
                                            <td role="cell" className="engine-oil-field px-3 py-2 text-right">
                                                <span className="engine-oil-field-label">최근교체 <span className="font-normal">(km)</span></span>
                                                <input
                                                    aria-label={`${record.plate} 최근교체거리`}
                                                    value={formatDraftKm(draft.lastOilKm)}
                                                    type="text"
                                                    inputMode="numeric"
                                                    onChange={(event) => handleDistanceChange(event, record.id, 'lastOilKm')}
                                                    onKeyDown={(event) => handleInlineKeyDown(event, record.id)}
                                                    className={inputClassName(changed)}
                                                />
                                            </td>
                                            <td role="cell" className="engine-oil-field px-3 py-2 text-right text-slate-800">
                                                <span className="engine-oil-field-label">다음교체</span>
                                                <span>{formatKm(status.nextKm)}</span>
                                            </td>
                                            <td role="cell" className={`engine-oil-field px-3 py-2 text-right ${classes.text}`}>
                                                <span className="engine-oil-field-label">남은거리</span>
                                                <span>{formatKm(status.remainKm)}</span>
                                            </td>
                                            <td role="cell" className="engine-oil-field px-3 py-2 text-right text-slate-700">
                                                <span className="engine-oil-field-label">교체주기</span>
                                                <span>{formatKm(record.cycleKm)}</span>
                                            </td>
                                            <td role="cell" className="engine-oil-actions px-3 py-2">
                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => saveRecord(record.id)}
                                                        disabled={saving}
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                        <span>조회 {visibleRecords.length.toLocaleString('ko-KR')} / {oilState.records.length.toLocaleString('ko-KR')}대</span>
                        <span className="inline-flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faGaugeHigh} />
                            팀명 기준 자동정렬
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

export default EngineOilCyclePage;
