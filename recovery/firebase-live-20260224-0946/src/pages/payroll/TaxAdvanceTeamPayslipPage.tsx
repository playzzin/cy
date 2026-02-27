import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar } from '@fortawesome/free-solid-svg-icons';
import TeamLaborCostInvoice from './TeamLaborCostInvoice';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { manpowerService } from '../../services/manpowerService';
import { companyService } from '../../services/companyService';
import { UserRole } from '../../types/roles';

const TaxAdvanceTeamPayslipPage: React.FC = () => {
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

        void resolveAccess();
        return () => {
            isCancelled = true;
        };
    }, [currentUser]);

    if (canUseTeamStatement === null) {
        return (
            <div className="flex flex-col h-full bg-[#f1f5f9]">
                <div className="bg-white border-b border-slate-200 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">세금/가불/분리 계산</h1>
                                <p className="text-sm text-slate-500">권한을 확인하는 중입니다...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-white border border-slate-200 rounded-lg p-6 text-slate-700">
                        잠시만 기다려주세요.
                    </div>
                </div>
            </div>
        );
    }

    if (canUseTeamStatement === false) {
        return (
            <div className="flex flex-col h-full bg-[#f1f5f9]">
                <div className="bg-white border-b border-slate-200 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">세금/가불/분리 계산</h1>
                                <p className="text-sm text-slate-500">세금/가불/분리 계산 기준으로 팀장별 명세서를 조회하고 출력합니다.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-white border border-slate-200 rounded-lg p-6 text-slate-700">
                        시공사 계정만 세금/가불/분리 계산을 사용할 수 있습니다.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600 text-xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">세금/가불/분리 계산</h1>
                            <p className="text-sm text-slate-500">세금/가불/분리 계산 기준으로 팀장별 명세서를 조회하고 출력합니다.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <TeamLaborCostInvoice hideHeader={true} />
            </div>
        </div>
    );
};

export default TaxAdvanceTeamPayslipPage;
