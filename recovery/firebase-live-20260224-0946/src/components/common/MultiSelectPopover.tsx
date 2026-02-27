import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';

interface MultiSelectPopoverProps {
    options: { id: string; name: string }[];
    selectedIds: string[];
    onSelect: (id: string) => void;
    onSelectAll: () => void;
    placeholder?: string;
    minimal?: boolean;
}

const MultiSelectPopover: React.FC<MultiSelectPopoverProps> = ({
    options,
    selectedIds,
    onSelect,
    onSelectAll,
    placeholder = '선택하세요',
    minimal = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

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

    return (
        <div className="relative inline-block w-full" ref={wrapperRef}>
            <div
                className={`w-full py-1.5 px-3 rounded leading-tight cursor-pointer flex justify-between items-center transition-colors
                    ${minimal
                        ? 'bg-transparent border border-transparent hover:bg-slate-100'
                        : 'bg-white border border-slate-300 focus:outline-none focus:bg-white focus:border-indigo-500'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate text-sm ${minimal ? 'font-medium text-slate-600' : ''}`}>
                    {selectedIds.length > 0
                        ? `${selectedIds.length}개 선택됨`
                        : placeholder}
                </span>
                {!minimal && <FontAwesomeIcon icon={faChevronDown} className="text-xs text-slate-400" />}
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="검색..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-500 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        </div>
                        <div className="flex justify-between items-center mt-2 px-1">
                            <button
                                onClick={onSelectAll}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                            >
                                {selectedIds.length === options.length ? '전체 해제' : '전체 선택'}
                            </button>
                            <span className="text-xs text-slate-500 font-medium">{selectedIds.length} / {options.length}</span>
                        </div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <div
                                    key={option.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(option.id);
                                    }}
                                    className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors ${selectedIds.includes(option.id)
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${selectedIds.includes(option.id)
                                        ? 'bg-indigo-600 border-indigo-600'
                                        : 'border-slate-300 bg-white'
                                        }`}>
                                        {selectedIds.includes(option.id) && <FontAwesomeIcon icon={faCheck} className="text-white text-[10px]" />}
                                    </div>
                                    <span className="text-sm truncate">{option.name}</span>
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

export default MultiSelectPopover;
