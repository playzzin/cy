import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faChevronDown, faChevronRight, faUndo, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useDroppable } from '@dnd-kit/core';
import { MenuItem } from '../../../types/menu';

interface MenuTrashBinProps {
    count: number;
    items: MenuItem[];
    onRestore: (id: string) => void;
    onHardDelete: (id: string) => void;
    onEmpty: () => void;
    isDragging?: boolean;
}

export const MenuTrashBin: React.FC<MenuTrashBinProps> = ({ count, items, onRestore, onHardDelete, onEmpty, isDragging }) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'trash-zone' });
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        flex items-center gap-2 text-sm font-medium transition-colors
                        ${isOver ? 'text-rose-600' : 'text-slate-500 hover:text-slate-700'}
                    `}
                >
                    <FontAwesomeIcon icon={faTrash} className={isOver ? 'animate-bounce' : ''} />
                    휴지통 {count > 0 && `(${count})`}
                    <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} size="xs" />
                </button>
                {count > 0 && isOpen && (
                    <button
                        onClick={onEmpty}
                        className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                    >
                        휴지통 비우기
                    </button>
                )}
            </div>

            <div
                ref={setNodeRef}
                className={`
                    rounded-xl border-2 border-dashed transition-all duration-200 p-4 min-h-[120px] relative
                    ${isOver
                        ? 'bg-rose-50 border-rose-300 ring-4 ring-rose-100'
                        : isOpen
                            ? 'bg-slate-50 border-slate-200'
                            : isDragging
                                ? 'bg-white border-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.1)] ring-2 ring-rose-50 scale-105' // Highlight for drop target
                                : 'bg-transparent border-transparent h-0 min-h-0 p-0 overflow-hidden'
                    }
                `}
            >
                {(isOpen || isOver || isDragging) && (
                    <>
                        {isDragging && !isOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20 rounded-xl pointer-events-none transition-opacity">
                                <span className="text-rose-400 font-bold text-lg flex items-center gap-2 animate-pulse">
                                    <FontAwesomeIcon icon={faTrash} />
                                    여기로 드래그하여 삭제
                                </span>
                            </div>
                        )}

                        {isOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-rose-50/80 z-20 rounded-xl pointer-events-none">
                                <span className="text-rose-500 font-bold text-lg flex items-center gap-2">
                                    <FontAwesomeIcon icon={faTrash} className="animate-bounce" />
                                    놓아서 삭제
                                </span>
                            </div>
                        )}

                        {count === 0 ? (
                            <div className="flex flex-col items-center justify-center text-slate-400 h-24 text-sm rounded-lg opacity-60">
                                <FontAwesomeIcon icon={faTrash} className="mb-2 text-xl" />
                                <span>휴지통이 비었습니다</span>
                                <span className="text-xs mt-1">메뉴 항목을 여기로 드래그하여 삭제하세요</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {items.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg flex-shrink-0">
                                                <FontAwesomeIcon icon={faTrash} size="sm" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-700 text-sm truncate">{item.text}</div>
                                                <div className="text-[10px] text-slate-400 truncate">{item.path || 'No Path'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onRestore(item.id!)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                                title="복원"
                                            >
                                                <FontAwesomeIcon icon={faUndo} />
                                            </button>
                                            <button
                                                onClick={() => onHardDelete(item.id!)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                                title="영구 삭제"
                                            >
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
            {!isOpen && !isOver && !isDragging && count > 0 && (
                <p className="mt-2 text-xs text-slate-400 ml-1">
                    * {count}개의 항목이 휴지통에 있습니다. 클릭하여 확인하세요.
                </p>
            )}
        </div>
    );
};
