import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPen, faTimes } from '@fortawesome/free-solid-svg-icons';

interface InputPopoverProps {
    value: string | number;
    onChange: (value: string | number) => void;
    type?: 'text' | 'number' | 'tel';
    placeholder?: string;
    minimal?: boolean;
    disabled?: boolean;
    formatDisplay?: (value: string | number) => React.ReactNode;
    suffix?: string;
}

const InputPopover: React.FC<InputPopoverProps> = ({
    value,
    onChange,
    type = 'text',
    placeholder = '입력하세요',
    minimal = false,
    disabled = false,
    formatDisplay,
    suffix
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState<string | number>('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    useEffect(() => {
        if (isOpen) {
            setInputValue(value || '');
            // Focus input after open
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, value]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        onChange(type === 'number' ? Number(inputValue) : inputValue);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    if (disabled) {
        return (
            <div className={`py-1 px-2 ${minimal ? '' : 'bg-slate-50 border border-slate-200 rounded text-slate-500'}`}>
                {formatDisplay ? formatDisplay(value) : value}{suffix}
            </div>
        );
    }

    return (
        <div className="relative inline-block w-full" ref={wrapperRef}>
            <div
                className={`w-full py-1.5 px-3 rounded leading-tight cursor-pointer flex justify-between items-center transition-colors
                    ${minimal
                        ? 'bg-transparent border border-transparent hover:bg-slate-100'
                        : 'bg-white border border-slate-300 focus:outline-none focus:bg-white focus:border-indigo-500'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="truncate text-sm flex items-center gap-2 flex-1 justify-end">
                    <span className={`${!value ? 'text-slate-400' : 'text-slate-800'}`}>
                        {formatDisplay ? formatDisplay(value) : (value || placeholder)}
                        {value && suffix && <span className="text-slate-500 ml-0.5">{suffix}</span>}
                    </span>
                    {!minimal && !value && <FontAwesomeIcon icon={faPen} className="text-xs text-slate-300" />}
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 right-0 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200 p-3">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type={type}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
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
                </div>
            )}
        </div>
    );
};

export default InputPopover;
