import React, { useMemo } from 'react';
import { Vehicle } from '../../types/vehicle';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCar, faGasPump, faEdit, faUser, faUsers, faWonSign, faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';

interface VehicleListProps {
    vehicles?: Vehicle[]; // Optional to support direct usage or prop usage
    onEdit: (vehicle: Vehicle) => void;
    onManageExpenses: (vehicle: Vehicle) => void;
    onAssign: (vehicle: Vehicle) => void;
}

// Internal default props if needed, but mainly we expect data passed from parent
export const VehicleList: React.FC<VehicleListProps> = ({
    vehicles = [],
    onEdit,
    onManageExpenses,
    onAssign
}) => {

    // Calculate Total Monthly Cost
    const totalMonthlyCost = useMemo(() => {
        return vehicles.reduce((sum, v) => sum + (v.contract?.monthlyFee || 0), 0);
    }, [vehicles]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ASSIGNED': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">운행중</span>;
            case 'AVAILABLE': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-500">대기중</span>;
            case 'MAINTENANCE': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">정비중</span>;
            default: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">{status}</span>;
        }
    };

    if (!vehicles || vehicles.length === 0) {
        return (
            <div className="p-20 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="flex flex-col items-center gap-3">
                    <FontAwesomeIcon icon={faCar} className="text-4xl text-slate-300" />
                    <p>등록된 차량이 없습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-2xl overflow-hidden flex-1 flex flex-col max-h-[700px]">
                <div className="overflow-x-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-sm min-w-[1000px]">
                        <thead className="bg-indigo-600 text-white font-bold text-xs uppercase sticky top-0 z-20 shadow-md">
                            <tr>
                                <th className="px-4 py-4 text-left w-20 tracking-wider bg-indigo-700 border-r border-indigo-500">No.</th>
                                <th className="px-4 py-4 text-left w-36 border-r border-indigo-500">차량번호</th>
                                <th className="px-4 py-4 text-left w-32 border-r border-indigo-500">차종/모델</th>
                                <th className="px-4 py-4 text-center w-24 border-r border-indigo-500">상태</th>
                                <th className="px-4 py-4 text-left w-40 border-r border-indigo-500">운행자(팀)</th>
                                <th className="px-4 py-4 text-center w-48 border-r border-indigo-500">계약 기간</th>
                                <th className="px-4 py-4 text-right w-36 border-r border-indigo-500 bg-indigo-500">월 렌트료</th>
                                <th className="px-4 py-4 text-center w-32">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-50">
                            {vehicles.map((vehicle, idx) => (
                                <tr key={vehicle.id} className="group hover:bg-blue-50/40 transition-colors">
                                    <td className="px-4 py-3 border-r border-indigo-50 text-slate-400 font-mono text-center">
                                        {idx + 1}
                                    </td>
                                    <td className="px-4 py-3 border-r border-indigo-50 font-bold text-slate-700 group-hover:text-indigo-700">
                                        {vehicle.licensePlate}
                                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{vehicle.type}</div>
                                    </td>
                                    <td className="px-4 py-3 border-r border-indigo-50 text-slate-600">
                                        {vehicle.model}
                                    </td>
                                    <td className="px-4 py-3 border-r border-indigo-50 text-center">
                                        {getStatusBadge(vehicle.status || 'AVAILABLE')}
                                    </td>
                                    <td className="px-4 py-3 border-r border-indigo-50">
                                        {vehicle.currentAssigneeName ? (
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <FontAwesomeIcon icon={vehicle.currentAssigneeType === 'TEAM' ? faUsers : faUser} className="text-slate-400 text-xs" />
                                                {vehicle.currentAssigneeName}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 border-r border-indigo-50 text-center text-xs">
                                        {vehicle.contract?.endDate ? (
                                            <div className="flex flex-col items-center gap-0.5 text-slate-600">
                                                <span>{vehicle.contract.startDate} ~</span>
                                                <span className="font-bold text-slate-700">{vehicle.contract.endDate}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 border-r border-indigo-50 text-right font-bold text-slate-700 bg-indigo-50/10">
                                        {vehicle.contract?.monthlyFee ? vehicle.contract.monthlyFee.toLocaleString() : 0}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onManageExpenses(vehicle)}
                                                className="w-7 h-7 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center"
                                                title="비용 관리"
                                            >
                                                <FontAwesomeIcon icon={faGasPump} className="text-xs" />
                                            </button>
                                            <button
                                                onClick={() => onAssign(vehicle)}
                                                className="w-7 h-7 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center"
                                                title="배정"
                                            >
                                                <FontAwesomeIcon icon={faUser} className="text-xs" />
                                            </button>
                                            <button
                                                onClick={() => onEdit(vehicle)}
                                                className="w-7 h-7 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                                                title="수정"
                                            >
                                                <FontAwesomeIcon icon={faEdit} className="text-xs" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <tr>
                                <td colSpan={6} className="p-4 border-r border-slate-600 text-center">합계 (Total)</td>
                                <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-300 text-lg">
                                    {totalMonthlyCost.toLocaleString()}
                                </td>
                                <td className="bg-slate-900 border-l border-slate-700"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <FontAwesomeIcon icon={faWonSign} className="text-slate-400 mt-0.5" />
                <p>
                    * <strong>월 렌트료</strong>는 차량 계약 정보에 등록된 고정 비용의 합계입니다.<br />
                    * 주유비, 하이패스 등 변동 비용은 <strong>[월별 비용 정산]</strong> 탭에서 확인하실 수 있습니다.
                </p>
            </div>
        </div>
    );
};
