import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandHoldingDollar, faReceipt } from '@fortawesome/free-solid-svg-icons';

type SummaryProps = {
    sales: {
        supply: number;
        tax: number;
        total: number;
    };
    purchase: {
        supply: number;
        tax: number;
        total: number;
    };
};

export const TransactionSummaryCards: React.FC<SummaryProps> = ({ sales, purchase }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Sales Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-blue-600 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faHandHoldingDollar} className="mr-2" />
                    매출 현황
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <SummaryItem
                        label="총 매출가액"
                        value={sales.supply}
                        color="text-slate-700"
                    />
                    <SummaryItem
                        label="총 매출세액"
                        value={sales.tax}
                        color="text-slate-500"
                    />
                    <SummaryItem
                        label="총 매출합계"
                        value={sales.total}
                        color="text-blue-600"
                        bold
                    />
                </div>
            </div>

            {/* Purchase Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faReceipt} className="mr-2" />
                    매입 현황
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <SummaryItem
                        label="총 매입가액"
                        value={purchase.supply}
                        color="text-slate-700"
                    />
                    <SummaryItem
                        label="총 매입세액"
                        value={purchase.tax}
                        color="text-slate-500"
                    />
                    <SummaryItem
                        label="총 매입합계"
                        value={purchase.total}
                        color="text-red-600"
                        bold
                    />
                </div>
            </div>
        </div>
    );
};

const SummaryItem: React.FC<{ label: string; value: number; color?: string; bold?: boolean }> = ({
    label,
    value,
    color = 'text-slate-900',
    bold = false
}) => (
    <div className="flex flex-col">
        <span className="text-xs text-slate-400 mb-1">{label}</span>
        <span className={`text-lg ${bold ? 'font-bold' : 'font-semibold'} ${color} tracking-tight`}>
            {value.toLocaleString()}
        </span>
    </div>
);
