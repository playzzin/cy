import React from 'react';

interface MonthlyWagePaymentPageProps {
    hideHeader?: boolean;
}

const MonthlyWagePaymentPage: React.FC<MonthlyWagePaymentPageProps> = ({ hideHeader = false }) => {
    return (
        <div className="p-6">
            {!hideHeader && (
                <h1 className="text-2xl font-semibold text-gray-900">월급제 지급 준비 중</h1>
            )}
            <p className="mt-2 text-sm text-gray-600">현재 페이지는 리뉴얼 작업 중입니다. 곧 새로운 인터페이스로 제공될 예정입니다.</p>
        </div>
    );
};

export default MonthlyWagePaymentPage;
