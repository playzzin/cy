import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faChevronDown, faCheck, faPen, faTimes } from '@fortawesome/free-solid-svg-icons';

const POPOVER_Z_INDEX = 11000;

interface SingleSelectPopoverProps {
    options: { id: string; name: string; icon?: React.ReactNode }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    placeholder?: string;
    renderSelected?: (selectedOption: { id: string; name: string; icon?: React.ReactNode }) => React.ReactNode;
    minimal?: boolean;
    disabled?: boolean;
}

export interface InputPopoverProps {
    value: string | number;
    onChange: (value: string | number) => void;
    type?: 'text' | 'number' | 'tel';
    placeholder?: string;
    minimal?: boolean;
    disabled?: boolean;
    formatDisplay?: (value: string | number) => React.ReactNode;
    suffix?: string;
    isCard?: boolean;
}

const isEmptyInputValue = (value: string | number): boolean =>
    value === '' || value === null || value === undefined;

export const InputPopover: React.FC<InputPopoverProps> = ({
    value,
    onChange,
    type = 'text',
    placeholder = '입력하세요',
    minimal = false,
    disabled = false,
    formatDisplay,
    suffix,
    isCard = false
}) => {
    void isCard;

    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState<string | number>('');
    const [popoverRect, setPopoverRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideTrigger = wrapperRef.current?.contains(target) ?? false;
            const isInsidePopover = popoverRef.current?.contains(target) ?? false;

            if (!isInsideTrigger && !isInsidePopover) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setInputValue(value ?? '');
        const timerId = window.setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 50);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [isOpen, value]);

    useEffect(() => {
        if (!isOpen) {
            setPopoverRect(null);
            return;
        }

        const updateRect = () => {
            const element = wrapperRef.current;
            if (!element) return;

            const rect = element.getBoundingClientRect();
            setPopoverRect({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            });
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [isOpen]);

    const handleSubmit = (event?: React.FormEvent) => {
        event?.preventDefault();
        onChange(type === 'number' ? Number(inputValue) : inputValue);
        setIsOpen(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleSubmit();
            return;
        }

        if (event.key === 'Escape') {
            setIsOpen(false);
        }
    };

    if (disabled) {
        return (
            <div className={`py-1 px-2 ${minimal ? '' : 'bg-slate-50 border border-slate-200 rounded text-slate-500'}`}>
                {formatDisplay ? formatDisplay(value) : value}
                {suffix}
            </div>
        );
    }

    const displayValue = formatDisplay
        ? formatDisplay(value)
        : (isEmptyInputValue(value) ? placeholder : value);

    return (
        <div className="relative inline-block w-full" ref={wrapperRef}>
            <div
                className={`w-full py-1.5 px-3 rounded leading-tight cursor-pointer flex justify-between items-center transition-colors
                    ${minimal
                        ? 'bg-transparent border border-transparent hover:bg-slate-100'
                        : 'bg-white border border-slate-300 focus:outline-none focus:bg-white focus:border-indigo-500'}`}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <div className="truncate text-sm flex items-center gap-2 flex-1 justify-end">
                    <span className={`${isEmptyInputValue(value) ? 'text-slate-400' : 'text-slate-800'}`}>
                        {displayValue}
                        {!isEmptyInputValue(value) && suffix && <span className="text-slate-500 ml-0.5">{suffix}</span>}
                    </span>
                    {!minimal && isEmptyInputValue(value) && <FontAwesomeIcon icon={faPen} className="text-xs text-slate-300" />}
                </div>
            </div>

            {isOpen && popoverRect && createPortal(
                <div
                    ref={popoverRef}
                    style={{ position: 'fixed', top: popoverRect.top, left: popoverRect.left, width: popoverRect.width, zIndex: POPOVER_Z_INDEX }}
                    className="min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200 p-3"
                >
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type={type}
                                value={inputValue}
                                onChange={(event) => setInputValue(event.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                                placeholder={placeholder}
                            />
                            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{suffix}</span>}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                            >
                                확인
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}
        </div>
    );
};

const SingleSelectPopover: React.FC<SingleSelectPopoverProps> = ({
    options,
    selectedId,
    onSelect,
    placeholder = '선택하세요',
    renderSelected,
    minimal = false,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverRect, setPopoverRect] = useState<{ top: number; left: number; width: number } | null>(null);

    const selectedOption = options.find(opt => opt.id === selectedId);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            const isInsideTrigger = wrapperRef.current?.contains(target) ?? false;
            const isInsidePopover = popoverRef.current?.contains(target) ?? false;

            if (!isInsideTrigger && !isInsidePopover) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setPopoverRect(null);
            setSearchTerm('');
            return;
        }

        const updateRect = () => {
            const el = wrapperRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            setPopoverRect({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            });
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [isOpen]);

    const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '').trim();

    const filteredOptions = React.useMemo(() => {
        if (!normalizedSearchTerm) return options;

        return [...options]
            .map((option, index) => {
                const normalizedName = option.name.toLowerCase().replace(/\s+/g, '');
                const startsWith = normalizedName.startsWith(normalizedSearchTerm);
                const includes = startsWith || normalizedName.includes(normalizedSearchTerm);

                return {
                    option,
                    index,
                    startsWith,
                    includes
                };
            })
            .filter((entry) => entry.includes)
            .sort((a, b) => {
                if (a.startsWith !== b.startsWith) {
                    return a.startsWith ? -1 : 1;
                }

                return a.index - b.index;
            })
            .map((entry) => entry.option);
    }, [options, normalizedSearchTerm]);

    const handleSelect = (id: string) => {
        onSelect(id);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block w-full" ref={wrapperRef}>
            <div
                className={`w-full py-1.5 px-3 rounded leading-tight cursor-pointer flex justify-between items-center transition-colors
                    ${minimal
                        ? 'bg-transparent border border-transparent hover:bg-slate-100'
                        : disabled
                            ? 'bg-slate-100 border border-slate-300 cursor-not-allowed text-slate-500'
                            : 'bg-white border border-slate-300 focus:outline-none focus:bg-white focus:border-indigo-500'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="truncate text-sm flex items-center gap-2">
                    {selectedOption ? (
                        renderSelected ? renderSelected(selectedOption) : (
                            <>
                                {selectedOption.icon && <span className="text-slate-400">{selectedOption.icon}</span>}
                                <span>{selectedOption.name}</span>
                            </>
                        )
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                {!minimal && <FontAwesomeIcon icon={faChevronDown} className={`text-xs text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </div>

            {isOpen && popoverRect && createPortal(
                <div
                    ref={popoverRef}
                    style={{ position: 'fixed', top: popoverRect.top, left: popoverRect.left, width: popoverRect.width, zIndex: POPOVER_Z_INDEX }}
                    className="bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200"
                >
                    <div className="p-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="검색..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-500 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        </div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto p-1">
                        <div
                            onClick={() => handleSelect('')}
                            className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors hover:bg-slate-50 text-slate-500`}
                        >
                            <span className="w-4 h-4 flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} className="text-xs" />
                            </span>
                            <span className="text-sm">선택 해제</span>
                        </div>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <div
                                    key={option.id}
                                    onClick={() => handleSelect(option.id)}
                                    className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors ${selectedId === option.id
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                >
                                    <div className="flex-1 flex items-center gap-2 truncate">
                                        {option.icon && <span className="text-slate-400 text-xs">{option.icon}</span>}
                                        <span className="text-sm">{option.name}</span>
                                    </div>
                                    {selectedId === option.id && <FontAwesomeIcon icon={faCheck} className="text-indigo-600 text-xs" />}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-xs text-slate-400">검색 결과가 없습니다.</div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SingleSelectPopover;
