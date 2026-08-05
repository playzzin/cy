import React, { useMemo, useState } from 'react';

export type PartnerSearchSelectOption = {
    value: string;
    label: string;
    description?: string;
    badge?: string;
    keywords?: string;
};

type PartnerSearchSelectProps = {
    value: string;
    options: PartnerSearchSelectOption[];
    placeholder: string;
    onChange: (value: string) => void;
    emptyLabel?: string;
    disabled?: boolean;
    maxVisibleOptions?: number;
};

const DEFAULT_MAX_VISIBLE_OPTIONS = 12;

const normalizeSearch = (value: unknown): string =>
    String(value || '').toLowerCase().replace(/\s+/g, '');

const PartnerSearchSelect: React.FC<PartnerSearchSelectProps> = ({
    value,
    options,
    placeholder,
    onChange,
    emptyLabel,
    disabled = false,
    maxVisibleOptions = DEFAULT_MAX_VISIBLE_OPTIONS,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value) || null,
        [options, value]
    );

    const normalizedQuery = normalizeSearch(query);
    const visibleOptions = useMemo(() => {
        const source = normalizedQuery
            ? options.filter((option) => {
                const haystack = normalizeSearch([
                    option.label,
                    option.description,
                    option.badge,
                    option.keywords,
                ].filter(Boolean).join(' '));
                return haystack.includes(normalizedQuery);
            })
            : options;

        const seen = new Set<string>();
        const pinned = selectedOption && !source.some((option) => option.value === selectedOption.value)
            ? [selectedOption]
            : [];

        return [...pinned, ...source]
            .filter((option) => {
                if (!option.value || seen.has(option.value)) return false;
                seen.add(option.value);
                return true;
            })
            .slice(0, maxVisibleOptions);
    }, [maxVisibleOptions, normalizedQuery, options, selectedOption]);

    const showEmptyOption = Boolean(emptyLabel) && !normalizedQuery;
    const optionOffset = showEmptyOption ? 1 : 0;
    const itemCount = visibleOptions.length + optionOffset;
    const displayValue = open ? query : selectedOption?.label || '';
    const emptyStateText = normalizedQuery ? '검색 결과가 없습니다.' : '선택할 항목이 없습니다.';

    const close = () => {
        setOpen(false);
        setQuery('');
        setActiveIndex(0);
    };

    const selectValue = (nextValue: string) => {
        onChange(nextValue);
        close();
    };

    const selectActive = () => {
        if (itemCount === 0) return;
        if (showEmptyOption && activeIndex === 0) {
            selectValue('');
            return;
        }
        const target = visibleOptions[activeIndex - optionOffset];
        if (target) selectValue(target.value);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => itemCount > 0 ? (prev + 1) % itemCount : 0);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => itemCount > 0 ? (prev - 1 + itemCount) % itemCount : 0);
            return;
        }
        if (event.key === 'Enter' && open) {
            event.preventDefault();
            selectActive();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    return (
        <div
            className="partner-search-select"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    close();
                }
            }}
        >
            <input
                type="text"
                value={displayValue}
                disabled={disabled}
                placeholder={placeholder}
                onFocus={() => {
                    setOpen(true);
                    setQuery('');
                    setActiveIndex(0);
                }}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                    setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="partner-search-input"
                autoComplete="off"
            />
            {open && !disabled && (
                <div className="partner-search-menu" role="listbox">
                    {showEmptyOption && (
                        <button
                            type="button"
                            className={`partner-search-option ${activeIndex === 0 ? 'is-active' : ''}`}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                selectValue('');
                            }}
                        >
                            <span className="partner-search-option-main">{emptyLabel}</span>
                        </button>
                    )}
                    {visibleOptions.map((option, index) => {
                        const itemIndex = index + optionOffset;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                className={`partner-search-option ${value === option.value ? 'is-selected' : ''} ${activeIndex === itemIndex ? 'is-active' : ''}`}
                                onMouseEnter={() => setActiveIndex(itemIndex)}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectValue(option.value);
                                }}
                            >
                                <span className="partner-search-option-row">
                                    <span className="partner-search-option-main">{option.label}</span>
                                    {option.badge && <span className="partner-search-badge">{option.badge}</span>}
                                </span>
                                {option.description && (
                                    <span className="partner-search-option-sub">{option.description}</span>
                                )}
                            </button>
                        );
                    })}
                    {visibleOptions.length === 0 && (
                        <div className="partner-search-empty">{emptyStateText}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PartnerSearchSelect;
