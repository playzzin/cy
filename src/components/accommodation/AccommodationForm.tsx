import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faSave, faTimes, faWonSign, faBolt, faFire, faTint, faWifi, faBroom, faBuilding, faMapMarkerAlt, faFileContract, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Accommodation, CostProfile, Contract } from '../../types/accommodation';
import { formatTypedDateInput, normalizeTypedDateInput } from '../../utils/typedDateInput';
import { getDefaultAccommodationOverchargeThreshold } from '../../utils/accommodationOvercharge';

type CostMode = 'variable' | 'fixed' | 'included';

interface AccommodationFormProps {
    initialData?: Accommodation;
    onSubmit: (data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onCancel: () => void;
    onManageAssignments?: (item: Accommodation) => void;
}

const DEFAULT_COST_PROFILE: CostProfile = {
    electricity: 'variable',
    gas: 'variable',
    water: 'included',
    internet: 'fixed',
    maintenance: 'fixed',
    fixedInternet: 2500,
    fixedMaintenance: 50000
};

const DEFAULT_CONTRACT: Contract = {
    startDate: '',
    endDate: '',
    deposit: 0,
    monthlyRent: 0,
    paymentDay: 1,
    landlordName: '',
    landlordContact: '',
    isReported: false,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    rentPayDate: 1
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        if (!cleaned) return fallback;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const formatCurrencyInput = (value: number): string => (
    Number.isFinite(value) && value !== 0 ? value.toLocaleString('ko-KR') : ''
);

const parseCurrencyInput = (value: string): number => (
    Number(value.replace(/[^0-9]/g, '')) || 0
);

const normalizeDay = (value: unknown, fallback = 1): number => {
    const parsed = Math.floor(toFiniteNumber(value, fallback));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(31, parsed));
};

const toPlainObject = (value: unknown): Record<string, unknown> => {
    if (!value) return {};
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return {};
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
            return {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
};

const hasDefinedValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
};

const normalizeContractForForm = (
    contract?: Partial<Contract> | string | null,
    fallback?: Record<string, unknown> | Partial<Contract> | null
): Contract => {
    const source = toPlainObject(contract) as Partial<Contract>;
    const fallbackSource = toPlainObject(fallback) as Partial<Contract> & Record<string, unknown>;
    const fallbackDeposit = toFiniteNumber((fallbackSource as any).deposit, DEFAULT_CONTRACT.deposit);
    const fallbackMonthlyRent = toFiniteNumber((fallbackSource as any).monthlyRent, DEFAULT_CONTRACT.monthlyRent);
    const paymentDaySource = hasDefinedValue(source.paymentDay)
        ? source.paymentDay
        : hasDefinedValue(source.rentPayDate)
            ? source.rentPayDate
            : (fallbackSource as any).paymentDay ?? (fallbackSource as any).rentPayDate;
    const paymentDay = normalizeDay(paymentDaySource, DEFAULT_CONTRACT.paymentDay);
    const rentPayDateSource = hasDefinedValue(source.rentPayDate)
        ? source.rentPayDate
        : hasDefinedValue(source.paymentDay)
            ? source.paymentDay
            : (fallbackSource as any).rentPayDate ?? (fallbackSource as any).paymentDay;
    const rentPayDate = normalizeDay(rentPayDateSource, paymentDay);

    return {
        ...DEFAULT_CONTRACT,
        ...source,
        deposit: hasDefinedValue(source.deposit)
            ? toFiniteNumber(source.deposit, DEFAULT_CONTRACT.deposit)
            : fallbackDeposit,
        monthlyRent: hasDefinedValue(source.monthlyRent)
            ? toFiniteNumber(source.monthlyRent, DEFAULT_CONTRACT.monthlyRent)
            : fallbackMonthlyRent,
        paymentDay,
        rentPayDate,
        landlordName: source.landlordName ?? '',
        landlordContact: source.landlordContact ?? '',
        bankName: source.bankName ?? '',
        accountNumber: source.accountNumber ?? '',
        accountHolder: source.accountHolder ?? '',
        transferDay: hasDefinedValue(source.transferDay) ? normalizeDay(source.transferDay, paymentDay) : undefined,
        transferAccountInfo: source.transferAccountInfo ?? ''
    };
};

const normalizeCostProfileForForm = (costProfile?: Partial<CostProfile> | null): CostProfile => {
    const source = (costProfile ?? {}) as Partial<CostProfile>;
    const toMode = (value: unknown, fallback: CostProfile['electricity']): CostProfile['electricity'] => {
        if (value === 'variable' || value === 'fixed' || value === 'included') return value;
        return fallback;
    };

    return {
        ...DEFAULT_COST_PROFILE,
        ...source,
        electricity: toMode(source.electricity, DEFAULT_COST_PROFILE.electricity),
        gas: toMode(source.gas, DEFAULT_COST_PROFILE.gas),
        water: toMode(source.water, DEFAULT_COST_PROFILE.water),
        internet: toMode(source.internet, DEFAULT_COST_PROFILE.internet),
        maintenance: toMode(source.maintenance, DEFAULT_COST_PROFILE.maintenance),
        fixedElectricity: source.fixedElectricity !== undefined ? toFiniteNumber(source.fixedElectricity, 0) : source.fixedElectricity,
        fixedGas: source.fixedGas !== undefined ? toFiniteNumber(source.fixedGas, 0) : source.fixedGas,
        fixedWater: source.fixedWater !== undefined ? toFiniteNumber(source.fixedWater, 0) : source.fixedWater,
        fixedInternet: source.fixedInternet !== undefined ? toFiniteNumber(source.fixedInternet, 0) : source.fixedInternet,
        fixedMaintenance: source.fixedMaintenance !== undefined ? toFiniteNumber(source.fixedMaintenance, 0) : source.fixedMaintenance
    };
};

const StatusBadge = (props: {
    label: string;
    icon: IconProp;
    value: CostMode;
    onChange: (v: CostMode) => void;
    fixedValue?: number;
    onFixedChange: (v: number) => void;
}) => {
    const { label, icon, value, onChange, fixedValue, onFixedChange } = props;
    return (
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-100 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3 w-36">
                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 flex items-center justify-center transition-colors">
                    <FontAwesomeIcon icon={icon} />
                </div>
                <span className="font-bold text-slate-700 text-sm">{label}</span>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['variable', 'fixed', 'included'] as const).map((mode) => {
                    const labelMap: Record<string, string> = { variable: '변동', fixed: '고정', included: '포함' };
                    return (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => onChange(mode)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all
                                ${value === mode
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }
                            `}
                        >
                            {labelMap[mode]}
                        </button>
                    );
                })}
            </div>

            <div className="w-36 text-right pl-4">
                {value === 'fixed' ? (
                    <div className="relative group/input">
                        <input
                            type="text"
                            value={fixedValue?.toLocaleString() ?? ''}
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) onFixedChange(val);
                            }}
                            className="w-full text-right p-1.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg font-mono text-base font-bold text-slate-700 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            placeholder="0"
                        />
                        <span className="absolute right-2 top-2 text-xs text-slate-400 pointer-events-none">₩</span>
                    </div>
                ) : value === 'included' ? (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                        월세 포함
                    </span>
                ) : (
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                        매월 입력
                    </span>
                )}
            </div>
        </div>
    );
};

const AccommodationForm: React.FC<AccommodationFormProps> = ({ initialData, onSubmit, onCancel, onManageAssignments }) => {
    const getNormalizedContract = (data?: Accommodation): Contract => {
        return normalizeContractForForm((data as any)?.contract, data as any);
    };

    const getInitialOverchargeThreshold = (data?: Accommodation): number => (
        toFiniteNumber(
            data?.utilityOverchargeThreshold,
            getDefaultAccommodationOverchargeThreshold(data?.type) ?? 0
        )
    );

    const [name, setName] = useState(initialData?.name || '');
    const [address, setAddress] = useState(initialData?.address || '');
    const [type, setType] = useState<Accommodation['type']>(initialData?.type || 'OneRoom');
    const [utilityOverchargeThreshold, setUtilityOverchargeThreshold] = useState(
        getInitialOverchargeThreshold(initialData)
    );
    const [status, setStatus] = useState<Accommodation['status']>(initialData?.status || 'active');
    const [ownership, setOwnership] = useState<Accommodation['ownership']>(initialData?.ownership || 'Cheongyeon');

    // Contract State
    const [contract, setContract] = useState<Contract>(getNormalizedContract(initialData));

    // Cost Profile State
    const [costProfile, setCostProfile] = useState<CostProfile>(normalizeCostProfileForForm(initialData?.costProfile));

    useEffect(() => {
        setName(initialData?.name || '');
        setAddress(initialData?.address || '');
        setType(initialData?.type || 'OneRoom');
        setUtilityOverchargeThreshold(getInitialOverchargeThreshold(initialData));
        setStatus(initialData?.status || 'active');
        setOwnership(initialData?.ownership || 'Cheongyeon');
        setContract(getNormalizedContract(initialData));
        setCostProfile(normalizeCostProfileForForm(initialData?.costProfile));
    }, [initialData]);

    // StatusBadge component removed from here and will be placed outside

    const updateContractDate = (field: 'startDate' | 'endDate', value: string) => {
        setContract((prev) => ({ ...prev, [field]: formatTypedDateInput(value) }));
    };

    const normalizeContractDate = (field: 'startDate' | 'endDate') => {
        setContract((prev) => {
            const normalized = normalizeTypedDateInput(String(prev[field] ?? ''));
            return normalized ? { ...prev, [field]: normalized } : prev;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedContract = normalizeContractForForm(contract);
        const defaultOverchargeThreshold = getDefaultAccommodationOverchargeThreshold(type);
        onSubmit({
            name,
            address,
            type,
            utilityOverchargeThreshold: defaultOverchargeThreshold
                ? utilityOverchargeThreshold || defaultOverchargeThreshold
                : 0,
            status,
            ownership,
            contract: normalizedContract,
            costProfile
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-10 fade-in">
            <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-900/20 w-full max-w-5xl max-h-[90vh] overflow-y-auto transform transition-all scale-100">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-t-2xl">
                        <div className="flex items-center gap-3 text-white">
                            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                <FontAwesomeIcon icon={initialData ? faBuilding : faPlus} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">
                                    {initialData ? '숙소 정보 수정' : '새 숙소 등록'}
                                </h2>
                                <p className="text-indigo-100 text-xs opacity-90 mt-0.5">
                                    숙소의 기본 정보, 계약 내용 및 공과금 프로필을 설정합니다.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-white/70 hover:text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                        >
                            <FontAwesomeIcon icon={faTimes} className="text-lg" />
                        </button>
                    </div>

                    <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Left Column: Basic Info & Contract */}
                        <div className="space-y-8">
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">기본 정보</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">숙소명 (호수)</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-2.5 text-slate-400">
                                                <FontAwesomeIcon icon={faBuilding} />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="예: 사동 502호"
                                                className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700 placeholder-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">주소</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-2.5 text-slate-400">
                                                <FontAwesomeIcon icon={faMapMarkerAlt} />
                                            </div>
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                placeholder="상세 주소 입력"
                                                className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700 placeholder-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">유형</label>
                                            <select
                                                value={type}
                                                onChange={(e) => {
                                                    const nextType = e.target.value as Accommodation['type'];
                                                    setType(nextType);
                                                    setUtilityOverchargeThreshold(
                                                        getDefaultAccommodationOverchargeThreshold(nextType) ?? 0
                                                    );
                                                }}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none font-medium text-slate-700"
                                            >
                                                <option value="OneRoom">원룸</option>
                                                <option value="TwoRoom">투룸</option>
                                                <option value="ThreeRoom">쓰리룸</option>
                                                <option value="Apartment">아파트</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">상태</label>
                                            <select
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value as Accommodation['status'])}
                                                className={`w-full p-2.5 border rounded-xl outline-none font-bold text-sm
                                                    ${status === 'active'
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-100'
                                                        : 'bg-slate-50 border-slate-200 text-slate-600 focus:ring-slate-100'}
                                                `}
                                            >
                                                <option value="active">🟢 계약중 (Active)</option>
                                                <option value="inactive">⚫ 종료 (Inactive)</option>
                                            </select>
                                        </div>
                                    </div>
                                    {(type === 'TwoRoom' || type === 'ThreeRoom') && (
                                        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                                            <label className="mb-1.5 ml-1 block text-xs font-bold text-rose-700">
                                                과청구 기준금액
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatCurrencyInput(utilityOverchargeThreshold)}
                                                    onChange={(e) => setUtilityOverchargeThreshold(parseCurrencyInput(e.target.value))}
                                                    className="w-full rounded-xl border border-rose-200 bg-white p-2.5 pr-8 text-right font-mono font-bold text-rose-700 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                                    placeholder={type === 'TwoRoom' ? '200,000' : '300,000'}
                                                />
                                                <span className="absolute right-3 top-2.5 text-sm text-rose-400">₩</span>
                                            </div>
                                            <p className="mt-1.5 text-[11px] font-medium text-rose-600">
                                                전기세·가스비·수도세 합계가 이 금액을 초과하면 초과한 차액만 과청구로 표시합니다.
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">명의 (소유주)</label>
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            {(['Cheongyeon', 'Dawon', 'Individual'] as const).map((opt) => {
                                                const labelMap: Record<string, string> = { Cheongyeon: '청연', Dawon: '다원', Individual: '개인(사모님)' };
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setOwnership(opt)}
                                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all
                                                            ${ownership === opt
                                                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                                            }
                                                        `}
                                                    >
                                                        {labelMap[opt]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 mb-4 mt-8">
                                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">계약 세부 정보</h3>
                                </div>
                                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">보증금</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatCurrencyInput(contract.deposit)}
                                                    onChange={(e) => setContract({ ...contract, deposit: parseCurrencyInput(e.target.value) })}
                                                    className="w-full p-2.5 pr-8 bg-white border border-slate-200 rounded-xl text-right font-mono text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₩</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">월세 (기본)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatCurrencyInput(contract.monthlyRent)}
                                                    onChange={(e) => setContract({ ...contract, monthlyRent: parseCurrencyInput(e.target.value) })}
                                                    className="w-full p-2.5 pr-8 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-right font-mono font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-2.5 text-indigo-300 text-sm">₩</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">계약 시작일</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={10}
                                                placeholder="YYYY-MM-DD"
                                                value={contract.startDate}
                                                onChange={(e) => updateContractDate('startDate', e.target.value)}
                                                onBlur={() => normalizeContractDate('startDate')}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">계약 종료일</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={10}
                                                placeholder="YYYY-MM-DD"
                                                value={contract.endDate}
                                                onChange={(e) => updateContractDate('endDate', e.target.value)}
                                                onBlur={() => normalizeContractDate('endDate')}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 py-2 px-1">
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                id="isReported"
                                                checked={contract.isReported}
                                                onChange={(e) => setContract({ ...contract, isReported: e.target.checked })}
                                                className="w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </div>
                                        <label htmlFor="isReported" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                            임대차계약 신고 완료
                                        </label>
                                    </div>

                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 mb-4 mt-8">
                                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">임대인 및 결제 정보</h3>
                                </div>
                                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">임대인 성함</label>
                                            <input
                                                type="text"
                                                placeholder="성함"
                                                value={contract.landlordName}
                                                onChange={(e) => setContract({ ...contract, landlordName: e.target.value })}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">임대인 연락처</label>
                                            <input
                                                type="text"
                                                placeholder="연락처"
                                                value={contract.landlordContact}
                                                onChange={(e) => setContract({ ...contract, landlordContact: e.target.value })}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100">
                                        <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">계좌 정보</label>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            <input
                                                type="text"
                                                placeholder="은행명"
                                                value={contract.bankName || ''}
                                                onChange={(e) => setContract({ ...contract, bankName: e.target.value })}
                                                className="min-w-0 p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="예금주"
                                                value={contract.accountHolder || ''}
                                                onChange={(e) => setContract({ ...contract, accountHolder: e.target.value })}
                                                className="min-w-0 p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="계좌번호"
                                                value={contract.accountNumber || ''}
                                                onChange={(e) => setContract({ ...contract, accountNumber: e.target.value })}
                                                className="col-span-2 min-w-0 p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Auto Transfer Configuration */}
                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-xs font-bold text-slate-500 ml-1">자동이체 설정</label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id="isAutoTransfer"
                                                        checked={contract.isAutoTransfer || false}
                                                        onChange={(e) => setContract({ ...contract, isAutoTransfer: e.target.checked })}
                                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </div>
                                                <label htmlFor="isAutoTransfer" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                                    자동이체 사용
                                                </label>
                                            </div>
                                        </div>

                                        {contract.isAutoTransfer && (
                                            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 space-y-3 animate-fade-in-down">
                                                <div className="flex items-center gap-3">
                                                    <label className="text-xs font-bold text-slate-500 whitespace-nowrap w-16">이체일</label>
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="text-sm text-slate-600">매월</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="31"
                                                            value={contract.transferDay || 1}
                                                            onChange={(e) => setContract({ ...contract, transferDay: normalizeDay(e.target.value, contract.paymentDay || 1) })}
                                                            className="w-16 p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                                                        />
                                                        <span className="text-sm text-slate-600">일</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <label className="text-xs font-bold text-slate-500 whitespace-nowrap w-16">출금 계좌</label>
                                                    <input
                                                        type="text"
                                                        placeholder="출금 계좌 정보 (예: 국민 1234...)"
                                                        value={contract.transferAccountInfo || ''}
                                                        onChange={(e) => setContract({ ...contract, transferAccountInfo: e.target.value })}
                                                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-slate-500 ml-1">월세 납부일</label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-600">매월</span>
                                                <input
                                                    id="rentPayDate"
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={contract.paymentDay || 1}
                                                    onChange={(e) => {
                                                        const val = normalizeDay(e.target.value, contract.paymentDay || 1);
                                                        setContract({ ...contract, paymentDay: val, rentPayDate: val });
                                                    }}
                                                    className="w-20 p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                                                />
                                                <span className="text-sm text-slate-600">일</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Cost Profile (Smart Config) */}
                        <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-200/60 shadow-inner">
                            <h3 className="text-sm font-extrabold text-slate-800 uppercase mb-2 flex items-center gap-2">
                                <span className="bg-yellow-400 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs shadow-sm shadow-yellow-200">
                                    <FontAwesomeIcon icon={faBolt} />
                                </span>
                                공과금 프로필 설정 (Smart Config)
                            </h3>
                            <p className="text-xs text-slate-500 mb-6 ml-8 leading-relaxed">
                                매월 자동으로 입력될 기본값을 설정합니다. <br />
                                <span className="text-indigo-600 font-bold">'고정'</span>으로 설정 시 매월 동일한 금액이 자동 입력되며, <br />
                                <span className="text-slate-600 font-bold">'변동'</span>으로 설정 시 매월 대장에서 직접 입력해야 합니다.
                            </p>

                            <div className="space-y-3">
                                <StatusBadge
                                    label="전기세"
                                    icon={faBolt}
                                    value={costProfile.electricity}
                                    onChange={(v) => setCostProfile({ ...costProfile, electricity: v })}
                                    fixedValue={costProfile.fixedElectricity}
                                    onFixedChange={(v: number) => setCostProfile({ ...costProfile, fixedElectricity: v })}
                                />
                                <StatusBadge
                                    label="가스비"
                                    icon={faFire}
                                    value={costProfile.gas}
                                    onChange={(v) => setCostProfile({ ...costProfile, gas: v })}
                                    fixedValue={costProfile.fixedGas}
                                    onFixedChange={(v: number) => setCostProfile({ ...costProfile, fixedGas: v })}
                                />
                                <StatusBadge
                                    label="수도세"
                                    icon={faTint}
                                    value={costProfile.water}
                                    onChange={(v) => setCostProfile({ ...costProfile, water: v })}
                                    fixedValue={costProfile.fixedWater}
                                    onFixedChange={(v: number) => setCostProfile({ ...costProfile, fixedWater: v })}
                                />
                                <StatusBadge
                                    label="인터넷"
                                    icon={faWifi}
                                    value={costProfile.internet}
                                    onChange={(v) => setCostProfile({ ...costProfile, internet: v })}
                                    fixedValue={costProfile.fixedInternet}
                                    onFixedChange={(v: number) => setCostProfile({ ...costProfile, fixedInternet: v })}
                                />
                                <StatusBadge
                                    label="관리비"
                                    icon={faBroom}
                                    value={costProfile.maintenance}
                                    onChange={(v) => setCostProfile({ ...costProfile, maintenance: v })}
                                    fixedValue={costProfile.fixedMaintenance}
                                    onFixedChange={(v: number) => setCostProfile({ ...costProfile, fixedMaintenance: v })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-3 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-bold rounded-xl transition shadow-sm"
                        >
                            취소
                        </button>
                        {initialData && onManageAssignments && (
                            <button
                                type="button"
                                onClick={() => onManageAssignments(initialData)}
                                className="mr-auto px-6 py-3 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 font-bold rounded-xl transition shadow-sm flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faBuilding} />
                                배정 관리
                            </button>
                        )}
                        <button
                            type="submit"
                            className="px-6 py-3 text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 font-bold rounded-xl transition-all flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            {initialData ? '저장하기' : '등록 완료'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccommodationForm;
