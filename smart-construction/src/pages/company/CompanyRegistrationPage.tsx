import React from 'react';
import CompanyManagement from '../../components/company/CompanyManagement';

const CompanyRegistrationPage: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] font-['Pretendard']">
            <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">회사DB 관리</h1>
                </div>
            </header>
            <main className="flex-1 overflow-hidden flex flex-col">
                <CompanyManagement />
            </main>
        </div>
    );
};

export default CompanyRegistrationPage;
