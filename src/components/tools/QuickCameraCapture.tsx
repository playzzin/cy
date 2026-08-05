import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ClipboardCheck, Download, MousePointerSquareDashed, RotateCcw, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import {
    createScrollStitchSlice,
    getScrollStitchBoundaryContentY,
    ScrollStitchSegmentGeometry
} from './scrollCaptureStitching';

type Rect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type Point = {
    x: number;
    y: number;
};

type ViewportMetrics = {
    width: number;
    height: number;
};

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

type SelectionAdjustment = {
    kind: 'move' | 'resize';
    startPoint: Point;
    startRect: Rect;
    handle?: ResizeHandle;
};

type CaptureHistoryItem = {
    id: string;
    blob: Blob;
    previewUrl: string;
    createdAt: number;
    width: number;
    height: number;
    clipboardStatus: 'pending' | 'copied' | 'blocked' | 'unsupported' | 'failed';
    downloadRequested: boolean;
};

type ClipboardCopyResult =
    | { ok: true }
    | {
        ok: false;
        reason: 'unsupported' | 'blocked' | 'failed';
    };

type ClipboardWriteReservation = {
    complete: (blob: Blob) => void;
    cancel: (error: unknown) => void;
    result: Promise<ClipboardCopyResult>;
};

type PendingClipboardCopy = {
    item: CaptureHistoryItem;
    reason: Exclude<ClipboardCopyResult, { ok: true }>['reason'];
};

type CaptureMode = 'screen' | 'scroll';
type ScreenCapturePhase = 'idle' | 'selecting' | 'capturing';

type DisplayCursorConstraint = 'always' | 'motion' | 'never';

type FrozenScreenFrame = {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
};

type ScrollCaptureRange = {
    left: number;
    width: number;
    topContentY: number;
    bottomContentY: number;
    startScrollTop: number;
    endScrollTop: number;
};

type ScrollCapturePlan = {
    target: HTMLElement | null;
    captureRect: Rect;
    movingRect: Rect;
    initialScrollTop: number;
    restoreScrollTop: number;
    maxScrollTop: number;
    scrollStepCss: number;
    canScroll: boolean;
    estimatedSteps: number;
    range?: ScrollCaptureRange;
};

type ScrollSelectionAnchor = {
    point: Point;
    target: HTMLElement | null;
    scrollTop: number;
    contentY: number;
};

const MIN_SIZE = 12;
const CAPTURE_EXCLUDE_SELECTOR = '[data-capture-exclude="true"]';
const CAPTURE_OVERLAY_SELECTOR = '[data-capture-overlay="true"]';
const FULL_CONTENT_CAPTURE_SELECTOR = '[data-capture-full-content="true"]';
const CAPTURE_TEXT_SAFE_SELECTOR = '[data-capture-text-safe="true"]';
const MIN_SCREEN_CAPTURE_SOURCE_SCALE = 2;
const MAX_SCREEN_CAPTURE_SOURCE_SCALE = 3;
const MAX_SCREEN_CAPTURE_SOURCE_WIDTH = 7680;
const MAX_SCREEN_CAPTURE_SOURCE_HEIGHT = 4320;
const SCROLL_CAPTURE_OVERLAP_CSS = 24;
const MAX_SCROLL_CAPTURE_STEPS = 2000;
const MAX_SCROLL_CAPTURE_CANVAS_HEIGHT = 32767;
const MAX_SCROLL_CAPTURE_CANVAS_AREA = 180_000_000;
const SCROLL_CAPTURE_WARN_HEIGHT_CSS = 12000;
const SCROLL_CAPTURE_BLOCK_HEIGHT_CSS = 28000;
const SCROLL_CAPTURE_WARN_STEPS = 24;
const SCROLL_CAPTURE_BLOCK_STEPS = 90;
const SELECTION_RESIZE_HANDLES: Array<{
    handle: ResizeHandle;
    label: string;
    left: string;
    top: string;
    cursor: React.CSSProperties['cursor'];
}> = [
    { handle: 'nw', label: '왼쪽 위', left: '0%', top: '0%', cursor: 'nwse-resize' },
    { handle: 'n', label: '위', left: '50%', top: '0%', cursor: 'ns-resize' },
    { handle: 'ne', label: '오른쪽 위', left: '100%', top: '0%', cursor: 'nesw-resize' },
    { handle: 'e', label: '오른쪽', left: '100%', top: '50%', cursor: 'ew-resize' },
    { handle: 'se', label: '오른쪽 아래', left: '100%', top: '100%', cursor: 'nwse-resize' },
    { handle: 's', label: '아래', left: '50%', top: '100%', cursor: 'ns-resize' },
    { handle: 'sw', label: '왼쪽 아래', left: '0%', top: '100%', cursor: 'nesw-resize' },
    { handle: 'w', label: '왼쪽', left: '0%', top: '50%', cursor: 'ew-resize' }
];

const clampPointToViewport = (x: number, y: number) => {
    const { width: maxX, height: maxY } = getViewportMetrics();
    return {
        x: Math.min(Math.max(0, Math.round(x)), Math.floor(maxX)),
        y: Math.min(Math.max(0, Math.round(y)), Math.floor(maxY))
    };
};

const buildRect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => {
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x);
    const height = Math.abs(a.y - b.y);
    return { left, top, width, height };
};

const normalizeRectToMetrics = (rect: Rect, viewport: ViewportMetrics): Rect => {
    const left = Math.min(viewport.width, Math.max(0, Math.round(rect.left)));
    const top = Math.min(viewport.height, Math.max(0, Math.round(rect.top)));
    const right = Math.min(
        viewport.width,
        Math.max(left, Math.round(rect.left + rect.width))
    );
    const bottom = Math.min(
        viewport.height,
        Math.max(top, Math.round(rect.top + rect.height))
    );

    return {
        left,
        top,
        width: right - left,
        height: bottom - top
    };
};

const normalizeRectToViewport = (rect: Rect): Rect => (
    normalizeRectToMetrics(rect, getViewportMetrics())
);

const getAdjustedSelectionRect = (
    adjustment: SelectionAdjustment,
    point: Point
): Rect => {
    const viewport = getViewportMetrics();
    const dx = point.x - adjustment.startPoint.x;
    const dy = point.y - adjustment.startPoint.y;
    const start = normalizeRectToViewport(adjustment.startRect);

    if (adjustment.kind === 'move') {
        return {
            ...start,
            left: Math.round(Math.min(
                Math.max(0, viewport.width - start.width),
                Math.max(0, start.left + dx)
            )),
            top: Math.round(Math.min(
                Math.max(0, viewport.height - start.height),
                Math.max(0, start.top + dy)
            ))
        };
    }

    const handle = adjustment.handle;
    if (!handle) return start;

    const minWidth = Math.min(MIN_SIZE, viewport.width);
    const minHeight = Math.min(MIN_SIZE, viewport.height);
    let left = Math.min(start.left, Math.max(0, viewport.width - minWidth));
    let top = Math.min(start.top, Math.max(0, viewport.height - minHeight));
    let right = Math.max(
        left + minWidth,
        Math.min(viewport.width, start.left + start.width)
    );
    let bottom = Math.max(
        top + minHeight,
        Math.min(viewport.height, start.top + start.height)
    );

    if (handle.includes('w')) {
        left = Math.min(right - minWidth, Math.max(0, start.left + dx));
    }
    if (handle.includes('e')) {
        right = Math.max(left + minWidth, Math.min(viewport.width, start.left + start.width + dx));
    }
    if (handle.includes('n')) {
        top = Math.min(bottom - minHeight, Math.max(0, start.top + dy));
    }
    if (handle.includes('s')) {
        bottom = Math.max(top + minHeight, Math.min(viewport.height, start.top + start.height + dy));
    }

    return {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(right - left),
        height: Math.round(bottom - top)
    };
};

const waitNextPaint = (): Promise<void> => {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
};

const toPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('이미지 생성 실패'));
                return;
            }
            resolve(blob);
        }, 'image/png');
    });
};

const saveBlobAsFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
};

const formatClock = (ms: number): string => {
    return new Date(ms).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const formatCaptureDimensions = (width: number, height: number): string => (
    `${width.toLocaleString('ko-KR')} × ${height.toLocaleString('ko-KR')} px`
);

const getClipboardStatusLabel = (status: CaptureHistoryItem['clipboardStatus']): string => {
    switch (status) {
        case 'copied':
            return '클립보드 복사됨';
        case 'pending':
            return '클립보드 확인 중';
        case 'unsupported':
            return '클립보드 미지원';
        case 'blocked':
            return '클립보드 차단됨';
        default:
            return '클립보드 미복사';
    }
};

const getClipboardStatusClassName = (status: CaptureHistoryItem['clipboardStatus']): string => {
    if (status === 'copied') {
        return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
    }
    if (status === 'pending') {
        return 'border-sky-400/40 bg-sky-500/15 text-sky-200';
    }
    return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
};

type CaptureHistoryActionsProps = {
    item: CaptureHistoryItem;
    disabled: boolean;
    label: string;
    onCopy: (item: CaptureHistoryItem) => void;
    onDownload: (item: CaptureHistoryItem) => void;
    onRemove: (itemId: string) => void;
};

const CaptureHistoryActions: React.FC<CaptureHistoryActionsProps> = ({
    item,
    disabled,
    label,
    onCopy,
    onDownload,
    onRemove
}) => (
    <div
        role="group"
        aria-label={`${label} 작업`}
        data-capture-history-actions="true"
        className="mt-2 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-2"
    >
        <button
            type="button"
            onClick={() => onCopy(item)}
            disabled={disabled}
            className="col-span-2 inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
        >
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
            {item.clipboardStatus === 'copied' ? '클립보드에 다시 복사' : '클립보드 복사'}
        </button>
        <button
            type="button"
            onClick={() => onDownload(item)}
            disabled={disabled}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/20 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
            <Download className="h-3.5 w-3.5 shrink-0" />
            PNG 저장
        </button>
        <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-2 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
        >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            삭제
        </button>
    </div>
);

const getClipboardFailureResult = (error: unknown): ClipboardCopyResult => {
    if (
        (error instanceof DOMException && (
            error.name === 'NotAllowedError'
            || error.name === 'SecurityError'
            || error.name === 'InvalidStateError'
        ))
        || !document.hasFocus()
    ) {
        return { ok: false, reason: 'blocked' };
    }

    return { ok: false, reason: 'failed' };
};

const copyBlobToClipboard = async (blob: Blob): Promise<ClipboardCopyResult> => {
    try {
        const ClipboardItemCtor = (window as unknown as {
            ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
        }).ClipboardItem;

        const clipboard = navigator.clipboard as Clipboard & {
            write?: (data: ClipboardItem[]) => Promise<void>;
        };

        if (
            window.isSecureContext === false
            || !ClipboardItemCtor
            || !clipboard?.write
        ) {
            return { ok: false, reason: 'unsupported' };
        }

        await clipboard.write([
            new ClipboardItemCtor({
                'image/png': blob
            })
        ]);
        return { ok: true };
    } catch (error) {
        return getClipboardFailureResult(error);
    }
};

const reserveClipboardWrite = (): ClipboardWriteReservation | null => {
    const ClipboardItemCtor = (window as unknown as {
        ClipboardItem?: new (
            items: Record<string, Blob | Promise<Blob>>
        ) => ClipboardItem;
    }).ClipboardItem;
    const clipboard = navigator.clipboard as Clipboard & {
        write?: (data: ClipboardItem[]) => Promise<void>;
    };

    if (
        window.isSecureContext === false
        || !ClipboardItemCtor
        || !clipboard?.write
    ) {
        return null;
    }

    let resolveBlob: (blob: Blob) => void = () => {};
    let rejectBlob: (error: unknown) => void = () => {};
    let settled = false;
    const blobPromise = new Promise<Blob>((resolve, reject) => {
        resolveBlob = resolve;
        rejectBlob = reject;
    });

    try {
        const clipboardItem = new ClipboardItemCtor({
            'image/png': blobPromise
        });
        const result = clipboard.write([clipboardItem])
            .then<ClipboardCopyResult>(() => ({ ok: true }))
            .catch((error: unknown) => getClipboardFailureResult(error));

        return {
            complete: (blob) => {
                if (settled) return;
                settled = true;
                resolveBlob(blob);
            },
            cancel: (error) => {
                if (settled) return;
                settled = true;
                rejectBlob(error);
            },
            result
        };
    } catch {
        // Some older ClipboardItem implementations accept only an immediate
        // Blob. Resolve the unused promise and use the regular post-render
        // clipboard path instead.
        settled = true;
        resolveBlob(new Blob());
        return null;
    }
};

const hideExcludedRoots = () => {
    const excludedRoots = Array.from(document.querySelectorAll<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR));
    const prevInlineStyles = excludedRoots.map((el) => ({
        el,
        visibility: el.style.visibility,
        opacity: el.style.opacity,
        pointerEvents: el.style.pointerEvents
    }));

    excludedRoots.forEach((el) => {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
    });

    return () => {
        prevInlineStyles.forEach(({ el, visibility, opacity, pointerEvents }) => {
            el.style.visibility = visibility;
            el.style.opacity = opacity;
            el.style.pointerEvents = pointerEvents;
        });
    };
};

