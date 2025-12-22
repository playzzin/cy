import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap, faUserGear, faUserTie } from '@fortawesome/free-solid-svg-icons';
import PositionDefinition from '../../components/hr/PositionDefinition';
import PositionAssignment from '../../components/hr/PositionAssignment';

type TabType = 'management' | 'assignment';

const PositionSystemPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('assignment');

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faSitemap} className="text-brand-600" />
                        직책 통합 관리 시스템
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        시스템의 직책을 정의하고 인원에게 배정하는 통합 관리 페이지입니다.
                    </p>
                </div>

                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
                    <button
                        onClick={() => setActiveTab('assignment')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'assignment'
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faUserTie} />
                        직책 배정
                    </button>
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'management'
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faUserGear} />
                        직책 관리 (설정)
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {activeTab === 'assignment' ? (
                    <PositionAssignment />
                ) : (
                    <PositionDefinition />
                )}
            </div>
        </div>
    );
};

export default PositionSystemPage;
