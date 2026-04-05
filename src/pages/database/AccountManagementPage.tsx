import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faChevronDown,
    faChevronRight,
    faCreditCard,
    faFloppyDisk,
    faHardHat,
    faLayerGroup,
    faPlus,
    faRotateRight,
    faSearch,
    faSitemap,
    faTrash,
    faTriangleExclamation,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { accountDirectoryService, AccountDirectory } from '../../services/accountDirectoryService';

type AccountTab = 'overview' | 'workers' | 'teams' | 'companies' | 'custom';
type CustomCategory = AccountDirectory['category'];

interface AccountManagementPageProps {
    embedded?: boolean;
}

interface WorkerGroup {
    key: string;
    teamName: string;
    teamType: string;
    companyName: string;
    items: Worker[];
    missingCount: number;
}

interface WorkerTeamOption {
    key: string;
    label: string;
    teamType: string;
    companyName: string;
    workerCount: number;
}

interface EntityGroup<T> {
    key: string;
    label: string;
    items: T[];
    missingCount: number;
}

const TEAM_TYPE_ORDER = ['시공팀', '지원팀', '용역팀', '미지정'] as const;
const COMPANY_TYPE_ORDER = ['시공사', '협력사', '건설사', '기타', '미지정'] as const;

const CUSTOM_CATEGORY_META: Record<CustomCategory, { title: string; description: string; accent: string }> = {
    purchase: {
        title: '매입계좌번호',
        description: '자재, 외주, 경비 매입 등 지급용 계좌를 별도 등록합니다.',
        accent: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    other: {
        title: '기타계좌번호',
        description: '반복 지급은 아니지만 운영상 따로 보관해야 하는 계좌를 관리합니다.',
        accent: 'text-violet-600 bg-violet-50 border-violet-200',
    },
};

const normalizeText = (value: unknown) => String(value ?? '').trim();
const toNullableText = (value: unknown) => {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : undefined;
};
const hasAccountNumber = (value: unknown) => normalizeText(value).length > 0;
const CHEONGYEON_KEYWORD = '청연';
const isCheongyeonText = (value: unknown) => normalizeText(value).includes(CHEONGYEON_KEYWORD);

const getTeamTypeOrder = (type?: string | null) => {
    const normalized = normalizeText(type) || '미지정';
    const index = TEAM_TYPE_ORDER.indexOf(normalized as typeof TEAM_TYPE_ORDER[number]);
    return index === -1 ? TEAM_TYPE_ORDER.length : index;
};

const getCompanyTypeOrder = (type?: string | null) => {
    const normalized = normalizeText(type) || '미지정';
    const index = COMPANY_TYPE_ORDER.indexOf(normalized as typeof COMPANY_TYPE_ORDER[number]);
    return index === -1 ? COMPANY_TYPE_ORDER.length : index;
};

const getTeamTypeBadgeClass = (type?: string | null) => {
    switch (normalizeText(type)) {
        case '시공팀':
            return 'bg-blue-100 text-blue-800 border border-blue-200';
        case '지원팀':
            return 'bg-amber-100 text-amber-800 border border-amber-200';
        case '용역팀':
            return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        default:
            return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
};

const getCompanyTypeBadgeClass = (type?: string | null) => {
    switch (normalizeText(type)) {
        case '시공사':
            return 'bg-sky-100 text-sky-800 border border-sky-200';
        case '협력사':
            return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        case '건설사':
            return 'bg-orange-100 text-orange-800 border border-orange-200';
        default:
            return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
};

const createEmptyCustomDraft = (category: CustomCategory): Omit<AccountDirectory, 'id' | 'createdAt' | 'updatedAt'> => ({
    category,
    name: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    note: '',
    status: 'active',
    sortOrder: 0,
});

const SummaryCard = ({
    title,
    value,
    description,
    icon,
    toneClass,
    onClick,
}: {
    title: string;
    value: string;
    description: string;
    icon: any;
    toneClass: string;
    onClick?: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="text-sm font-semibold text-slate-500">{title}</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
                <div className="mt-2 text-sm text-slate-500">{description}</div>
            </div>
            <div className={`rounded-xl border p-3 ${toneClass}`}>
                <FontAwesomeIcon icon={icon} className="text-lg" />
            </div>
        </div>
    </button>
);

const AccountManagementPage: React.FC<AccountManagementPageProps> = ({ embedded = false }) => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<AccountTab>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [selectedWorkerTeamKey, setSelectedWorkerTeamKey] = useState('all');

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [customAccounts, setCustomAccounts] = useState<AccountDirectory[]>([]);

    const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
    const [expandedWorkerGroups, setExpandedWorkerGroups] = useState<Record<string, boolean>>({});
    const [expandedTeamGroups, setExpandedTeamGroups] = useState<Record<string, boolean>>({});
    const [expandedCompanyGroups, setExpandedCompanyGroups] = useState<Record<string, boolean>>({});
    const [expandedCustomGroups, setExpandedCustomGroups] = useState<Record<string, boolean>>({
        purchase: true,
        other: true,
    });
    const [customDrafts, setCustomDrafts] = useState<Record<CustomCategory, Omit<AccountDirectory, 'id' | 'createdAt' | 'updatedAt'>>>({
        purchase: createEmptyCustomDraft('purchase'),
        other: createEmptyCustomDraft('other'),
    });

    const setSaving = useCallback((key: string, value: boolean) => {
        setSavingKeys((prev) => ({ ...prev, [key]: value }));
    }, []);

    const sortCustomAccounts = useCallback((items: AccountDirectory[]) => {
        return [...items].sort((a, b) => {
            const categoryCompare = a.category.localeCompare(b.category);
            if (categoryCompare !== 0) return categoryCompare;
            const orderCompare = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            if (orderCompare !== 0) return orderCompare;
            return normalizeText(a.name).localeCompare(normalizeText(b.name), 'ko');
        });
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [workerRows, teamRows, companyRows, customRows] = await Promise.all([
                manpowerService.getWorkers(true),
                teamService.getTeams(),
                companyService.getCompanies(),
                accountDirectoryService.getEntries(),
            ]);

            setWorkers(workerRows);
            setTeams(teamRows);
            setCompanies(companyRows);
            setCustomAccounts(sortCustomAccounts(customRows));
        } catch (error) {
            console.error('Failed to load account management data:', error);
        } finally {
            setLoading(false);
        }
    }, [sortCustomAccounts]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const teamById = useMemo(() => new Map(teams.map((team) => [team.id || '', team])), [teams]);
    const companyById = useMemo(() => new Map(companies.map((company) => [company.id || '', company])), [companies]);

    const getWorkerTeamMeta = useCallback((worker: Worker) => {
        const team = teamById.get(worker.teamId || '');
        const resolvedTeamName = normalizeText(team?.name) || normalizeText(worker.teamName);
        const teamKey = normalizeText(worker.teamId) || (resolvedTeamName ? `name:${resolvedTeamName}` : '__unassigned__');
        const teamType = normalizeText(team?.type) || normalizeText(worker.teamType) || '미지정';
        const companyName =
            normalizeText(team?.companyName) ||
            normalizeText(companyById.get(team?.companyId || '')?.name) ||
            normalizeText(worker.companyName);

        return {
            teamKey,
            teamName: resolvedTeamName || '미배정 작업자',
            teamType,
            companyName,
        };
    }, [companyById, teamById]);

    const cheongyeonWorkers = useMemo(() => {
        return workers.filter((worker) => {
            const { teamKey, companyName } = getWorkerTeamMeta(worker);
            if (teamKey === '__unassigned__') return false;
            return isCheongyeonText(companyName);
        });
    }, [getWorkerTeamMeta, workers]);

    const workerTeamOptions = useMemo<WorkerTeamOption[]>(() => {
        const grouped = new Map<string, WorkerTeamOption>();

        cheongyeonWorkers.forEach((worker) => {
            const { teamKey, teamName, teamType, companyName } = getWorkerTeamMeta(worker);
            if (!grouped.has(teamKey)) {
                grouped.set(teamKey, {
                    key: teamKey,
                    label: teamName,
                    teamType,
                    companyName,
                    workerCount: 0,
                });
            }

            grouped.get(teamKey)!.workerCount += 1;
        });

        return Array.from(grouped.values()).sort((a, b) => {
            const typeCompare = getTeamTypeOrder(a.teamType) - getTeamTypeOrder(b.teamType);
            if (typeCompare !== 0) return typeCompare;
            return a.label.localeCompare(b.label, 'ko');
        });
    }, [cheongyeonWorkers, getWorkerTeamMeta]);

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    const filteredWorkers = useMemo(() => {
        return cheongyeonWorkers.filter((worker) => {
            if (onlyMissing && hasAccountNumber(worker.accountNumber)) return false;
            const { teamName, teamType, companyName } = getWorkerTeamMeta(worker);
            if (!normalizedSearchTerm) return true;

            return [
                worker.name,
                teamName,
                teamType,
                companyName,
                worker.accountHolder,
                worker.accountNumber,
                worker.bankName,
            ].some((value) => normalizeText(value).toLowerCase().includes(normalizedSearchTerm));
        });
    }, [cheongyeonWorkers, getWorkerTeamMeta, normalizedSearchTerm, onlyMissing]);

    const workerGroups = useMemo<WorkerGroup[]>(() => {
        const grouped = new Map<string, WorkerGroup>();

        filteredWorkers.forEach((worker) => {
            const { teamKey, teamName, teamType, companyName } = getWorkerTeamMeta(worker);

            if (!grouped.has(teamKey)) {
                grouped.set(teamKey, { key: teamKey, teamName, teamType, companyName, items: [], missingCount: 0 });
            }

            grouped.get(teamKey)!.items.push(worker);
        });

        return Array.from(grouped.values())
            .map((group) => ({
                ...group,
                items: [...group.items].sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), 'ko')),
                missingCount: group.items.filter((item) => !hasAccountNumber(item.accountNumber)).length,
            }))
            .sort((a, b) => {
                const typeCompare = getTeamTypeOrder(a.teamType) - getTeamTypeOrder(b.teamType);
                if (typeCompare !== 0) return typeCompare;
                return a.teamName.localeCompare(b.teamName, 'ko');
            });
    }, [filteredWorkers, getWorkerTeamMeta]);

    const visibleWorkerGroups = useMemo(() => {
        if (selectedWorkerTeamKey === 'all') return workerGroups;
        return workerGroups.filter((group) => group.key === selectedWorkerTeamKey);
    }, [selectedWorkerTeamKey, workerGroups]);

    const visibleWorkerCount = useMemo(
        () => visibleWorkerGroups.reduce((sum, group) => sum + group.items.length, 0),
        [visibleWorkerGroups]
    );

    const filteredTeams = useMemo(() => {
        return teams.filter((team) => {
            if (onlyMissing && hasAccountNumber(team.accountNumber)) return false;
            if (!normalizedSearchTerm) return true;

            return [
                team.name,
                team.type,
                team.companyName,
                team.leaderName,
                team.bankName,
                team.accountNumber,
                team.accountHolder,
            ].some((value) => normalizeText(value).toLowerCase().includes(normalizedSearchTerm));
        });
    }, [teams, normalizedSearchTerm, onlyMissing]);

    const teamGroups = useMemo<EntityGroup<Team>[]>(() => {
        const grouped = new Map<string, EntityGroup<Team>>();
        filteredTeams.forEach((team) => {
            const key = normalizeText(team.type) || '미지정';
            if (!grouped.has(key)) grouped.set(key, { key, label: key, items: [], missingCount: 0 });
            grouped.get(key)!.items.push(team);
        });
        return Array.from(grouped.values())
            .map((group) => ({
                ...group,
                items: [...group.items].sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), 'ko')),
                missingCount: group.items.filter((item) => !hasAccountNumber(item.accountNumber)).length,
            }))
            .sort((a, b) => getTeamTypeOrder(a.key) - getTeamTypeOrder(b.key));
    }, [filteredTeams]);

    const filteredCompanies = useMemo(() => {
        return companies.filter((company) => {
            if (onlyMissing && hasAccountNumber(company.accountNumber)) return false;
            if (!normalizedSearchTerm) return true;

            return [
                company.name,
                company.type,
                company.ceoName,
                company.bankName,
                company.accountNumber,
                company.accountHolder,
            ].some((value) => normalizeText(value).toLowerCase().includes(normalizedSearchTerm));
        });
    }, [companies, normalizedSearchTerm, onlyMissing]);

    const companyGroups = useMemo<EntityGroup<Company>[]>(() => {
        const grouped = new Map<string, EntityGroup<Company>>();
        filteredCompanies.forEach((company) => {
            const key = normalizeText(company.type) || '미지정';
            if (!grouped.has(key)) grouped.set(key, { key, label: key, items: [], missingCount: 0 });
            grouped.get(key)!.items.push(company);
        });
        return Array.from(grouped.values())
            .map((group) => ({
                ...group,
                items: [...group.items].sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), 'ko')),
                missingCount: group.items.filter((item) => !hasAccountNumber(item.accountNumber)).length,
            }))
            .sort((a, b) => getCompanyTypeOrder(a.key) - getCompanyTypeOrder(b.key));
    }, [filteredCompanies]);

    const filteredCustomAccounts = useMemo(() => {
        return customAccounts.filter((entry) => {
            if (onlyMissing && hasAccountNumber(entry.accountNumber)) return false;
            if (!normalizedSearchTerm) return true;

            return [
                entry.name,
                entry.note,
                entry.bankName,
                entry.accountNumber,
                entry.accountHolder,
            ].some((value) => normalizeText(value).toLowerCase().includes(normalizedSearchTerm));
        });
    }, [customAccounts, normalizedSearchTerm, onlyMissing]);

    const customGroups = useMemo<EntityGroup<AccountDirectory>[]>(() => {
        return (Object.keys(CUSTOM_CATEGORY_META) as CustomCategory[]).map((category) => {
            const items = filteredCustomAccounts.filter((item) => item.category === category);
            return {
                key: category,
                label: CUSTOM_CATEGORY_META[category].title,
                items,
                missingCount: items.filter((item) => !hasAccountNumber(item.accountNumber)).length,
            };
        });
    }, [filteredCustomAccounts]);

    useEffect(() => {
        setExpandedWorkerGroups((prev) => {
            const next = { ...prev };
            workerGroups.forEach((group) => {
                if (!(group.key in next)) next[group.key] = true;
            });
            return next;
        });
    }, [workerGroups]);

    useEffect(() => {
        if (selectedWorkerTeamKey === 'all') return;
        const hasSelectedTeam = workerTeamOptions.some((option) => option.key === selectedWorkerTeamKey);
        if (!hasSelectedTeam) setSelectedWorkerTeamKey('all');
    }, [selectedWorkerTeamKey, workerTeamOptions]);

    useEffect(() => {
        setExpandedTeamGroups((prev) => {
            const next = { ...prev };
            teamGroups.forEach((group) => {
                if (!(group.key in next)) next[group.key] = true;
            });
            return next;
        });
    }, [teamGroups]);

    useEffect(() => {
        setExpandedCompanyGroups((prev) => {
            const next = { ...prev };
            companyGroups.forEach((group) => {
                if (!(group.key in next)) next[group.key] = true;
            });
            return next;
        });
    }, [companyGroups]);

    const workerMissingCount = useMemo(
        () => cheongyeonWorkers.filter((item) => !hasAccountNumber(item.accountNumber)).length,
        [cheongyeonWorkers]
    );
    const teamMissingCount = useMemo(() => teams.filter((item) => !hasAccountNumber(item.accountNumber)).length, [teams]);
    const companyMissingCount = useMemo(() => companies.filter((item) => !hasAccountNumber(item.accountNumber)).length, [companies]);
    const purchaseCount = useMemo(() => customAccounts.filter((item) => item.category === 'purchase').length, [customAccounts]);
    const otherCount = useMemo(() => customAccounts.filter((item) => item.category === 'other').length, [customAccounts]);

    const topWorkerGaps = useMemo(() => workerGroups.filter((group) => group.missingCount > 0).sort((a, b) => b.missingCount - a.missingCount).slice(0, 5), [workerGroups]);
    const topTeamGaps = useMemo(() => teamGroups.filter((group) => group.missingCount > 0), [teamGroups]);
    const topCompanyGaps = useMemo(() => companyGroups.filter((group) => group.missingCount > 0), [companyGroups]);

    const updateWorkerField = (workerId: string, field: 'bankName' | 'accountNumber' | 'accountHolder', value: string) => {
        setWorkers((prev) => prev.map((worker) => (worker.id === workerId ? { ...worker, [field]: value } : worker)));
    };

    const saveWorkerAccount = async (workerId: string) => {
        const target = workers.find((worker) => worker.id === workerId);
        if (!target) return;

        const key = `worker:${workerId}`;
        setSaving(key, true);
        try {
            await manpowerService.updateWorker(workerId, {
                bankName: toNullableText(target.bankName),
                accountNumber: toNullableText(target.accountNumber),
                accountHolder: toNullableText(target.accountHolder),
            });
        } catch (error) {
            console.error('Failed to update worker account:', error);
        } finally {
            setSaving(key, false);
        }
    };

    const updateTeamField = (teamId: string, field: 'bankName' | 'accountNumber' | 'accountHolder', value: string) => {
        setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, [field]: value } : team)));
    };

    const saveTeamAccount = async (teamId: string) => {
        const target = teams.find((team) => team.id === teamId);
        if (!target) return;

        const key = `team:${teamId}`;
        setSaving(key, true);
        try {
            await teamService.updateTeam(teamId, {
                bankName: toNullableText(target.bankName),
                accountNumber: toNullableText(target.accountNumber),
                accountHolder: toNullableText(target.accountHolder),
            });
        } catch (error) {
            console.error('Failed to update team account:', error);
        } finally {
            setSaving(key, false);
        }
    };

    const updateCompanyField = (companyId: string, field: 'bankName' | 'accountNumber' | 'accountHolder', value: string) => {
        setCompanies((prev) => prev.map((company) => (company.id === companyId ? { ...company, [field]: value } : company)));
    };

    const saveCompanyAccount = async (companyId: string) => {
        const target = companies.find((company) => company.id === companyId);
        if (!target) return;

        const key = `company:${companyId}`;
        setSaving(key, true);
        try {
            await companyService.updateCompany(companyId, {
                bankName: toNullableText(target.bankName),
                accountNumber: toNullableText(target.accountNumber),
                accountHolder: toNullableText(target.accountHolder),
            });
        } catch (error) {
            console.error('Failed to update company account:', error);
        } finally {
            setSaving(key, false);
        }
    };

    const updateCustomField = (entryId: string, field: keyof Pick<AccountDirectory, 'name' | 'bankName' | 'accountNumber' | 'accountHolder' | 'note' | 'status'>, value: string) => {
        setCustomAccounts((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)));
    };

    const saveCustomEntry = async (entryId: string) => {
        const target = customAccounts.find((entry) => entry.id === entryId);
        if (!target || !target.id) return;
        if (!normalizeText(target.name)) {
            alert('계좌명은 필수입니다.');
            return;
        }

        const key = `custom:${entryId}`;
        setSaving(key, true);
        try {
            await accountDirectoryService.updateEntry(entryId, {
                name: normalizeText(target.name),
                bankName: toNullableText(target.bankName),
                accountNumber: toNullableText(target.accountNumber),
                accountHolder: toNullableText(target.accountHolder),
                note: toNullableText(target.note),
                status: target.status === 'inactive' ? 'inactive' : 'active',
            });
        } catch (error) {
            console.error('Failed to update custom account entry:', error);
        } finally {
            setSaving(key, false);
        }
    };

    const deleteCustomEntry = async (entryId: string) => {
        const target = customAccounts.find((entry) => entry.id === entryId);
        if (!target?.id) return;
        if (!window.confirm(`"${target.name}" 계좌를 삭제하시겠습니까?`)) return;

        const key = `custom:${entryId}`;
        setSaving(key, true);
        try {
            await accountDirectoryService.deleteEntry(entryId);
            setCustomAccounts((prev) => prev.filter((entry) => entry.id !== entryId));
        } catch (error) {
            console.error('Failed to delete custom account entry:', error);
        } finally {
            setSaving(key, false);
        }
    };

    const updateCustomDraft = (category: CustomCategory, field: keyof Omit<AccountDirectory, 'id' | 'createdAt' | 'updatedAt'>, value: string) => {
        setCustomDrafts((prev) => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value,
            },
        }));
    };

    const addCustomEntry = async (category: CustomCategory) => {
        const draft = customDrafts[category];
        const name = normalizeText(draft.name);
        if (!name) {
            alert('계좌명은 필수입니다.');
            return;
        }

        const key = `custom:new:${category}`;
        setSaving(key, true);
        try {
            const payload: Omit<AccountDirectory, 'id' | 'createdAt' | 'updatedAt'> = {
                category,
                name,
                bankName: toNullableText(draft.bankName),
                accountNumber: toNullableText(draft.accountNumber),
                accountHolder: toNullableText(draft.accountHolder),
                note: toNullableText(draft.note),
                status: draft.status === 'inactive' ? 'inactive' : 'active',
                sortOrder: customAccounts.filter((entry) => entry.category === category).length,
            };

            const id = await accountDirectoryService.addEntry(payload);
            setCustomAccounts((prev) => sortCustomAccounts([...prev, { ...payload, id }]));
            setCustomDrafts((prev) => ({ ...prev, [category]: createEmptyCustomDraft(category) }));
        } catch (error) {
            console.error('Failed to add custom account entry:', error);
        } finally {
            setSaving(key, false);
        }
    };

    const renderToolbar = (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                    <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="작업자, 팀, 회사, 계좌번호, 예금주로 검색"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                            type="checkbox"
                            checked={onlyMissing}
                            onChange={(event) => setOnlyMissing(event.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        계좌 미등록만 보기
                    </label>

                    <button
                        type="button"
                        onClick={loadData}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        새로고침
                    </button>
                </div>
            </div>
        </div>
    );

    const renderEmptyState = (message: string) => (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
            {message}
        </div>
    );

    return (
        <div className={`space-y-6 ${embedded ? '' : 'min-h-screen bg-slate-50 p-6'}`}>
            {!embedded && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                                <FontAwesomeIcon icon={faCreditCard} />
                                통합 계좌 운영 허브
                            </div>
                            <h1 className="mt-3 text-3xl font-bold text-slate-900">계좌번호 관리</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                작업자는 팀별로, 팀은 시공팀/지원팀/용역팀별로, 회사는 시공사/협력사/건설사별로 계좌를 묶어서 관리합니다.
                                별도 지급이 필요한 매입계좌와 기타계좌도 같은 화면에서 함께 운영할 수 있습니다.
                            </p>
                        </div>

                        <div className="grid min-w-[280px] grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div>
                                <div className="text-xs font-semibold text-slate-500">작업자 미등록</div>
                                <div className="mt-1 text-2xl font-bold text-slate-900">{workerMissingCount}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500">팀 미등록</div>
                                <div className="mt-1 text-2xl font-bold text-slate-900">{teamMissingCount}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500">회사 미등록</div>
                                <div className="mt-1 text-2xl font-bold text-slate-900">{companyMissingCount}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500">커스텀 계좌</div>
                                <div className="mt-1 text-2xl font-bold text-slate-900">{purchaseCount + otherCount}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {renderToolbar}

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex min-w-max gap-1 p-2">
                    {[
                        { key: 'overview', label: '개요' },
                        { key: 'workers', label: '작업자 계좌' },
                        { key: 'teams', label: '팀 계좌' },
                        { key: 'companies', label: '회사 계좌' },
                        { key: 'custom', label: '매입/기타 계좌' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key as AccountTab)}
                            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                                activeTab === tab.key
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
                    계좌 데이터를 불러오는 중입니다...
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <SummaryCard
                                    title="작업자 계좌 등록"
                                    value={`${cheongyeonWorkers.length - workerMissingCount}/${cheongyeonWorkers.length}`}
                                    description={`청연 소속 팀 기준으로 묶어 관리하며 미등록 ${workerMissingCount}명`}
                                    icon={faHardHat}
                                    toneClass="border-blue-200 bg-blue-50 text-blue-600"
                                    onClick={() => {
                                        setSelectedWorkerTeamKey('all');
                                        setActiveTab('workers');
                                    }}
                                />
                                <SummaryCard
                                    title="팀 계좌 등록"
                                    value={`${teams.length - teamMissingCount}/${teams.length}`}
                                    description={`시공팀/지원팀/용역팀 중 미등록 ${teamMissingCount}팀`}
                                    icon={faUsers}
                                    toneClass="border-amber-200 bg-amber-50 text-amber-600"
                                    onClick={() => setActiveTab('teams')}
                                />
                                <SummaryCard
                                    title="회사 계좌 등록"
                                    value={`${companies.length - companyMissingCount}/${companies.length}`}
                                    description={`시공사/협력사/건설사 중 미등록 ${companyMissingCount}개`}
                                    icon={faBuilding}
                                    toneClass="border-emerald-200 bg-emerald-50 text-emerald-600"
                                    onClick={() => setActiveTab('companies')}
                                />
                                <SummaryCard
                                    title="매입계좌"
                                    value={`${purchaseCount}`}
                                    description="매입 지급용 별도 계좌"
                                    icon={faLayerGroup}
                                    toneClass="border-sky-200 bg-sky-50 text-sky-600"
                                    onClick={() => setActiveTab('custom')}
                                />
                                <SummaryCard
                                    title="기타계좌"
                                    value={`${otherCount}`}
                                    description="운영용 기타 별도 계좌"
                                    icon={faSitemap}
                                    toneClass="border-violet-200 bg-violet-50 text-violet-600"
                                    onClick={() => setActiveTab('custom')}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2 text-slate-900">
                                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-rose-500" />
                                        <h2 className="text-lg font-bold">작업자 누락 팀</h2>
                                    </div>
                                    <div className="space-y-3">
                                        {topWorkerGaps.length === 0 && <div className="text-sm text-slate-500">모든 팀에 작업자 계좌가 등록되어 있습니다.</div>}
                                        {topWorkerGaps.map((group) => (
                                            <button
                                                key={group.key}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedWorkerTeamKey(group.key);
                                                    setActiveTab('workers');
                                                    setExpandedWorkerGroups((prev) => ({ ...prev, [group.key]: true }));
                                                }}
                                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100"
                                            >
                                                <div>
                                                    <div className="font-semibold text-slate-800">{group.teamName}</div>
                                                    <div className="mt-1 text-xs text-slate-500">{group.teamType} · {group.companyName || '소속사 미지정'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-rose-600">{group.missingCount}</div>
                                                    <div className="text-xs text-slate-400">미등록</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2 text-slate-900">
                                        <FontAwesomeIcon icon={faUsers} className="text-amber-500" />
                                        <h2 className="text-lg font-bold">팀 유형별 누락</h2>
                                    </div>
                                    <div className="space-y-3">
                                        {topTeamGaps.length === 0 && <div className="text-sm text-slate-500">모든 팀 유형의 계좌가 등록되어 있습니다.</div>}
                                        {topTeamGaps.map((group) => (
                                            <button
                                                key={group.key}
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab('teams');
                                                    setExpandedTeamGroups((prev) => ({ ...prev, [group.key]: true }));
                                                }}
                                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100"
                                            >
                                                <div className="font-semibold text-slate-800">{group.label}</div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-amber-600">{group.missingCount}</div>
                                                    <div className="text-xs text-slate-400">미등록 팀</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2 text-slate-900">
                                        <FontAwesomeIcon icon={faBuilding} className="text-emerald-500" />
                                        <h2 className="text-lg font-bold">회사 유형별 누락</h2>
                                    </div>
                                    <div className="space-y-3">
                                        {topCompanyGaps.length === 0 && <div className="text-sm text-slate-500">모든 회사 유형의 계좌가 등록되어 있습니다.</div>}
                                        {topCompanyGaps.map((group) => (
                                            <button
                                                key={group.key}
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab('companies');
                                                    setExpandedCompanyGroups((prev) => ({ ...prev, [group.key]: true }));
                                                }}
                                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100"
                                            >
                                                <div className="font-semibold text-slate-800">{group.label}</div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-emerald-600">{group.missingCount}</div>
                                                    <div className="text-xs text-slate-400">미등록 회사</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'workers' && (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">청연 소속 팀원만 작업자 계좌 목록에 표시됩니다.</div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            청연 소속 전체 {cheongyeonWorkers.length}명 중 현재 {visibleWorkerCount}명을 보고 있습니다.
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <label htmlFor="worker-team-filter" className="text-sm font-medium text-slate-600">
                                            팀 선택
                                        </label>
                                        <select
                                            id="worker-team-filter"
                                            value={selectedWorkerTeamKey}
                                            onChange={(event) => setSelectedWorkerTeamKey(event.target.value)}
                                            className="min-w-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        >
                                            <option value="all">청연 전체 팀</option>
                                            {workerTeamOptions.map((option) => (
                                                <option key={option.key} value={option.key}>
                                                    {`${option.label} · ${option.teamType} · ${option.workerCount}명`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {workerTeamOptions.length === 0 && renderEmptyState('청연 소속 팀 작업자 데이터가 없습니다.')}
                            {workerTeamOptions.length > 0 && visibleWorkerGroups.length === 0 && renderEmptyState('선택한 조건에 맞는 청연 소속 작업자 계좌 데이터가 없습니다.')}
                            {visibleWorkerGroups.map((group) => (
                                <div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedWorkerGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                                        className="flex w-full items-center justify-between gap-4 bg-slate-50 px-5 py-4 text-left"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-bold text-slate-900">{group.teamName}</h2>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getTeamTypeBadgeClass(group.teamType)}`}>
                                                    {group.teamType}
                                                </span>
                                                {group.companyName && <span className="text-sm text-slate-500">{group.companyName}</span>}
                                            </div>
                                            <div className="mt-2 text-sm text-slate-500">작업자 {group.items.length}명 · 미등록 {group.missingCount}명</div>
                                        </div>
                                        <FontAwesomeIcon icon={expandedWorkerGroups[group.key] ? faChevronDown : faChevronRight} className="text-slate-400" />
                                    </button>

                                    {expandedWorkerGroups[group.key] && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-slate-900 text-xs uppercase text-white">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">작업자</th>
                                                        <th className="px-4 py-3 text-left">직책/상태</th>
                                                        <th className="px-4 py-3 text-left">은행</th>
                                                        <th className="px-4 py-3 text-left">계좌번호</th>
                                                        <th className="px-4 py-3 text-left">예금주</th>
                                                        <th className="px-4 py-3 text-left">저장</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map((worker) => {
                                                        const savingKey = `worker:${worker.id}`;
                                                        return (
                                                            <tr key={worker.id} className="align-top">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-semibold text-slate-900">{worker.name}</div>
                                                                    <div className="mt-1 text-xs text-slate-500">{worker.contact || '연락처 없음'}</div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="text-slate-700">{worker.role || '작업자'}</div>
                                                                    <div className="mt-1 text-xs text-slate-500">{worker.status || '재직'}</div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={worker.bankName || ''}
                                                                        onChange={(event) => updateWorkerField(worker.id || '', 'bankName', event.target.value)}
                                                                        className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={worker.accountNumber || ''}
                                                                        onChange={(event) => updateWorkerField(worker.id || '', 'accountNumber', event.target.value)}
                                                                        className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={worker.accountHolder || ''}
                                                                        onChange={(event) => updateWorkerField(worker.id || '', 'accountHolder', event.target.value)}
                                                                        className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        type="button"
                                                                        disabled={!worker.id || !!savingKeys[savingKey]}
                                                                        onClick={() => worker.id && saveWorkerAccount(worker.id)}
                                                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                                                        {savingKeys[savingKey] ? '저장 중...' : '저장'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'teams' && (
                        <div className="space-y-4">
                            {teamGroups.length === 0 && renderEmptyState('조건에 맞는 팀 계좌 데이터가 없습니다.')}
                            {teamGroups.map((group) => (
                                <div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedTeamGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                                        className="flex w-full items-center justify-between gap-4 bg-slate-50 px-5 py-4 text-left"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-bold text-slate-900">{group.label}</h2>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getTeamTypeBadgeClass(group.label)}`}>
                                                {group.items.length}팀
                                            </span>
                                            <span className="text-sm text-slate-500">미등록 {group.missingCount}팀</span>
                                        </div>
                                        <FontAwesomeIcon icon={expandedTeamGroups[group.key] ? faChevronDown : faChevronRight} className="text-slate-400" />
                                    </button>

                                    {expandedTeamGroups[group.key] && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-slate-900 text-xs uppercase text-white">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">팀명</th>
                                                        <th className="px-4 py-3 text-left">소속사</th>
                                                        <th className="px-4 py-3 text-left">팀장</th>
                                                        <th className="px-4 py-3 text-left">은행</th>
                                                        <th className="px-4 py-3 text-left">계좌번호</th>
                                                        <th className="px-4 py-3 text-left">예금주</th>
                                                        <th className="px-4 py-3 text-left">저장</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map((team) => {
                                                        const savingKey = `team:${team.id}`;
                                                        return (
                                                            <tr key={team.id} className="align-top">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-semibold text-slate-900">{team.name}</div>
                                                                    <div className="mt-1 text-xs text-slate-500">{team.memberCount || 0}명</div>
                                                                </td>
                                                                <td className="px-4 py-3">{team.companyName || '미지정'}</td>
                                                                <td className="px-4 py-3">{team.leaderName || '미지정'}</td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={team.bankName || ''}
                                                                        onChange={(event) => updateTeamField(team.id || '', 'bankName', event.target.value)}
                                                                        className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={team.accountNumber || ''}
                                                                        onChange={(event) => updateTeamField(team.id || '', 'accountNumber', event.target.value)}
                                                                        className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={team.accountHolder || ''}
                                                                        onChange={(event) => updateTeamField(team.id || '', 'accountHolder', event.target.value)}
                                                                        className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        type="button"
                                                                        disabled={!team.id || !!savingKeys[savingKey]}
                                                                        onClick={() => team.id && saveTeamAccount(team.id)}
                                                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                                                        {savingKeys[savingKey] ? '저장 중...' : '저장'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'companies' && (
                        <div className="space-y-4">
                            {companyGroups.length === 0 && renderEmptyState('조건에 맞는 회사 계좌 데이터가 없습니다.')}
                            {companyGroups.map((group) => (
                                <div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedCompanyGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                                        className="flex w-full items-center justify-between gap-4 bg-slate-50 px-5 py-4 text-left"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-bold text-slate-900">{group.label}</h2>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getCompanyTypeBadgeClass(group.label)}`}>
                                                {group.items.length}개
                                            </span>
                                            <span className="text-sm text-slate-500">미등록 {group.missingCount}개</span>
                                        </div>
                                        <FontAwesomeIcon icon={expandedCompanyGroups[group.key] ? faChevronDown : faChevronRight} className="text-slate-400" />
                                    </button>

                                    {expandedCompanyGroups[group.key] && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-slate-900 text-xs uppercase text-white">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">회사명</th>
                                                        <th className="px-4 py-3 text-left">대표자</th>
                                                        <th className="px-4 py-3 text-left">사업자번호</th>
                                                        <th className="px-4 py-3 text-left">은행</th>
                                                        <th className="px-4 py-3 text-left">계좌번호</th>
                                                        <th className="px-4 py-3 text-left">예금주</th>
                                                        <th className="px-4 py-3 text-left">저장</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map((company) => {
                                                        const savingKey = `company:${company.id}`;
                                                        return (
                                                            <tr key={company.id} className="align-top">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-semibold text-slate-900">{company.name}</div>
                                                                    <div className="mt-1 text-xs text-slate-500">{company.phone || '연락처 없음'}</div>
                                                                </td>
                                                                <td className="px-4 py-3">{company.ceoName || '미지정'}</td>
                                                                <td className="px-4 py-3">{company.businessNumber || '미지정'}</td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={company.bankName || ''}
                                                                        onChange={(event) => updateCompanyField(company.id || '', 'bankName', event.target.value)}
                                                                        className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={company.accountNumber || ''}
                                                                        onChange={(event) => updateCompanyField(company.id || '', 'accountNumber', event.target.value)}
                                                                        className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        value={company.accountHolder || ''}
                                                                        onChange={(event) => updateCompanyField(company.id || '', 'accountHolder', event.target.value)}
                                                                        className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        type="button"
                                                                        disabled={!company.id || !!savingKeys[savingKey]}
                                                                        onClick={() => company.id && saveCompanyAccount(company.id)}
                                                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                                                        {savingKeys[savingKey] ? '저장 중...' : '저장'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'custom' && (
                        <div className="space-y-4">
                            {customGroups.map((group) => {
                                const category = group.key as CustomCategory;
                                const meta = CUSTOM_CATEGORY_META[category];
                                const draft = customDrafts[category];
                                const savingKey = `custom:new:${category}`;

                                return (
                                    <div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCustomGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                                            className="flex w-full items-center justify-between gap-4 bg-slate-50 px-5 py-4 text-left"
                                        >
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="text-lg font-bold text-slate-900">{meta.title}</h2>
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.accent}`}>
                                                        {group.items.length}건
                                                    </span>
                                                    <span className="text-sm text-slate-500">미등록 {group.missingCount}건</span>
                                                </div>
                                                <div className="mt-2 text-sm text-slate-500">{meta.description}</div>
                                            </div>
                                            <FontAwesomeIcon icon={expandedCustomGroups[group.key] ? faChevronDown : faChevronRight} className="text-slate-400" />
                                        </button>

                                        {expandedCustomGroups[group.key] && (
                                            <div className="space-y-4 p-5">
                                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                                                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                                                        <FontAwesomeIcon icon={faPlus} />
                                                        새 {meta.title} 추가
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1.2fr_1fr_1.2fr_auto]">
                                                        <input value={draft.name} onChange={(event) => updateCustomDraft(category, 'name', event.target.value)} placeholder="계좌명" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={draft.bankName || ''} onChange={(event) => updateCustomDraft(category, 'bankName', event.target.value)} placeholder="은행" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={draft.accountNumber || ''} onChange={(event) => updateCustomDraft(category, 'accountNumber', event.target.value)} placeholder="계좌번호" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={draft.accountHolder || ''} onChange={(event) => updateCustomDraft(category, 'accountHolder', event.target.value)} placeholder="예금주" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                        <input value={draft.note || ''} onChange={(event) => updateCustomDraft(category, 'note', event.target.value)} placeholder="메모" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                        <button type="button" disabled={!!savingKeys[savingKey]} onClick={() => addCustomEntry(category)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                            <FontAwesomeIcon icon={faPlus} />
                                                            {savingKeys[savingKey] ? '추가 중...' : '추가'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {group.items.length === 0 ? (
                                                    renderEmptyState(`${meta.title}에 등록된 항목이 없습니다.`)
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full text-sm">
                                                            <thead className="bg-slate-900 text-xs uppercase text-white">
                                                                <tr>
                                                                    <th className="px-4 py-3 text-left">계좌명</th>
                                                                    <th className="px-4 py-3 text-left">은행</th>
                                                                    <th className="px-4 py-3 text-left">계좌번호</th>
                                                                    <th className="px-4 py-3 text-left">예금주</th>
                                                                    <th className="px-4 py-3 text-left">메모</th>
                                                                    <th className="px-4 py-3 text-left">상태</th>
                                                                    <th className="px-4 py-3 text-left">관리</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {group.items.map((entry) => {
                                                                    const rowSavingKey = `custom:${entry.id}`;
                                                                    return (
                                                                        <tr key={entry.id} className="align-top">
                                                                            <td className="px-4 py-3"><input value={entry.name || ''} onChange={(event) => updateCustomField(entry.id || '', 'name', event.target.value)} className="w-48 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                                                                            <td className="px-4 py-3"><input value={entry.bankName || ''} onChange={(event) => updateCustomField(entry.id || '', 'bankName', event.target.value)} className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                                                                            <td className="px-4 py-3"><input value={entry.accountNumber || ''} onChange={(event) => updateCustomField(entry.id || '', 'accountNumber', event.target.value)} className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                                                                            <td className="px-4 py-3"><input value={entry.accountHolder || ''} onChange={(event) => updateCustomField(entry.id || '', 'accountHolder', event.target.value)} className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                                                                            <td className="px-4 py-3"><input value={entry.note || ''} onChange={(event) => updateCustomField(entry.id || '', 'note', event.target.value)} className="w-48 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                                                                            <td className="px-4 py-3">
                                                                                <select value={entry.status || 'active'} onChange={(event) => updateCustomField(entry.id || '', 'status', event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                                                                                    <option value="active">사용중</option>
                                                                                    <option value="inactive">보관</option>
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <button type="button" disabled={!entry.id || !!savingKeys[rowSavingKey]} onClick={() => entry.id && saveCustomEntry(entry.id)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                                                                        {savingKeys[rowSavingKey] ? '저장 중...' : '저장'}
                                                                                    </button>
                                                                                    <button type="button" disabled={!entry.id || !!savingKeys[rowSavingKey]} onClick={() => entry.id && deleteCustomEntry(entry.id)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                                                                                        <FontAwesomeIcon icon={faTrash} />
                                                                                        삭제
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AccountManagementPage;