export const hideFixedAndStickyInterference = (target: HTMLElement | null = null) => {
    const shouldPreserveTargetChildren = !!target && !isDocumentScrollRoot(target);
    const candidates = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
    const prevInlineStyles: Array<{
        el: HTMLElement;
        visibility: string;
        opacity: string;
        pointerEvents: string;
    }> = [];
    candidates.forEach((el) => {
        if (el.closest(CAPTURE_OVERLAY_SELECTOR) || el.closest(CAPTURE_EXCLUDE_SELECTOR)) return;
        // Preserve the scrolling element and its ancestors, but not vertical
        // sticky/fixed descendants. Those descendants otherwise repeat in
        // every stitched frame.
        if (shouldPreserveTargetChildren && (el === target || el.contains(target))) return;

        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') return;
        if (
            style.position === 'sticky'
            && (style.top === 'auto' || style.top === '')
            && (style.bottom === 'auto' || style.bottom === '')
        ) {
            // A left/right-only sticky table cell moves with vertical content
            // and should remain part of the stitched image.
            return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;

        prevInlineStyles.push({
            el,
            visibility: el.style.visibility,
            opacity: el.style.opacity,
            pointerEvents: el.style.pointerEvents
        });

        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
    });

    return {
        hiddenCount: prevInlineStyles.length,
        restore: () => {
            prevInlineStyles.forEach(({ el, visibility, opacity, pointerEvents }) => {
                el.style.visibility = visibility;
                el.style.opacity = opacity;
                el.style.pointerEvents = pointerEvents;
            });
        }
    };
};

const hideCaptureInterference = (target: HTMLElement | null = null) => {
    const restoreExcludedRoots = hideExcludedRoots();
    const fixedAndSticky = hideFixedAndStickyInterference(target);

    return {
        hiddenCount: fixedAndSticky.hiddenCount,
        restore: () => {
            fixedAndSticky.restore();
            restoreExcludedRoots();
        }
    };
};

type DisplayMediaOptions = {
    video: (MediaTrackConstraints & { cursor?: DisplayCursorConstraint }) | boolean;
    audio: boolean;
    preferCurrentTab?: boolean;
    selfBrowserSurface?: 'include' | 'exclude';
    surfaceSwitching?: 'include' | 'exclude';
    monitorTypeSurfaces?: 'include' | 'exclude';
};

type DisplayMediaTrackConstraints = MediaTrackConstraints & {
    cursor?: DisplayCursorConstraint;
    resizeMode?: 'none' | 'crop-and-scale';
};

const QUICK_CAMERA_CURSOR_HIDE_STYLE_ID = 'quick-camera-cursor-hide-style';
const QUICK_CAMERA_CURSOR_HIDE_ATTR = 'data-quick-camera-cursor-hidden';

const hideDocumentCursorForCapture = () => {
    const root = document.documentElement;
    const previousAttr = root.getAttribute(QUICK_CAMERA_CURSOR_HIDE_ATTR);
    const hadAttr = root.hasAttribute(QUICK_CAMERA_CURSOR_HIDE_ATTR);

    if (!document.getElementById(QUICK_CAMERA_CURSOR_HIDE_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = QUICK_CAMERA_CURSOR_HIDE_STYLE_ID;
        style.textContent = `
html[${QUICK_CAMERA_CURSOR_HIDE_ATTR}='true'],
html[${QUICK_CAMERA_CURSOR_HIDE_ATTR}='true'] * {
  cursor: none !important;
}`;
        document.head.appendChild(style);
    }

    root.setAttribute(QUICK_CAMERA_CURSOR_HIDE_ATTR, 'true');

    return () => {
        if (hadAttr && previousAttr !== null) {
            root.setAttribute(QUICK_CAMERA_CURSOR_HIDE_ATTR, previousAttr);
            return;
        }

        root.removeAttribute(QUICK_CAMERA_CURSOR_HIDE_ATTR);
    };
};

const applyNoCursorCaptureConstraint = async (track: MediaStreamTrack) => {
    try {
        const constraints: DisplayMediaTrackConstraints = { cursor: 'never' };
        await track.applyConstraints(constraints);
    } catch {
        // Some browsers ignore display-capture cursor constraints. CSS cursor hiding is still applied.
    }
};

const getViewportMetrics = (): ViewportMetrics => {
    // Pointer client coordinates and the fixed selection overlay both use the
    // layout viewport. visualViewport can be smaller or offset while zoomed,
    // which made the displayed selection and the captured crop diverge.
    return {
        width: Math.max(1, window.innerWidth || document.documentElement.clientWidth),
        height: Math.max(1, window.innerHeight || document.documentElement.clientHeight)
    };
};

const waitForStableViewport = async (): Promise<ViewportMetrics> => {
    let previous = getViewportMetrics();
    let stableFrames = 0;

    for (let attempt = 0; attempt < 12; attempt += 1) {
        await waitNextPaint();
        const current = getViewportMetrics();
        const isStable = (
            Math.abs(current.width - previous.width) <= 1
            && Math.abs(current.height - previous.height) <= 1
        );

        stableFrames = isStable ? stableFrames + 1 : 0;
        previous = current;
        if (stableFrames >= 2) return current;
    }

    return previous;
};

export const getHighResolutionDisplayMediaConstraints = (
    viewport: ViewportMetrics = getViewportMetrics(),
    devicePixelRatio = window.devicePixelRatio || 1
): DisplayMediaTrackConstraints => {
    // Request a denser source frame instead of enlarging the finished PNG.
    // `ideal` lets the browser fall back to the largest resolution the shared
    // tab supports, while resizeMode keeps the source from being scaled down.
    const desiredScale = Math.min(
        MAX_SCREEN_CAPTURE_SOURCE_SCALE,
        Math.max(MIN_SCREEN_CAPTURE_SOURCE_SCALE, devicePixelRatio)
    );
    const supportedScale = Math.max(1, Math.min(
        MAX_SCREEN_CAPTURE_SOURCE_SCALE,
        MAX_SCREEN_CAPTURE_SOURCE_WIDTH / viewport.width,
        MAX_SCREEN_CAPTURE_SOURCE_HEIGHT / viewport.height
    ));
    const sourceScale = Math.min(desiredScale, supportedScale);

    return {
        frameRate: { ideal: 30, max: 30 },
        width: { ideal: Math.round(viewport.width * sourceScale) },
        height: { ideal: Math.round(viewport.height * sourceScale) },
        cursor: 'never',
        resizeMode: 'none'
    };
};

export const getPermissionFreeCaptureScale = (
    viewport: ViewportMetrics,
    devicePixelRatio = window.devicePixelRatio || 1
): number => {
    const desiredScale = Math.min(
        MAX_SCREEN_CAPTURE_SOURCE_SCALE,
        Math.max(MIN_SCREEN_CAPTURE_SOURCE_SCALE, devicePixelRatio)
    );
    const supportedScale = Math.max(1, Math.min(
        MAX_SCREEN_CAPTURE_SOURCE_SCALE,
        MAX_SCREEN_CAPTURE_SOURCE_WIDTH / viewport.width,
        MAX_SCREEN_CAPTURE_SOURCE_HEIGHT / viewport.height
    ));

    return Math.min(desiredScale, supportedScale);
};

const getFullContentCaptureTarget = () => (
    document.querySelector<HTMLElement>(FULL_CONTENT_CAPTURE_SELECTOR)
);

const getFullContentCaptureDimensions = (target: HTMLElement): ViewportMetrics => {
    const rect = target.getBoundingClientRect();
    return {
        width: Math.max(1, Math.ceil(Math.max(target.scrollWidth, target.clientWidth, rect.width))),
        height: Math.max(1, Math.ceil(Math.max(target.scrollHeight, target.clientHeight, rect.height)))
    };
};

export const makeCaptureTextCloneSafe = (clonedDocument: Document) => {
    // html2canvas can trim the lower Korean glyph pixels in a tight,
    // ellipsized line box. This adjustment is clone-only, so it never moves
    // the text in the live application UI.
    clonedDocument.querySelectorAll<HTMLElement>(CAPTURE_TEXT_SAFE_SELECTOR).forEach((element) => {
        const computedStyle = clonedDocument.defaultView?.getComputedStyle(element);
        const fontSize = Number.parseFloat(computedStyle?.fontSize || element.style.fontSize || '14');
        const safeLineHeight = Math.ceil((Number.isFinite(fontSize) ? fontSize : 14) * 1.45);
        const safeBoxHeight = safeLineHeight + 4;

        element.style.overflow = 'visible';
        element.style.textOverflow = 'clip';
        element.style.whiteSpace = 'nowrap';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.boxSizing = 'border-box';
        element.style.height = `${safeBoxHeight}px`;
        element.style.minHeight = `${safeBoxHeight}px`;
        element.style.lineHeight = `${safeLineHeight}px`;
        element.style.paddingTop = '0';
        element.style.paddingBottom = '0';
        element.style.transform = 'none';
        element.style.verticalAlign = 'baseline';
    });
};

export const getFrameSourceRect = (
    sourceWidth: number,
    sourceHeight: number,
    rect: Rect,
    viewport: ViewportMetrics = getViewportMetrics()
) => {
    const scaleX = sourceWidth / viewport.width;
    const scaleY = sourceHeight / viewport.height;

    const left = Math.max(0, Math.min(viewport.width, rect.left));
    const top = Math.max(0, Math.min(viewport.height, rect.top));
    const right = Math.max(left, Math.min(viewport.width, rect.left + rect.width));
    const bottom = Math.max(top, Math.min(viewport.height, rect.top + rect.height));

    // Keep the whole CSS-pixel selection. Flooring the start and ceiling the
    // end avoids losing a one-pixel edge at fractional browser/DPI scales.
    let sourceX = Math.floor(left * scaleX);
    let sourceY = Math.floor(top * scaleY);
    let sourceW = Math.ceil(right * scaleX) - sourceX;
    let sourceH = Math.ceil(bottom * scaleY) - sourceY;

    sourceX = Math.max(0, Math.min(sourceX, Math.max(0, sourceWidth - 1)));
    sourceY = Math.max(0, Math.min(sourceY, Math.max(0, sourceHeight - 1)));
    sourceW = Math.max(1, Math.min(sourceW, sourceWidth - sourceX));
    sourceH = Math.max(1, Math.min(sourceH, sourceHeight - sourceY));

    return { sourceX, sourceY, sourceW, sourceH, scaleX, scaleY };
};

export const isFrameAspectCompatible = (
    sourceWidth: number,
    sourceHeight: number,
    viewport: ViewportMetrics,
    tolerance = 0.015
) => {
    if (
        sourceWidth < 1
        || sourceHeight < 1
        || viewport.width < 1
        || viewport.height < 1
    ) {
        return false;
    }

    const sourceAspect = sourceWidth / sourceHeight;
    const viewportAspect = viewport.width / viewport.height;
    return Math.abs(sourceAspect - viewportAspect) / viewportAspect <= tolerance;
};

const getVideoSourceRect = (
    video: HTMLVideoElement,
    rect: Rect,
    viewport: ViewportMetrics = getViewportMetrics()
) => getFrameSourceRect(video.videoWidth, video.videoHeight, rect, viewport);

const cropVideoFrameToCanvas = (
    video: HTMLVideoElement,
    crop: { sourceX: number; sourceY: number; sourceW: number; sourceH: number }
) => {
    const canvas = document.createElement('canvas');
    canvas.width = crop.sourceW;
    canvas.height = crop.sourceH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('캔버스 컨텍스트 생성 실패');
    }

    ctx.drawImage(
        video,
        crop.sourceX,
        crop.sourceY,
        crop.sourceW,
        crop.sourceH,
        0,
        0,
        crop.sourceW,
        crop.sourceH
    );

    return canvas;
};

const freezeVideoFrameToCanvas = (video: HTMLVideoElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('캔버스 컨텍스트 생성 실패');
    }

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    return canvas;
};

const cropFrozenFrameToCanvas = (
    sourceCanvas: HTMLCanvasElement,
    crop: { sourceX: number; sourceY: number; sourceW: number; sourceH: number }
) => {
    const canvas = document.createElement('canvas');
    canvas.width = crop.sourceW;
    canvas.height = crop.sourceH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('캔버스 컨텍스트 생성 실패');
    }

    // Preserve the frozen compositor pixels 1:1. No CSS-sized 2x export or
    // secondary resampling is applied after the user selects the preview.
    ctx.drawImage(
        sourceCanvas,
        crop.sourceX,
        crop.sourceY,
        crop.sourceW,
        crop.sourceH,
        0,
        0,
        crop.sourceW,
        crop.sourceH
    );
    return canvas;
};

const getSafeScrollCanvasScale = (sourceWidth: number, sourceHeight: number): number => {
    if (sourceWidth < 1 || sourceHeight < 1) return 1;

    const heightScale = MAX_SCROLL_CAPTURE_CANVAS_HEIGHT / sourceHeight;
    const areaScale = Math.sqrt(MAX_SCROLL_CAPTURE_CANVAS_AREA / (sourceWidth * sourceHeight));
    return Math.min(1, heightScale, areaScale);
};

const isScrollableElement = (el: HTMLElement) => {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    return /(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1;
};

const isDocumentScrollRoot = (el: HTMLElement | null) => {
    return !!el && (
        el === document.scrollingElement ||
        el === document.documentElement ||
        el === document.body
    );
};

const getVisibleRectForScrollableTarget = (target: HTMLElement): Rect => {
    if (isDocumentScrollRoot(target)) {
        const viewport = getViewportMetrics();
        return {
            left: 0,
            top: 0,
            width: viewport.width,
            height: viewport.height
        };
    }

    const box = target.getBoundingClientRect();
    const viewport = getViewportMetrics();
    const left = Math.max(0, box.left);
    const top = Math.max(0, box.top);
    const right = Math.min(viewport.width, box.right);
    const bottom = Math.min(viewport.height, box.bottom);

    return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top)
    };
};

const intersectRects = (a: Rect, b: Rect): Rect | null => {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.left + a.width, b.left + b.width);
    const bottom = Math.min(a.top + a.height, b.top + b.height);

    if (right - left < 1 || bottom - top < 1) {
        return null;
    }

    return {
        left,
        top,
        width: right - left,
        height: bottom - top
    };
};

const getUnderlyingElementsFromPoint = (x: number, y: number): HTMLElement[] => {
    const viewport = getViewportMetrics();
    const safeX = Math.min(viewport.width - 1, Math.max(0, x));
    const safeY = Math.min(viewport.height - 1, Math.max(0, y));
    const stack = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(safeX, safeY)
        : [document.elementFromPoint(safeX, safeY)].filter(Boolean) as Element[];

    return stack.filter((node): node is HTMLElement => {
        return node instanceof HTMLElement
            && !node.closest(CAPTURE_OVERLAY_SELECTOR)
            && !node.closest(CAPTURE_EXCLUDE_SELECTOR);
    });
};

const findNearestScrollableAncestor = (node: HTMLElement | null): HTMLElement | null => {
    while (node) {
        if (!node.closest(CAPTURE_OVERLAY_SELECTOR) && !node.closest(CAPTURE_EXCLUDE_SELECTOR) && isScrollableElement(node)) {
            return node;
        }
        node = node.parentElement;
    }

    return null;
};

const pickScrollableTargetFromPoints = (points: Array<{ x: number; y: number }>): HTMLElement | null => {
    const scores = new Map<HTMLElement, number>();

    points.forEach((point) => {
        const stack = getUnderlyingElementsFromPoint(point.x, point.y);
        for (const el of stack) {
            const candidate = findNearestScrollableAncestor(el);
            if (!candidate) continue;
            scores.set(candidate, (scores.get(candidate) ?? 0) + 1);
            break;
        }
    });

    if (scores.size > 0) {
        return Array.from(scores.entries())
            .sort((a, b) => {
                if (b[1] !== a[1]) {
                    return b[1] - a[1];
                }

                const areaA = getVisibleRectForScrollableTarget(a[0]).width * getVisibleRectForScrollableTarget(a[0]).height;
                const areaB = getVisibleRectForScrollableTarget(b[0]).width * getVisibleRectForScrollableTarget(b[0]).height;
                return areaA - areaB;
            })[0][0];
    }

    const root = document.scrollingElement as HTMLElement | null;
    if (root && root.scrollHeight > root.clientHeight + 1) {
        return root;
    }

    return null;
};

const findScrollableTargetFromRect = (rect: Rect): HTMLElement | null => {
    const insetX = Math.min(16, Math.max(4, rect.width * 0.2));
    const insetY = Math.min(16, Math.max(4, rect.height * 0.2));

    return pickScrollableTargetFromPoints([
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { x: rect.left + insetX, y: rect.top + insetY },
        { x: rect.left + rect.width - insetX, y: rect.top + insetY },
        { x: rect.left + insetX, y: rect.top + rect.height - insetY },
        { x: rect.left + rect.width - insetX, y: rect.top + rect.height - insetY }
    ]);
};

const findScrollableTargetFromPoint = (x: number, y: number): HTMLElement | null => {
    return pickScrollableTargetFromPoints([{ x, y }]);
};

const resolveScrollCapturePlan = (rect: Rect, preferredTarget: HTMLElement | null = null): ScrollCapturePlan => {
    const target = findScrollableTargetFromRect(rect) ?? preferredTarget ?? null;
    const targetRect = target ? getVisibleRectForScrollableTarget(target) : null;
    const captureRect = rect;
    const movingRect = targetRect ? (intersectRects(rect, targetRect) ?? rect) : rect;
    const initialScrollTop = target?.scrollTop ?? 0;
    const maxScrollTop = target
        ? Math.max(initialScrollTop, target.scrollHeight - target.clientHeight)
        : 0;
    const scrollStepCss = Math.max(1, Math.floor(movingRect.height));
    const canScroll = !!target
        && movingRect.width >= MIN_SIZE
        && movingRect.height >= MIN_SIZE
        && target.scrollHeight > target.clientHeight + 1;
    const estimatedSteps = canScroll
        ? Math.max(1, 1 + Math.ceil(Math.max(0, maxScrollTop - initialScrollTop) / scrollStepCss))
        : 1;

    return {
        target,
        captureRect,
        movingRect,
        initialScrollTop,
        restoreScrollTop: initialScrollTop,
        maxScrollTop,
        scrollStepCss,
        canScroll,
        estimatedSteps
    };
};

const scrollElementTo = (target: HTMLElement, top: number) => {
    if (typeof target.scrollTo === 'function') {
        target.scrollTo({ top, behavior: 'auto' });
        return;
    }
    target.scrollTop = top;
};

const getScrollTop = (target: HTMLElement | null): number => {
    return target?.scrollTop ?? 0;
};

const getMaxScrollTop = (target: HTMLElement | null): number => {
    if (!target) return 0;
    return Math.max(0, target.scrollHeight - target.clientHeight);
};

