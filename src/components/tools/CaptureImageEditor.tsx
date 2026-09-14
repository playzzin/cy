import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaptureAnnotation, CaptureAnnotationTool, drawCaptureAnnotations, getAnnotationPoint } from './captureAnnotations';
import { CaptureImagePart, encodeCapturePng } from './scrollCapturePipeline';

const tools: Array<[CaptureAnnotationTool, string]> = [
    ['rectangle', '네모'], ['arrow', '화살표'], ['text', '글자'], ['mosaic', '모자이크'], ['cover', '완전 가림']
];
type EditHistory = { past: CaptureAnnotation[]; future: CaptureAnnotation[] };
const EMPTY_HISTORY: EditHistory = { past: [], future: [] };

const CaptureImageEditor: React.FC<{
    parts: CaptureImagePart[];
    onSave: (part: CaptureImagePart) => void;
    onClose: () => void;
}> = ({ parts, onSave, onClose }) => {
    const [partIndex, setPartIndex] = useState(0);
    const [tool, setTool] = useState<CaptureAnnotationTool>('rectangle');
    const [color, setColor] = useState('#ef4444');
    const [size, setSize] = useState(3);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Record<number, EditHistory>>({});
    const [draft, setDraft] = useState<CaptureAnnotation | null>(null);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const pointerRef = useRef<{ id: number; annotation: CaptureAnnotation } | null>(null);
    const saveAbortRef = useRef<AbortController | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const history = edits[partIndex] || EMPTY_HISTORY;
    const part = parts[partIndex];
    const commit = (annotation: CaptureAnnotation) => {
        if (history.past.length >= 100) {
            setError('표시는 한 장당 100개까지 추가할 수 있습니다. 일부를 되돌린 뒤 다시 추가해 주세요.');
            return;
        }
        setError('');
        setEdits((current) => ({ ...current, [partIndex]: { past: [...(current[partIndex]?.past || []), annotation], future: [] } }));
    };
    const undo = () => setEdits((current) => {
        const value = current[partIndex] || EMPTY_HISTORY;
        if (!value.past.length) return current;
        return { ...current, [partIndex]: { past: value.past.slice(0, -1), future: [value.past[value.past.length - 1], ...value.future] } };
    });
    const redo = () => setEdits((current) => {
        const value = current[partIndex] || EMPTY_HISTORY;
        if (!value.future.length) return current;
        return { ...current, [partIndex]: { past: [...value.past, value.future[0]], future: value.future.slice(1) } };
    });
    useEffect(() => {
        const returnFocus = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            saveAbortRef.current?.abort();
            document.body.style.overflow = previousOverflow;
            returnFocus?.isConnected && returnFocus.focus({ preventScroll: true });
        };
    }, []);
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setError('');
        setDraft(null);
        pointerRef.current = null;
        const image = new Image();
        const url = URL.createObjectURL(part.blob);
        const timeout = window.setTimeout(() => { if (!cancelled) setError('이미지를 여는 데 시간이 오래 걸립니다. 편집기를 닫고 다시 열어 주세요.'); }, 10000);
        image.onload = () => {
            window.clearTimeout(timeout);
            if (cancelled) return;
            imageRef.current = image;
            setReady(true);
        };
        image.onerror = () => { window.clearTimeout(timeout); if (!cancelled) setError('이미지를 열지 못했습니다. 원본을 다시 저장해 주세요.'); };
        image.src = url;
        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            imageRef.current = null;
            URL.revokeObjectURL(url);
        };
    }, [part]);
    useEffect(() => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image || !ready) return;
        const frame = requestAnimationFrame(() => {
            if (canvas.width !== part.width) canvas.width = part.width;
            if (canvas.height !== part.height) canvas.height = part.height;
            canvas.getContext('2d')?.drawImage(image, 0, 0, part.width, part.height);
            drawCaptureAnnotations(canvas, draft ? [...history.past, draft] : history.past);
        });
        return () => cancelAnimationFrame(frame);
    }, [ready, part, history.past, draft]);
    const pointFor = (event: React.PointerEvent<HTMLCanvasElement>) => getAnnotationPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), part.width, part.height);
    const cancelPointer = () => { pointerRef.current = null; setDraft(null); };
    const save = async () => {
        if (busy || !ready || !imageRef.current) return;
        const controller = new AbortController();
        saveAbortRef.current = controller;
        setBusy(true);
        setError('');
        const canvas = document.createElement('canvas');
        canvas.width = part.width;
        canvas.height = part.height;
        try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('canvas-context-failed');
            context.drawImage(imageRef.current, 0, 0, part.width, part.height);
            drawCaptureAnnotations(canvas, history.past);
            const blob = await encodeCapturePng(canvas, controller.signal);
            if (!controller.signal.aborted) onSave({ blob, width: part.width, height: part.height });
        } catch {
            if (!controller.signal.aborted) setError('편집본을 저장하지 못했습니다. 편집 내용은 유지되어 있으니 다시 시도해 주세요.');
        } finally {
            canvas.width = 0;
            canvas.height = 0;
            if (!controller.signal.aborted) setBusy(false);
        }
    };
    return createPortal(<div data-capture-exclude="true" className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/70 p-3">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="캡처 이미지 편집" tabIndex={-1}
            className="flex h-[94vh] w-full max-w-6xl flex-col gap-3 rounded-xl border border-white/20 bg-slate-950 p-4 text-white shadow-2xl"
            onKeyDown={(event) => {
                if (event.key === 'Escape') { event.preventDefault(); onClose(); }
                const editable = event.target instanceof HTMLElement && !!event.target.closest('input,textarea,select');
                if (!busy && !editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
                if (event.key === 'Tab') {
                    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || []);
                    const first = items[0], last = items[items.length - 1];
                    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }
            }}>
            <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">캡처 이미지 편집</h2><button type="button" className="rounded border border-white/20 px-3 py-1" onClick={onClose}>편집 닫기</button></div>
            <p className="text-xs text-slate-400">원본은 유지됩니다. 현재 장의 편집본을 새 이미지로 저장합니다. 민감한 내용은 완전 가림으로 덮을 수 있습니다.</p>
            <div className="flex flex-wrap items-center gap-2">
                {parts.length > 1 && <select aria-label="편집할 이미지" value={partIndex} disabled={busy} onChange={(event) => setPartIndex(Number(event.target.value))} className="rounded bg-slate-800 p-2">
                    {parts.map((_, index) => <option key={index} value={index}>{index + 1} / {parts.length}장</option>)}
                </select>}
                {tools.map(([value, label]) => <button key={value} type="button" aria-pressed={tool === value} disabled={busy} onClick={() => setTool(value)} className={`rounded border px-3 py-2 text-xs ${tool === value ? 'border-sky-400 bg-sky-600' : 'border-white/20 bg-slate-800'}`}>{label}</button>)}
                <label className="flex items-center gap-1 text-xs">색상 <input aria-label="표시 색상" type="color" value={color} disabled={busy} onChange={(event) => setColor(event.target.value)} className="h-8 w-10" /></label>
                <label className="flex items-center gap-1 text-xs">굵기 <input aria-label="표시 굵기" type="number" min="1" max="12" value={size} disabled={busy} onChange={(event) => setSize(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} className="w-14 rounded bg-slate-800 p-2" /></label>
                <button type="button" disabled={busy || !history.past.length} onClick={undo} className="rounded border border-white/20 px-3 py-2 text-xs disabled:opacity-40">되돌리기</button>
                <button type="button" disabled={busy || !history.future.length} onClick={redo} className="rounded border border-white/20 px-3 py-2 text-xs disabled:opacity-40">다시 적용</button>
            </div>
            {tool === 'text' && <input aria-label="이미지에 넣을 글자" maxLength={160} placeholder="글자를 입력한 뒤 이미지에서 위치를 클릭하세요" value={text} disabled={busy} onChange={(event) => setText(event.target.value)} className="rounded border border-white/20 bg-slate-900 px-3 py-2 text-sm" />}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded bg-slate-800 p-2">
                {!ready && !error && <p role="status">이미지 여는 중…</p>}
                <canvas ref={canvasRef} aria-label="편집할 캡처 이미지" className="max-h-full max-w-full" style={{ display: ready ? 'block' : 'none', touchAction: 'none', cursor: 'crosshair' }}
                    onPointerDown={(event) => {
                        if (!ready || busy || event.button !== 0 || pointerRef.current) return;
                        event.preventDefault();
                        const point = pointFor(event);
                        const annotation: CaptureAnnotation = { tool, ...point, endX: point.x, endY: point.y, color, size: size * Math.max(1, part.width / 1000), text: text.trim() };
                        if (tool === 'text') { if (annotation.text) commit(annotation); else setError('입력할 글자를 먼저 적어 주세요.'); return; }
                        pointerRef.current = { id: event.pointerId, annotation };
                        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Pointer events still work inside the canvas. */ }
                        setDraft(annotation);
                    }}
                    onPointerMove={(event) => {
                        const interaction = pointerRef.current;
                        if (!interaction || interaction.id !== event.pointerId) return;
                        const point = pointFor(event);
                        setDraft({ ...interaction.annotation, endX: point.x, endY: point.y });
                    }}
                    onPointerUp={(event) => {
                        const interaction = pointerRef.current;
                        if (!interaction || interaction.id !== event.pointerId) return;
                        const point = pointFor(event);
                        if (Math.hypot(point.x - interaction.annotation.x, point.y - interaction.annotation.y) >= 3) commit({ ...interaction.annotation, endX: point.x, endY: point.y });
                        cancelPointer();
                        try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* Already released on some browsers. */ }
                    }}
                    onPointerCancel={cancelPointer} onLostPointerCapture={cancelPointer}
                />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
                <span role={error ? 'alert' : 'status'} className={error ? 'text-rose-300' : 'text-slate-400'}>{error || `${part.width} × ${part.height}px · 표시 ${history.past.length}개`}</span>
                <button type="button" disabled={busy || !ready || !!draft} onClick={() => { void save(); }} className="shrink-0 rounded bg-sky-600 px-4 py-2 font-semibold disabled:opacity-50">{busy ? '저장 중…' : '편집본 저장'}</button>
            </div>
        </div>
    </div>, document.body);
};
export default CaptureImageEditor;
