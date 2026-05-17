import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faCopy,
    faFolder,
    faLink,
    faMagnifyingGlass,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../../../constants/iconMap';
import { MenuItem, SiteDataType } from '../../../../types/menu';

interface PositionMenuCopyModalProps {
    isOpen: boolean;
    menuData: SiteDataType;
    targetSite: string;
    onClose: () => void;
    onCopy: (sourceSite: string, itemIds: string[]) => void;
}

interface SourceOption {
    siteKey: string;
    label: string;
    count: number;
}

interface FlatMenuNode {
    id: string;
    item: MenuItem;
    depth: number;
    ancestorIds: string[];
}

const getPositionSiteKey = (positionId: string) => {
    if (positionId === 'full') return 'admin';
    return positionId.startsWith('pos_') ? positionId : `pos_${positionId}`;
};

const getMenuItemId = (item: MenuItem, fallback: string) => {
    return String(item.id || item.path || item.text || fallback);
};

const flattenMenu = (
    items: (MenuItem | string)[],
    depth = 0,
    ancestorIds: string[] = [],
    parentKey = 'root'
): FlatMenuNode[] => {
    return items.flatMap((item, index) => {
        if (typeof item === 'string') return [];

        const id = getMenuItemId(item, `${parentKey}_${index}`);
        const current: FlatMenuNode = { id, item, depth, ancestorIds };
        const children = Array.isArray(item.sub)
            ? flattenMenu(item.sub, depth + 1, [...ancestorIds, id], `${parentKey}_${index}`)
            : [];

        return [current, ...children];
    });
};

const PositionMenuCopyModal: React.FC<PositionMenuCopyModalProps> = ({
    isOpen,
    menuData,
    targetSite,
    onClose,
    onCopy
}) => {
    const [sourceSite, setSourceSite] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [query, setQuery] = useState('');

    const sourceOptions = useMemo<SourceOption[]>(() => {
        const seen = new Set<string>();
        const options: SourceOption[] = [];

        (menuData.admin?.positionConfig || [])
            .slice()
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
            .forEach((position) => {
                const siteKey = getPositionSiteKey(position.id);
                const site = menuData[siteKey];
                if (!site || siteKey === targetSite || seen.has(siteKey)) return;

                seen.add(siteKey);
                options.push({
                    siteKey,
                    label: position.name || site.name || siteKey,
                    count: Array.isArray(site.menu) ? site.menu.length : 0
                });
            });

        Object.keys(menuData)
            .filter((siteKey) => siteKey.startsWith('pos_') && siteKey !== targetSite && !seen.has(siteKey))
            .sort()
            .forEach((siteKey) => {
                const site = menuData[siteKey];
                if (!site) return;

                seen.add(siteKey);
                options.push({
                    siteKey,
                    label: site.name || siteKey.replace(/^pos_/, ''),
                    count: Array.isArray(site.menu) ? site.menu.length : 0
                });
            });

        return options;
    }, [menuData, targetSite]);

    const sourceKey = sourceOptions.map((option) => option.siteKey).join('|');

    useEffect(() => {
        if (!isOpen) return;

        const firstSource = sourceOptions[0]?.siteKey || '';
        setSourceSite((current) => sourceOptions.some((option) => option.siteKey === current) ? current : firstSource);
        setSelectedIds([]);
        setQuery('');
    }, [isOpen, sourceKey, sourceOptions]);

    useEffect(() => {
        setSelectedIds([]);
    }, [sourceSite]);

    const flatNodes = useMemo(() => {
        return flattenMenu(menuData[sourceSite]?.menu || []);
    }, [menuData, sourceSite]);

    const visibleNodes = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return flatNodes;

        return flatNodes.filter(({ item }) => {
            const text = String(item.text || '').toLowerCase();
            const path = String(item.path || '').toLowerCase();
            return text.includes(keyword) || path.includes(keyword);
        });
    }, [flatNodes, query]);

    const effectiveSelectedIds = useMemo(() => {
        const selectedSet = new Set(selectedIds);
        return flatNodes
            .filter((node) => selectedSet.has(node.id) && !node.ancestorIds.some((ancestorId) => selectedSet.has(ancestorId)))
            .map((node) => node.id);
    }, [flatNodes, selectedIds]);

    if (!isOpen) return null;

    const toggleSelection = (id: string) => {
        setSelectedIds((current) => (
            current.includes(id)
                ? current.filter((selectedId) => selectedId !== id)
                : [...current, id]
        ));
    };

    const handleCopy = () => {
        if (!sourceSite || effectiveSelectedIds.length === 0) return;
        onCopy(sourceSite, effectiveSelectedIds);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="flex max-h-[84vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
                                <FontAwesomeIcon icon={faCopy} />
                            </span>
                            다른 직책 메뉴 복사
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                            원본 직책에서 필요한 메뉴를 선택해 현재 메뉴 구조 맨 아래로 복사합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                        title="닫기"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[280px_1fr]">
                    <aside className="border-b border-slate-800 bg-slate-950/40 p-5 md:border-b-0 md:border-r">
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            원본 직책
                        </label>
                        {sourceOptions.length > 0 ? (
                            <select
                                value={sourceSite}
                                onChange={(event) => setSourceSite(event.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-blue-500"
                            >
                                {sourceOptions.map((option) => (
                                    <option key={option.siteKey} value={option.siteKey}>
                                        {option.label} ({option.count})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                                복사할 수 있는 다른 직책 메뉴가 없습니다.
                            </div>
                        )}

                        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <div className="text-xs font-bold text-slate-500">선택됨</div>
                            <div className="mt-1 text-2xl font-black text-white">{effectiveSelectedIds.length}</div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                상위 메뉴를 선택하면 하위 메뉴까지 함께 복사됩니다.
                            </p>
                        </div>
                    </aside>

                    <section className="flex min-h-0 flex-col">
                        <div className="border-b border-slate-800 p-5">
                            <div className="relative">
                                <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="메뉴명 또는 경로 검색"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {visibleNodes.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">
                                    표시할 메뉴가 없습니다.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {visibleNodes.map(({ id, item, depth }) => {
                                        const isSelected = selectedIds.includes(id);
                                        const icon = item.sub?.length ? faFolder : (item.path ? resolveIcon(item.icon) : faLink);

                                        return (
                                            <label
                                                key={id}
                                                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${isSelected
                                                    ? 'border-blue-500/60 bg-blue-500/15 text-blue-100'
                                                    : 'border-transparent bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                                                    }`}
                                                style={{ marginLeft: `${Math.min(depth, 6) * 18}px` }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(id)}
                                                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-950 text-slate-400">
                                                    <FontAwesomeIcon icon={icon} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-semibold">{item.text === '-' ? '구분선' : item.text}</span>
                                                    {item.path && <span className="block truncate text-[11px] text-slate-500">{item.path}</span>}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/40 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!sourceSite || effectiveSelectedIds.length === 0}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faCheck} />
                        선택 메뉴 복사
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PositionMenuCopyModal;
