import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSitemap, faFolder, faFile,
    faChevronRight, faChevronDown, faSearch
} from '@fortawesome/free-solid-svg-icons';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { MenuItem, SiteDataType } from '../../types/menu';

const MenuManagementDesignViewer: React.FC = () => {
    const [allMenuData, setAllMenuData] = useState<SiteDataType | null>(null);
    const [selectedSite, setSelectedSite] = useState<string>(() => {
        try {
            return localStorage.getItem('cy_current_site') || 'admin';
        } catch {
            return 'admin';
        }
    });
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = menuServiceV11.subscribe((data) => {
            setAllMenuData(data);
            setSelectedSite((prev) => {
                if (data[prev]) return prev;
                if (data.admin) return 'admin';
                return Object.keys(data)[0] || 'admin';
            });
        });
        return () => {
            unsubscribe();
        };
    }, []);

    const siteKeys = useMemo(() => {
        if (!allMenuData) return [];
        return Object.keys(allMenuData);
    }, [allMenuData]);

    const currentMenu = useMemo<MenuItem[]>(() => {
        if (!allMenuData) return [];
        const site = allMenuData[selectedSite];
        if (!site) return [];
        return Array.isArray(site.menu) ? site.menu : [];
    }, [allMenuData, selectedSite]);

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const normalize = (v: string) => v.trim().toLowerCase();
    const normalizedSearch = normalize(searchTerm);

    const filterTree = (items: MenuItem[]): MenuItem[] => {
        if (!normalizedSearch) return items;

        const visit = (item: MenuItem): MenuItem | null => {
            const selfMatch = normalize(item.text).includes(normalizedSearch) || normalize(item.path || '').includes(normalizedSearch);
            const children = Array.isArray(item.sub) ? (item.sub as MenuItem[]) : [];
            const filteredChildren = children
                .map(visit)
                .filter((c): c is MenuItem => c !== null);

            if (selfMatch) {
                return { ...item, ...(filteredChildren.length > 0 ? { sub: filteredChildren } : {}) };
            }
            if (filteredChildren.length > 0) {
                return { ...item, sub: filteredChildren };
            }
            return null;
        };

        return items.map(visit).filter((v): v is MenuItem => v !== null);
    };

    const filteredMenu = useMemo(() => filterTree(currentMenu), [currentMenu, normalizedSearch]);

    const renderMenuItem = (item: MenuItem, depth: number) => {
        const hasChildren = Array.isArray(item.sub) && item.sub.length > 0;
        const id = item.id || `${item.text}-${item.path || ''}`;
        const isExpanded = expandedIds.has(id) || normalizedSearch.length > 0;

        return (
            <div key={id} className="select-none">
                <div
                    className="flex items-center gap-2 p-2 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-colors"
                    style={{ paddingLeft: `${depth * 20 + 8}px` }}
                >
                    <button
                        type="button"
                        className={`w-6 h-6 flex items-center justify-center text-slate-400 ${hasChildren ? 'hover:text-slate-700' : 'opacity-0 cursor-default'}`}
                        onClick={() => {
                            if (!hasChildren) return;
                            toggleExpand(id);
                        }}
                    >
                        {hasChildren && (
                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} size="xs" />
                        )}
                    </button>

                    <div className="w-6 h-6 flex items-center justify-center text-slate-600 bg-slate-100 rounded">
                        <FontAwesomeIcon icon={hasChildren ? faFolder : faFile} size="xs" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 truncate">{item.text}</span>
                            {item.path && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 font-mono truncate">
                                    {item.path}
                                </span>
                            )}
                        </div>
                        {item.roles && item.roles.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                                {item.roles.map((role) => (
                                    <span
                                        key={role}
                                        className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div>
                        {(item.sub as MenuItem[]).map((child) => renderMenuItem(child, depth + 1))}
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
                        전체 메뉴 구조도 (Live)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        좌측 Sidebar와 동일한 menuServiceV11 데이터(정규화/마이그레이션 적용 후)를 표시합니다.
                    </p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                <div className="col-span-12 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <h2 className="font-bold text-slate-700">메뉴 구조</h2>
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedSite}
                                    onChange={(e) => setSelectedSite(e.target.value)}
                                    className="bg-white border border-slate-300 text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500"
                                >
                                    {siteKeys.map((k) => (
                                        <option key={k} value={k}>
                                            {allMenuData?.[k]?.name || k}
                                        </option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="검색(텍스트/경로)..."
                                        className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                </div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">
                            펼침 아이콘을 눌러 트리를 열고 닫을 수 있습니다. 검색 중에는 관련 경로가 자동으로 펼쳐집니다.
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {!allMenuData && (
                            <div className="p-6 text-slate-500">메뉴 데이터를 불러오는 중입니다...</div>
                        )}
                        {allMenuData && filteredMenu.length === 0 && (
                            <div className="p-6 text-slate-500">검색 결과가 없습니다.</div>
                        )}
                        {allMenuData && filteredMenu.map((item) => renderMenuItem(item, 0))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MenuManagementDesignViewer;
