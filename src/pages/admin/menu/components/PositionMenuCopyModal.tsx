import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faCopy,
    faFolder,
    faLink,
    faMagnifyingGlass,
    faShieldHalved,
    faUsers,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../../../constants/iconMap';
import { MenuItem, SiteDataType } from '../../../../types/menu';
import { addMenuItemsSafely, countMenuItems } from '../menuBulkApply';

interface PositionMenuCopyModalProps {
    isOpen: boolean;
    menuData: SiteDataType;
    targetSite: string;
    onClose: () => void;
    onCopy: (sourceSite: string, itemIds: string[], targetSites: string[]) => void;
}

interface TargetOption {
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

const SOURCE_SITE = 'admin';

const getPositionSiteKey = (positionId: string) => {
    if (positionId === 'full') return 'admin';
    return positionId.startsWith('pos_') ? positionId : `pos_${positionId}`;
};

const getMenuItemId = (item: MenuItem, fallback: string) =>
    String(item.id || item.path || item.text || fallback);

const flattenMenu = (
    items: (MenuItem | string)[],
    depth = 0,
    ancestorIds: string[] = [],
    parentKey = 'root'
): FlatMenuNode[] => items.flatMap((item, index) => {
    if (typeof item === 'string') return [];

    const id = getMenuItemId(item, `${parentKey}_${index}`);
    const current: FlatMenuNode = { id, item, depth, ancestorIds };
    const children = Array.isArray(item.sub)
        ? flattenMenu(item.sub, depth + 1, [...ancestorIds, id], `${parentKey}_${index}`)
        : [];

    return [current, ...children];
});

const findMenuItemsByIds = (nodes: (MenuItem | string)[], ids: string[]): MenuItem[] => {
    const idSet = new Set(ids);
    const found: MenuItem[] = [];

    const visit = (items: (MenuItem | string)[], parentKey = 'root') => {
        items.forEach((item, index) => {
            if (typeof item === 'string') return;
            const id = getMenuItemId(item, `${parentKey}_${index}`);
            if (idSet.has(id)) found.push(item);
            if (Array.isArray(item.sub)) visit(item.sub, `${parentKey}_${index}`);
        });
    };

    visit(nodes);
    return found;
};

const PositionMenuCopyModal: React.FC<PositionMenuCopyModalProps> = ({
    isOpen,
    menuData,
    targetSite,
    onClose,
    onCopy
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedTargetSites, setSelectedTargetSites] = useState<string[]>([]);
    const [query, setQuery] = useState('');

    const targetOptions = useMemo<TargetOption[]>(() => {
        const seen = new Set<string>();
        const options: TargetOption[] = [];

        (menuData.admin?.positionConfig || [])
            .slice()
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
            .forEach((position) => {
                const siteKey = getPositionSiteKey(position.id);
                const site = menuData[siteKey];
                if (!site || siteKey === SOURCE_SITE || seen.has(siteKey)) return;

                seen.add(siteKey);
                options.push({
                    siteKey,
                    label: position.name || site.name || siteKey,
                    count: countMenuItems(site.menu || [])
                });
            });

        Object.keys(menuData)
            .filter((siteKey) => siteKey.startsWith('pos_') && !seen.has(siteKey))
            .sort()
            .forEach((siteKey) => {
                const site = menuData[siteKey];
                if (!site) return;
                seen.add(siteKey);
                options.push({
                    siteKey,
                    label: site.name || siteKey.replace(/^pos_/, ''),
                    count: countMenuItems(site.menu || [])
                });
            });

        return options;
    }, [menuData]);

    const targetKey = targetOptions.map((option) => option.siteKey).join('|');

    useEffect(() => {
        if (!isOpen) return;
        setSelectedIds([]);
        setQuery('');
        setSelectedTargetSites(
            targetOptions.some((option) => option.siteKey === targetSite) ? [targetSite] : []
        );
    }, [isOpen, targetKey, targetOptions, targetSite]);

    const sourceMenu = menuData[SOURCE_SITE]?.menu || [];
    const flatNodes = useMemo(() => flattenMenu(sourceMenu), [sourceMenu]);

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
            .filter((node) => selectedSet.has(node.id) && !node.ancestorIds.some((id) => selectedSet.has(id)))
            .map((node) => node.id);
    }, [flatNodes, selectedIds]);

    const selectedSourceItems = useMemo(
        () => findMenuItemsByIds(sourceMenu, effectiveSelectedIds),
        [effectiveSelectedIds, sourceMenu]
    );

    const selectedMenuCount = useMemo(
        () => countMenuItems(selectedSourceItems),
        [selectedSourceItems]
    );

    const preview = useMemo(() => selectedTargetSites.reduce((summary, siteKey) => {
        const result = addMenuItemsSafely(
            menuData[siteKey]?.menu || [],
            selectedSourceItems,
            `preview_${siteKey}`
        );
        summary.added += result.addedCount;
        summary.skipped += result.skippedCount;
        return summary;
    }, { added: 0, skipped: 0 }), [menuData, selectedSourceItems, selectedTargetSites]);

    if (!isOpen) return null;

    const toggleSelection = (id: string) => {
        const descendantIds = new Set(
            flatNodes.filter((node) => node.ancestorIds.includes(id)).map((node) => node.id)
        );
        setSelectedIds((current) => current.includes(id)
            ? current.filter((selectedId) => selectedId !== id)
            : [...current.filter((selectedId) => !descendantIds.has(selectedId)), id]
        );
    };

    const toggleTarget = (siteKey: string) => {
        setSelectedTargetSites((current) => (
            current.includes(siteKey) ? current.filter((key) => key !== siteKey) : [...current, siteKey]
        ));
    };

    const handleCopy = () => {
        if (effectiveSelectedIds.length === 0 || selectedTargetSites.length === 0 || preview.added === 0) return;
        onCopy(SOURCE_SITE, effectiveSelectedIds, selectedTargetSites);
    };

    const allRootIds = sourceMenu
        .map((item, index) => typeof item === 'string' || item.text === '-' ? '' : getMenuItemId(item, `root_${index}`))
        .filter(Boolean);
    const allTargetsSelected = targetOptions.length > 0 && selectedTargetSites.length === targetOptions.length;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
                                <FontAwesomeIcon icon={faCopy} />
                            </span>
                            전체메뉴에서 여러 직책에 추가
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                            전체메뉴에서 필요한 항목을 고른 뒤 여러 직책에 한 번에 안전하게 추가합니다.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" title="닫기">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="flex items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-3 text-xs text-emerald-200">
                    <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-300" />
                    <span><strong>안전 추가 모드:</strong> 기존 메뉴는 유지하며, 같은 이동 경로가 있으면 자동으로 건너뜁니다.</span>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_310px]">
                    <section className="flex min-h-0 flex-col border-b border-slate-800 lg:border-b-0 lg:border-r">
                        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-4">
                            <div className="relative min-w-[240px] flex-1">
                                <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="전체메뉴에서 메뉴명 또는 경로 검색"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
                                />
                            </div>
                            <button type="button" onClick={() => setSelectedIds(allRootIds)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-blue-500 hover:text-white">
                                전체 선택
                            </button>
                            <button type="button" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-40">
                                선택 해제
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {visibleNodes.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">표시할 전체메뉴가 없습니다.</div>
                            ) : (
                                <div className="space-y-1">
                                    {visibleNodes.map(({ id, item, depth, ancestorIds }) => {
                                        const isCoveredByAncestor = ancestorIds.some((ancestorId) => selectedIds.includes(ancestorId));
                                        const isSelected = selectedIds.includes(id) || isCoveredByAncestor;
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
                                                <input type="checkbox" checked={isSelected} disabled={isCoveredByAncestor} onChange={() => toggleSelection(id)} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-blue-500 disabled:opacity-70" />
                                                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-950 text-slate-400"><FontAwesomeIcon icon={icon} /></span>
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

                    <aside className="flex min-h-0 flex-col bg-slate-950/40">
                        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-white"><FontAwesomeIcon icon={faUsers} className="text-blue-400" /> 적용할 직책</div>
                            <button
                                type="button"
                                onClick={() => setSelectedTargetSites(allTargetsSelected ? [] : targetOptions.map((option) => option.siteKey))}
                                className="text-xs font-bold text-blue-300 hover:text-blue-200"
                            >
                                {allTargetsSelected ? '전체 해제' : '전체 선택'}
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 custom-scrollbar">
                            {targetOptions.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">적용할 수 있는 직책 메뉴가 없습니다.</div>
                            ) : targetOptions.map((option) => {
                                const checked = selectedTargetSites.includes(option.siteKey);
                                return (
                                    <label key={option.siteKey} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${checked ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'}`}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleTarget(option.siteKey)} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-blue-500" />
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{option.label}</span>
                                        <span className="text-[11px] text-slate-500">현재 {option.count}개</span>
                                    </label>
                                );
                            })}
                        </div>

                        <div className="border-t border-slate-800 p-4">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-slate-900 p-2"><div className="text-[10px] text-slate-500">선택 메뉴</div><div className="mt-1 font-black text-white">{selectedMenuCount}</div></div>
                                <div className="rounded-lg bg-slate-900 p-2"><div className="text-[10px] text-slate-500">대상 직책</div><div className="mt-1 font-black text-white">{selectedTargetSites.length}</div></div>
                                <div className="rounded-lg bg-emerald-500/10 p-2"><div className="text-[10px] text-emerald-300">추가 예정</div><div className="mt-1 font-black text-emerald-200">{preview.added}</div></div>
                            </div>
                            {preview.skipped > 0 && <p className="mt-2 text-center text-[11px] text-amber-300">중복 {preview.skipped}개는 자동으로 건너뜁니다.</p>}
                        </div>
                    </aside>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
                    <p className="text-xs text-slate-500">변경 내용은 한 번에 저장되며 실행 취소로 전체를 되돌릴 수 있습니다.</p>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">취소</button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={effectiveSelectedIds.length === 0 || selectedTargetSites.length === 0 || preview.added === 0}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faCheck} />
                            {preview.added > 0 ? `${selectedTargetSites.length}개 직책에 안전하게 추가` : '추가할 메뉴 없음'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PositionMenuCopyModal;