const forceInstantScrollBehavior = (target: HTMLElement) => {
    const candidates = isDocumentScrollRoot(target)
        ? [document.documentElement, document.body, target]
        : [target];
    const elements = Array.from(new Set(candidates));
    const previous = elements.map((el) => ({
        el,
        value: el.style.getPropertyValue('scroll-behavior'),
        priority: el.style.getPropertyPriority('scroll-behavior')
    }));

    elements.forEach((el) => {
        el.style.setProperty('scroll-behavior', 'auto', 'important');
    });

    return () => {
        previous.forEach(({ el, value, priority }) => {
            if (value) {
                el.style.setProperty('scroll-behavior', value, priority);
                return;
            }
            el.style.removeProperty('scroll-behavior');
        });
    };
};

const getContentYForViewportPoint = (target: HTMLElement, y: number): number => {
    const targetRect = getVisibleRectForScrollableTarget(target);
    const clampedY = Math.min(
        targetRect.top + targetRect.height,
        Math.max(targetRect.top, y)
    );

    return getScrollTop(target) + Math.max(0, clampedY - targetRect.top);
};

const resolveScrollRangeCapturePlan = (anchor: ScrollSelectionAnchor, endPoint: Point): ScrollCapturePlan => {
    const target = anchor.target ?? findScrollableTargetFromPoint(endPoint.x, endPoint.y);

    if (!target) {
        return resolveScrollCapturePlan(buildRect(anchor.point, endPoint), null);
    }

    const targetRect = getVisibleRectForScrollableTarget(target);
    const endScrollTop = getScrollTop(target);
    const startContentY = anchor.target === target
        ? anchor.contentY
        : getContentYForViewportPoint(target, anchor.point.y);
    const endContentY = getContentYForViewportPoint(target, endPoint.y);
    const topContentY = Math.min(startContentY, endContentY);
    const bottomContentY = Math.max(startContentY, endContentY);
    const left = Math.max(0, Math.min(anchor.point.x, endPoint.x));
    const viewport = getViewportMetrics();
    const right = Math.min(viewport.width, Math.max(anchor.point.x, endPoint.x));
    const width = Math.max(0, right - left);
    const maxScrollTop = getMaxScrollTop(target);
    const anchorScrollTop = anchor.target === target ? anchor.scrollTop : getScrollTop(target);
    const initialScrollTop = Math.max(0, Math.min(maxScrollTop, Math.min(anchorScrollTop, endScrollTop, topContentY)));
    const firstVisibleBottom = Math.min(bottomContentY, initialScrollTop + targetRect.height);
    const firstTop = targetRect.top + Math.max(0, topContentY - initialScrollTop);
    const firstHeight = Math.max(1, firstVisibleBottom - topContentY);
    const captureRect = {
        left,
        top: Math.min(targetRect.top + targetRect.height, Math.max(targetRect.top, firstTop)),
        width,
        height: Math.min(targetRect.height, firstHeight)
    };
    const movingRect = intersectRects(captureRect, targetRect) ?? captureRect;
    const rangeHeight = bottomContentY - topContentY;
    const scrollStepCss = Math.max(1, Math.floor(targetRect.height));
    const canScroll = target.scrollHeight > target.clientHeight + 1 && rangeHeight >= MIN_SIZE;
    const estimatedSteps = canScroll
        ? Math.max(1, 1 + Math.ceil(Math.max(0, bottomContentY - (initialScrollTop + targetRect.height)) / scrollStepCss))
        : 1;

    return {
        target,
        captureRect,
        movingRect,
        initialScrollTop,
        restoreScrollTop: endScrollTop,
        maxScrollTop,
        scrollStepCss,
        canScroll,
        estimatedSteps,
        range: {
            left,
            width,
            topContentY,
            bottomContentY,
            startScrollTop: initialScrollTop,
            endScrollTop
        }
    };
};

const getSelectionPromptMessage = (mode: CaptureMode) => {
    if (mode === 'scroll') {
        return '\uc2dc\uc791\uc810\uc744 \ud074\ub9ad\ud55c \ub4a4 \uc2a4\ud06c\ub864\ud558\uace0, \ub9c8\uc9c0\ub9c9 \uc120\ud0dd\uc810\uc744 \ud074\ub9ad\ud558\uc138\uc694. \uc800\uc7a5\ud560 \ub54c\ub294 \ud604\uc7ac \ube0c\ub77c\uc6b0\uc800 \ud0ed\uc744 \uc120\ud0dd\ud574\uc57c \ud569\ub2c8\ub2e4. (ESC \ucde8\uc18c)';
    }
    return '고정된 실제 화면 위에서 저장할 영역을 드래그하세요. 테두리를 조절한 뒤 “캡처 후 클립보드 복사”를 누르세요. (ESC 취소)';
};

const getScrollCapturePlanHeight = (plan: ScrollCapturePlan) => {
    if (plan.range) {
        return Math.max(0, plan.range.bottomContentY - plan.range.topContentY);
    }

    if (!plan.canScroll) {
        return Math.max(0, plan.captureRect.height);
    }

    return Math.max(
        plan.captureRect.height,
        plan.maxScrollTop - plan.initialScrollTop + plan.movingRect.height
    );
};

const getScrollCaptureRisk = (plan: ScrollCapturePlan): {
    level: 'safe' | 'warn' | 'block';
    heightCss: number;
    message: string;
} => {
    const heightCss = getScrollCapturePlanHeight(plan);
    const roundedHeight = Math.round(heightCss).toLocaleString();

    if (heightCss > SCROLL_CAPTURE_BLOCK_HEIGHT_CSS || plan.estimatedSteps > SCROLL_CAPTURE_BLOCK_STEPS) {
        return {
            level: 'block',
            heightCss,
            message: `선택한 스크롤 구간이 너무 깁니다. 예상 높이 ${roundedHeight}px, 약 ${plan.estimatedSteps}회 캡처가 필요합니다. 구간을 나눠서 캡처해 주세요.`
        };
    }

    if (heightCss > SCROLL_CAPTURE_WARN_HEIGHT_CSS || plan.estimatedSteps > SCROLL_CAPTURE_WARN_STEPS) {
        return {
            level: 'warn',
            heightCss,
            message: `선택한 구간이 깁니다. 예상 높이 ${roundedHeight}px, 약 ${plan.estimatedSteps}회 캡처가 필요해 결과가 축소되거나 이어붙임이 어긋날 수 있습니다. 계속할까요?`
        };
    }

    return {
        level: 'safe',
        heightCss,
        message: ''
    };
};

const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
    return new Promise((resolve, reject) => {
        let timeoutId = 0;
        const cleanup = () => {
            window.clearTimeout(timeoutId);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleError);
        };

        const handleLoadedMetadata = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('video-load-failed'));
        };

        if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
            return;
        }

        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video.addEventListener('error', handleError, { once: true });
        timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error('video-load-timeout'));
        }, 10000);
    });
};

const hasUsableCapturedFrame = (video: HTMLVideoElement) => (
    video.videoWidth > 0
    && video.videoHeight > 0
    && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && !video.error
);

