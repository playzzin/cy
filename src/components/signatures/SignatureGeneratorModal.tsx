import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Check,
    Gauge,
    Highlighter,
    Palette,
    PenLine,
    Pencil,
    Redo2,
    RotateCcw,
    Save,
    ShieldCheck,
    Sparkles,
    Trash2,
    X,
    type LucideIcon,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { signatureService, type SignatureSaveOptions } from '../../services/signatureService';
import {
    SIGNATURE_INK_COLORS,
    SIGNATURE_TOOL_PRESETS,
    SignatureInkTool,
} from '../../features/signatures/signatureInk';
import RealisticSignatureCanvas, {
    RealisticSignatureCanvasHandle,
    SignatureCanvasState,
} from './RealisticSignatureCanvas';

interface SignatureGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    workerId: string;
    workerName: string;
    onSaveComplete: (newUrl: string) => void;
    saveOptions?: SignatureSaveOptions;
}

const TOOL_ICONS: Record<SignatureInkTool, LucideIcon> = {
    pencil: Pencil,
    ballpoint: PenLine,
    marker: Highlighter,
};

const EMPTY_CANVAS_STATE: SignatureCanvasState = {
    hasInk: false,
    canUndo: false,
    canRedo: false,
    isMeaningful: false,
};

const SignatureGeneratorModal: React.FC<SignatureGeneratorModalProps> = ({
    isOpen,
    onClose,
    workerId,
    workerName,
    onSaveComplete,
    saveOptions,
}) => {
    const signatureCanvasRef = useRef<RealisticSignatureCanvasHandle>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const [saving, setSaving] = useState(false);
    const [inkTool, setInkTool] = useState<SignatureInkTool>('ballpoint');
    const [inkColor, setInkColor] = useState('#163a70');
    const [inkSize, setInkSize] = useState(2);
    const [canvasState, setCanvasState] = useState<SignatureCanvasState>(EMPTY_CANVAS_STATE);

    const activePreset = useMemo(
        () => SIGNATURE_TOOL_PRESETS.find((preset) => preset.id === inkTool)
            ?? SIGNATURE_TOOL_PRESETS[1],
        [inkTool]
    );

    useEffect(() => {
        if (!isOpen) return undefined;
        if (
            document.activeElement instanceof HTMLElement
            && !overlayRef.current?.contains(document.activeElement)
        ) {
            previouslyFocusedRef.current = document.activeElement;
        }
        const defaultPreset = SIGNATURE_TOOL_PRESETS[1];
        setInkTool(defaultPreset.id);
        setInkColor(defaultPreset.defaultColor);
        setInkSize(defaultPreset.defaultSize);
        setCanvasState(EMPTY_CANVAS_STATE);
        const frame = window.requestAnimationFrame(() => {
            signatureCanvasRef.current?.clear();
            closeButtonRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [isOpen, workerId]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const overlay = overlayRef.current;
        const backgroundElements = Array.from(document.body.children)
            .filter((element) => element !== overlay)
            .map((element) => ({
                element,
                hadInert: element.hasAttribute('inert'),
                ariaHidden: element.getAttribute('aria-hidden'),
            }));

        document.body.style.overflow = 'hidden';
        backgroundElements.forEach(({ element }) => {
            element.setAttribute('inert', '');
            element.setAttribute('aria-hidden', 'true');
        });

        return () => {
            document.body.style.overflow = previousOverflow;
            backgroundElements.forEach(({ element, hadInert, ariaHidden }) => {
                if (!hadInert) element.removeAttribute('inert');
                if (ariaHidden === null) element.removeAttribute('aria-hidden');
                else element.setAttribute('aria-hidden', ariaHidden);
            });
            const previousFocus = previouslyFocusedRef.current;
            window.requestAnimationFrame(() => {
                if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
            });
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !saving) {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab') return;
            const dialog = dialogRef.current;
            if (!dialog) return;
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;
            if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, saving]);

    if (!isOpen) return null;

    const selectTool = (tool: SignatureInkTool) => {
        const preset = SIGNATURE_TOOL_PRESETS.find((candidate) => candidate.id === tool);
        if (!preset) return;
        setInkTool(tool);
        setInkColor(preset.defaultColor);
        setInkSize(preset.defaultSize);
    };

    const handleSave = async () => {
        if (saving) return;
        const rawWorkerId = String(workerId ?? '').trim();
        if (!rawWorkerId || rawWorkerId === 'undefined' || rawWorkerId === 'null') {
            await Swal.fire('오류', '근로자 ID가 없어 서명을 저장할 수 없습니다.', 'error');
            return;
        }

        const canvas = signatureCanvasRef.current;
        if (!canvas || canvas.isEmpty()) {
            await Swal.fire('서명이 필요합니다', '입력 영역에 서명을 먼저 그려주세요.', 'warning');
            return;
        }

        if (!canvas.isMeaningful()) {
            await Swal.fire(
                '서명을 조금 더 크게 그려주세요',
                '작은 점이나 너무 짧은 선은 서명으로 저장되지 않습니다.',
                'warning'
            );
            return;
        }

        const finalDataUrl = canvas.toDataURL();
        if (!finalDataUrl) {
            await Swal.fire('오류', '서명 이미지를 만들지 못했습니다. 다시 시도해 주세요.', 'error');
            return;
        }

        setSaving(true);
        try {
            const url = saveOptions
                ? await signatureService.saveSignature(rawWorkerId, finalDataUrl, saveOptions)
                : await signatureService.saveSignature(rawWorkerId, finalDataUrl);
            onSaveComplete(url);
            onClose();
            await Swal.fire({
                icon: 'success',
                title: '서명 저장 완료',
                text: '투명 배경의 고해상도 서명으로 등록했습니다.',
                timer: 1600,
                showConfirmButton: false,
            });
        } catch (error: unknown) {
            const message = (error as { message?: unknown } | null | undefined)?.message;
            await Swal.fire(
                '저장하지 못했습니다',
                typeof message === 'string' ? message : '잠시 후 다시 시도해 주세요.',
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (!saving) onClose();
    };

    return createPortal(
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[9999] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-5"
            style={{
                paddingTop: 'max(12px, env(safe-area-inset-top))',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) handleClose();
            }}
        >
            <section
                ref={dialogRef}
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-labelledby="signature-modal-title"
                aria-describedby="signature-modal-description"
                data-testid="signature-generator-modal"
                className="flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="relative shrink-0 overflow-hidden bg-slate-950 px-5 py-4 text-white sm:px-6 sm:py-5">
                    <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/30">
                                <PenLine className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Signature studio</p>
                                <h2 id="signature-modal-title" className="mt-1 truncate text-lg font-bold sm:text-xl">
                                    {workerName} 서명 등록
                                </h2>
                                <p id="signature-modal-description" className="mt-1 text-xs text-slate-300 sm:text-sm">
                                    필압과 속도를 반영해 실제 필기구의 질감으로 저장합니다.
                                </p>
                            </div>
                        </div>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            aria-label="서명 등록 닫기"
                            onClick={handleClose}
                            disabled={saving}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800">
                            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">필압 입력 지원</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-800">
                            <Gauge className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">속도 자동 보정</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-violet-800 sm:col-span-1">
                            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">고해상도 PNG</span>
                        </div>
                    </div>

                    <fieldset>
                        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">필기구 선택</legend>
                        <div className="grid grid-cols-3 gap-2">
                            {SIGNATURE_TOOL_PRESETS.map((preset) => {
                                const Icon = TOOL_ICONS[preset.id];
                                const selected = inkTool === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => selectTool(preset.id)}
                                        className={`group rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                            selected
                                                ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/15'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                <Icon className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    <p className="truncate text-sm font-bold text-slate-800">{preset.label}</p>
                                                    {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />}
                                                </div>
                                                <p className="mt-0.5 hidden text-[11px] leading-4 text-slate-500 sm:block">{preset.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_0.85fr]">
                        <fieldset>
                            <legend className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600">
                                <Palette className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                잉크 색상
                            </legend>
                            <div className="flex flex-wrap items-center gap-2">
                                {SIGNATURE_INK_COLORS.map((color) => (
                                    <button
                                        key={color.id}
                                        type="button"
                                        aria-label={color.label}
                                        aria-pressed={inkColor.toLowerCase() === color.value.toLowerCase()}
                                        onClick={() => setInkColor(color.value)}
                                        className={`relative h-9 w-9 rounded-full border-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                            inkColor.toLowerCase() === color.value.toLowerCase()
                                                ? 'scale-110 border-white shadow-md ring-2 ring-blue-500'
                                                : 'border-white shadow-sm ring-1 ring-slate-200 hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: color.value }}
                                    >
                                        {inkColor.toLowerCase() === color.value.toLowerCase() && (
                                            <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" aria-hidden="true" />
                                        )}
                                    </button>
                                ))}
                                <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
                                    직접 선택
                                    <input
                                        type="color"
                                        aria-label="사용자 지정 잉크 색상"
                                        value={inkColor}
                                        onChange={(event) => setInkColor(event.target.value)}
                                        className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                                    />
                                </label>
                            </div>
                        </fieldset>

                        <fieldset className="border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                            <legend className="mb-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-600">
                                <span className="flex items-center gap-2">
                                    <Gauge className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                    선 굵기
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{inkSize} / 5</span>
                            </legend>
                            <input
                                type="range"
                                min={1}
                                max={5}
                                step={1}
                                value={inkSize}
                                aria-label="필기 굵기"
                                onChange={(event) => setInkSize(Number(event.target.value))}
                                className="w-full accent-blue-600"
                            />
                            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
                                <span>가늘게</span>
                                <span>굵게</span>
                            </div>
                        </fieldset>
                    </div>

                    <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-slate-800">서명 입력</p>
                                <p className="text-xs text-slate-500">{activePreset.texture} · 이미 그린 획의 스타일은 유지됩니다.</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                canvasState.hasInk
                                    ? canvasState.isMeaningful
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-200 text-slate-500'
                            }`}>
                                {canvasState.hasInk
                                    ? canvasState.isMeaningful ? '서명 준비됨' : '조금 더 그려주세요'
                                    : '입력 대기'}
                            </span>
                        </div>
                        <RealisticSignatureCanvas
                            ref={signatureCanvasRef}
                            tool={inkTool}
                            color={inkColor}
                            size={inkSize}
                            onStateChange={setCanvasState}
                        />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => signatureCanvasRef.current?.undo()}
                            disabled={!canvasState.canUndo || saving}
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            되돌리기
                        </button>
                        <button
                            type="button"
                            onClick={() => signatureCanvasRef.current?.redo()}
                            disabled={!canvasState.canRedo || saving}
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Redo2 className="h-4 w-4" aria-hidden="true" />
                            다시 실행
                        </button>
                        <button
                            type="button"
                            onClick={() => signatureCanvasRef.current?.clear()}
                            disabled={!canvasState.hasInk || saving}
                            className="flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            전체 지우기
                        </button>
                    </div>
                </div>

                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-center text-[11px] leading-5 text-slate-400 sm:text-left">
                        서명 벡터와 필압 정보는 저장하지 않고 결과 이미지만 보관합니다.
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={saving}
                            className="flex-1 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !canvasState.hasInk}
                            className="flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:flex-none"
                        >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            {saving ? '안전하게 저장 중...' : '이 서명으로 등록'}
                        </button>
                    </div>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default SignatureGeneratorModal;
