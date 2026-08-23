import React from 'react';
import { RotateCcw, X } from 'lucide-react';

type MemoUndoToastProps = {
    count: number;
    disabled?: boolean;
    onUndo: () => void;
    onDismiss: () => void;
};

export function MemoUndoToast({ count, disabled = false, onUndo, onDismiss }: MemoUndoToastProps) {
    if (count === 0) return null;

    return (
        <div
            className="fixed inset-x-3 bottom-4 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
            role="status"
            aria-live="polite"
        >
            <span className="min-w-0 flex-1 text-sm font-semibold">
                {count.toLocaleString('ko-KR')}개 메모를 삭제했습니다.
            </span>
            <button
                type="button"
                onClick={onUndo}
                disabled={disabled}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <RotateCcw className="h-4 w-4" />
                실행 취소
            </button>
            <button
                type="button"
                onClick={onDismiss}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="삭제 알림 닫기"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export default MemoUndoToast;
