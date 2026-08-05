import React, { Suspense, useMemo } from 'react';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { RoleFocusPanel } from '../components/dashboard/RoleFocusPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useSiteMode } from '../contexts/SiteModeContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useLinkedWorker } from '../hooks/useLinkedWorker';
import { lazyNamed } from '../utils/lazyNamed';
import {
    getDashboardModeConfigForPosition,
} from '../components/dashboard/roleDashboardConfig';
import { findBusinessPartnerPositionDefinition } from '../constants/businessPartnerPositions';

const DashboardExecutiveView = lazyNamed(
    () => import('../components/dashboard/DashboardExecutiveView'),
    'DashboardExecutiveView'
);
const DashboardFieldView = lazyNamed(
    () => import('../components/dashboard/DashboardFieldView'),
    'DashboardFieldView'
);
const DashboardMessageWidget = lazyNamed(
    () => import('../components/messages/DashboardMessageWidget'),
    'DashboardMessageWidget'
);
const TomorrowScheduleWidget = lazyNamed(
    () => import('../components/dashboard/widgets/TomorrowScheduleWidget'),
    'TomorrowScheduleWidget'
);
const QuickActionsWidget = lazyNamed(
    () => import('../components/dashboard/widgets/QuickActionsWidget'),
    'QuickActionsWidget'
);
const DashboardPersonalWidgets = lazyNamed(
    () => import('../components/dashboard/DashboardPersonalWidgets'),
    'DashboardPersonalWidgets'
);
const MobileFieldCommandBar = lazyNamed(
    () => import('../components/dashboard/MobileFieldCommandBar'),
    'MobileFieldCommandBar'
);
const ClientDashboardView = React.lazy(() => import('../components/dashboard/ClientDashboardView'));
const RentalDashboardView = React.lazy(() => import('../components/dashboard/RentalDashboardView'));
const TeamLeadDashboardView = React.lazy(() => import('../components/dashboard/TeamLeadDashboardView'));
const ForemanDashboardView = React.lazy(() => import('../components/dashboard/ForemanDashboardView'));
const WorkerDashboardView = React.lazy(() => import('../components/dashboard/WorkerDashboardView'));

const DashboardLoadingState: React.FC = () => (
    <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
            <FontAwesomeIcon icon={faSpinner} spin className="mb-4 text-4xl text-brand-600" />
            <p className="font-medium text-slate-500">시스템 데이터를 불러오는 중입니다...</p>
        </div>
    </div>
);

const DashboardSectionFallback: React.FC<{ minHeight?: string; label?: string }> = ({
    minHeight = 'min-h-[160px]',
    label = '대시보드 섹션을 준비하는 중입니다.',
}) => (
    <div className={`${minHeight} flex items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm`}>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <FontAwesomeIcon icon={faSpinner} spin />
            {label}
        </div>
    </div>
);

