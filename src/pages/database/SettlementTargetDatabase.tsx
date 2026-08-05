import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBan,
    faBuilding,
    faCheckCircle,
    faEdit,
    faPlus,
    faReceipt,
    faSearch,
    faSpinner,
    faUserTie,
    faUsers,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import {
    settlementTargetService,
    DEFAULT_SETTLEMENT_TARGET_AFTER_TAX_RATE,
    normalizeSettlementTargetAfterTaxRate,
    SettlementTarget,
    SettlementTargetStatus,
    SettlementTargetType,
} from '../../services/settlementTargetService';

interface SettlementTargetDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
}

export type SettlementTargetFormState = {
    name: string;
    targetType: SettlementTargetType;
    positionTitle: string;
    defaultAfterTaxPercent: string;
    companyId: string;
    contact: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    buybackEnabled: boolean;
    evidenceRequired: boolean;
    status: SettlementTargetStatus;
    memo: string;
};

const EMPTY_FORM: SettlementTargetFormState = {
    name: '',
    targetType: 'client_contact',
    positionTitle: '',
    defaultAfterTaxPercent: String(DEFAULT_SETTLEMENT_TARGET_AFTER_TAX_RATE * 100),
    companyId: '',
    contact: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    buybackEnabled: false,
    evidenceRequired: false,
    status: 'active',
    memo: '',
};

export const TARGET_TYPE_OPTIONS: Array<{ value: SettlementTargetType; label: string }> = [
    { value: 'salesperson', label: '영업사원' },
    { value: 'client_contact', label: '관계자' },
    { value: 'client_company', label: '발주사' },
    { value: 'rental_company', label: '임대사' },
    { value: 'office_staff', label: '사무실 직원' },
    { value: 'other', label: '기타' },
];

const TARGET_TYPE_LABELS: Record<string, string> = {
    office_income: '사무실 수입',
    rental_company: '임대사',
    client_company: '발주사',
    client_contact: '관계자',
    other: '기타',
    salesperson: '영업사원',
    office_staff: '사무실 직원',
};

const STATUS_OPTIONS: Array<{ value: SettlementTargetStatus; label: string }> = [
    { value: 'active', label: '사용' },
    { value: 'inactive', label: '미사용' },
];

const toText = (value: unknown): string => String(value ?? '').trim();

const formatAfterTaxPercent = (value: unknown): string => {
    const percent = normalizeSettlementTargetAfterTaxRate(value) * 100;
    return String(Number(percent.toFixed(4)));
};

export const maskSettlementTargetAccountNumber = (value: unknown): string => {
    const raw = toText(value);
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    const compact = digits || raw.replace(/[\s-]/g, '');
    const lastFour = compact.slice(-4);
    return lastFour ? `•••• ${lastFour}` : '';
};

export const getSettlementTargetTypeLabel = (value?: SettlementTargetType | string | null): string =>
    TARGET_TYPE_LABELS[String(value || '')] || '기타';

const getStatusLabel = (value?: SettlementTargetStatus | string | null): string =>
    STATUS_OPTIONS.find((option) => option.value === value)?.label || '사용';

export const buildSettlementTargetFormState = (target?: Partial<SettlementTarget> | null): SettlementTargetFormState => ({
    name: toText(target?.name),
    targetType: (target?.targetType || 'client_contact') as SettlementTargetType,
    positionTitle: toText(target?.positionTitle),
    defaultAfterTaxPercent: formatAfterTaxPercent(target?.defaultAfterTaxRate),
    companyId: toText(target?.companyId),
    contact: toText(target?.contact),
    bankName: toText(target?.bankName),
    accountNumber: toText(target?.accountNumber),
    accountHolder: toText(target?.accountHolder),
    buybackEnabled: Boolean(target?.buybackEnabled),
    evidenceRequired: Boolean(target?.evidenceRequired),
    status: (target?.status || 'active') as SettlementTargetStatus,
    memo: toText(target?.memo),
});

export const buildSettlementTargetPayload = (
    formData: SettlementTargetFormState,
    companyOptions: Company[],
    currentTarget?: SettlementTarget | null
): Partial<SettlementTarget> => {
    const company = companyOptions.find((item) => item.id === formData.companyId);
    const keepsExistingCompany = Boolean(
        currentTarget && toText(currentTarget.companyId) === formData.companyId
    );
    const payload: Partial<SettlementTarget> = {
        name: formData.name.trim(),
        targetType: formData.targetType,
        positionTitle: formData.positionTitle.trim(),
        defaultAfterTaxRate: normalizeSettlementTargetAfterTaxRate(Number(formData.defaultAfterTaxPercent) / 100),
        companyId: formData.companyId || '',
        companyName: company?.name || (keepsExistingCompany ? toText(currentTarget?.companyName) : ''),
        contact: formData.contact.trim(),
        bankName: formData.bankName.trim(),
        accountNumber: formData.accountNumber.trim(),
        accountHolder: formData.accountHolder.trim(),
        buybackEnabled: formData.buybackEnabled,
        evidenceRequired: formData.evidenceRequired,
        status: formData.status,
        memo: formData.memo.trim(),
    };

    if (!currentTarget) payload.defaultProcessType = 'payable';
    return payload;
};

