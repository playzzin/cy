import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFloppyDisk, faXmark, faUserTag } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { toast } from '../../utils/swal';
import { manpowerService } from '../../services/manpowerService';
import type { Worker } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import type { Team } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import type { Company } from '../../services/companyService';

interface BottomPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'bottom') => void;
    currentSite?: string;
    changeSite?: (site: string) => void;
}

type QuickRegisterSection = 'worker' | 'team' | 'site' | 'partnerCompany' | 'constructionCompany';

type WorkerTeamType = '시공팀' | '지원팀';
type QuickTeamRegisterType = '시공팀' | '지원팀';
type TeamType = '본팀' | '관리팀' | '새끼팀' | '직영팀' | '시공팀' | '지원팀' | '용역팀';
type WorkerSalaryModel = '일급제' | '월급제' | '지원팀';

interface WorkerFormState {
    name: string;
    idNumber: string;
    teamType: WorkerTeamType;
    companyId: string;
    supportTeamId: string;
    unitPrice: string;
    salaryModel: WorkerSalaryModel;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    role: string;
}

interface TeamFormState {
    name: string;
    type: QuickTeamRegisterType;
    leaderWorkerId: string;
    companyId: string;
    selectedWorkerIds: string[];
}

interface SiteFormState {
    name: string;
    startDate: string;
    endDate: string;
    companyId: string;
    responsibleTeamId: string;
}

interface CompanyFormState {
    name: string;
    businessNumber: string;
    ceoName: string;
    phone: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
}

interface PartnerCompanyTeamFormState {
    teamName: string;
}

const toYyyyMmDd = (date: Date): string => {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const generateCode = (prefix: string): string => {
    const seed = Date.now().toString(36).toUpperCase();
    return `${prefix}-${seed.slice(-6)}`;
};

const stripTrailingAbbreviation = (value: string): string => {
    const withoutTrailing = value.replace(/\s*\([A-Z]{1,10}\)\s*$/, '');
    const withoutLeading = withoutTrailing.replace(/^\s*\([A-Z]{1,10}\)\s*/, '');
    return withoutLeading.trim();
};

const extractPartnerCompanyBaseName = (displayName: string, ceoNameToStrip: string): string => {
    const withoutAbbreviation = stripTrailingAbbreviation(displayName);
    const trimmed = withoutAbbreviation.trim();
    const ceo = ceoNameToStrip.trim();

    if (ceo.length === 0) return trimmed;
    if (trimmed === ceo) return '';
    if (!trimmed.startsWith(`${ceo} `)) return trimmed;

    return trimmed.slice(ceo.length + 1).trim();
};

const getInitialConsonant = (char: string): string | null => {
    const code = char.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return null;
    const syllableIndex = code - 0xac00;
    const initialIndex = Math.floor(syllableIndex / 588);
    const initials = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
        'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];
    return initials[initialIndex] ?? null;
};

const initialToRoman = (initial: string): string => {
    switch (initial) {
        case 'ㄱ':
            return 'G';
        case 'ㄲ':
            return 'KK';
        case 'ㄴ':
            return 'N';
        case 'ㄷ':
            return 'D';
        case 'ㄸ':
            return 'TT';
        case 'ㄹ':
            return 'R';
        case 'ㅁ':
            return 'M';
        case 'ㅂ':
            return 'B';
        case 'ㅃ':
            return 'PP';
        case 'ㅅ':
            return 'S';
        case 'ㅆ':
            return 'SS';
        case 'ㅇ':
            return 'NG';
        case 'ㅈ':
            return 'J';
        case 'ㅉ':
            return 'JJ';
        case 'ㅊ':
            return 'CH';
        case 'ㅋ':
            return 'K';
        case 'ㅌ':
            return 'T';
        case 'ㅍ':
            return 'P';
        case 'ㅎ':
            return 'H';
        default:
            return '';
    }
};

const buildCeoAbbreviation = (ceoName: string): string => {
    const trimmed = ceoName.trim();
    if (trimmed.length === 0) return '';

    const hasLatin = /[A-Za-z]/.test(trimmed);
    if (hasLatin) {
        const letters = trimmed
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part[0] ?? '')
            .join('')
            .replace(/[^A-Za-z]/g, '')
            .toUpperCase();
        return letters.slice(0, 6);
    }

    const pieces = Array.from(trimmed)
        .map(char => {
            const initial = getInitialConsonant(char);
            if (!initial) return '';
            return initialToRoman(initial);
        })
        .join('')
        .replace(/[^A-Z]/g, '')
        .toUpperCase();

    return pieces.slice(0, 6);
};

const buildPartnerCompanyDisplayName = (currentName: string, ceoName: string): string => {
    const abbr = buildCeoAbbreviation(ceoName);
    const baseName = extractPartnerCompanyBaseName(currentName, ceoName);
    const trimmedCeoName = ceoName.trim();

    if (abbr.length === 0) {
        if (trimmedCeoName.length === 0) return baseName;
        if (baseName.length === 0) return trimmedCeoName;
        return `${trimmedCeoName} ${baseName}`;
    }

    if (trimmedCeoName.length === 0) {
        if (baseName.length === 0) return `(${abbr})`;
        return `(${abbr}) ${baseName}`;
    }

    if (baseName.length === 0) return `(${abbr}) ${trimmedCeoName}`;
    return `(${abbr}) ${trimmedCeoName} ${baseName}`;
};

const TopRowButton = React.memo(
    ({
        section,
        label,
        isSelected,
        onSelect
    }: {
        section: QuickRegisterSection;
        label: string;
        isSelected: boolean;
        onSelect: (section: QuickRegisterSection) => void;
    }) => {
        return (
            <button
                type="button"
                onClick={() => onSelect(section)}
                className="w-full px-3 py-2 rounded-md text-sm font-bold"
                style={{
                    background: isSelected ? 'rgba(59,130,246,0.95)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff'
                }}
            >
                {label}
            </button>
        );
    }
);

const Input = React.memo(
    ({
        label,
        value,
        onChange,
        type = 'text',
        placeholder,
        onBlur
    }: {
        label: string;
        value: string;
        onChange: (value: string) => void;
        type?: 'text' | 'number' | 'date';
        placeholder?: string;
        onBlur?: () => void;
    }) => {
        return (
            <label className="block" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <div className="text-xs font-bold" style={{ marginBottom: '6px' }}>{label}</div>
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    className="w-full rounded-md px-3 py-2"
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff',
                        outline: 'none'
                    }}
                />
            </label>
        );
    }
);

