import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import {
    CompanyDataScope,
    createBlockedCompanyDataScope,
    createLoadingCompanyDataScope,
    resolveCompanyDataScope,
} from '../utils/companyDataScope';

/**
 * 외부 회사 계정의 공통 데이터 범위 훅.
 * 신규 메뉴는 이 훅의 scope를 조회 서비스와 화면 필터 양쪽에 전달한다.
 */
export const useCompanyDataScope = (): CompanyDataScope => {
    const { currentUser, loading: authLoading } = useAuth();
    const [scope, setScope] = useState<CompanyDataScope>(() => createLoadingCompanyDataScope());

    useEffect(() => {
        let mounted = true;

        const loadScope = async () => {
            if (authLoading) {
                if (mounted) setScope(createLoadingCompanyDataScope());
                return;
            }

            if (!currentUser?.uid) {
                if (mounted) setScope(createBlockedCompanyDataScope());
                return;
            }

            if (mounted) setScope(createLoadingCompanyDataScope());
            try {
                const profile = await userService.getUser(currentUser.uid);
                if (mounted) setScope(resolveCompanyDataScope(profile));
            } catch (error) {
                console.error('[useCompanyDataScope] failed to load user profile', error);
                if (mounted) setScope(createBlockedCompanyDataScope());
            }
        };

        void loadScope();
        return () => {
            mounted = false;
        };
    }, [authLoading, currentUser?.uid]);

    return scope;
};
