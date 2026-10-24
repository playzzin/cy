import { useCallback, useEffect, useRef, useState } from 'react';
import { menuServiceV11 } from '../../../services/menuServiceV11';
import type { SiteDataType } from '../../../types/menu';
import { menuConfigsEqual, rebaseMenuHistory, type MenuEditHistory } from '../../../utils/menuConfigChanges';

const clone = (data: SiteDataType): SiteDataType => JSON.parse(JSON.stringify(data));
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '메뉴를 저장하지 못했습니다. 연결 상태를 확인해주세요.';
const emptyHistory = (): MenuEditHistory => ({ past: [], future: [] });

export const useMenuEditorPersistence = () => {
    const [menuData, setMenuData] = useState<SiteDataType | null>(null);
    const [history, setHistory] = useState<MenuEditHistory>(emptyHistory);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');
    const [isReloading, setIsReloading] = useState(false);
    const draft = useRef<SiteDataType | null>(null);
    const historyRef = useRef<MenuEditHistory>(emptyHistory());
    const latestRemote = useRef<SiteDataType | null>(null);
    const remoteRevision = useRef(0);
    const requestId = useRef(0);
    const pending = useRef(0);
    const failed = useRef(false);
    const mounted = useRef(true);
    const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

    const publishHistory = useCallback((value: MenuEditHistory) => {
        historyRef.current = value;
        setHistory(value);
    }, []);

    const receive = useCallback((value: SiteDataType) => {
        if (!mounted.current || menuConfigsEqual(draft.current, value)) return;
        publishHistory(draft.current ? rebaseMenuHistory(historyRef.current, draft.current, value) : emptyHistory());
        draft.current = clone(value);
        setMenuData(draft.current);
    }, [publishHistory]);

    useEffect(() => {
        mounted.current = true;
        const unsubscribe = menuServiceV11.subscribe(value => {
            latestRemote.current = value;
            remoteRevision.current += 1;
            if (!pending.current && !failed.current) receive(value);
        }, { onError: error => {
            if (!mounted.current) return;
            setSaveError(`메뉴를 불러오지 못했습니다. ${errorMessage(error)}`);
            setSaveStatus('error');
        } });
        return () => { mounted.current = false; unsubscribe(); };
    }, [receive]);

    const persist = useCallback((value: SiteDataType, base: SiteDataType) => {
        const generation = ++requestId.current;
        const startedRevision = remoteRevision.current;
        const submitted = clone(value);
        const baseline = clone(base);
        pending.current += 1;
        setSaveStatus('saving');
        setSaveError('');
        // A failed predecessor invalidates subsequent optimistic baselines. Keep
        // the entire unsaved draft until an explicit reload starts a fresh queue.
        const request = saveQueue.current.then(() => menuServiceV11.saveMenuConfig(submitted, baseline));
        saveQueue.current = request;
        void request.then(saved => {
            if (!mounted.current || generation !== requestId.current) return;
            receive(saved);
            failed.current = false;
            setSaveStatus('saved');
            setSaveError('');
        }).catch(error => {
            failed.current = true;
            if (!mounted.current || generation !== requestId.current) return;
            setSaveStatus('error');
            setSaveError(errorMessage(error));
        }).finally(async () => {
            pending.current -= 1;
            if (!mounted.current || pending.current || failed.current || remoteRevision.current <= startedRevision || !latestRemote.current
                || menuConfigsEqual(latestRemote.current, draft.current)) return;
            // A snapshot can arrive during an in-flight save/audit. Read once on
            // drain rather than losing it or applying a potentially older snapshot.
            const revision = remoteRevision.current;
            try {
                const latest = await menuServiceV11.getMenuConfig();
                if (!mounted.current || generation !== requestId.current || pending.current || failed.current) return;
                const resolved = remoteRevision.current > revision ? latestRemote.current : latest;
                if (!resolved) throw new Error('최신 메뉴를 불러오지 못했습니다.');
                receive(resolved);
            } catch (error) {
                if (mounted.current && generation === requestId.current) {
                    setSaveStatus('error');
                    setSaveError(`저장 후 최신 메뉴를 확인하지 못했습니다. ${errorMessage(error)}`);
                }
            }
        });
    }, [receive]);

    const updateMenuData = useCallback((value: SiteDataType) => {
        const base = draft.current;
        if (!base || menuConfigsEqual(base, value)) return;
        publishHistory({ past: [...historyRef.current.past.slice(-49), clone(base)], future: [] });
        draft.current = clone(value);
        setMenuData(draft.current);
        persist(value, base);
    }, [persist, publishHistory]);

    const travel = useCallback((direction: 'past' | 'future') => {
        const current = draft.current;
        const state = historyRef.current;
        const target = direction === 'past' ? state.past[state.past.length - 1] : state.future[0];
        if (!current || !target) return;
        publishHistory(direction === 'past'
            ? { past: state.past.slice(0, -1), future: [clone(current), ...state.future] }
            : { past: [...state.past, clone(current)], future: state.future.slice(1) });
        draft.current = clone(target);
        setMenuData(draft.current);
        persist(target, current);
    }, [persist, publishHistory]);

    const reloadLatestMenus = useCallback(async (): Promise<boolean> => {
        if (pending.current) return false;
        const generation = requestId.current;
        const revision = remoteRevision.current;
        setIsReloading(true);
        try {
            const latest = await menuServiceV11.getMenuConfig();
            if (!mounted.current || generation !== requestId.current || pending.current) return false;
            const data = remoteRevision.current > revision ? latestRemote.current : latest;
            if (!data) throw new Error('최신 메뉴를 불러오지 못했습니다. 다시 시도해주세요.');
            failed.current = false;
            saveQueue.current = Promise.resolve();
            draft.current = clone(data);
            latestRemote.current = data;
            setMenuData(draft.current);
            publishHistory(emptyHistory());
            setSaveStatus('idle');
            setSaveError('');
            return true;
        } catch (error) {
            if (mounted.current && generation === requestId.current) {
                setSaveError(errorMessage(error));
                setSaveStatus('error');
            }
            return false;
        } finally { if (mounted.current) setIsReloading(false); }
    }, [publishHistory]);

    useEffect(() => {
        if (saveStatus !== 'saving' && saveStatus !== 'error') return;
        const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', preventUnload);
        return () => window.removeEventListener('beforeunload', preventUnload);
    }, [saveStatus]);

    return { menuData, history, saveStatus, saveError, isReloading, updateMenuData,
        handleUndo: () => travel('past'), handleRedo: () => travel('future'), reloadLatestMenus };
};
