import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { PRIMARY_ACCOUNT_PAGES, PrimaryAccountScope } from '../../services/primaryAccountService';
import { usePagePrimaryAccount } from '../../hooks/usePagePrimaryAccount';
import PagePrimaryAccountCard from './PagePrimaryAccountCard';

export function PagePrimaryAccountSettings({ scope, showPageLink = false, compact = false }: { scope: PrimaryAccountScope; showPageLink?: boolean; compact?: boolean }) {
    const state = usePagePrimaryAccount(scope);
    return <PagePrimaryAccountCard state={state} showPageLink={showPageLink} compact={compact} />;
}

export default function PagePrimaryAccountManager() {
    return <details open={false} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 [&::-webkit-details-marker]:hidden">
            <h2 className="text-sm font-bold text-slate-900">페이지별 대표계좌</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{PRIMARY_ACCOUNT_PAGES.length}개 페이지</span>
            <span className="ml-auto text-xs font-medium text-slate-500">
                <span className="group-open:hidden">펼치기</span>
                <span className="hidden group-open:inline">접기</span>
            </span>
            <FontAwesomeIcon icon={faChevronDown} className="text-xs text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 p-4">
            <p className="mb-4 text-sm text-slate-500">페이지마다 다른 계좌를 등록할 수 있습니다. 여기서 변경하면 해당 페이지에도 바로 반영됩니다.</p>
            <div className="grid gap-3 xl:grid-cols-2">
                {PRIMARY_ACCOUNT_PAGES.map(page => <PagePrimaryAccountSettings key={page.id} scope={page.id} showPageLink />)}
            </div>
            <details className="mt-4 rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600">기존 공통 대표계좌</summary>
                <div className="mt-3"><PagePrimaryAccountSettings scope="common" showPageLink /></div>
            </details>
        </div>
    </details>;
}
