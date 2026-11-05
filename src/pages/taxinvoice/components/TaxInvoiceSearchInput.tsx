import React, { useLayoutEffect, useRef, useState } from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> & {
    value: string;
    onChange: (value: string) => void;
    clearLabel?: string;
};

export default function TaxInvoiceSearchInput({ value, onChange, onKeyDown, className, clearLabel, ...props }: Props) {
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const composing = useRef(false);
    const published = useRef(value);

    useLayoutEffect(() => {
        // Only external resets replace the local draft. During IME composition,
        // draft updates stay here so the ledger does not rerender per keystroke.
        if (value !== published.current) {
            published.current = value;
            composing.current = false;
            setDraft(value);
        }
    }, [value]);

    const publish = (next: string) => {
        setDraft(next);
        published.current = next;
        onChange(next);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        // The OS owns Hangul/English switching. Replacing printable key events
        // here makes HangulMode ineffective whenever the OS switches to English.
        onKeyDown?.(event);
    };

    return (
        <div className="relative min-w-0">
                <input
                    {...props}
                    ref={inputRef}
                    className={`${className ?? ''}${clearLabel ? ' [&::-webkit-search-cancel-button]:hidden' : ''}`}
                    value={draft}
                    lang="ko"
                    inputMode="text"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={event => {
                        const next = event.currentTarget.value;
                        setDraft(next);
                        if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) publish(next);
                    }}
                    onCompositionStart={() => { composing.current = true; }}
                    onCompositionEnd={event => { composing.current = false; publish(event.currentTarget.value); }}
                    onBlur={event => {
                        if (composing.current) publish(event.currentTarget.value);
                        composing.current = false;
                    }}
                    onKeyDown={handleKeyDown}
                />
                {clearLabel && draft && (
                    <button
                        type="button"
                        aria-label={clearLabel}
                        onClick={() => { publish(''); inputRef.current?.focus(); }}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                )}
        </div>
    );
}
