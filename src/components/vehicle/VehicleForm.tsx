import React, { useEffect, useState } from 'react';
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
    contract: { ...DEFAULT_CONTRACT, financeCompany: { ...DEFAULT_FINANCE_COMPANY }, bankAccount: { ...DEFAULT_BANK_ACCOUNT } },
    insurance: { ...DEFAULT_INSURANCE }
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
        memo: formData.memo
    };
};

export const VehicleForm: React.FC<VehicleFormProps> = ({ initialData, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<Partial<Vehicle>>(() => buildFormData(initialData));

    useEffect(() => {
        setFormData(buildFormData(initialData));
    }, [initialData]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = buildSubmitPayload(formData);
            if (!payload.licensePlate || !payload.model) {
                Swal.fire('오류', '차량번호와 차종은 필수입니다.', 'error');
                return;
            }

            if (initialData?.id) {
                await vehicleService.updateVehicle(initialData.id, payload);
                Swal.fire('수정 완료', '차량 정보가 수정되었습니다.', 'success');
            } else {
                await vehicleService.createVehicle(payload);
                Swal.fire('등록 완료', '새 차량이 등록되었습니다.', 'success');
            }
            onSuccess();
        } catch (error) {
            Swal.fire('오류', '저장 중 오류가 발생했습니다.', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[800px] max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">{initialData ? '차량 정보 수정' : '신규 차량 등록'}</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gray-50 p-4 rounded">
                        <h3 className="font-semibold mb-2">기본 정보</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1">차량번호</label>
                                <input
                                    className="border p-2 w-full rounded"
                                    value={formData.licensePlate ?? ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, licensePlate: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">차종</label>
                                <input
                                    className="border p-2 w-full rounded"
                                    value={formData.model ?? ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">유형</label>
                                <select
                                    className="border p-2 w-full rounded"
                                    value={formData.type ?? 'RENT'}
                                    onChange={(e) => {
                                        const type = normalizeVehicleType(e.target.value);
                                        setFormData((prev) => ({
                                            ...prev,
                                            type,
                                            contract: normalizeContract(prev.contract, type)
                                        }));
                                    }}
                                >
                                    <option value="RENT">렌트 (장기)</option>
                                    <option value="LEASE">리스</option>
                                    <option value="OWNED">법인 소유 (완납)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Contract Info (Show only if not OWNED) */}
                    {formData.type !== 'OWNED' && (
                        <div className="bg-blue-50 p-4 rounded">
                            <h3 className="font-semibold mb-2 text-blue-800">계약 정보</h3>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <div>
                                    <label className="block text-sm mb-1">계약 기간</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={10}
                                            placeholder="YYYY-MM-DD"
                                            className="border p-2 w-full rounded"
                                            value={formData.contract?.startDate ?? ''}
                                            onChange={(e) => updateContractDate('startDate', e.target.value)}
                                            onBlur={() => normalizeContractDate('startDate')}
                                        />
                                        <span className="self-center">~</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={10}
                                            placeholder="YYYY-MM-DD"
                                            className="border p-2 w-full rounded"
                                            value={formData.contract?.endDate ?? ''}
                                            onChange={(e) => updateContractDate('endDate', e.target.value)}
                                            onBlur={() => normalizeContractDate('endDate')}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-sm mb-1">월 이용료(VAT포함)</label>
                                        <input
                                            type="number"
                                            className="border p-2 w-full rounded"
                                            value={formData.contract?.monthlyFee ?? 0}
                                            onChange={(e) => updateContract('monthlyFee', toFiniteNumber(e.target.value, 0))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">보증금</label>
                                        <input
                                            type="number"
                                            className="border p-2 w-full rounded"
                                            value={formData.contract?.deposit ?? 0}
                                            onChange={(e) => updateContract('deposit', toFiniteNumber(e.target.value, 0))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">결제일 (매월)</label>
                                        <input
                                            type="number"
                                            className="border p-2 w-full rounded"
                                            max={31}
                                            min={1}
                                            value={formData.contract?.paymentDay ?? 1}
                                            onChange={(e) => updateContract('paymentDay', normalizeDay(e.target.value, formData.contract?.paymentDay ?? 1))}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">금융사(렌트사) 정보</label>
                                <div className="flex gap-2">
                                    <input
                                        placeholder="금융사명"
                                        className="border p-2 w-1/2 rounded"
                                        value={formData.contract?.financeCompany?.name ?? ''}
                                        onChange={(e) => {
                                            const nextFinanceCompany = {
                                                ...(formData.contract?.financeCompany ?? DEFAULT_FINANCE_COMPANY),
                                                name: e.target.value
                                            };
                                            updateContract('financeCompany', nextFinanceCompany);
                                        }}
                                    />
                                    <input
                                        placeholder="고객센터 연락처"
                                        className="border p-2 w-1/2 rounded"
                                        value={formData.contract?.financeCompany?.contact ?? ''}
                                        onChange={(e) => {
                                            const nextFinanceCompany = {
                                                ...(formData.contract?.financeCompany ?? DEFAULT_FINANCE_COMPANY),
                                                contact: e.target.value
                                            };
                                            updateContract('financeCompany', nextFinanceCompany);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">
                            취소
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            저장하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
