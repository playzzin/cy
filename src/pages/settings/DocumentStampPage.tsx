import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Stamp, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminAccessRole, uniqueAccessRoles } from '../../utils/accessRoles';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { companyService } from '../../services/companyService';
import { documentStampService, inspectStampFile } from '../../services/documentStampService';
import { createDefaultStampSettings, getStampCompanyScope, GLOBAL_STAMP_SCOPE, resolveStampAsset, STAMP_DOCUMENTS, StampAsset, StampCommand, StampSettings } from '../../features/document-stamps/model';

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} !border-indigo-600 bg-indigo-600 text-white hover:!bg-indigo-700`;
const defaultScopes = [{ key: GLOBAL_STAMP_SCOPE, name: '전체 회사 (공통)', company: '' }, { key: 'company-cheongyeon', name: '청연', company: '청연' }, { key: 'company-dawon', name: '다원', company: '다원' }];

function StampPreview({ asset, urls }: { asset: StampAsset | null; urls: Record<string, string> }) {
    const url = asset ? urls[asset.id] : '';
    return <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
        {url ? <img src={url} alt={asset?.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">{asset ? '이미지 미리보기 없음' : '지정된 도장 없음'}</span>}
    </div>;
}

function Dialog({ title, children, onClose, busy }: { title: string; children: React.ReactNode; onClose: () => void; busy: boolean }) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        return () => previous?.focus();
    }, []);
    return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl" onKeyDown={event => {
            if (event.key === 'Escape' && !busy) onClose();
            if (event.key === 'Tab') {
                const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
                const first = controls?.[0], last = controls?.[controls.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }}>
            <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button type="button" aria-label="닫기" disabled={busy} onClick={onClose} className={button}><X size={18} /></button></div>
            {children}
        </div>
    </div>;
}

export default function DocumentStampPage() {
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState<StampSettings>(createDefaultStampSettings);
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [canEdit, setCanEdit] = useState(false);
    const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loadError, setLoadError] = useState('');
    const [scope, setScope] = useState(GLOBAL_STAMP_SCOPE), [scopes, setScopes] = useState(defaultScopes);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [editor, setEditor] = useState<{ asset: StampAsset | null; revision: number } | null>(null);
    const [name, setName] = useState(''), [file, setFile] = useState<File | null>(null), [filePreview, setFilePreview] = useState(''), [checkingFile, setCheckingFile] = useState(false);
    const [deleting, setDeleting] = useState<StampAsset | null>(null), [replacement, setReplacement] = useState('');
    const [allId, setAllId] = useState(''), [confirmAll, setConfirmAll] = useState(false);
    const fileSerial = useRef(0), saving = useRef(false);
    const disabled = loading || busy || !canEdit || !!loadError;
    const selectedScope = scopes.find(item => item.key === scope) || defaultScopes[0];

    useEffect(() => {
        let active = true;
        setCanEdit(false);
        if (currentUser) void currentUser.getIdTokenResult().then(({ claims }) => {
            if (active) setCanEdit(uniqueAccessRoles([claims.role, claims.roles, claims.systemRole, claims.position, claims.additionalPositions]).some(isAdminAccessRole));
        }).catch(() => { if (active) setCanEdit(false); });
        return () => { active = false; };
    }, [currentUser]);

    useEffect(() => documentStampService.subscribe(value => {
        setSettings(value); setLoading(false); setLoadError('');
    }, () => { setLoading(false); setLoadError('도장 설정을 불러오지 못했습니다. 연결 상태를 확인한 후 페이지를 새로고침해 주세요.'); }), []);

    useEffect(() => {
        let active = true;
        void companyService.getCompanies().then(companies => {
            if (!active) return;
            const rows = [...defaultScopes];
            for (const company of companies) {
                const key = getStampCompanyScope(company.name);
                if (!rows.some(row => row.key === key)) rows.push({ key, name: company.name, company: company.name });
            }
            setScopes(rows);
        }).catch(() => { if (active) setNotice('회사 목록을 불러오지 못해 공통·청연·다원 설정만 표시합니다.'); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        void Promise.all(settings.assets.map(async asset => {
            try { return [asset.id, await documentStampService.assetUrl(asset) || ''] as const; }
            catch { return [asset.id, ''] as const; }
        })).then(entries => { if (active) setUrls(Object.fromEntries(entries)); });
        return () => { active = false; };
    }, [settings.assets]);

    const run = async (command: StampCommand, message: string, revision = settings.revision): Promise<boolean> => {
        if (disabled || saving.current) return false;
        saving.current = true; setBusy(true); setError(''); setNotice('');
        try { await documentStampService.execute(command, revision); setNotice(message); return true; }
        catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다. 다시 시도해 주세요.'); return false; }
        finally { saving.current = false; setBusy(false); }
    };
    const closeEditor = () => { fileSerial.current++; setEditor(null); setFile(null); setCheckingFile(false); };
    const openEditor = (asset: StampAsset | null) => {
        setEditor({ asset, revision: settings.revision }); setName(asset?.name || ''); setFile(null); setFilePreview(asset ? urls[asset.id] || '' : ''); setError(''); setCheckingFile(false);
    };
    const chooseFile = async (selected?: File) => {
        const serial = ++fileSerial.current;
        setFile(null); setFilePreview(''); setError('');
        if (!selected) { setCheckingFile(false); return; }
        setCheckingFile(true);
        try {
            const preview = await inspectStampFile(selected);
            if (serial !== fileSerial.current) return;
            setFile(selected); setFilePreview(preview.url);
        } catch (e) { if (serial === fileSerial.current) setError((e as Error).message); }
        finally { if (serial === fileSerial.current) setCheckingFile(false); }
    };
    const saveAsset = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editor || disabled || checkingFile || saving.current) return;
        if (!name.trim() || (!editor.asset && !file)) { setError('도장 이름과 이미지 파일을 입력해 주세요.'); return; }
        saving.current = true; setBusy(true); setError(''); setNotice('');
        try {
            const image = file ? await documentStampService.upload(file) : {};
            const asset: StampAsset = { ...(editor.asset || { id: crypto.randomUUID() }), ...image, name: name.trim() };
            if (file) delete asset.builtin;
            await documentStampService.execute({ type: 'upsert', asset, editing: !!editor.asset }, editor.revision);
            setNotice(editor.asset ? '도장을 수정했습니다. 연결된 문서에도 반영됩니다.' : '도장을 등록했습니다. 아래에서 적용할 문서를 선택해 주세요.');
            closeEditor();
        } catch (e) { setError(e instanceof Error ? e.message : '도장을 저장하지 못했습니다.'); }
        finally { saving.current = false; setBusy(false); }
    };

    const errorBox = error ? <p role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null;
    return <div className="min-h-full bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div><Link to="/settings" className="text-sm text-slate-500 hover:text-indigo-600">설정으로 돌아가기</Link><h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-slate-900"><Stamp className="text-indigo-600" />도장 이미지 관리</h1><p className="mt-2 text-sm text-slate-500">문서에 사용하는 기본 도장과 회사별 도장을 한곳에서 관리합니다.</p></div>
                <button className={primary} disabled={disabled} onClick={() => openEditor(null)}><ImagePlus size={18} />도장 등록</button>
            </header>
            {isDevAdminSessionEnabled() && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">개발 미리보기: 변경 내용은 이 브라우저에만 저장됩니다.</p>}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">기존 문서의 도장 크기·위치·인쇄 규격을 유지합니다. PNG·JPG, 최대 2MB / 가로·세로 4096px까지 등록할 수 있습니다. 배경이 투명한 PNG를 권장합니다. 변경한 도장은 이후 화면과 출력에 반영되며, 이미 저장한 PDF·엑셀 파일은 바뀌지 않습니다.</div>
            {loading && <p role="status">도장 설정을 불러오는 중입니다…</p>}
            {loadError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{loadError}</p>}
            {!loading && !canEdit && <p className="text-sm text-slate-500">도장 등록·수정·삭제와 적용 설정은 관리자만 변경할 수 있습니다.</p>}
            {notice && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={16} />{notice}</p>}
            {!editor && !deleting && !confirmAll && errorBox}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                <div className="mb-5 flex items-center gap-2"><h2 className="text-lg font-bold text-slate-900">등록된 도장</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{settings.assets.length}개</span></div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {settings.assets.map(asset => <article key={asset.id} className="rounded-xl border border-slate-200 p-4">
                        <StampPreview asset={asset} urls={urls} /><h3 className="mt-3 break-words font-semibold text-slate-800">{asset.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{asset.builtin ? '기존 기본 이미지' : asset.width ? `${asset.width} × ${asset.height}px` : '등록 이미지'}</p>
                        <div className="mt-4 flex gap-2"><button className={button} disabled={disabled} aria-label={`${asset.name} 수정`} onClick={() => openEditor(asset)}><Pencil size={14} />수정</button><button className={`${button} text-red-600`} disabled={disabled} aria-label={`${asset.name} 삭제`} onClick={() => { setDeleting(asset); setReplacement(''); setError(''); }}><Trash2 size={14} />삭제</button></div>
                    </article>)}
                </div>
                {!settings.assets.length && <p className="py-8 text-center text-sm text-slate-500">등록된 도장이 없습니다. 도장 등록 버튼으로 이미지를 추가해 주세요.</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">문서별 도장 적용</h2><p className="mt-1 text-sm text-slate-500">선택하면 바로 저장됩니다. 회사별 지정 → 공통 지정 → 기존 도장 순으로 적용합니다.</p></div><label className="w-full text-sm font-medium text-slate-700 sm:w-60">적용 대상<select aria-label="적용 대상" className={`${field} mt-1`} value={scope} disabled={busy} onChange={e => setScope(e.target.value)}>{scopes.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label></div>
                <div className="mb-5 grid items-end gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">기본 도장<select aria-label="기본 도장" className={`${field} mt-2`} value={settings.profiles[scope]?.default || ''} disabled={disabled} onChange={e => void run({ type: 'assign', scope, document: 'default', id: e.target.value }, '기본 도장을 저장했습니다.')}><option value="">미지정 · 기존 규칙 유지</option>{settings.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                    <p className="text-xs leading-5 text-slate-500">개별 도장을 지정하지 않은 문서에서 사용합니다. 전체 변경은 대상에 속한 모든 문서의 개별 설정도 함께 바꿉니다.</p>
                </div>
                <div className="divide-y divide-slate-100">
                    {STAMP_DOCUMENTS.map(document => {
                        const active = resolveStampAsset(settings, document.key, selectedScope.company);
                        const excel = ['estimate', 'transaction'].includes(document.key) ? resolveStampAsset(settings, document.key, selectedScope.company, 'excel') : null;
                        return <div key={document.key} className="grid gap-3 py-4 md:grid-cols-[1fr_1fr] md:items-center"><div><h3 className="font-semibold text-slate-800">{document.label}</h3><p className="mt-1 text-xs text-slate-500">{document.size}</p><p className="mt-1 text-xs text-indigo-600">현재: {active?.name || '이미지 없음'}{excel && excel.id !== active?.id ? ` / 엑셀: ${excel.name}` : ''}</p></div><select aria-label={`${document.label} 도장`} className={field} disabled={disabled} value={settings.profiles[scope]?.[document.key] || ''} onChange={e => void run({ type: 'assign', scope, document: document.key, id: e.target.value }, `${document.label} 도장을 저장했습니다.`)}><option value="">기본 도장 사용 · 미지정 시 기존 규칙</option>{settings.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>;
                    })}
                </div>
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4"><h3 className="font-semibold text-indigo-900">전체 변경</h3><p className="mt-1 text-sm text-indigo-800">{scope === GLOBAL_STAMP_SCOPE ? '모든 회사의 기본 도장과 문서별 도장을 선택한 이미지 하나로 변경합니다.' : `${selectedScope.name}의 기본 도장과 모든 문서별 도장을 함께 변경합니다.`}</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><select className={field} aria-label="전체 변경할 도장" value={allId} disabled={disabled} onChange={e => setAllId(e.target.value)}><option value="">전체 적용할 도장 선택</option>{settings.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select><button className={`${primary} shrink-0`} disabled={disabled || !settings.assets.some(asset => asset.id === allId)} onClick={() => { setConfirmAll(true); setError(''); }}>전체 변경</button></div></div>
            </section>
        </div>

        {editor && <Dialog title={editor.asset ? '도장 수정' : '도장 등록'} onClose={closeEditor} busy={busy}>
            <form onSubmit={saveAsset} className="space-y-4"><label className="block text-sm font-semibold text-slate-700">도장 이름<input className={`${field} mt-2`} value={name} onChange={e => setName(e.target.value)} maxLength={80} required disabled={busy} /></label><label className="block text-sm font-semibold text-slate-700">이미지 파일<input className="mt-2 block w-full text-sm" type="file" accept="image/png,image/jpeg" onChange={e => void chooseFile(e.target.files?.[0])} disabled={busy} /></label><p className="text-xs text-slate-500">{editor.asset ? '파일을 선택하지 않으면 현재 이미지를 유지합니다. 교체하면 이 도장을 사용하는 문서에 함께 반영됩니다.' : 'PNG·JPG, 최대 2MB. 투명 배경 PNG를 권장합니다.'}</p>{filePreview && <img src={filePreview} alt="등록할 도장 미리보기" className="mx-auto h-32 w-32 object-contain" />}{errorBox}<div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={closeEditor}>취소</button><button type="submit" className={primary} disabled={disabled || checkingFile || !name.trim() || (!editor.asset && !file)}>{busy ? '저장 중…' : checkingFile ? '이미지 확인 중…' : '저장'}</button></div></form>
        </Dialog>}
        {deleting && <Dialog title="도장 삭제" onClose={() => setDeleting(null)} busy={busy}><p className="text-sm leading-6 text-slate-700">‘{deleting.name}’을 관리 목록에서 삭제합니다. 연결된 문서에 사용할 대체 도장을 선택할 수 있습니다. 기존에 다운로드한 파일과 보관된 원본 이미지는 유지됩니다.</p><label className="mt-4 block text-sm font-semibold">대체 도장<select className={`${field} mt-2`} value={replacement} onChange={e => setReplacement(e.target.value)} disabled={busy}><option value="">대체 없이 삭제 · 연결 해제</option>{settings.assets.filter(asset => asset.id !== deleting.id).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>{errorBox}<div className="mt-5 flex justify-end gap-2"><button className={button} disabled={busy} onClick={() => setDeleting(null)}>취소</button><button className={`${button} bg-red-600 text-white hover:!bg-red-700`} disabled={disabled} onClick={async () => { if (await run({ type: 'delete', id: deleting.id, replacementId: replacement }, '도장을 삭제하고 문서 연결을 정리했습니다.')) setDeleting(null); }}>삭제하기</button></div></Dialog>}
        {confirmAll && <Dialog title="전체 도장 변경" onClose={() => setConfirmAll(false)} busy={busy}><p className="text-sm leading-6 text-slate-700">{selectedScope.name}의 기본 도장과 재직증명서·해촉증명서·견적서·거래명세서·현금수령확인서 직인을 ‘{settings.assets.find(asset => asset.id === allId)?.name}’으로 변경합니다. {scope === GLOBAL_STAMP_SCOPE && '회사별 개별 지정도 모두 바뀝니다.'} 문서의 기존 크기와 위치는 유지합니다.</p>{errorBox}<div className="mt-5 flex justify-end gap-2"><button className={button} disabled={busy} onClick={() => setConfirmAll(false)}>취소</button><button className={primary} disabled={disabled} onClick={async () => { if (await run({ type: 'applyAll', scope, id: allId }, '대상 문서의 도장을 모두 변경했습니다.')) setConfirmAll(false); }}>전체 변경 적용</button></div></Dialog>}
    </div>;
}
