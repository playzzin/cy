import React, { useState, useEffect } from 'react';
import { Vehicle, VehicleType, VehicleContract, VehicleInsurance } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import Swal from 'sweetalert2';

interface VehicleFormProps {
    initialData?: Vehicle | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const VehicleForm: React.FC<VehicleFormProps> = ({ initialData, onClose, onSuccess }) => {
    // Default Empty State
    const [formData, setFormData] = useState<Partial<Vehicle>>({
        type: 'RENT',
        status: 'AVAILABLE',
        model: '',
        licensePlate: '',
        contract: {
            type: 'RENT',
            startDate: '',
            endDate: '',
            deposit: 0,
            monthlyFee: 0,
            paymentDay: 1,
            financeCompany: { name: '', contact: '' }
        },
        insurance: {
            company: '',
            policyNumber: '',
            contact: '',
            expiryDate: '',
            ageLimit: 'Any'
        }
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!formData.licensePlate || !formData.model) {
                Swal.fire('Error', '차량번호와 차종은 필수입니다.', 'error');
                return;
            }

            if (initialData?.id) {
                await vehicleService.updateVehicle(initialData.id, formData);
                Swal.fire('수정 완료', '차량 정보가 수정되었습니다.', 'success');
            } else {
                await vehicleService.createVehicle(formData as any); // Type assertion needed for strict checks
                Swal.fire('등록 완료', '새 차량이 등록되었습니다.', 'success');
            }
            onSuccess();
        } catch (error) {
            Swal.fire('Error', '저장 중 오류가 발생했습니다.', 'error');
        }
    };

    // Helper to update nested state
    const updateContract = (field: keyof VehicleContract, value: any) => {
        setFormData(prev => ({
            ...prev,
            contract: { ...prev.contract!, [field]: value }
        }));
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
                                    value={formData.licensePlate}
                                    onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">차종</label>
                                <input
                                    className="border p-2 w-full rounded"
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">유형</label>
                                <select
                                    className="border p-2 w-full rounded"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as VehicleType })}
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
                                        <input type="date" className="border p-2 w-full rounded"
                                            value={formData.contract?.startDate}
                                            onChange={e => updateContract('startDate', e.target.value)}
                                        />
                                        <span className="self-center">~</span>
                                        <input type="date" className="border p-2 w-full rounded"
                                            value={formData.contract?.endDate}
                                            onChange={e => updateContract('endDate', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm mb-1">월 이용료(VAT포함)</label>
                                        <input type="number" className="border p-2 w-full rounded"
                                            value={formData.contract?.monthlyFee}
                                            onChange={e => updateContract('monthlyFee', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">결제일 (매월)</label>
                                        <input type="number" className="border p-2 w-full rounded" max={31} min={1}
                                            value={formData.contract?.paymentDay}
                                            onChange={e => updateContract('paymentDay', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">금융사(렌트사) 정보</label>
                                <div className="flex gap-2">
                                    <input placeholder="금융사명" className="border p-2 w-1/2 rounded"
                                        value={formData.contract?.financeCompany.name}
                                        onChange={e => {
                                            const newVal = { ...formData.contract!.financeCompany, name: e.target.value };
                                            updateContract('financeCompany', newVal);
                                        }}
                                    />
                                    <input placeholder="고객센터 연락처" className="border p-2 w-1/2 rounded"
                                        value={formData.contract?.financeCompany.contact}
                                        onChange={e => {
                                            const newVal = { ...formData.contract!.financeCompany, contact: e.target.value };
                                            updateContract('financeCompany', newVal);
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
