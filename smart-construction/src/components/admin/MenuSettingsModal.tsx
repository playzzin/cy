import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSearch } from '@fortawesome/free-solid-svg-icons';
import { iconMap } from '../../constants/iconMap';

interface MenuSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: { icon?: string; hoverColor?: string }) => void;
    itemId: string;
    initialIcon?: string;
    initialHoverColor?: string;
    itemName: string;
}

const MenuSettingsModal: React.FC<MenuSettingsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    itemId,
    initialIcon,
    initialHoverColor,
    itemName
}) => {
    const [selectedIcon, setSelectedIcon] = useState<string>(initialIcon || '');
    const [selectedColor, setSelectedColor] = useState<string>(initialHoverColor || '#1abc9c');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedIcon(initialIcon || '');
            setSelectedColor(initialHoverColor || '#1abc9c');
            setSearchTerm('');
        }
    }, [isOpen, initialIcon, initialHoverColor]);

    if (!isOpen) return null;

    const filteredIcons = Object.keys(iconMap).filter(key =>
        key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = () => {
        onSave(itemId, { icon: selectedIcon, hoverColor: selectedColor });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[90vw] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        메뉴 설정: <span className="text-indigo-600">{itemName}</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-200"
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Color Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            롤오버 색상 (Rollover Color)
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-lg border-2 border-slate-200 overflow-hidden shadow-sm">
                                <input
                                    type="color"
                                    value={selectedColor}
                                    onChange={(e) => setSelectedColor(e.target.value)}
                                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={selectedColor}
                                    onChange={(e) => setSelectedColor(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                                />
                            </div>
                            <div
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                style={{ color: selectedColor, backgroundColor: `${selectedColor}15` }}
                            >
                                Preview Text
                            </div>
                        </div>
                    </div>

                    {/* Icon Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            아이콘 선택 (Icon)
                        </label>
                        <div className="relative mb-3">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                            <input
                                type="text"
                                placeholder="아이콘 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 bg-slate-50 rounded-xl p-3 h-64 overflow-y-auto border border-slate-100 custom-scrollbar">
                            {filteredIcons.map((iconKey) => (
                                <button
                                    key={iconKey}
                                    onClick={() => setSelectedIcon(iconKey)}
                                    className={`
                                        aspect-square flex flex-col items-center justify-center gap-1 rounded-lg transition-all border
                                        ${selectedIcon === iconKey
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-sm scale-105'
                                            : 'bg-white border-transparent text-slate-400 hover:bg-white hover:text-slate-600 hover:border-slate-200 hover:shadow-sm'
                                        }
                                    `}
                                    title={iconKey}
                                >
                                    <FontAwesomeIcon icon={iconMap[iconKey]} size="lg" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg font-bold shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-violet-600 transition-all transform active:scale-95"
                    >
                        저장하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MenuSettingsModal;
