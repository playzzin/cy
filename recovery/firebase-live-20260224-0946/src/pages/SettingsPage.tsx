import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faRobot, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import UserAndRoleManagementSection from './settings/UserAndRoleManagementSection';
import DataManagementSection from './settings/DataManagementSection';

import SystemConfigurationSection from './settings/SystemConfigurationSection';

const SettingsPage: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                <FontAwesomeIcon icon={faCog} className="text-slate-400" />
                <h2 className="text-lg font-bold text-slate-800">설정</h2>
            </header>

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faRobot} className="text-indigo-600" />
                                    AI 설정 분리 관리
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Gemini 모델 선택, 현재 사용 모델 확인, 페이지별 AI 사용 제어를 전용 페이지에서 관리합니다.
                                </p>
                            </div>
                            <Link
                                to="/settings/ai"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                            >
                                AI 설정 페이지 이동
                                <FontAwesomeIcon icon={faChevronRight} />
                            </Link>
                        </div>
                    </section>
                    <SystemConfigurationSection />
                    <UserAndRoleManagementSection />
                    <DataManagementSection />
                </div>
            </main>
        </div>
    );
};

export default SettingsPage;
