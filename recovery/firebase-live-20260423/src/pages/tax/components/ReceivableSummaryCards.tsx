import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoins, faHandHoldingDollar, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';

type SummaryProps = {
    summary: {
        totalReceivables: number;
        totalCollected: number;
        outstandingAmount: number;
    };
};

export const ReceivableSummaryCards: React.FC<SummaryProps> = ({ summary }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total Receivables */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faCoins} className="mr-2" />
                    총 미수금액
                </h3>
                <div className="text-2xl font-extrabold text-slate-800">
                    {summary.totalReceivables.toLocaleString()}원
                </div>
            </div>

            {/* Collected Amount */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-emerald-600 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faHandHoldingDollar} className="mr-2" />
                    수금 완료금액
                </h3>
                <div className="text-2xl font-extrabold text-emerald-600">
                    {summary.totalCollected.toLocaleString()}원
                </div>
            </div>

            {/* Outstanding Amount */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="mr-2" />
                    미수 잔액
                </h3>
                <div className="text-2xl font-extrabold text-red-600">
                    {summary.outstandingAmount.toLocaleString()}원
                </div>
            </div>
        </div>
    );
};
