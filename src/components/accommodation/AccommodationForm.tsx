import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faSave, faTimes, faWonSign, faBolt, faFire, faTint, faWifi, faBroom, faBuilding, faMapMarkerAlt, faFileContract, faPlus } from '@fortawesome/free-solid-svg-icons';
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
    isReported: false,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    rentPayDate: 1
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

                <div className="w-28 text-right pl-4">
                    {value === 'fixed' ? (
                        <div className="relative group/input">
                            <input
                                type="number"
                                value={fixedValue || ''}
                                onChange={(e) => onFixedChange(Number(e.target.value))}
                                className="w-full text-right p-1.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                placeholder="금액"
                            />
                            <span className="absolute right-2 top-1.5 text-xs text-slate-400 pointer-events-none">₩</span>
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

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-10 fade-in">
            <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-900/20 w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all scale-100">
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
                                                onChange={(e) => setType(e.target.value as Accommodation['type'])}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none font-medium text-slate-700"
                                            >
                                                <option value="OneRoom">원룸</option>
                                                <option value="TwoRoom">투룸</option>
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
                                                    type="number"
                                                    value={contract.deposit}
                                                    onChange={(e) => setContract({ ...contract, deposit: Number(e.target.value) })}
                                                    className="w-full p-2.5 pr-8 bg-white border border-slate-200 rounded-xl text-right font-mono text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                                                />
                                                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₩</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">월세 (기본)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={contract.monthlyRent}
                                                    onChange={(e) => setContract({ ...contract, monthlyRent: Number(e.target.value) })}
                                                    className="w-full p-2.5 pr-8 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-right font-mono font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                                                />
                                                <span className="absolute right-3 top-2.5 text-indigo-300 text-sm">₩</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">계약 시작일</label>
                                            <input
                                                type="date"
                                                value={contract.startDate}
                                                onChange={(e) => setContract({ ...contract, startDate: e.target.value })}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">계약 종료일</label>
                                            <input
                                                type="date"
                                                value={contract.endDate}
                                                onChange={(e) => setContract({ ...contract, endDate: e.target.value })}
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
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                placeholder="은행명"
                                                value={contract.bankName || ''}
                                                onChange={(e) => setContract({ ...contract, bankName: e.target.value })}
                                                className="p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="예금주"
                                                value={contract.accountHolder || ''}
                                                onChange={(e) => setContract({ ...contract, accountHolder: e.target.value })}
                                                className="p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="계좌번호"
                                                value={contract.accountNumber || ''}
                                                onChange={(e) => setContract({ ...contract, accountNumber: e.target.value })}
                                                className="p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none col-span-3 lg:col-span-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-slate-500 ml-1">월세 납부일</label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-600">매월</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={contract.rentPayDate || 1}
                                                    onChange={(e) => setContract({ ...contract, rentPayDate: Number(e.target.value) })}
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
