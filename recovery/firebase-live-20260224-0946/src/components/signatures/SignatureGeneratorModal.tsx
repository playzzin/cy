import React, { useRef, useState, useEffect, useMemo } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faSave, faUndo, faTimes, faEraser } from '@fortawesome/free-solid-svg-icons';
import type SignaturePad from 'signature_pad';
import Swal from 'sweetalert2';
import { signatureService } from '../../services/signatureService';

interface SignatureGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    workerId: string;
    workerName: string;
    onSaveComplete: (newUrl: string) => void;
}

const SignatureGeneratorModal: React.FC<SignatureGeneratorModalProps> = ({
    isOpen,
    onClose,
    workerId,
    workerName,
    onSaveComplete
}) => {
    const [saving, setSaving] = useState(false);

    // Manual Canvas Refs
    const sigCanvas = useRef<SignatureCanvas>(null);

    const penPresets = useMemo(
        () => [
            { id: 'pencil' as const, label: '연필', baseMinWidth: 0.6, baseMaxWidth: 1.8, velocityFilterWeight: 0.85 },
            { id: 'pen' as const, label: '펜', baseMinWidth: 0.9, baseMaxWidth: 2.6, velocityFilterWeight: 0.7 },
            { id: 'marker' as const, label: '매직', baseMinWidth: 1.6, baseMaxWidth: 4.2, velocityFilterWeight: 0.6 },
        ],
        []
    );
    const [penPresetId, setPenPresetId] = useState<(typeof penPresets)[number]['id']>('pen');
    const [penColor, setPenColor] = useState<string>('#111827');
    const [strokeScale, setStrokeScale] = useState<number>(2);

    const currentPreset = useMemo(
        () => penPresets.find((p) => p.id === penPresetId) ?? penPresets[1],
        [penPresetId, penPresets]
    );
    const resolvedStrokeScale = useMemo(() => {
        const raw = Number(strokeScale);
        if (!Number.isFinite(raw)) return 2;
        return Math.min(6, Math.max(1, Math.floor(raw)));
    }, [strokeScale]);
    const resolvedMinWidth = useMemo(
        () => currentPreset.baseMinWidth * resolvedStrokeScale,
        [currentPreset.baseMinWidth, resolvedStrokeScale]
    );
    const resolvedMaxWidth = useMemo(
        () => currentPreset.baseMaxWidth * resolvedStrokeScale,
        [currentPreset.baseMaxWidth, resolvedStrokeScale]
    );

    // Manual Canvas Sizing
    const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
    const manualContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        // Small delay to allow layout to stabilize
        const timer = setTimeout(() => {
            if (manualContainerRef.current) {
                setCanvasSize({
                    width: manualContainerRef.current.offsetWidth,
                    height: manualContainerRef.current.offsetHeight
                });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [isOpen]);

    if (!isOpen) return null;
    // === Manual Trim Helper (Safe Replacement for getTrimmedCanvas) ===
    const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        const w = canvas.width;
        const h = canvas.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        let top = -1, bottom = -1, left = -1, right = -1;

        // Scan for pixels
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const alpha = data[(y * w + x) * 4 + 3];
                if (alpha > 0) {
                    if (top === -1) top = y;
                    bottom = y;
                    if (left === -1 || x < left) left = x;
                    if (right === -1 || x > right) right = x;
                }
            }
        }

        if (top === -1) return canvas; // Empty

        // Add some padding
        const padding = 20;
        const trimX = Math.max(0, left - padding);
        const trimY = Math.max(0, top - padding);
        const trimW = Math.min(w - trimX, (right - left) + padding * 2);
        const trimH = Math.min(h - trimY, (bottom - top) + padding * 2);

        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimW;
        trimmedCanvas.height = trimH;

        const trimmedCtx = trimmedCanvas.getContext('2d');
        if (trimmedCtx) {
            trimmedCtx.drawImage(canvas, trimX, trimY, trimW, trimH, 0, 0, trimW, trimH);
            return trimmedCanvas;
        }

        return canvas;
    };

    // === 저장 ===
    const handleSave = async () => {
        const rawWorkerId = String(workerId ?? '').trim();
        if (!rawWorkerId || rawWorkerId === 'undefined' || rawWorkerId === 'null') {
            Swal.fire('오류', '근로자 ID가 없습니다. (저장할 수 없습니다)', 'error');
            return;
        }

        if (sigCanvas.current?.isEmpty()) {
            Swal.fire('알림', '서명을 그려주세요.', 'warning');
            return;
        }

        const rawCanvas = sigCanvas.current!.getCanvas();
        const trimmed = trimCanvas(rawCanvas);
        const finalDataUrl = trimmed.toDataURL('image/png');

        setSaving(true);
        try {
            const url = await signatureService.saveSignature(rawWorkerId, finalDataUrl);
            onSaveComplete(url);
            onClose();
            Swal.fire({
                icon: 'success',
                title: '서명 저장 완료',
                text: '성공적으로 저장되었습니다.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error: unknown) {
            const msg = (error as { message?: unknown } | null | undefined)?.message;
            Swal.fire('오류', typeof msg === 'string' ? msg : '저장에 실패했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleManualClear = () => {
        sigCanvas.current?.clear();
    };

    const handleManualUndo = () => {
        const data = (sigCanvas.current?.toData() ?? []) as SignaturePad.Point[][];
        if (data.length === 0) return;
        sigCanvas.current?.fromData(data.slice(0, -1));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <FontAwesomeIcon icon={faPen} />
                        서명 등록 - {workerName}
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <div className="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50">
                        <FontAwesomeIcon icon={faPen} />
                        직접 그리기
                    </div>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    {penPresets.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => setPenPresetId(preset.id)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all
                                                ${penPresetId === preset.id
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500">색상</span>
                                    <input
                                        type="color"
                                        value={penColor}
                                        onChange={(e) => setPenColor(e.target.value)}
                                        className="h-9 w-11 rounded-lg border border-slate-200 bg-white"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 w-12">굵기</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={6}
                                    value={strokeScale}
                                    onChange={(e) => setStrokeScale(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-xs font-bold text-slate-600 w-8 text-right">{resolvedStrokeScale}</span>
                            </div>
                        </div>

                        <div
                            ref={manualContainerRef}
                            className="border border-slate-200 rounded-xl bg-white shadow-inner h-64 overflow-hidden relative"
                        >
                            {canvasSize && (
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    penColor={penColor}
                                    velocityFilterWeight={currentPreset.velocityFilterWeight}
                                    minWidth={resolvedMinWidth}
                                    maxWidth={resolvedMaxWidth}
                                    clearOnResize={false}
                                    canvasProps={{
                                        className: 'w-full h-full',
                                        style: { width: '100%', height: '100%' },
                                        width: canvasSize.width,
                                        height: canvasSize.height,
                                    }}
                                />
                            )}
                            <div className="absolute top-2 right-2 text-xs text-slate-300 pointer-events-none select-none">
                                여기에 서명하세요
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleManualUndo}
                                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                            >
                                <FontAwesomeIcon icon={faUndo} className="mr-1" />
                                실행취소
                            </button>
                            <button
                                type="button"
                                onClick={handleManualClear}
                                className="flex-1 py-3 text-sm font-bold text-red-500 bg-white border border-red-100 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                            >
                                <FontAwesomeIcon icon={faEraser} className="mr-1" />
                                전체지우기
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {saving ? '저장 중...' : '서명 저장하기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignatureGeneratorModal;
