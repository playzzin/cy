import type { Auth, User } from 'firebase/auth';

const FRAME_PREFIX = 'cy-dev-preview:';
export const isDevPreviewFrame = typeof window !== 'undefined' && window.parent !== window
    && (window.name.startsWith(FRAME_PREFIX) || new URLSearchParams(window.location.search).get('devPreviewFrame') === '1');
export interface PreviewTarget { uid: string; displayName: string; email: string | null; photoURL: string | null }
export interface PreviewBootstrap { token: string; expiresAt: number; target: PreviewTarget; positionId: string }
let session: PreviewBootstrap | null = null;
let mappedUser: { original: User; user: User; uid: string } | null = null;
export const getDevPreviewSession = () => session;
export function safePreviewPath(value: string): string {
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
    const url = new URL(value, window.location.origin);
    url.searchParams.delete('devPreviewFrame');
    url.searchParams.delete('devAdmin');
    url.searchParams.delete('newTab');
    return url.pathname + url.search + url.hash;
}
export function previewFrameUrl(path: string): string {
    const url = new URL(safePreviewPath(path), window.location.origin);
    url.searchParams.set('devPreviewFrame', '1');
    return url.pathname + url.search + url.hash;
}
export const postPreviewMessage = (type: string, extra: Record<string, unknown> = {}) => {
    if (isDevPreviewFrame) window.parent.postMessage({ type, frameId: window.name, ...extra }, window.location.origin);
};
export function effectivePreviewUser(user: User | null): User | null {
    if (!isDevPreviewFrame || !session || !user) return user;
    if (mappedUser?.original === user && mappedUser.uid === session.target.uid) return mappedUser.user;
    const target = session.target;
    const proxy = new Proxy(user, { get(original, property) {
        if (['uid', 'displayName', 'email', 'photoURL'].includes(String(property))) return target[property as keyof PreviewTarget];
        const value = Reflect.get(original, property, original);
        return typeof value === 'function' ? value.bind(original) : value;
    } });
    mappedUser = { original: user, user: proxy, uid: target.uid };
    return proxy;
}
export function previewAuthFacade(auth: Auth): Auth {
    if (!isDevPreviewFrame) return auth;
    return new Proxy(auth, { get(original, property) {
        if (property === 'currentUser') return effectivePreviewUser(original.currentUser);
        const value = Reflect.get(original, property, original);
        return typeof value === 'function' ? value.bind(original) : value;
    } });
}
export function startDevPreviewAuth(onUser: (user: User | null) => void, onError: (message: string) => void): () => void {
    let stopped = false, started = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const receive = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.frameId !== window.name
            || event.data?.type !== 'cy-preview:bootstrap' || started) return;
        started = true;
        try {
            const payload = event.data.session as PreviewBootstrap;
            if (!payload?.token || !payload.target?.uid || payload.expiresAt * 1000 <= Date.now()) throw new Error('미리보기 세션을 다시 시작해 주세요.');
            const [{ signInWithCustomToken }, { rawAuth }] = await Promise.all([import('firebase/auth'), import('../config/firebaseAuth')]);
            const credential = await signInWithCustomToken(rawAuth, payload.token);
            const claims = (await credential.user.getIdTokenResult()).claims;
            if (claims.devPreview !== true || claims.previewTargetUid !== payload.target.uid || claims.previewExpiresAt !== payload.expiresAt) throw new Error('미리보기 계정을 확인하지 못했습니다.');
            if (stopped) return;
            session = { ...payload, token: '' };
            onUser(effectivePreviewUser(credential.user));
            expiry = setTimeout(() => {
                onUser(null);onError('미리보기 시간이 만료되었습니다. 상단에서 다시 시작해 주세요.');
                postPreviewMessage('cy-preview:expired');
            }, Math.max(0, payload.expiresAt * 1000 - Date.now()));
            postPreviewMessage('cy-preview:authenticated');
        } catch (error) {
            if (!stopped) { onError(error instanceof Error ? error.message : '미리보기를 시작하지 못했습니다.'); postPreviewMessage('cy-preview:failed'); }
        }
    };
    window.addEventListener('message', receive);
    postPreviewMessage('cy-preview:ready');
    return () => { stopped = true; window.removeEventListener('message', receive); if (expiry) clearTimeout(expiry); };
}

// Preview pages share an origin with DEV but never share application preferences,
// draft caches, or auth persistence. Every user switch creates a fresh frame.
if (isDevPreviewFrame) {
    const storage = (): Storage => {
        const values = new Map<string, string>();
        return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(String(key)) ?? null,
            key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(String(key)); },
            setItem: (key, value) => { values.set(String(key), String(value)); } };
    };
    Object.defineProperty(window, 'localStorage', { value: storage() });
    Object.defineProperty(window, 'sessionStorage', { value: storage() });
    // Local document workspaces also use IndexedDB. Give this frame a separate
    // namespace so a selected account cannot see or overwrite DEV's saved work.
    const originalIndexedDb = window.indexedDB;
    if (originalIndexedDb) {
        const prefix = `${FRAME_PREFIX}${crypto.randomUUID()}:`;
        const databases = new Set<string>();
        const connections = new Set<IDBDatabase>();
        Object.defineProperty(window, 'indexedDB', { value: new Proxy(originalIndexedDb, { get(original, property) {
            if (property === 'open') return (name: string, version?: number) => {
                const scopedName = prefix + name; databases.add(scopedName);
                const request = original.open(scopedName, version);
                request.addEventListener('success', () => connections.add(request.result));
                return request;
            };
            if (property === 'deleteDatabase') return (name: string) => original.deleteDatabase(prefix + name);
            if (property === 'databases') return async () => (await original.databases()).filter(database => database.name?.startsWith(prefix))
                .map(database => ({ ...database, name: database.name!.slice(prefix.length) }));
            const value = Reflect.get(original, property, original);
            return typeof value === 'function' ? value.bind(original) : value;
        } }) });
        window.addEventListener('pagehide', () => {
            connections.forEach(connection => connection.close());
            databases.forEach(name => originalIndexedDb.deleteDatabase(name));
        }, { once: true });
    }
}
