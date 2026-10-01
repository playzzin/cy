import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminAccessRole, uniqueAccessRoles } from '../../utils/accessRoles';
import { PagePrimaryAccountState } from '../../hooks/usePagePrimaryAccount';
import { PRIMARY_ACCOUNT_PAGES, primaryAccountService, PrimaryAccountSetting } from '../../services/primaryAccountService';
import { loadPrimaryAccountOptions } from '../../services/primaryAccountOptions';

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const emptyAccount: PrimaryAccountSetting = { sourceType: 'custom', sourceId: '', sourceName: '', bankName: '', accountHolder: '', accountNumber: '' };
const sourceLabels = { company: '회사', team: '팀', worker: '작업자', custom: '기타' };

export default function PagePrimaryAccountCard({ state, fallbackAccount, showPageLink = false }: {
    state: PagePrimaryAccountState;
    fallbackAccount?: Pick<PrimaryAccountSetting, 'bankName' | 'accountHolder' | 'accountNumber'>;
    showPageLink?: boolean;
}) {
    const { currentUser } = useAuth();
    const [canEdit, setCanEdit] = useState(false);
    const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState(emptyAccount), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [options, setOptions] = useState<PrimaryAccountSetting[] | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false), [optionsLoading, setOptionsLoading] = useState(false), [optionsError, setOptionsError] = useState(''), [query, setQuery] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null), saving = useRef(false);
    const pickerRequest = useRef(0);
    const id = useId();
    const page = PRIMARY_ACCOUNT_PAGES.find(item => item.id === state.scope);
    const title = page?.label ?? '공통 대표계좌';
    const shown = state.account ?? (!state.loading && !state.error && fallbackAccount?.accountNumber ? { ...emptyAccount, ...fallbackAccount } : null);
    const disabled = state.loading || !!state.error || !canEdit;

    useEffect(() => {
        let active = true;
        setCanEdit(false);
        if (currentUser) void currentUser.getIdTokenResult().then(({ claims }) => {
            if (active) setCanEdit(uniqueAccessRoles([claims.role, claims.roles, claims.systemRole, claims.position, claims.additionalPositions]).some(isAdminAccessRole));
        }).catch(() => { if (active) setCanEdit(false); });
        return () => { active = false; };
    }, [currentUser]);

    useEffect(() => {
        setEditing(false); setNotice(''); setOptions(null);
        return () => { pickerRequest.current += 1; };
    }, [state.scope]);

    useEffect(() => {
        if (!editing) return;
        const previous = document.activeElement as HTMLElement | null;
        dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
        return () => previous?.focus();
    }, [editing]);

    const openEditor = () => {
        setDraft(shown ? { ...shown } : { ...emptyAccount });
        setError(''); setNotice(''); setPickerOpen(false); setQuery(''); setEditing(true);
    };
    const openPicker = async () => {
        setPickerOpen(true);
        if (options && !optionsError) return;
        const request = ++pickerRequest.current;
        setOptionsLoading(true); setOptionsError('');
        try {
            const result = await loadPrimaryAccountOptions();
            if (request !== pickerRequest.current) return;
            setOptions(result.accounts);
            if (result.partialFailure) setOptionsError('일부 계좌 목록을 불러오지 못했습니다. 직접 입력하거나 다시 불러와 주세요.');
        } catch {
            if (request === pickerRequest.current) setOptionsError('계좌 목록을 불러오지 못했습니다. 직접 입력할 수 있습니다.');
        } finally {
            if (request === pickerRequest.current) setOptionsLoading(false);
        }
    };
    const save = async () => {
        if (saving.current || disabled) return;
        if (![draft.bankName, draft.accountHolder, draft.accountNumber].every(value => value.trim())) {
            setError('은행, 예금주, 계좌번호를 모두 입력해 주세요.'); return;
        }
        saving.current = true; setBusy(true); setError('');
        try {
            await primaryAccountService.setPrimaryAccount({ ...draft, sourceName: draft.sourceName || `${title} 직접 등록` }, state.scope);
            setEditing(false); setNotice('저장했습니다. 이 페이지의 대표계좌에 반영됩니다.');
        } catch {
            setError('저장하지 못했습니다. 연결 상태와 수정 권한을 확인하고 다시 시도해 주세요.');
        } finally { saving.current = false; setBusy(false); }
    };
    const filtered = (options ?? []).filter(account => `${account.sourceName} ${account.bankName} ${account.accountHolder} ${account.accountNumber}`.replace(/\s/g, '').toLocaleLowerCase().includes(query.replace(/\s/g, '').toLocaleLowerCase()));
    const change = (key: 'bankName' | 'accountHolder' | 'accountNumber', value: string) => setDraft(current => ({ ...current, [key]: value }));

    return <section aria-label={`${title} 대표계좌`} className="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-slate-900 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
                <div className="text-xs font-bold text-indigo-800">{showPageLink ? title : state.scope === 'common' ? title : `이 페이지 대표계좌 · ${state.scope === 'monthly-wage' ? '국민은행 이체용' : '노임명세서 위임용'}`}</div>
                <div className="mt-1 break-all text-sm font-semibold">{state.loading ? '불러오는 중…' : state.error ? '확인 필요' : shown ? `${shown.bankName} ${shown.accountNumber} · ${shown.accountHolder}` : '등록된 계좌 없음'}</div>
                {!state.loading && !state.error && <div className="mt-1 text-xs text-slate-500">{state.scope === 'common' ? '별도 계좌가 없는 기존 연결 페이지의 기본값' : state.pageAccount ? '페이지 전용 · 계좌 관리에서도 수정 가능' : state.usesCommon ? '현재 공통계좌 사용 중 · 따로 등록하면 이 페이지에만 적용' : shown ? '기존 위임계좌 사용 중 · 등록하면 다른 기기에서도 사용' : '이 페이지에서 사용할 계좌를 등록해 주세요.'}</div>}
            </div>
            <div className="flex shrink-0 gap-2">
                {showPageLink && page && <a href={page.path} className={button}>페이지 열기</a>}
                {canEdit && <button type="button" onClick={openEditor} disabled={disabled} className={button}>{state.pageAccount ? '변경' : '계좌 등록'}</button>}
            </div>
        </div>
        {!canEdit && !state.loading && <p className="mt-2 text-xs text-slate-500">대표계좌 등록·변경은 관리자에게 요청해 주세요.</p>}
        {state.error && <div role="alert" className="mt-2 text-sm text-red-700">{state.error} <button type="button" onClick={state.retry} className="underline">다시 시도</button></div>}
        {notice && <p role="status" className="mt-2 text-xs text-emerald-700">{notice}</p>}
        {editing && createPortal(<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4 print:hidden">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onKeyDown={event => {
                if (event.key === 'Escape' && !busy) { event.stopPropagation(); setEditing(false); }
                if (event.key === 'Tab') {
                    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]');
                    const first = controls?.[0], last = controls?.[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }
            }}>
                <h2 id={`${id}-title`} className="text-lg font-bold text-slate-900">{title} 대표계좌</h2>
                <p className="mt-1 text-sm text-slate-500">{state.scope === 'common' ? '공통계좌를 사용하는 페이지에 적용됩니다.' : '저장하면 이 페이지에만 적용됩니다.'}</p>
                <fieldset disabled={busy} className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">은행<input value={draft.bankName} onChange={event => change('bankName', event.target.value)} placeholder="예: 국민은행" maxLength={80} autoComplete="off" className={field} /></label>
                    <label className="block text-sm font-semibold text-slate-700">예금주<input value={draft.accountHolder} onChange={event => change('accountHolder', event.target.value)} placeholder="통장에 표시된 이름" maxLength={100} autoComplete="off" className={field} /></label>
                    <label className="block text-sm font-semibold text-slate-700">계좌번호<input value={draft.accountNumber} onChange={event => change('accountNumber', event.target.value)} placeholder="하이픈 포함 입력 가능" maxLength={100} autoComplete="off" className={field} /></label>
                    <button type="button" onClick={() => void openPicker()} className={`${button} w-full`}>등록된 계좌에서 가져오기</button>
                    {pickerOpen && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <label className="text-xs font-semibold text-slate-600">계좌 검색<input value={query} onChange={event => setQuery(event.target.value)} placeholder="회사·팀·이름·계좌번호 검색" className={field} /></label>
                        {optionsLoading && <p role="status" className="py-2 text-sm text-slate-500">계좌 목록을 불러오는 중…</p>}
                        {optionsError && <p role="alert" className="py-2 text-xs text-red-700">{optionsError}</p>}
                        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                            {!optionsLoading && !filtered.length && <p className="py-2 text-sm text-slate-500">검색된 계좌가 없습니다. 위에 직접 입력해 주세요.</p>}
                            {filtered.slice(0, 60).map((account, index) => <button key={`${account.sourceType}:${account.sourceId}:${index}`} type="button" className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-700 hover:border-indigo-400" onClick={() => { setDraft({ ...account }); setPickerOpen(false); setError(''); }}>
                                <span className="font-bold">{sourceLabels[account.sourceType]} · {account.sourceName || account.accountHolder}</span><span className="mt-1 block break-all">{account.bankName} {account.accountNumber} · {account.accountHolder}</span>
                            </button>)}
                            {filtered.length > 60 && <p className="text-xs text-slate-500">60개까지 표시합니다. 검색어를 입력하면 더 쉽게 찾을 수 있습니다.</p>}
                        </div>
                    </div>}
                </fieldset>
                {(error || state.error) && <p role="alert" className="mt-3 text-sm text-red-700">{error || state.error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(false)} disabled={busy} className={button}>취소</button>
                    <button type="button" onClick={() => void save()} disabled={busy || disabled} className={`${button} !border-indigo-600 !bg-indigo-600 !text-white`}>{busy ? '저장 중…' : '대표계좌 저장'}</button>
                </div>
            </div>
        </div>, document.body)}
    </section>;
}
