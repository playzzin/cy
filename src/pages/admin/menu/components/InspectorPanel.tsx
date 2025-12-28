import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faTag, faLink, faUserShield, faIcons } from '@fortawesome/free-solid-svg-icons';
import { MenuItem } from '../../../../services/menuServiceV11';
import * as FaIcons from '@fortawesome/free-solid-svg-icons';

interface InspectorPanelProps {
    isOpen: boolean;
    toggle: () => void;
    selectedItem?: MenuItem;
    onUpdate: (item: MenuItem) => void;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ isOpen, toggle, selectedItem, onUpdate }) => {
    const [localState, setLocalState] = useState<MenuItem | null>(null);

    // Sync local state when selection changes
    useEffect(() => {
        if (selectedItem) {
            setLocalState(selectedItem);
        } else {
            setLocalState(null);
        }
    }, [selectedItem]);

    const handleChange = (field: keyof MenuItem, value: any) => {
        if (!localState) return;
        const updated = { ...localState, [field]: value };
        setLocalState(updated);
        onUpdate(updated); // Propagate change immediately
    };

    if (!localState) {
        return (
            <div className={`relative bg-gray-800 border-l border-gray-700 shadow-xl transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'w-80' : 'w-0'}`}>
                <button
                    onClick={toggle}
                    className="absolute -left-4 top-1/2 -translate-y-1/2 bg-gray-700 text-gray-400 hover:text-white p-1 rounded-l-md border border-r-0 border-gray-600 shadow-md z-20 w-4 h-12 flex items-center justify-center text-xs"
                >
                    <FontAwesomeIcon icon={isOpen ? faChevronRight : faChevronLeft} />
                </button>
                <div className={`flex items-center justify-center h-full text-gray-500 text-sm ${!isOpen && 'hidden'}`}>
                    Select an item to view details
                </div>
            </div>
        );
    }

    return (
        <div className={`relative bg-gray-800 border-l border-gray-700 shadow-xl transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'w-80' : 'w-0'}`}>
            <button
                onClick={toggle}
                className="absolute -left-4 top-1/2 -translate-y-1/2 bg-gray-700 text-gray-400 hover:text-white p-1 rounded-l-md border border-r-0 border-gray-600 shadow-md z-20 w-4 h-12 flex items-center justify-center text-xs"
            >
                <FontAwesomeIcon icon={isOpen ? faChevronRight : faChevronLeft} />
            </button>

            <div className={`flex flex-col h-full overflow-y-auto custom-scrollbar ${!isOpen && 'opacity-0 invisible'}`}>
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <h2 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-2">
                        <FontAwesomeIcon icon={faIcons} className="text-blue-400" />
                        속성 편집 (Inspector)
                    </h2>
                </div>

                <div className="p-5 space-y-6">
                    {/* Text */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase">
                            <FontAwesomeIcon icon={faTag} /> 메뉴 이름 (Label)
                        </label>
                        <input
                            type="text"
                            value={localState.text}
                            onChange={(e) => handleChange('text', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
                            placeholder="메뉴 이름을 입력하세요"
                        />
                    </div>

                    {/* Path */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase">
                            <FontAwesomeIcon icon={faLink} /> 이동 경로 (Path)
                        </label>
                        <input
                            type="text"
                            value={localState.path || ''}
                            onChange={(e) => handleChange('path', e.target.value)}
                            // Only allow editing path for non-folders? Or allow mostly everything?
                            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-gray-300 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
                            placeholder="/admin/example"
                        />
                    </div>

                    {/* Roles */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase">
                            <FontAwesomeIcon icon={faUserShield} /> 접근 권한 (Required Roles)
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {['super_admin', 'admin', 'manager', 'user'].map(role => (
                                <button
                                    key={role}
                                    onClick={() => {
                                        const currentRoles = localState.roles || [];
                                        const newRoles = currentRoles.includes(role)
                                            ? currentRoles.filter((r: string) => r !== role)
                                            : [...currentRoles, role];
                                        handleChange('roles', newRoles);
                                    }}
                                    className={`px-2 py-1 text-xs rounded-full border transition-all ${localState.roles?.includes(role)
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-4 border-t border-gray-700 bg-gray-800/50 text-xs text-gray-500">
                    ID: <span className="font-mono">{localState.id}</span>
                </div>
            </div>
        </div>
    );
};

export default InspectorPanel;
