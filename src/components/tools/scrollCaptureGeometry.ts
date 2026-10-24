export type ScrollCaptureViewport = {
    left: number;
    top: number;
    width: number;
    height: number;
    contentTop: number;
};

const isDocumentRoot = (target: HTMLElement) => (
    target === document.scrollingElement || target === document.documentElement || target === document.body
);

const clipsOverflow = (value: string) => /^(auto|scroll|overlay|hidden|clip)$/.test(value);

/** The visible client area and the content row at its top must share one origin. */
export const getScrollCaptureViewport = (target: HTMLElement): ScrollCaptureViewport => {
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight);
    if (isDocumentRoot(target)) {
        return { left: 0, top: 0, width: viewportWidth, height: viewportHeight, contentTop: target.scrollTop };
    }

    const box = target.getBoundingClientRect();
    const clientLeft = box.left + target.clientLeft;
    const clientTop = box.top + target.clientTop;
    let left = Math.max(0, clientLeft);
    let top = Math.max(0, clientTop);
    let right = Math.min(viewportWidth, clientLeft + target.clientWidth);
    let bottom = Math.min(viewportHeight, clientTop + target.clientHeight);

    for (let ancestor = target.parentElement; ancestor && !isDocumentRoot(ancestor); ancestor = ancestor.parentElement) {
        const style = window.getComputedStyle(ancestor);
        const clipX = clipsOverflow(style.overflowX || style.overflow);
        const clipY = clipsOverflow(style.overflowY || style.overflow);
        if (!clipX && !clipY) continue;
        const bounds = ancestor.getBoundingClientRect();
        if (clipX) {
            left = Math.max(left, bounds.left + ancestor.clientLeft);
            right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth);
        }
        if (clipY) {
            top = Math.max(top, bounds.top + ancestor.clientTop);
            bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight);
        }
    }

    return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
        contentTop: target.scrollTop + Math.min(target.clientHeight, Math.max(0, top - clientTop))
    };
};

export const getScrollCaptureContentY = (target: HTMLElement, y: number): number => {
    const viewport = getScrollCaptureViewport(target);
    return viewport.contentTop + Math.min(viewport.height, Math.max(0, y - viewport.top));
};
