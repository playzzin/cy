import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faBuilding, faUser } from '@fortawesome/free-solid-svg-icons';
import SiteLaborCostInvoice from './SiteLaborCostInvoice';
import WorkerLaborCostInvoice from './WorkerLaborCostInvoice';

type TabType = 'site' | 'worker';

const PayslipPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('worker');
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'site' || tab === 'worker') {
            setActiveTab(tab as TabType);
        }
    }, [searchParams]);

    const renderContent = () => {
        switch (activeTab) {
            case 'site':
                return <SiteLaborCostInvoice hideHeader={true} />;
            case 'worker':
                return <WorkerLaborCostInvoice hideHeader={true} />;
            default:
                return <WorkerLaborCostInvoice hideHeader={true} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600 text-xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">명세서 관리</h1>
                            <p className="text-sm text-slate-500">현장별, 작업자별 명세서를 조회하고 출력합니다.</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                    <button
                        onClick={() => setActiveTab('site')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'site'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faBuilding} />
                        현장별 명세서
                    </button>
                    <button
                        onClick={() => setActiveTab('worker')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'worker'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faUser} />
                        작업자 명세서
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

export default PayslipPage;
