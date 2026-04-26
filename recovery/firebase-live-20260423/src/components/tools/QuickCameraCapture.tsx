import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ClipboardCheck, Download, MousePointerSquareDashed, RotateCcw, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

type Rect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type CaptureHistoryItem = {
    id: string;
    blob: Blob;
    previewUrl: string;
    createdAt: number;
    width: number;
    height: number;
};

type CaptureMode = 'screen' | 'scroll';

type ScrollCapturePlan = {
    target: HTMLElement | null;
    captureRect: Rect;
    movingRect: Rect;
    initialScrollTop: number;
    maxScrollTop: number;
    scrollStepCss: number;
    canScroll: boolean;
    estimatedSteps: number;
};

const MIN_SIZE = 12;
const CAPTURE_EXCLUDE_SELECTOR = '[data-capture-exclude="true"]';
const CAPTURE_OVERLAY_SELECTOR = '[data-capture-overlay="true"]';

const clampPointToViewport = (x: number, y: number) => {
    const maxX = Math.max(0, window.innerWidth);
    const maxY = Math.max(0, window.innerHeight);
    return {
        x: Math.min(Math.max(0, x), maxX),
        y: Math.min(Math.max(0, y), maxY)
    };
};

const buildRect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => {
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x);
    const height = Math.abs(a.y - b.y);
    return { left, top, width, height };
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
    a.click();
    URL.revokeObjectURL(url);
};

const formatClock = (ms: number): string => {
    return new Date(ms).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const copyBlobToClipboard = async (blob: Blob): Promise<boolean> => {
    const ClipboardItemCtor = (window as unknown as {
        ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
    }).ClipboardItem;

    const clipboard = navigator.clipboard as Clipboard & {
        write?: (data: ClipboardItem[]) => Promise<void>;
    };

    if (!ClipboardItemCtor || !clipboard?.write) return false;

    await clipboard.write([
        new ClipboardItemCtor({
            'image/png': blob
        })
    ]);
    return true;
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

type DisplayMediaOptions = {
    video: MediaTrackConstraints | boolean;
    audio: boolean;
    preferCurrentTab?: boolean;
    selfBrowserSurface?: 'include' | 'exclude';
    surfaceSwitching?: 'include' | 'exclude';
    monitorTypeSurfaces?: 'include' | 'exclude';
};

const getViewportMetrics = () => {
    const vv = window.visualViewport;
    return {
        width: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
        height: Math.max(1, Math.round(vv?.height ?? window.innerHeight))
    };
};

const getVideoSourceRect = (video: HTMLVideoElement, rect: Rect) => {
    const viewport = getViewportMetrics();
    const scaleX = video.videoWidth / viewport.width;
    const scaleY = video.videoHeight / viewport.height;

    let sourceX = Math.round(rect.left * scaleX);
    let sourceY = Math.round(rect.top * scaleY);
    let sourceW = Math.round(rect.width * scaleX);
    let sourceH = Math.round(rect.height * scaleY);

    sourceX = Math.max(0, Math.min(sourceX, Math.max(0, video.videoWidth - 1)));
    sourceY = Math.max(0, Math.min(sourceY, Math.max(0, video.videoHeight - 1)));
    sourceW = Math.max(1, Math.min(sourceW, video.videoWidth - sourceX));
    sourceH = Math.max(1, Math.min(sourceH, video.videoHeight - sourceY));

    return { sourceX, sourceY, sourceW, sourceH, scaleX, scaleY };
};

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
    const left = Math.max(0, box.left);
    const top = Math.max(0, box.top);
    const right = Math.min(window.innerWidth, box.right);
    const bottom = Math.min(window.innerHeight, box.bottom);

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
    const safeX = Math.min(window.innerWidth - 1, Math.max(0, x));
    const safeY = Math.min(window.innerHeight - 1, Math.max(0, y));
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

const getStartSelectionMessage = (mode: CaptureMode) => {
    if (mode === 'scroll') {
        return '스크롤되는 내용 영역을 드래그하세요. 저장할 때는 반드시 현재 브라우저 탭을 선택해야 합니다. (ESC 취소)';
    }
    return '화면에서 원하는 영역을 드래그하세요. (ESC 취소)';
};

const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
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

        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video.addEventListener('error', handleError, { once: true });
    });
};

