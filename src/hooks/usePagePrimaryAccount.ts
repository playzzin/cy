import { useEffect, useState } from 'react';
import { PRIMARY_ACCOUNT_PAGES, primaryAccountService, PrimaryAccountScope, PrimaryAccountSetting } from '../services/primaryAccountService';

export interface PagePrimaryAccountState {
    scope: PrimaryAccountScope;
    account: PrimaryAccountSetting | null;
    pageAccount: PrimaryAccountSetting | null;
    loading: boolean;
    error: string;
    usesCommon: boolean;
    retry: () => void;
}

export function ensurePagePrimaryAccountReady(state: PagePrimaryAccountState): boolean {
    if (!state.loading && !state.error) return true;
    window.alert(state.error || '대표계좌를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    return false;
}

export function usePagePrimaryAccount(scope: PrimaryAccountScope): PagePrimaryAccountState {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<Omit<PagePrimaryAccountState, 'retry'>>({ scope, account: null, pageAccount: null, loading: true, error: '', usesCommon: false });
    useEffect(() => {
        let active = true;
        let pageAccount: PrimaryAccountSetting | null = null;
        let commonAccount: PrimaryAccountSetting | null = null;
        let pageReady = false, commonReady = false, pageError = false, commonError = false;
        const useCommon = PRIMARY_ACCOUNT_PAGES.find(page => page.id === scope)?.useCommon ?? false;
        const publish = () => {
            if (!active) return;
            const loading = !pageReady || (!pageAccount && useCommon && !commonReady);
            const failed = pageError || (!pageAccount && useCommon && commonError);
            setState({ scope, pageAccount, account: failed || loading ? null : pageAccount ?? (useCommon ? commonAccount : null), loading,
                usesCommon: !pageAccount && useCommon && !!commonAccount && !failed && !loading,
                error: failed ? '대표계좌를 불러오지 못했습니다. 다시 시도해 주세요.' : '' });
        };
        publish();
        const stopPage = primaryAccountService.subscribe(account => {
            pageAccount = account; pageReady = true; pageError = false; publish();
        }, () => { pageAccount = null; pageReady = true; pageError = true; publish(); }, scope);
        const stopCommon = useCommon ? primaryAccountService.subscribe(account => {
            commonAccount = account; commonReady = true; commonError = false; publish();
        }, () => { commonAccount = null; commonReady = true; commonError = true; publish(); }) : undefined;
        return () => { active = false; stopPage(); stopCommon?.(); };
    }, [scope, attempt]);
    const current = state.scope === scope ? state : { scope, account: null, pageAccount: null, loading: true, error: '', usesCommon: false };
    return { ...current, retry: () => setAttempt(value => value + 1) };
}
