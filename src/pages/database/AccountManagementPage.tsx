import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faChevronDown,
    faChevronRight,
    faCreditCard,
    faDownload,
    faEye,
    faEyeSlash,
    faFloppyDisk,
    faHardHat,
    faLayerGroup,
    faPenToSquare,
    faPlus,
    faRotateRight,
    faSearch,
    faSitemap,
    faTrash,
    faTriangleExclamation,
    faUpload,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { accountDirectoryService, AccountDirectory } from '../../services/accountDirectoryService';

type AccountTab = 'overview' | 'workers' | 'teams' | 'companies' | 'custom';
type CustomCategory = AccountDirectory['category'];
type AccountField = 'bankName' | 'accountNumber' | 'accountHolder';
type CustomEditableField = keyof Pick<AccountDirectory, 'name' | 'bankName' | 'accountNumber' | 'accountHolder' | 'note' | 'status'>;
type WorkerEmploymentFilter = 'active' | 'retired' | 'all';
type WorkerSalaryFilter = 'all' | 'daily' | 'monthly' | 'other';
type WorkerSalarySectionKey = Exclude<WorkerSalaryFilter, 'all'>;

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

interface WorkerSalarySection {
    key: WorkerSalarySectionKey;
    title: string;
    description: string;
    icon: any;
    accentClass: string;
    groups: WorkerGroup[];
    workerCount: number;
    missingCount: number;
}

interface EntityGroup<T> {
    key: string;
    label: string;
    items: T[];
    missingCount: number;
}

type UploadTarget = 'workers' | 'teams' | 'companies' | 'custom';

type UploadPreviewRowStatus = 'matched' | 'create' | 'skipped';

interface UploadPreviewRow {
    keyText: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    status: UploadPreviewRowStatus;
    reason?: string;
}

interface UploadPreviewSection {
    target: UploadTarget;
    label: string;
    sheetName: string;
    rows: Record<string, unknown>[];
    rowCount: number;
    updateCount: number;
    createCount: number;
    skippedCount: number;
    previewRows: UploadPreviewRow[];
    mismatchRows: UploadPreviewRow[];
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
const HIDDEN_ACCOUNT_STORAGE_KEY = 'cy_account_management_hidden_accounts_v1';
const SHOW_HIDDEN_ACCOUNT_STORAGE_KEY = 'cy_account_management_show_hidden_accounts_v1';

const readHiddenAccountKeys = (): string[] => {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(HIDDEN_ACCOUNT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch (error) {
        console.warn('Failed to read hidden account keys:', error);
        return [];
    }
};

const readShowHiddenAccounts = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SHOW_HIDDEN_ACCOUNT_STORAGE_KEY) === 'true';
};

const writeHiddenAccountKeys = (keys: string[]) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(HIDDEN_ACCOUNT_STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
        console.warn('Failed to store hidden account keys:', error);
    }
};

const writeShowHiddenAccounts = (value: boolean) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(SHOW_HIDDEN_ACCOUNT_STORAGE_KEY, value ? 'true' : 'false');
    } catch (error) {
        console.warn('Failed to store hidden account view option:', error);
    }
};

const getEntityToken = (id: unknown, name: unknown) => {
    const normalizedId = normalizeText(id);
    if (normalizedId) return normalizedId;

    const normalizedName = normalizeText(name);
    return normalizedName ? `name:${normalizedName}` : '__unknown__';
};

const getWorkerAccountKey = (worker: Pick<Worker, 'id' | 'name'>) => `worker:${getEntityToken(worker.id, worker.name)}`;
const getTeamAccountKey = (team: Pick<Team, 'id' | 'name'>) => `team:${getEntityToken(team.id, team.name)}`;
const getCompanyAccountKey = (company: Pick<Company, 'id' | 'name'>) => `company:${getEntityToken(company.id, company.name)}`;
const getCustomAccountKey = (entry: Pick<AccountDirectory, 'id' | 'name' | 'category'>) => {
    const normalizedId = normalizeText(entry.id);
    return `custom:${normalizedId || `${entry.category}:${normalizeText(entry.name) || '__unknown__'}`}`;
};

const isEndedAccountStatus = (value: unknown) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return false;

    return (
        normalized === 'inactive' ||
        normalized === 'archived' ||
        normalized === 'closed' ||
        normalized === 'ended' ||
        normalized.includes('\uC885\uB8CC') ||
        normalized.includes('\uBCF4\uAD00')
    );
};

const parseAccountTab = (value: string | null): AccountTab => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'workers') return 'workers';
    if (normalized === 'teams') return 'teams';
    if (normalized === 'companies') return 'companies';
    if (normalized === 'custom' || normalized === 'purchase' || normalized === 'other') return 'custom';
    return 'overview';
};
const toNullableText = (value: unknown) => {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : undefined;
};
const hasAccountNumber = (value: unknown) => normalizeText(value).length > 0;
const ACTIVE_WORKER_LABEL = '\uC7AC\uC9C1';
const RETIRED_WORKER_LABEL = '\uD1F4\uC0AC';
const DAILY_WAGE_LABEL = '\uC77C\uAE09\uC81C';
const MONTHLY_WAGE_LABEL = '\uC6D4\uAE09\uC81C';
const OTHER_WAGE_LABEL = '\uBBF8\uBD84\uB958';
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

const getWorkerEmploymentStatus = (worker: Pick<Worker, 'status' | 'isActive'>): WorkerEmploymentFilter => {
    const normalizedStatus = normalizeText(worker.status).toLowerCase();
    if (worker.isActive === false) return 'retired';
    if (normalizedStatus.includes('\uD1F4\uC0AC') || normalizedStatus === 'inactive') return 'retired';
    return 'active';
};

const getWorkerEmploymentLabel = (worker: Pick<Worker, 'status' | 'isActive'>) =>
    getWorkerEmploymentStatus(worker) === 'retired' ? RETIRED_WORKER_LABEL : ACTIVE_WORKER_LABEL;

const getWorkerEmploymentBadgeClass = (worker: Pick<Worker, 'status' | 'isActive'>) =>
    getWorkerEmploymentStatus(worker) === 'retired'
        ? 'border border-rose-200 bg-rose-50 text-rose-700'
        : 'border border-emerald-200 bg-emerald-50 text-emerald-700';

const getWorkerSalarySectionKey = (worker: Pick<Worker, 'salaryModel' | 'payType'>): WorkerSalarySectionKey => {
    const normalizedSalaryModel = normalizeText(worker.salaryModel || worker.payType);
    if (normalizedSalaryModel === MONTHLY_WAGE_LABEL) return 'monthly';
    if (normalizedSalaryModel === DAILY_WAGE_LABEL) return 'daily';
    return 'other';
};