const DashboardPage: React.FC = () => {
    const { currentPosition, currentPositionData, positions, changePosition } = useSiteMode();
    const { loading, linkedWorker } = useLinkedWorker();
    const linkedWorkerRole = (linkedWorker as { role?: string } | null)?.role;
    const selectedPositionName = useMemo(
        () => currentPositionData?.name || (currentPosition === 'full' ? '전체 메뉴' : linkedWorkerRole),
        [currentPosition, currentPositionData?.name, linkedWorkerRole]
    );
    const modeConfig = useMemo(
        () => getDashboardModeConfigForPosition(currentPosition, selectedPositionName),
        [currentPosition, selectedPositionName]
    );
    const isClientDashboard = useMemo(
        () => findBusinessPartnerPositionDefinition(currentPosition, selectedPositionName)?.id === 'client',
        [currentPosition, selectedPositionName]
    );
    const isRentalDashboard = useMemo(
        () => findBusinessPartnerPositionDefinition(currentPosition, selectedPositionName)?.id === 'rental',
        [currentPosition, selectedPositionName]
    );
    const isPartnerDashboard = isClientDashboard || isRentalDashboard;
    const isTeamLeadDashboard = modeConfig.id === 'teamLead';
    const isForemanDashboard = modeConfig.id === 'foreman';
    const isWorkerDashboard = modeConfig.id === 'worker';
    const isDedicatedFieldDashboard = isTeamLeadDashboard || isForemanDashboard || isWorkerDashboard;

    useDocumentMeta({
        title: `${modeConfig.shortLabel} 대시보드 | 청연ENG ERP`,
        description: `${modeConfig.label} 기준으로 현장, 일보, 공수, 업무 요청 운영 지표를 확인합니다.`,
        canonicalUrl: '/dashboard',
        image: '/icons/icon-512.png?v=20260524',
    });

    if (loading) {
        return <DashboardLoadingState />;
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

            <main className="relative z-10 mx-auto -mt-12 min-w-0 w-full max-w-none overflow-hidden px-3 pb-28 sm:-mt-16 sm:px-5 md:pb-12 lg:px-8 2xl:px-10">
                {isClientDashboard ? (
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[520px]" label="건설 현황을 준비하고 있습니다." />}>
                        <ClientDashboardView />
                    </Suspense>
                ) : isRentalDashboard ? (
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[520px]" label="임대 출고 현황을 준비하고 있습니다." />}>
                        <RentalDashboardView />
                    </Suspense>
                ) : isTeamLeadDashboard ? (
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[520px]" label="팀 운영 대시보드를 준비하고 있습니다." />}>
                        <TeamLeadDashboardView linkedWorker={linkedWorker} />
                    </Suspense>
                ) : isForemanDashboard ? (
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[520px]" label="현장 실행 대시보드를 준비하고 있습니다." />}>
                        <ForemanDashboardView linkedWorker={linkedWorker} />
                    </Suspense>
                ) : isWorkerDashboard ? (
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[520px]" label="개인 업무 대시보드를 준비하고 있습니다." />}>
                        <WorkerDashboardView linkedWorker={linkedWorker} />
                    </Suspense>
                ) : (
                    <>
                <div className="mb-6">
                    <RoleFocusPanel modeConfig={modeConfig} />
                </div>
                <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[128px]" label="메시지 위젯을 준비하는 중입니다." />}>
                    <DashboardMessageWidget />
                </Suspense>
                <div className="mb-6">
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[220px]" label="일정 위젯을 준비하는 중입니다." />}>
                        <TomorrowScheduleWidget />
                    </Suspense>
                </div>
                <div className="mb-8">
                    <Suspense fallback={<DashboardSectionFallback label="빠른 실행 메뉴를 준비하는 중입니다." />}>
                        <QuickActionsWidget modeConfig={modeConfig} />
                    </Suspense>
                </div>
                <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[320px]" label="개인 위젯 보드를 준비하는 중입니다." />}>
                    <DashboardPersonalWidgets modeConfig={modeConfig} />
                </Suspense>

                <div
                    key={`${currentPosition}-${modeConfig.id}`}
                    className="motion-safe:animate-fadeInUp"
                >
                    <Suspense fallback={<DashboardSectionFallback minHeight="min-h-[360px]" label="역할별 대시보드를 준비하는 중입니다." />}>
                        {modeConfig.layout === 'executive' ? (
                            <DashboardExecutiveView modeConfig={modeConfig} />
                        ) : (
                            <DashboardFieldView modeConfig={modeConfig} />
                        )}
                    </Suspense>
                </div>
                    </>
                )}
            </main>
            {!isPartnerDashboard && !isDedicatedFieldDashboard && modeConfig.layout === 'field' && (
                <Suspense fallback={null}>
                    <MobileFieldCommandBar modeConfig={modeConfig} />
                </Suspense>
            )}
        </div>
    );
};

export default DashboardPage;
