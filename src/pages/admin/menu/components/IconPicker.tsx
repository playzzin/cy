
import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as Fas from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';

interface IconPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (iconName: string) => void;
    currentIcon?: string;
}

// 1. Pre-filter icons to avoid heavy computation on every render
// Exclude sensitive or large icon sets if necessary, but here we just take all solid icons.
// We'll create a static list of icon names.
const ICON_LIST = Object.keys(Fas)
    .filter(key => key !== 'fas' && key !== 'prefix') // keys are mostly 'faAd', 'faAddressBook' etc.
    .sort();

const IconPicker: React.FC<IconPickerProps> = ({ isOpen, onClose, onSelect, currentIcon }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredIcons = useMemo(() => {
        if (!searchTerm) return ICON_LIST;
        const lower = searchTerm.toLowerCase();
        return ICON_LIST.filter(name => name.toLowerCase().includes(lower));
    }, [searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                    <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <FontAwesomeIcon icon={Fas.faIcons} className="text-blue-400" />
                        아이콘 선택 (Select Icon)
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-gray-800">
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="아이콘 검색... (예: user, file, gear)"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-900/30">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                        {filteredIcons.map(iconName => {
                            const iconDef = (Fas as any)[iconName] as IconDefinition;
                            if (!iconDef) return null;

                            const isSelected = currentIcon === iconName;

                            return (
                                <button
                                    key={iconName}
                                    onClick={() => {
                                        onSelect(iconName);
                                        onClose();
                                    }}
                                    className={`
                                        aspect-square flex flex-col items-center justify-center gap-2 rounded-lg transition-all
                                        hover:scale-105 active:scale-95
                                        ${isSelected
                                            ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600'
                                        }
                                    `}
                                    title={iconName}
                                >
                                    <FontAwesomeIcon icon={iconDef} size="lg" />
                                </button>
                            );
                        })}
                    </div>
                    {filteredIcons.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            "{searchTerm}" 에 일치하는 아이콘이 없습니다.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-700 bg-gray-900/50 text-right text-xs text-gray-500">
                    총 {filteredIcons.length}개 아이콘 표시 중
                </div>
            </div>
        </div>
    );
};

export default IconPicker;
