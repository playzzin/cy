import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faBuilding, faUserTie } from '@fortawesome/free-solid-svg-icons';
import SiteLaborCostInvoice from './SiteLaborCostInvoice';
import TeamLaborCostInvoice from './TeamLaborCostInvoice';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { manpowerService } from '../../services/manpowerService';
import { companyService } from '../../services/companyService';
import { UserRole } from '../../types/roles';

type TabType = 'site' | 'team';

const StatementManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('site');
    const [searchParams] = useSearchParams();
    const { currentUser } = useAuth();
    const [canUseTeamStatement, setCanUseTeamStatement] = useState<boolean | null>(null);

    useEffect(() => {
        let isCancelled = false;

        const resolveAccess = async () => {
            if (!currentUser) {
                if (!isCancelled) setCanUseTeamStatement(false);
                return;
            }

            try {
                const user = await userService.getUser(currentUser.uid);
                const role = user?.role;
                const isAdminRole = role === 'admin' || role === UserRole.ADMIN;
                if (isAdminRole) {
                    if (!isCancelled) setCanUseTeamStatement(true);
                    return;
                }

                const worker = await manpowerService.getWorkerByUid(currentUser.uid);
                const companyId = worker?.companyId;
                if (!companyId) {
                    if (!isCancelled) setCanUseTeamStatement(false);
                    return;
                }

                const company = await companyService.getCompanyById(companyId);
                if (!isCancelled) setCanUseTeamStatement(company?.type === '시공사');
            } catch {
                if (!isCancelled) setCanUseTeamStatement(false);
            }
        };

        resolveAccess();
        return () => {
            isCancelled = true;
        };
    }, [currentUser]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab !== 'site' && tab !== 'team') return;

        if (tab === 'team') {
            if (canUseTeamStatement === true) {
                setActiveTab('team');
                return;
            }
            setActiveTab('site');
            return;
        }

        setActiveTab('site');
    }, [searchParams, canUseTeamStatement]);

    const renderContent = () => {
        switch (activeTab) {
            case 'site':
                return <SiteLaborCostInvoice hideHeader={true} />;
            case 'team':
                if (canUseTeamStatement !== true) return <SiteLaborCostInvoice hideHeader={true} />;
                return <TeamLaborCostInvoice hideHeader={true} />;
            default:
                return <SiteLaborCostInvoice hideHeader={true} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">명세서 관리</h1>
                        <p className="text-sm text-slate-500">현장별, 팀장별 명세서를 조회하고 출력합니다.</p>
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
                    {canUseTeamStatement === true && (
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'team'
                                    ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                                }
                        `}
                        >
                            <FontAwesomeIcon icon={faUserTie} />
                            세금/가불/분리 계산
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
                {renderContent()}
            </div>
        </div>
    );
};

export default StatementManagementPage;