const Select = React.memo(
    ({
        label,
        value,
        onChange,
        options,
        disabled = false
    }: {
        label: string;
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        disabled?: boolean;
    }) => {
        return (
            <label className="block" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <div className="text-xs font-bold" style={{ marginBottom: '6px' }}>{label}</div>
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full rounded-md px-3 py-2"
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: disabled ? 'rgba(255,255,255,0.55)' : '#fff',
                        outline: 'none'
                    }}
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value} style={{ color: '#000' }}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </label>
        );
    }
);

const BottomPanel: React.FC<BottomPanelProps> = ({
    isOpen,
    togglePanel,
    currentSite,
    changeSite
}) => {
    const masterDataChangedEventName = 'smart-construction:master-data-changed';

    const emitMasterDataChanged = useCallback(
        (detail: { workers?: boolean; teams?: boolean; sites?: boolean; companies?: boolean }) => {
            window.dispatchEvent(new CustomEvent(masterDataChangedEventName, { detail }));
        },
        []
    );

    const [selectedSection, setSelectedSection] = useState<QuickRegisterSection>('worker');
    const [isSaving, setIsSaving] = useState(false);

    const today = useMemo(() => toYyyyMmDd(new Date()), []);

    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isWorkersLoading, setIsWorkersLoading] = useState(false);

    const cheongyeonCompanyId = useMemo(() => {
        const found = companies.find(c => c.name.includes('청연'));
        return found?.id ?? '';
    }, [companies]);

    const cheongyeonCompanyName = useMemo(() => {
        const found = companies.find(c => c.id === cheongyeonCompanyId);
        return found?.name ?? '청연';
    }, [cheongyeonCompanyId, companies]);

    const partnerCompanyIdSet = useMemo(() => {
        return new Set(
            companies
                .filter(c => c.type === '협력사')
                .map(c => c.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
        );
    }, [companies]);

    const partnerCompanyOptions = useMemo(() => {
        return companies
            .filter(c => c.type === '협력사')
            .map(c => ({ value: c.id ?? '', label: c.name }))
            .filter(opt => opt.value.length > 0)
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [companies]);

    const [workerForm, setWorkerForm] = useState<WorkerFormState>({
        name: '',
        idNumber: '',
        teamType: '시공팀',
        companyId: '',
        supportTeamId: '',
        unitPrice: '0',
        salaryModel: '일급제',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        role: '신규'
    });

    const [teamForm, setTeamForm] = useState<TeamFormState>({
        name: '',
        type: '시공팀',
        leaderWorkerId: '',
        companyId: '',
        selectedWorkerIds: []
    });

    const [isTeamNameTouched, setIsTeamNameTouched] = useState(false);

    const [siteForm, setSiteForm] = useState<SiteFormState>({
        name: '',
        startDate: today,
        endDate: today,
        companyId: '',
        responsibleTeamId: ''
    });

    const [partnerCompanyForm, setPartnerCompanyForm] = useState<CompanyFormState>({
        name: '',
        businessNumber: '',
        ceoName: '',
        phone: '',
        bankName: '',
        accountNumber: '',
        accountHolder: ''
    });

    const [partnerCompanyTeamForm, setPartnerCompanyTeamForm] = useState<PartnerCompanyTeamFormState>({
        teamName: ''
    });

    const [isPartnerCompanyTeamNameTouched, setIsPartnerCompanyTeamNameTouched] = useState(false);

    const [constructionCompanyForm, setConstructionCompanyForm] = useState<CompanyFormState>({
        name: '',
        businessNumber: '',
        ceoName: '',
        phone: '',
        bankName: '',
        accountNumber: '',
        accountHolder: ''
    });

    useEffect(() => {
        const loadMasterData = async () => {
            try {
                const [companiesData, teamsData] = await Promise.all([
                    companyService.getCompanies(),
                    teamService.getTeams()
                ]);
                setCompanies(companiesData);
                setTeams(teamsData);
            } catch (error) {
                console.error(error);
            }
        };

        loadMasterData();
    }, []);

    useEffect(() => {
        if (selectedSection !== 'team') return;
        if (workers.length > 0) return;

        let cancelled = false;

        const loadWorkers = async () => {
            setIsWorkersLoading(true);
            try {
                const workersData = await manpowerService.getWorkers();
                if (cancelled) return;
                setWorkers(workersData);
            } catch (error) {
                console.error(error);
            } finally {
                if (cancelled) return;
                setIsWorkersLoading(false);
            }
        };

        loadWorkers();

        return () => {
            cancelled = true;
        };
    }, [selectedSection, workers.length]);

    useEffect(() => {
        if (workerForm.teamType !== '시공팀') return;
        if (!cheongyeonCompanyId) return;
        if (workerForm.companyId === cheongyeonCompanyId) return;
        setWorkerForm(prev => ({ ...prev, companyId: cheongyeonCompanyId }));
    }, [cheongyeonCompanyId, workerForm.companyId, workerForm.teamType]);

    useEffect(() => {
        if (teamForm.type !== '시공팀') return;
        if (!cheongyeonCompanyId) return;
        if (teamForm.companyId === cheongyeonCompanyId) return;
        setTeamForm(prev => ({
            ...prev,
            companyId: cheongyeonCompanyId,
            selectedWorkerIds: [],
            leaderWorkerId: ''
        }));
    }, [cheongyeonCompanyId, teamForm.companyId, teamForm.type]);

    const workerSchema = useMemo(() => {
        return z
            .object({
                name: z.string().trim().min(1, '작업자 이름을 입력해주세요.'),
                idNumber: z.string().trim().min(1, '작업자 식별번호(주민/생년)를 입력해주세요.'),
                teamType: z
                    .string()
                    .refine((value): value is WorkerTeamType => value === '시공팀' || value === '지원팀', {
                        message: '팀구분을 선택해주세요.'
                    }),
                companyId: z.string(),
                supportTeamId: z.string(),
                unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다.'),
                salaryModel: z
                    .string()
                    .refine(
                        (value): value is WorkerSalaryModel =>
                            value === '일급제' || value === '월급제' || value === '지원팀',
                        {
                            message: '급여방식을 선택해주세요.'
                        }
                    ),
                bankName: z.string().optional(),
                accountNumber: z.string().optional(),
                accountHolder: z.string().optional(),
                role: z.string().trim().min(1, '직책을 입력해주세요.')
            })
            .superRefine((value, ctx) => {
                if (value.teamType === '시공팀' && value.companyId.trim().length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '시공팀은 회사를 선택해주세요.'
                    });
                }
                if (value.teamType === '시공팀' && cheongyeonCompanyId.trim().length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '시공팀 등록은 청연 회사가 필요합니다. 회사 데이터를 확인해주세요.'
                    });
                }
                if (
                    value.teamType === '시공팀' &&
                    cheongyeonCompanyId.trim().length > 0 &&
                    value.companyId !== cheongyeonCompanyId
                ) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '시공팀은 회사가 청연으로 고정입니다.'
                    });
                }
                if (value.teamType === '지원팀' && value.companyId.trim().length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '지원팀은 협력사 회사를 선택해주세요.'
                    });
                }
                if (value.teamType === '지원팀' && value.supportTeamId.trim().length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '지원팀은 협력사 팀을 선택해주세요.'
                    });
                }
                if (value.teamType === '지원팀' && value.salaryModel !== '지원팀') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '지원팀은 급여방식이 지원팀으로 고정입니다.'
                    });
                }
                if (value.teamType === '시공팀' && !['일급제', '월급제'].includes(value.salaryModel)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '시공팀은 급여방식이 일급제/월급제만 가능합니다.'
                    });
                }
            });
    }, [cheongyeonCompanyId, partnerCompanyIdSet]);

    const handleWorkerTeamTypeChange = (nextTeamType: '시공팀' | '지원팀') => {
        setWorkerForm(prev => {
            if (nextTeamType === '지원팀') {
                return {
                    ...prev,
                    teamType: nextTeamType,
                    salaryModel: '지원팀',
                    companyId: '',
                    supportTeamId: '',
                    bankName: '',
                    accountHolder: '',
                    role: '신규'
                };
            }

            const nextSalaryModel: WorkerSalaryModel = prev.salaryModel === '지원팀' ? '일급제' : prev.salaryModel;
            return {
                ...prev,
                teamType: nextTeamType,
                salaryModel: nextSalaryModel === '월급제' ? '월급제' : '일급제',
                companyId: cheongyeonCompanyId,
                supportTeamId: '',
                bankName: '',
                accountNumber: '',
                role: '신규'
            };
        });
    };

    const supportTeamOptionsByCompany = useMemo(() => {
        if (!workerForm.companyId) return [];
        if (!partnerCompanyIdSet.has(workerForm.companyId)) return [];

        return teams
            .filter(t => (t.companyId ? t.companyId === workerForm.companyId : false))
            .map(t => ({
                value: t.id ?? '',
                label: `${t.name}${t.companyName ? ` (${t.companyName})` : ''}`
            }))
            .filter(opt => opt.value.length > 0);
    }, [partnerCompanyIdSet, teams, workerForm.companyId]);

    const constructionCompanyOptions = useMemo(() => {
        if (!cheongyeonCompanyId) {
            return [{ value: '', label: '청연(없음)' }];
        }

        return [{ value: cheongyeonCompanyId, label: cheongyeonCompanyName }];
    }, [cheongyeonCompanyId, cheongyeonCompanyName]);

    const constructionTeamOptions = useMemo(() => {
        return teams
            .filter(t => t.type === '시공팀')
            .map(t => ({ value: t.id ?? '', label: t.name }))
            .filter(opt => opt.value.length > 0)
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [teams]);

    const teamSchema = useMemo(() => {
        return z
            .object({
                name: z.string().trim().min(1, '팀명을 입력해주세요.'),
                type: z.string().refine((value): value is QuickTeamRegisterType => value === '시공팀' || value === '지원팀', {
                    message: '팀구분은 시공팀/지원팀만 가능합니다.'
                }),
                leaderWorkerId: z.string().trim().optional(),
                companyId: z.string(),
                selectedWorkerIds: z.array(z.string())
            })
            .superRefine((value, ctx) => {
                if (value.type === '시공팀' && cheongyeonCompanyId.trim().length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '시공팀 등록은 청연 회사가 필요합니다. 회사 데이터를 확인해주세요.'
                    });
                }

                if (value.type === '시공팀' && cheongyeonCompanyId.trim().length > 0 && value.companyId !== cheongyeonCompanyId) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '시공팀은 회사가 청연으로 고정입니다.'
                    });
                }

                if (value.type === '지원팀' && value.companyId.trim().length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '지원팀은 협력사 회사를 선택해주세요.'
                    });
                }

                if (value.type === '지원팀' && value.companyId.trim().length > 0 && !partnerCompanyIdSet.has(value.companyId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '지원팀은 협력사 회사를 선택해주세요.'
                    });
                }

                if (value.leaderWorkerId && value.leaderWorkerId.trim().length > 0) {
                    if (!value.selectedWorkerIds.includes(value.leaderWorkerId)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: '팀장은 선택한 작업자에 포함되어야 합니다.'
                        });
                    }
                }
            });
    }, [cheongyeonCompanyId, partnerCompanyIdSet]);

    const handleTeamTypeChange = (nextType: QuickTeamRegisterType) => {
        setTeamForm(prev => {
            if (nextType === '시공팀') {
                return {
                    ...prev,
                    type: nextType,
                    companyId: cheongyeonCompanyId,
                    selectedWorkerIds: [],
                    leaderWorkerId: ''
                };
            }

            return {
                ...prev,
                type: nextType,
                companyId: '',
                selectedWorkerIds: [],
                leaderWorkerId: ''
            };
        });

        setIsTeamNameTouched(false);
    };

    const teamWorkersForCompany = useMemo(() => {
        if (!teamForm.companyId) return [];

        return workers
            .filter(w => (w.companyId ? w.companyId === teamForm.companyId : false))
            .filter(w => (w.id ? w.id.trim().length > 0 : false))
            .map(w => ({
                id: w.id as string,
                label: `${w.name}${w.idNumber ? ` (${w.idNumber})` : ''}`
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [teamForm.companyId, workers]);

    const siteSchema = useMemo(() => {
        return z
            .object({
                name: z.string().trim().min(1, '현장명을 입력해주세요.'),
                startDate: z.string().trim().min(1, '시작일을 입력해주세요.'),
                endDate: z.string().trim().min(1, '종료일을 입력해주세요.'),
                companyId: z.string(),
                responsibleTeamId: z.string()
            })
            .superRefine((value, ctx) => {
                if (value.companyId.trim().length > 0 && !companies.some(c => c.id === value.companyId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '선택한 회사가 유효하지 않습니다.'
                    });
                }
                if (value.responsibleTeamId.trim().length > 0 && !teams.some(t => t.id === value.responsibleTeamId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '선택한 담당팀이 유효하지 않습니다.'
                    });
                }
                if (value.companyId.trim().length > 0 && value.responsibleTeamId.trim().length > 0) {
                    const team = teams.find(t => t.id === value.responsibleTeamId) ?? null;
                    if (team?.companyId && team.companyId !== value.companyId) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: '선택한 회사에 속한 담당팀을 선택해주세요.'
                        });
                    }
                }
            });
    }, [companies, teams]);

    const siteCompanyOptions = useMemo(() => {
        return companies
            .map(c => ({ value: c.id ?? '', label: c.name }))
            .filter(opt => opt.value.length > 0)
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [companies]);

    const siteTeamOptions = useMemo(() => {
        return teams
            .map(t => ({
                value: t.id ?? '',
                label: `${t.name}${t.companyName ? ` (${t.companyName})` : ''}`
            }))
            .filter(opt => opt.value.length > 0);
    }, [teams]);

    const partnerCompanySchema = useMemo(() => {
        return z.object({
            name: z.string().trim().min(1, '회사명을 입력해주세요.'),
            businessNumber: z.string().trim().min(1, '사업자번호를 입력해주세요.'),
            ceoName: z.string().trim().min(1, '대표자명을 입력해주세요.'),
            phone: z.string().trim().min(1, '전화번호를 입력해주세요.'),
            bankName: z.string().trim(),
            accountNumber: z.string().trim(),
            accountHolder: z.string().trim()
        });
    }, []);

    const constructionCompanySchema = useMemo(() => {
        return z.object({
            name: z.string().trim().min(1, '회사명을 입력해주세요.'),
            businessNumber: z.string().trim().min(1, '사업자번호를 입력해주세요.'),
            ceoName: z.string().trim().min(1, '대표자명을 입력해주세요.'),
            phone: z.string().trim().min(1, '전화번호를 입력해주세요.'),
            bankName: z.string().trim(),
            accountNumber: z.string().trim(),
            accountHolder: z.string().trim()
        });
    }, []);

    const toggleAccordion = (section: QuickRegisterSection) => {
        setSelectedSection(section);
    };

    const selectSection = (section: QuickRegisterSection) => {
        setSelectedSection(section);
    };

    const registerActiveSection = async () => {
        if (isSaving) return;

        setIsSaving(true);
        try {
            if (selectedSection === 'worker') {
                const parsedUnitPrice = Number(workerForm.unitPrice);
                if (!Number.isFinite(parsedUnitPrice)) {
                    toast.error('단가가 올바르지 않습니다.');
                    return;
                }

                const normalizedSalaryModel: WorkerSalaryModel =
                    workerForm.teamType === '지원팀' ? '지원팀' : workerForm.salaryModel;

                const validated = workerSchema.parse({
                    name: workerForm.name,
                    idNumber: workerForm.idNumber,
                    teamType: workerForm.teamType,
                    companyId: workerForm.companyId,
                    supportTeamId: workerForm.supportTeamId,
                    unitPrice: parsedUnitPrice,

                    salaryModel: normalizedSalaryModel,
                    bankName: workerForm.bankName,
                    accountNumber: workerForm.accountNumber,
                    accountHolder: workerForm.accountHolder
                });

                if (validated.teamType === '시공팀' && validated.companyId !== cheongyeonCompanyId) {
                    toast.error('시공팀 선택 시 회사는 청연으로 고정입니다.');
                    return;
                }

                if (validated.teamType === '지원팀' && !partnerCompanyIdSet.has(validated.companyId)) {
                    toast.error('지원팀은 협력사 회사를 선택해주세요.');
                    return;
                }

                const resolvedCompany =
                    validated.teamType === '시공팀'
                        ? companies.find(c => c.id === validated.companyId) ?? null
                        : null;

                const resolvedSupportTeam = teams.find(t => t.id === validated.supportTeamId) ?? null;

                const resolvedPartnerCompany =
                    validated.teamType === '지원팀'
                        ? companies.find(c => c.id === validated.companyId) ?? null
                        : null;

                if (validated.teamType === '시공팀' && !resolvedCompany) {
                    toast.error('회사를 선택해주세요.');
                    return;
                }

                if (validated.teamType === '지원팀' && !resolvedSupportTeam) {
                    toast.error('협력사 팀을 선택해주세요.');
                    return;
                }

                if (
                    validated.teamType === '지원팀' &&
                    resolvedSupportTeam?.companyId &&
                    resolvedSupportTeam.companyId !== validated.companyId
                ) {
                    toast.error('선택한 협력사 회사에 속한 팀을 선택해주세요.');
                    return;
                }

                if (
                    validated.teamType === '지원팀' &&
                    resolvedSupportTeam?.companyId &&
                    !partnerCompanyIdSet.has(resolvedSupportTeam.companyId)
                ) {
                    toast.error('협력사 팀을 선택해주세요.');
                    return;
                }

                await manpowerService.addWorker({
                    name: validated.name,
                    idNumber: validated.idNumber,
                    teamType: validated.teamType,
                    status: '재직',
                    unitPrice: validated.unitPrice,
                    salaryModel: validated.salaryModel,
                    payType: validated.salaryModel,
                    uid: '',
                    address: '',
                    contact: '',
                    email: '',
                    role: validated.role,
                    teamId: resolvedSupportTeam?.id ?? '',
                    teamName: resolvedSupportTeam?.name ?? '',
                    bankName: validated.bankName,
                    accountNumber: validated.accountNumber,
                    accountHolder: validated.accountHolder,
                    fileNameSaved: '',
                    siteId: '',
                    siteName: '',
                    companyId: resolvedSupportTeam?.companyId ?? resolvedPartnerCompany?.id ?? resolvedCompany?.id ?? '',
                    companyName: resolvedSupportTeam?.companyName ?? resolvedPartnerCompany?.name ?? resolvedCompany?.name ?? '',
                    leaderName: '',
                    color: ''
                }, false);

                emitMasterDataChanged({ workers: true });

                setWorkerForm({
                    name: '',
                    idNumber: '',
                    teamType: '시공팀',
                    companyId: cheongyeonCompanyId,
                    supportTeamId: '',
                    unitPrice: '0',
                    salaryModel: '일급제',
                    bankName: '',
                    accountNumber: '',
                    accountHolder: '',
                    role: '신규'
                });
                return;
            }

            if (selectedSection === 'team') {
                const validated = teamSchema.parse({
                    name: teamForm.name,
                    type: teamForm.type,
                    leaderWorkerId: teamForm.leaderWorkerId.trim().length > 0 ? teamForm.leaderWorkerId.trim() : undefined,
                    companyId: teamForm.companyId,
                    selectedWorkerIds: teamForm.selectedWorkerIds
                });

                const teamCompanyId = validated.type === '시공팀' ? cheongyeonCompanyId : validated.companyId;
                const resolvedCompany = companies.find(c => c.id === teamCompanyId) ?? null;
                const teamCompanyName = resolvedCompany?.name ?? (validated.type === '시공팀' ? cheongyeonCompanyName : '');

                const leaderWorker = validated.leaderWorkerId
                    ? workers.find(w => (w.id ? w.id === validated.leaderWorkerId : false)) ?? null
                    : null;
                const leaderId = leaderWorker?.id ?? '';
                const leaderName = leaderWorker?.name ?? '';

                const selectedIdSet = new Set(validated.selectedWorkerIds);
                const selectedWorkers = workers.filter(w => (w.id ? selectedIdSet.has(w.id) : false));
                const memberIds = selectedWorkers
                    .map(w => w.id)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0);
                const memberNames = selectedWorkers.map(w => w.name);

                const teamId = await teamService.addTeam({
                    name: validated.name,
                    type: validated.type,
                    leaderId,
                    leaderName,
                    companyId: teamCompanyId,
                    companyName: teamCompanyName,
                    parentTeamId: '',
                    parentTeamName: '',
                    memberCount: memberIds.length,
                    assignedWorkers: memberIds,
                    memberIds,
                    memberNames,
                    assignedSiteId: '',
                    assignedSiteName: '',
                    siteIds: [],
                    siteNames: [],
                    totalManDay: 0,
                    status: 'active',
                    supportRate: 0,
                    supportModel: 'man_day',
                    supportDescription: '',
                    serviceRate: 0,
                    serviceModel: 'man_day',
                    serviceDescription: '',
                    defaultSalaryModel: validated.type === '지원팀' ? '지원팀' : '일급제',
                    color: '',
                    icon: '',
                    role: ''
                });

                setTeams(prev => [
                    {
                        id: teamId,
                        name: validated.name,
                        type: validated.type,
                        leaderId,
                        leaderName,
                        companyId: teamCompanyId,
                        companyName: teamCompanyName,
                        memberCount: memberIds.length,
                        assignedWorkers: memberIds,
                        memberIds,
                        memberNames
                    },
                    ...prev
                ]);

                if (memberIds.length > 0) {
                    await manpowerService.updateWorkersBatch(memberIds, {
                        teamId,
                        teamName: validated.name,
                        teamType: validated.type,
                        companyId: teamCompanyId,
                        companyName: teamCompanyName,
                        leaderName
                    });

                    setWorkers(prev =>
                        prev.map(worker => {
                            const workerId = worker.id ?? '';
                            if (!memberIds.includes(workerId)) return worker;

                            return {
                                ...worker,
                                teamId,
                                teamName: validated.name,
                                teamType: validated.type,
                                companyId: teamCompanyId,
                                companyName: teamCompanyName,
                                leaderName
                            };
                        })
                    );
                }

                emitMasterDataChanged({ teams: true, workers: true });

                setTeamForm({
                    name: '',
                    type: '시공팀',
                    leaderWorkerId: '',
                    companyId: cheongyeonCompanyId,
                    selectedWorkerIds: []
                });

                setIsTeamNameTouched(false);
                return;
            }

            if (selectedSection === 'site') {
                const resolvedCode = generateCode('SITE');
                const validated = siteSchema.parse({
                    name: siteForm.name,
                    startDate: siteForm.startDate,
                    endDate: siteForm.endDate,
                    companyId: siteForm.companyId,
                    responsibleTeamId: siteForm.responsibleTeamId
                });

                const resolvedCompany =
                    validated.companyId.trim().length > 0
                        ? companies.find(c => c.id === validated.companyId) ?? null
                        : null;

                const resolvedResponsibleTeam =
                    validated.responsibleTeamId.trim().length > 0
                        ? teams.find(t => t.id === validated.responsibleTeamId) ?? null
                        : null;

                await siteService.addSite({
                    name: validated.name,
                    code: resolvedCode,
                    address: '',
                    startDate: validated.startDate,
                    endDate: validated.endDate,
                    status: 'active',
                    responsibleTeamId: resolvedResponsibleTeam?.id ?? '',
                    responsibleTeamName: resolvedResponsibleTeam?.name ?? '',
                    companyId: resolvedCompany?.id ?? '',
                    companyName: resolvedCompany?.name ?? '',
                    constructorCompanyId: '',
                    color: ''
                });

                emitMasterDataChanged({ sites: true });

                setSiteForm({
                    name: '',
                    startDate: today,
                    endDate: today,
                    companyId: '',
                    responsibleTeamId: ''
                });
                return;
            }

            const registerCompany = async (companyType: '협력사' | '건설사', form: CompanyFormState): Promise<{ companyId: string; companyName: string; companyCode: string; ceoName: string }> => {
                if (companyType === '건설사') {
                    const validated = constructionCompanySchema.parse({
                        name: form.name,
                        businessNumber: form.businessNumber,
                        ceoName: form.ceoName,
                        phone: form.phone,
                        bankName: form.bankName,
                        accountNumber: form.accountNumber,
                        accountHolder: form.accountHolder
                    });

                    const resolvedCode = generateCode('CST');

                    const companyId = await companyService.addCompany({
                        name: validated.name,
                        code: resolvedCode,
                        businessNumber: validated.businessNumber,
                        ceoName: validated.ceoName,
                        address: '',
                        phone: validated.phone,
                        email: '',
                        type: companyType,
                        bankName: validated.bankName,
                        accountNumber: validated.accountNumber,
                        accountHolder: validated.accountHolder,
                        siteName: '',
                        siteManager: '',
                        siteIds: [],
                        siteNames: [],
                        status: 'active',
                        color: '',
                        totalManDay: 0,
                        assignedClientCompanyIds: []
                    });

                    toast.saved('회사', 1);

                    setCompanies(prev => [
                        {
                            id: companyId,
                            name: validated.name,
                            code: resolvedCode,
                            businessNumber: validated.businessNumber,
                            ceoName: validated.ceoName,
                            address: '',
                            phone: validated.phone,
                            bankName: validated.bankName,
                            accountNumber: validated.accountNumber,
                            accountHolder: validated.accountHolder,
                            type: companyType,
                            status: 'active'
                        },
                        ...prev
                    ]);

                    return {
                        companyId,
                        companyName: validated.name,
                        companyCode: resolvedCode,
                        ceoName: validated.ceoName
                    };
                }

                const resolvedCode =
                    generateCode('PTN');

                const validated = partnerCompanySchema.parse({
                    name: form.name,
                    businessNumber: form.businessNumber,
                    ceoName: form.ceoName,
                    phone: form.phone,
                    bankName: form.bankName,
                    accountNumber: form.accountNumber,
                    accountHolder: form.accountHolder
                });

                const companyId = await companyService.addCompany({
                    name: validated.name,
                    code: resolvedCode,
                    businessNumber: validated.businessNumber,
                    ceoName: validated.ceoName,
                    address: '',
                    phone: validated.phone,
                    email: '',
                    type: companyType,
                    bankName: validated.bankName,
                    accountNumber: validated.accountNumber,
                    accountHolder: validated.accountHolder,
                    siteName: '',
                    siteManager: '',
                    siteIds: [],
                    siteNames: [],
                    status: 'active',
                    color: '',
                    totalManDay: 0,
                    assignedClientCompanyIds: []
                });

                toast.saved('회사', 1);

                setCompanies(prev => [
                    {
                        id: companyId,
                        name: validated.name,
                        code: resolvedCode,
                        businessNumber: validated.businessNumber,
                        ceoName: validated.ceoName,
                        address: '',
                        phone: validated.phone,
                        bankName: validated.bankName,
                        accountNumber: validated.accountNumber,
                        accountHolder: validated.accountHolder,
                        type: companyType,
                        status: 'active'
                    },
                    ...prev
                ]);

                return {
                    companyId,
                    companyName: validated.name,
                    companyCode: resolvedCode,
                    ceoName: validated.ceoName
                };
            };

            if (selectedSection === 'partnerCompany') {
                const trimmedTeamName = partnerCompanyTeamForm.teamName.trim();
                if (trimmedTeamName.length === 0) {
                    toast.error('팀명을 입력해주세요.');
                    return;
                }

                const createdCompany = await registerCompany('협력사', partnerCompanyForm);

                const teamId = await teamService.addTeam({
                    name: trimmedTeamName,
                    type: '지원팀',
                    leaderId: '',
                    leaderName: createdCompany.ceoName,
                    companyId: createdCompany.companyId,
                    companyName: createdCompany.companyName,
                    parentTeamId: '',
                    parentTeamName: '',
                    memberCount: 0,
                    assignedWorkers: [],
                    memberIds: [],
                    memberNames: [],
                    assignedSiteId: '',
                    assignedSiteName: '',
                    siteIds: [],
                    siteNames: [],
                    totalManDay: 0,
                    status: 'active',
                    supportRate: 0,
                    supportModel: 'man_day',
                    supportDescription: '',
                    serviceRate: 0,
                    serviceModel: 'man_day',
                    serviceDescription: '',
                    defaultSalaryModel: '지원팀',
                    color: '',
                    icon: '',
                    role: ''
                });

                setTeams(prev => [
                    {
                        id: teamId,
                        name: trimmedTeamName,
                        type: '지원팀',
                        leaderId: '',
                        leaderName: createdCompany.ceoName,
                        companyId: createdCompany.companyId,
                        companyName: createdCompany.companyName,
                        status: 'active',
                        defaultSalaryModel: '지원팀'
                    },
                    ...prev
                ]);

                setPartnerCompanyForm({
                    name: '',
                    businessNumber: '',
                    ceoName: '',
                    phone: '',
                    bankName: '',
                    accountNumber: '',
                    accountHolder: ''
                });

                setPartnerCompanyTeamForm({ teamName: '' });
                setIsPartnerCompanyTeamNameTouched(false);

                emitMasterDataChanged({ companies: true, teams: true });
                return;
            }

            if (selectedSection === 'constructionCompany') {
                await registerCompany('건설사', constructionCompanyForm);
                setConstructionCompanyForm({
                    name: '',
                    businessNumber: '',
                    ceoName: '',
                    phone: '',
                    bankName: '',
                    accountNumber: '',
                    accountHolder: ''
                });

                emitMasterDataChanged({ companies: true });
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                toast.error(error.issues[0]?.message ?? '입력값을 확인해주세요.');
                return;
            }

            if (error instanceof Error) {
                toast.error(error.message);
                return;
            }

            toast.error('등록 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const SectionHeader = ({
        section,
        title
    }: {
        section: QuickRegisterSection;
        title: string;
    }) => {
        const isOpenSection = selectedSection === section;
        const isSelected = selectedSection === section;
        return (
            <button
                type="button"
                onClick={() => toggleAccordion(section)}
                className="w-full text-left px-3 py-2 rounded-md"
                style={{
                    background: isSelected ? 'rgba(59,130,246,0.28)' : isOpenSection ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff'
                }}
            >
                <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{title}</span>
                    <span className="text-xs" style={{ opacity: 0.75 }}>
                        {isOpenSection ? '열림' : '닫힘'}
                    </span>
                </div>
            </button>
        );
    };

    const selectedTitle = useMemo(() => {
        switch (selectedSection) {
            case 'worker':
                return '작업자 등록';
            case 'team':
                return '팀 등록';
            case 'site':
                return '현장 등록';
            case 'partnerCompany':
                return '협력사 등록';
            case 'constructionCompany':
                return '건설사 등록';
            default:
                return '등록';
        }
    }, [selectedSection]);

    return (
        <aside id="bottom-panel" className={`panel ${isOpen ? 'open' : ''}`}>
            <div
                className="panel-header text-white flex justify-between items-center"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}
            >
                <span className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faUserTag} />
                    빠른등록
                </span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={registerActiveSection}
                        disabled={isSaving}
                        className="px-3 py-1.5 rounded-md text-sm font-bold"
                        style={{
                            background: isSaving ? 'rgba(148,163,184,0.35)' : 'rgba(59,130,246,0.95)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#fff'
                        }}
                    >
                        <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                        등록
                    </button>
                    <button
                        type="button"
                        onClick={() => togglePanel('bottom')}
                        className="px-3 py-1.5 rounded-md text-sm font-bold"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#fff'
                        }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            </div>
            <div className="panel-content p-4 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        <TopRowButton section="worker" label="작업자" isSelected={selectedSection === 'worker'} onSelect={selectSection} />
                        <TopRowButton section="team" label="팀" isSelected={selectedSection === 'team'} onSelect={selectSection} />
                        <TopRowButton section="site" label="현장" isSelected={selectedSection === 'site'} onSelect={selectSection} />
                        <TopRowButton section="partnerCompany" label="협력사" isSelected={selectedSection === 'partnerCompany'} onSelect={selectSection} />
                        <TopRowButton section="constructionCompany" label="건설사" isSelected={selectedSection === 'constructionCompany'} onSelect={selectSection} />
                    </div>

                    <div
                        className="px-3 py-2 rounded-md"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            color: 'rgba(255,255,255,0.90)'
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{selectedTitle}</span>
                            <span className="text-xs" style={{ opacity: 0.7 }}>필수 항목만</span>
                        </div>
                    </div>

                    {selectedSection === 'worker' && (
                        <div
                            className="rounded-md p-3 flex flex-col gap-3"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            <Input
                                label="이름"
                                value={workerForm.name}
                                onChange={(v) => setWorkerForm(prev => ({ ...prev, name: v }))}
                                placeholder="예: 홍길동"
                            />
                            <Input
                                label="식별번호(주민/생년)"
                                value={workerForm.idNumber}
                                onChange={(v) => setWorkerForm(prev => ({ ...prev, idNumber: v }))}
                                placeholder="예: 900101-1234567"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select
                                    label="팀구분"
                                    value={workerForm.teamType}
                                    onChange={(v) => handleWorkerTeamTypeChange(v as '시공팀' | '지원팀')}
                                    options={[
                                        { value: '시공팀', label: '시공팀' },
                                        { value: '지원팀', label: '지원팀' }
                                    ]}
                                />
                                {workerForm.teamType === '시공팀' ? (
                                    <Select
                                        label="회사"
                                        value={workerForm.companyId}
                                        onChange={() => undefined}
                                        disabled
                                        options={[
                                            ...constructionCompanyOptions
                                        ]}
                                    />
                                ) : (
                                    <Select
                                        label="협력사 회사"
                                        value={workerForm.companyId}
                                        onChange={(v) =>
                                            setWorkerForm(prev => ({
                                                ...prev,
                                                companyId: v,
                                                supportTeamId: ''
                                            }))
                                        }
                                        options={[
                                            { value: '', label: '선택' },
                                            ...partnerCompanyOptions
                                        ]}
                                    />
                                )}
                            </div>

                            {workerForm.teamType === '시공팀' && (
                                <Select
                                    label="시공팀 선택"
                                    value={workerForm.supportTeamId}
                                    onChange={(v) => setWorkerForm(prev => ({ ...prev, supportTeamId: v }))}
                                    options={[
                                        { value: '', label: '선택 (미지정 가능)' },
                                        ...constructionTeamOptions
                                    ]}
                                />
                            )}

                            {workerForm.teamType === '지원팀' && (
                                <Select
                                    label="협력사 팀"
                                    value={workerForm.supportTeamId}
                                    onChange={(v) => setWorkerForm(prev => ({ ...prev, supportTeamId: v }))}
                                    disabled={!workerForm.companyId}
                                    options={[
                                        { value: '', label: workerForm.companyId ? '선택' : '협력사 회사 먼저 선택' },
                                        ...supportTeamOptionsByCompany
                                    ]}
                                />
                            )}
                            <Select
                                label="급여방식"
                                value={workerForm.salaryModel}
                                onChange={(v) => setWorkerForm(prev => ({ ...prev, salaryModel: v as WorkerSalaryModel }))}
                                disabled={workerForm.teamType === '지원팀'}
                                options={[
                                    ...(workerForm.teamType === '지원팀'
                                        ? [{ value: '지원팀', label: '지원팀' }]
                                        : [
                                            { value: '일급제', label: '일급제' },
                                            { value: '월급제', label: '월급제' }
                                        ])
                                ]}
                            />
                            <Input
                                label="단가"
                                type="number"
                                value={workerForm.unitPrice}
                                onChange={(val) => setWorkerForm(prev => ({ ...prev, unitPrice: val }))}
                                placeholder="0"
                            />
                            <Select
                                label="직책"
                                value={workerForm.role}
                                onChange={(val) => setWorkerForm(prev => ({ ...prev, role: val }))}
                                options={[
                                    { value: '신규', label: '신규' },
                                    { value: '일반', label: '일반' },
                                    { value: '팀장', label: '팀장' }
                                ]}
                            />
                            <div className="grid grid-cols-3 gap-2">
                                <Input
                                    label="은행명"
                                    value={workerForm.bankName}
                                    onChange={(val) => setWorkerForm(prev => ({ ...prev, bankName: val }))}
                                    placeholder="은행 입력"
                                />
                                <Input
                                    label="계좌번호"
                                    value={workerForm.accountNumber}
                                    onChange={(val) => setWorkerForm(prev => ({ ...prev, accountNumber: val }))}
                                    placeholder="계좌번호 입력"
                                />
                                <Input
                                    label="예금주"
                                    value={workerForm.accountHolder}
                                    onChange={(val) => setWorkerForm(prev => ({ ...prev, accountHolder: val }))}
                                    placeholder="예금주 입력"
                                />
                            </div>
                        </div>
                    )}

                    {selectedSection === 'team' && (
                        <div
                            className="rounded-md p-3 flex flex-col gap-3"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            <Input
                                label="팀명"
                                value={teamForm.name}
                                onChange={(v) => {
                                    setIsTeamNameTouched(true);
                                    setTeamForm(prev => ({ ...prev, name: v }));
                                }}
                                placeholder="예: 1팀"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select
                                    label="팀구분"
                                    value={teamForm.type}
                                    onChange={(v) => handleTeamTypeChange(v as QuickTeamRegisterType)}
                                    options={[
                                        { value: '시공팀', label: '시공팀' },
                                        { value: '지원팀', label: '지원팀' }
                                    ]}
                                />
                                {teamForm.type === '시공팀' ? (
                                    <Select
                                        label="회사"
                                        value={teamForm.companyId}
                                        onChange={() => undefined}
                                        disabled
                                        options={[
                                            ...constructionCompanyOptions
                                        ]}
                                    />
                                ) : (
                                    <Select
                                        label="협력사 회사"
                                        value={teamForm.companyId}
                                        onChange={(v) => {
                                            setIsTeamNameTouched(false);
                                            setTeamForm(prev => ({
                                                ...prev,
                                                companyId: v,
                                                selectedWorkerIds: [],
                                                leaderWorkerId: '',
                                                name: ''
                                            }));
                                        }}
                                        options={[
                                            { value: '', label: '선택' },
                                            ...partnerCompanyOptions
                                        ]}
                                    />
                                )}
                            </div>
                            <Select
                                label="팀장(선택)"
                                value={teamForm.leaderWorkerId}
                                onChange={(v) => {
                                    const nextLeaderId = v;
                                    const nextLeaderName =
                                        nextLeaderId.trim().length > 0
                                            ? (workers.find(w => (w.id ? w.id === nextLeaderId : false))?.name ?? '')
                                            : '';

                                    setTeamForm(prev => {
                                        const prevLeaderName =
                                            prev.leaderWorkerId.trim().length > 0
                                                ? (workers.find(w => (w.id ? w.id === prev.leaderWorkerId : false))?.name ?? '')
                                                : '';

                                        const prevAutoName = prevLeaderName.trim().length > 0 ? `${prevLeaderName}팀` : '';
                                        const shouldAutoUpdateName =
                                            !isTeamNameTouched || prev.name.trim().length === 0 || (prevAutoName.length > 0 && prev.name === prevAutoName);

                                        if (nextLeaderId.trim().length === 0) {
                                            return {
                                                ...prev,
                                                leaderWorkerId: '',
                                                selectedWorkerIds: [],
                                                name: shouldAutoUpdateName ? '' : prev.name
                                            };
                                        }

                                        const nextAutoName = nextLeaderName.trim().length > 0 ? `${nextLeaderName}팀` : '';
                                        return {
                                            ...prev,
                                            leaderWorkerId: nextLeaderId,
                                            selectedWorkerIds: [nextLeaderId],
                                            name: shouldAutoUpdateName ? nextAutoName : prev.name
                                        };
                                    });
                                }}
                                disabled={isWorkersLoading || teamForm.companyId.trim().length === 0}
                                options={[
                                    { value: '', label: '선택 안함' },
                                    ...teamWorkersForCompany.map(w => ({ value: w.id, label: w.label }))
                                ]}
                            />
                        </div>
                    )}

                    {selectedSection === 'site' && (
                        <div
                            className="rounded-md p-3 flex flex-col gap-3"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            <Input
                                label="현장명"
                                value={siteForm.name}
                                onChange={(v) => setSiteForm(prev => ({ ...prev, name: v }))}
                                placeholder="예: ○○현장"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select
                                    label="담당팀(선택)"
                                    value={siteForm.responsibleTeamId}
                                    onChange={(v) =>
                                        setSiteForm(prev => {
                                            if (v.trim().length === 0) {
                                                return { ...prev, responsibleTeamId: '', companyId: '' };
                                            }

                                            const team = teams.find(t => t.id === v) ?? null;
                                            const nextCompanyId = team?.companyId && team.companyId.trim().length > 0 ? team.companyId : '';

                                            return {
                                                ...prev,
                                                responsibleTeamId: v,
                                                companyId: nextCompanyId
                                            };
                                        })
                                    }
                                    options={[
                                        { value: '', label: '선택안함' },
                                        ...siteTeamOptions
                                    ]}
                                />
                                <Select
                                    label="회사(자동)"
                                    value={siteForm.companyId}
                                    onChange={() => undefined}
                                    disabled
                                    options={[
                                        { value: '', label: '선택안함' },
                                        ...siteCompanyOptions
                                    ]}
                                />
                            </div>

                            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <Input
                                    label="시작일"
                                    type="date"
                                    value={siteForm.startDate}
                                    onChange={(v) => setSiteForm(prev => ({ ...prev, startDate: v }))}
                                />
                                <Input
                                    label="종료일"
                                    type="date"
                                    value={siteForm.endDate}
                                    onChange={(v) => setSiteForm(prev => ({ ...prev, endDate: v }))}
                                />
                            </div>
                        </div>
                    )}

                    {selectedSection === 'partnerCompany' && (
                        <div
                            className="rounded-md p-3 flex flex-col gap-3"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            <Input
                                label="대표자명"
                                value={partnerCompanyForm.ceoName}
                                onChange={(nextCeoName) => {
                                    const trimmedNext = nextCeoName.trim();

                                    setPartnerCompanyForm(prev => {
                                        const baseName = extractPartnerCompanyBaseName(prev.name, prev.ceoName);
                                        return {
                                            ...prev,
                                            ceoName: nextCeoName,
                                            name:
                                                trimmedNext.length === 0
                                                    ? baseName
                                                    : buildPartnerCompanyDisplayName(baseName, nextCeoName)
                                        };
                                    });

                                    if (!isPartnerCompanyTeamNameTouched) {
                                        setPartnerCompanyTeamForm({
                                            teamName: trimmedNext.length === 0 ? '' : `${trimmedNext}팀`
                                        });
                                    }
                                }}
                                placeholder="예: 홍대표"
                            />
                            <Input
                                label="회사명"
                                value={partnerCompanyForm.name}
                                onChange={(v) => setPartnerCompanyForm(prev => ({ ...prev, name: v }))}
                                onBlur={() =>
                                    setPartnerCompanyForm(prev => ({
                                        ...prev,
                                        name: buildPartnerCompanyDisplayName(
                                            extractPartnerCompanyBaseName(prev.name, prev.ceoName),
                                            prev.ceoName
                                        )
                                    }))
                                }
                                placeholder="예: ○○협력사"
                            />
                            <Input
                                label="팀명"
                                value={partnerCompanyTeamForm.teamName}
                                onChange={(v) => {
                                    setIsPartnerCompanyTeamNameTouched(true);
                                    setPartnerCompanyTeamForm(prev => ({ ...prev, teamName: v }));
                                }}
                                placeholder="예: 홍대표팀"
                            />
                            <Input
                                label="사업자번호"
                                value={partnerCompanyForm.businessNumber}
                                onChange={(v) => setPartnerCompanyForm(prev => ({ ...prev, businessNumber: v }))}
                                placeholder="예: 123-45-67890"
                            />
                            <Input
                                label="전화번호"
                                value={partnerCompanyForm.phone}
                                onChange={(v) => setPartnerCompanyForm(prev => ({ ...prev, phone: v }))}
                                placeholder="예: 010-0000-0000"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Input
                                    label="은행명"
                                    value={partnerCompanyForm.bankName}
                                    onChange={(v) => setPartnerCompanyForm(prev => ({ ...prev, bankName: v }))}
                                    placeholder="예: 국민은행"
                                />
                                <Input
                                    label="계좌번호"
                                    value={partnerCompanyForm.accountNumber}
                                    onChange={(v) => setPartnerCompanyForm(prev => ({ ...prev, accountNumber: v }))}
                                    placeholder="예: 123456-78-901234"
                                />
                                <Input
                                    label="예금주"
                                    value={partnerCompanyForm.accountHolder}
                                    onChange={(v) => setPartnerCompanyForm(prev => ({ ...prev, accountHolder: v }))}
                                    placeholder="예: 홍길동"
                                />
                            </div>
                        </div>
                    )}

                    {selectedSection === 'constructionCompany' && (
                        <div
                            className="rounded-md p-3 flex flex-col gap-3"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            <Input
                                label="회사명"
                                value={constructionCompanyForm.name}
                                onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, name: v }))}
                                placeholder="예: ○○건설"
                            />
                            <Input
                                label="사업자번호"
                                value={constructionCompanyForm.businessNumber}
                                onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, businessNumber: v }))}
                                placeholder="예: 123-45-67890"
                            />
                            <Input
                                label="대표자명"
                                value={constructionCompanyForm.ceoName}
                                onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, ceoName: v }))}
                                placeholder="예: 홍대표"
                            />
                            <Input
                                label="전화번호"
                                value={constructionCompanyForm.phone}
                                onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, phone: v }))}
                                placeholder="예: 010-0000-0000"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Input
                                    label="은행명"
                                    value={constructionCompanyForm.bankName}
                                    onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, bankName: v }))}
                                    placeholder="예: 국민은행"
                                />
                                <Input
                                    label="계좌번호"
                                    value={constructionCompanyForm.accountNumber}
                                    onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, accountNumber: v }))}
                                    placeholder="예: 123456-78-901234"
                                />
                                <Input
                                    label="예금주"
                                    value={constructionCompanyForm.accountHolder}
                                    onChange={(v) => setConstructionCompanyForm(prev => ({ ...prev, accountHolder: v }))}
                                    placeholder="예: 홍길동"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default BottomPanel;
