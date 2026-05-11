import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuildingColumns,
    faCalendarDays,
    faCar,
    faFileContract,
    faFloppyDisk,
    faShieldHalved,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import { Vehicle, VehicleType, VehicleContract, VehicleInsurance } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import Swal from 'sweetalert2';
import { formatTypedDateInput, normalizeTypedDateInput } from '../../utils/typedDateInput';

interface VehicleFormProps {
    initialData?: Vehicle | null;
    onClose: () => void;
    onSuccess: () => void;
}

const DEFAULT_FINANCE_COMPANY: VehicleContract['financeCompany'] = {
    name: '',
    contact: ''
};

const DEFAULT_BANK_ACCOUNT: NonNullable<VehicleContract['bankAccount']> = {
    bankName: '',
    accountNumber: '',
    accountHolder: ''
};

const DEFAULT_CONTRACT: VehicleContract = {
    type: 'RENT',
    startDate: '',
    endDate: '',
    deposit: 0,
    monthlyFee: 0,
    paymentDay: 1,
    financeCompany: { ...DEFAULT_FINANCE_COMPANY },
    bankAccount: { ...DEFAULT_BANK_ACCOUNT }
};

const DEFAULT_INSURANCE: VehicleInsurance = {
    company: '',
    policyNumber: '',
    contact: '',
    expiryDate: '',
    ageLimit: 'Any'
};

const DEFAULT_FORM_DATA: Partial<Vehicle> = {
    type: 'RENT',
    status: 'AVAILABLE',
    model: '',
    licensePlate: '',
    memo: '',
    contract: { ...DEFAULT_CONTRACT, financeCompany: { ...DEFAULT_FINANCE_COMPANY }, bankAccount: { ...DEFAULT_BANK_ACCOUNT } },
    insurance: { ...DEFAULT_INSURANCE }
};

const vehicleTypes: Array<{ value: VehicleType; label: string; helper: string }> = [
    { value: 'RENT', label: '렌트', helper: '월 렌트료 관리' },
    { value: 'LEASE', label: '리스', helper: '리스료와 계약 관리' },
    { value: 'OWNED', label: '자가', helper: '완납/소유 차량' }
];

const statusOptions: Array<{ value: Vehicle['status']; label: string }> = [
    { value: 'AVAILABLE', label: '대기' },
    { value: 'ASSIGNED', label: '운행중' },
    { value: 'MAINTENANCE', label: '정비중' },
    { value: 'DISPOSED', label: '종료' }
];

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

const normalizeDay = (value: unknown, fallback = 1): number => {
    const parsed = Math.floor(toFiniteNumber(value, fallback));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(31, parsed));
};

const normalizeVehicleType = (value: unknown): VehicleType => {
    const type = String(value ?? '').trim().toUpperCase();
    if (type === 'RENT' || type === 'LEASE' || type === 'OWNED') return type as VehicleType;
    return 'RENT';
};

const normalizeContract = (value: Partial<VehicleContract> | undefined, fallbackType: VehicleType): VehicleContract => {
    const source = (value ?? {}) as Partial<VehicleContract>;
    const financeCompany = (source.financeCompany ?? {}) as Partial<VehicleContract['financeCompany']>;
    const bankAccount = (source.bankAccount ?? {}) as Partial<NonNullable<VehicleContract['bankAccount']>>;

    return {
        ...DEFAULT_CONTRACT,
        ...source,
        type: fallbackType,
        startDate: source.startDate ? String(source.startDate) : '',
        endDate: source.endDate ? String(source.endDate) : '',
        deposit: toFiniteNumber(source.deposit, DEFAULT_CONTRACT.deposit),
        monthlyFee: toFiniteNumber(source.monthlyFee, DEFAULT_CONTRACT.monthlyFee),
        paymentDay: normalizeDay(source.paymentDay, DEFAULT_CONTRACT.paymentDay),
        financeCompany: {
            ...DEFAULT_FINANCE_COMPANY,
            name: financeCompany?.name ? String(financeCompany.name) : '',
            contact: financeCompany?.contact ? String(financeCompany.contact) : ''
        },
        bankAccount: {
            ...DEFAULT_BANK_ACCOUNT,
            bankName: bankAccount?.bankName ? String(bankAccount.bankName) : '',
            accountNumber: bankAccount?.accountNumber ? String(bankAccount.accountNumber) : '',
            accountHolder: bankAccount?.accountHolder ? String(bankAccount.accountHolder) : ''
        }
    };
};

