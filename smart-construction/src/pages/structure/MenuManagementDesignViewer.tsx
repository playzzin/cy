import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSitemap, faPlus, faEdit, faTrash, faSave, faFolder, faFile,
    faChevronRight, faChevronDown, faGripVertical, faCheck, faTimes
} from '@fortawesome/free-solid-svg-icons';

// Mock Data Structure
interface MenuItem {
    id: string;
    text: string;
    icon?: string;
    path?: string;
    roles?: string[];
    children?: MenuItem[];
    isExpanded?: boolean;
}

const initialMenuData: MenuItem[] = [
    {
        id: '1', text: '대시보드', icon: 'fa-chart-pie', path: '/dashboard', roles: ['admin', 'user'],
        children: []
    },
    {
        id: '2', text: '통합 현황판', icon: 'fa-chart-line', path: '/jeonkuk/integrated-status', roles: ['admin'],
        children: []
    },
    {
        id: '3', text: '급여관리', icon: 'fa-money-bill-wave', roles: ['admin'], isExpanded: true,
        children: [
            { id: '3-1', text: '명세서', path: '/payroll/payslip', roles: ['admin'] },
            { id: '3-2', text: '급여 지급 관리', path: '/payroll/wage-payment', roles: ['admin'] }
        ]
    },
    {
        id: '4', text: '상태관리', icon: 'fa-list-check', path: '/jeonkuk/status-management', roles: ['admin'],
        children: []
    }
];

const MenuManagementDesignViewer: React.FC = () => {
    const [menuData, setMenuData] = useState<MenuItem[]>(initialMenuData);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Toggle Expand/Collapse
    const toggleExpand = (id: string) => {
        const toggleRecursive = (items: MenuItem[]): MenuItem[] => {
            return items.map(item => {
                if (item.id === id) {
                    return { ...item, isExpanded: !item.isExpanded };
                }
                if (item.children) {
                    return { ...item, children: toggleRecursive(item.children) };
                }
                return item;
            });
        };
        setMenuData(toggleRecursive(menuData));
    };

    // Recursive Menu Item Renderer
    const renderMenuItem = (item: MenuItem, depth: number = 0) => {
        return (
            <div key={item.id} className="select-none">
                <div
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                    style={{ paddingLeft: `${depth * 20 + 8}px` }}
                    onClick={() => {
                        setSelectedItem(item);
                        setIsEditing(false);
                    }}
                >
                    <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                        <FontAwesomeIcon icon={faGripVertical} />
                    </div>

                    <div
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (item.children && item.children.length > 0) {
                                toggleExpand(item.id);
                            }
                        }}
                    >
                        {item.children && item.children.length > 0 && (
                            <FontAwesomeIcon icon={item.isExpanded ? faChevronDown : faChevronRight} size="xs" />
                        )}
                    </div>

                    <div className="w-6 h-6 flex items-center justify-center text-slate-600 bg-slate-100 rounded">
                        <FontAwesomeIcon icon={item.children && item.children.length > 0 ? faFolder : faFile} size="xs" />
                    </div>

                    <span className="font-medium text-slate-700 flex-1">{item.text}</span>

                    {item.roles && item.roles.length > 0 && (
                        <div className="flex gap-1">
                            {item.roles.map(role => (
                                <span key={role} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                                    {role}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {item.isExpanded && item.children && (
                    <div>
                        {item.children.map(child => renderMenuItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faSitemap} className="text-indigo-600" />
                        메뉴 관리 시스템 설계 (Menu Management Design)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        동적 메뉴 구조 관리 및 권한 설정 UI 프로토타입
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                        초기화
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition-colors flex items-center gap-2">
                        <FontAwesomeIcon icon={faSave} />
                        변경사항 저장
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left Panel: Menu Tree */}
                <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-bold text-slate-700">메뉴 구조 (Menu Structure)</h2>
                        <button className="text-xs px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-600">
                            <FontAwesomeIcon icon={faPlus} className="mr-1" />
                            최상위 추가
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {menuData.map(item => renderMenuItem(item))}
                    </div>
                </div>

                {/* Center Panel: Item Details */}
                <div className="col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="font-bold text-slate-700">메뉴 상세 정보 (Details)</h2>
                    </div>

                    {selectedItem ? (
                        <div className="p-6 space-y-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">메뉴명 (Text)</label>
                                    <input
                                        type="text"
                                        value={selectedItem.text}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">아이콘 (Icon)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={selectedItem.icon || ''}
                                                placeholder="fa-icon-name"
                                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500">
                                                <FontAwesomeIcon icon={faFolder} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">경로 (Path)</label>
                                        <input
                                            type="text"
                                            value={selectedItem.path || ''}
                                            placeholder="/path/to/page"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">접근 권한 (Roles)</label>
                                    <div className="flex flex-wrap gap-2 p-3 border border-slate-300 rounded-lg bg-slate-50">
                                        {['admin', 'manager', 'user', 'guest'].map(role => (
                                            <label key={role} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200 cursor-pointer hover:border-indigo-300">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItem.roles?.includes(role)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm text-slate-700">{role}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 flex justify-between">
                                <button className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-2">
                                    <FontAwesomeIcon icon={faTrash} />
                                    삭제
                                </button>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                        하위 메뉴 추가
                                    </button>
                                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition-colors">
                                        <FontAwesomeIcon icon={faCheck} className="mr-2" />
                                        적용
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <FontAwesomeIcon icon={faSitemap} size="3x" className="mb-4 opacity-20" />
                            <p>왼쪽 메뉴에서 항목을 선택하세요</p>
                        </div>
                    )}
                </div>

                {/* Right Panel: JSON Preview */}
                <div className="col-span-3 bg-slate-900 rounded-xl shadow-sm border border-slate-800 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-950">
                        <h2 className="font-bold text-slate-300 text-sm font-mono">JSON Preview</h2>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                            {JSON.stringify(menuData, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MenuManagementDesignViewer;
