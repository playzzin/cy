import React, { useState } from 'react';
import { Copy, MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react';

type MemoCardActionMenuProps = {
    memoTitle: string;
    isPinned: boolean;
    disabled?: boolean;
    compact?: boolean;
    onTogglePinned: () => void;
    onCopy: () => void;
    onDelete: () => void;
};

export function MemoCardActionMenu({
    memoTitle,
    isPinned,
    disabled = false,
    compact = false,
    onTogglePinned,
    onCopy,
    onDelete
}: MemoCardActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    const runAction = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    return (
        <div className="relative shrink-0">
            {isOpen && (
                <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setIsOpen(false)}
                    aria-label={`${memoTitle} 메모 작업 메뉴 닫기`}
                />
            )}
            <button
                type="button"
                onClick={() => setIsOpen(previous => !previous)}
                disabled={disabled}
                className={`${compact ? 'sm:h-8 sm:w-8' : 'sm:h-9 sm:w-9'} relative z-40 grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50`}
                title="메모 작업"
                aria-label={`${memoTitle} 메모 작업 더보기`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl" role="menu">
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(onTogglePinned)}
                        className="flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold transition hover:bg-amber-50 hover:text-amber-800"
                        aria-label={`${memoTitle} ${isPinned ? '중요 메모 고정 해제' : '중요 메모로 고정'}`}
                    >
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        {isPinned ? '중요 고정 해제' : '중요 메모로 고정'}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(onCopy)}
                        className="flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold transition hover:bg-slate-100"
                        aria-label={`${memoTitle} 메모 복사`}
                    >
                        <Copy className="h-4 w-4" />
                        메모 복사
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(onDelete)}
                        className="flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-red-700 transition hover:bg-red-50"
                        aria-label={`${memoTitle} 메모 삭제`}
                    >
                        <Trash2 className="h-4 w-4" />
                        삭제
                    </button>
                </div>
            )}
        </div>
    );
}

export default MemoCardActionMenu;
