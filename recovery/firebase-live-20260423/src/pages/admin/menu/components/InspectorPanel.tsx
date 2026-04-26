
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft, faChevronRight, faTag, faLink, faUserShield,
    faEye, faEyeSlash, faTimes, faCheckCircle, faPalette, faChartPie, faLayerGroup
} from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../../../constants/iconMap';
import { MenuItem } from '../../../../services/menuServiceV11';
import IconPicker from './IconPicker';
import * as Fas from '@fortawesome/free-solid-svg-icons';
import { IconName } from '@fortawesome/fontawesome-svg-core';

interface InspectorPanelProps {
    isOpen: boolean;
    toggle: () => void;
    selectedItems: MenuItem[];
    onUpdate: (updatedItem: MenuItem) => void;
    onBatchUpdate: (updates: Partial<MenuItem>) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
    isOpen,
    toggle,
    selectedItems,
    onUpdate,
    onBatchUpdate
}) => {
    // Local state for the form
    const [localState, setLocalState] = useState<MenuItem | null>(null);
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    // Sync local state when selectedItems changes
    useEffect(() => {
        if (selectedItems.length === 1) {
            setLocalState(selectedItems[0]);
        } else {
            // In batch mode, we might want to reset local state or set up a "mixed" state helper
            // For now, just reset to null to indicate no single item is active
            setLocalState(null);
        }
    }, [selectedItems]);

    const handleChange = (field: keyof MenuItem, value: any) => {
        if (selectedItems.length === 1 && localState) {
            // Single Item Mode
            const updated = { ...localState, [field]: value };
            setLocalState(updated);
            onUpdate(updated);
        } else if (selectedItems.length > 1) {
            // Batch Mode
            onBatchUpdate({ [field]: value });
        }
    };

    if (!isOpen) return null;

    const isBatchMode = selectedItems.length > 1;

    return (
        <div
            className={`h-full bg-gray-900 shadow-xl transition-all duration-300 z-30 flex flex-col border-l border-gray-800 flex-shrink-0 ${isOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'
                } `}
        >
            {/* Toggle Button (Visible even when closed, technically handled by parent layout mostly, but specific design might need it attached) */}
            <button
                onClick={toggle}
                className="absolute -left-3 top-1/2 -translate-y-1/2 bg-gray-800 text-gray-400 hover:text-white p-1 rounded-l-md border border-r-0 border-gray-700 shadow-lg z-30 w-3 h-16 flex items-center justify-center text-[10px]"
            >
                <FontAwesomeIcon icon={isOpen ? faChevronRight : faChevronLeft} />
            </button>

            <div className={`flex flex-col h-full overflow-y-auto custom-scrollbar ${!isOpen && 'opacity-0 invisible'} `}>

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800">
                    {isBatchMode ? (
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 ring-1 ring-purple-500/20">
                                <FontAwesomeIcon icon={faCheckCircle} size="lg" />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-100 text-base">일괄 편집 (Batch Edit)</h2>
                                <p className="text-xs text-gray-500 font-mono">{selectedItems.length}개 항목 선택됨</p>
                            </div>
                        </div>
                    ) : localState ? (
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 ring-1 ring-blue-500/20">
                                <FontAwesomeIcon
                                    icon={resolveIcon(localState.icon, faChartPie)}
                                    size="lg"
                                />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-100 text-base line-clamp-1">{localState.text}</h2>
                                <p className="text-xs text-gray-500 font-mono line-clamp-1">{localState.id}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 text-sm">항목을 선택해주세요.</div>
                    )}
                </div>

                <div className="p-6 space-y-8">

                    {isBatchMode ? (
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
                                <p className="text-xs text-blue-300 leading-relaxed">
                                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1.5" />
                                    여러 항목을 동시에 편집하고 있습니다. 변경사항은 선택된 모든 항목에 즉시 적용됩니다.
                                </p>
                            </div>

                            {/* Batch Visibility */}
                            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                                <span className="text-sm text-gray-300">표시 여부 (Visibility)</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleChange('hide', false)}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-green-500/20 text-xs text-gray-300 hover:text-green-400 rounded transition-colors"
                                    >
                                        모두 표시
                                    </button>
                                    <button
                                        onClick={() => handleChange('hide', true)}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-red-500/20 text-xs text-gray-300 hover:text-red-400 rounded transition-colors"
                                    >
                                        모두 숨김
                                    </button>
                                </div>
                            </div>

                            {/* Batch Icon */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPalette} /> 아이콘 및 색상 일괄 변경
                                </h3>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 flex items-center justify-between">
                                        <span>아이콘 (Icon)</span>
                                        <button
                                            onClick={() => handleChange('icon', undefined)}
                                            className="text-[9px] text-gray-500 hover:text-red-400 transition-colors"
                                            title="기본 아이콘으로 초기화"
                                        >
                                            <FontAwesomeIcon icon={faTimes} /> 초기화
                                        </button>
                                    </label>
                                    <button
                                        onClick={() => setIsIconPickerOpen(true)}
                                        className="w-full bg-gray-800 border border-gray-700 hover:bg-gray-750 hover:border-gray-600 rounded-lg px-3 py-2.5 flex items-center justify-between transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-gray-300 group-hover:bg-gray-600 group-hover:text-white transition-colors">
                                                <FontAwesomeIcon icon={faLayerGroup} size="sm" />
                                            </div>
                                            <span className="text-sm text-gray-300 font-mono">아이콘 일괄 변경</span>
                                        </div>
                                        <span className="text-xs text-blue-400">선택</span>
                                    </button>
                                </div>
                            </div>

                            {/* Batch Colors */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPalette} /> 색상 일괄 변경
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">아이콘 색상</label>
                                        <input
                                            type="color"
                                            onChange={(e) => handleChange('iconColor', e.target.value)}
                                            className="w-full h-8 bg-transparent cursor-pointer rounded"
                                        />
                                        <button
                                            onClick={() => handleChange('iconColor', undefined)}
                                            className="text-xs text-gray-500 hover:text-red-400 w-full text-right"
                                        >
                                            초기화
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">활성 색상</label>
                                        <input
                                            type="color"
                                            onChange={(e) => handleChange('activeColor', e.target.value)}
                                            className="w-full h-8 bg-transparent cursor-pointer rounded"
                                        />
                                        <button
                                            onClick={() => handleChange('activeColor', undefined)}
                                            className="text-xs text-gray-500 hover:text-red-400 w-full text-right"
                                        >
                                            초기화
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : localState ? (
                        <>
                            {/* Section: General */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    기본 정보 (Basic Info)
                                </h3>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400">메뉴 이름 (Label)</label>
                                    <div className="relative">
                                        <FontAwesomeIcon icon={faTag} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                                        <input
                                            type="text"
                                            value={localState.text}
                                            onChange={(e) => handleChange('text', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-gray-600"
                                            placeholder="메뉴명을 입력하세요"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400">이동 경로 (Path)</label>
                                    <div className="relative">
                                        <FontAwesomeIcon icon={faLink} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                                        <input
                                            type="text"
                                            value={localState.path || ''}
                                            onChange={(e) => handleChange('path', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-blue-400 font-mono focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-gray-600"
                                            placeholder="예: /dashboard"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                                    <span className="text-sm text-gray-300">표시 여부 (Visibility)</span>
                                    <button
                                        onClick={() => handleChange('hide', !localState.hide)}
                                        className={`flex items - center gap - 2 px - 3 py - 1.5 rounded - md text - xs font - medium transition - all ${!localState.hide
                                            ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                                            : 'bg-gray-700 text-gray-400 ring-1 ring-gray-600'
                                            } `}
                                    >
                                        <FontAwesomeIcon icon={!localState.hide ? faEye : faEyeSlash} />
                                        {!localState.hide ? '표시됨' : '숨김'}
                                    </button>
                                </div>
                            </div>

                            <div className="w-full h-px bg-gray-800"></div>

                            {/* Section: Appearance */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    스타일 설정 (Appearance)
                                </h3>

                                {/* Icon Picker */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 flex items-center justify-between">
                                        <span>아이콘 (Icon)</span>
                                        {localState.icon && (
                                            <button
                                                onClick={() => handleChange('icon', undefined)}
                                                className="text-[9px] text-gray-500 hover:text-red-400 transition-colors"
                                                title="기본 아이콘으로 초기화"
                                            >
                                                <FontAwesomeIcon icon={faTimes} /> 초기화
                                            </button>
                                        )}
                                    </label>
                                    <button
                                        onClick={() => setIsIconPickerOpen(true)}
                                        className="w-full bg-gray-800 border border-gray-700 hover:bg-gray-750 hover:border-gray-600 rounded-lg px-3 py-2.5 flex items-center justify-between transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-gray-300 group-hover:bg-gray-600 group-hover:text-white transition-colors">
                                                <FontAwesomeIcon
                                                    icon={resolveIcon(localState.icon, faChartPie)}
                                                    size="sm"
                                                />
                                            </div>
                                            <span className="text-sm text-gray-300 font-mono">{localState.icon || '기본 (Default)'}</span>
                                        </div>
                                        <span className="text-xs text-blue-400">변경</span>
                                    </button>
                                </div>

                                {/* Colors Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
                                            <span>아이콘 색상</span>
                                            {localState.iconColor && (
                                                <button
                                                    onClick={() => handleChange('iconColor', undefined)}
                                                    className="text-[9px] text-gray-500 hover:text-red-400"
                                                    title="초기화"
                                                >
                                                    <FontAwesomeIcon icon={faTimes} /> 초기화
                                                </button>
                                            )}
                                        </label>
                                        <div className="flex items-center gap-2 group relative">
                                            <div className="relative overflow-hidden w-10 h-10 rounded-lg border border-gray-600 shadow-sm transition-all group-hover:border-gray-500 hover:ring-2 hover:ring-blue-500/50">
                                                <input
                                                    type="color"
                                                    value={localState.iconColor || '#60a5fa'}
                                                    onChange={(e) => handleChange('iconColor', e.target.value)}
                                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={localState.iconColor || ''}
                                                    onChange={(e) => handleChange('iconColor', e.target.value)}
                                                    placeholder="#Default"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 font-mono uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
                                            <span>활성 색상</span>
                                            {localState.activeColor && (
                                                <button
                                                    onClick={() => handleChange('activeColor', undefined)}
                                                    className="text-[9px] text-gray-500 hover:text-red-400"
                                                    title="초기화"
                                                >
                                                    <FontAwesomeIcon icon={faTimes} /> 초기화
                                                </button>
                                            )}
                                        </label>
                                        <div className="flex items-center gap-2 group relative">
                                            <div className="relative overflow-hidden w-10 h-10 rounded-lg border border-gray-600 shadow-sm transition-all group-hover:border-gray-500 hover:ring-2 hover:ring-blue-500/50">
                                                <input
                                                    type="color"
                                                    value={localState.activeColor || '#3b82f6'}
                                                    onChange={(e) => handleChange('activeColor', e.target.value)}
                                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={localState.activeColor || ''}
                                                    onChange={(e) => handleChange('activeColor', e.target.value)}
                                                    placeholder="#Default"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 font-mono uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-px bg-gray-800"></div>

                            {/* Section: Permissions */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <FontAwesomeIcon icon={faUserShield} /> 접근 권한 (Access Permissions)
                                </label>
                                <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
                                    {['super_admin', 'admin', 'manager', 'user'].map(role => {
                                        const isActive = localState.roles?.includes(role);
                                        return (
                                            <button
                                                key={role}
                                                onClick={() => {
                                                    const currentRoles = localState.roles || [];
                                                    const newRoles = isActive
                                                        ? currentRoles.filter((r: string) => r !== role)
                                                        : [...currentRoles, role];
                                                    handleChange('roles', newRoles);
                                                }}
                                                className={`px - 3 py - 1.5 text - xs font - medium rounded - full border transition - all flex items - center gap - 1.5 ${isActive
                                                    ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                                                    : 'bg-gray-700 border-transparent text-gray-400 hover:bg-gray-600'
                                                    } `}
                                            >
                                                {isActive && <FontAwesomeIcon icon={faCheckCircle} size="xs" />}
                                                {role}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {localState && (
                    <div className="mt-auto p-4 border-t border-gray-800 bg-gray-900 text-xs text-gray-600 flex justify-between">
                        <span>Menu Inspector v2.1</span>
                        <span>{localState.id?.startsWith('m_') ? 'Auto-ID' : 'Manual-ID'}</span>
                    </div>
                )}
            </div>

            <IconPicker
                isOpen={isIconPickerOpen}
                onClose={() => setIsIconPickerOpen(false)}
                onSelect={(icon) => handleChange('icon', icon)}
                currentIcon={localState?.icon || undefined}
            />
        </div>
    );
};

export default InspectorPanel;