export const waitForCapturedFrame = async (
    video: HTMLVideoElement,
    frameTimeoutMs = 5000,
    allowExistingFrameOnTimeout = false
) => {
    if ('requestVideoFrameCallback' in video) {
        const receivedFreshFrame = await new Promise<boolean>((resolve) => {
            const timeoutId = window.setTimeout(() => {
                resolve(false);
            }, frameTimeoutMs);
            const requestFrame = (video as HTMLVideoElement & {
                requestVideoFrameCallback?: (callback: () => void) => number;
            }).requestVideoFrameCallback;

            if (!requestFrame) {
                window.clearTimeout(timeoutId);
                resolve(false);
                return;
            }

            requestFrame.call(video, () => {
                window.clearTimeout(timeoutId);
                resolve(true);
            });
        });

        // Some Chromium/extension combinations stop delivering
        // requestVideoFrameCallback while a perfectly drawable compositor
        // frame is already present. Do not discard that valid frame.
        if (
            receivedFreshFrame
            || (allowExistingFrameOnTimeout && hasUsableCapturedFrame(video))
        ) {
            return;
        }

        throw new Error('video-frame-timeout');
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    if (allowExistingFrameOnTimeout && !hasUsableCapturedFrame(video)) {
        throw new Error('video-frame-timeout');
    }
};

const scrollToFreshCapturedFrame = async (
    target: HTMLElement,
    requestedTop: number,
    video: HTMLVideoElement
): Promise<number> => {
    scrollElementTo(target, requestedTop);

    let previousScrollTop = getScrollTop(target);
    let stableChecks = 0;

    for (let attempt = 0; attempt < 10; attempt += 1) {
        await waitNextPaint();
        const currentScrollTop = getScrollTop(target);
        stableChecks = Math.abs(currentScrollTop - previousScrollTop) <= 0.25
            ? stableChecks + 1
            : 0;
        previousScrollTop = currentScrollTop;

        if (stableChecks >= 2) {
            break;
        }
    }

    // Tab capture is compositor-backed and can trail the DOM by one frame.
    // Waiting for two fresh video frames prevents stitching the pre-scroll
    // pixels with the new scroll coordinates.
    await waitForCapturedFrame(video);
    await waitForCapturedFrame(video);
    return getScrollTop(target);
};

const waitForCursorlessCaptureFrame = async (
    video: HTMLVideoElement,
    allowExistingFrameOnTimeout = false
) => {
    await waitNextPaint();
    const timeoutMs = allowExistingFrameOnTimeout ? 2500 : 5000;
    await waitForCapturedFrame(video, timeoutMs, allowExistingFrameOnTimeout);
    await waitForCapturedFrame(video, timeoutMs, allowExistingFrameOnTimeout);
};

const QuickCameraCapture: React.FC = () => {
    const [captureMode, setCaptureMode] = useState<CaptureMode>('screen');
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
    const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<string>('실제 화면을 고정한 뒤 선택한 영역을 원본 픽셀 그대로 복사할 수 있습니다.');
    const [processingStatusText, setProcessingStatusText] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    const [captureHistory, setCaptureHistory] = useState<CaptureHistoryItem[]>([]);
    const [pendingClipboardCopy, setPendingClipboardCopy] = useState<PendingClipboardCopy | null>(null);
    const [scrollAnchorPoint, setScrollAnchorPoint] = useState<Point | null>(null);
    const [selectionReady, setSelectionReady] = useState(false);
    const [frozenFramePreviewReady, setFrozenFramePreviewReady] = useState(false);

    const rootRef = useRef<HTMLDivElement>(null);
    const selectionOverlayRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const draggingRef = useRef(false);
    const activeSelectionPointerIdRef = useRef<number | null>(null);
    const previousSelectionRectRef = useRef<Rect | null>(null);
    const selectionAdjustmentRef = useRef<SelectionAdjustment | null>(null);
    const scrollSelectionAnchorRef = useRef<ScrollSelectionAnchor | null>(null);
    const selectionScrollTargetRef = useRef<HTMLElement | null>(null);
    const hiddenPanelRestoreRef = useRef<(() => void) | null>(null);
    const scrollCapturePlanRef = useRef<ScrollCapturePlan | null>(null);
    const abortProcessingRef = useRef(false);
    const activeStreamRef = useRef<MediaStream | null>(null);
    const activeVideoRef = useRef<HTMLVideoElement | null>(null);
    const cursorPointRef = useRef<Point | null>(null);
    const selectionRectRef = useRef<Rect | null>(null);
    const selectionReturnFocusRef = useRef<HTMLElement | null>(null);
    const captureHistoryRef = useRef<CaptureHistoryItem[]>([]);
    const captureOperationInFlightRef = useRef(false);
    const screenSessionIdRef = useRef(0);
    const screenCapturePhaseRef = useRef<ScreenCapturePhase>('idle');
    const screenCaptureUiRestoreRef = useRef<(() => void) | null>(null);
    const frozenScreenFrameRef = useRef<FrozenScreenFrame | null>(null);

    const renderFrozenFramePreview = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;

        const frame = frozenScreenFrameRef.current;
        if (!frame) return;

        canvas.width = frame.width;
        canvas.height = frame.height;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(frame.canvas, 0, 0);
    }, []);

    const clearProcessingGuide = useCallback(() => {
        abortProcessingRef.current = false;
        setProcessingStatusText('');
    }, []);

    const requestProcessingCancel = useCallback(() => {
        abortProcessingRef.current = true;
        setProcessingStatusText('스크롤 캡처를 취소하는 중입니다...');
    }, []);

    useEffect(() => {
        cursorPointRef.current = cursorPoint;
    }, [cursorPoint]);

    useEffect(() => {
        selectionRectRef.current = selectionRect;
    }, [selectionRect]);

    const stopActiveCaptureResources = useCallback(() => {
        if (activeVideoRef.current) {
            activeVideoRef.current.pause();
            activeVideoRef.current.srcObject = null;
            activeVideoRef.current = null;
        }

        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach((track) => track.stop());
            activeStreamRef.current = null;
        }
    }, []);

    const clearFrozenScreenFrame = useCallback(() => {
        frozenScreenFrameRef.current = null;
        setFrozenFramePreviewReady(false);
    }, []);

    const restoreScreenCaptureUi = useCallback(() => {
        const restore = screenCaptureUiRestoreRef.current;
        screenCaptureUiRestoreRef.current = null;
        restore?.();
    }, []);

    const endScreenCaptureSession = useCallback(() => {
        restoreScreenCaptureUi();
        screenSessionIdRef.current += 1;
        screenCapturePhaseRef.current = 'idle';
        captureOperationInFlightRef.current = false;
        stopActiveCaptureResources();
    }, [restoreScreenCaptureUi, stopActiveCaptureResources]);

    const completeScreenCaptureSession = useCallback(() => {
        restoreScreenCaptureUi();
        screenCapturePhaseRef.current = 'idle';
        captureOperationInFlightRef.current = false;
    }, [restoreScreenCaptureUi]);

    const restoreHiddenPanel = useCallback(() => {
        hiddenPanelRestoreRef.current?.();
        hiddenPanelRestoreRef.current = null;

        const focusTarget = selectionReturnFocusRef.current;
        selectionReturnFocusRef.current = null;
        if (focusTarget?.isConnected) {
            window.requestAnimationFrame(() => {
                focusTarget.focus({ preventScroll: true });
            });
        }
    }, []);

    const hideHostPanel = useCallback(() => {
        restoreHiddenPanel();
        const host = rootRef.current?.closest<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR);
        if (!host) return;

        const prevVisibility = host.style.visibility;
        const prevOpacity = host.style.opacity;
        const prevPointerEvents = host.style.pointerEvents;
        const prevTransform = host.style.transform;
        const prevFilter = host.style.filter;

        host.style.visibility = 'hidden';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        host.style.transform = `${host.style.transform || ''} translateY(16px)`.trim();
        host.style.filter = 'blur(2px)';

        hiddenPanelRestoreRef.current = () => {
            host.style.visibility = prevVisibility;
            host.style.opacity = prevOpacity;
            host.style.pointerEvents = prevPointerEvents;
            host.style.transform = prevTransform;
            host.style.filter = prevFilter;
        };
    }, [restoreHiddenPanel]);

    const resetSelection = () => {
        endScreenCaptureSession();
        clearFrozenScreenFrame();
        setIsSelecting(false);
        setSelectionReady(false);
        draggingRef.current = false;
        dragStartRef.current = null;
        activeSelectionPointerIdRef.current = null;
        previousSelectionRectRef.current = null;
        selectionAdjustmentRef.current = null;
        scrollSelectionAnchorRef.current = null;
        selectionScrollTargetRef.current = null;
        scrollCapturePlanRef.current = null;
        restoreHiddenPanel();
        setSelectionRect(null);
        setCursorPoint(null);
        setScrollAnchorPoint(null);
        clearProcessingGuide();
    };

    const startSelection = useCallback(() => {
        const returnFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        // Keep the capture panel out of the way from the moment the user
        // starts a selection. It is restored after capture, cancellation, or
        // an error so the page never gets captured with its own controls.
        hideHostPanel();
        selectionReturnFocusRef.current = returnFocus;
        setMessage(getSelectionPromptMessage(captureMode));
        setIsSuccess(null);
        setSelectionReady(false);
        draggingRef.current = false;
        dragStartRef.current = null;
        activeSelectionPointerIdRef.current = null;
        previousSelectionRectRef.current = null;
        selectionAdjustmentRef.current = null;
        scrollSelectionAnchorRef.current = null;
        selectionScrollTargetRef.current = null;
        scrollCapturePlanRef.current = null;
        setSelectionRect(null);
        setCursorPoint(null);
        setScrollAnchorPoint(null);
        clearProcessingGuide();
        setIsSelecting(true);
    }, [captureMode, clearProcessingGuide, hideHostPanel]);

    useEffect(() => {
        captureHistoryRef.current = captureHistory;
    }, [captureHistory]);

    useEffect(() => {
        return () => {
            captureHistoryRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        };
    }, []);

    useEffect(() => {
        return () => {
            endScreenCaptureSession();
            frozenScreenFrameRef.current = null;
            restoreHiddenPanel();
        };
    }, [endScreenCaptureSession, restoreHiddenPanel]);

    useEffect(() => {
        if (isSelecting || isProcessing) return;

        const host = rootRef.current?.closest<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR);
        if (!host || hiddenPanelRestoreRef.current) return;

        if (host.style.pointerEvents === 'none') {
            host.style.pointerEvents = '';
        }
        if (host.style.visibility === 'hidden') {
            host.style.visibility = '';
        }
        if (host.style.opacity === '0') {
            host.style.opacity = '';
        }
    }, [isProcessing, isSelecting]);

    useEffect(() => {
        clearFrozenScreenFrame();
        setSelectionReady(false);
        previousSelectionRectRef.current = null;
        selectionAdjustmentRef.current = null;
        scrollSelectionAnchorRef.current = null;
        setScrollAnchorPoint(null);
        setSelectionRect(null);
        if (captureMode === 'scroll') {
            setMessage(getSelectionPromptMessage('scroll'));
            return;
        }
        scrollCapturePlanRef.current = null;
        setMessage('“실제 영역 선택 시작”을 누르고 최초 한 번 현재 탭을 허용하세요. 이후 고정된 실제 화면에서 범위를 드래그하면 됩니다.');
    }, [captureMode, clearFrozenScreenFrame]);

    const pushCaptureHistory = useCallback((blob: Blob, width: number, height: number) => {
        const previewUrl = URL.createObjectURL(blob);
        const item: CaptureHistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            blob,
            previewUrl,
            createdAt: Date.now(),
            width,
            height,
            clipboardStatus: 'pending',
            downloadRequested: false
        };

        setCaptureHistory((prev) => {
            const next = [item, ...prev].slice(0, 3);
            if (prev.length >= 3) {
                prev.slice(2).forEach((old) => URL.revokeObjectURL(old.previewUrl));
            }
            return next;
        });
        return item;
    }, []);

    const clearCaptureHistory = useCallback(() => {
        setCaptureHistory((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
            return [];
        });
        setPendingClipboardCopy(null);
        setMessage('캡처 히스토리를 초기화했습니다.');
        setIsSuccess(true);
    }, []);

    const removeHistoryItem = useCallback((id: string) => {
        setCaptureHistory((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target) {
                URL.revokeObjectURL(target.previewUrl);
            }
            return prev.filter((item) => item.id !== id);
        });
        setPendingClipboardCopy((current) => current?.item.id === id ? null : current);
        setMessage('선택한 히스토리를 삭제했습니다.');
        setIsSuccess(true);
    }, []);

    const applyClipboardCopyResult = useCallback((
        result: ClipboardCopyResult,
        item: CaptureHistoryItem,
        successMessage: string
    ) => {
        setCaptureHistory((current) => current.map((historyItem) => (
            historyItem.id === item.id
                ? {
                    ...historyItem,
                    clipboardStatus: result.ok ? 'copied' : result.reason
                }
                : historyItem
        )));

        if (result.ok) {
            setPendingClipboardCopy((current) => (
                current?.item.id === item.id ? null : current
            ));
            setMessage(successMessage);
            setIsSuccess(true);
            return;
        }

        setPendingClipboardCopy({
            item,
            reason: result.reason
        });
        setMessage(
            result.reason === 'unsupported'
                ? `영역 캡처 완료 · 클립보드 미복사 · ${item.width}×${item.height} PNG. 이 환경에서는 이미지 클립보드를 지원하지 않아 아래에서 PNG를 다운로드할 수 있습니다.`
                : result.reason === 'blocked'
                    ? `영역 캡처 완료 · 클립보드 미복사 · ${item.width}×${item.height} PNG. 아래 “클립보드 복사 재시도”를 눌러 주세요.`
                    : `영역 캡처 완료 · 클립보드 미복사 · ${item.width}×${item.height} PNG. 다시 복사하거나 PNG를 다운로드해 주세요.`
        );
        setIsSuccess(false);
    }, []);

    const prepareFrozenScreenFrame = useCallback(async (sessionId: number) => {
        setIsProcessing(true);
        setProcessingStatusText('공유 화면에서 원본 프레임을 고정하는 중입니다.');
        setMessage('공유창에서 현재 탭을 선택해 주세요. 선택한 화면을 먼저 고정한 뒤 그 이미지 위에서 범위를 지정합니다.');
        setIsSuccess(null);

        let restoreCaptureUi: (() => void) | null = null;
        const assertCurrentCaptureSession = (stream?: MediaStream) => {
            if (
                screenSessionIdRef.current !== sessionId
                || screenCapturePhaseRef.current !== 'capturing'
            ) {
                stream?.getTracks().forEach((track) => track.stop());
                throw new Error('capture-aborted');
            }
        };

        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                throw new Error('unsupported');
            }

            // Hide the camera/selection chrome before the shared tab is read.
            // The captured bitmap is frozen before the user draws a selection.
            const restoreCursorForCapture = hideDocumentCursorForCapture();
            const restoreExcludedRoots = hideExcludedRoots();
            restoreCaptureUi = () => {
                restoreCursorForCapture();
                restoreExcludedRoots();
            };
            screenCaptureUiRestoreRef.current = restoreCaptureUi;
            await waitNextPaint();
            assertCurrentCaptureSession();

            let stream = activeStreamRef.current;
            let video = activeVideoRef.current;
            let track = stream?.getVideoTracks()[0] ?? null;
            const canReuseCurrentTab = Boolean(
                stream
                && video
                && track
                && stream.active !== false
                && track.readyState !== 'ended'
                && !track.muted
                && !video.ended
                && hasUsableCapturedFrame(video)
            );

            if (!canReuseCurrentTab) {
                stopActiveCaptureResources();
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: getHighResolutionDisplayMediaConstraints(),
                    audio: false,
                    preferCurrentTab: true,
                    selfBrowserSurface: 'include',
                    surfaceSwitching: 'exclude',
                    monitorTypeSurfaces: 'exclude'
                } as DisplayMediaOptions);
                assertCurrentCaptureSession(stream);
                activeStreamRef.current = stream;

                video = document.createElement('video');
                video.srcObject = stream;
                video.muted = true;
                video.playsInline = true;
                activeVideoRef.current = video;
                await waitForVideoReady(video);
                await video.play();
            }

            if (!stream || !video) {
                throw new Error('no-track');
            }
            assertCurrentCaptureSession(stream);
            [track] = stream.getVideoTracks();
            if (!track) {
                throw new Error('no-track');
            }
            const displaySurface = track.getSettings?.().displaySurface;
            if (displaySurface && displaySurface !== 'browser') {
                throw new Error('screen-browser-only');
            }
            await applyNoCursorCaptureConstraint(track);
            if (video.paused) {
                await video.play();
            }
            assertCurrentCaptureSession(stream);

            setProcessingStatusText(
                canReuseCurrentTab
                    ? '허용된 현재 탭에서 새 화면 프레임을 가져오는 중입니다.'
                    : '현재 화면 프레임을 확인하는 중입니다.'
            );
            await waitForCursorlessCaptureFrame(video, true);
            assertCurrentCaptureSession(stream);

            const frozenCanvas = freezeVideoFrameToCanvas(video);
            if (!isFrameAspectCompatible(
                frozenCanvas.width,
                frozenCanvas.height,
                getViewportMetrics()
            )) {
                throw new Error('screen-aspect-mismatch');
            }

            clearFrozenScreenFrame();
            const frozenFrame: FrozenScreenFrame = {
                canvas: frozenCanvas,
                width: frozenCanvas.width,
                height: frozenCanvas.height
            };
            frozenScreenFrameRef.current = frozenFrame;
            setFrozenFramePreviewReady(true);

            // Selection is performed against this immutable bitmap, while the
            // current-tab stream stays alive for the next capture. Reusing the
            // same stream avoids another browser permission prompt.
            if (screenCaptureUiRestoreRef.current === restoreCaptureUi) {
                restoreScreenCaptureUi();
            }
            restoreCaptureUi = null;
            restoreHiddenPanel();

            screenCapturePhaseRef.current = 'selecting';
            captureOperationInFlightRef.current = false;
            setIsProcessing(false);
            clearProcessingGuide();
            startSelection();
            setMessage(`실제 화면 ${frozenFrame.width}×${frozenFrame.height}px을 고정했습니다. 이 화면 위에서 범위를 드래그하면 선택한 픽셀이 그대로 저장됩니다.`);
        } catch (error) {
            if (
                restoreCaptureUi
                && screenCaptureUiRestoreRef.current === restoreCaptureUi
            ) {
                restoreScreenCaptureUi();
            }
            stopActiveCaptureResources();
            restoreHiddenPanel();

            if (screenSessionIdRef.current !== sessionId) {
                return;
            }
            screenCapturePhaseRef.current = 'idle';
            captureOperationInFlightRef.current = false;
            setIsProcessing(false);
            clearProcessingGuide();

            if (error instanceof Error && error.message === 'capture-aborted') {
                return;
            }
            if (error instanceof Error && error.message === 'screen-browser-only') {
                setMessage('현재 앱 화면을 고정하려면 공유창에서 “현재 탭”을 선택해 주세요. 창 또는 전체 화면은 저장하지 않았습니다.');
                setIsSuccess(false);
                return;
            }
            if (error instanceof Error && error.message === 'screen-aspect-mismatch') {
                setMessage('선택한 탭의 화면 비율이 현재 앱과 달라 정확한 픽셀 좌표를 보장할 수 없습니다. 공유창에서 현재 탭을 선택해 주세요.');
                setIsSuccess(false);
                return;
            }
            if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
                setMessage('화면 공유 선택이 취소되었습니다. 다시 시작하면 먼저 화면을 고정한 뒤 영역을 선택할 수 있습니다.');
                setIsSuccess(null);
                return;
            }
            if (error instanceof Error && error.message === 'unsupported') {
                setMessage('이 브라우저는 실제 화면 캡처를 지원하지 않습니다. Chromium 기반 브라우저에서 다시 시도해 주세요.');
                setIsSuccess(false);
                return;
            }

            console.error('[QuickCameraCapture] screen frame freeze failed', error);
            setMessage('화면 프레임을 고정하지 못했습니다. 현재 탭을 선택해 다시 시도해 주세요.');
            setIsSuccess(false);
        }
    }, [
        clearFrozenScreenFrame,
        clearProcessingGuide,
        restoreHiddenPanel,
        restoreScreenCaptureUi,
        startSelection,
        stopActiveCaptureResources
    ]);

    const captureScreenSelection = useCallback(async (
        rect: Rect,
        _selectedViewport?: ViewportMetrics,
        _selectedScroll?: Point,
        clipboardReservation?: ClipboardWriteReservation | null
    ) => {
        const sessionId = screenSessionIdRef.current;
        if (screenCapturePhaseRef.current !== 'capturing') {
            return;
        }

        setIsProcessing(true);
        setProcessingStatusText('선택한 원본 픽셀을 PNG로 저장하는 중입니다.');
        setMessage('고정된 미리보기에서 선택한 픽셀을 그대로 저장하는 중입니다.');
        setIsSuccess(null);

        let shouldResumeSelection = false;
        try {
            const frozenFrame = frozenScreenFrameRef.current;
            if (!frozenFrame) {
                throw new Error('frozen-frame-missing');
            }

            const previewViewport = getViewportMetrics();
            const captureRect = normalizeRectToMetrics(rect, previewViewport);
            if (captureRect.width < MIN_SIZE || captureRect.height < MIN_SIZE) {
                throw new Error('selection-too-small');
            }

            const sourceRect = getFrameSourceRect(
                frozenFrame.width,
                frozenFrame.height,
                captureRect,
                previewViewport
            );
            const exportCanvas = cropFrozenFrameToCanvas(frozenFrame.canvas, sourceRect);
            const blob = await toPngBlob(exportCanvas);

            if (
                screenSessionIdRef.current !== sessionId
                || screenCapturePhaseRef.current !== 'capturing'
            ) {
                throw new Error('capture-aborted');
            }

            clipboardReservation?.complete(blob);
            const clipboardResult = clipboardReservation
                ? await clipboardReservation.result
                : await copyBlobToClipboard(blob);
            const historyItem = pushCaptureHistory(blob, exportCanvas.width, exportCanvas.height);
            applyClipboardCopyResult(
                clipboardResult,
                historyItem,
                `고정 미리보기 영역 캡처 완료 · 클립보드 복사 완료 · ${exportCanvas.width}×${exportCanvas.height} PNG · 원본 픽셀 1:1`
            );
        } catch (error) {
            clipboardReservation?.cancel(error);
            if (screenSessionIdRef.current !== sessionId) {
                return;
            }
            if (error instanceof Error && error.message === 'capture-aborted') {
                return;
            }

            shouldResumeSelection = Boolean(frozenScreenFrameRef.current);
            setSelectionRect(normalizeRectToViewport(rect));
            setSelectionReady(true);
            if (error instanceof Error && error.message === 'selection-too-small') {
                setMessage('영역이 너무 작습니다. 고정된 미리보기에서 범위를 더 넓게 선택해 주세요.');
                setIsSuccess(false);
            } else {
                console.error('[QuickCameraCapture] frozen frame crop failed', error);
                setMessage('고정된 화면에서 선택 영역을 저장하지 못했습니다. 범위는 유지했으니 다시 시도해 주세요.');
                setIsSuccess(false);
            }
        } finally {
            if (screenSessionIdRef.current !== sessionId) {
                return;
            }
            clearProcessingGuide();
            setIsProcessing(false);
            if (shouldResumeSelection) {
                screenCapturePhaseRef.current = 'selecting';
                captureOperationInFlightRef.current = false;
                setIsSelecting(true);
                return;
            }

            setIsSelecting(false);
            clearFrozenScreenFrame();
            completeScreenCaptureSession();
            restoreHiddenPanel();
        }
    }, [
        applyClipboardCopyResult,
        clearFrozenScreenFrame,
        clearProcessingGuide,
        completeScreenCaptureSession,
        pushCaptureHistory,
        restoreHiddenPanel
    ]);

    const capturePermissionFreeFullContent = useCallback(async (
        target: HTMLElement,
        clipboardReservation?: ClipboardWriteReservation | null
    ) => {
        const sessionId = screenSessionIdRef.current;
        if (screenCapturePhaseRef.current !== 'capturing') return;

        setIsProcessing(true);
        setProcessingStatusText('보드 전체를 선명한 PNG로 만드는 중입니다.');
        setMessage('보드의 아래쪽 카드까지 모두 캡처해 클립보드에 복사하는 중입니다.');
        setIsSuccess(null);

        const restoreExcludedRoots = hideExcludedRoots();
        try {
            await waitNextPaint();
            if (!target.isConnected) {
                throw new Error('full-content-target-missing');
            }

            const dimensions = getFullContentCaptureDimensions(target);
            if (dimensions.width < MIN_SIZE || dimensions.height < MIN_SIZE) {
                throw new Error('selection-too-small');
            }

            const fullCanvas = await html2canvas(target, {
                backgroundColor: '#f8fafc',
                scale: getPermissionFreeCaptureScale(dimensions),
                useCORS: true,
                allowTaint: false,
                logging: false,
                width: dimensions.width,
                height: dimensions.height,
                windowWidth: Math.max(window.innerWidth, dimensions.width),
                windowHeight: Math.max(window.innerHeight, dimensions.height),
                scrollX: 0,
                scrollY: -window.scrollY,
                onclone: (clonedDocument: Document) => {
                    makeCaptureTextCloneSafe(clonedDocument);
                    const clonedTarget = clonedDocument.querySelector<HTMLElement>(FULL_CONTENT_CAPTURE_SELECTOR);
                    if (!clonedTarget) return;

                    clonedTarget.style.width = `${dimensions.width}px`;
                    clonedTarget.style.height = `${dimensions.height}px`;
                    clonedTarget.style.maxHeight = 'none';
                    clonedTarget.style.overflow = 'visible';

                    let parent = clonedTarget.parentElement;
                    while (parent) {
                        parent.style.overflow = 'visible';
                        parent.style.maxHeight = 'none';
                        parent = parent.parentElement;
                    }
                },
                ignoreElements: (element: Element) => (
                    element.closest(CAPTURE_OVERLAY_SELECTOR) !== null
                    || element.closest(CAPTURE_EXCLUDE_SELECTOR) !== null
                    || (element as HTMLElement).dataset?.html2canvasIgnore === 'true'
                )
            } as unknown as Parameters<typeof html2canvas>[1]);
            const blob = await toPngBlob(fullCanvas);

            if (
                screenSessionIdRef.current !== sessionId
                || screenCapturePhaseRef.current !== 'capturing'
            ) {
                throw new Error('capture-aborted');
            }

            clipboardReservation?.complete(blob);
            const clipboardResult = clipboardReservation
                ? await clipboardReservation.result
                : await copyBlobToClipboard(blob);
            const historyItem = pushCaptureHistory(blob, fullCanvas.width, fullCanvas.height);
            applyClipboardCopyResult(
                clipboardResult,
                historyItem,
                `보드 전체 캡처 완료 · 아래쪽 카드 포함 · ${fullCanvas.width}×${fullCanvas.height} PNG`
            );
        } catch (error) {
            clipboardReservation?.cancel(error);
            if (screenSessionIdRef.current !== sessionId) return;
            if (error instanceof Error && error.message === 'capture-aborted') return;

            console.error('[QuickCameraCapture] DOM full-content capture failed', error);
            setMessage('보드 전체를 캡처하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.');
            setIsSuccess(false);
        } finally {
            restoreExcludedRoots();
            if (screenSessionIdRef.current !== sessionId) return;

            clearProcessingGuide();
            setIsProcessing(false);
            setIsSelecting(false);
            clearFrozenScreenFrame();
            endScreenCaptureSession();
            restoreHiddenPanel();
        }
    }, [
        applyClipboardCopyResult,
        clearFrozenScreenFrame,
        clearProcessingGuide,
        endScreenCaptureSession,
        pushCaptureHistory,
        restoreHiddenPanel
    ]);

    const captureScrollSelection = useCallback(async (rect: Rect) => {
        const persistedPlan = scrollCapturePlanRef.current;
        const plan = persistedPlan && (!persistedPlan.target || persistedPlan.target.isConnected)
            ? persistedPlan
            : resolveScrollCapturePlan(rect, selectionScrollTargetRef.current);
        scrollCapturePlanRef.current = plan;
        const captureRect = plan.captureRect;
        const risk = getScrollCaptureRisk(plan);

        if (risk.level === 'block') {
            setMessage(risk.message);
            setIsSuccess(false);
            restoreHiddenPanel();
            return;
        }

        const shareGuide = [
            ...(risk.level === 'warn' ? [risk.message.replace(' 계속할까요?', '')] : []),
            '스크롤 캡처는 공유 창에서 반드시 현재 탭을 선택해야 합니다.',
            '창 또는 화면 전체를 선택하면 캡처를 즉시 중단합니다.'
        ].join('\n');

        if (!window.confirm(`${shareGuide}\n\n계속할까요?`)) {
            setMessage('스크롤 캡처를 시작하지 않았습니다.');
            setIsSuccess(null);
            restoreHiddenPanel();
            return;
        }

        setIsProcessing(true);
        setProcessingStatusText('1/4 공유 창에서 현재 탭을 선택해 주세요. 창/화면 전체 선택 시 중단됩니다.');
        setMessage('공유 창에서 현재 탭을 선택해야 스크롤 캡처가 진행됩니다.');
        setIsSuccess(null);
        abortProcessingRef.current = false;

        let captureInterferenceRestore: { hiddenCount: number; restore: () => void } | null = null;
        let restoreCursorForCapture: (() => void) | null = null;
        let restoreScrollBehavior: (() => void) | null = null;
        let hiddenInterferenceCount = 0;
        let restoreScrollFailed = false;

        const ensureNotAborted = (track?: MediaStreamTrack) => {
            if (abortProcessingRef.current) {
                throw new Error('capture-aborted');
            }
            if (track && track.getSettings().displaySurface !== 'browser') {
                throw new Error('scroll-browser-only');
            }
            if (document.visibilityState !== 'visible') {
                throw new Error('scroll-tab-hidden');
            }
        };

        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                throw new Error('unsupported');
            }

            restoreCursorForCapture = hideDocumentCursorForCapture();
            await waitNextPaint();

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: getHighResolutionDisplayMediaConstraints(),
                audio: false,
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                surfaceSwitching: 'exclude',
                monitorTypeSurfaces: 'exclude'
            } as DisplayMediaOptions);
            // Own the stream immediately so every validation/initialization
            // failure below is covered by the shared finally cleanup.
            activeStreamRef.current = stream;

            const [track] = stream.getVideoTracks();
            if (!track) {
                throw new Error('no-track');
            }
            await applyNoCursorCaptureConstraint(track);

            setProcessingStatusText('2/4 현재 탭 공유 여부를 확인하는 중입니다.');
            if (track.getSettings().displaySurface !== 'browser') {
                throw new Error('scroll-browser-only');
            }

            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            activeVideoRef.current = video;

            await waitForVideoReady(video);
            await video.play();

            captureInterferenceRestore = hideCaptureInterference(plan.target);
            hiddenInterferenceCount = captureInterferenceRestore.hiddenCount;
            if (plan.target) {
                restoreScrollBehavior = forceInstantScrollBehavior(plan.target);
            }
            ensureNotAborted(track);

            setProcessingStatusText(
                plan.canScroll
                    ? `3/4 스크롤 캡처 준비 중 1/${plan.estimatedSteps}`
                    : '스크롤 대상이 없어 현재 화면만 캡처하는 중입니다.'
            );
            await waitForCursorlessCaptureFrame(video);

            if (plan.range && plan.target) {
                const scrollTarget = plan.target;
                const range = plan.range;
                const rangeHeightCss = range.bottomContentY - range.topContentY;

                if (range.width < MIN_SIZE || rangeHeightCss < MIN_SIZE) {
                    throw new Error('selection-too-small');
                }

                let currentScrollTop = await scrollToFreshCapturedFrame(
                    scrollTarget,
                    Math.min(plan.maxScrollTop, Math.max(0, range.startScrollTop)),
                    video
                );
                ensureNotAborted(track);

                const targetRectForScale = getVisibleRectForScrollableTarget(scrollTarget);
                const scaleProbe = getVideoSourceRect(video, {
                    left: range.left,
                    top: targetRectForScale.top,
                    width: range.width,
                    height: Math.min(1, Math.max(1, targetRectForScale.height))
                });
                const sourceWidth = Math.max(1, scaleProbe.sourceW);
                const sourceHeight = Math.max(1, Math.round(rangeHeightCss * scaleProbe.scaleY));
                const outputScale = getSafeScrollCanvasScale(sourceWidth, sourceHeight);
                const stitchedCanvas = document.createElement('canvas');
                stitchedCanvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
                stitchedCanvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
                const stitchedCtx = stitchedCanvas.getContext('2d');
                if (!stitchedCtx) {
                    throw new Error('canvas-context-failed');
                }
                stitchedCtx.imageSmoothingEnabled = true;
                stitchedCtx.imageSmoothingQuality = 'high';

                let capturedUntilContentY = range.topContentY;
                let outputOffsetY = 0;
                let loopCount = 0;
                let committedUntilContentY = range.topContentY;
                let pendingSegment: (ScrollStitchSegmentGeometry & {
                    canvas: HTMLCanvasElement;
                }) | null = null;
                const maxLoopCount = Math.min(
                    MAX_SCROLL_CAPTURE_STEPS,
                    Math.max(12, plan.estimatedSteps + 8)
                );
                const drawPendingSegmentThrough = (endContentY: number) => {
                    if (!pendingSegment) return;

                    const slice = createScrollStitchSlice(
                        pendingSegment,
                        committedUntilContentY,
                        endContentY,
                        range.topContentY,
                        range.bottomContentY,
                        stitchedCanvas.height
                    );
                    committedUntilContentY = endContentY;
                    if (!slice) return;

                    stitchedCtx.drawImage(
                        pendingSegment.canvas,
                        0,
                        slice.sourceY,
                        pendingSegment.canvas.width,
                        slice.sourceHeight,
                        0,
                        slice.destY,
                        stitchedCanvas.width,
                        slice.destHeight
                    );
                    outputOffsetY = slice.destY + slice.destHeight;
                };

                while (capturedUntilContentY < range.bottomContentY - 0.5 && loopCount < maxLoopCount) {
                    ensureNotAborted(track);
                    loopCount += 1;

                    const targetRect = getVisibleRectForScrollableTarget(scrollTarget);
                    const visibleTopContentY = currentScrollTop;
                    const visibleBottomContentY = currentScrollTop + targetRect.height;
                    const segmentTopContentY = Math.max(
                        range.topContentY,
                        visibleTopContentY
                    );
                    const segmentBottomContentY = Math.min(range.bottomContentY, visibleBottomContentY);
                    const segmentHeightCss = segmentBottomContentY - segmentTopContentY;

                    if (segmentHeightCss >= 0.5 && segmentBottomContentY > capturedUntilContentY + 0.2) {
                        const segmentRect = {
                            left: range.left,
                            top: targetRect.top + (segmentTopContentY - currentScrollTop),
                            width: range.width,
                            height: segmentHeightCss
                        };
                        const segmentCrop = getVideoSourceRect(video, segmentRect);
                        const segmentCanvas = cropVideoFrameToCanvas(video, segmentCrop);
                        const currentSegment = {
                            canvas: segmentCanvas,
                            topContentY: segmentTopContentY,
                            bottomContentY: segmentBottomContentY,
                            sourceHeight: segmentCanvas.height
                        };

                        if (pendingSegment) {
                            if (currentSegment.topContentY > pendingSegment.bottomContentY + 0.5) {
                                throw new Error('scroll-frame-gap');
                            }
                            const seamContentY = getScrollStitchBoundaryContentY(
                                pendingSegment,
                                currentSegment
                            );
                            drawPendingSegmentThrough(seamContentY);
                        }

                        pendingSegment = currentSegment;
                        capturedUntilContentY = Math.max(capturedUntilContentY, segmentBottomContentY);
                        const progressPercent = Math.min(
                            100,
                            Math.max(1, Math.round(((capturedUntilContentY - range.topContentY) / rangeHeightCss) * 100))
                        );
                        setProcessingStatusText(`3/4 스크롤 구간 캡처 중 ${progressPercent}% · ESC 또는 취소 버튼으로 중단`);
                    }

                    if (capturedUntilContentY >= range.bottomContentY - 0.5) {
                        break;
                    }

                    const nextScrollTop = Math.min(
                        plan.maxScrollTop,
                        Math.max(currentScrollTop + 1, capturedUntilContentY - SCROLL_CAPTURE_OVERLAP_CSS)
                    );
                    if (nextScrollTop <= currentScrollTop + 0.5) {
                        break;
                    }

                    const actualScrollTop = await scrollToFreshCapturedFrame(
                        scrollTarget,
                        nextScrollTop,
                        video
                    );
                    ensureNotAborted(track);
                    if (actualScrollTop <= currentScrollTop + 0.5) {
                        break;
                    }

                    currentScrollTop = actualScrollTop;
                }

                if (capturedUntilContentY < range.bottomContentY - 0.5) {
                    throw new Error('scroll-range-too-long');
                }

                if (!pendingSegment) {
                    throw new Error('empty-scroll-range');
                }
                drawPendingSegmentThrough(range.bottomContentY);

                if (
                    outputOffsetY !== stitchedCanvas.height
                    || stitchedCanvas.width <= 0
                    || stitchedCanvas.height <= 0
                ) {
                    throw new Error('empty-scroll-range');
                }

                setProcessingStatusText('4/4 이미지 병합 중입니다.');
                const blob = await toPngBlob(stitchedCanvas);
                const historyItem = pushCaptureHistory(blob, stitchedCanvas.width, stitchedCanvas.height);
                const interferenceNotice = hiddenInterferenceCount > 0
                    ? ` 고정 UI ${hiddenInterferenceCount}개를 제외했습니다.`
                    : '';

                const clipboardResult = await copyBlobToClipboard(blob);
                applyClipboardCopyResult(
                    clipboardResult,
                    historyItem,
                    outputScale < 1
                        ? `\uad6c\uac04\uc774 \uae38\uc5b4 \uc804\uccb4\uac00 \ub4e4\uc5b4\uac00\ub3c4\ub85d ${Math.round(outputScale * 100)}%\ub85c \ucd95\uc18c\ud574 \ud074\ub9bd\ubcf4\ub4dc\uc5d0 \uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.${interferenceNotice}`
                        : `\uc2dc\uc791\uc810\ubd80\ud130 \ub9c8\uc9c0\ub9c9 \uc120\ud0dd\uc810\uae4c\uc9c0 \uc774\uc5b4\ubd99\uc5ec \ud074\ub9bd\ubcf4\ub4dc\uc5d0 \uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.${interferenceNotice}`
                );
                return;
            }

            const crop = getVideoSourceRect(video, captureRect);
            const firstCanvas = cropVideoFrameToCanvas(video, crop);

            if (!plan.target || !plan.canScroll) {
                const singleBlob = await toPngBlob(firstCanvas);
                const historyItem = pushCaptureHistory(singleBlob, firstCanvas.width, firstCanvas.height);
                const interferenceNotice = hiddenInterferenceCount > 0
                    ? ` 고정 UI ${hiddenInterferenceCount}개를 제외했습니다.`
                    : '';
                const clipboardResult = await copyBlobToClipboard(singleBlob);
                applyClipboardCopyResult(
                    clipboardResult,
                    historyItem,
                    `스크롤 대상이 없어 현재 보이는 영역만 복사했습니다.${interferenceNotice}`
                );
                return;
            }

            const segments: Array<{ canvas: HTMLCanvasElement; cropTop: number; cropHeight: number }> = [
                { canvas: firstCanvas, cropTop: 0, cropHeight: firstCanvas.height }
            ];
            const scrollTarget = plan.target;
            const movingTopPx = Math.max(0, Math.round((plan.movingRect.top - captureRect.top) * crop.scaleY));
            const movingHeightPx = Math.max(
                1,
                Math.min(
                    firstCanvas.height - movingTopPx,
                    Math.round(plan.movingRect.height * crop.scaleY)
                )
            );
            let totalHeight = firstCanvas.height;
            let currentScrollTop = scrollTarget.scrollTop;
            let loopCount = 0;

            while (currentScrollTop < plan.maxScrollTop - 1 && loopCount < 160) {
                ensureNotAborted(track);
                const previousScrollTop = currentScrollTop;
                currentScrollTop = await scrollToFreshCapturedFrame(
                    scrollTarget,
                    Math.min(plan.maxScrollTop, previousScrollTop + plan.scrollStepCss),
                    video
                );
                ensureNotAborted(track);

                const deltaCss = currentScrollTop - previousScrollTop;
                if (deltaCss < 1) {
                    break;
                }

                const nextCanvas = cropVideoFrameToCanvas(video, crop);
                const deltaPx = Math.max(1, Math.min(movingHeightPx, Math.round(deltaCss * crop.scaleY)));
                segments.push({
                    canvas: nextCanvas,
                    cropTop: Math.max(movingTopPx, movingTopPx + movingHeightPx - deltaPx),
                    cropHeight: deltaPx
                });
                totalHeight += deltaPx;
                loopCount += 1;
                setProcessingStatusText(`3/4 스크롤 캡처 중 ${Math.min(plan.estimatedSteps, segments.length)}/${plan.estimatedSteps} · ESC 또는 취소 버튼으로 중단`);
            }

            setProcessingStatusText('4/4 이미지 병합 중입니다.');
            const stitchedCanvas = document.createElement('canvas');
            stitchedCanvas.width = crop.sourceW;
            stitchedCanvas.height = totalHeight;
            const stitchedCtx = stitchedCanvas.getContext('2d');
            if (!stitchedCtx) {
                throw new Error('캔버스 컨텍스트 생성 실패');
            }

            let offsetY = 0;
            segments.forEach((segment) => {
                stitchedCtx.drawImage(
                    segment.canvas,
                    0,
                    segment.cropTop,
                    segment.canvas.width,
                    segment.cropHeight,
                    0,
                    offsetY,
                    stitchedCanvas.width,
                    segment.cropHeight
                );
                offsetY += segment.cropHeight;
            });

            const blob = await toPngBlob(stitchedCanvas);
            const historyItem = pushCaptureHistory(blob, stitchedCanvas.width, stitchedCanvas.height);
            const interferenceNotice = hiddenInterferenceCount > 0
                ? ` 고정 UI ${hiddenInterferenceCount}개를 제외했습니다.`
                : '';

            const clipboardResult = await copyBlobToClipboard(blob);
            applyClipboardCopyResult(
                clipboardResult,
                historyItem,
                currentScrollTop < plan.maxScrollTop - 1
                    ? `스크롤 캡처가 길어서 일부만 이어붙였습니다.${interferenceNotice}`
                    : `스크롤 영역을 아래까지 이어붙여 클립보드에 저장했습니다.${interferenceNotice}`
            );
        } catch (error) {
            if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
                setMessage('화면 공유 선택이 취소되었습니다.');
            } else if (error instanceof Error && error.message === 'capture-aborted') {
                setMessage('스크롤 캡처를 취소했습니다.');
            } else if (error instanceof Error && error.message === 'scroll-browser-only') {
                setMessage('스크롤 방식은 공유 창에서 반드시 현재 브라우저 탭을 선택해야 합니다.');
            } else if (error instanceof Error && error.message === 'scroll-tab-hidden') {
                setMessage('스크롤 방식은 현재 탭이 활성화된 상태에서만 저장할 수 있습니다. 현재 탭을 다시 선택해 주세요.');
            } else if (error instanceof Error && error.message === 'selection-too-small') {
                setMessage('\uc2a4\ud06c\ub864 \ucea1\ucc98 \uad6c\uac04\uc774 \ub108\ubb34 \uc791\uc2b5\ub2c8\ub2e4. \uc2dc\uc791\uc810\uacfc \ub9c8\uc9c0\ub9c9 \uc120\ud0dd\uc810\uc744 \ub354 \ub113\uac8c \uc9c0\uc815\ud574 \uc8fc\uc138\uc694.');
            } else if (error instanceof Error && error.message === 'empty-scroll-range') {
                setMessage('\uc2a4\ud06c\ub864 \ucea1\ucc98\ud560 \ud654\uba74 \uad6c\uac04\uc744 \ucc3e\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4. \uc2dc\uc791\uc810\uc744 \ub2e4\uc2dc \uc9c0\uc815\ud574 \uc8fc\uc138\uc694.');
            } else if (error instanceof Error && error.message === 'scroll-range-too-long') {
                setMessage('선택한 스크롤 구간을 끝까지 캡처하지 못했습니다. 구간을 나눠서 다시 캡처해 주세요.');
            } else if (error instanceof Error && error.message === 'unsupported') {
                setMessage('이 브라우저는 화면 캡처 API를 지원하지 않습니다.');
            } else {
                setMessage('스크롤 캡처 중 오류가 발생했습니다. 다시 시도해 주세요.');
            }
            setIsSuccess(false);
        } finally {
            if (plan.target) {
                try {
                    scrollElementTo(plan.target, plan.restoreScrollTop);
                    await waitNextPaint();
                    restoreScrollFailed = Math.abs(getScrollTop(plan.target) - plan.restoreScrollTop) > 2;
                } catch {
                    restoreScrollFailed = true;
                }
            }
            restoreScrollBehavior?.();
            restoreCursorForCapture?.();
            captureInterferenceRestore?.restore();
            stopActiveCaptureResources();
            restoreHiddenPanel();
            clearProcessingGuide();
            setIsProcessing(false);
            if (restoreScrollFailed) {
                setMessage((prev) => `${prev} 이전 스크롤 위치 복원에 실패했습니다.`);
            }
        }
    }, [
        applyClipboardCopyResult,
        clearProcessingGuide,
        pushCaptureHistory,
        restoreHiddenPanel,
        stopActiveCaptureResources
    ]);

    const copySelectionToClipboard = useCallback(async (
        rect: Rect,
        selectedViewport?: ViewportMetrics,
        selectedScroll?: Point,
        clipboardReservation?: ClipboardWriteReservation | null
    ) => {
        if (captureMode === 'screen') {
            await captureScreenSelection(
                rect,
                selectedViewport,
                selectedScroll,
                clipboardReservation
            );
            return;
        }

        if (captureOperationInFlightRef.current) return;
        captureOperationInFlightRef.current = true;

        try {
            await captureScrollSelection(rect);
        } finally {
            captureOperationInFlightRef.current = false;
        }
    }, [captureMode, captureScreenSelection, captureScrollSelection]);

    const startCaptureSelection = () => {
        if (captureMode === 'scroll') {
            startSelection();
            return;
        }
        if (captureOperationInFlightRef.current) return;

        const sessionId = screenSessionIdRef.current + 1;
        screenSessionIdRef.current = sessionId;
        screenCapturePhaseRef.current = 'capturing';
        captureOperationInFlightRef.current = true;
        clearFrozenScreenFrame();
        clearProcessingGuide();
        setIsSuccess(null);
        void prepareFrozenScreenFrame(sessionId);
    };

    const recopyHistoryItem = useCallback(async (item: CaptureHistoryItem) => {
        if (captureOperationInFlightRef.current) return;
        captureOperationInFlightRef.current = true;
        setIsProcessing(true);
        setIsSuccess(null);
        setMessage('히스토리 이미지를 클립보드에 복사 중...');
        try {
            const result = await copyBlobToClipboard(item.blob);
            setCaptureHistory((current) => current.map((historyItem) => (
                historyItem.id === item.id
                    ? {
                        ...historyItem,
                        clipboardStatus: result.ok ? 'copied' : result.reason
                    }
                    : historyItem
            )));
            if (result.ok) {
                setPendingClipboardCopy((current) => (
                    current?.item.id === item.id ? null : current
                ));
                setMessage(
                    `영역 캡처 완료 · 클립보드 복사 완료 · ${item.width}×${item.height} PNG`
                );
                setIsSuccess(true);
            } else {
                setPendingClipboardCopy({
                    item,
                    reason: result.reason
                });
                setMessage(
                    result.reason === 'unsupported'
                        ? `영역 캡처 완료 · 클립보드 미복사 · ${item.width}×${item.height} PNG. PNG 다운로드를 이용해 주세요.`
                        : `영역 캡처 완료 · 클립보드 미복사 · ${item.width}×${item.height} PNG. 브라우저 권한을 허용한 뒤 다시 눌러 주세요.`
                );
                setIsSuccess(false);
            }
        } catch {
            setCaptureHistory((current) => current.map((historyItem) => (
                historyItem.id === item.id
                    ? { ...historyItem, clipboardStatus: 'failed' }
                    : historyItem
            )));
            setMessage('히스토리 재복사 중 오류가 발생했습니다.');
            setIsSuccess(false);
        } finally {
            setIsProcessing(false);
            captureOperationInFlightRef.current = false;
        }
    }, []);

    const downloadHistoryItem = useCallback((item: CaptureHistoryItem) => {
        saveBlobAsFile(item.blob, `capture-${item.createdAt}.png`);
        setCaptureHistory((current) => current.map((historyItem) => (
            historyItem.id === item.id
                ? { ...historyItem, downloadRequested: true }
                : historyItem
        )));
        setMessage(
            `영역 캡처 완료 · ${item.width}×${item.height} PNG 다운로드를 요청했습니다.${
                item.clipboardStatus === 'copied' ? ' 클립보드 복사도 완료된 상태입니다.' : ''
            }`
        );
        setIsSuccess(item.clipboardStatus === 'copied' ? true : null);
    }, []);

    const updateSelectionRectField = useCallback((
        field: keyof Rect,
        rawValue: number
    ) => {
        if (!Number.isFinite(rawValue)) return;

        setSelectionRect((current) => {
            if (!current) return current;

            const rect = normalizeRectToViewport(current);
            const viewport = getViewportMetrics();
            const value = Math.round(rawValue);

            if (field === 'left') {
                return {
                    ...rect,
                    left: Math.min(
                        Math.max(0, viewport.width - rect.width),
                        Math.max(0, value)
                    )
                };
            }
            if (field === 'top') {
                return {
                    ...rect,
                    top: Math.min(
                        Math.max(0, viewport.height - rect.height),
                        Math.max(0, value)
                    )
                };
            }
            if (field === 'width') {
                const maxWidth = Math.max(1, viewport.width - rect.left);
                return {
                    ...rect,
                    width: Math.min(
                        maxWidth,
                        Math.max(Math.min(MIN_SIZE, maxWidth), value)
                    )
                };
            }

            const maxHeight = Math.max(1, viewport.height - rect.top);
            return {
                ...rect,
                height: Math.min(
                    maxHeight,
                    Math.max(Math.min(MIN_SIZE, maxHeight), value)
                )
            };
        });
    }, []);

    const nudgeSelectionRect = useCallback((dx: number, dy: number) => {
        setSelectionRect((current) => {
            if (!current) return current;

            const rect = normalizeRectToViewport(current);
            const viewport = getViewportMetrics();
            return {
                ...rect,
                left: Math.min(
                    Math.max(0, viewport.width - rect.width),
                    Math.max(0, rect.left + dx)
                ),
                top: Math.min(
                    Math.max(0, viewport.height - rect.height),
                    Math.max(0, rect.top + dy)
                )
            };
        });
    }, []);

    const nudgeSelectionHandle = useCallback((
        handle: ResizeHandle,
        dx: number,
        dy: number
    ) => {
        setSelectionRect((current) => {
            if (!current) return current;

            return getAdjustedSelectionRect(
                {
                    kind: 'resize',
                    handle,
                    startPoint: { x: 0, y: 0 },
                    startRect: current
                },
                { x: dx, y: dy }
            );
        });
    }, []);

    const finishScreenSelection = useCallback(async (rect: Rect | null) => {
        if (screenCapturePhaseRef.current !== 'selecting') {
            return;
        }
        if (!rect) {
            setMessage('먼저 영역을 선택해 주세요.');
            setIsSuccess(false);
            return;
        }

        const normalized = normalizeRectToViewport(rect);
        if (normalized.width < MIN_SIZE || normalized.height < MIN_SIZE) {
            setMessage('영역이 너무 작습니다. 경계를 더 넓게 조절해 주세요.');
            setIsSuccess(false);
            return;
        }

        // Claim the session synchronously so repeated Enter/click events cannot
        // stop or duplicate the capture already in progress.
        screenCapturePhaseRef.current = 'capturing';
        const selectedViewport = getViewportMetrics();
        const selectedScroll = {
            x: window.scrollX,
            y: window.scrollY
        };
        const clipboardReservation = reserveClipboardWrite();
        setSelectionRect(normalized);
        setSelectionReady(false);
        selectionAdjustmentRef.current = null;
        draggingRef.current = false;
        dragStartRef.current = null;
        activeSelectionPointerIdRef.current = null;
        previousSelectionRectRef.current = null;
        setCursorPoint(null);
        setIsSelecting(false);
        setMessage('선택 범위를 확정했습니다. 선택 UI를 숨기고 캡처하는 중입니다.');
        setIsSuccess(null);

        await copySelectionToClipboard(
            normalized,
            selectedViewport,
            selectedScroll,
            clipboardReservation
        );
    }, [copySelectionToClipboard]);

    const finishFullContentCapture = useCallback(async () => {
        if (screenCapturePhaseRef.current !== 'selecting') {
            return;
        }

        const target = getFullContentCaptureTarget();
        if (!target) {
            setMessage('아래까지 캡처할 보드를 찾지 못했습니다. 영역 캡처를 이용해 주세요.');
            setIsSuccess(false);
            return;
        }

        // Reserve the clipboard during the click gesture, before the longer
        // DOM render begins, so Chromium can still accept the image write.
        screenCapturePhaseRef.current = 'capturing';
        const clipboardReservation = reserveClipboardWrite();
        setSelectionReady(false);
        selectionAdjustmentRef.current = null;
        draggingRef.current = false;
        dragStartRef.current = null;
        activeSelectionPointerIdRef.current = null;
        previousSelectionRectRef.current = null;
        setCursorPoint(null);
        setIsSelecting(false);
        setMessage('보드 전체 범위를 확정했습니다. 아래쪽 카드까지 캡처하는 중입니다.');
        setIsSuccess(null);

        await capturePermissionFreeFullContent(target, clipboardReservation);
    }, [capturePermissionFreeFullContent]);

    const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!isSelecting || isProcessing) return;
        if (e.button !== 0) return;
        e.preventDefault();
        const start = clampPointToViewport(e.clientX, e.clientY);
        setCursorPoint(start);

        if (captureMode === 'screen') {
            const pointerId = Number.isFinite(e.pointerId) ? e.pointerId : 1;
            const activePointerId = activeSelectionPointerIdRef.current;
            if (activePointerId !== null && activePointerId !== pointerId) return;

            activeSelectionPointerIdRef.current = pointerId;
            try {
                e.currentTarget.setPointerCapture?.(pointerId);
            } catch {
                // Window-level listeners still complete the interaction when pointer capture is unavailable.
            }
        }

        if (captureMode === 'screen' && selectionReady && selectionRect) {
            const target = e.target instanceof Element ? e.target : null;
            if (target?.closest('[data-selection-controls="true"]')) return;

            const handleElement = target?.closest<HTMLElement>('[data-selection-handle]');
            const handle = handleElement?.dataset.selectionHandle as ResizeHandle | undefined;
            if (handle) {
                selectionAdjustmentRef.current = {
                    kind: 'resize',
                    handle,
                    startPoint: start,
                    startRect: normalizeRectToViewport(selectionRect)
                };
                previousSelectionRectRef.current = null;
                return;
            }

            if (target?.closest('[data-selection-box="true"]')) {
                selectionAdjustmentRef.current = {
                    kind: 'move',
                    startPoint: start,
                    startRect: normalizeRectToViewport(selectionRect)
                };
                previousSelectionRectRef.current = null;
                return;
            }

            previousSelectionRectRef.current = normalizeRectToViewport(selectionRect);
        }

        if (captureMode === 'scroll') {
            const existingAnchor = scrollSelectionAnchorRef.current;

            if (!existingAnchor) {
                const target = findScrollableTargetFromPoint(start.x, start.y);
                const scrollTop = getScrollTop(target);
                scrollSelectionAnchorRef.current = {
                    point: start,
                    target,
                    scrollTop,
                    contentY: target ? getContentYForViewportPoint(target, start.y) : start.y
                };
                selectionScrollTargetRef.current = target;
                draggingRef.current = false;
                dragStartRef.current = null;
                setScrollAnchorPoint(start);
                setSelectionRect({ left: start.x, top: start.y, width: 0, height: 0 });
                setMessage('\uc2dc\uc791\uc810\uc744 \uace0\uc815\ud588\uc2b5\ub2c8\ub2e4. \uc6d0\ud558\ub294 \ub9c8\uc9c0\ub9c9 \uc9c0\uc810\uae4c\uc9c0 \uc2a4\ud06c\ub864\ud55c \ub4a4 \ub05d\uc810\uc744 \ud074\ub9ad\ud558\uc138\uc694. (ESC \ucde8\uc18c)');
                setIsSuccess(null);
                return;
            }

            const scrollPlan = resolveScrollRangeCapturePlan(existingAnchor, start);
            const rect = scrollPlan.captureRect;
            const rangeHeight = scrollPlan.range
                ? scrollPlan.range.bottomContentY - scrollPlan.range.topContentY
                : rect.height;

            scrollSelectionAnchorRef.current = null;
            selectionScrollTargetRef.current = scrollPlan.target ?? selectionScrollTargetRef.current;
            scrollCapturePlanRef.current = scrollPlan;
            draggingRef.current = false;
            dragStartRef.current = null;
            setScrollAnchorPoint(null);

            if (rect.width < MIN_SIZE || rangeHeight < MIN_SIZE) {
                setMessage('\uc601\uc5ed\uc774 \ub108\ubb34 \uc791\uc2b5\ub2c8\ub2e4. \uc2dc\uc791\uc810\uacfc \ub9c8\uc9c0\ub9c9 \uc120\ud0dd\uc810\uc744 \ub354 \ub113\uac8c \uc9c0\uc815\ud574 \uc8fc\uc138\uc694.');
                setIsSuccess(false);
                setSelectionRect(null);
                setIsSelecting(false);
                restoreHiddenPanel();
                return;
            }

            setSelectionRect(rect);
            setIsSelecting(false);
            void (async () => {
                await waitNextPaint();
                await copySelectionToClipboard(rect);
            })();
            return;
        }

        setSelectionReady(false);
        selectionAdjustmentRef.current = null;
        dragStartRef.current = start;
        draggingRef.current = true;
        selectionScrollTargetRef.current = findScrollableTargetFromPoint(start.x, start.y);
        if (!previousSelectionRectRef.current) {
            setSelectionRect({ left: start.x, top: start.y, width: 0, height: 0 });
        }
    };

    const handleSelectionWheel = useCallback((e: WheelEvent) => {
        if (!isSelecting || captureMode !== 'scroll') return;

        const anchor = scrollSelectionAnchorRef.current;
        const target = anchor?.target;
        if (!anchor || !target || !target.isConnected) return;

        e.preventDefault();
        const delta = e.deltaMode === 1
            ? e.deltaY * 32
            : e.deltaMode === 2
                ? e.deltaY * Math.max(1, target.clientHeight)
                : e.deltaY;
        const nextScrollTop = Math.min(
            getMaxScrollTop(target),
            Math.max(0, getScrollTop(target) + delta)
        );

        scrollElementTo(target, nextScrollTop);

        const end = cursorPointRef.current ?? anchor.point;
        setSelectionRect(buildRect(anchor.point, end));
    }, [captureMode, isSelecting]);

    useEffect(() => {
        const overlay = selectionOverlayRef.current;
        if (!overlay || !isSelecting || captureMode !== 'scroll') return;

        overlay.addEventListener('wheel', handleSelectionWheel, { passive: false });
        return () => {
            overlay.removeEventListener('wheel', handleSelectionWheel);
        };
    }, [captureMode, handleSelectionWheel, isSelecting]);

    useEffect(() => {
        if (!isSelecting) return;

        const prevUserSelect = document.body.style.userSelect;
        const prevCursor = document.body.style.cursor;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
        selectionOverlayRef.current?.focus({ preventScroll: true });

        return () => {
            document.body.style.userSelect = prevUserSelect;
            document.body.style.cursor = prevCursor;
        };
    }, [isSelecting]);

    useEffect(() => {
        if (!isSelecting) return;

        const handleViewportResize = () => {
            setSelectionRect((current) => current ? normalizeRectToViewport(current) : current);
            setCursorPoint((current) => current
                ? clampPointToViewport(current.x, current.y)
                : current);
        };

        window.addEventListener('resize', handleViewportResize);
        return () => {
            window.removeEventListener('resize', handleViewportResize);
        };
    }, [isSelecting]);

    useEffect(() => {
        if (!isSelecting) return;

        const hostPanel = rootRef.current?.closest<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR) ?? null;
        const excludedRoots = Array.from(document.querySelectorAll<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR))
            .filter((el) => el !== hostPanel);
        const prevInlineStyles = excludedRoots.map((el) => ({
            el,
            opacity: el.style.opacity,
            pointerEvents: el.style.pointerEvents,
            filter: el.style.filter,
            transform: el.style.transform,
            transition: el.style.transition
        }));

        excludedRoots.forEach((el) => {
            el.style.transition = 'opacity 120ms ease, filter 120ms ease, transform 120ms ease';
            el.style.opacity = '0.08';
            el.style.pointerEvents = 'none';
            el.style.filter = 'grayscale(0.4) blur(1px)';
            el.style.transform = 'translateY(2px) scale(0.995)';
        });

        return () => {
            prevInlineStyles.forEach(({ el, opacity, pointerEvents, filter, transform, transition }) => {
                el.style.opacity = opacity;
                el.style.pointerEvents = pointerEvents;
                el.style.filter = filter;
                el.style.transform = transform;
                el.style.transition = transition;
            });
        };
    }, [isSelecting]);

    useEffect(() => {
        if (!isSelecting) return;

        const handlePointerMove = (e: PointerEvent) => {
            const eventPointerId = Number.isFinite(e.pointerId) ? e.pointerId : 1;
            if (
                captureMode === 'screen'
                && activeSelectionPointerIdRef.current !== null
                && activeSelectionPointerIdRef.current !== eventPointerId
            ) {
                return;
            }

            const point = clampPointToViewport(e.clientX, e.clientY);
            setCursorPoint(point);
            const adjustment = selectionAdjustmentRef.current;
            if (captureMode === 'screen' && adjustment) {
                setSelectionRect(getAdjustedSelectionRect(adjustment, point));
                return;
            }
            if (captureMode === 'scroll' && scrollSelectionAnchorRef.current) {
                setSelectionRect(buildRect(scrollSelectionAnchorRef.current.point, point));
                return;
            }
            if (!draggingRef.current || !dragStartRef.current) return;
            setSelectionRect(buildRect(dragStartRef.current, point));
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (captureMode === 'scroll') return;
            const eventPointerId = Number.isFinite(e.pointerId) ? e.pointerId : 1;
            if (
                activeSelectionPointerIdRef.current !== null
                && activeSelectionPointerIdRef.current !== eventPointerId
            ) {
                return;
            }

            activeSelectionPointerIdRef.current = null;
            try {
                selectionOverlayRef.current?.releasePointerCapture?.(eventPointerId);
            } catch {
                // Pointer capture may already have been released by the browser.
            }

            if (selectionAdjustmentRef.current) {
                const finalPoint = clampPointToViewport(e.clientX, e.clientY);
                setSelectionRect(getAdjustedSelectionRect(selectionAdjustmentRef.current, finalPoint));
                selectionAdjustmentRef.current = null;
                setSelectionReady(true);
                return;
            }
            if (!draggingRef.current || !dragStartRef.current) return;
            const point = clampPointToViewport(e.clientX, e.clientY);
            const rect = normalizeRectToViewport(buildRect(dragStartRef.current, point));

            draggingRef.current = false;
            dragStartRef.current = null;

            if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
                const previousSelection = previousSelectionRectRef.current;
                previousSelectionRectRef.current = null;

                if (previousSelection) {
                    setSelectionRect(previousSelection);
                    setSelectionReady(true);
                    setMessage('새 영역이 너무 작아 기존 선택 범위를 유지했습니다.');
                    setIsSuccess(null);
                } else {
                    setMessage('영역이 너무 작습니다. 화면에서 다시 드래그해 주세요.');
                    setIsSuccess(false);
                    setSelectionRect(null);
                    setSelectionReady(false);
                }
                return;
            }

            previousSelectionRectRef.current = null;
            setSelectionRect(rect);
            setSelectionReady(true);
            setMessage('선택 범위를 확인하세요. 테두리를 조절한 뒤 “캡처 후 클립보드 복사”를 누르세요.');
            setIsSuccess(null);
        };

        const cancelPointerInteraction = () => {
            const adjustment = selectionAdjustmentRef.current;
            const hadActiveInteraction = activeSelectionPointerIdRef.current !== null
                || draggingRef.current
                || !!adjustment;
            if (!hadActiveInteraction) return;

            const previousSelection = previousSelectionRectRef.current;
            const rectToRestore = adjustment?.startRect ?? previousSelection;

            activeSelectionPointerIdRef.current = null;
            draggingRef.current = false;
            dragStartRef.current = null;
            selectionAdjustmentRef.current = null;
            previousSelectionRectRef.current = null;

            if (rectToRestore) {
                setSelectionRect(normalizeRectToViewport(rectToRestore));
                setSelectionReady(true);
                setMessage('포인터 조작이 중단되어 이전 선택 범위를 유지했습니다.');
                setIsSuccess(null);
            } else {
                setSelectionRect(null);
                setSelectionReady(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                resetSelection();
                setMessage('영역 캡처를 취소했습니다.');
                setIsSuccess(null);
                return;
            }

            if (e.key === 'Tab') {
                const overlay = selectionOverlayRef.current;
                if (!overlay) return;

                const focusableElements = Array.from(
                    overlay.querySelectorAll<HTMLElement>(
                        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    )
                );
                const firstFocusable = focusableElements[0];
                const lastFocusable = focusableElements[focusableElements.length - 1];
                const activeElement = document.activeElement;

                if (!firstFocusable || !lastFocusable) {
                    e.preventDefault();
                    overlay.focus({ preventScroll: true });
                    return;
                }

                if (
                    e.shiftKey
                    && (
                        activeElement === firstFocusable
                        || activeElement === overlay
                        || !(activeElement instanceof Node && overlay.contains(activeElement))
                    )
                ) {
                    e.preventDefault();
                    lastFocusable.focus({ preventScroll: true });
                    return;
                }

                if (
                    !e.shiftKey
                    && (
                        activeElement === lastFocusable
                        || activeElement === overlay
                        || !(activeElement instanceof Node && overlay.contains(activeElement))
                    )
                ) {
                    e.preventDefault();
                    firstFocusable.focus({ preventScroll: true });
                }
                return;
            }

            const target = e.target;
            const isInteractiveTarget = target instanceof Element
                && !!target.closest(
                    'button, input, textarea, select, a[href], [contenteditable="true"], [role="button"]'
                );
            const activeSelectionRect = selectionRectRef.current;
            if (
                captureMode !== 'screen'
                || !selectionReady
                || !activeSelectionRect
                || isInteractiveTarget
            ) {
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                void finishScreenSelection(activeSelectionRect);
                return;
            }

            const amount = e.shiftKey ? 10 : 1;
            const directions: Record<string, Point> = {
                ArrowLeft: { x: -amount, y: 0 },
                ArrowRight: { x: amount, y: 0 },
                ArrowUp: { x: 0, y: -amount },
                ArrowDown: { x: 0, y: amount }
            };
            const direction = directions[e.key];
            if (!direction) return;

            e.preventDefault();
            nudgeSelectionRect(direction.x, direction.y);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', cancelPointerInteraction);
        window.addEventListener('blur', cancelPointerInteraction);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', cancelPointerInteraction);
            window.removeEventListener('blur', cancelPointerInteraction);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        captureMode,
        finishScreenSelection,
        isSelecting,
        nudgeSelectionRect,
        selectionReady
    ]);

    useEffect(() => {
        if (!isProcessing || captureMode !== 'scroll') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            abortProcessingRef.current = true;
            setProcessingStatusText('스크롤 캡처를 취소하는 중입니다...');
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [captureMode, isProcessing]);

    const viewport = getViewportMetrics();
    const scrollPreviewEndPoint = captureMode === 'scroll' && scrollAnchorPoint
        ? cursorPoint && (Math.abs(cursorPoint.x - scrollAnchorPoint.x) > 2 || Math.abs(cursorPoint.y - scrollAnchorPoint.y) > 2)
            ? cursorPoint
            : {
                x: Math.max(0, Math.min(viewport.width - 24, scrollAnchorPoint.x + 260)),
                y: Math.max(0, Math.min(viewport.height - 24, scrollAnchorPoint.y + 180))
            }
        : null;
    const scrollFixedPreviewRect = scrollAnchorPoint && scrollPreviewEndPoint
        ? buildRect(scrollAnchorPoint, scrollPreviewEndPoint)
        : null;
    const visibleSelectionRect = scrollFixedPreviewRect ?? selectionRect;
    const isScreenSelectionReady = captureMode === 'screen'
        && selectionReady
        && !!selectionRect;
    const hasFullContentCaptureTarget = isScreenSelectionReady
        && !!getFullContentCaptureTarget();
    const selectionHandleHitSize = selectionRect
        ? Math.max(
            14,
            Math.min(36, Math.floor(Math.min(selectionRect.width, selectionRect.height) / 2))
        )
        : 14;
    const visibleSelectionResizeHandles = selectionRect
        ? SELECTION_RESIZE_HANDLES.filter(({ handle }) => {
            if ((handle === 'n' || handle === 's') && selectionRect.width < 48) return false;
            if ((handle === 'e' || handle === 'w') && selectionRect.height < 48) return false;
            return true;
        })
        : [];
    const selectionControlsAtTop = !!selectionRect
        && selectionRect.top + selectionRect.height / 2 > viewport.height / 2;
    const hasVisibleSelection = !!visibleSelectionRect
        && visibleSelectionRect.width > 0
        && visibleSelectionRect.height > 0;
    const selectionSizeLabelPosition = hasVisibleSelection && visibleSelectionRect
        ? {
            left: Math.min(
                Math.max(8, visibleSelectionRect.left),
                Math.max(8, viewport.width - 128)
            ),
            top: visibleSelectionRect.top >= 40
                ? visibleSelectionRect.top - 34
                : Math.min(viewport.height - 30, visibleSelectionRect.top + visibleSelectionRect.height + 8)
        }
        : null;
    const frozenSelectionSourceRect = (
        captureMode === 'screen'
        && selectionRect
        && frozenScreenFrameRef.current
    )
        ? getFrameSourceRect(
            frozenScreenFrameRef.current.width,
            frozenScreenFrameRef.current.height,
            selectionRect,
            viewport
        )
        : null;

    return (
        <>
        <div
            ref={rootRef}
            data-capture-engine="exact-pixel-current-tab-selection-v3"
            className="h-full rounded-lg border border-white/10 bg-[#101317] p-4 text-slate-100"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Camera className="h-4 w-4 text-sky-400" />
                    화면 캡처
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
                    onClick={() => {
                        resetSelection();
                        setMessage(getSelectionPromptMessage(captureMode));
                        setIsSuccess(null);
                    }}
                    disabled={isProcessing}
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    초기화
                </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                지정 영역은 현재 탭의 실제 화면 픽셀을 먼저 고정한 뒤 그 화면 위에서 선택합니다. 처음 한 번만 현재 탭 공유를 허용하면 카메라 패널을 닫기 전까지 다시 묻지 않고 새 화면을 가져옵니다.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={() => setCaptureMode('screen')}
                    disabled={isProcessing || isSelecting}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        captureMode === 'screen'
                            ? 'border-sky-400 bg-sky-500/15 text-sky-100'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                >
                    <div className="text-sm font-semibold">실제 화면 영역 캡처 · 원본 픽셀</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-400">최초 한 번 현재 탭을 허용한 뒤, 고정된 실제 화면에서 범위를 선택합니다.</div>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        stopActiveCaptureResources();
                        setCaptureMode('scroll');
                    }}
                    disabled={isProcessing || isSelecting}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        captureMode === 'scroll'
                            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                >
                    <div className="text-sm font-semibold">긴 화면 이어붙이기 · 공유 필요</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-400">보조 기능입니다. 현재 탭 공유만 허용하고, 긴 구간은 시작 전에 경고합니다.</div>
                </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => { void startCaptureSelection(); }}
                    disabled={isProcessing || isSelecting}
                    className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <MousePointerSquareDashed className="h-4 w-4" />
                    {isSelecting
                        ? '영역 선택 중...'
                        : isProcessing && captureMode === 'screen'
                            ? '실제 화면 가져오는 중...'
                        : captureHistory.length > 0
                            ? '새 실제 영역 선택'
                            : '실제 영역 선택 시작'}
                </button>
                {captureMode === 'scroll' && (
                    <button
                        type="button"
                        onClick={() => {
                        if (!selectionRect) {
                            setMessage('먼저 영역을 선택해 주세요.');
                            setIsSuccess(false);
                            return;
                        }
                        const normalized = normalizeRectToViewport(selectionRect);
                        if (normalized.width < MIN_SIZE || normalized.height < MIN_SIZE) {
                            setSelectionRect(null);
                            setMessage('화면 크기가 바뀌어 기존 선택 범위가 너무 작아졌습니다. 영역을 다시 선택해 주세요.');
                            setIsSuccess(false);
                            return;
                        }
                        setSelectionRect(normalized);
                        void copySelectionToClipboard(normalized, getViewportMetrics());
                        }}
                        disabled={isProcessing || !selectionRect}
                        className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <ClipboardCheck className="h-4 w-4" />
                        클립보드 저장
                    </button>
                )}
                {isProcessing && captureMode === 'scroll' && (
                    <button
                        type="button"
                        onClick={requestProcessingCancel}
                        className="inline-flex items-center gap-2 rounded-md border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25"
                    >
                        취소
                    </button>
                )}
            </div>

            <div
                role={isSuccess === false && !pendingClipboardCopy ? 'alert' : 'status'}
                aria-live={isSuccess === false && !pendingClipboardCopy ? 'assertive' : 'polite'}
                className={`mt-4 rounded-md border px-3 py-2 text-xs ${
                    pendingClipboardCopy
                        ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                        : isSuccess === true
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : isSuccess === false
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                            : 'border-white/10 bg-white/5 text-slate-300'
                }`}
            >
                {isProcessing ? (processingStatusText || '처리 중입니다...') : message}
            </div>

            {pendingClipboardCopy && !isProcessing && (
                <div
                    data-clipboard-retry="true"
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 p-2"
                >
                    {pendingClipboardCopy.reason !== 'unsupported' && (
                        <button
                            type="button"
                            onClick={() => { void recopyHistoryItem(pendingClipboardCopy.item); }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            클립보드 복사 재시도
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => downloadHistoryItem(pendingClipboardCopy.item)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                        <Download className="h-3.5 w-3.5" />
                        PNG 다운로드
                    </button>
                </div>
            )}

            {captureHistory.length > 0 && (
                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-300">최근 캡처 (최대 3개)</div>
                        <button
                            type="button"
                            onClick={clearCaptureHistory}
                            disabled={isProcessing}
                            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            히스토리 초기화
                        </button>
                    </div>

                    <div
                        data-capture-history-card="latest"
                        className="rounded-lg border border-white/10 bg-black/20 p-2.5"
                    >
                        <div className="flex max-h-[32rem] min-h-36 items-center justify-center overflow-auto rounded-md border border-white/10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.16),transparent_55%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.92))] p-3">
                            <div className="flex min-h-0 min-w-0 max-w-full items-center justify-center">
                                <img
                                    src={captureHistory[0].previewUrl}
                                    alt="최근 캡처 미리보기"
                                    className="block h-auto max-h-[30rem] w-auto max-w-full rounded object-contain shadow-lg shadow-black/40"
                                    style={{
                                        aspectRatio: `${captureHistory[0].width} / ${captureHistory[0].height}`
                                    }}
                                />
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                            <span className="shrink-0 whitespace-nowrap font-normal text-slate-400">
                                {formatClock(captureHistory[0].createdAt)}
                            </span>
                            <span
                                data-capture-size="true"
                                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-0.5 tabular-nums text-slate-300"
                            >
                                {formatCaptureDimensions(captureHistory[0].width, captureHistory[0].height)}
                            </span>
                            <span
                                data-clipboard-status="true"
                                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 ${getClipboardStatusClassName(captureHistory[0].clipboardStatus)}`}
                            >
                                {getClipboardStatusLabel(captureHistory[0].clipboardStatus)}
                            </span>
                            {captureHistory[0].downloadRequested && (
                                <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-violet-200">
                                    PNG 저장됨
                                </span>
                            )}
                        </div>
                        <CaptureHistoryActions
                            item={captureHistory[0]}
                            disabled={isProcessing}
                            label="최근 캡처"
                            onCopy={(item) => { void recopyHistoryItem(item); }}
                            onDownload={downloadHistoryItem}
                            onRemove={removeHistoryItem}
                        />
                    </div>

                    {captureHistory.length > 1 && (
                        <div className="space-y-1.5">
                            <div className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                이전 캡처
                            </div>
                            {captureHistory.slice(1).map((item, index) => {
                                const captureNumber = index + 2;
                                return (
                                    <div
                                        key={item.id}
                                        data-capture-history-card="previous"
                                        className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                                    >
                                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2.5">
                                            <img
                                                src={item.previewUrl}
                                                alt={`이전 캡처 ${index + 1}`}
                                                className="h-14 w-[4.5rem] rounded-md border border-white/10 object-cover object-top"
                                            />
                                            <div className="min-w-0 text-[11px] text-slate-300">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                    <span className="shrink-0 whitespace-nowrap font-semibold text-slate-200">
                                                        캡처 #{captureNumber}
                                                    </span>
                                                    <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-500">
                                                        {formatClock(item.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                                    <span
                                                        data-capture-size="true"
                                                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 tabular-nums text-slate-400"
                                                    >
                                                        {formatCaptureDimensions(item.width, item.height)}
                                                    </span>
                                                    <span
                                                        data-clipboard-status="true"
                                                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getClipboardStatusClassName(item.clipboardStatus)}`}
                                                    >
                                                        {getClipboardStatusLabel(item.clipboardStatus)}
                                                    </span>
                                                    {item.downloadRequested && (
                                                        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200">
                                                            PNG 저장됨
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <CaptureHistoryActions
                                            item={item}
                                            disabled={isProcessing}
                                            label={`캡처 #${captureNumber}`}
                                            onCopy={(historyItem) => { void recopyHistoryItem(historyItem); }}
                                            onDownload={downloadHistoryItem}
                                            onRemove={removeHistoryItem}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

        </div>
        {isSelecting && createPortal(
            <div
                ref={selectionOverlayRef}
                data-capture-overlay="true"
                role="dialog"
                aria-modal="true"
                aria-label="화면 캡처 영역 선택"
                tabIndex={-1}
                className="fixed inset-0 z-[99999] cursor-crosshair"
                style={{
                    touchAction: 'none',
                    background: hasVisibleSelection ? 'transparent' : 'rgba(2, 6, 23, 0.48)'
                }}
                onPointerDown={handlePointerDown}
            >
                {captureMode === 'screen' && frozenFramePreviewReady && (
                    <canvas
                        ref={renderFrozenFramePreview}
                        data-frozen-capture-preview="true"
                        className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
                    />
                )}
                {captureMode === 'scroll' && scrollAnchorPoint && (
                    <>
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: `linear-gradient(90deg, transparent ${Math.max(0, scrollAnchorPoint.x - 1)}px, rgba(16,185,129,0.95) ${Math.max(0, scrollAnchorPoint.x - 1)}px, rgba(16,185,129,0.95) ${scrollAnchorPoint.x + 1}px, transparent ${scrollAnchorPoint.x + 1}px),
                                    linear-gradient(180deg, transparent ${Math.max(0, scrollAnchorPoint.y - 1)}px, rgba(16,185,129,0.95) ${Math.max(0, scrollAnchorPoint.y - 1)}px, rgba(16,185,129,0.95) ${scrollAnchorPoint.y + 1}px, transparent ${scrollAnchorPoint.y + 1}px)`
                            }}
                        />
                        <div
                            className="pointer-events-none absolute z-10"
                            style={{
                                left: scrollAnchorPoint.x,
                                top: scrollAnchorPoint.y,
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-[3px] border-white bg-emerald-400 shadow-[0_0_0_4px_rgba(0,0,0,0.55)]" />
                            <span className="absolute -left-[2px] -top-6 h-12 w-1 rounded bg-black" />
                            <span className="absolute -left-6 -top-[2px] h-1 w-12 rounded bg-black" />
                            <span className="absolute left-4 top-4 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[11px] font-semibold text-white">
                                {'\uc2dc\uc791\uc810 \uace0\uc815'}
                            </span>
                        </div>
                    </>
                )}
                {visibleSelectionRect && (
                    <div
                        data-selection-box={isScreenSelectionReady ? 'true' : undefined}
                        className={`absolute box-border border ${
                            scrollFixedPreviewRect
                                ? 'border-emerald-300'
                                : 'border-sky-300'
                        } ${
                            isScreenSelectionReady
                                ? 'pointer-events-auto cursor-move'
                                : 'pointer-events-none'
                        }`}
                        style={{
                            left: visibleSelectionRect.left,
                            top: visibleSelectionRect.top,
                            width: visibleSelectionRect.width,
                            height: visibleSelectionRect.height,
                            background: 'rgba(255, 255, 255, 0.04)',
                            boxShadow: hasVisibleSelection
                                ? '0 0 0 1px rgba(255,255,255,0.95), 0 0 0 99999px rgba(2,6,23,0.58)'
                                : 'none'
                        }}
                    >
                        {isScreenSelectionReady ? (
                            visibleSelectionResizeHandles.map(({ handle, label, left, top, cursor }) => (
                                <button
                                    type="button"
                                    key={handle}
                                    data-selection-handle={handle}
                                    aria-label={`${label} 경계 크기 조절`}
                                    className="absolute z-20 flex items-center justify-center rounded-full bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    style={{
                                        left,
                                        top,
                                        cursor,
                                        width: selectionHandleHitSize,
                                        height: selectionHandleHitSize,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            void finishScreenSelection(selectionRectRef.current);
                                            return;
                                        }

                                        const amount = e.shiftKey ? 10 : 1;
                                        const directions: Record<string, Point> = {
                                            ArrowLeft: { x: -amount, y: 0 },
                                            ArrowRight: { x: amount, y: 0 },
                                            ArrowUp: { x: 0, y: -amount },
                                            ArrowDown: { x: 0, y: amount }
                                        };
                                        const direction = directions[e.key];
                                        if (!direction) return;

                                        e.preventDefault();
                                        e.stopPropagation();
                                        nudgeSelectionHandle(handle, direction.x, direction.y);
                                    }}
                                >
                                    <span className="h-3.5 w-3.5 rounded-sm border-2 border-white bg-sky-500 shadow-[0_1px_5px_rgba(0,0,0,0.85)]" />
                                </button>
                            ))
                        ) : (
                            <>
                                <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                                <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                                <span className="absolute -left-1.5 -bottom-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                                <span className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                            </>
                        )}
                    </div>
                )}
                {selectionSizeLabelPosition && visibleSelectionRect && (
                    <div
                        className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md border border-white/20 bg-black/85 px-2 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg"
                        style={selectionSizeLabelPosition}
                >
                        {frozenSelectionSourceRect
                            ? `원본 ${frozenSelectionSourceRect.sourceW} × ${frozenSelectionSourceRect.sourceH} px`
                            : `${Math.round(visibleSelectionRect.width)} × ${Math.round(visibleSelectionRect.height)} px`}
                    </div>
                )}
                {isScreenSelectionReady && selectionRect && (
                    <div
                        data-selection-controls="true"
                        className="absolute left-1/2 z-30 flex max-h-[min(45vh,20rem)] max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 overflow-y-auto rounded-xl border border-white/20 bg-slate-950/95 p-2.5 text-white shadow-2xl backdrop-blur"
                        style={selectionControlsAtTop
                            ? { top: 'max(16px, env(safe-area-inset-top))' }
                            : { bottom: 'max(16px, env(safe-area-inset-bottom))' }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="w-full px-1 text-center text-[11px] leading-4 text-slate-300">
                            안쪽은 이동 · 바깥 드래그는 새 선택 · 핸들은 크기 조절 · 방향키 1px (Shift 10px) · Enter 캡처
                        </div>
                        {([
                            ['left', 'X', '선택 영역 왼쪽 좌표 (픽셀)'],
                            ['top', 'Y', '선택 영역 위쪽 좌표 (픽셀)'],
                            ['width', 'W', '선택 영역 너비 (픽셀)'],
                            ['height', 'H', '선택 영역 높이 (픽셀)']
                        ] as Array<[keyof Rect, string, string]>).map(([field, label, ariaLabel]) => (
                            <label
                                key={field}
                                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[11px] font-semibold text-slate-300"
                            >
                                <span>{label}</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={field === 'width' || field === 'height' ? MIN_SIZE : 0}
                                    value={Math.round(selectionRect[field])}
                                    aria-label={ariaLabel}
                                    className="w-16 rounded border border-white/15 bg-black/40 px-1.5 py-1 text-right text-xs tabular-nums text-white outline-none focus:border-sky-400"
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) => updateSelectionRectField(field, e.currentTarget.valueAsNumber)}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter') return;
                                        e.preventDefault();
                                        void finishScreenSelection(selectionRect);
                                    }}
                                />
                            </label>
                        ))}
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-sky-300/40 bg-sky-400/10 px-2.5 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
                            onClick={() => {
                                const viewport = getViewportMetrics();
                                setSelectionRect({
                                    left: 0,
                                    top: 0,
                                    width: viewport.width,
                                    height: viewport.height
                                });
                                setMessage('현재 보이는 화면 전체가 선택되었습니다. 범위를 확인한 뒤 캡처하세요.');
                                setIsSuccess(null);
                            }}
                        >
                            보이는 화면 전체
                        </button>
                        {hasFullContentCaptureTarget && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20"
                                onClick={() => { void finishFullContentCapture(); }}
                            >
                                보드 전체 (아래까지)
                            </button>
                        )}
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                            onClick={() => {
                                resetSelection();
                                setMessage('영역 캡처를 취소했습니다.');
                                setIsSuccess(null);
                            }}
                        >
                            <X className="h-3.5 w-3.5" />
                            취소
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                            onClick={() => { void finishScreenSelection(selectionRect); }}
                        >
                            <Check className="h-3.5 w-3.5" />
                            캡처 후 클립보드 복사
                        </button>
                    </div>
                )}
                {!isScreenSelectionReady && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="absolute left-1/2 top-6 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-md bg-black/75 px-3 py-1.5 text-center text-xs leading-5 text-white"
                    >
                        {getSelectionPromptMessage(captureMode)}
                    </div>
                )}
                {cursorPoint && (
                    <>
                        <div
                            className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-white/55"
                            style={{ top: cursorPoint.y }}
                        />
                        <div
                            className="pointer-events-none absolute bottom-0 top-0 z-10 border-l border-dashed border-white/55"
                            style={{ left: cursorPoint.x }}
                        />
                        <div
                            className="pointer-events-none absolute z-20"
                            style={{
                                left: cursorPoint.x,
                                top: cursorPoint.y,
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            <span className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border-[3px] border-black bg-white/70" />
                            <span className="absolute -left-[2px] -top-[10px] h-[20px] w-1 rounded bg-black" />
                            <span className="absolute -left-[10px] -top-[2px] h-1 w-[20px] rounded bg-black" />
                            <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-black" />
                            <span className="absolute left-3 top-3 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                                {Math.round(cursorPoint.x)}, {Math.round(cursorPoint.y)}
                            </span>
                        </div>
                    </>
                )}
            </div>,
            document.body
        )}
        </>
    );
};

export default QuickCameraCapture;
