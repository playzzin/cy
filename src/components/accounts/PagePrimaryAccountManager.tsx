import React from 'react';
import { PRIMARY_ACCOUNT_PAGES, PrimaryAccountScope } from '../../services/primaryAccountService';
import { usePagePrimaryAccount } from '../../hooks/usePagePrimaryAccount';
import PagePrimaryAccountCard from './PagePrimaryAccountCard';

export function PagePrimaryAccountSettings({ scope, showPageLink = false, compact = false }: { scope: PrimaryAccountScope; showPageLink?: boolean; compact?: boolean }) {
    const state = usePagePrimaryAccount(scope);
    return <PagePrimaryAccountCard state={state} showPageLink={showPageLink} compact={compact} />;
}

export default function PagePrimaryAccountManager() {
    return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">페이지별 대표계좌</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">페이지마다 다른 계좌를 등록할 수 있습니다. 여기서 변경하면 해당 페이지에도 바로 반영됩니다.</p>
        <div className="grid gap-3 xl:grid-cols-2">
            {PRIMARY_ACCOUNT_PAGES.map(page => <PagePrimaryAccountSettings key={page.id} scope={page.id} showPageLink />)}
        </div>
        <details className="mt-4 rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600">기존 공통 대표계좌</summary>
            <div className="mt-3"><PagePrimaryAccountSettings scope="common" showPageLink /></div>
        </details>
    </section>;
}
