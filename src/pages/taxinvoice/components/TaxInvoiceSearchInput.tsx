import React, { useLayoutEffect, useRef, useState } from 'react';
import { koreanKeyboardText } from '../utils/koreanKeyboard';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> & {
    value: string;
    onChange: (value: string) => void;
    clearLabel?: string;
};
type KeyboardRun = { before: string; after: string; keys: string; value: string; caret: number };

export default function TaxInvoiceSearchInput({ value, onChange, onKeyDown, className, clearLabel, ...props }: Props) {
    const [draft, setDraft] = useState(value);
    const [korean, setKorean] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const composing = useRef(false);
    const published = useRef(value);
    const run = useRef<KeyboardRun | null>(null);
    const nextCaret = useRef<number | null>(null);

    useLayoutEffect(() => {
        // Only external resets replace the local draft. During IME composition,
        // draft updates stay here so the ledger does not rerender per keystroke.
        if (value !== published.current) {
            published.current = value;
            composing.current = false;
            run.current = null;
            setDraft(value);
        }
    }, [value]);

    useLayoutEffect(() => {
        if (nextCaret.current !== null && document.activeElement === inputRef.current) {
            inputRef.current?.setSelectionRange(nextCaret.current, nextCaret.current);
            nextCaret.current = null;
        }
    }, [draft]);

    const publish = (next: string) => {
        setDraft(next);
        published.current = next;
        onChange(next);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        const input = event.currentTarget;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const active = run.current;
        const continuing = active && active.value === input.value && start === end && end === active.caret;
        const plainKey = !event.ctrlKey && !event.metaKey && !event.altKey;
        const letter = korean && plainKey && /^[a-zA-Z]$/.test(event.key);
        const backspace = korean && plainKey && event.key === 'Backspace' && continuing;

        if (letter || backspace) {
            event.preventDefault();
            const current = continuing ? active : {
                before: input.value.slice(0, start), after: input.value.slice(end), keys: '', value: '', caret: start,
            };
            current.keys = backspace ? current.keys.slice(0, -1) : current.keys + event.key;
            const text = koreanKeyboardText(current.keys);
            current.value = current.before + text + current.after;
            current.caret = current.before.length + text.length;
            run.current = current.keys ? current : null;
            nextCaret.current = current.caret;
            publish(current.value);
            return;
        }
        if (event.key !== 'Shift') run.current = null;
        onKeyDown?.(event);
    };

    const label = props['aria-label'] || '검색';
    return (
        <div className="flex min-w-0 items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
                <input
                    {...props}
                    ref={inputRef}
                    className={`${className ?? ''}${clearLabel ? ' [&::-webkit-search-cancel-button]:hidden' : ''}`}
                    value={draft}
                    lang={korean ? 'ko' : 'en'}
                    inputMode="text"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={event => {
                        run.current = null;
                        const next = event.currentTarget.value;
                        setDraft(next);
                        if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) publish(next);
                    }}
                    onCompositionStart={() => { composing.current = true; run.current = null; }}
                    onCompositionEnd={event => { composing.current = false; publish(event.currentTarget.value); }}
                    onBlur={event => {
                        if (composing.current) publish(event.currentTarget.value);
                        composing.current = false;
                        run.current = null;
                    }}
                    onPointerDown={() => { run.current = null; }}
                    onKeyDown={handleKeyDown}
                />
                {clearLabel && draft && (
                    <button
                        type="button"
                        aria-label={clearLabel}
                        onClick={() => { run.current = null; publish(''); inputRef.current?.focus(); }}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                )}
            </div>
            <button
                type="button"
                aria-label={`${label} 입력 언어: ${korean ? '한글' : '영문'}, ${korean ? '영문' : '한글'}으로 전환`}
                aria-pressed={korean}
                title={korean ? '영문 키도 한글로 입력합니다. 클릭하면 영문 검색으로 전환합니다.' : '영문 그대로 검색합니다. 클릭하면 한글 검색으로 전환합니다.'}
                onClick={() => { run.current = null; setKorean(previous => !previous); inputRef.current?.focus(); }}
                className={`shrink-0 rounded-lg border px-2 py-1.5 text-xs font-bold focus-visible:ring-2 focus-visible:ring-indigo-500 ${korean ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}
            >
                {korean ? '한글' : '영문'}
            </button>
        </div>
    );
}
