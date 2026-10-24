import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isDevPreviewFrame, postPreviewMessage, safePreviewPath } from '../../utils/devPreviewRuntime';

export default function DevPreviewFrameBridge() {
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (!isDevPreviewFrame) return;
        postPreviewMessage('cy-preview:path', { path: safePreviewPath(location.pathname + location.search + location.hash) });
    }, [location.pathname, location.search, location.hash]);
    useEffect(() => {
        if (!isDevPreviewFrame) return;
        const receive = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.frameId !== window.name
                || event.data.type !== 'cy-preview:navigate' || typeof event.data.path !== 'string') return;
            const path = safePreviewPath(event.data.path);
            if (path !== safePreviewPath(window.location.pathname + window.location.search + window.location.hash)) navigate(path);
        };
        window.addEventListener('message', receive);
        const originalOpen = window.open;
        window.open = ((url?: string | URL) => {
            if (url) { const target = new URL(String(url), window.location.origin); if (target.origin === window.location.origin) navigate(safePreviewPath(target.pathname + target.search + target.hash)); }
            return null;
        }) as typeof window.open;
        return () => { window.removeEventListener('message', receive); window.open = originalOpen; };
    }, [navigate]);
    return null;
}
