import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import ProgressClaimPage from './ProgressClaimPage';

const LEGACY_BUYBACK_TABS = new Set(['buyback', 'sukumi', 'allocations', 'allocation']);

/**
 * 기성관리 안에서 운영하던 현장별 바이백 화면은 더 이상 사용하지 않습니다.
 * 기존 즐겨찾기 URL은 관계자별 엑셀형 바이백으로만 전달합니다.
 */
const ProgressClaimsEntry: React.FC = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const requestedTab = String(params.get('tab') ?? '').trim().toLowerCase();

    if (LEGACY_BUYBACK_TABS.has(requestedTab)) {
        const buybackParams = new URLSearchParams();
        ['month', 'yearMonth'].forEach((key) => {
            const value = params.get(key);
            if (value) buybackParams.set(key, value);
        });
        const search = buybackParams.toString();
        return <Navigate to={`/payroll/field-buyback${search ? `?${search}` : ''}`} replace />;
    }

    return <ProgressClaimPage />;
};

export default ProgressClaimsEntry;
