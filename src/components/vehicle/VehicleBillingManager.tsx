import React, { useEffect, useState } from 'react';
import { vehicleBillingService } from '../../services/vehicleBillingService';
import { VehicleBillingDocument } from '../../types/vehicleBilling';
import { toast, showConfirmAlert } from '../../utils/swal';
import { format, subMonths } from 'date-fns';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';

export const VehicleBillingManager: React.FC = () => {
    const [yearMonth, setYearMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
    const [billings, setBillings] = useState<VehicleBillingDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadBillings();
    }, [yearMonth]);

    const loadBillings = async () => {
        setLoading(true);
        try {
            const data = await vehicleBillingService.getBillingsByMonth(yearMonth);
            setBillings(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load billings");
        } finally {
            setLoading(false);
        }
    };

    const handleCalculate = async () => {
        const result = await showConfirmAlert(
            "Calculate Billing",
            `Generate billing for ${yearMonth}? This will overwrite existing drafts.`
        );
        if (!result.isConfirmed) return;

        setProcessing(true);
        try {
            const generated = await vehicleBillingService.generateMonthlyBillings(yearMonth);
            // Save all generated billings
            // In a real app, this might be a batch operation or user reviews first.
            // For MVP, we save immediately.
            await Promise.all(generated.map(b => vehicleBillingService.saveBilling(b)));

            toast.success(`Generated ${generated.length} billing records.`);
            loadBillings();
        } catch (error) {
            console.error(error);
            toast.error("Calculation failed");
        } finally {
            setProcessing(false);
        }
    };

    const columnDefs: ColDef[] = [
        { field: 'vehiclePlate', headerName: 'Vehicle', width: 120, pinned: 'left' },
        { field: 'vehicleModel', headerName: 'Model', width: 120 },
        { field: 'assigneeName', headerName: 'Assignee', width: 150 },
        {
            field: 'fixedCost',
            headerName: 'Fixed Cost',
            valueFormatter: p => p.value.toLocaleString(),
            width: 120
        },
        {
            field: 'variableCost',
            headerName: 'Variable Cost',
            valueFormatter: p => p.value.toLocaleString(),
            width: 120
        },
        {
            field: 'totalAmount',
            headerName: 'Total',
            valueFormatter: p => p.value.toLocaleString(),
            width: 120,
            cellStyle: { fontWeight: 'bold' }
        },
        {
            field: 'status',
            headerName: 'Status',
            cellRenderer: (p: any) => (
                <span className={`px-2 py-1 rounded text-xs font-bold ${p.value === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {p.value}
                </span>
            )
        }
    ];

    const totalFixed = billings.reduce((sum, b) => sum + b.fixedCost, 0);
    const totalVariable = billings.reduce((sum, b) => sum + b.variableCost, 0);
    const totalSum = billings.reduce((sum, b) => sum + b.totalAmount, 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex items-center gap-4">
                    <label className="font-bold text-gray-700">Billing Month:</label>
                    <input
                        type="month"
                        value={yearMonth}
                        onChange={e => setYearMonth(e.target.value)}
                        className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleCalculate}
                        disabled={processing}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow transition-colors flex items-center gap-2"
                    >
                        {processing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-calculator"></i>}
                        Calculate / Recalculate
                    </button>
                </div>
                <div className="flex gap-6 text-right">
                    <div>
                        <p className="text-xs text-gray-500 uppercase">Fixed</p>
                        <p className="font-bold text-gray-700">{totalFixed.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase">Variable</p>
                        <p className="font-bold text-gray-700">{totalVariable.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase">Total</p>
                        <p className="font-bold text-blue-600 text-xl">{totalSum.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4 h-[600px] ag-theme-alpine">
                <AgGridReact
                    rowData={billings}
                    columnDefs={columnDefs}
                    defaultColDef={{ resizable: true, sortable: true, filter: true }}
                    pagination={true}
                    paginationPageSize={15}
                />
            </div>
        </div>
    );
};
