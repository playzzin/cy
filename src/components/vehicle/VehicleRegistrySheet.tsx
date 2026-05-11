import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDays,
    faCar,
    faFilePen,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { Vehicle } from '../../types/vehicle';

interface VehicleRegistrySheetProps {
    vehicles: Vehicle[];
    loading: boolean;
    onEdit: (vehicle: Vehicle) => void;
    onAssign: (vehicle: Vehicle) => void;
}

const formatCurrency = (value?: number): string => `${Number(value ?? 0).toLocaleString('ko-KR')}원`;

const getStatusBadgeClass = (status?: string): string => {
    switch (status) {
        case 'ASSIGNED':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'MAINTENANCE':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'DISPOSED':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        default:
            return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const getStatusLabel = (status?: string): string => {
    switch (status) {
        case 'ASSIGNED':
            return '운행중';
        case 'MAINTENANCE':
            return '정비중';
        case 'DISPOSED':
            return '종료';
        default:
            return '대기';
    }
};

const getTypeLabel = (type?: string): string => {
    switch (type) {
        case 'RENT':
            return '렌트';
        case 'LEASE':
            return '리스';
        case 'OWNED':
            return '자가';
        default:
            return '-';
    }
};

const isExpiringSoon = (dateText?: string): boolean => {
    if (!dateText) return false;
    const target = new Date(dateText);
    if (Number.isNaN(target.getTime())) return false;

    const today = new Date();
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
};

export const VehicleRegistrySheet: React.FC<VehicleRegistrySheetProps> = ({
    vehicles,
    loading,
    onEdit,
    onAssign
}) => {
    const totals = useMemo(() => {
        return vehicles.reduce(
            (acc, vehicle) => {
                acc.count += 1;
                acc.monthlyFee += Number(vehicle.contract?.monthlyFee ?? 0);
                if (vehicle.status === 'ASSIGNED') acc.assigned += 1;
                return acc;
            },
            { count: 0, assigned: 0, monthlyFee: 0 }
        );
    }, [vehicles]);

    if (loading) {
        return (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-extrabold text-slate-900">차량 대장</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        차량 기본 정보와 배정 상태를 엑셀처럼 한 표에서 관리합니다.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">총 {totals.count}대</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">운행 {totals.assigned}대</span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">월 사용료 {formatCurrency(totals.monthlyFee)}</span>
                </div>
            </div>

            <div className="max-h-[calc(100vh-290px)] overflow-auto">
                <table className="min-w-[1280px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold">차량번호</th>
                            <th className="px-4 py-3 text-left font-bold">차종/구분</th>
                            <th className="px-4 py-3 text-left font-bold">상태</th>
                            <th className="px-4 py-3 text-left font-bold">배정</th>
                            <th className="px-4 py-3 text-right font-bold">월 사용료</th>
                            <th className="px-4 py-3 text-left font-bold">캐피탈</th>
                            <th className="px-4 py-3 text-left font-bold">보험사</th>
                            <th className="px-4 py-3 text-center font-bold">결제일</th>
                            <th className="px-4 py-3 text-left font-bold">계약만료</th>
                            <th className="px-4 py-3 text-left font-bold">등록일</th>
                            <th className="px-4 py-3 text-left font-bold">관리메모</th>
                            <th className="px-4 py-3 text-center font-bold">작업</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {vehicles.map((vehicle) => {
                            const expiringSoon = isExpiringSoon(vehicle.contract?.endDate);

                            return (
                                <tr key={vehicle.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-bold text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faCar} className="text-slate-400" />
                                            <span>{vehicle.licensePlate}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        <div className="font-semibold">{vehicle.model || '-'}</div>
                                        <div className="text-xs font-medium text-slate-400">{getTypeLabel(vehicle.type)}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusBadgeClass(vehicle.status)}`}>
                                            {getStatusLabel(vehicle.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
                                            <span>{vehicle.currentAssigneeName || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                        {formatCurrency(vehicle.contract?.monthlyFee)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {vehicle.contract?.financeCompany?.name || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {vehicle.insurance?.company || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono text-slate-600">
                                        {vehicle.contract?.paymentDay ? `${vehicle.contract.paymentDay}일` : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faCalendarDays} className={expiringSoon ? 'text-rose-500' : 'text-slate-300'} />
                                            <span className={expiringSoon ? 'font-bold text-rose-600' : 'text-slate-600'}>
                                                {vehicle.contract?.endDate || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {vehicle.contract?.startDate || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        <div className="max-w-[220px] truncate" title={vehicle.memo || ''}>
                                            {vehicle.memo || '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onEdit(vehicle)}
                                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                            >
                                                수정
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onAssign(vehicle)}
                                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                                            >
                                                배정
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {vehicles.length === 0 && (
                            <tr>
                                <td colSpan={12} className="px-4 py-16 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <FontAwesomeIcon icon={faFilePen} className="text-3xl text-slate-300" />
                                        <p>조회된 차량이 없습니다.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
