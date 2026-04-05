import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faList, faFileExcel, faChartBar, faUsers } from '@fortawesome/free-solid-svg-icons';
import DailyReportInput from './DailyReportInput';
import DailyReportListV2 from './DailyReportListV2';

const DailyReportPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const tab = searchParams.get('tab');
    const activeTab = tab === 'list' ? 'list-v2' : (tab || 'input');

    useEffect(() => {
        if (!tab) {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'input');
            setSearchParams(next, { replace: true });
            return;
        }

        if (tab === 'list') {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'list-v2');
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams, tab]);

    const handleTabChange = (nextTab: string) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', nextTab);
        setSearchParams(next);
    };

    const topTabs = [
        {
            key: 'status',
            label: '현황판',
            icon: faChartBar,
            active: false,
            onClick: () => navigate('/jeonkuk/integrated-status')
        },
        {
            key: 'input',
            label: '일보작성',
            icon: faPenToSquare,
            active: activeTab === 'input',
            onClick: () => handleTabChange('input')
        },
        {
            key: 'list-v2',
            label: '일보목록v2',
            icon: faList,
            active: activeTab === 'list-v2',
            onClick: () => handleTabChange('list-v2')
        },
        {
            key: 'history',
            label: '인원전체관리',
            icon: faUsers,
            active: false,
            onClick: () => navigate('/jeonkuk/total-history')
        }
    ];

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] font-['Pretendard']">
            {/* Page Header & Tabs */}
            <header className="bg-white border-b border-slate-200 px-6 pt-6 pb-0 flex-shrink-0 flex items-end justify-between gap-4">
                <div className="flex items-end gap-8 overflow-x-auto">
                    <h1 className="text-2xl font-bold text-slate-800 pb-3 whitespace-nowrap">출력일보 관리</h1>

                    <div className="flex gap-6">
                        {topTabs.map((item) => (
                            <button
                                key={item.key}
                                onClick={item.onClick}
                                className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${item.active
                                    ? 'border-brand-600 text-brand-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FontAwesomeIcon icon={item.icon} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => navigate('/mass-upload/daily-report')}
                    className="pb-3 text-sm font-bold border-b-2 border-transparent text-green-600 hover:text-green-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <FontAwesomeIcon icon={faFileExcel} />
                    엑셀 일괄 등록
                </button>
            </header>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {activeTab === 'input' ? (
                    <DailyReportInput />
                ) : (
                    <div className="h-full min-h-0 p-4 md:p-6">
                        <DailyReportListV2 initialDate={searchParams.get('date') || undefined} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportPage;