const normalizeInsurance = (value: VehicleInsurance | undefined): VehicleInsurance => {
    const source = value ?? DEFAULT_INSURANCE;
    return {
        company: source.company ? String(source.company) : '',
        policyNumber: source.policyNumber ? String(source.policyNumber) : '',
        contact: source.contact ? String(source.contact) : '',
        expiryDate: source.expiryDate ? String(source.expiryDate) : '',
        ageLimit: source.ageLimit ? String(source.ageLimit) : 'Any'
    };
};

const buildFormData = (initialData?: Vehicle | null): Partial<Vehicle> => {
    if (!initialData) {
        return {
            ...DEFAULT_FORM_DATA,
            contract: normalizeContract(DEFAULT_FORM_DATA.contract as VehicleContract, normalizeVehicleType(DEFAULT_FORM_DATA.type)),
            insurance: normalizeInsurance(DEFAULT_FORM_DATA.insurance)
        };
    }

    const type = normalizeVehicleType(initialData.type ?? DEFAULT_FORM_DATA.type);
    return {
        ...DEFAULT_FORM_DATA,
        ...initialData,
        type,
        status: initialData.status ?? DEFAULT_FORM_DATA.status,
        model: initialData.model ?? '',
        licensePlate: initialData.licensePlate ?? '',
        memo: initialData.memo ?? '',
        contract: normalizeContract(initialData.contract, type),
        insurance: normalizeInsurance(initialData.insurance)
    };
};

const buildSubmitPayload = (formData: Partial<Vehicle>): Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> => {
    const type = normalizeVehicleType(formData.type ?? DEFAULT_FORM_DATA.type);
    const contract = normalizeContract(formData.contract, type);

    if (type === 'OWNED') {
        contract.deposit = 0;
        contract.monthlyFee = 0;
    }

    return {
        licensePlate: String(formData.licensePlate ?? '').trim(),
        model: String(formData.model ?? '').trim(),
        type,
        status: (formData.status ?? 'AVAILABLE') as Vehicle['status'],
        contract,
        insurance: normalizeInsurance(formData.insurance),
        currentAssigneeId: formData.currentAssigneeId,
        currentAssigneeType: formData.currentAssigneeType,
        currentAssigneeName: formData.currentAssigneeName,
        billingTargetId: formData.billingTargetId,
        billingTargetType: formData.billingTargetType,
        billingTargetName: formData.billingTargetName,
        memo: String(formData.memo ?? '').trim() || undefined
    };
};

const fieldClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400';
const labelClassName = 'mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500';
const sectionClassName = 'rounded-2xl border border-slate-200 bg-slate-50/70 p-4';

