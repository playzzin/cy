import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faChevronDown, faCheck, faUser, faTimes } from '@fortawesome/free-solid-svg-icons';

interface SingleSelectPopoverProps {
    options: { id: string; name: string; icon?: React.ReactNode }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    placeholder?: string;
    renderSelected?: (selectedOption: { id: string; name: string; icon?: React.ReactNode }) => React.ReactNode;
    minimal?: boolean;
    disabled?: boolean;
}

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

    const selectedOption = options.find(opt => opt.id === selectedId);

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

    const filteredOptions = options.filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200">
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
                </div>
            )}
        </div>
    );
};

export default SingleSelectPopover;
