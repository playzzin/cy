type CaptureHandleTrack = MediaStreamTrack & { getCaptureHandle?: () => { handle: string } | null };
type CaptureHandleDevices = MediaDevices & {
    setCaptureHandleConfig?: (config: { handle: string; exposeOrigin: boolean; permittedOrigins: string[] }) => void;
};

// A random page-lifetime identifier, visible only to this origin. No URL, user
// identity, or page content is exposed to another site or written to diagnostics.
export const createCaptureIdentity = () => {
    const devices = navigator.mediaDevices as CaptureHandleDevices | undefined;
    const handle = `quick-camera-${window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    let registered = false;
    try {
        if (devices?.setCaptureHandleConfig && window.location.origin !== 'null') {
            devices.setCaptureHandleConfig({ handle, exposeOrigin: false, permittedOrigins: [window.location.origin] });
            registered = true;
        }
    } catch { /* Older browsers and embedded pages require visual confirmation. */ }
    return {
        verify(track: MediaStreamTrack): boolean {
            const surface = track.getSettings?.().displaySurface;
            if (surface && surface !== 'browser') throw new Error('screen-browser-only');
            const getHandle = (track as CaptureHandleTrack).getCaptureHandle;
            if (!registered || typeof getHandle !== 'function') return false;
            if (getHandle.call(track)?.handle !== handle) throw new Error('screen-tab-mismatch');
            return true;
        },
        dispose() {
            if (!registered) return;
            try { devices?.setCaptureHandleConfig?.({ handle: '', exposeOrigin: false, permittedOrigins: [] }); } catch { /* Page may be closing. */ }
            registered = false;
        }
    };
};
