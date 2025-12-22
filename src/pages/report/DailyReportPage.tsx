import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faList } from '@fortawesome/free-solid-svg-icons';
import DailyReportInput from './DailyReportInput';
import DailyReportList from './DailyReportList';

const DailyReportPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'input';

    const tab = searchParams.get('tab');

    useEffect(() => {
        if (!tab) {
            setSearchParams({ tab: 'input' }, { replace: true });
        }
    }, [tab, setSearchParams]);

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] font-['Pretendard']">
            {/* Page Header & Tabs */}
            <header className="bg-white border-b border-slate-200 px-6 pt-6 pb-0 flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-slate-800 pb-3">출력일보 관리</h1>

                    <div className="flex gap-6">
                        <button
                            onClick={() => handleTabChange('input')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'input'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={faPenToSquare} />
                            일보작성
                        </button>
                        <button
                            onClick={() => handleTabChange('list')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'list'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={faList} />
                            일보목록
                        </button>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'input' ? (
                    <DailyReportInput />
                ) : (
                    <div className="h-full p-4 md:p-6 overflow-auto">
                        <DailyReportList initialDate={searchParams.get('date') || undefined} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportPage;
