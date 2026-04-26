import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faWallet } from '@fortawesome/free-solid-svg-icons';

type SummaryProps = {
    totalDeposit: number;
    totalWithdraw: number;
    latestBalance: number;
};

export const AccountSummaryCards: React.FC<SummaryProps> = ({ totalDeposit, totalWithdraw, latestBalance }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Deposit */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-red-500 mb-1 flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowDown} />
                        총 입금액
                    </h3>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">
                        {totalDeposit.toLocaleString()}
                        <span className="text-sm font-normal text-slate-500 ml-1">원</span>
                    </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                    <FontAwesomeIcon icon={faArrowDown} />
                </div>
            </div>

            {/* Withdraw */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-blue-500 mb-1 flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowUp} />
                        총 출금액
                    </h3>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">
                        {totalWithdraw.toLocaleString()}
                        <span className="text-sm font-normal text-slate-500 ml-1">원</span>
                    </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <FontAwesomeIcon icon={faArrowUp} />
                </div>
            </div>

            {/* Balance */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-emerald-600 mb-1 flex items-center gap-2">
                        <FontAwesomeIcon icon={faWallet} />
                        현재 잔액 (최신)
                    </h3>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">
                        {latestBalance.toLocaleString()}
                        <span className="text-sm font-normal text-slate-500 ml-1">원</span>
                    </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FontAwesomeIcon icon={faWallet} />
                </div>
            </div>
        </div>
    );
};
