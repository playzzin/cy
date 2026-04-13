import React, { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
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

const MIN_SIZE = 12;

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

const QuickCameraCapture: React.FC = () => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
    const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<string>('영역 선택 후 클립보드에 바로 복사할 수 있습니다.');
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    const [captureHistory, setCaptureHistory] = useState<CaptureHistoryItem[]>([]);

    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const draggingRef = useRef(false);

    const resetSelection = () => {
        setIsSelecting(false);
        draggingRef.current = false;
        dragStartRef.current = null;
        setSelectionRect(null);
        setCursorPoint(null);
    };

    const startSelection = () => {
        setMessage('화면에서 원하는 영역을 드래그하세요. (ESC 취소)');
        setIsSuccess(null);
        draggingRef.current = false;
        dragStartRef.current = null;
        setSelectionRect(null);
        setCursorPoint(null);
        setIsSelecting(true);
    };

    useEffect(() => {
        return () => {
            captureHistory.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        };
    }, [captureHistory]);

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

    const copySelectionToClipboard = useCallback(async (rect: Rect) => {
        setIsProcessing(true);
        setMessage('캡처 중...');
        setIsSuccess(null);

        try {
            const scale = Math.min(2, window.devicePixelRatio || 1);
            const vv = window.visualViewport;
            const viewportOffsetX = vv?.offsetLeft ?? 0;
            const viewportOffsetY = vv?.offsetTop ?? 0;
            const viewportWidth = Math.round(vv?.width ?? window.innerWidth);
            const viewportHeight = Math.round(vv?.height ?? window.innerHeight);
            const captureX = Math.round(window.scrollX + viewportOffsetX);
            const captureY = Math.round(window.scrollY + viewportOffsetY);

            const viewportCanvas = await (html2canvas as any)(document.documentElement, {
                x: captureX,
                y: captureY,
                width: viewportWidth,
                height: viewportHeight,
                useCORS: true,
                backgroundColor: null,
                scale,
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                windowWidth: document.documentElement.clientWidth,
                windowHeight: document.documentElement.clientHeight,
                ignoreElements: (element: Element) => {
                    return !!element.closest('[data-capture-exclude="true"]');
                },
                logging: false
            });

            let sourceX = Math.round(rect.left * scale);
            let sourceY = Math.round(rect.top * scale);
            let sourceW = Math.round(rect.width * scale);
            let sourceH = Math.round(rect.height * scale);

            sourceX = Math.max(0, Math.min(sourceX, Math.max(0, viewportCanvas.width - 1)));
            sourceY = Math.max(0, Math.min(sourceY, Math.max(0, viewportCanvas.height - 1)));
            sourceW = Math.max(1, Math.min(sourceW, viewportCanvas.width - sourceX));
            sourceH = Math.max(1, Math.min(sourceH, viewportCanvas.height - sourceY));

            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = sourceW;
            croppedCanvas.height = sourceH;
            const croppedCtx = croppedCanvas.getContext('2d');
            if (!croppedCtx) throw new Error('캔버스 컨텍스트 생성 실패');

            croppedCtx.drawImage(
                viewportCanvas,
                sourceX,
                sourceY,
                sourceW,
                sourceH,
                0,
                0,
                sourceW,
                sourceH
            );

            const blob = await toPngBlob(croppedCanvas);

            pushCaptureHistory(blob, sourceW, sourceH);

            if (await copyBlobToClipboard(blob)) {
                setMessage('선택 영역이 클립보드에 저장되었습니다.');
                setIsSuccess(true);
            } else {
                saveBlobAsFile(blob, `capture-${Date.now()}.png`);
                setMessage('클립보드 API 미지원 브라우저입니다. PNG 파일로 다운로드했습니다.');
                setIsSuccess(true);
            }
        } catch (error) {
            setMessage('캡처 중 오류가 발생했습니다. 다시 시도해 주세요.');
            setIsSuccess(false);
        } finally {
            setIsProcessing(false);
        }
    }, [pushCaptureHistory]);

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

        const excludedRoots = Array.from(document.querySelectorAll<HTMLElement>('[data-capture-exclude="true"]'));
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
            const rect = buildRect(dragStartRef.current, point);

            draggingRef.current = false;
            dragStartRef.current = null;

            if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
                setMessage('영역이 너무 작습니다. 다시 선택해 주세요.');
                setIsSuccess(false);
                setSelectionRect(null);
                setIsSelecting(false);
                return;
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
    }, [copySelectionToClipboard, isSelecting]);

    return (
        <>
        <div className="h-full rounded-lg border border-white/10 bg-[#101317] p-4 text-slate-100">
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
                        setMessage('영역 선택 후 클립보드에 바로 복사할 수 있습니다.');
                        setIsSuccess(null);
                    }}
                    disabled={isProcessing}
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    초기화
                </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                선택 시작을 누르고 화면에서 영역을 드래그하면 캡처 이미지를 클립보드에 저장합니다.
            </p>

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
                        setMessage('영역을 드래그하면 자동으로 캡처 후 복사됩니다.');
                        setIsSuccess(null);
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
                {isProcessing ? '처리 중입니다...' : message}
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
                        <img
                            src={captureHistory[0].previewUrl}
                            alt="최근 캡처 미리보기"
                            className="h-28 w-full rounded object-cover"
                        />
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{formatClock(captureHistory[0].createdAt)}</span>
                            <span>{captureHistory[0].width} x {captureHistory[0].height}</span>
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
                    마우스로 영역을 드래그한 뒤 놓으면 자동 복사됩니다. (ESC 취소)
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
