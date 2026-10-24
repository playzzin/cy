import React from 'react';
import AppIntroScreen from '../../components/common/AppIntroScreen';

const MonthlyWageDraftPage = React.lazy(() => import('./MonthlyWageDraftPage'));

interface MonthlyWagePaymentPageProps {
    hideHeader?: boolean;
}

const MonthlyWagePaymentPage: React.FC<MonthlyWagePaymentPageProps> = ({ hideHeader = false }) => {
    return (
        <React.Suspense fallback={<AppIntroScreen message="월급제 지급 화면을 불러오고 있습니다" />}>
            <MonthlyWageDraftPage hideHeader={hideHeader} />
        </React.Suspense>
    );
};

export default MonthlyWagePaymentPage;
