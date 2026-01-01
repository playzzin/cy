import React, { useEffect, useState } from 'react';
import {
    Vehicle, VehicleAssigneeType, VehicleAssignmentRecord
} from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { useMasterData } from '../../contexts/MasterDataContext';
import { manpowerService, Worker } from '../../services/manpowerService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { format } from 'date-fns';

interface VehicleAssignmentProps {
    vehicle: Vehicle;
    onClose: () => void;
    onUpdate: () => void; // Trigger parent refresh
}

export const VehicleAssignment: React.FC<VehicleAssignmentProps> = ({
    vehicle, onClose, onUpdate
}) => {
    const { teams } = useMasterData();
    const [history, setHistory] = useState<VehicleAssignmentRecord[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [assigneeType, setAssigneeType] = useState<VehicleAssigneeType>('TEAM');
    const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [saving, setSaving] = useState(false);

    // Initial Load
    useEffect(() => {
        loadHistory();
        loadWorkers();
    }, [vehicle.id]);

    const loadHistory = async () => {
        try {
            const data = await vehicleService.getAssignmentHistory(vehicle.id);
            setHistory(data);
        } catch (error) {
            console.error("Failed to load history", error);
        }
    };

    const loadWorkers = async () => {
        // Optimize: Only load if type is WORKER? Or pre-load for better UX
        // For MVP, loading all. If too slow, optimize.
        try {
            const data = await manpowerService.getWorkers();
            setWorkers(data);
        } catch (error) {
            console.error("Failed to load workers", error);
        }
    };

    const handleAssign = async () => {
        if (!selectedAssigneeId) {
            toast.error("Please select an assignee.");
            return;
        }

        const result = await showConfirmAlert(
            'Assign Vehicle',
            `Assign to ${getAssigneeName(selectedAssigneeId)}?`
        );

        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            const assigneeName = getAssigneeName(selectedAssigneeId);
            await vehicleService.assignVehicle(
                vehicle.id,
                selectedAssigneeId,
                assigneeType,
                assigneeName,
                startDate
            );
            toast.success("Vehicle assigned successfully");
            onUpdate(); // Refresh parent
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Assignment failed");
        } finally {
            setSaving(false);
        }
    };

    const handleUnassign = async () => {
        const result = await showConfirmAlert(
            'Unassign Vehicle',
            'Are you sure you want to unassign this vehicle?'
        );

        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            const endDate = format(new Date(), 'yyyy-MM-dd');
            await vehicleService.unassignVehicle(vehicle.id, endDate);
            toast.success("Vehicle unassigned");
            onUpdate(); // Refresh parent
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Unassignment failed");
        } finally {
            setSaving(false);
        }
    };

    const getAssigneeName = (id: string) => {
        if (assigneeType === 'TEAM') {
            return teams.find(t => t.id === id)?.name || 'Unknown Team';
        } else {
            return workers.find(w => w.id === id)?.name || 'Unknown Worker';
        }
    };

    // Filtered options based on type
    const getOptions = () => {
        if (assigneeType === 'TEAM') {
            return teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
            ));
        } else {
            return workers.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.teamName || 'No Team'})</option>
            ));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-gray-800">
                        Vehicle Assignment: {vehicle.licensePlate}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Current Status Block */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Current Status</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${vehicle.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                                        vehicle.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        {vehicle.status}
                                    </span>
                                    {vehicle.status === 'ASSIGNED' && (
                                        <span className="font-medium text-gray-900">
                                            {vehicle.currentAssigneeName} ({vehicle.currentAssigneeType})
                                        </span>
                                    )}
                                </div>
                            </div>
                            {vehicle.status === 'ASSIGNED' && (
                                <button
                                    onClick={handleUnassign}
                                    disabled={saving}
                                    className="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-md text-sm font-medium transition-colors"
                                >
                                    {saving ? 'Processing...' : 'Unassign'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* New Assignment Form (Only if Available) */}
                    {vehicle.status === 'AVAILABLE' && (
                        <div className="border rounded-lg p-5">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <i className="fas fa-key text-yellow-500"></i> New Assignment
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-600">Assignee Type</label>
                                    <div className="flex bg-gray-100 p-1 rounded-md">
                                        <button
                                            className={`flex-1 py-1.5 text-sm rounded transition-all ${assigneeType === 'TEAM' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setAssigneeType('TEAM')}
                                        >
                                            Team
                                        </button>
                                        <button
                                            className={`flex-1 py-1.5 text-sm rounded transition-all ${assigneeType === 'WORKER' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setAssigneeType('WORKER')}
                                        >
                                            Worker
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-600">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-2 space-y-1">
                                    <label className="text-sm font-medium text-gray-600">Select {assigneeType === 'TEAM' ? 'Team' : 'Worker'}</label>
                                    <select
                                        value={selectedAssigneeId}
                                        onChange={(e) => setSelectedAssigneeId(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select...</option>
                                        {getOptions()}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleAssign}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium shadow-sm transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Confirm Assignment'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* History Table */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <i className="fas fa-history text-gray-400"></i> Assignment History
                        </h3>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assignee</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">
                                                No history found
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{record.assigneeName}</div>
                                                    <div className="text-xs text-gray-500">{record.assigneeType}</div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    {record.startDate}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    {record.endDate || <span className="text-green-600 font-bold text-xs uppercase bg-green-50 px-2 py-0.5 rounded">Active</span>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    -
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
