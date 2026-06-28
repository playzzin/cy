import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { manpowerService } from '../services/manpowerService';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardExecutiveView } from '../components/dashboard/DashboardExecutiveView';
import { DashboardFieldView } from '../components/dashboard/DashboardFieldView';
import { DashboardMessageWidget } from '../components/messages/DashboardMessageWidget';
import { TomorrowScheduleWidget } from '../components/dashboard/widgets/TomorrowScheduleWidget';
import { QuickActionsWidget } from '../components/dashboard/widgets/QuickActionsWidget';
import { DashboardPersonalWidgets } from '../components/dashboard/DashboardPersonalWidgets';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useSiteMode } from '../contexts/SiteModeContext';
import {
    getDashboardModeConfigForPosition,
} from '../components/dashboard/roleDashboardConfig';

const DashboardPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { currentPosition, currentPositionData, positions, changePosition } = useSiteMode();
    const [loading, setLoading] = useState(true);
    const [linkedWorker, setLinkedWorker] = useState<any>(null);

    useEffect(() => {
        const initDashboard = async () => {
            if (!currentUser?.uid) {
                setLoading(false);
                return;
            }

            try {
                const worker = await manpowerService.getWorkerByUid(currentUser.uid);
                setLinkedWorker(worker);

            } catch (error) {
                console.error("Dashboard initialization failed", error);
            } finally {
                setLoading(false);
            }
        };

        initDashboard();
    }, [currentUser]);

    const selectedPositionName =
        currentPositionData?.name || (currentPosition === 'full' ? '전체 메뉴' : linkedWorker?.role);
    const modeConfig = getDashboardModeConfigForPosition(currentPosition, selectedPositionName);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-brand-600 mb-4" />
                    <p className="text-slate-500 font-medium">시스템 데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    // Optional: Profile Setup Check
    // if (!linkedWorker) {
    //     return (
    //         <div className="p-8 bg-slate-50 min-h-screen">
    //             <ProfileSetup onComplete={() => window.location.reload()} />
    //         </div>
    //     );
    // }

    return (
        <div className="min-h-screen bg-slate-50 font-['Pretendard']">
            <DashboardHeader
                user={linkedWorker || { name: '관리자', role: '최고관리자' }}
                modeConfig={modeConfig}
                positions={positions}
                currentPosition={currentPosition}
                onPositionChange={changePosition}
            />

            <main className="w-full px-6 -mt-16 pb-12 relative z-10 overflow-hidden">
                <DashboardMessageWidget />
                <div className="mb-6">
                    <TomorrowScheduleWidget />
                </div>
                <div className="mb-8">
                    <QuickActionsWidget modeConfig={modeConfig} />
                </div>
                <DashboardPersonalWidgets modeConfig={modeConfig} />

                <AnimatePresence mode="wait">
                    {modeConfig.layout === 'executive' ? (
                        <motion.div
                            key={`${currentPosition}-${modeConfig.id}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <DashboardExecutiveView modeConfig={modeConfig} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`${currentPosition}-${modeConfig.id}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <DashboardFieldView modeConfig={modeConfig} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default DashboardPage;
