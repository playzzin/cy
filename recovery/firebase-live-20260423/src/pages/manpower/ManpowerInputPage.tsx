import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import WorkerManagement from '../../components/manpower/WorkerManagement';
import SiteManagement from '../../components/manpower/SiteManagement';
import TeamManagement from '../../components/manpower/TeamManagement';

const ManpowerInputPage: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] font-['Pretendard']">
            {/* Top Navigation / Header */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        <FontAwesomeIcon icon={faLayerGroup} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">청연 <span className="text-brand-600">ENG ERP</span></h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col">
                <WorkerManagement />
            </main>
        </div>
    );
};

export default ManpowerInputPage;
