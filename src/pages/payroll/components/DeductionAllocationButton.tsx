import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MonthlyAdvanceAllocationMode } from '../utils/monthlyAdvanceAllocation';

const options: { value: MonthlyAdvanceAllocationMode; label: string; tone: string }[] = [
    { value: 'corporate', label: '법인', tone: 'border-blue-300 bg-blue-50 text-blue-800' },
    { value: 'labor', label: '노무', tone: 'border-amber-300 bg-amber-50 text-amber-800' },
    { value: 'split', label: '분리', tone: 'border-slate-300 bg-white text-slate-700' },
];

interface Props {
    workerName: string;
    value: MonthlyAdvanceAllocationMode;
    disabled: boolean;
    onChange: (value: MonthlyAdvanceAllocationMode) => void;
}

export default function DeductionAllocationButton({ workerName, value, disabled, onChange }: Props) {
    const id = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const selected = options.find(option => option.value === value) ?? options[2];
    const open = Boolean(position) && !disabled;

    const close = () => {
        setPosition(null);
        triggerRef.current?.focus();
    };
    const showMenu = () => {
        const trigger = triggerRef.current;
        if (!trigger || disabled) return;
        const rect = trigger.getBoundingClientRect();
        const menuHeight = window.innerWidth < 768 ? 142 : 94;
        setPosition({
            top: rect.bottom + menuHeight + 8 > window.innerHeight ? Math.max(4, rect.top - menuHeight - 4) : rect.bottom + 4,
            left: Math.max(4, Math.min(rect.left, window.innerWidth - 100)),
        });
    };

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
        const dismiss = () => setPosition(null);
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) dismiss();
        };
        document.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('resize', dismiss);
        window.addEventListener('scroll', dismiss, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('resize', dismiss);
            window.removeEventListener('scroll', dismiss, true);
        };
    }, [open]);

    useEffect(() => { if (disabled) setPosition(null); }, [disabled]);

    return <>
        <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-label={`${workerName} 공제 분류`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            onClick={() => open ? close() : showMenu()}
            onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    showMenu();
                }
            }}
            className={`inline-flex h-11 md:h-7 w-full items-center justify-center gap-1 rounded-md border px-1 text-[11px] font-bold transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${selected.tone}`}
        >
            {selected.label}<span aria-hidden="true" className="text-[9px] opacity-60">▾</span>
        </button>
        {open && position && createPortal(
            <div
                ref={menuRef}
                id={id}
                role="menu"
                aria-label={`${workerName} 공제 분류 선택`}
                style={{ position: 'fixed', ...position, width: 96, zIndex: 11000 }}
                className="rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                onKeyDown={event => {
                    if (event.key === 'Escape' || event.key === 'Tab') {
                        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
                        close();
                        return;
                    }
                    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
                    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length
                        : event.key === 'ArrowUp' ? (index + buttons.length - 1) % buttons.length
                        : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
                    if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
                }}
            >
                {options.map(option => <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.value === value}
                    tabIndex={-1}
                    onClick={() => { if (!disabled) onChange(option.value); close(); }}
                    className={`flex h-11 md:h-7 w-full items-center justify-between rounded border px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${option.value === value ? option.tone : 'border-transparent text-slate-600 hover:bg-slate-100'}`}
                >
                    {option.label}<span aria-hidden="true">{option.value === value ? '✓' : ''}</span>
                </button>)}
            </div>, document.body
        )}
    </>;
}