const getWorkerSalaryLabel = (worker: Pick<Worker, 'salaryModel' | 'payType'>) => {
    const key = getWorkerSalarySectionKey(worker);
    if (key === 'monthly') return MONTHLY_WAGE_LABEL;
    if (key === 'daily') return DAILY_WAGE_LABEL;
    return OTHER_WAGE_LABEL;
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

const EMPTY_ACCOUNT_FIELDS = {
    bankName: '',
    accountNumber: '',
    accountHolder: '',
} as const;

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
    const [searchParams] = useSearchParams();
    const requestedTabParam = searchParams.get('tab');
    const requestedTab = useMemo(() => parseAccountTab(requestedTabParam), [requestedTabParam]);
    const [activeTab, setActiveTab] = useState<AccountTab>(requestedTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [selectedWorkerTeamKey, setSelectedWorkerTeamKey] = useState('all');
    const [workerEmploymentFilter, setWorkerEmploymentFilter] = useState<WorkerEmploymentFilter>('active');
    const [workerSalaryFilter, setWorkerSalaryFilter] = useState<WorkerSalaryFilter>('all');
    const [showHiddenAccounts, setShowHiddenAccounts] = useState(readShowHiddenAccounts);
    const [hiddenAccountKeys, setHiddenAccountKeys] = useState<string[]>(readHiddenAccountKeys);

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [customAccounts, setCustomAccounts] = useState<AccountDirectory[]>([]);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
    const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});
    const [rowSnapshots, setRowSnapshots] = useState<Record<string, Worker | Team | Company | AccountDirectory>>({});
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

    const [uploadPreviewFileName, setUploadPreviewFileName] = useState('');
    const [uploadPreviewSections, setUploadPreviewSections] = useState<UploadPreviewSection[]>([]);
    const [applyingUpload, setApplyingUpload] = useState(false);

    useEffect(() => {
        writeHiddenAccountKeys(hiddenAccountKeys);
    }, [hiddenAccountKeys]);

    useEffect(() => {
        writeShowHiddenAccounts(showHiddenAccounts);
    }, [showHiddenAccounts]);
    useEffect(() => {
        setActiveTab(requestedTab);
    }, [requestedTab]);

    const setSaving = useCallback((key: string, value: boolean) => {
        setSavingKeys((prev) => ({ ...prev, [key]: value }));
    }, []);

    const beginRowEdit = useCallback((key: string, snapshot: Worker | Team | Company | AccountDirectory) => {
        setEditingKeys((prev) => ({ ...prev, [key]: true }));
        setRowSnapshots((prev) => (prev[key] ? prev : { ...prev, [key]: snapshot }));
    }, []);

    const clearRowControl = useCallback((key: string) => {
        setEditingKeys((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setRowSnapshots((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const hiddenAccountKeySet = useMemo(() => new Set(hiddenAccountKeys), [hiddenAccountKeys]);

    const hideAccountKey = useCallback((key: string) => {
        setHiddenAccountKeys((prev) => {
            if (prev.includes(key)) return prev;
            return [...prev, key].sort();
        });
    }, []);

    const showAccountKey = useCallback((key: string) => {
        setHiddenAccountKeys((prev) => prev.filter((item) => item !== key));
    }, []);

    const isAccountKeyHidden = useCallback((key: string) => hiddenAccountKeySet.has(key), [hiddenAccountKeySet]);

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
            setEditingKeys({});
            setRowSnapshots({});
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
        const company = companyById.get(team?.companyId || '');
        const resolvedTeamName = normalizeText(team?.name) || normalizeText(worker.teamName);
        const teamKey = normalizeText(worker.teamId) || (resolvedTeamName ? `name:${resolvedTeamName}` : '__unassigned__');
        const teamType = normalizeText(team?.type) || normalizeText(worker.teamType) || '미지정';
        const companyName =
            normalizeText(team?.companyName) ||
            normalizeText(company?.name) ||
            normalizeText(worker.companyName);
        const companyKey = normalizeText(company?.id) || normalizeText(team?.companyId) || (companyName ? `name:${companyName}` : '__unassigned__');

        return {
            teamKey,
            teamName: resolvedTeamName || '미배정 작업자',
            teamType,
            companyName,
            companyKey,
            teamStatus: normalizeText(team?.status),
            companyStatus: normalizeText(company?.status),
        };
    }, [companyById, teamById]);

    const isTeamAccountHidden = useCallback(
        (team: Pick<Team, 'id' | 'name' | 'status'>) => isEndedAccountStatus(team.status) || isAccountKeyHidden(getTeamAccountKey(team)),
        [isAccountKeyHidden]
    );

    const isCompanyAccountHidden = useCallback(
        (company: Pick<Company, 'id' | 'name' | 'status'>) => isEndedAccountStatus(company.status) || isAccountKeyHidden(getCompanyAccountKey(company)),
        [isAccountKeyHidden]
    );

    const isCustomAccountHidden = useCallback(
        (entry: Pick<AccountDirectory, 'id' | 'name' | 'category' | 'status'>) => isEndedAccountStatus(entry.status) || isAccountKeyHidden(getCustomAccountKey(entry)),
        [isAccountKeyHidden]
    );

    const isWorkerAccountHidden = useCallback(
        (worker: Pick<Worker, 'id' | 'name' | 'status' | 'isActive'>) => getWorkerEmploymentStatus(worker) === 'retired' || isAccountKeyHidden(getWorkerAccountKey(worker)),
        [isAccountKeyHidden]
    );

    const isWorkerHiddenByAccountScope = useCallback(
        (worker: Worker) => {
            const { teamKey, companyKey, teamStatus, companyStatus } = getWorkerTeamMeta(worker);
            return (
                isWorkerAccountHidden(worker) ||
                isEndedAccountStatus(teamStatus) ||
                isEndedAccountStatus(companyStatus) ||
                isAccountKeyHidden(`team:${teamKey}`) ||
                isAccountKeyHidden(`company:${companyKey}`)
            );
        },
        [getWorkerTeamMeta, isAccountKeyHidden, isWorkerAccountHidden]
    );

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
            if (!showHiddenAccounts && isWorkerHiddenByAccountScope(worker)) return;

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
    }, [cheongyeonWorkers, getWorkerTeamMeta, isWorkerHiddenByAccountScope, showHiddenAccounts]);

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    const groupWorkersByTeam = useCallback((items: Worker[]): WorkerGroup[] => {
        const grouped = new Map<string, WorkerGroup>();

        items.forEach((worker) => {
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
    }, [getWorkerTeamMeta]);

    const workerScopedItems = useMemo(() => {
        return cheongyeonWorkers.filter((worker) => {
            const { teamKey, teamName, teamType, companyName } = getWorkerTeamMeta(worker);
            if (!showHiddenAccounts && isWorkerHiddenByAccountScope(worker)) return false;
            if (selectedWorkerTeamKey !== 'all' && teamKey !== selectedWorkerTeamKey) return false;
            if (onlyMissing && hasAccountNumber(worker.accountNumber)) return false;
            if (!normalizedSearchTerm) return true;

            return [
                worker.name,
                teamName,
                teamType,
                companyName,
                worker.accountHolder,
                worker.accountNumber,
                worker.bankName,
                worker.role,
                getWorkerEmploymentLabel(worker),
                getWorkerSalaryLabel(worker),
            ].some((value) => normalizeText(value).toLowerCase().includes(normalizedSearchTerm));
        });
    }, [cheongyeonWorkers, getWorkerTeamMeta, isWorkerHiddenByAccountScope, normalizedSearchTerm, onlyMissing, selectedWorkerTeamKey, showHiddenAccounts]);

    const workerStatusCounts = useMemo(
        () =>
            workerScopedItems.reduce(
                (acc, worker) => {
                    if (getWorkerEmploymentStatus(worker) === 'retired') acc.retired += 1;
                    else acc.active += 1;
                    return acc;
                },
                { active: 0, retired: 0 }
            ),
        [workerScopedItems]
    );

    const workerSalaryCounts = useMemo(
        () =>
            workerScopedItems.reduce(
                (acc, worker) => {
                    const salaryKey = getWorkerSalarySectionKey(worker);
                    acc[salaryKey] += 1;
                    return acc;
                },
                { daily: 0, monthly: 0, other: 0 }
            ),
        [workerScopedItems]
    );

    const filteredWorkers = useMemo(() => {
        return workerScopedItems.filter((worker) => {
            const employmentStatus = getWorkerEmploymentStatus(worker);
            if (workerEmploymentFilter === 'active') return employmentStatus === 'active';
            if (workerEmploymentFilter === 'retired') return employmentStatus === 'retired';
            return true;
        });
    }, [workerEmploymentFilter, workerScopedItems]);

    const workerGroups = useMemo<WorkerGroup[]>(() => groupWorkersByTeam(workerScopedItems), [groupWorkersByTeam, workerScopedItems]);

    const workerSections = useMemo<WorkerSalarySection[]>(() => {
        const sectionDefinitions: Array<Omit<WorkerSalarySection, 'groups' | 'workerCount' | 'missingCount'>> = [
            {
                key: 'daily',
                title: DAILY_WAGE_LABEL,
                description: '현장 일급제 작업자 계좌를 빠르게 수정하고 저장합니다.',
                icon: faHardHat,
                accentClass: 'border-blue-200 bg-blue-50 text-blue-700',
            },
            {
                key: 'monthly',
                title: MONTHLY_WAGE_LABEL,
                description: '월급제 작업자를 별도 섹션으로 분리해 한눈에 확인합니다.',
                icon: faUsers,
                accentClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            },
            {
                key: 'other',
                title: OTHER_WAGE_LABEL,
                description: '급여 방식이 비어 있거나 다른 값으로 저장된 작업자입니다.',
                icon: faLayerGroup,
                accentClass: 'border-slate-200 bg-slate-100 text-slate-700',
            },
        ];

        return sectionDefinitions
            .filter((section) => workerSalaryFilter === 'all' || workerSalaryFilter === section.key)
            .map((section) => {
                const items = filteredWorkers.filter((worker) => getWorkerSalarySectionKey(worker) === section.key);
                return {
                    ...section,
                    groups: groupWorkersByTeam(items),
                    workerCount: items.length,
                    missingCount: items.filter((worker) => !hasAccountNumber(worker.accountNumber)).length,
                };
            })
            .filter((section) => section.workerCount > 0 || workerSalaryFilter === section.key);
    }, [filteredWorkers, groupWorkersByTeam, workerSalaryFilter]);

    const visibleWorkerRows = useMemo(
        () => workerSections.flatMap((section) => section.groups.flatMap((group) => group.items)),
        [workerSections]
    );

    const visibleWorkerCount = useMemo(
        () => filteredWorkers.length,
        [filteredWorkers]
    );

    const filteredTeams = useMemo(() => {
        return teams.filter((team) => {
            if (!showHiddenAccounts && isTeamAccountHidden(team)) return false;
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
    }, [isTeamAccountHidden, normalizedSearchTerm, onlyMissing, showHiddenAccounts, teams]);

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
            if (!showHiddenAccounts && isCompanyAccountHidden(company)) return false;
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
    }, [companies, isCompanyAccountHidden, normalizedSearchTerm, onlyMissing, showHiddenAccounts]);

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
            if (!showHiddenAccounts && isCustomAccountHidden(entry)) return false;
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
    }, [customAccounts, isCustomAccountHidden, normalizedSearchTerm, onlyMissing, showHiddenAccounts]);

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

    const visibleCheongyeonWorkersForStats = useMemo(
        () => cheongyeonWorkers.filter((item) => showHiddenAccounts || !isWorkerHiddenByAccountScope(item)),
        [cheongyeonWorkers, isWorkerHiddenByAccountScope, showHiddenAccounts]
    );
    const visibleTeamsForStats = useMemo(
        () => teams.filter((item) => showHiddenAccounts || !isTeamAccountHidden(item)),
        [isTeamAccountHidden, showHiddenAccounts, teams]
    );
    const visibleCompaniesForStats = useMemo(
        () => companies.filter((item) => showHiddenAccounts || !isCompanyAccountHidden(item)),
        [companies, isCompanyAccountHidden, showHiddenAccounts]
    );
    const visibleCustomAccountsForStats = useMemo(
        () => customAccounts.filter((item) => showHiddenAccounts || !isCustomAccountHidden(item)),
        [customAccounts, isCustomAccountHidden, showHiddenAccounts]
    );
    const workerMissingCount = useMemo(
        () => visibleCheongyeonWorkersForStats.filter((item) => !hasAccountNumber(item.accountNumber)).length,
        [visibleCheongyeonWorkersForStats]
    );
    const teamMissingCount = useMemo(() => visibleTeamsForStats.filter((item) => !hasAccountNumber(item.accountNumber)).length, [visibleTeamsForStats]);
    const companyMissingCount = useMemo(() => visibleCompaniesForStats.filter((item) => !hasAccountNumber(item.accountNumber)).length, [visibleCompaniesForStats]);
    const purchaseCount = useMemo(() => visibleCustomAccountsForStats.filter((item) => item.category === 'purchase').length, [visibleCustomAccountsForStats]);
    const otherCount = useMemo(() => visibleCustomAccountsForStats.filter((item) => item.category === 'other').length, [visibleCustomAccountsForStats]);
    const hiddenWorkerCount = useMemo(() => cheongyeonWorkers.filter((item) => isWorkerHiddenByAccountScope(item)).length, [cheongyeonWorkers, isWorkerHiddenByAccountScope]);
    const hiddenTeamCount = useMemo(() => teams.filter((item) => isTeamAccountHidden(item)).length, [isTeamAccountHidden, teams]);
    const hiddenCompanyCount = useMemo(() => companies.filter((item) => isCompanyAccountHidden(item)).length, [companies, isCompanyAccountHidden]);
    const hiddenCustomCount = useMemo(() => customAccounts.filter((item) => isCustomAccountHidden(item)).length, [customAccounts, isCustomAccountHidden]);
    const hiddenAccountCount = hiddenWorkerCount + hiddenTeamCount + hiddenCompanyCount + hiddenCustomCount;

    const topWorkerGaps = useMemo(() => workerGroups.filter((group) => group.missingCount > 0).sort((a, b) => b.missingCount - a.missingCount).slice(0, 5), [workerGroups]);
    const topTeamGaps = useMemo(() => teamGroups.filter((group) => group.missingCount > 0), [teamGroups]);
    const topCompanyGaps = useMemo(() => companyGroups.filter((group) => group.missingCount > 0), [companyGroups]);

    const updateWorkerField = (workerId: string, field: AccountField, value: string) => {
        setWorkers((prev) => prev.map((worker) => (worker.id === workerId ? { ...worker, [field]: value } : worker)));
    };

    const cancelWorkerEdit = (workerId: string) => {
        const key = `worker:${workerId}`;
        const snapshot = rowSnapshots[key] as Worker | undefined;
        if (snapshot) {
            setWorkers((prev) => prev.map((worker) => (worker.id === workerId ? snapshot : worker)));
        }
        clearRowControl(key);
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
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to update worker account:', error);
            alert('작업자 계좌 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const clearWorkerAccount = async (workerId: string) => {
        const target = workers.find((worker) => worker.id === workerId);
        if (!target || !target.id) return;
        if (!window.confirm(`"${target.name}" 작업자의 계좌정보를 삭제하시겠습니까? 작업자 자체는 삭제되지 않습니다.`)) return;

        const key = `worker:${workerId}`;
        setSaving(key, true);
        try {
            await manpowerService.updateWorker(workerId, {
                bankName: '',
                accountNumber: '',
                accountHolder: '',
            });
            setWorkers((prev) => prev.map((worker) => (worker.id === workerId ? { ...worker, ...EMPTY_ACCOUNT_FIELDS } : worker)));
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to clear worker account:', error);
            alert('작업자 계좌 삭제 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const updateTeamField = (teamId: string, field: AccountField, value: string) => {
        setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, [field]: value } : team)));
    };

    const cancelTeamEdit = (teamId: string) => {
        const key = `team:${teamId}`;
        const snapshot = rowSnapshots[key] as Team | undefined;
        if (snapshot) {
            setTeams((prev) => prev.map((team) => (team.id === teamId ? snapshot : team)));
        }
        clearRowControl(key);
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
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to update team account:', error);
            alert('팀 계좌 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const clearTeamAccount = async (teamId: string) => {
        const target = teams.find((team) => team.id === teamId);
        if (!target || !target.id) return;
        if (!window.confirm(`"${target.name}" 팀의 계좌정보를 삭제하시겠습니까? 팀 자체는 삭제되지 않습니다.`)) return;

        const key = `team:${teamId}`;
        setSaving(key, true);
        try {
            await teamService.updateTeam(teamId, {
                bankName: '',
                accountNumber: '',
                accountHolder: '',
            });
            setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, ...EMPTY_ACCOUNT_FIELDS } : team)));
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to clear team account:', error);
            alert('팀 계좌 삭제 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const updateCompanyField = (companyId: string, field: AccountField, value: string) => {
        setCompanies((prev) => prev.map((company) => (company.id === companyId ? { ...company, [field]: value } : company)));
    };

    const cancelCompanyEdit = (companyId: string) => {
        const key = `company:${companyId}`;
        const snapshot = rowSnapshots[key] as Company | undefined;
        if (snapshot) {
            setCompanies((prev) => prev.map((company) => (company.id === companyId ? snapshot : company)));
        }
        clearRowControl(key);
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
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to update company account:', error);
            alert('회사 계좌 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const clearCompanyAccount = async (companyId: string) => {
        const target = companies.find((company) => company.id === companyId);
        if (!target || !target.id) return;
        if (!window.confirm(`"${target.name}" 회사의 계좌정보를 삭제하시겠습니까? 회사 자체는 삭제되지 않습니다.`)) return;

        const key = `company:${companyId}`;
        setSaving(key, true);
        try {
            await companyService.updateCompany(companyId, {
                bankName: '',
                accountNumber: '',
                accountHolder: '',
            });
            setCompanies((prev) => prev.map((company) => (company.id === companyId ? { ...company, ...EMPTY_ACCOUNT_FIELDS } : company)));
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to clear company account:', error);
            alert('회사 계좌 삭제 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const updateCustomField = (entryId: string, field: CustomEditableField, value: string) => {
        setCustomAccounts((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)));
    };

    const cancelCustomEdit = (entryId: string) => {
        const key = `custom:${entryId}`;
        const snapshot = rowSnapshots[key] as AccountDirectory | undefined;
        if (snapshot) {
            setCustomAccounts((prev) => prev.map((entry) => (entry.id === entryId ? snapshot : entry)));
        }
        clearRowControl(key);
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
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to update custom account entry:', error);
            alert('계좌 저장 중 오류가 발생했습니다.');
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
            clearRowControl(key);
            await loadData();
        } catch (error) {
            console.error('Failed to delete custom account entry:', error);
            alert('계좌 삭제 중 오류가 발생했습니다.');
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
            await loadData();
        } catch (error) {
            console.error('Failed to add custom account entry:', error);
            alert('계좌 추가 중 오류가 발생했습니다.');
        } finally {
            setSaving(key, false);
        }
    };

    const getImportedCellText = (row: Record<string, unknown>, aliases: string[]) => {
        for (const alias of aliases) {
            const value = row[alias];
            const normalized = normalizeText(value);
            if (normalized) return normalized;
        }
        return '';
    };

    const normalizeImportedCustomCategory = (value: unknown): CustomCategory | null => {
        const normalized = normalizeText(value).toLowerCase();
        if (!normalized) return null;
        if (normalized === 'purchase' || normalized.includes('매입')) return 'purchase';
        if (normalized === 'other' || normalized.includes('기타')) return 'other';
        return null;
    };

    const normalizeImportedCustomStatus = (value: unknown): AccountDirectory['status'] => {
        const normalized = normalizeText(value).toLowerCase();
        if (normalized === 'inactive' || normalized.includes('보관')) return 'inactive';
        return 'active';
    };

    const detectUploadTarget = (
        sheetName: string,
        rows: Record<string, unknown>[],
        fallbackTab: AccountTab
    ): UploadTarget | null => {
        const normalizedSheet = normalizeText(sheetName).toLowerCase();
        const headerKeys = rows.length > 0
            ? Object.keys(rows[0]).map((key) => normalizeText(key).toLowerCase())
            : [];
        const hasHeader = (keyword: string) => headerKeys.some((header) => header.includes(keyword));

        if (normalizedSheet.includes('작업자') || (hasHeader('이름') && hasHeader('팀명'))) return 'workers';
        if (normalizedSheet.includes('팀') && !normalizedSheet.includes('작업자')) return 'teams';
        if (normalizedSheet.includes('회사') || hasHeader('회사명')) return 'companies';
        if (normalizedSheet.includes('매입') || normalizedSheet.includes('기타') || hasHeader('계좌명') || hasHeader('구분코드') || hasHeader('구분명')) {
            return 'custom';
        }

        if (fallbackTab === 'workers' || fallbackTab === 'teams' || fallbackTab === 'companies' || fallbackTab === 'custom') {
            return fallbackTab;
        }
        return null;
    };

    const resolveImportedCustomCategory = (row: Record<string, unknown>, sheetName: string): CustomCategory | null => {
        const explicit =
            normalizeImportedCustomCategory(getImportedCellText(row, ['구분코드', 'category'])) ||
            normalizeImportedCustomCategory(getImportedCellText(row, ['구분명', 'categoryName']));
        if (explicit) return explicit;

        const normalizedSheet = normalizeText(sheetName).toLowerCase();
        if (normalizedSheet.includes('매입')) return 'purchase';
        if (normalizedSheet.includes('기타')) return 'other';
        return null;
    };

    const buildUploadPreviewSection = useCallback((target: UploadTarget, rows: Record<string, unknown>[], sheetName: string): UploadPreviewSection => {
        let updateCount = 0;
        let createCount = 0;
        const previewRows: UploadPreviewRow[] = [];
        const mismatchRows: UploadPreviewRow[] = [];

        if (target === 'workers') {
            rows.forEach((row) => {
                const importedId = getImportedCellText(row, ['id', 'ID', '작업자ID']);
                const importedName = getImportedCellText(row, ['이름', '작업자명']);
                const importedTeamName = getImportedCellText(row, ['팀명']);
                const bankName = getImportedCellText(row, ['은행', 'bankName']);
                const accountNumber = getImportedCellText(row, ['계좌번호', 'accountNumber']);
                const accountHolder = getImportedCellText(row, ['예금주', 'accountHolder']);
                const matched =
                    workers.find((worker) => worker.id === importedId) ||
                    workers.find((worker) => normalizeText(worker.name) === importedName && normalizeText(worker.teamName) === importedTeamName);

                if (matched?.id) {
                    updateCount += 1;
                    previewRows.push({
                        keyText: `${importedName || '(이름없음)'} / ${importedTeamName || '-'}`,
                        bankName,
                        accountNumber,
                        accountHolder,
                        status: 'matched',
                    });
                    return;
                }

                const mismatch: UploadPreviewRow = {
                    keyText: `${importedName || '(이름없음)'} / ${importedTeamName || '-'}`,
                    bankName,
                    accountNumber,
                    accountHolder,
                    status: 'skipped',
                    reason: '대상 작업자 미매칭',
                };
                previewRows.push(mismatch);
                mismatchRows.push(mismatch);
            });
        }

        if (target === 'teams') {
            rows.forEach((row) => {
                const importedId = getImportedCellText(row, ['id', 'ID', '팀ID']);
                const importedName = getImportedCellText(row, ['팀명']);
                const bankName = getImportedCellText(row, ['은행', 'bankName']);
                const accountNumber = getImportedCellText(row, ['계좌번호', 'accountNumber']);
                const accountHolder = getImportedCellText(row, ['예금주', 'accountHolder']);
                const matched =
                    teams.find((team) => team.id === importedId) ||
                    teams.find((team) => normalizeText(team.name) === importedName);

                if (matched?.id) {
                    updateCount += 1;
                    previewRows.push({
                        keyText: importedName || importedId || '(팀식별값없음)',
                        bankName,
                        accountNumber,
                        accountHolder,
                        status: 'matched',
                    });
                    return;
                }

                const mismatch: UploadPreviewRow = {
                    keyText: importedName || importedId || '(팀식별값없음)',
                    bankName,
                    accountNumber,
                    accountHolder,
                    status: 'skipped',
                    reason: '대상 팀 미매칭',
                };
                previewRows.push(mismatch);
                mismatchRows.push(mismatch);
            });
        }

        if (target === 'companies') {
            rows.forEach((row) => {
                const importedId = getImportedCellText(row, ['id', 'ID', '회사ID']);
                const importedName = getImportedCellText(row, ['회사명']);
                const bankName = getImportedCellText(row, ['은행', 'bankName']);
                const accountNumber = getImportedCellText(row, ['계좌번호', 'accountNumber']);
                const accountHolder = getImportedCellText(row, ['예금주', 'accountHolder']);
                const matched =
                    companies.find((company) => company.id === importedId) ||
                    companies.find((company) => normalizeText(company.name) === importedName);

                if (matched?.id) {
                    updateCount += 1;
                    previewRows.push({
                        keyText: importedName || importedId || '(회사식별값없음)',
                        bankName,
                        accountNumber,
                        accountHolder,
                        status: 'matched',
                    });
                    return;
                }

                const mismatch: UploadPreviewRow = {
                    keyText: importedName || importedId || '(회사식별값없음)',
                    bankName,
                    accountNumber,
                    accountHolder,
                    status: 'skipped',
                    reason: '대상 회사 미매칭',
                };
                previewRows.push(mismatch);
                mismatchRows.push(mismatch);
            });
        }

        if (target === 'custom') {
            rows.forEach((row) => {
                const importedId = getImportedCellText(row, ['id', 'ID', '계좌ID']);
                const importedName = getImportedCellText(row, ['계좌명', 'name']);
                const importedCategory = resolveImportedCustomCategory(row, sheetName);
                const bankName = getImportedCellText(row, ['은행', 'bankName']);
                const accountNumber = getImportedCellText(row, ['계좌번호', 'accountNumber']);
                const accountHolder = getImportedCellText(row, ['예금주', 'accountHolder']);

                if (!importedName || !importedCategory) {
                    const mismatch: UploadPreviewRow = {
                        keyText: importedName || importedId || '(계좌명없음)',
                        bankName,
                        accountNumber,
                        accountHolder,
                        status: 'skipped',
                        reason: !importedName ? '계좌명 누락' : '구분(매입/기타) 판별 실패',
                    };
                    previewRows.push(mismatch);
                    mismatchRows.push(mismatch);
                    return;
                }

                const matched =
                    customAccounts.find((entry) => entry.id === importedId) ||
                    customAccounts.find((entry) => entry.category === importedCategory && normalizeText(entry.name) === importedName);

                if (matched?.id) {
                    updateCount += 1;
                    previewRows.push({
                        keyText: `${importedCategory === 'purchase' ? '매입' : '기타'} / ${importedName}`,
                        bankName,
                        accountNumber,
                        accountHolder,
                        status: 'matched',
                    });
                } else {
                    createCount += 1;
                    previewRows.push({
                        keyText: `${importedCategory === 'purchase' ? '매입' : '기타'} / ${importedName}`,
                        bankName,
                        accountNumber,
                        accountHolder,
                        status: 'create',
                        reason: '신규 생성 예정',
                    });
                }
            });
        }

        const label =
            target === 'workers'
                ? '작업자 계좌'
                : target === 'teams'
                    ? '팀 계좌'
                    : target === 'companies'
                        ? '회사 계좌'
                        : '매입/기타 계좌';

        return {
            target,
            label,
            sheetName,
            rows,
            rowCount: rows.length,
            updateCount,
            createCount,
            skippedCount: Math.max(0, rows.length - updateCount - createCount),
            previewRows,
            mismatchRows,
        };
    }, [companies, customAccounts, teams, workers]);

    const clearUploadPreview = () => {
        setUploadPreviewFileName('');
        setUploadPreviewSections([]);
    };

    const handleDownloadSampleWorkbook = () => {
        const workbook = XLSX.utils.book_new();

        const workerSample = XLSX.utils.json_to_sheet([
            {
                id: 'worker-id-sample',
                이름: '홍길동',
                팀명: '샘플팀',
                팀유형: '시공팀',
                회사명: '샘플회사',
                재직상태: '재직',
                급여방식: '월급제',
                은행: '국민은행',
                계좌번호: '12345678901234',
                예금주: '홍길동',
            },
        ]);
        const teamSample = XLSX.utils.json_to_sheet([
            {
                id: 'team-id-sample',
                팀명: '샘플팀',
                팀유형: '시공팀',
                소속사: '샘플회사',
                팀장: '팀장명',
                은행: '국민은행',
                계좌번호: '1111222233334444',
                예금주: '샘플팀',
            },
        ]);
        const companySample = XLSX.utils.json_to_sheet([
            {
                id: 'company-id-sample',
                회사명: '샘플회사',
                회사유형: '협력사',
                대표자: '대표자명',
                사업자번호: '123-45-67890',
                은행: '국민은행',
                계좌번호: '9999888877776666',
                예금주: '샘플회사',
            },
        ]);
        const purchaseSample = XLSX.utils.json_to_sheet([
            {
                id: '',
                구분코드: 'purchase',
                구분명: '매입계좌번호',
                계좌명: '샘플 매입계좌',
                은행: '국민은행',
                계좌번호: '100200300400',
                예금주: '샘플매입',
                메모: '신규면 id 비워도 생성',
                상태: '사용중',
            },
        ]);
        const otherSample = XLSX.utils.json_to_sheet([
            {
                id: '',
                구분코드: 'other',
                구분명: '기타계좌번호',
                계좌명: '샘플 기타계좌',
                은행: '국민은행',
                계좌번호: '500600700800',
                예금주: '샘플기타',
                메모: '신규면 id 비워도 생성',
                상태: '사용중',
            },
        ]);

        XLSX.utils.book_append_sheet(workbook, workerSample, '작업자계좌');
        XLSX.utils.book_append_sheet(workbook, teamSample, '팀계좌');
        XLSX.utils.book_append_sheet(workbook, companySample, '회사계좌');
        XLSX.utils.book_append_sheet(workbook, purchaseSample, '매입계좌');
        XLSX.utils.book_append_sheet(workbook, otherSample, '기타계좌');

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `계좌번호관리_샘플양식_${today}.xlsx`);
    };

    const handleDownloadTemplate = () => {
        if (activeTab === 'overview') return;

        const today = new Date().toISOString().slice(0, 10);
        let rows: Record<string, unknown>[] = [];
        let sheetName = '계좌관리';
        let fileName = '계좌관리';

        if (activeTab === 'workers') {
            rows = visibleWorkerRows.map((worker) => {
                const meta = getWorkerTeamMeta(worker);
                return {
                    id: worker.id || '',
                    이름: worker.name || '',
                    팀명: meta.teamName,
                    팀유형: meta.teamType,
                    회사명: meta.companyName,
                    재직상태: getWorkerEmploymentLabel(worker),
                    급여방식: getWorkerSalaryLabel(worker),
                    은행: worker.bankName || '',
                    계좌번호: worker.accountNumber || '',
                    예금주: worker.accountHolder || '',
                };
            });
            sheetName = '작업자계좌';
            fileName = '작업자계좌_업로드양식';
        } else if (activeTab === 'teams') {
            rows = filteredTeams.map((team) => ({
                id: team.id || '',
                팀명: team.name || '',
                팀유형: team.type || '',
                소속사: team.companyName || '',
                팀장: team.leaderName || '',
                은행: team.bankName || '',
                계좌번호: team.accountNumber || '',
                예금주: team.accountHolder || '',
            }));
            sheetName = '팀계좌';
            fileName = '팀계좌_업로드양식';
        } else if (activeTab === 'companies') {
            rows = filteredCompanies.map((company) => ({
                id: company.id || '',
                회사명: company.name || '',
                회사유형: company.type || '',
                대표자: company.ceoName || '',
                사업자번호: company.businessNumber || '',
                은행: company.bankName || '',
                계좌번호: company.accountNumber || '',
                예금주: company.accountHolder || '',
            }));
            sheetName = '회사계좌';
            fileName = '회사계좌_업로드양식';
        } else if (activeTab === 'custom') {
            rows = filteredCustomAccounts.map((entry) => ({
                id: entry.id || '',
                구분코드: entry.category,
                구분명: CUSTOM_CATEGORY_META[entry.category].title,
                계좌명: entry.name || '',
                은행: entry.bankName || '',
                계좌번호: entry.accountNumber || '',
                예금주: entry.accountHolder || '',
                메모: entry.note || '',
                상태: entry.status === 'inactive' ? '보관' : '사용중',
            }));
            sheetName = '매입기타계좌';
            fileName = '매입기타계좌_업로드양식';
        }

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `${fileName}_${today}.xlsx`);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const nextSections: UploadPreviewSection[] = [];

            workbook.SheetNames.forEach((sheetName) => {
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false });
                if (rows.length === 0) return;

                const target = detectUploadTarget(sheetName, rows, activeTab);
                if (!target) return;

                nextSections.push(buildUploadPreviewSection(target, rows, sheetName));
            });

            if (nextSections.length === 0) {
                alert('인식 가능한 업로드 시트가 없습니다. 샘플(전체) 양식을 사용해 주세요.');
                return;
            }

            setUploadPreviewFileName(file.name);
            setUploadPreviewSections(nextSections);
        } catch (error) {
            console.error('Failed to upload account workbook:', error);
            alert('엑셀 업로드 중 오류가 발생했습니다. 양식과 컬럼명을 확인해주세요.');
        } finally {
            event.target.value = '';
        }
    };

    const handleApplyUploadPreview = async () => {
        if (uploadPreviewSections.length === 0) return;

        setApplyingUpload(true);
        setLoading(true);
        try {
            let workerUpdated = 0;
            let teamUpdated = 0;
            let companyUpdated = 0;
            let customUpdated = 0;
            let customCreated = 0;

            for (const section of uploadPreviewSections) {
                if (section.target === 'workers') {
                    const updates: Array<{ id: string; updates: Partial<Worker> }> = [];

                    section.rows.forEach((row) => {
                        const importedId = getImportedCellText(row, ['id', 'ID', '작업자ID']);
                        const importedName = getImportedCellText(row, ['이름', '작업자명']);
                        const importedTeamName = getImportedCellText(row, ['팀명']);
                        const target =
                            workers.find((worker) => worker.id === importedId) ||
                            workers.find((worker) => normalizeText(worker.name) === importedName && normalizeText(worker.teamName) === importedTeamName);
                        if (!target?.id) return;

                        updates.push({
                            id: target.id,
                            updates: {
                                bankName: toNullableText(getImportedCellText(row, ['은행', 'bankName'])),
                                accountNumber: toNullableText(getImportedCellText(row, ['계좌번호', 'accountNumber'])),
                                accountHolder: toNullableText(getImportedCellText(row, ['예금주', 'accountHolder'])),
                            },
                        });
                    });

                    if (updates.length > 0) {
                        await manpowerService.updateWorkersBatch(updates);
                        workerUpdated += updates.length;
                    }
                    continue;
                }

                if (section.target === 'teams') {
                    for (const row of section.rows) {
                        const importedId = getImportedCellText(row, ['id', 'ID', '팀ID']);
                        const importedName = getImportedCellText(row, ['팀명']);
                        const target = teams.find((team) => team.id === importedId) || teams.find((team) => normalizeText(team.name) === importedName);
                        if (!target?.id) continue;

                        await teamService.updateTeam(target.id, {
                            bankName: toNullableText(getImportedCellText(row, ['은행', 'bankName'])),
                            accountNumber: toNullableText(getImportedCellText(row, ['계좌번호', 'accountNumber'])),
                            accountHolder: toNullableText(getImportedCellText(row, ['예금주', 'accountHolder'])),
                        });
                        teamUpdated += 1;
                    }
                    continue;
                }

                if (section.target === 'companies') {
                    for (const row of section.rows) {
                        const importedId = getImportedCellText(row, ['id', 'ID', '회사ID']);
                        const importedName = getImportedCellText(row, ['회사명']);
                        const target =
                            companies.find((company) => company.id === importedId) ||
                            companies.find((company) => normalizeText(company.name) === importedName);
                        if (!target?.id) continue;

                        await companyService.updateCompany(target.id, {
                            bankName: toNullableText(getImportedCellText(row, ['은행', 'bankName'])),
                            accountNumber: toNullableText(getImportedCellText(row, ['계좌번호', 'accountNumber'])),
                            accountHolder: toNullableText(getImportedCellText(row, ['예금주', 'accountHolder'])),
                        });
                        companyUpdated += 1;
                    }
                    continue;
                }

                if (section.target === 'custom') {
                    const createdCountByCategory: Record<CustomCategory, number> = { purchase: 0, other: 0 };

                    for (const row of section.rows) {
                        const importedId = getImportedCellText(row, ['id', 'ID', '계좌ID']);
                        const importedName = getImportedCellText(row, ['계좌명', 'name']);
                        const importedCategory = resolveImportedCustomCategory(row, section.sheetName);
                        if (!importedName || !importedCategory) continue;

                        const target =
                            customAccounts.find((entry) => entry.id === importedId) ||
                            customAccounts.find((entry) => entry.category === importedCategory && normalizeText(entry.name) === importedName);

                        const payload: Partial<AccountDirectory> = {
                            category: importedCategory,
                            name: importedName,
                            bankName: toNullableText(getImportedCellText(row, ['은행', 'bankName'])),
                            accountNumber: toNullableText(getImportedCellText(row, ['계좌번호', 'accountNumber'])),
                            accountHolder: toNullableText(getImportedCellText(row, ['예금주', 'accountHolder'])),
                            note: toNullableText(getImportedCellText(row, ['메모', 'note'])),
                            status: normalizeImportedCustomStatus(getImportedCellText(row, ['상태', 'status'])),
                        };

                        if (target?.id) {
                            await accountDirectoryService.updateEntry(target.id, payload);
                            customUpdated += 1;
                        } else {
                            await accountDirectoryService.addEntry({
                                category: importedCategory,
                                name: importedName,
                                bankName: payload.bankName,
                                accountNumber: payload.accountNumber,
                                accountHolder: payload.accountHolder,
                                note: payload.note,
                                status: payload.status === 'inactive' ? 'inactive' : 'active',
                                sortOrder:
                                    customAccounts.filter((entry) => entry.category === importedCategory).length +
                                    createdCountByCategory[importedCategory],
                            });
                            createdCountByCategory[importedCategory] += 1;
                            customCreated += 1;
                        }
                    }
                }
            }

            await loadData();
            clearUploadPreview();

            alert(
                [
                    `업로드 반영 완료`,
                    `- 작업자: ${workerUpdated}건`,
                    `- 팀: ${teamUpdated}건`,
                    `- 회사: ${companyUpdated}건`,
                    `- 매입/기타 업데이트: ${customUpdated}건`,
                    `- 매입/기타 신규: ${customCreated}건`,
                ].join('\n')
            );
        } catch (error) {
            console.error('Failed to apply upload preview:', error);
            alert('업로드 반영 중 오류가 발생했습니다.');
        } finally {
            setApplyingUpload(false);
            setLoading(false);
        }
    };

    const renderToolbar = (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3">
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

                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={showHiddenAccounts}
                                onChange={(event) => setShowHiddenAccounts(event.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {'\uC228\uAE40/\uC885\uB8CC \uD3EC\uD568'}
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{hiddenAccountCount}</span>
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

                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-sm font-semibold text-slate-800">계좌 엑셀 업로드 / 다운로드</div>
                        <div className="mt-1 text-xs text-slate-500">
                            현재 탭 양식 다운로드 또는 샘플(전체) 다운로드 후 수정 → 업로드 → 미리보기 확인 후 반영하세요.
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleUploadFile}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={activeTab === 'overview'}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={faDownload} />
                            현재 탭 다운로드
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadSampleWorkbook}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                            <FontAwesomeIcon icon={faDownload} />
                            샘플(전체) 다운로드
                        </button>
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                            <FontAwesomeIcon icon={faUpload} />
                            업로드
                        </button>
                    </div>
                </div>

                {uploadPreviewSections.length > 0 && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                        <div>
                            <div className="text-sm font-semibold text-slate-800">업로드 미리보기</div>
                            <div className="mt-1 text-xs text-slate-600">파일: {uploadPreviewFileName}</div>
                        </div>

                        <div className="mt-3 space-y-2">
                            {uploadPreviewSections.map((section, idx) => (
                                <div key={`${section.sheetName}-${section.target}-${idx}`} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700">
                                    <div className="font-semibold text-slate-800">{section.label} · 시트: {section.sheetName}</div>
                                    <div className="mt-1 text-xs text-slate-600">
                                        전체 {section.rowCount}건 / 업데이트 {section.updateCount}건 / 신규 {section.createCount}건 / 건너뜀 {section.skippedCount}건
                                    </div>

                                    <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-slate-100 text-slate-700">
                                                <tr>
                                                    <th className="px-2 py-1.5 text-left font-semibold">식별값</th>
                                                    <th className="px-2 py-1.5 text-left font-semibold">은행</th>
                                                    <th className="px-2 py-1.5 text-left font-semibold">계좌번호</th>
                                                    <th className="px-2 py-1.5 text-left font-semibold">예금주</th>
                                                    <th className="px-2 py-1.5 text-left font-semibold">상태</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.previewRows.slice(0, 10).map((row, rowIdx) => (
                                                    <tr key={`${section.sheetName}-${row.keyText}-${rowIdx}`} className="border-t border-slate-100">
                                                        <td className="px-2 py-1.5">{row.keyText}</td>
                                                        <td className="px-2 py-1.5">{row.bankName || '-'}</td>
                                                        <td className="px-2 py-1.5 font-mono">{row.accountNumber || '-'}</td>
                                                        <td className="px-2 py-1.5">{row.accountHolder || '-'}</td>
                                                        <td className="px-2 py-1.5">
                                                            {row.status === 'matched' && <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">업데이트</span>}
                                                            {row.status === 'create' && <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">신규</span>}
                                                            {row.status === 'skipped' && <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700">불일치</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {section.previewRows.length > 10 && (
                                        <div className="mt-1 text-[11px] text-slate-500">상세 미리보기는 상위 10행만 표시됩니다.</div>
                                    )}

                                    {section.mismatchRows.length > 0 && (
                                        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
                                            <div className="text-xs font-semibold text-rose-700">불일치 행 목록 ({section.mismatchRows.length}건)</div>
                                            <div className="mt-1 space-y-1 text-xs text-rose-700">
                                                {section.mismatchRows.slice(0, 10).map((row, mismatchIdx) => (
                                                    <div key={`${section.sheetName}-mismatch-${mismatchIdx}`} className="rounded border border-rose-100 bg-white px-2 py-1">
                                                        <span className="font-semibold">{row.keyText}</span>
                                                        <span className="ml-2">{row.reason || '미매칭'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {section.mismatchRows.length > 10 && (
                                                <div className="mt-1 text-[11px] text-rose-600">불일치 목록은 상위 10건만 표시됩니다.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleApplyUploadPreview}
                                disabled={loading || applyingUpload}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FontAwesomeIcon icon={faFloppyDisk} />
                                {applyingUpload ? '반영 중...' : '미리보기 반영'}
                            </button>
                            <button
                                type="button"
                                onClick={clearUploadPreview}
                                disabled={loading || applyingUpload}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderEmptyState = (message: string) => (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
            {message}
        </div>
    );

    const workerEmploymentOptions: Array<{ key: WorkerEmploymentFilter; label: string; count: number }> = [
        { key: 'active', label: '현재 작업자', count: workerStatusCounts.active },
        { key: 'retired', label: '퇴사자', count: workerStatusCounts.retired },
        { key: 'all', label: '전체', count: workerScopedItems.length },
    ];

    const workerSalaryOptions: Array<{ key: WorkerSalaryFilter; label: string; count: number }> = [
        { key: 'all', label: '전체 급여형태', count: workerScopedItems.length },
        { key: 'daily', label: DAILY_WAGE_LABEL, count: workerSalaryCounts.daily },
        { key: 'monthly', label: MONTHLY_WAGE_LABEL, count: workerSalaryCounts.monthly },
        { key: 'other', label: OTHER_WAGE_LABEL, count: workerSalaryCounts.other },
    ];

    const getWorkerFilterButtonClass = (active: boolean) =>
        `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
            active
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`;

    const workerSheetInputClass =
        'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
    const workerSheetNumberInputClass = `${workerSheetInputClass} font-semibold tracking-[0.08em]`;
    const workerDigitsStyle: React.CSSProperties = {
        fontVariantNumeric: 'tabular-nums slashed-zero',
        fontFeatureSettings: '"tnum" 1, "zero" 1',
    };
    const rowActionButtonClass = 'inline-flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
    const rowActionPrimaryClass = `${rowActionButtonClass} border-slate-900 bg-slate-900 text-white hover:bg-slate-800`;
    const rowActionSecondaryClass = `${rowActionButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
    const rowActionDangerClass = `${rowActionButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`;

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
                                    value={`${visibleCheongyeonWorkersForStats.length - workerMissingCount}/${visibleCheongyeonWorkersForStats.length}`}
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
                                    value={`${visibleTeamsForStats.length - teamMissingCount}/${visibleTeamsForStats.length}`}
                                    description={`시공팀/지원팀/용역팀 중 미등록 ${teamMissingCount}팀`}
                                    icon={faUsers}
                                    toneClass="border-amber-200 bg-amber-50 text-amber-600"
                                    onClick={() => setActiveTab('teams')}
                                />
                                <SummaryCard
                                    title="회사 계좌 등록"
                                    value={`${visibleCompaniesForStats.length - companyMissingCount}/${visibleCompaniesForStats.length}`}
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
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">청연 소속 팀 작업자 계좌만 표시합니다.</div>
                                            <div className="mt-1 text-sm text-slate-500">
                                                청연 소속 전체 {visibleCheongyeonWorkersForStats.length}명 중 현재 {visibleWorkerCount}명을 보고 있습니다.
                                                기본값은 현재 작업자만 표시하며, 퇴사자는 필요할 때만 열어볼 수 있습니다.
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

                                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)]">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                                            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                                재직 상태
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {workerEmploymentOptions.map((option) => (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        onClick={() => setWorkerEmploymentFilter(option.key)}
                                                        className={getWorkerFilterButtonClass(workerEmploymentFilter === option.key)}
                                                    >
                                                        <span>{option.label}</span>
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${workerEmploymentFilter === option.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            {option.count}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                                            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                                급여 방식
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {workerSalaryOptions.map((option) => (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        onClick={() => setWorkerSalaryFilter(option.key)}
                                                        className={getWorkerFilterButtonClass(workerSalaryFilter === option.key)}
                                                    >
                                                        <span>{option.label}</span>
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${workerSalaryFilter === option.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            {option.count}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {workerTeamOptions.length === 0 && renderEmptyState('청연 소속 팀 작업자 데이터가 없습니다.')}
                            {workerTeamOptions.length > 0 && workerSections.length === 0 && renderEmptyState('선택한 조건에 맞는 청연 소속 작업자 계좌 데이터가 없습니다.')}

                            {workerSections.map((section) => (
                                <div key={section.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-slate-100 px-5 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${section.accentClass}`}>
                                                    <FontAwesomeIcon icon={section.icon} />
                                                </span>
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                                                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                                    인원 <span className="ml-2 text-base font-bold text-slate-900">{section.workerCount}</span>
                                                </div>
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                                                    계좌 미입력 <span className="ml-2 text-base font-bold">{section.missingCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {section.groups.length === 0 ? (
                                        renderEmptyState(`${section.title} 작업자 데이터가 없습니다.`)
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full table-fixed border-collapse text-[15px] leading-6 text-slate-700">
                                                <thead className="sticky top-0 z-10 bg-slate-800 text-xs font-bold uppercase tracking-[0.12em] text-slate-100">
                                                    <tr>
                                                        <th className="w-[220px] border-b border-slate-700 px-4 py-3 text-left">소속</th>
                                                        <th className="w-[160px] border-b border-slate-700 px-4 py-3 text-left">작업자</th>
                                                        <th className="w-[170px] border-b border-slate-700 px-4 py-3 text-left">직책 / 상태</th>
                                                        <th className="w-[140px] border-b border-slate-700 px-4 py-3 text-left">은행</th>
                                                        <th className="w-[240px] border-b border-slate-700 px-4 py-3 text-left">계좌번호</th>
                                                        <th className="w-[150px] border-b border-slate-700 px-4 py-3 text-left">예금주</th>
                                                        <th className="w-[228px] border-b border-slate-700 px-4 py-3 text-left">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {section.groups.map((group) =>
                                                        group.items.map((worker) => {
                                                            const rowKey = `worker:${worker.id}`;
                                                            const savingKey = rowKey;
                                                            const isEditing = true;
                                                            const accountMissing = !hasAccountNumber(worker.accountNumber);
                                                            const accountKey = getWorkerAccountKey(worker);
                                                            const isManuallyHidden = isAccountKeyHidden(accountKey);
                                                            const isRetiredWorker = getWorkerEmploymentStatus(worker) === 'retired';
                                                            const isHiddenRow = isWorkerHiddenByAccountScope(worker);
                                                            const rowClassName = isHiddenRow ? 'bg-slate-50 text-slate-500' : accountMissing ? 'bg-amber-50/50' : 'bg-white';

                                                            return (
                                                                <tr
                                                                    key={worker.id || `${section.key}-${group.key}-${worker.name}`}
                                                                    className={rowClassName}
                                                                >
                                                                    <td className="px-4 py-3 align-top">
                                                                        <div className="font-semibold text-slate-900">{group.teamName}</div>
                                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${getTeamTypeBadgeClass(group.teamType)}`}>
                                                                                {group.teamType}
                                                                            </span>
                                                                            <span className="text-slate-500">{group.companyName || '소속 회사 없음'}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        <div className="font-semibold text-slate-900">{worker.name}</div>
                                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                            <span>{worker.contact || '연락처 없음'}</span>
                                                                            {isManuallyHidden && (
                                                                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                                                                    {'\uC228\uAE40'}
                                                                                </span>
                                                                            )}
                                                                            {isRetiredWorker && (
                                                                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                                                                                    {'\uD1F4\uC0AC'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        <div className="text-sm font-medium text-slate-700">{worker.role || '직책 미입력'}</div>
                                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getWorkerEmploymentBadgeClass(worker)}`}>
                                                                                {getWorkerEmploymentLabel(worker)}
                                                                            </span>
                                                                            {accountMissing && (
                                                                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                                                                    계좌 미입력
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        {isEditing ? (
                                                                            <input
                                                                                value={worker.bankName || ''}
                                                                                onChange={(event) => updateWorkerField(worker.id || '', 'bankName', event.target.value)}
                                                                                placeholder="은행명"
                                                                                className={workerSheetInputClass}
                                                                            />
                                                                        ) : (
                                                                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                                                                                {worker.bankName || '-'}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        {isEditing ? (
                                                                            <input
                                                                                value={worker.accountNumber || ''}
                                                                                onChange={(event) => updateWorkerField(worker.id || '', 'accountNumber', event.target.value)}
                                                                                placeholder="계좌번호"
                                                                                className={workerSheetNumberInputClass}
                                                                                style={workerDigitsStyle}
                                                                            />
                                                                        ) : (
                                                                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700" style={workerDigitsStyle}>
                                                                                {worker.accountNumber || '-'}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        {isEditing ? (
                                                                            <input
                                                                                value={worker.accountHolder || ''}
                                                                                onChange={(event) => updateWorkerField(worker.id || '', 'accountHolder', event.target.value)}
                                                                                placeholder="예금주"
                                                                                className={workerSheetInputClass}
                                                                            />
                                                                        ) : (
                                                                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                                                                                {worker.accountHolder || '-'}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        <div className="flex flex-wrap gap-2">
                                                                            <button
                                                                                type="button"
                                                                                disabled={!worker.id || !!savingKeys[savingKey]}
                                                                                onClick={() => worker.id && saveWorkerAccount(worker.id)}
                                                                                className={rowActionPrimaryClass}
                                                                            >
                                                                                <FontAwesomeIcon icon={faFloppyDisk} />
                                                                                {savingKeys[savingKey] ? '저장중' : '저장'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={!worker.id || !!savingKeys[savingKey]}
                                                                                onClick={() => worker.id && clearWorkerAccount(worker.id)}
                                                                                className={rowActionDangerClass}
                                                                            >
                                                                                <FontAwesomeIcon icon={faTrash} />
                                                                                삭제
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={!worker.id}
                                                                                onClick={() => (isManuallyHidden ? showAccountKey(accountKey) : hideAccountKey(accountKey))}
                                                                                className={rowActionSecondaryClass}
                                                                            >
                                                                                <FontAwesomeIcon icon={isManuallyHidden ? faEye : faEyeSlash} />
                                                                                {isManuallyHidden ? '\uD45C\uC2DC' : '\uC228\uAE30\uAE30'}
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
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
                                                        <th className="px-4 py-3 text-left">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map((team) => {
                                                        const rowKey = `team:${team.id}`;
                                                        const savingKey = rowKey;
                                                        const isEditing = true;
                                                        const accountKey = getTeamAccountKey(team);
                                                        const isManuallyHidden = isAccountKeyHidden(accountKey);
                                                        const isEndedStatus = isEndedAccountStatus(team.status);
                                                        const isHiddenRow = isManuallyHidden || isEndedStatus;
                                                        return (
                                                            <tr key={team.id} className={`align-top ${isHiddenRow ? 'bg-slate-50 text-slate-500' : ''}`}>
                                                                <td className="px-4 py-3">
                                                                    <div className="font-semibold text-slate-900">{team.name}</div>
                                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                        <span>{team.memberCount || 0}명</span>
                                                                        {isManuallyHidden && (
                                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                                                                {'\uC228\uAE40'}
                                                                            </span>
                                                                        )}
                                                                        {isEndedStatus && (
                                                                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                                                                                {'\uC885\uB8CC'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">{team.companyName || '미지정'}</td>
                                                                <td className="px-4 py-3">{team.leaderName || '미지정'}</td>
                                                                <td className="px-4 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            value={team.bankName || ''}
                                                                            onChange={(event) => updateTeamField(team.id || '', 'bankName', event.target.value)}
                                                                            className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                        />
                                                                    ) : (
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{team.bankName || '-'}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            value={team.accountNumber || ''}
                                                                            onChange={(event) => updateTeamField(team.id || '', 'accountNumber', event.target.value)}
                                                                            className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                            style={workerDigitsStyle}
                                                                        />
                                                                    ) : (
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold" style={workerDigitsStyle}>
                                                                            {team.accountNumber || '-'}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            value={team.accountHolder || ''}
                                                                            onChange={(event) => updateTeamField(team.id || '', 'accountHolder', event.target.value)}
                                                                            className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                        />
                                                                    ) : (
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{team.accountHolder || '-'}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <button
                                                                            type="button"
                                                                            disabled={!team.id || !!savingKeys[savingKey]}
                                                                            onClick={() => team.id && saveTeamAccount(team.id)}
                                                                            className={rowActionPrimaryClass}
                                                                        >
                                                                            <FontAwesomeIcon icon={faFloppyDisk} />
                                                                            {savingKeys[savingKey] ? '저장중' : '저장'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!team.id || !!savingKeys[savingKey]}
                                                                            onClick={() => team.id && clearTeamAccount(team.id)}
                                                                            className={rowActionDangerClass}
                                                                        >
                                                                            <FontAwesomeIcon icon={faTrash} />
                                                                            삭제
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!team.id}
                                                                            onClick={() => (isManuallyHidden ? showAccountKey(accountKey) : hideAccountKey(accountKey))}
                                                                            className={rowActionSecondaryClass}
                                                                        >
                                                                            <FontAwesomeIcon icon={isManuallyHidden ? faEye : faEyeSlash} />
                                                                            {isManuallyHidden ? '\uD45C\uC2DC' : '\uC228\uAE30\uAE30'}
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
                                                        <th className="px-4 py-3 text-left">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map((company) => {
                                                        const rowKey = `company:${company.id}`;
                                                        const savingKey = rowKey;
                                                        const isEditing = true;
                                                        const accountKey = getCompanyAccountKey(company);
                                                        const isManuallyHidden = isAccountKeyHidden(accountKey);
                                                        const isEndedStatus = isEndedAccountStatus(company.status);
                                                        const isHiddenRow = isManuallyHidden || isEndedStatus;
                                                        return (
                                                            <tr key={company.id} className={`align-top ${isHiddenRow ? 'bg-slate-50 text-slate-500' : ''}`}>
                                                                <td className="px-4 py-3">
                                                                    <div className="font-semibold text-slate-900">{company.name}</div>
                                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                        <span>{company.phone || '연락처 없음'}</span>
                                                                        {isManuallyHidden && (
                                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                                                                {'\uC228\uAE40'}
                                                                            </span>
                                                                        )}
                                                                        {isEndedStatus && (
                                                                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                                                                                {'\uC885\uB8CC'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">{company.ceoName || '미지정'}</td>
                                                                <td className="px-4 py-3">{company.businessNumber || '미지정'}</td>
                                                                <td className="px-4 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            value={company.bankName || ''}
                                                                            onChange={(event) => updateCompanyField(company.id || '', 'bankName', event.target.value)}
                                                                            className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                        />
                                                                    ) : (
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{company.bankName || '-'}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            value={company.accountNumber || ''}
                                                                            onChange={(event) => updateCompanyField(company.id || '', 'accountNumber', event.target.value)}
                                                                            className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                            style={workerDigitsStyle}
                                                                        />
                                                                    ) : (
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold" style={workerDigitsStyle}>
                                                                            {company.accountNumber || '-'}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            value={company.accountHolder || ''}
                                                                            onChange={(event) => updateCompanyField(company.id || '', 'accountHolder', event.target.value)}
                                                                            className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                                        />
                                                                    ) : (
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{company.accountHolder || '-'}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <button
                                                                            type="button"
                                                                            disabled={!company.id || !!savingKeys[savingKey]}
                                                                            onClick={() => company.id && saveCompanyAccount(company.id)}
                                                                            className={rowActionPrimaryClass}
                                                                        >
                                                                            <FontAwesomeIcon icon={faFloppyDisk} />
                                                                            {savingKeys[savingKey] ? '저장중' : '저장'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!company.id || !!savingKeys[savingKey]}
                                                                            onClick={() => company.id && clearCompanyAccount(company.id)}
                                                                            className={rowActionDangerClass}
                                                                        >
                                                                            <FontAwesomeIcon icon={faTrash} />
                                                                            삭제
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!company.id}
                                                                            onClick={() => (isManuallyHidden ? showAccountKey(accountKey) : hideAccountKey(accountKey))}
                                                                            className={rowActionSecondaryClass}
                                                                        >
                                                                            <FontAwesomeIcon icon={isManuallyHidden ? faEye : faEyeSlash} />
                                                                            {isManuallyHidden ? '\uD45C\uC2DC' : '\uC228\uAE30\uAE30'}
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
                                                                    const rowKey = `custom:${entry.id}`;
                                                                    const rowSavingKey = rowKey;
                                                                    const isEditing = !!editingKeys[rowKey];
                                                                    const accountKey = getCustomAccountKey(entry);
                                                                    const isManuallyHidden = isAccountKeyHidden(accountKey);
                                                                    const isEndedStatus = isEndedAccountStatus(entry.status);
                                                                    const isHiddenRow = isManuallyHidden || isEndedStatus;
                                                                    return (
                                                                        <tr key={entry.id} className={`align-top ${isHiddenRow ? 'bg-slate-50 text-slate-500' : ''}`}>
                                                                            <td className="px-4 py-3">
                                                                                {isEditing ? (
                                                                                    <input value={entry.name || ''} onChange={(event) => updateCustomField(entry.id || '', 'name', event.target.value)} className="w-48 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                                                ) : (
                                                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                                                                                        <div>{entry.name || '-'}</div>
                                                                                        {isManuallyHidden && (
                                                                                            <div className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                                                                {'\uC228\uAE40'}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {isEditing ? (
                                                                                    <input value={entry.bankName || ''} onChange={(event) => updateCustomField(entry.id || '', 'bankName', event.target.value)} className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                                                ) : (
                                                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{entry.bankName || '-'}</div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {isEditing ? (
                                                                                    <input value={entry.accountNumber || ''} onChange={(event) => updateCustomField(entry.id || '', 'accountNumber', event.target.value)} className="w-52 rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" style={workerDigitsStyle} />
                                                                                ) : (
                                                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold" style={workerDigitsStyle}>{entry.accountNumber || '-'}</div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {isEditing ? (
                                                                                    <input value={entry.accountHolder || ''} onChange={(event) => updateCustomField(entry.id || '', 'accountHolder', event.target.value)} className="w-40 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                                                ) : (
                                                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{entry.accountHolder || '-'}</div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {isEditing ? (
                                                                                    <input value={entry.note || ''} onChange={(event) => updateCustomField(entry.id || '', 'note', event.target.value)} className="w-48 rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                                                                ) : (
                                                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{entry.note || '-'}</div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {isEditing ? (
                                                                                    <select value={entry.status || 'active'} onChange={(event) => updateCustomField(entry.id || '', 'status', event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                                                                                        <option value="active">사용중</option>
                                                                                        <option value="inactive">보관</option>
                                                                                    </select>
                                                                                ) : (
                                                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${entry.status === 'inactive' ? 'border border-amber-200 bg-amber-50 text-amber-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                                                                        {entry.status === 'inactive' ? '보관' : '사용중'}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={!entry.id || !!savingKeys[rowSavingKey]}
                                                                                        onClick={() => {
                                                                                            if (!entry.id) return;
                                                                                            if (isEditing) cancelCustomEdit(entry.id);
                                                                                            else beginRowEdit(rowKey, { ...entry });
                                                                                        }}
                                                                                        className={rowActionSecondaryClass}
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faPenToSquare} />
                                                                                        {isEditing ? '취소' : '수정'}
                                                                                    </button>
                                                                                    <button type="button" disabled={!entry.id || !isEditing || !!savingKeys[rowSavingKey]} onClick={() => entry.id && saveCustomEntry(entry.id)} className={rowActionPrimaryClass}>
                                                                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                                                                        {savingKeys[rowSavingKey] ? '저장중' : '저장'}
                                                                                    </button>
                                                                                    <button type="button" disabled={!entry.id || !!savingKeys[rowSavingKey]} onClick={() => entry.id && deleteCustomEntry(entry.id)} className={rowActionDangerClass}>
                                                                                        <FontAwesomeIcon icon={faTrash} />
                                                                                        삭제
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={!entry.id}
                                                                                        onClick={() => (isManuallyHidden ? showAccountKey(accountKey) : hideAccountKey(accountKey))}
                                                                                        className={rowActionSecondaryClass}
                                                                                    >
                                                                                        <FontAwesomeIcon icon={isManuallyHidden ? faEye : faEyeSlash} />
                                                                                        {isManuallyHidden ? '\uD45C\uC2DC' : '\uC228\uAE30\uAE30'}
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
