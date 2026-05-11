import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_TEAM_COLOR = '#2563eb';

const normalizeHexColor = (value?: string | null): string | null => {
    const trimmed = String(value ?? '').trim();
    const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

    if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
        return `#${withoutHash.toLowerCase()}`;
    }

    if (/^[0-9a-fA-F]{3}$/.test(withoutHash)) {
        const expanded = withoutHash
            .split('')
            .map((char) => `${char}${char}`)
            .join('');
        return `#${expanded.toLowerCase()}`;
    }

    return null;
};

interface TeamColorPickerProps {
    value?: string | null;
    onChange: (color: string) => void;
    onCommit?: (color: string) => void | Promise<void>;
    disabled?: boolean;
    compact?: boolean;
    className?: string;
}

const TeamColorPicker: React.FC<TeamColorPickerProps> = ({
    value,
    onChange,
    onCommit,
    disabled = false,
    compact = false,
    className = ''
}) => {
    const [draftColor, setDraftColor] = useState(value || '');
    const lastCommittedColor = useRef(normalizeHexColor(value) ?? null);

    useEffect(() => {
        setDraftColor(value || '');
    }, [value]);

    const pickerColor = useMemo(
        () => normalizeHexColor(value) ?? normalizeHexColor(draftColor) ?? DEFAULT_TEAM_COLOR,
        [draftColor, value]
    );

    const commitColor = (color: string, shouldCommit = false) => {
        const normalizedColor = normalizeHexColor(color);
        if (!normalizedColor) return false;

        setDraftColor(normalizedColor);
        onChange(normalizedColor);

        if (shouldCommit && lastCommittedColor.current !== normalizedColor) {
            lastCommittedColor.current = normalizedColor;
            void onCommit?.(normalizedColor);
        }

        return true;
    };

    const commitDraft = () => {
        if (disabled) return;
        if (!commitColor(draftColor, true)) {
            setDraftColor(value || '');
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <label
                className={`relative h-8 w-8 flex-shrink-0 overflow-hidden rounded border border-slate-300 bg-white shadow-sm ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                title="Open color picker"
            >
                <input
                    type="color"
                    value={pickerColor}
                    onChange={(e) => commitColor(e.target.value, true)}
                    disabled={disabled}
                    aria-label="Team color picker"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span className="block h-full w-full" style={{ backgroundColor: pickerColor }} />
            </label>

            <input
                type="text"
                value={draftColor}
                onChange={(e) => {
                    const nextColor = e.target.value;
                    setDraftColor(nextColor);
                    const normalizedColor = normalizeHexColor(nextColor);
                    if (normalizedColor) {
                        onChange(normalizedColor);
                    }
                }}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commitDraft();
                    }
                }}
                disabled={disabled}
                placeholder={DEFAULT_TEAM_COLOR}
                aria-label="Team color code"
                className={`border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-2 font-mono shadow-sm disabled:bg-slate-100 disabled:text-slate-400 ${compact ? 'w-24' : 'w-32'}`}
            />
        </div>
    );
};

export default TeamColorPicker;