export const VehicleForm: React.FC<VehicleFormProps> = ({ initialData, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<Partial<Vehicle>>(() => buildFormData(initialData));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setFormData(buildFormData(initialData));
    }, [initialData]);

    const isOwnedVehicle = formData.type === 'OWNED';
    const modalTitle = initialData ? '차량 정보 수정' : '신규 차량 등록';

    const monthlyFeeText = useMemo(() => {
        if (isOwnedVehicle) return '자가 차량';
        return `${Number(formData.contract?.monthlyFee ?? 0).toLocaleString('ko-KR')}원`;
    }, [formData.contract?.monthlyFee, isOwnedVehicle]);

    const updateContract = (field: keyof VehicleContract, value: unknown) => {
        setFormData((prev) => {
            const type = normalizeVehicleType(prev.type ?? DEFAULT_FORM_DATA.type);
            const nextContract = normalizeContract(prev.contract, type);
            return {
                ...prev,
                contract: normalizeContract(
                    {
                        ...nextContract,
                        [field]: value
                    },
                    type
                )
            };
        });
    };

    const updateFinanceCompany = (field: keyof VehicleContract['financeCompany'], value: string) => {
        const current = formData.contract?.financeCompany ?? DEFAULT_FINANCE_COMPANY;
        updateContract('financeCompany', { ...current, [field]: value });
    };

    const updateBankAccount = (field: keyof NonNullable<VehicleContract['bankAccount']>, value: string) => {
        const current = formData.contract?.bankAccount ?? DEFAULT_BANK_ACCOUNT;
        updateContract('bankAccount', { ...current, [field]: value });
    };

    const updateInsurance = (field: keyof VehicleInsurance, value: string) => {
        setFormData((prev) => ({
            ...prev,
            insurance: {
                ...normalizeInsurance(prev.insurance),
                [field]: value
            }
        }));
    };

    const updateContractDate = (field: 'startDate' | 'endDate', value: string) => {
        updateContract(field, formatTypedDateInput(value));
    };

    const normalizeContractDate = (field: 'startDate' | 'endDate') => {
        const currentValue = String(formData.contract?.[field] ?? '');
        const normalized = normalizeTypedDateInput(currentValue);
        if (normalized) {
            updateContract(field, normalized);
        }
    };

    const updateInsuranceDate = (value: string) => {
        updateInsurance('expiryDate', formatTypedDateInput(value));
    };

    const normalizeInsuranceDate = () => {
        const normalized = normalizeTypedDateInput(String(formData.insurance?.expiryDate ?? ''));
        if (normalized) updateInsurance('expiryDate', normalized);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;

        try {
            const payload = buildSubmitPayload(formData);
            if (!payload.licensePlate || !payload.model) {
                await Swal.fire('오류', '차량번호와 차종은 필수입니다.', 'error');
                return;
            }

            setSaving(true);
            if (initialData?.id) {
                await vehicleService.updateVehicle(initialData.id, payload);
                await Swal.fire('수정 완료', '차량 정보가 수정되었습니다.', 'success');
            } else {
                await vehicleService.createVehicle(payload);
                await Swal.fire('등록 완료', '새 차량이 등록되었습니다.', 'success');
            }
            onSuccess();
        } catch (error) {
            console.error(error);
            await Swal.fire('오류', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                            <FontAwesomeIcon icon={faCar} />
                        </div>
                        <div>
                            <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Vehicle Master</div>
                            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{modalTitle}</h2>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{formData.licensePlate || '차량번호 미입력'}</span>
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{monthlyFeeText}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                        title="닫기"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        <section className={sectionClassName}>
                            <div className="mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCar} className="text-slate-500" />
                                <h3 className="text-base font-black text-slate-900">기본 정보</h3>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <label className={labelClassName}>차량번호</label>
                                    <input
                                        className={fieldClassName}
                                        placeholder="예: 12가 3456"
                                        value={formData.licensePlate ?? ''}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, licensePlate: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClassName}>차종</label>
                                    <input
                                        className={fieldClassName}
                                        placeholder="예: 카니발"
                                        value={formData.model ?? ''}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClassName}>상태</label>
                                    <select
                                        className={fieldClassName}
                                        value={formData.status ?? 'AVAILABLE'}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Vehicle['status'] }))}
                                    >
                                        {statusOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClassName}>유형</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {vehicleTypes.map((type) => {
                                            const selected = formData.type === type.value;
                                            return (
                                                <button
                                                    key={type.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const nextType = normalizeVehicleType(type.value);
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            type: nextType,
                                                            contract: normalizeContract(prev.contract, nextType)
                                                        }));
                                                    }}
                                                    className={`rounded-xl border px-3 py-2 text-left transition ${
                                                        selected
                                                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="text-sm font-extrabold">{type.label}</div>
                                                    <div className={`mt-0.5 text-[10px] font-bold ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{type.helper}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className={sectionClassName}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <FontAwesomeIcon icon={faFileContract} className="text-slate-500" />
                                    <h3 className="text-base font-black text-slate-900">계약 및 결제</h3>
                                </div>
                                {isOwnedVehicle && (
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">자가 차량은 고정 사용료 0원 저장</span>
                                )}
                            </div>

                            {!isOwnedVehicle ? (
                                <div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div>
                                            <label className={labelClassName}>계약 시작일</label>
                                            <div className="relative">
                                                <FontAwesomeIcon icon={faCalendarDays} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={10}
                                                    placeholder="YYYY-MM-DD"
                                                    className={`${fieldClassName} pl-9`}
                                                    value={formData.contract?.startDate ?? ''}
                                                    onChange={(e) => updateContractDate('startDate', e.target.value)}
                                                    onBlur={() => normalizeContractDate('startDate')}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClassName}>계약 만료일</label>
                                            <div className="relative">
                                                <FontAwesomeIcon icon={faCalendarDays} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={10}
                                                    placeholder="YYYY-MM-DD"
                                                    className={`${fieldClassName} pl-9`}
                                                    value={formData.contract?.endDate ?? ''}
                                                    onChange={(e) => updateContractDate('endDate', e.target.value)}
                                                    onBlur={() => normalizeContractDate('endDate')}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClassName}>월 이용료</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={fieldClassName}
                                                value={formData.contract?.monthlyFee ?? 0}
                                                onChange={(e) => updateContract('monthlyFee', toFiniteNumber(e.target.value, 0))}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClassName}>결제일</label>
                                            <input
                                                type="number"
                                                className={fieldClassName}
                                                max={31}
                                                min={1}
                                                value={formData.contract?.paymentDay ?? 1}
                                                onChange={(e) => updateContract('paymentDay', normalizeDay(e.target.value, formData.contract?.paymentDay ?? 1))}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div>
                                            <label className={labelClassName}>보증금</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={fieldClassName}
                                                value={formData.contract?.deposit ?? 0}
                                                onChange={(e) => updateContract('deposit', toFiniteNumber(e.target.value, 0))}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClassName}>금융사/렌트사</label>
                                            <input
                                                placeholder="금융사명"
                                                className={fieldClassName}
                                                value={formData.contract?.financeCompany?.name ?? ''}
                                                onChange={(e) => updateFinanceCompany('name', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClassName}>고객센터</label>
                                            <input
                                                placeholder="연락처"
                                                className={fieldClassName}
                                                value={formData.contract?.financeCompany?.contact ?? ''}
                                                onChange={(e) => updateFinanceCompany('contact', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClassName}>계좌 예금주</label>
                                            <input
                                                placeholder="예금주"
                                                className={fieldClassName}
                                                value={formData.contract?.bankAccount?.accountHolder ?? ''}
                                                onChange={(e) => updateBankAccount('accountHolder', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className={labelClassName}>은행명</label>
                                            <div className="relative">
                                                <FontAwesomeIcon icon={faBuildingColumns} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    placeholder="은행"
                                                    className={`${fieldClassName} pl-9`}
                                                    value={formData.contract?.bankAccount?.bankName ?? ''}
                                                    onChange={(e) => updateBankAccount('bankName', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClassName}>계좌번호</label>
                                            <input
                                                placeholder="계좌번호"
                                                className={fieldClassName}
                                                value={formData.contract?.bankAccount?.accountNumber ?? ''}
                                                onChange={(e) => updateBankAccount('accountNumber', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-emerald-100 bg-white px-4 py-5 text-sm font-bold text-emerald-700">
                                    렌트/리스 계약 입력은 생략됩니다. 차량 번호, 차종, 보험 정보와 관리 메모만 저장하세요.
                                </div>
                            )}
                        </section>

                        <section className={sectionClassName}>
                            <div className="mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faShieldHalved} className="text-slate-500" />
                                <h3 className="text-base font-black text-slate-900">보험 및 메모</h3>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <label className={labelClassName}>보험사</label>
                                    <input
                                        className={fieldClassName}
                                        value={formData.insurance?.company ?? ''}
                                        onChange={(e) => updateInsurance('company', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelClassName}>증권번호</label>
                                    <input
                                        className={fieldClassName}
                                        value={formData.insurance?.policyNumber ?? ''}
                                        onChange={(e) => updateInsurance('policyNumber', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelClassName}>보험 연락처</label>
                                    <input
                                        className={fieldClassName}
                                        value={formData.insurance?.contact ?? ''}
                                        onChange={(e) => updateInsurance('contact', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelClassName}>보험 만료일</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="YYYY-MM-DD"
                                        className={fieldClassName}
                                        value={formData.insurance?.expiryDate ?? ''}
                                        onChange={(e) => updateInsuranceDate(e.target.value)}
                                        onBlur={normalizeInsuranceDate}
                                    />
                                </div>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                                <div>
                                    <label className={labelClassName}>운전자 연령</label>
                                    <input
                                        placeholder="Any, 26+"
                                        className={fieldClassName}
                                        value={formData.insurance?.ageLimit ?? ''}
                                        onChange={(e) => updateInsurance('ageLimit', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelClassName}>관리 메모</label>
                                    <textarea
                                        rows={3}
                                        className={`${fieldClassName} resize-none`}
                                        placeholder="정비 이력, 특이사항, 내부 참고사항"
                                        value={formData.memo ?? ''}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                        >
                            <FontAwesomeIcon icon={faFloppyDisk} />
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
