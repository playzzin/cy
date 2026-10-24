export interface ImageClipboardWriteReservation {
    complete: (blob: Blob) => void;
    cancel: (error: unknown) => void;
    result: Promise<{ ok: true } | { ok: false; error: unknown }>;
}

export const reserveImageClipboardWrite = (): ImageClipboardWriteReservation | null => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || window.isSecureContext === false) return null;
    const Item = window.ClipboardItem;
    if (!Item || !navigator.clipboard?.write) return null;
    let resolveBlob!: (blob: Blob) => void;
    let rejectBlob!: (error: unknown) => void;
    let settled = false;
    const blobPromise = new Promise<Blob>((resolve, reject) => { resolveBlob = resolve; rejectBlob = reject; });
    // The browser may reject before it starts consuming the image promise.
    void blobPromise.catch(() => undefined);
    const cancel = (error: unknown) => {
        if (settled) return;
        settled = true;
        rejectBlob(error);
    };
    try {
        const item = new Item({ 'image/png': blobPromise });
        // Attach the rejection handler during the user gesture, before rendering begins.
        const result = navigator.clipboard.write([item]).then(
            () => ({ ok: true as const }),
            (error: unknown) => ({ ok: false as const, error })
        );
        return {
            complete: blob => { if (!settled) { settled = true; resolveBlob(blob); } },
            cancel,
            result,
        };
    } catch (error) {
        cancel(error);
        return null;
    }
};