const waitForCapturedFrame = async (video: HTMLVideoElement) => {
    if ('requestVideoFrameCallback' in video) {
        await new Promise<void>((resolve) => {
            (video as HTMLVideoElement & {
                requestVideoFrameCallback?: (callback: () => void) => number;
            }).requestVideoFrameCallback?.(() => resolve());
        });
        return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
};

const QuickCameraCapture: React.FC = () => {
    const [captureMode, setCaptureMode] = useState<CaptureMode>('screen');
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
    const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<string>('영역 선택 후 클립보드에 바로 복사할 수 있습니다.');
    const [processingStatusText, setProcessingStatusText] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    const [captureHistory, setCaptureHistory] = useState<CaptureHistoryItem[]>([]);

    const rootRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const draggingRef = useRef(false);
    const selectionScrollTargetRef = useRef<HTMLElement | null>(null);
    const hiddenPanelRestoreRef = useRef<(() => void) | null>(null);
    const scrollCapturePlanRef = useRef<ScrollCapturePlan | null>(null);
    const abortProcessingRef = useRef(false);
    const activeStreamRef = useRef<MediaStream | null>(null);
    const activeVideoRef = useRef<HTMLVideoElement | null>(null);

    const clearProcessingGuide = useCallback(() => {
        abortProcessingRef.current = false;
        setProcessingStatusText('');
    }, []);

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

    const restoreHiddenPanel = useCallback(() => {
        hiddenPanelRestoreRef.current?.();
        hiddenPanelRestoreRef.current = null;
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
        setIsSelecting(false);
        draggingRef.current = false;
        dragStartRef.current = null;
        selectionScrollTargetRef.current = null;
        scrollCapturePlanRef.current = null;
        restoreHiddenPanel();
        setSelectionRect(null);
        setCursorPoint(null);
        clearProcessingGuide();
    };

    const startSelection = () => {
        hideHostPanel();
        setMessage(getStartSelectionMessage(captureMode));
        setIsSuccess(null);
        draggingRef.current = false;
        dragStartRef.current = null;
        selectionScrollTargetRef.current = null;
        scrollCapturePlanRef.current = null;
        setSelectionRect(null);
        setCursorPoint(null);
        clearProcessingGuide();
        setIsSelecting(true);
    };

    useEffect(() => {
        return () => {
            captureHistory.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        };
    }, [captureHistory]);

    useEffect(() => {
        return () => {
            restoreHiddenPanel();
            stopActiveCaptureResources();
        };
    }, [restoreHiddenPanel, stopActiveCaptureResources]);

    useEffect(() => {
        if (captureMode === 'scroll') {
            setMessage('스크롤 방식은 선택한 영역 기준으로 아래까지 이어붙입니다. 저장할 때는 현재 브라우저 탭을 선택해야 합니다.');
            return;
        }

        scrollCapturePlanRef.current = null;
        setMessage('기본 화면방식은 현재 탭의 실제 화면 픽셀을 기준으로 캡처합니다.');
    }, [captureMode]);

    const pushCaptureHistory = useCallback((blob: Blob, width: number, height: number) => {
        const previewUrl = URL.createObjectURL(blob);
        const item: CaptureHistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            blob,
            previewUrl,
            createdAt: Date.now(),
            width,
            height
        };

        setCaptureHistory((prev) => {
            const next = [item, ...prev].slice(0, 3);
            if (prev.length >= 3) {
                prev.slice(2).forEach((old) => URL.revokeObjectURL(old.previewUrl));
            }
            return next;
        });
    }, []);

    const clearCaptureHistory = useCallback(() => {
        setCaptureHistory((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
            return [];
        });
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
        setMessage('선택한 히스토리를 삭제했습니다.');
        setIsSuccess(true);
    }, []);

    const captureDisplaySelection = useCallback(async (rect: Rect) => {
        setIsProcessing(true);
        setProcessingStatusText('브라우저 공유 창에서 현재 탭을 선택해 주세요.');
        setMessage('브라우저 공유 창에서 현재 탭을 선택해 주세요.');
        setIsSuccess(null);

        let restoreExcludedRoots: (() => void) | null = null;

        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                throw new Error('unsupported');
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false,
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                surfaceSwitching: 'exclude',
                monitorTypeSurfaces: 'exclude'
            } as DisplayMediaOptions);

            const [track] = stream.getVideoTracks();
            if (!track) {
                throw new Error('no-track');
            }

            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            activeStreamRef.current = stream;
            activeVideoRef.current = video;

            await waitForVideoReady(video);
            await video.play();

            restoreExcludedRoots = hideExcludedRoots();
            await waitNextPaint();
            setProcessingStatusText('선택 영역을 캡처하는 중입니다.');
            await waitForCapturedFrame(video);

            const crop = getVideoSourceRect(video, rect);
            const croppedCanvas = cropVideoFrameToCanvas(video, crop);

            const blob = await toPngBlob(croppedCanvas);

            pushCaptureHistory(blob, crop.sourceW, crop.sourceH);

            if (await copyBlobToClipboard(blob)) {
                const displaySurface = track.getSettings().displaySurface;
                setMessage(
                    displaySurface === 'browser'
                        ? '선택 영역이 클립보드에 저장되었습니다.'
                        : '선택 영역이 저장되었습니다. 다음에는 현재 탭을 선택하면 더 정확합니다.'
                );
                setIsSuccess(true);
            } else {
                saveBlobAsFile(blob, `capture-${Date.now()}.png`);
                setMessage('클립보드 API 미지원 브라우저입니다. PNG 파일로 다운로드했습니다.');
                setIsSuccess(true);
            }
        } catch (error) {
            if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
                setMessage('화면 공유 선택이 취소되었습니다.');
            } else if (error instanceof Error && error.message === 'unsupported') {
                setMessage('이 브라우저는 화면 캡처 API를 지원하지 않습니다.');
            } else {
                setMessage('캡처 중 오류가 발생했습니다. 다시 시도해 주세요.');
            }
            setIsSuccess(false);
        } finally {
            restoreExcludedRoots?.();
            stopActiveCaptureResources();
            restoreHiddenPanel();
            clearProcessingGuide();
            setIsProcessing(false);
        }
    }, [clearProcessingGuide, pushCaptureHistory, restoreHiddenPanel, stopActiveCaptureResources]);

    const captureScrollSelection = useCallback(async (rect: Rect) => {
        const persistedPlan = scrollCapturePlanRef.current;
        const plan = persistedPlan && (!persistedPlan.target || persistedPlan.target.isConnected)
            ? persistedPlan
            : resolveScrollCapturePlan(rect, selectionScrollTargetRef.current);
        scrollCapturePlanRef.current = plan;
        const captureRect = plan.captureRect;

        setIsProcessing(true);
        setProcessingStatusText(
            plan.canScroll
                ? '공유 창에서 현재 탭을 선택하면 스크롤 캡처를 시작합니다.'
                : '스크롤 대상이 작거나 없어서 보이는 영역만 캡처합니다. 현재 탭을 선택해 주세요.'
        );
        setMessage('브라우저 공유 창에서 현재 탭을 선택하면 스크롤 전체를 이어붙여 캡처합니다.');
        setIsSuccess(null);
        abortProcessingRef.current = false;

        let restoreExcludedRoots: (() => void) | null = null;

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

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false,
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                surfaceSwitching: 'exclude',
                monitorTypeSurfaces: 'exclude'
            } as DisplayMediaOptions);

            const [track] = stream.getVideoTracks();
            if (!track) {
                throw new Error('no-track');
            }

            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            activeStreamRef.current = stream;
            activeVideoRef.current = video;

            await waitForVideoReady(video);
            await video.play();

            restoreExcludedRoots = hideExcludedRoots();
            await waitNextPaint();
            ensureNotAborted(track);
            setProcessingStatusText(
                plan.canScroll
                    ? `스크롤 캡처 준비 중 1/${plan.estimatedSteps}`
                    : '스크롤 대상이 없어 현재 화면만 캡처하는 중입니다.'
            );
            await waitForCapturedFrame(video);

            const crop = getVideoSourceRect(video, captureRect);
            const firstCanvas = cropVideoFrameToCanvas(video, crop);

            if (!plan.target || !plan.canScroll) {
                const singleBlob = await toPngBlob(firstCanvas);
                pushCaptureHistory(singleBlob, firstCanvas.width, firstCanvas.height);
                if (await copyBlobToClipboard(singleBlob)) {
                    setMessage('스크롤 대상이 없어 현재 보이는 영역만 복사했습니다.');
                    setIsSuccess(true);
                } else {
                    saveBlobAsFile(singleBlob, `capture-${Date.now()}.png`);
                    setMessage('클립보드 API 미지원 브라우저입니다. PNG 파일로 다운로드했습니다.');
                    setIsSuccess(true);
                }
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
                scrollElementTo(scrollTarget, Math.min(plan.maxScrollTop, previousScrollTop + plan.scrollStepCss));
                await waitNextPaint();
                await waitForCapturedFrame(video);
                currentScrollTop = scrollTarget.scrollTop;

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
                setProcessingStatusText(`스크롤 캡처 중 ${Math.min(plan.estimatedSteps, segments.length)}/${plan.estimatedSteps}`);
            }

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
            pushCaptureHistory(blob, stitchedCanvas.width, stitchedCanvas.height);

            if (await copyBlobToClipboard(blob)) {
                setMessage(
                    currentScrollTop < plan.maxScrollTop - 1
                        ? '스크롤 캡처가 길어서 일부만 이어붙였습니다.'
                        : '스크롤 영역을 아래까지 이어붙여 클립보드에 저장했습니다.'
                );
                setIsSuccess(true);
            } else {
                saveBlobAsFile(blob, `capture-scroll-${Date.now()}.png`);
                setMessage('클립보드 API 미지원 브라우저입니다. 스크롤 캡처를 PNG로 다운로드했습니다.');
                setIsSuccess(true);
            }
        } catch (error) {
            if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
                setMessage('화면 공유 선택이 취소되었습니다.');
            } else if (error instanceof Error && error.message === 'capture-aborted') {
                setMessage('스크롤 캡처를 취소했습니다.');
            } else if (error instanceof Error && error.message === 'scroll-browser-only') {
                setMessage('스크롤 방식은 공유 창에서 반드시 현재 브라우저 탭을 선택해야 합니다.');
            } else if (error instanceof Error && error.message === 'scroll-tab-hidden') {
                setMessage('스크롤 방식은 현재 탭이 활성화된 상태에서만 저장할 수 있습니다. 현재 탭을 다시 선택해 주세요.');
            } else if (error instanceof Error && error.message === 'unsupported') {
                setMessage('이 브라우저는 화면 캡처 API를 지원하지 않습니다.');
            } else {
                setMessage('스크롤 캡처 중 오류가 발생했습니다. 다시 시도해 주세요.');
            }
            setIsSuccess(false);
        } finally {
            if (plan.target) {
                scrollElementTo(plan.target, plan.initialScrollTop);
            }
            restoreExcludedRoots?.();
            stopActiveCaptureResources();
            restoreHiddenPanel();
            clearProcessingGuide();
            setIsProcessing(false);
        }
    }, [clearProcessingGuide, pushCaptureHistory, restoreHiddenPanel, stopActiveCaptureResources]);

    const copySelectionToClipboard = useCallback(async (rect: Rect) => {
        if (captureMode === 'scroll') {
            await captureScrollSelection(rect);
            return;
        }

        await captureDisplaySelection(rect);
    }, [captureMode, captureDisplaySelection, captureScrollSelection]);

    const recopyHistoryItem = useCallback(async (item: CaptureHistoryItem) => {
        setIsProcessing(true);
        setIsSuccess(null);
        setMessage('히스토리 이미지를 클립보드에 복사 중...');
        try {
            if (await copyBlobToClipboard(item.blob)) {
                setMessage('히스토리 이미지가 클립보드에 저장되었습니다.');
                setIsSuccess(true);
            } else {
                saveBlobAsFile(item.blob, `capture-history-${item.createdAt}.png`);
                setMessage('클립보드 미지원으로 히스토리 이미지를 다운로드했습니다.');
                setIsSuccess(true);
            }
        } catch {
            setMessage('히스토리 재복사 중 오류가 발생했습니다.');
            setIsSuccess(false);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!isSelecting || isProcessing) return;
        e.preventDefault();
        const start = clampPointToViewport(e.clientX, e.clientY);
        setCursorPoint(start);
        dragStartRef.current = start;
        draggingRef.current = true;
        selectionScrollTargetRef.current = findScrollableTargetFromPoint(start.x, start.y);
        setSelectionRect({ left: start.x, top: start.y, width: 0, height: 0 });
    };

    useEffect(() => {
        if (!isSelecting) return;

        const prevUserSelect = document.body.style.userSelect;
        const prevCursor = document.body.style.cursor;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';

        return () => {
            document.body.style.userSelect = prevUserSelect;
            document.body.style.cursor = prevCursor;
        };
    }, [isSelecting]);

    useEffect(() => {
        if (!isSelecting) return;

        const excludedRoots = Array.from(document.querySelectorAll<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR));
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
            const point = clampPointToViewport(e.clientX, e.clientY);
            setCursorPoint(point);
            if (!draggingRef.current || !dragStartRef.current) return;
            setSelectionRect(buildRect(dragStartRef.current, point));
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (!draggingRef.current || !dragStartRef.current) return;
            const point = clampPointToViewport(e.clientX, e.clientY);
            const rawRect = buildRect(dragStartRef.current, point);
            const scrollPlan = captureMode === 'scroll'
                ? resolveScrollCapturePlan(rawRect, selectionScrollTargetRef.current)
                : null;
            const rect = scrollPlan?.captureRect ?? rawRect;

            draggingRef.current = false;
            dragStartRef.current = null;

            if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
                setMessage(
                    '영역이 너무 작습니다. 다시 선택해 주세요.'
                );
                setIsSuccess(false);
                setSelectionRect(null);
                setIsSelecting(false);
                restoreHiddenPanel();
                return;
            }

            if (scrollPlan) {
                selectionScrollTargetRef.current = scrollPlan.target ?? selectionScrollTargetRef.current;
                scrollCapturePlanRef.current = scrollPlan;
            }

            setSelectionRect(rect);
            setIsSelecting(false);
            void (async () => {
                await waitNextPaint();
                await copySelectionToClipboard(rect);
            })();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            resetSelection();
            setMessage('영역 선택이 취소되었습니다.');
            setIsSuccess(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [captureMode, copySelectionToClipboard, isSelecting, restoreHiddenPanel]);

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

    return (
        <>
        <div ref={rootRef} className="h-full rounded-lg border border-white/10 bg-[#101317] p-4 text-slate-100">
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
                        setMessage(getStartSelectionMessage(captureMode));
                        setIsSuccess(null);
                    }}
                    disabled={isProcessing}
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    초기화
                </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                기본 화면방식은 보이는 픽셀 그대로 잘라 저장합니다. 스크롤 방식은 선택한 박스를 실제 스크롤 프레임으로 자동 정렬한 뒤 아래까지 이어붙입니다.
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
                    <div className="text-sm font-semibold">기본 화면방식</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-400">공유 창에서 현재 탭을 고른 뒤 실제 화면 픽셀 기준으로 잘라 복사합니다.</div>
                </button>
                <button
                    type="button"
                    onClick={() => setCaptureMode('scroll')}
                    disabled={isProcessing || isSelecting}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        captureMode === 'scroll'
                            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                >
                    <div className="text-sm font-semibold">스크롤 방식</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-400">선택한 영역 기준으로 아래로 자동 스크롤하며 이어붙입니다. 공유 창에서는 현재 탭을 선택해야 합니다.</div>
                </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={startSelection}
                    disabled={isProcessing || isSelecting}
                    className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <MousePointerSquareDashed className="h-4 w-4" />
                    {isSelecting ? '영역 선택 중...' : '선택 시작'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (!selectionRect) {
                            setMessage('먼저 영역을 선택해 주세요.');
                            setIsSuccess(false);
                            return;
                        }
                        void copySelectionToClipboard(selectionRect);
                    }}
                    disabled={isProcessing || !selectionRect}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <ClipboardCheck className="h-4 w-4" />
                    클립보드 저장
                </button>
                <button
                    type="button"
                    onClick={() => {
                        startSelection();
                    }}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Download className="h-4 w-4" />
                    바로 캡처
                </button>
            </div>

            <div
                className={`mt-4 rounded-md border px-3 py-2 text-xs ${
                    isSuccess === true
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : isSuccess === false
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                            : 'border-white/10 bg-white/5 text-slate-300'
                }`}
            >
                {isProcessing ? (processingStatusText || '처리 중입니다...') : message}
            </div>

        {captureHistory.length > 0 && (
                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-300">최근 캡처 (최대 3개)</div>
                        <button
                            type="button"
                            onClick={clearCaptureHistory}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            히스토리 초기화
                        </button>
                    </div>

                    <div className="rounded-md border border-white/10 bg-black/20 p-2">
                        <div className="max-h-72 overflow-auto rounded-md border border-white/10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.16),transparent_55%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.92))]">
                            <div className="inline-flex min-w-full justify-center p-3">
                                <img
                                    src={captureHistory[0].previewUrl}
                                    alt="최근 캡처 미리보기"
                                    className="block rounded shadow-lg shadow-black/40"
                                    style={{
                                        width: `${captureHistory[0].width}px`,
                                        height: `${captureHistory[0].height}px`,
                                        maxWidth: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{formatClock(captureHistory[0].createdAt)}</span>
                            <span>{captureHistory[0].width} x {captureHistory[0].height} · 실제 크기</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {captureHistory.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-2">
                                <img src={item.previewUrl} alt={`히스토리 ${index + 1}`} className="h-11 w-16 rounded object-cover" />
                                <div className="min-w-0 flex-1 text-[11px] text-slate-300">
                                    <div className="truncate">#{index + 1} {formatClock(item.createdAt)}</div>
                                    <div className="text-slate-400">{item.width} x {item.height}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { void recopyHistoryItem(item); }}
                                    disabled={isProcessing}
                                    className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                                >
                                    <ClipboardCheck className="h-3.5 w-3.5" />
                                    재복사
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveBlobAsFile(item.blob, `capture-history-${item.createdAt}.png`)}
                                    disabled={isProcessing}
                                    className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    저장
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeHistoryItem(item.id)}
                                    disabled={isProcessing}
                                    className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    삭제
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
        {isSelecting && createPortal(
            <div
                data-capture-overlay="true"
                className="fixed inset-0 z-[99999] cursor-crosshair bg-black/25"
                style={{ touchAction: 'none' }}
                onPointerDown={handlePointerDown}
            >
                {selectionRect && (
                    <div
                        className="absolute border-[3px] border-black bg-sky-300/18 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
                        style={{
                            left: selectionRect.left,
                            top: selectionRect.top,
                            width: selectionRect.width,
                            height: selectionRect.height
                        }}
                    >
                        <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                        <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                        <span className="absolute -left-1.5 -bottom-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                        <span className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-full border border-white bg-black" />
                    </div>
                )}
                <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
                    {captureMode === 'scroll'
                        ? '마우스로 영역을 드래그한 뒤 놓으면 공유 창이 열립니다. 스크롤 방식은 반드시 현재 브라우저 탭을 선택해야 합니다. (ESC 취소)'
                        : '마우스로 영역을 드래그한 뒤 놓으면 공유 창이 열립니다. 현재 탭 선택을 권장합니다. (ESC 취소)'}
                </div>
                {cursorPoint && (
                    <div
                        className="pointer-events-none absolute"
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
                    </div>
                )}
            </div>,
            document.body
        )}
        </>
    );
};

export default QuickCameraCapture;
