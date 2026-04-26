import React, { useState, useEffect } from 'react';
import DailyWagePaymentPage from './DailyWagePaymentPage';
import MonthlyWagePaymentPage from './MonthlyWagePaymentPage';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBillWave, faCalendarDay, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';

type TabType = 'daily' | 'monthly';

const WagePaymentPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('daily');
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'daily' || tab === 'monthly') {
            setActiveTab(tab as TabType);
        }
    }, [searchParams]);

    const renderContent = () => {
        switch (activeTab) {
            case 'daily':
                return <DailyWagePaymentPage hideHeader={true} />;

            case 'monthly':
                return <MonthlyWagePaymentPage hideHeader={true} />;

            default:
                return <DailyWagePaymentPage hideHeader={true} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faMoneyBillWave} className="text-blue-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">급여 지급 관리</h1>
                        <p className="text-sm text-slate-500">일급, 주급, 월급제 근로자의 급여를 관리하고 각종 청구서를 출력합니다.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'daily'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faCalendarDay} />
                        일급제
                    </button>

                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'monthly'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        월급제
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
                {renderContent()}
            </div>
        </div>
    );
};

export default WagePaymentPage;
