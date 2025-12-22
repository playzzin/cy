import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSearch } from '@fortawesome/free-solid-svg-icons';
import { iconMap } from '../../constants/iconMap';

interface IconPickerModalProps {
    currentIcon?: string;
    onSelect: (iconName: string) => void;
    onClose: () => void;
}

const IconPickerModal: React.FC<IconPickerModalProps> = ({ currentIcon, onSelect, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // 아이콘 목록 가져오기
    const allIcons = useMemo(() => {
        return Object.keys(iconMap).map(key => ({
            name: key,
            icon: iconMap[key]
        }));
    }, []);

    // 검색 필터링
    const filteredIcons = useMemo(() => {
        if (!searchQuery.trim()) return allIcons;
        const query = searchQuery.toLowerCase();
        return allIcons.filter(item => item.name.toLowerCase().includes(query));
    }, [searchQuery, allIcons]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">아이콘 선택</h2>
                        <p className="text-sm text-slate-500 mt-1">메뉴에 사용할 아이콘을 선택하세요</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* 검색 */}
                <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="아이콘 이름으로 검색... (예: user, chart)"
                            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                        {filteredIcons.length}개의 아이콘 {searchQuery && `("${searchQuery}" 검색 결과)`}
                    </div>
                </div>

                {/* 아이콘 그리드 */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                        {filteredIcons.map((item) => {
                            const isSelected = currentIcon === item.name;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => {
                                        onSelect(item.name);
                                        onClose();
                                    }}
                                    className={`
                                        aspect-square flex flex-col items-center justify-center gap-2 p-3 rounded-xl
                                        transition-all duration-200 border-2
                                        ${isSelected
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-md scale-105'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm'
                                        }
                                    `}
                                    title={item.name}
                                >
                                    <FontAwesomeIcon icon={item.icon} className="text-xl" />
                                    <span className="text-[9px] text-center leading-tight line-clamp-2 font-medium">
                                        {item.name.replace('fa-', '')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {filteredIcons.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <FontAwesomeIcon icon={faSearch} className="text-4xl mb-3" />
                            <p>검색 결과가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
                    <div className="text-xs text-slate-500">
                        {currentIcon && iconMap[currentIcon] && (
                            <span className="flex items-center gap-2">
                                <span className="font-semibold">현재 선택:</span>
                                <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                                    <FontAwesomeIcon icon={iconMap[currentIcon]} />
                                    {currentIcon}
                                </span>
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IconPickerModal;
