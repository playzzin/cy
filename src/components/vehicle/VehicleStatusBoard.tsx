import React, { useMemo } from 'react';
import { Vehicle } from '../../types/vehicle';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCar, faGasPump, faWrench, faCheckCircle, faClock,
    faWonSign, faExclamationTriangle, faCalendarAlt, faUser, faUsers
} from '@fortawesome/free-solid-svg-icons';

interface VehicleStatusBoardProps {
    vehicles: Vehicle[];
    loading: boolean;
    onEdit: (vehicle: Vehicle) => void;
    onManageExpenses: (vehicle: Vehicle) => void;
    onAssign: (vehicle: Vehicle) => void;
}

export const VehicleStatusBoard: React.FC<VehicleStatusBoardProps> = ({
    vehicles,
    loading,
    onEdit,
    onManageExpenses,
    onAssign
}) => {
    // 1. Statistics Calculation
    const stats = useMemo(() => {
        const total = vehicles.length;
        const operating = vehicles.filter(v => v.status === 'ASSIGNED').length;
        const available = vehicles.filter(v => v.status === 'AVAILABLE').length;
        const maintenance = vehicles.filter(v => v.status === 'MAINTENANCE').length;

        const totalMonthlyCost = vehicles.reduce((sum, v) => sum + (v.contract?.monthlyFee || 0), 0);

        return { total, operating, available, maintenance, totalMonthlyCost };
    }, [vehicles]);

    // 2. Alert Logic (Contracts expiring soon, etc.)
    const expiringVehicles = useMemo(() => {
        const today = new Date();
        return vehicles.filter(v => {
            if (!v.contract?.endDate) return false;
            const endDate = new Date(v.contract.endDate);
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 30; // Expiring in 30 days
        });
    }, [vehicles]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ASSIGNED':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        운행중
                    </span>
                );
            case 'AVAILABLE':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        대기중
                    </span>
                );
            case 'MAINTENANCE':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                        정비중
                    </span>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (vehicles.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <FontAwesomeIcon icon={faCar} className="text-4xl" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">등록된 법인차량이 없습니다</h3>
                <p className="text-slate-400 mb-6">새로운 차량을 등록하여 관리를 시작해보세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Alerts Section */}
            {expiringVehicles.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="animate-swing" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-amber-800 text-sm mb-1">계약 만료 예정 차량이 {expiringVehicles.length}대 있습니다</h3>
                        <div className="flex flex-wrap gap-2">
                            {expiringVehicles.map(v => (
                                <span key={v.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-bold text-amber-700 shadow-sm">
                                    <FontAwesomeIcon icon={faCar} className="text-amber-400" />
                                    {v.licensePlate} ({v.contract?.endDate})
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {/* Total Stats */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">총 보유 차량</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.total}</h3>
                            <span className="text-sm font-bold text-slate-400">대</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faCar} className="text-slate-400" /> 전체 법인차량
                        </div>
                    </div>
                </div>

                {/* Operating Stats */}
                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-2">운행 중</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.operating}</h3>
                            <span className="text-sm font-bold text-slate-400">대</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faCheckCircle} /> 가동률 {Math.round((stats.operating / stats.total) * 100)}%
                        </div>
                    </div>
                </div>

                {/* Cost Stats */}
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-2">총 월 고정비용</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.totalMonthlyCost.toLocaleString()}</h3>
                            <span className="text-sm font-bold text-slate-400">원</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faWonSign} /> 매월 렌트/리스료 합계
                        </div>
                    </div>
                </div>

                {/* Available Stats */}
                <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-orange-600/70 uppercase tracking-wider mb-2">배정 가능 (대기)</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.available}</h3>
                            <span className="text-sm font-bold text-slate-400">대</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faClock} /> 즉시 배정 가능
                        </div>
                    </div>
                </div>
            </div>

            {/* Vehicle Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {vehicles.map(vehicle => (
                    <div
                        key={vehicle.id}
                        className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50/50 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                        onClick={() => onEdit(vehicle)}
                    >
                        {/* Status Line */}
                        <div className="flex justify-between items-start mb-4">
                            {getStatusBadge(vehicle.status || 'AVAILABLE')}
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onManageExpenses(vehicle); }}
                                    className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors"
                                    title="지출 기록"
                                >
                                    <FontAwesomeIcon icon={faGasPump} className="text-xs" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                    className="w-8 h-8 rounded-full bg-slate-50 hover:bg-green-100 flex items-center justify-center text-slate-400 hover:text-green-600 transition-colors"
                                    title="배정 관리"
                                >
                                    <FontAwesomeIcon icon={faUser} className="text-xs" />
                                </button>
                            </div>
                        </div>

                        {/* Title Info */}
                        <h3 className="text-xl font-black text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors flex items-center gap-2">
                            {vehicle.licensePlate}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium mb-4 flex items-center gap-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{vehicle.type}</span>
                            {vehicle.model}
                        </p>

                        {/* Detail Info */}
                        <div className="space-y-3 pt-4 border-t border-slate-50">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-medium text-xs">현재 운행자</span>
                                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                    {vehicle.currentAssigneeName ? (
                                        <>
                                            <FontAwesomeIcon icon={vehicle.currentAssigneeType === 'TEAM' ? faUsers : faUser} className="text-indigo-400 text-xs" />
                                            {vehicle.currentAssigneeName}
                                        </>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-medium text-xs">월 고정비용</span>
                                <span className="font-bold text-slate-700">
                                    {vehicle.contract?.monthlyFee ? `${vehicle.contract.monthlyFee.toLocaleString()}원` : '-'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-medium text-xs">계약 기간</span>
                                <span className={`font-bold text-xs px-2 py-0.5 rounded ${vehicle.contract?.endDate ? 'bg-slate-50 text-slate-600' : 'text-slate-300'
                                    }`}>
                                    {vehicle.contract?.startDate} ~ {vehicle.contract?.endDate || '무기한'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