const SettlementTargetDatabase: React.FC<SettlementTargetDatabaseProps> = ({ hideHeader = false, highlightedId }) => {
    const [targets, setTargets] = useState<SettlementTarget[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [companyLoadWarning, setCompanyLoadWarning] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | SettlementTargetType>('all');
    const [statusFilter, setStatusFilter] = useState<'active' | 'all' | SettlementTargetStatus>('active');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTarget, setCurrentTarget] = useState<SettlementTarget | null>(null);
    const [formData, setFormData] = useState<SettlementTargetFormState>(EMPTY_FORM);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        setCompanyLoadWarning(null);
        try {
            const [targetResult, companyResult] = await Promise.allSettled([
                settlementTargetService.getTargets(true),
                companyService.getCompanies(),
            ]);

            if (targetResult.status === 'fulfilled') {
                setTargets(targetResult.value);
            } else {
                console.error('[SettlementTargetDatabase] target load failed:', targetResult.reason);
                setTargets([]);
                setError('정산 대상자 목록을 불러오지 못했습니다.');
            }

            if (companyResult.status === 'fulfilled') {
                setCompanies(companyResult.value);
            } else {
                console.warn('[SettlementTargetDatabase] company load failed:', companyResult.reason);
                setCompanyLoadWarning('회사 목록 권한이 없어 연결 회사 선택은 제한되지만 정산 대상자 조회와 수정은 계속할 수 있습니다.');
            }
        } catch (err) {
            console.error('[SettlementTargetDatabase] load failed:', err);
            setError('정산 대상자 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    const companyOptions = useMemo(
        () => [...companies].sort((a, b) => toText(a.name).localeCompare(toText(b.name), 'ko')),
        [companies]
    );

    const filteredTargets = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return targets
            .filter((target) => {
                if (statusFilter === 'active' && target.status === 'inactive') return false;
                if (statusFilter !== 'active' && statusFilter !== 'all' && target.status !== statusFilter) return false;
                if (typeFilter !== 'all' && target.targetType !== typeFilter) return false;
                if (!query) return true;

                const text = [
                    target.name,
                    target.positionTitle,
                    target.companyName,
                    target.contact,
                    target.bankName,
                    target.accountNumber,
                    target.accountHolder,
                    target.memo,
                ].map(toText).join(' ').toLowerCase();
                return text.includes(query);
            })
            .sort((a, b) =>
                getSettlementTargetTypeLabel(a.targetType).localeCompare(getSettlementTargetTypeLabel(b.targetType), 'ko') ||
                toText(a.name).localeCompare(toText(b.name), 'ko')
            );
    }, [searchTerm, statusFilter, targets, typeFilter]);

    const summary = useMemo(() => ({
        total: targets.length,
        active: targets.filter((target) => target.status !== 'inactive').length,
        salespeople: targets.filter((target) => target.targetType === 'salesperson').length,
        contacts: targets.filter((target) => target.targetType === 'client_contact').length,
        others: targets.filter((target) => target.targetType === 'other').length,
    }), [targets]);

    const handleInputChange = (field: keyof SettlementTargetFormState, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const openCreateModal = () => {
        setCurrentTarget(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
        setError(null);
    };

    const openEditModal = (target: SettlementTarget) => {
        setCurrentTarget(target);
        setFormData(buildSettlementTargetFormState(target));
        setIsModalOpen(true);
        setError(null);
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setError('대상자명은 필수입니다.');
            return;
        }
        const afterTaxPercent = Number(formData.defaultAfterTaxPercent);
        if (!formData.defaultAfterTaxPercent.trim() || !Number.isFinite(afterTaxPercent) || afterTaxPercent < 0 || afterTaxPercent > 100) {
            setError('기본 세후율은 0% 이상 100% 이하로 입력해 주세요.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = buildSettlementTargetPayload(formData, companyOptions, currentTarget);
            if (currentTarget?.id) {
                await settlementTargetService.updateTarget(currentTarget.id, payload);
            } else {
                await settlementTargetService.addTarget(payload);
            }
            setIsModalOpen(false);
            await fetchData();
        } catch (err) {
            console.error('[SettlementTargetDatabase] save failed:', err);
            setError('정산 대상자 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (target: SettlementTarget) => {
        if (!target.id) return;
        if (target.status === 'inactive') return;
        if (!window.confirm(`${target.name} 정산 대상자를 사용 중지하시겠습니까?\n기존 바이백·정산 내역은 삭제되지 않고 유지됩니다.`)) return;
        setSaving(true);
        setError(null);
        try {
            await settlementTargetService.deactivateTarget(target.id);
            await fetchData();
        } catch (err) {
            console.error('[SettlementTargetDatabase] deactivate failed:', err);
            setError('정산 대상자 사용 중지 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const inputClassName = 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
    const selectClassName = `${inputClassName} cursor-pointer`;

    return (
        <div className={hideHeader ? '' : 'min-h-screen bg-slate-50 p-6'}>
            <div className="space-y-5">
                {!hideHeader && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                                <FontAwesomeIcon icon={faReceipt} className="text-indigo-600" />
                                정산 대상자 관리
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">차액 배분에서 선택할 관계자와 기타 대상을 관리합니다.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            대상자 등록
                        </button>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {error}
                    </div>
                )}

                {companyLoadWarning && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                        {companyLoadWarning}
                    </div>
                )}

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {[
                        { label: '전체', value: summary.total, icon: faReceipt, className: 'text-slate-900' },
                        { label: '사용중', value: summary.active, icon: faCheckCircle, className: 'text-emerald-700' },
                        { label: '영업사원', value: summary.salespeople, icon: faUserTie, className: 'text-violet-700' },
                        { label: '관계자', value: summary.contacts, icon: faUsers, className: 'text-blue-700' },
                        { label: '기타', value: summary.others, icon: faBuilding, className: 'text-indigo-700' },
                    ].map((card) => (
                        <div key={card.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-400">{card.label}</span>
                                <FontAwesomeIcon icon={card.icon} className="text-slate-300" />
                            </div>
                            <div className={`mt-2 text-2xl font-black ${card.className}`}>{card.value.toLocaleString('ko-KR')}</div>
                        </div>
                    ))}
                </section>

                <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-xs text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="대상자명, 직책, 회사, 계좌, 메모 검색"
                                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <select
                                value={typeFilter}
                                onChange={(event) => setTypeFilter(event.target.value as 'all' | SettlementTargetType)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="all">전체 구분</option>
                                {TARGET_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as 'active' | 'all' | SettlementTargetStatus)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="active">사용중</option>
                                <option value="all">전체 상태</option>
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        {hideHeader && (
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                대상자 등록
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">대상자</th>
                                    <th className="px-4 py-3 text-left">구분</th>
                                    <th className="px-4 py-3 text-left">연결 발주사/회사</th>
                                    <th className="px-4 py-3 text-left">연락처</th>
                                    <th className="px-4 py-3 text-left">계좌</th>
                                    <th className="px-4 py-3 text-center">증빙</th>
                                    <th className="px-4 py-3 text-center">상태</th>
                                    <th className="px-4 py-3 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center font-bold text-slate-400">
                                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                            정산 대상자를 불러오고 있습니다.
                                        </td>
                                    </tr>
                                ) : filteredTargets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center font-bold text-slate-400">
                                            등록된 정산 대상자가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTargets.map((target) => {
                                        const isHighlighted = highlightedId && (target.id === highlightedId);
                                        const maskedAccountNumber = maskSettlementTargetAccountNumber(target.accountNumber);
                                        return (
                                            <tr key={target.id || target.name} className={isHighlighted ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="font-black text-slate-900">{target.name}</div>
                                                    {target.positionTitle && <div className="mt-1 text-xs font-bold text-violet-600">{target.positionTitle}</div>}
                                                    {target.memo && <div className="mt-1 max-w-[260px] truncate text-xs font-semibold text-slate-400">{target.memo}</div>}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                                                        {getSettlementTargetTypeLabel(target.targetType)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-middle text-slate-600">{target.companyName || '-'}</td>
                                                <td className="px-4 py-3 align-middle text-slate-600">{target.contact || '-'}</td>
                                                <td className="px-4 py-3 align-middle text-slate-600">
                                                    <div className="max-w-[220px] truncate" title={[target.bankName, maskedAccountNumber, target.accountHolder].map(toText).filter(Boolean).join(' ')}>
                                                        {[target.bankName, maskedAccountNumber, target.accountHolder].map(toText).filter(Boolean).join(' / ') || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center align-middle">
                                                    {target.evidenceRequired ? (
                                                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">필수</span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-400">선택</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center align-middle">
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${target.status === 'inactive' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {getStatusLabel(target.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditModal(target)}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                            title="수정"
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeactivate(target)}
                                                            disabled={target.status === 'inactive' || saving}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
                                                            title={target.status === 'inactive' ? '이미 사용 중지됨' : '사용 중지'}
                                                        >
                                                            <FontAwesomeIcon icon={faBan} />
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
                </section>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <form onSubmit={handleSave} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{currentTarget ? '정산 대상자 수정' : '정산 대상자 등록'}</h2>
                                <p className="mt-1 text-xs text-slate-500">바이백과 지원정산에서 선택할 영업사원·관계자·회사·직원 정보를 입력합니다.</p>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div className="max-h-[72vh] overflow-y-auto p-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">대상자명</span>
                                    <input
                                        value={formData.name}
                                        required
                                        onChange={(event) => handleInputChange('name', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="대상자명 입력"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">구분</span>
                                    <select
                                        value={formData.targetType}
                                        onChange={(event) => handleInputChange('targetType', event.target.value as SettlementTargetType)}
                                        className={`${selectClassName} mt-1`}
                                    >
                                        {!TARGET_TYPE_OPTIONS.some((option) => option.value === formData.targetType) && (
                                            <option value={formData.targetType} disabled>
                                                {getSettlementTargetTypeLabel(formData.targetType)} (기존 합성 대상)
                                            </option>
                                        )}
                                        {TARGET_TYPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">직책/직급</span>
                                    <input
                                        value={formData.positionTitle}
                                        onChange={(event) => handleInputChange('positionTitle', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="예: 영업팀장, 과장"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">기본 세후율 (%)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        required
                                        value={formData.defaultAfterTaxPercent}
                                        onChange={(event) => handleInputChange('defaultAfterTaxPercent', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="75"
                                    />
                                    <span className="mt-1 block text-[11px] font-semibold text-slate-400">75 입력 시 0.75로 저장됩니다.</span>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">상태</span>
                                    <select
                                        value={formData.status}
                                        onChange={(event) => handleInputChange('status', event.target.value as SettlementTargetStatus)}
                                        className={`${selectClassName} mt-1`}
                                    >
                                        {STATUS_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">연결 발주사/회사</span>
                                    <select
                                        value={formData.companyId}
                                        onChange={(event) => handleInputChange('companyId', event.target.value)}
                                        className={`${selectClassName} mt-1`}
                                    >
                                        <option value="">회사 선택 없음</option>
                                        {formData.companyId && !companyOptions.some((company) => company.id === formData.companyId) && (
                                            <option value={formData.companyId}>
                                                {currentTarget?.companyName || '기존 연결 회사'} (목록 조회 제한)
                                            </option>
                                        )}
                                        {companyOptions.map((company) => (
                                            <option key={company.id || company.name} value={company.id || ''}>
                                                {company.name} {company.type ? `(${company.type})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">연락처</span>
                                    <input
                                        value={formData.contact}
                                        onChange={(event) => handleInputChange('contact', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="010-0000-0000"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">은행</span>
                                    <input
                                        value={formData.bankName}
                                        onChange={(event) => handleInputChange('bankName', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="은행명"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">계좌번호</span>
                                    <input
                                        value={formData.accountNumber}
                                        onChange={(event) => handleInputChange('accountNumber', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="계좌번호"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-black text-slate-500">예금주</span>
                                    <input
                                        value={formData.accountHolder}
                                        onChange={(event) => handleInputChange('accountHolder', event.target.value)}
                                        className={`${inputClassName} mt-1`}
                                        placeholder="예금주"
                                    />
                                </label>
                                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.buybackEnabled}
                                        onChange={(event) => handleInputChange('buybackEnabled', event.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700">바이백 관계자로 사용</span>
                                </label>
                                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.evidenceRequired}
                                        onChange={(event) => handleInputChange('evidenceRequired', event.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700">배분 시 증빙 필수</span>
                                </label>
                                <label className="block md:col-span-2">
                                    <span className="text-xs font-black text-slate-500">메모</span>
                                    <textarea
                                        value={formData.memo}
                                        rows={3}
                                        onChange={(event) => handleInputChange('memo', event.target.value)}
                                        className={`${inputClassName} mt-1 min-h-[90px] resize-y`}
                                        placeholder="거래/지급 기준, 주의사항 등"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                <FontAwesomeIcon icon={saving ? faSpinner : faCheckCircle} spin={saving} className="mr-2" />
                                저장
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default SettlementTargetDatabase;
