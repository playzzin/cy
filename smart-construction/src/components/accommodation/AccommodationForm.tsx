import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faSave, faTimes, faWonSign, faBolt, faFire, faTint, faWifi, faBroom } from '@fortawesome/free-solid-svg-icons';
import { Accommodation, CostProfile, Contract } from '../../types/accommodation';

type CostMode = 'variable' | 'fixed' | 'included';

interface AccommodationFormProps {
    initialData?: Accommodation;
    onSubmit: (data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onCancel: () => void;
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
    isReported: false
};

const AccommodationForm: React.FC<AccommodationFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [address, setAddress] = useState(initialData?.address || '');
    const [type, setType] = useState<Accommodation['type']>(initialData?.type || 'OneRoom');
    const [status, setStatus] = useState<Accommodation['status']>(initialData?.status || 'active');

    // Contract State
    const [contract, setContract] = useState<Contract>(initialData?.contract || DEFAULT_CONTRACT);

    // Cost Profile State
    const [costProfile, setCostProfile] = useState<CostProfile>(initialData?.costProfile || DEFAULT_COST_PROFILE);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            name,
            address,
            type,
            status,
            contract,
            costProfile
        });
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
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 w-32">
                    <FontAwesomeIcon icon={icon} className="text-slate-400 w-5" />
                    <span className="font-medium text-slate-700">{label}</span>
                </div>
                <div className="flex bg-white rounded border border-slate-300 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => onChange('variable')}
                        className={`px-3 py-1 text-sm ${value === 'variable' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        변동
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange('fixed')}
                        className={`px-3 py-1 text-sm ${value === 'fixed' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        고정
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange('included')}
                        className={`px-3 py-1 text-sm ${value === 'included' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        포함
                    </button>
                </div>
                <div className="w-32 text-right">
                    {value === 'fixed' ? (
                        <div className="relative">
                            <input
                                type="number"
                                value={fixedValue || ''}
                                onChange={(e) => onFixedChange(Number(e.target.value))}
                                className="w-full text-right p-1 border border-slate-300 rounded font-mono text-sm"
                                placeholder="금액"
                            />
                            <span className="absolute right-8 top-1.5 text-xs text-slate-400 pointer-events-none">₩</span>
                        </div>
                    ) : value === 'included' ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">월세에 포함</span>
                    ) : (
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">매월 입력</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800">
                            {initialData ? '숙소 정보 수정' : '새 숙소 등록'}
                        </h2>
                        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                            <FontAwesomeIcon icon={faTimes} className="text-xl" />
                        </button>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Basic Info & Contract */}
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">기본 정보</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">숙소명 (호수)</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="예: 사동 502호"
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">주소</label>
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="상세 주소 입력"
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">유형</label>
                                            <select
                                                value={type}
                                                onChange={(e) => setType(e.target.value as Accommodation['type'])}
                                                className="w-full p-2 border border-slate-300 rounded-lg"
                                            >
                                                <option value="OneRoom">원룸</option>
                                                <option value="TwoRoom">투룸</option>
                                                <option value="Apartment">아파트</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                                            <select
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value as Accommodation['status'])}
                                                className="w-full p-2 border border-slate-300 rounded-lg"
                                            >
                                                <option value="active">계약중 (Active)</option>
                                                <option value="inactive">종료 (Inactive)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 mt-6">계약 정보 (Contract)</h3>
                                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">보증금</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={contract.deposit}
                                                    onChange={(e) => setContract({ ...contract, deposit: Number(e.target.value) })}
                                                    className="w-full p-2 pl-2 pr-8 border border-slate-300 rounded text-right font-mono"
                                                />
                                                <span className="absolute right-3 top-2 text-slate-400 text-sm">원</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">월세 (기본)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={contract.monthlyRent}
                                                    onChange={(e) => setContract({ ...contract, monthlyRent: Number(e.target.value) })}
                                                    className="w-full p-2 pl-2 pr-8 border border-slate-300 rounded text-right font-bold text-indigo-600 font-mono"
                                                />
                                                <span className="absolute right-3 top-2 text-slate-400 text-sm">원</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">계약 시작일</label>
                                            <input
                                                type="date"
                                                value={contract.startDate}
                                                onChange={(e) => setContract({ ...contract, startDate: e.target.value })}
                                                className="w-full p-2 border border-slate-300 rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">계약 종료일</label>
                                            <input
                                                type="date"
                                                value={contract.endDate}
                                                onChange={(e) => setContract({ ...contract, endDate: e.target.value })}
                                                className="w-full p-2 border border-slate-300 rounded"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            type="checkbox"
                                            id="isReported"
                                            checked={contract.isReported}
                                            onChange={(e) => setContract({ ...contract, isReported: e.target.checked })}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="isReported" className="text-sm text-slate-700">임대차계약 신고 완료</label>
                                    </div>

                                    <div className="pt-2 border-t border-slate-200 mt-2">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">임대인 정보</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="임대인 성함"
                                                value={contract.landlordName}
                                                onChange={(e) => setContract({ ...contract, landlordName: e.target.value })}
                                                className="flex-1 p-2 border border-slate-300 rounded text-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="연락처"
                                                value={contract.landlordContact}
                                                onChange={(e) => setContract({ ...contract, landlordContact: e.target.value })}
                                                className="flex-1 p-2 border border-slate-300 rounded text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Cost Profile (Smart Config) */}
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faBolt} className="text-yellow-500" />
                                공과금 프로필 설정 (Smart Config)
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                * 매월 자동으로 입력될 기본값을 설정합니다. <br />
                                * '변동'으로 설정 시 매월 대장에서 직접 입력해야 합니다.
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
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 font-medium rounded-lg transition"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg shadow-sm transition flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            {initialData ? '저장하기' : '등록하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccommodationForm;
