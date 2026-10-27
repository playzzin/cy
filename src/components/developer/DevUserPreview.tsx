import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faIdBadge } from '@fortawesome/free-solid-svg-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { PositionItem } from '../../types/menu';
import { safePreviewPath, previewFrameUrl, type PreviewBootstrap } from '../../utils/devPreviewRuntime';
import DevPreviewAccountPicker, { type PreviewChoice } from './DevPreviewAccountPicker';
import './DevUserPreview.css';

export interface PreviewAccount { uid: string; displayName: string; positionIds: string[]; scopeLabel: string; linked: boolean; additionalPositions: string[] }
interface Props { actorUid: string; positionId: string; path: string; positions: PositionItem[];
    onPosition: (id: string) => void; onPath: (path: string) => void; onExit: () => void }
export function choosePreviewAccount(accounts: PreviewAccount[], positionId: string, lastUid?: string): string {
    const candidates = accounts.filter(account => account.positionIds.includes(positionId));
    return candidates.find(account => account.uid === lastUid)?.uid || (candidates.length === 1 ? candidates[0].uid : '');
}
export default function DevUserPreview({ actorUid, positionId, path, positions, onPosition, onPath, onExit }: Props) {
    const storageKey = 'cy-preview-recent:' + actorUid;
    const [recent, setRecent] = useState<PreviewChoice[]>(() => {
        try { const data = JSON.parse(sessionStorage.getItem(storageKey) || '[]'); return Array.isArray(data) ? data.filter(item => typeof item?.uid === 'string' && typeof item?.positionId === 'string').slice(0, 5) : []; } catch { return []; }
    });
    const [accounts, setAccounts] = useState<PreviewAccount[]>([]);
    const [directoryLoading, setDirectoryLoading] = useState(true);
    const [directoryRevision, setDirectoryRevision] = useState(0);
    const [uid, setUid] = useState('');
    const [session, setSession] = useState<(PreviewBootstrap & { frameId: string; initialPath: string }) | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [directoryError, setDirectoryError] = useState('');
    const [pickerOpen, setPickerOpen] = useState(true);
    const [renew, setRenew] = useState(0);
    const iframe = useRef<HTMLIFrameElement>(null);
    const pickerButton = useRef<HTMLButtonElement>(null);
    const dismissPickerOnReady = useRef(true);
    const currentPath = useRef(path); currentPath.current = path;
    const recentRef = useRef(recent); recentRef.current = recent;
    const callbacks = useRef({ onExit, onPath }); callbacks.current = { onExit, onPath };
    const candidates = accounts.filter(account => account.positionIds.includes(positionId));
    const selected = candidates.find(account => account.uid === uid);
    const activeSession = selected && session?.target.uid === uid && session.positionId === positionId ? session : null;
    const position = positions.find(item => item.id === positionId);
    const closePicker = () => { setPickerOpen(false); pickerButton.current?.focus(); };
    const openPicker = () => { dismissPickerOnReady.current = false; setPickerOpen(true); };
    const confirmChoice = (choice: PreviewChoice) => {
        if (choice.positionId === positionId && choice.uid === uid && activeSession && !error) { closePicker(); return; }
        const next = [choice, ...recentRef.current.filter(item => item.uid !== choice.uid || item.positionId !== choice.positionId)].slice(0, 5);
        // Keep the explicit choice when the parent applies the new position.
        recentRef.current = next;
        setRecent(next);
        dismissPickerOnReady.current = true;
        setError('');
        setSession(null);
        setUid(choice.uid);
        onPosition(choice.positionId);
        setRenew(value => value + 1);
    };

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);
    useEffect(() => {
        let alive = true; setDirectoryLoading(true); setDirectoryError('');
        httpsCallable<unknown, { accounts: PreviewAccount[] }>(functions, 'getDevPreviewAccounts')({}).then(result => {
            if (alive) setAccounts(result.data.accounts);
        }).catch(() => { if (alive) setDirectoryError('사용자 목록을 불러오지 못했습니다. 목록을 새로고침해 주세요.'); })
            .finally(() => { if (alive) setDirectoryLoading(false); });
        return () => { alive = false; };
    }, [actorUid, directoryRevision]);
    useEffect(() => {
        const next = choosePreviewAccount(accounts, positionId, recentRef.current.find(item => item.positionId === positionId)?.uid);
        setUid(previous => accounts.some(account => account.uid === previous && account.positionIds.includes(positionId)) ? previous : next);
        if (!next) setPickerOpen(true);
    }, [accounts, positionId]);
    useEffect(() => {
        let alive = true; setSession(null); setBusy(Boolean(selected));
        if (!selected) return () => { alive = false; };
        setError('');
        httpsCallable<{ targetUid: string }, Omit<PreviewBootstrap, 'positionId'>>(functions, 'createDevPreviewSession')({ targetUid: selected.uid }).then(result => {
            if (!alive) return;
            setSession({ ...result.data, positionId, frameId: 'cy-dev-preview:' + crypto.randomUUID(), initialPath: safePreviewPath(currentPath.current) });
            const choice = { positionId, uid: selected.uid };
            const next = [choice, ...recentRef.current.filter(item => item.uid !== choice.uid || item.positionId !== choice.positionId)].slice(0, 5);
            setRecent(next); sessionStorage.setItem(storageKey, JSON.stringify(next));
        }).catch(() => { if (alive) { setBusy(false); setError('미리보기를 시작하지 못했습니다. 다시 시도하거나 다른 사용자를 선택해 주세요.'); setPickerOpen(true); } });
        return () => { alive = false; };
    }, [selected?.uid, positionId, renew, storageKey]);
    useEffect(() => {
        if (!activeSession) return;
        const loadingTimer = setTimeout(() => { setBusy(false); setSession(null); setError('사용자 화면을 불러오지 못했습니다. 연결을 확인하고 다시 시작해 주세요.'); }, 45000);
        const send = (type: string, extra: Record<string, unknown> = {}) => iframe.current?.contentWindow?.postMessage({ type, frameId: activeSession.frameId, ...extra }, window.location.origin);
        const listener = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow || event.data?.frameId !== activeSession.frameId) return;
            if (event.data.type === 'cy-preview:ready') send('cy-preview:bootstrap', { session: activeSession });
            if (event.data.type === 'cy-preview:authenticated') {
                clearTimeout(loadingTimer); setBusy(false);
                send('cy-preview:navigate', { path: safePreviewPath(currentPath.current) });
                if (dismissPickerOnReady.current) { setPickerOpen(false); iframe.current?.focus(); }
            }
            if (event.data.type === 'cy-preview:choose-position') openPicker();
            if (event.data.type === 'cy-preview:path' && typeof event.data.path === 'string') callbacks.current.onPath(safePreviewPath(event.data.path));
            if (event.data.type === 'cy-preview:exit') callbacks.current.onExit();
            if (['cy-preview:expired', 'cy-preview:failed'].includes(event.data.type)) { setBusy(false); setSession(null); setError('미리보기가 종료되었습니다. 다시 시작해 주세요.'); }
        };
        window.addEventListener('message', listener);
        const timer = setTimeout(() => { setBusy(false); setSession(null); setError('미리보기 시간이 만료되었습니다. 다시 시작해 주세요.'); }, Math.max(0, activeSession.expiresAt * 1000 - Date.now()));
        return () => { window.removeEventListener('message', listener); clearTimeout(timer); clearTimeout(loadingTimer); };
    }, [activeSession]);
    useEffect(() => {
        if (activeSession) iframe.current?.contentWindow?.postMessage({ type: 'cy-preview:navigate', frameId: activeSession.frameId, path: safePreviewPath(path) }, window.location.origin);
    }, [path, activeSession]);

    return <section className="dev-user-preview" aria-label="사용자 시점 확인">
        <header className="dev-user-preview__bar">
            <div className="dev-user-preview__identity" role="status">
                <span className="dev-user-preview__readonly" title="저장·승인·발송은 차단됩니다">조회 전용</span>
                <strong title={selected ? selected.displayName + ' · ' + selected.scopeLabel : position?.name}>
                    {position?.name}{selected ? ' · ' + selected.displayName : ' · 계정 선택'}
                </strong>
                <span className="dev-user-preview__scope">{selected?.scopeLabel}</span>
            </div>
            <div className="dev-user-preview__actions">
                <button type="button" ref={pickerButton} className="dev-user-preview__mode-button" title="직책모드" aria-label="직책모드 열기" aria-expanded={pickerOpen} aria-controls="dev-preview-picker"
                    onClick={() => pickerOpen ? closePicker() : openPicker()}><FontAwesomeIcon icon={faIdBadge} /></button>
                <button type="button" onClick={onExit}>내 화면으로 복귀</button>
            </div>
        </header>
        {pickerOpen && <DevPreviewAccountPicker accounts={accounts} positions={positions} positionId={positionId} uid={uid} recent={recent}
            loading={directoryLoading} busy={busy} error={directoryError || error} onConfirm={confirmChoice} onClose={closePicker}
            onRestoreFocus={() => pickerButton.current?.focus()} onReload={() => setDirectoryRevision(value => value + 1)} />}
        <div className="dev-user-preview__viewport" aria-busy={directoryLoading || busy}>
            {error && <div className="dev-user-preview__error" role="alert">{error}<button type="button" onClick={() => selected ? setRenew(value => value + 1) : setDirectoryRevision(value => value + 1)}>다시 시작</button></div>}
            {(directoryLoading || busy) && <div role="status" className="dev-user-preview__loading">{directoryLoading ? '연결된 사용자 계정을 확인하는 중입니다.' : '선택한 사용자의 화면을 준비하는 중입니다.'}</div>}
            {activeSession && <iframe key={activeSession.frameId} ref={iframe} name={activeSession.frameId}
                src={previewFrameUrl(activeSession.initialPath)}
                title={selected?.displayName + ' 사용자 화면'} sandbox="allow-scripts allow-same-origin" referrerPolicy="same-origin" />}
            {!selected && !directoryLoading && !error && <div className="dev-user-preview__empty">
                <h1>{position?.name} 사용자 시점</h1>
                <p>{directoryError || (candidates.length ? '사용자 선택 창에서 확인할 계정을 선택하세요.' : '활성 계정을 연결한 뒤 이 직책의 사용자 화면을 확인할 수 있습니다.')}</p>
                <button type="button" onClick={openPicker}>직책·계정 선택</button>
            </div>}
        </div>
    </section>;
}
