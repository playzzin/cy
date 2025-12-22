import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import AIConfigurationSection from './settings/AIConfigurationSection';
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
                    <SystemConfigurationSection />
                    <UserAndRoleManagementSection />
                    <AIConfigurationSection />
                    <DataManagementSection />
                </div>
            </main>
        </div>
    );
};

export default SettingsPage;
