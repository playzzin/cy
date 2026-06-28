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
const DEFAULT_TEAM_COLOR = '#94a3b8';

const defaultMetric = (id: string, cycleKm = 10000): EngineOilMetric => ({
    id,
    currentKm: 0,
    lastOilKm: 0,
    cycleKm
});

const toNumber = (value: unknown): number => {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
};

const normalizeMetric = (id: string, value?: EngineOilMetricInput, fallbackCycle = 10000): EngineOilMetric => {
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

const loadSavedMetrics = (): Record<string, EngineOilMetric> => {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return {};

        const entries = Array.isArray(parsed)
            ? parsed.map((item) => [String((item as EngineOilMetricInput).id ?? ''), item] as const)
            : Object.entries(parsed);

        return entries.reduce<Record<string, EngineOilMetric>>((acc, [id, value]) => {
            const key = normalizeKey(id);
            if (!key) return acc;
            acc[key] = normalizeMetric(key, value as EngineOilMetricInput);
            return acc;
        }, {});
    } catch (error) {
        console.warn('[EngineOilCyclePage] Failed to load oil metrics:', error);
        return {};
    }
};

const persistMetrics = (records: EngineOilRecord[]) => {
    if (typeof window === 'undefined') return;
    const payload = records.reduce<Record<string, EngineOilMetric>>((acc, record) => {
        acc[record.id] = {
            id: record.id,
            currentKm: record.currentKm,
            lastOilKm: record.lastOilKm,
            cycleKm: record.cycleKm
        };
        return acc;
    }, {});
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const clearSavedMetrics = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
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

const getOilStatus = (record: EngineOilRecord): OilStatus => {
    const nextKm = Number(record.lastOilKm || 0) + Number(record.cycleKm || 10000);
    const remainKm = nextKm - Number(record.currentKm || 0);

    if (remainKm <= 1000) {
        return { type: 'danger', label: '즉시교체', nextKm, remainKm };
    }
    if (remainKm <= 3000) {
        return { type: 'warning', label: '교체예정', nextKm, remainKm };
    }
    return { type: 'normal', label: '정상', nextKm, remainKm };
};

const sortByOilStatus = (records: EngineOilRecord[]): EngineOilRecord[] => {
    const order: Record<OilStatusType, number> = { danger: 0, warning: 1, normal: 2 };
    return [...records].sort((a, b) => {
        const left = getOilStatus(a);
        const right = getOilStatus(b);
        if (order[left.type] !== order[right.type]) return order[left.type] - order[right.type];
        if (left.remainKm !== right.remainKm) return left.remainKm - right.remainKm;
        const teamCompare = a.team.localeCompare(b.team, 'ko-KR');
        if (teamCompare !== 0) return teamCompare;
        return a.plate.localeCompare(b.plate, 'ko-KR');
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
    const [globalCycleKm, setGlobalCycleKm] = useState('10000');
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

    const loadVehicleRecords = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [vehicles, workers, teams] = await Promise.all([
                vehicleService.getVehicles(),
                manpowerService.getWorkers().catch(() => [] as Worker[]),
                teamService.getTeams().catch(() => [] as Team[])
            ]);

            const savedMetrics = loadSavedMetrics();
            const workerLookup = buildLookup(workers);
            const teamLookup = buildLookup(teams);
            const records = vehicles
                .map((vehicle) => {
                    const id = normalizeKey(vehicle.id);
                    const saved = savedMetrics[id];
                    const metric = saved ? normalizeMetric(id, saved, toNumber(globalCycleKm) || 10000) : defaultMetric(id, toNumber(globalCycleKm) || 10000);
                    const team = resolveTeamInfo(vehicle, workerLookup.byId, workerLookup.byName, teamLookup.byId, teamLookup.byName);

                    return {
                        ...metric,
                        plate: normalizeKey(vehicle.licensePlate) || '-',
                        team: team.name,
                        teamColor: team.color
                    };
                })
                .filter((record) => Boolean(record.id));

            setOilState({
                records,
                drafts: toDraftMap(records)
            });
            setChangedIds(new Set());
            const firstCycle = records.find((record) => record.cycleKm > 0)?.cycleKm;
            if (firstCycle) setGlobalCycleKm(String(firstCycle));
        } catch (error) {
            console.error('[EngineOilCyclePage] Failed to load vehicles:', error);
            setLoadError(error instanceof Error ? error.message : '차량 정보를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVehicleRecords();
    }, [refreshKey]);

    const commitRecords = (records: EngineOilRecord[], drafts?: Record<string, EngineOilDraft>) => {
        persistMetrics(records);
        setOilState((prev) => ({
            records,
            drafts: drafts ?? prev.drafts
        }));
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
        () => sortByOilStatus(oilState.records).filter((record) => getOilStatus(record).type === 'danger'),
        [oilState.records]
    );

    const visibleRecords = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return sortByOilStatus(oilState.records).filter((record) => {
            const status = getOilStatus(record);
            const matchesFilter = activeFilter === 'all' || status.type === activeFilter;
            const matchesQuery = !query || `${record.plate} ${record.team}`.toLowerCase().includes(query);
            return matchesFilter && matchesQuery;
        });
    }, [activeFilter, oilState.records, searchTerm]);

    const saveRecord = (id: string) => {
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
        commitRecords(nextRecords, {
            ...oilState.drafts,
            [id]: toDraft(nextRecords.find((record) => record.id === id) as EngineOilRecord)
        });
        setChangedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        showToast('저장되었습니다.');
    };

    const applyGlobalCycle = () => {
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

        commitRecords(records, drafts);
        setChangedIds(new Set());
        showToast(`전체교체주기를 ${cycleKm.toLocaleString('ko-KR')}km로 적용했습니다.`);
    };

    const resetOilData = () => {
        if (!window.confirm('엔진오일 거리 기록만 초기화할까요? 차량번호와 팀은 차량 관리에서 다시 불러옵니다.')) return;
        clearSavedMetrics();
        const cycleKm = Math.max(1, toNumber(globalCycleKm) || 10000);
        const records = oilState.records.map((record) => ({
            ...record,
            ...defaultMetric(record.id, cycleKm)
        }));
        setOilState({
            records,
            drafts: toDraftMap(records)
        });
        setChangedIds(new Set());
        showToast('엔진오일 기록을 초기화했습니다.');
    };

    const handleInlineKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveRecord(id);
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
        <div className="min-h-screen w-[calc(100vw-30px)] max-w-full overflow-x-hidden bg-slate-50 px-3 py-4 text-slate-900 sm:w-full sm:p-6 xl:p-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
                <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-100">
                                <FontAwesomeIcon icon={faOilCan} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                    엔진오일 교체주기 관제표
                                </h1>
                                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                                    차량번호와 팀은 차량 관리 데이터에서 자동으로 가져오고, 엔진오일 거리 기록만 차량별로 저장합니다.
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
                                차량정보 새로고침
                            </button>
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                                차량 관리 연동 · 차량번호/팀 자동반영 · 거리값 로컬저장
                            </div>
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                        <button
                            type="button"
                            key={card.filter}
                            onClick={() => setActiveFilter(card.filter)}
                            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${card.className} ${
                                activeFilter === card.filter ? 'ring-2 ring-blue-500/70' : ''
                            }`}
                        >
                            <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                <FontAwesomeIcon icon={card.icon} />
                                {card.label}
                            </span>
                            <strong className="mt-2 block text-3xl font-black tracking-tight text-slate-950">
                                {card.value.toLocaleString('ko-KR')}
                            </strong>
                        </button>
                    ))}
                </section>

                <main className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="grid gap-2 xl:grid-cols-[minmax(240px,1fr)_auto_auto_auto] xl:items-center">
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

                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="whitespace-nowrap text-xs font-black text-slate-500">전체교체주기</span>
                            <select
                                value={globalCycleKm}
                                onChange={(event) => setGlobalCycleKm(event.target.value)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black text-slate-800 outline-none focus:border-blue-500"
                            >
                                <option value="5000">5,000km</option>
                                <option value="7000">7,000km</option>
                                <option value="10000">10,000km</option>
                                <option value="15000">15,000km</option>
                            </select>
                            <button
                                type="button"
                                onClick={applyGlobalCycle}
                                className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition-colors hover:bg-blue-700"
                            >
                                전체 적용
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={resetOilData}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition-colors hover:bg-red-100"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            오일기록 초기화
                        </button>
                    </div>

                    <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                        상태 기준: 즉시교체 = 남은거리 1,000km 이하 / 교체예정 = 1,001~3,000km / 정상 = 3,001km 이상
                    </div>

                    {loadError && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
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

                    <div className="support-scroll-x mt-4 rounded-2xl border border-slate-200">
                        <table className="min-w-[980px] w-full border-collapse bg-white text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-black">상태</th>
                                    <th className="px-3 py-3 text-left text-xs font-black">차량번호</th>
                                    <th className="px-3 py-3 text-left text-xs font-black">팀</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">현재거리</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">최근교체</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">다음교체</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">남은거리</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">교체주기</th>
                                    <th className="px-3 py-3 text-right text-xs font-black">관리</th>
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
                                        <tr key={record.id} className={`${classes.row} border-b border-white`}>
                                            <td className={`px-3 py-2 ${classes.firstCell}`}>
                                                <span className={`inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-black ${classes.badge}`}>
                                                    <FontAwesomeIcon icon={statusIcon[status.type]} className="text-[11px]" />
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 font-black text-slate-900">
                                                <span className="inline-flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faCar} className="text-slate-400" />
                                                    {record.plate}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 font-bold text-slate-800">
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-5 w-1.5 rounded-full shadow-sm"
                                                        style={{ backgroundColor: record.teamColor }}
                                                        aria-hidden="true"
                                                    />
                                                    {record.team}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    value={draft.currentKm}
                                                    type="number"
                                                    onChange={(event) => setDraftValue(record.id, 'currentKm', event.target.value)}
                                                    onKeyDown={(event) => handleInlineKeyDown(event, record.id)}
                                                    className={inputClassName(changed)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    value={draft.lastOilKm}
                                                    type="number"
                                                    onChange={(event) => setDraftValue(record.id, 'lastOilKm', event.target.value)}
                                                    onKeyDown={(event) => handleInlineKeyDown(event, record.id)}
                                                    className={inputClassName(changed)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                                                {formatKm(status.nextKm)}
                                            </td>
                                            <td className={`px-3 py-2 text-right font-mono font-black ${classes.text}`}>
                                                {formatKm(status.remainKm)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-700">
                                                {formatKm(record.cycleKm)}
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                        <span>조회 {visibleRecords.length.toLocaleString('ko-KR')} / {oilState.records.length.toLocaleString('ko-KR')}대</span>
                        <span className="inline-flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faGaugeHigh} />
                            남은거리 오름차순 자동정렬
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
