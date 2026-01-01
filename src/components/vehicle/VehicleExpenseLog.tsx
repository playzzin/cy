import React, { useEffect, useState } from 'react';
import { Vehicle, VehicleExpenseRecord, VehicleExpenseType, VehicleExpensePayer } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { format } from 'date-fns';

interface VehicleExpenseLogProps {
    vehicle: Vehicle;
    onClose: () => void;
}

const EXPENSE_TYPES: VehicleExpenseType[] = ['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER'];
const PAYERS: VehicleExpensePayer[] = ['COMPANY', 'DRIVER'];

export const VehicleExpenseLog: React.FC<VehicleExpenseLogProps> = ({ vehicle, onClose }) => {
    const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [expenses, setExpenses] = useState<VehicleExpenseRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [type, setType] = useState<VehicleExpenseType>('FUEL');
    const [amount, setAmount] = useState<number | ''>('');
    const [payer, setPayer] = useState<VehicleExpensePayer>('COMPANY');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadExpenses();
    }, [vehicle.id, currentMonth]);

    const loadExpenses = async () => {
        setLoading(true);
        try {
            const data = await vehicleService.getExpensesByVehicle(vehicle.id, currentMonth);
            setExpenses(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load expenses");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!amount || Number(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setSaving(true);
        try {
            await vehicleService.addExpense({
                vehicleId: vehicle.id,
                vehiclePlate: vehicle.licensePlate,
                date,
                type,
                amount: Number(amount),
                payer,
                note
            });
            toast.success("Expense added");

            // Reset Form
            setAmount('');
            setNote('');
            loadExpenses(); // Reload
        } catch (error) {
            console.error(error);
            toast.error("Failed to save expense");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        const result = await showConfirmAlert("Delete Expense", "Are you sure?");
        if (!result.isConfirmed) return;

        try {
            await vehicleService.deleteExpense(id);
            toast.success("Deleted");
            loadExpenses();
        } catch (error) {
            toast.error("Delete failed");
        }
    };

    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <i className="fas fa-gas-pump text-orange-500"></i>
                        Expense Log: {vehicle.licensePlate}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Input Form */}
                    <div className="w-full md:w-1/3 p-6 border-r bg-gray-50/50 overflow-y-auto">
                        <h3 className="font-bold text-gray-700 mb-4">Add New Expense</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {EXPENSE_TYPES.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setType(t)}
                                            className={`px-2 py-1.5 text-xs font-bold rounded border ${type === t ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (KRW)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-right font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Payer</label>
                                <div className="flex bg-gray-200 p-1 rounded">
                                    {PAYERS.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPayer(p)}
                                            className={`flex-1 py-1 text-xs font-bold rounded ${payer === p ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Memo</label>
                                <input
                                    type="text"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="Optional note"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md font-bold shadow transition-colors"
                            >
                                {saving ? 'Saving...' : 'Add Expense'}
                            </button>
                        </div>
                    </div>

                    {/* Right: List */}
                    <div className="w-full md:w-2/3 flex flex-col h-full">
                        <div className="p-4 border-b flex justify-between items-center bg-white">
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-600">Month:</label>
                                <input
                                    type="month"
                                    value={currentMonth}
                                    onChange={e => setCurrentMonth(e.target.value)}
                                    className="px-2 py-1 border rounded text-sm"
                                />
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase">Total Amount</p>
                                <p className="text-lg font-bold text-gray-800">{totalAmount.toLocaleString()} KRW</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                            {loading ? (
                                <div className="text-center py-10 text-gray-400">Loading...</div>
                            ) : expenses.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    No records for this month.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {expenses.map(item => (
                                        <div key={item.id} className="bg-white p-3 rounded border hover:shadow-sm flex justify-between items-center group">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs
                                                    ${item.type === 'FUEL' ? 'bg-green-500' :
                                                        item.type === 'REPAIR' ? 'bg-red-500' :
                                                            item.type === 'TOLL' ? 'bg-blue-500' : 'bg-gray-500'}`
                                                }>
                                                    {item.type[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{item.amount.toLocaleString()} Won</p>
                                                    <p className="text-xs text-gray-500">{item.date} | {item.payer}</p>
                                                    {item.note && <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">{item.note}</p>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
