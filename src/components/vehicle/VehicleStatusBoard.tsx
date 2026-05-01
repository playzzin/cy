import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types/vehicle';
import { Team } from '../../services/teamService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCar, faGasPump, faWrench, faCheckCircle, faClock,
    faWonSign, faExclamationTriangle, faCalendarAlt, faUser, faUsers,
    faList, faTh, faTrash, faPlus, faFileInvoiceDollar
} from '@fortawesome/free-solid-svg-icons';
import { iconMap } from '../../constants/iconMap';

interface TeamInfo {
    color: string;
    icon?: string;
}

interface VehicleStatusBoardProps {
    vehicles: Vehicle[];
    teams?: Team[];
    loading: boolean;
    onEdit: (vehicle: Vehicle) => void;
    onManageExpenses: (vehicle: Vehicle) => void;
    onAssign: (vehicle: Vehicle) => void;
    onOpenBilling: (vehicle: Vehicle) => void;
}

const getTeamFaIcon = (iconName?: string) => {
    if (!iconName) return faUsers;
    return iconMap[iconName] || faUsers;
};

/** HEX → rgba 변환 유틸 */
const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export const VehicleStatusBoard: React.FC<VehicleStatusBoardProps> = ({
    vehicles,
    teams = [],
    loading,
    onEdit,
    onManageExpenses,
    onAssign,
    onOpenBilling
}) => {
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

    // Build team info map: assigneeName -> {color, icon}
    const teamInfoMap = useMemo(() => {
        const map = new Map<string, TeamInfo>();
        teams.forEach(t => {
            if (t.color && t.name) map.set(t.name, { color: t.color, icon: t.icon || t.iconKey });
        });
        return map;
    }, [teams]);

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

    // 3. Sorting Logic: Rent > Lease > Others
    const sortedVehicles = useMemo(() => {
        return [...vehicles].sort((a, b) => {
            const getPriority = (type: string) => {
                if (type === 'RENT') return 0;
                if (type === 'LEASE') return 1;
                return 2;
            };
            const pA = getPriority(a.type || '');
            const pB = getPriority(b.type || '');
            if (pA !== pB) return pA - pB;
            return (a.licensePlate || '').localeCompare(b.licensePlate || '');
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

    /** 테이블용 상태 배지 (inline) */
    const getStatusBadgeInline = (status: string) => {
        switch (status) {
            case 'ASSIGNED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        운행중
                    </span>
                );
            case 'AVAILABLE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        대기중
                    </span>
                );
            case 'MAINTENANCE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                        정비중
                    </span>
                );
            default:
                return <span className="text-xs text-slate-300">-</span>;
        }
    };

    /** 차량 타입 라벨 */
    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'RENT': return '렌트';
            case 'LEASE': return '리스';
            case 'OWNED': return '자가';
            default: return type;
        }
    };

    const getBillingTargetTypeLabel = (vehicle: Vehicle) => {
        if (!vehicle.currentAssigneeName) return null;
        return vehicle.currentAssigneeType === 'TEAM' ? '팀' : '개인';
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
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <FontAwesomeIcon icon={faCar} className="text-4xl" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">등록된 법인차량이 없습니다</h3>
                <p className="text-slate-400 mb-6">새로운 차량을 등록하여 관리를 시작해보세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
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
                            <FontAwesomeIcon icon={faCheckCircle} /> 가동률 {stats.total > 0 ? Math.round((stats.operating / stats.total) * 100) : 0}%
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

            {/* View Mode Toggle */}
            <div className="flex justify-end">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                            ${viewMode === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        title="목록형"
                    >
                        <FontAwesomeIcon icon={faList} />
                        목록
                    </button>
                    <button
                        onClick={() => setViewMode('card')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                            ${viewMode === 'card'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        title="카드형"
                    >
                        <FontAwesomeIcon icon={faTh} />
                        카드
                    </button>
                </div>
            </div>

            {/* ── 목록형 (Table) ── */}
            {viewMode === 'list' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-8">#</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">차량번호</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">차종 / 모델</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">상태</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">배정</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구대상</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">월 고정비용</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">보증금</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">결제일</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">계약기간</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">렌트사(금융사)</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedVehicles.map((vehicle, rowIdx) => {
                                    const teamInfo = vehicle.currentAssigneeType === 'TEAM' && vehicle.currentAssigneeName
                                        ? teamInfoMap.get(vehicle.currentAssigneeName) : undefined;
                                    const tc = teamInfo?.color;
                                    const isContractExpired = vehicle.contract?.endDate && new Date(vehicle.contract.endDate) < new Date();
                                    const paymentDay = vehicle.contract?.paymentDay;
                                    const billingTargetTypeLabel = getBillingTargetTypeLabel(vehicle);

                                    return (
                                        <tr
                                            key={vehicle.id}
                                            onClick={() => onEdit(vehicle)}
                                            className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                                            style={tc ? { borderLeft: `3px solid ${tc}` } : undefined}
                                        >
                                            <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                    {vehicle.licensePlate}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400">{getTypeLabel(vehicle.type)}</span>
                                                    <span className="font-medium text-slate-600">{vehicle.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadgeInline(vehicle.status || 'AVAILABLE')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {vehicle.currentAssigneeName ? (
                                                    vehicle.currentAssigneeType === 'TEAM' ? (
                                                        <span
                                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold"
                                                            style={tc ? {
                                                                backgroundColor: hexToRgba(tc, 0.1),
                                                                color: tc,
                                                                border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                            } : {
                                                                backgroundColor: '#f1f5f9',
                                                                color: '#475569',
                                                                border: '1px solid #e2e8f0',
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={getTeamFaIcon(teamInfo?.icon)} className="text-[10px]" />
                                                            {vehicle.currentAssigneeName}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                            <FontAwesomeIcon icon={faUser} className="text-[10px]" />
                                                            {vehicle.currentAssigneeName}
                                                        </span>
                                                    )
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                        className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                                                        배정하기
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {vehicle.currentAssigneeName && billingTargetTypeLabel ? (
                                                    <span
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold"
                                                        style={vehicle.currentAssigneeType === 'TEAM'
                                                            ? (tc ? {
                                                                backgroundColor: hexToRgba(tc, 0.1),
                                                                color: tc,
                                                                border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                            } : {
                                                                backgroundColor: '#f1f5f9',
                                                                color: '#475569',
                                                                border: '1px solid #e2e8f0',
                                                            })
                                                            : {
                                                                backgroundColor: '#eef2ff',
                                                                color: '#4338ca',
                                                                border: '1px solid #e0e7ff',
                                                            }}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={vehicle.currentAssigneeType === 'TEAM' ? getTeamFaIcon(teamInfo?.icon) : faUser}
                                                            className="text-[10px]"
                                                        />
                                                        {billingTargetTypeLabel} · {vehicle.currentAssigneeName}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                {vehicle.contract?.monthlyFee
                                                    ? <>{vehicle.contract.monthlyFee.toLocaleString()}<span className="text-slate-400 font-normal">원</span></>
                                                    : <span className="text-xs text-slate-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                {`${(vehicle.contract?.deposit ?? 0).toLocaleString()}원`}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {paymentDay ? (
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${Math.abs(paymentDay - new Date().getDate()) <= 3 ? 'bg-amber-100 text-amber-700' : 'text-slate-500'}`}>
                                                        {paymentDay}일
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {vehicle.contract?.startDate || vehicle.contract?.endDate ? (
                                                    <span className={`text-xs font-medium ${isContractExpired ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                                                        {vehicle.contract?.startDate || '?'} ~ {vehicle.contract?.endDate || '무기한'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                {vehicle.contract?.financeCompany?.name || vehicle.insurance?.company || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onManageExpenses(vehicle); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-indigo-50 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
                                                        title="지출 기록"
                                                    >
                                                        <FontAwesomeIcon icon={faGasPump} className="text-xs" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-green-50 flex items-center justify-center text-slate-400 hover:text-green-500 transition-colors"
                                                        title="배정 관리"
                                                    >
                                                        <FontAwesomeIcon icon={faUser} className="text-xs" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onOpenBilling(vehicle); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-400 hover:text-amber-600 transition-colors"
                                                        title="청구 관리"
                                                    >
                                                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-xs" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Table Footer Summary */}
                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">
                            총 {vehicles.length}대
                        </span>
                        <span className="text-slate-500 font-bold">
                            월 고정비용 합계: {vehicles
                                .reduce((sum, v) => sum + (v.contract?.monthlyFee || 0), 0)
                                .toLocaleString()}원
                        </span>
                    </div>
                </div>
            ) : (
                /* ── 카드형 (Grid) ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedVehicles.map(vehicle => {
                        const teamInfo = vehicle.currentAssigneeType === 'TEAM' && vehicle.currentAssigneeName
                            ? teamInfoMap.get(vehicle.currentAssigneeName) : undefined;
                        const tc = teamInfo?.color;
                        const billingTargetTypeLabel = getBillingTargetTypeLabel(vehicle);

                        return (
                            <div
                                key={vehicle.id}
                                className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                                onClick={() => onEdit(vehicle)}
                                style={{
                                    borderLeftWidth: tc ? '4px' : undefined,
                                    borderLeftColor: tc || undefined,
                                    boxShadow: tc ? `0 4px 20px -4px ${hexToRgba(tc, 0.12)}` : undefined,
                                }}
                            >
                                {/* Team Color Gradient Top Bar */}
                                {tc && (
                                    <div className="h-1" style={{ background: `linear-gradient(to right, ${tc}, ${hexToRgba(tc, 0.1)}, transparent)` }} />
                                )}

                                <div className="p-6">
                                    {/* Status Line */}
                                    <div className="flex justify-between items-start mb-3">
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
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onOpenBilling(vehicle); }}
                                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-100 flex items-center justify-center text-slate-400 hover:text-amber-600 transition-colors"
                                                title="청구 관리"
                                            >
                                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-xs" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Team Badge (if assigned to team) */}
                                    {vehicle.currentAssigneeName && vehicle.currentAssigneeType === 'TEAM' && (
                                        <div className="mb-3">
                                            <span
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold"
                                                style={tc ? {
                                                    backgroundColor: hexToRgba(tc, 0.1),
                                                    color: tc,
                                                    border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                } : {
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#475569',
                                                    border: '1px solid #e2e8f0',
                                                }}
                                            >
                                                <FontAwesomeIcon icon={getTeamFaIcon(teamInfo?.icon)} className="text-xs" />
                                                {vehicle.currentAssigneeName}
                                            </span>
                                        </div>
                                    )}

                                    {/* Worker Badge (if assigned to individual) */}
                                    {vehicle.currentAssigneeName && vehicle.currentAssigneeType !== 'TEAM' && (
                                        <div className="mb-3">
                                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                <FontAwesomeIcon icon={faUser} className="text-xs" />
                                                {vehicle.currentAssigneeName}
                                            </span>
                                        </div>
                                    )}

                                    {/* Title Info */}
                                    <h3 className="text-xl font-black text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors flex items-center gap-2">
                                        {vehicle.licensePlate}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium mb-4 flex items-center gap-2">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{vehicle.type}</span>
                                        {vehicle.model}
                                    </p>

                                    {/* Detail Info */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-medium text-xs">청구 대상</span>
                                            {vehicle.currentAssigneeName && billingTargetTypeLabel ? (
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold"
                                                    style={vehicle.currentAssigneeType === 'TEAM'
                                                        ? (tc ? {
                                                            backgroundColor: hexToRgba(tc, 0.1),
                                                            color: tc,
                                                            border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                        } : {
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#475569',
                                                            border: '1px solid #e2e8f0',
                                                        })
                                                        : {
                                                            backgroundColor: '#eef2ff',
                                                            color: '#4338ca',
                                                            border: '1px solid #e0e7ff',
                                                        }}
                                                >
                                                    <FontAwesomeIcon
                                                        icon={vehicle.currentAssigneeType === 'TEAM' ? getTeamFaIcon(teamInfo?.icon) : faUser}
                                                        className="text-[10px]"
                                                    />
                                                    {billingTargetTypeLabel} · {vehicle.currentAssigneeName}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">미지정</span>
                                            )}
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

                                    {/* Unassigned indicator */}
                                    {!vehicle.currentAssigneeName && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex justify-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <FontAwesomeIcon icon={faPlus} />
                                                지금 배정하기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
