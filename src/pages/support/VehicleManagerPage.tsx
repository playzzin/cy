import React, { useState, useEffect } from 'react';
import { Vehicle } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { VehicleList } from '../../components/vehicle/VehicleList';
import { VehicleForm } from '../../components/vehicle/VehicleForm';
import { VehicleAssignment } from '../../components/vehicle/VehicleAssignment';
import { VehicleExpenseLog } from '../../components/vehicle/VehicleExpenseLog';
import { VehicleBillingManager } from '../../components/vehicle/VehicleBillingManager';
import { VehicleStatusBoard } from '../../components/vehicle/VehicleStatusBoard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCar, faFileInvoiceDollar, faChartPie, faList, faGasPump } from '@fortawesome/free-solid-svg-icons';

export const VehicleManagerPage = () => {
    // Data State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // Tab State
    const [activeTab, setActiveTab] = useState<'STATUS' | 'LIST' | 'BILLING'>('STATUS');

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [assigningVehicle, setAssigningVehicle] = useState<Vehicle | null>(null);
    const [expenseVehicle, setExpenseVehicle] = useState<Vehicle | null>(null);

    // Load Data
    useEffect(() => {
        loadData();
    }, [refreshKey]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await vehicleService.getVehicles();
            setVehicles(data);
        } catch (error) {
            console.error("Failed to load vehicles", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    // Actions
    const handleCreate = () => {
        setEditingVehicle(null);
        setIsFormOpen(true);
    };

    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsFormOpen(true);
    };

    const handleAssign = (vehicle: Vehicle) => {
        setAssigningVehicle(vehicle);
    };

    const handleManageExpenses = (vehicle: Vehicle) => {
        setExpenseVehicle(vehicle);
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        handleRefresh();
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
            <div className="max-w-[1800px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faCar} className="text-lg" />
                            </span>
                            법인차량 통합 관리
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium ml-14">
                            차량 계약, 배정 현황, 월별 고정비 및 변동비(주유/하이패스)를 통합 관리합니다.
                        </p>
                    </div>
                    <div>
                        <button
                            onClick={handleCreate}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            신규 차량 등록
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
                    {[
                        { id: 'STATUS', label: '차량 현황판', icon: faChartPie },
                        { id: 'LIST', label: '목록형', icon: faList },
                        { id: 'BILLING', label: '월별 비용 정산', icon: faFileInvoiceDollar },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2.5
                                ${activeTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }
                            `}
                        >
                            <FontAwesomeIcon icon={tab.icon} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div>
                    {activeTab === 'STATUS' && (
                        <VehicleStatusBoard
                            vehicles={vehicles}
                            loading={loading}
                            onEdit={handleEdit}
                            onManageExpenses={handleManageExpenses}
                            onAssign={handleAssign}
                        />
                    )}

                    {activeTab === 'LIST' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[600px]">
                            <VehicleList
                                onEdit={handleEdit}
                                onManageExpenses={handleManageExpenses}
                                onAssign={handleAssign}
                            />
                        </div>
                    )}

                    {activeTab === 'BILLING' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[600px]">
                            <VehicleBillingManager />
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {isFormOpen && (
                <VehicleForm
                    initialData={editingVehicle}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={handleFormSuccess}
                />
            )}

            {assigningVehicle && (
                <VehicleAssignment
                    vehicle={assigningVehicle}
                    onClose={() => {
                        setAssigningVehicle(null);
                        handleRefresh();
                    }}
                    onUpdate={handleRefresh}
                />
            )}

            {expenseVehicle && (
                <VehicleExpenseLog
                    vehicle={expenseVehicle}
                    onClose={() => setExpenseVehicle(null)}
                />
            )}
        </div>
    );
};
