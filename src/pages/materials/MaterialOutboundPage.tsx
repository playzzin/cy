/* Force Re-build: 2025-12-26 11:45 - Fixed Split Layout */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faSave, faRotateRight, faFloppyDisk, faTrash, faEdit, faSearch } from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { Material, OutboundTransaction } from '../../types/materials';
import { useAuth } from '../../contexts/AuthContext';
import { filterCheongyeonMaterialSites } from './materialSiteFilters';
import { handleMaterialQuantityInputKeyDown } from './materialKeyboardNavigation';

// 임시저장 데이터 타입
type OutboundTempData = {
    transactionDate: string;
    siteId: string;
    siteName: string;
    vehicleNumber: string;
    recipient: string;
    quantities: Record<string, number>;
    savedAt: number;
};

type MobileMaterialGroup = 'scaffolding' | 'dongbari' | 'other';

const ITEMS_PER_COLUMN = 10;
const QUICK_QUANTITY_STEPS = [-1, -10, -100, 1, 10, 100];

const getMaterialChunkGridClass = (chunkCount: number) => {
    if (chunkCount >= 7) return 'grid-cols-7 min-w-[1330px]';
    if (chunkCount === 6) return 'grid-cols-6 min-w-[1140px]';
    if (chunkCount === 5) return 'grid-cols-5 min-w-[950px]';
    if (chunkCount === 4) return 'grid-cols-4 min-w-[760px]';
    if (chunkCount === 3) return 'grid-cols-3 min-w-[570px]';
    if (chunkCount === 2) return 'grid-cols-2 min-w-[380px]';
    return 'grid-cols-1 min-w-[190px]';
};

const getQuantityAccentClasses = (colorClass: string) => {
    if (colorClass === 'slate') {
        return {
            cardActive: 'border-slate-300 bg-slate-50',
            inputActive: 'border-slate-500 text-slate-700 bg-white',
            positiveButton: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 active:bg-slate-200',
            negativeButton: 'border-rose-100 bg-white text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:bg-rose-100',
        };
    }

    return {
        cardActive: 'border-red-200 bg-red-50',
        inputActive: 'border-red-500 text-red-700 bg-white',
        positiveButton: 'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 active:bg-red-100',
        negativeButton: 'border-rose-100 bg-white text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:bg-rose-100',
    };
};

const MaterialOutboundPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
    const [siteId, setSiteId] = useState('');
    const [siteName, setSiteName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [recipient, setRecipient] = useState('');
    const [searchFilter, setSearchFilter] = useState('');

    const [sites, setSites] = useState<Site[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [hasTempData, setHasTempData] = useState(false);
    const [mobileMaterialGroup, setMobileMaterialGroup] = useState<MobileMaterialGroup>('scaffolding');
    const [mobileSelectedItemName, setMobileSelectedItemName] = useState('');

    // 임시저장 데이터 로드
    const loadTempData = () => {
        try {
            const tempDataStr = localStorage.getItem('outbound_temp');
            if (!tempDataStr) return;

            const tempData: OutboundTempData = JSON.parse(tempDataStr);

            // 24시간 이상 된 데이터는 정리
            const now = Date.now();
            if (now - tempData.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('outbound_temp');
                return;
            }

            // 데이터 복원
            setTransactionDate(tempData.transactionDate);
            setSiteId(tempData.siteId);
            setSiteName(tempData.siteName);
            setVehicleNumber(tempData.vehicleNumber);
            setRecipient(tempData.recipient);
            setQuantities(tempData.quantities || {});
            setHasTempData(true);

            // Ref도 즉시 동기화 (Strict Mode 대응)
            stateRef.current = {
                transactionDate: tempData.transactionDate,
                siteId: tempData.siteId,
                siteName: tempData.siteName,
                vehicleNumber: tempData.vehicleNumber,
                recipient: tempData.recipient,
                quantities: tempData.quantities || {}
            };

            console.log('[Outbound] 임시저장 데이터를 복원했습니다:', tempData);
        } catch (error) {
            console.error('[Outbound] 임시저장 데이터 로드 실패:', error);
            localStorage.removeItem('outbound_temp');
        }
    };

    // 임시저장 데이터 저장
    const saveTempData = () => {
        try {
            const tempData: OutboundTempData = {
                transactionDate,
                siteId,
                siteName,
                vehicleNumber,
                recipient,
                quantities,
                savedAt: Date.now()
            };
            localStorage.setItem('outbound_temp', JSON.stringify(tempData));
            setHasTempData(true);
        } catch (error) {
            console.error('[Outbound] 임시저장 데이터 저장 실패:', error);
        }
    };

    // 임시저장 데이터 삭제
    const clearTempData = () => {
        localStorage.removeItem('outbound_temp');
        setHasTempData(false);
    };

    // 최신 상태를 추적하기 위한 Ref
    const stateRef = React.useRef({
        transactionDate,
        siteId,
        siteName,
        vehicleNumber,
        recipient,
        quantities
    });

    // 렌더링마다 Ref 업데이트
    useEffect(() => {
        stateRef.current = {
            transactionDate,
            siteId,
            siteName,
            vehicleNumber,
            recipient,
            quantities
        };
    }, [transactionDate, siteId, siteName, vehicleNumber, recipient, quantities]);

    // 실제 저장 로직 (Ref 기준)
    const performSave = () => {
        try {
            const current = stateRef.current;
            const tempData: OutboundTempData = {
                transactionDate: current.transactionDate,
                siteId: current.siteId,
                siteName: current.siteName,
                vehicleNumber: current.vehicleNumber,
                recipient: current.recipient,
                quantities: current.quantities,
                savedAt: Date.now()
            };
            localStorage.setItem('outbound_temp', JSON.stringify(tempData));
            setHasTempData(true);
            console.log('[Outbound] Auto-saved data:', tempData);
        } catch (error) {
            console.error('[Outbound] Temp save failed:', error);
        }
    };

    useEffect(() => {
        loadData();
        loadTempData();

        // 브라우저 종료/새로고침 시 저장
        const handleBeforeUnload = () => {
            performSave();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // 컴포넌트 언마운트(페이지 이동) 시 저장
            performSave();
        };
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sitesData, materialsData] = await Promise.all([
                siteService.getSites(),
                materialService.getUniqueMaterialsForSelection()
            ]);
            setSites(filterCheongyeonMaterialSites(sitesData));
            setMaterials(materialsData);

            // [FIX] 기존 임시저장 수량이 로딩 시점에 사라지지 않도록 유지합니다.
            setQuantities((prev) => {
                const validIds = new Set(materialsData.map((m) => m.id));
                const filteredEntries = Object.entries(prev).filter(([id]) => validIds.has(id));
                return Object.fromEntries(filteredEntries);
            });
        } catch (error) {
            console.error('Failed to load data:', error);
            alert('데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSiteChange = (selectedSiteId: string) => {
        setSiteId(selectedSiteId);
        const site = sites.find(s => s.id === selectedSiteId);
        setSiteName(site?.name || '');
    };

    const handleQuantityChange = (materialId: string, value: string) => {
        const numValue = Math.max(0, parseInt(value, 10) || 0);
        setQuantities(prev => ({
            ...prev,
            [materialId]: numValue
        }));
    };

    const handleQuantityStep = (materialId: string, step: number) => {
        setQuantities(prev => ({
            ...prev,
            [materialId]: Math.max(0, (prev[materialId] || 0) + step)
        }));
    };

    const handleSave = async () => {
        if (!siteId) {
            alert('현장을 선택하세요.');
            return;
        }
        if (!sites.some((site) => site.id === siteId)) {
            alert('(주)청연이엔지 소속 현장만 선택할 수 있습니다.');
            return;
        }

        const transactions: Array<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>> = [];
        const resolvedSiteName = siteName || sites.find(s => s.id === siteId)?.name || '';

        Object.entries(quantities).forEach(([materialId, quantity]) => {
            if (quantity > 0) {
                const material = materials.find(m => m.id === materialId);
                if (material) {
                    transactions.push({
                        transactionDate,
                        siteId,
                        siteName: String(resolvedSiteName || '').trim(),
                        vehicleNumber: vehicleNumber || '',
                        materialId: material.id,
                        materialKey: material.materialKey,
                        category: String(material.category || '').trim(),
                        itemName: String(material.itemName || '').trim(),
                        spec: String(material.spec || '').trim(),
                        quantity,
                        unit: String(material.unit || '').trim(),
                        recipient: recipient || '',
                        deliveryStatus: 'pending',
                        notes: '',
                        registeredBy: currentUser?.uid || '',
                        registeredByName: currentUser?.displayName || currentUser?.email || '관리자'
                    });
                }
            }
        });

        if (transactions.length === 0) {
            alert('출고할 자재를 입력하세요.');
            return;
        }

        setLoading(true);
        try {
            await materialService.addOutboundTransactionsBatch(transactions);
            alert(`${transactions.length}건의 출고가 등록되었습니다.`);
            // 저장 성공 후 임시저장 데이터 삭제
            clearTempData();
            handleReset();
        } catch (error) {
            console.error('Failed to save outbound transactions:', error);
            alert('출고 등록에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setQuantities({});
        setVehicleNumber('');
        setRecipient('');
        // 리셋 시 임시저장 데이터도 삭제
        clearTempData();
    };

    // 자동 저장 (Debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            performSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [transactionDate, siteId, siteName, vehicleNumber, recipient, quantities]);

    // --- Data Processing for Layout ---
    // 1. Consolidate into Dongbari vs Scaffolding vs Others
    const dongbariList: Material[] = [];
    const scaffoldingList: Material[] = [];
    const otherList: Material[] = [];

    materials.forEach(m => {
        const cat = (m.category || '').trim();
        const itemName = (m.itemName || '').trim();
        const spec = (m.spec || '').trim();

        // 검색 필터 적용 (수량이 입력된 품목은 검색 필터와 상관없이 항상 표시)
        const hasQty = (quantities[m.id] || 0) > 0;
        const matchesSearch = !searchFilter ||
            itemName.toLowerCase().includes(searchFilter.toLowerCase()) ||
            spec.toLowerCase().includes(searchFilter.toLowerCase()) ||
            cat.toLowerCase().includes(searchFilter.toLowerCase());

        if (!hasQty && !matchesSearch) return;

        // 1. Right Column: Scaffolding (비계)
        if (cat.includes('비계') || (m.itemName || '').includes('비계')) {
            scaffoldingList.push(m);
        }
        // 2. Left Column: Dongbari (동바리) OR Support (서포트) OR System (시스템 - excluding Scaffolding)
        else if (cat.includes('동바리') || cat.includes('서포트') || (m.itemName || '').includes('동바리') || (m.itemName || '').includes('서포트') || cat.includes('시스템')) {
            dongbariList.push(m);
        }
        // 3. Others
        else {
            otherList.push(m);
        }
    });

    const selectedItemCount = Object.values(quantities).filter(quantity => quantity > 0).length;
    const selectedQuantityTotal = Object.values(quantities).reduce(
        (sum, quantity) => sum + (quantity > 0 ? quantity : 0),
        0
    );
    const mobileGroupOptions = [
        { key: 'scaffolding' as const, title: '시스템 비계', items: scaffoldingList, colorClass: 'red' },
        { key: 'dongbari' as const, title: '시스템 동바리', items: dongbariList, colorClass: 'red' },
        ...(otherList.length > 0 ? [{ key: 'other' as const, title: '기타', items: otherList, colorClass: 'slate' }] : []),
    ];
    const activeMobileGroup = mobileGroupOptions.find((option) => option.key === mobileMaterialGroup && option.items.length > 0)
        || mobileGroupOptions.find((option) => option.items.length > 0);

    // Helper to render a "Section" (Card)
    const renderSection = (title: string, items: Material[], colorClass = 'red', sectionIndex = 0) => {
        if (items.length === 0) return null;

        // 1. Sort items by Category > Name > Spec (Numeric Aware)
        items.sort((a, b) => {
            // [NEW] Special Sort for System Scaffolding (시스템 비계)
            if (title === '시스템 비계') {
                // 1. Priority: Vertical (수직재) > Horizontal (수평재) > Others
                const getPriority = (name: string) => {
                    if (name.includes('수직재')) return 1;
                    if (name.includes('수평재')) return 2;
                    return 3;
                };

                const priA = getPriority(a.itemName);
                const priB = getPriority(b.itemName);

                if (priA !== priB) return priA - priB;

                // 2. Spec Descending (Numeric Aware)
                // e.g., H18 -> H03, 4018 -> 4006
                // Using localeCompare with numeric: true in reverse order
                return (b.spec || '').localeCompare(a.spec || '', undefined, { numeric: true });
            }

            // [Original] Standard Sort for other sections
            const catCompare = (a.category || '').localeCompare(b.category || '');
            if (catCompare !== 0) return catCompare;

            const nameCompare = a.itemName.localeCompare(b.itemName);
            if (nameCompare !== 0) return nameCompare;

            // Helper to extract numeric value from spec (e.g., "2.5m" -> 2.5)
            const getSpecValue = (spec: string) => {
                const match = spec.match(/([\d.]+)/);
                return match ? parseFloat(match[1]) : 0;
            };

            const valA = getSpecValue(a.spec || '');
            const valB = getSpecValue(b.spec || '');

            // If both extracted values are valid numbers and different, sort by value
            if (valA !== valB && valA > 0 && valB > 0) {
                return valA - valB;
            }

            // Fallback to natural sort
            return (a.spec || '').localeCompare(b.spec || '', undefined, { numeric: true });
        });

        // 10 rows per chunk lets 70 items render as 7 compact columns on one line.
        const chunks: Material[][] = [];
        for (let i = 0; i < items.length; i += ITEMS_PER_COLUMN) {
            chunks.push(items.slice(i, i + ITEMS_PER_COLUMN));
        }
        const accentClasses = getQuantityAccentClasses(colorClass);

        return (
            <div
                className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-6"
                data-material-nav-section="true"
                data-section-index={sectionIndex}
            >
                <div className={`bg-${colorClass}-50/50 px-4 py-3 border-b border-${colorClass}-100 flex justify-between items-center`}>
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <span className={`bg-${colorClass}-500 w-2 h-6 rounded-sm`}></span>
                        {title}
                    </h3>
                    <div className={`text-xs text-${colorClass}-600 font-medium bg-white px-2 py-1 rounded border border-${colorClass}-100`}>
                        {items.length} 품목
                    </div>
                </div>

                <div className="space-y-2 p-2 md:hidden">
                    {(() => {
                        const groupedItems = items.reduce<Array<{ itemName: string; materials: Material[] }>>((groups, material) => {
                            const group = groups.find((candidate) => candidate.itemName === material.itemName);
                            if (group) {
                                group.materials.push(material);
                            } else {
                                groups.push({ itemName: material.itemName, materials: [material] });
                            }
                            return groups;
                        }, []);
                        const itemGroups = groupedItems.map((group) => ({
                            ...group,
                            quantityTotal: group.materials.reduce((sum, material) => sum + (quantities[material.id] || 0), 0),
                        }));
                        const activeItemGroup = itemGroups.find((group) => group.itemName === mobileSelectedItemName)
                            || itemGroups.find((group) => group.quantityTotal > 0)
                            || itemGroups[0];

                        return (
                            <>
                                <div className="rounded-lg border border-red-100 bg-white p-1.5 shadow-sm">
                                    <div className="mb-1 flex items-center justify-between px-0.5">
                                        <div className="text-[10px] font-bold text-slate-500">품목 선택</div>
                                        <div className="text-[10px] font-bold text-red-700">{itemGroups.length}개 품목</div>
                                    </div>
                                    <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                                        {itemGroups.map((group) => {
                                            const active = activeItemGroup?.itemName === group.itemName;
                                            return (
                                                <button
                                                    key={group.itemName}
                                                    type="button"
                                                    onClick={() => setMobileSelectedItemName(group.itemName)}
                                                    className={`rounded-md border px-2 py-1.5 text-left transition ${active
                                                        ? 'border-red-500 bg-red-50 text-red-800 shadow-sm'
                                                        : group.quantityTotal > 0
                                                            ? 'border-red-200 bg-red-50/60 text-red-800'
                                                            : 'border-slate-200 bg-white text-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-bold">{group.itemName}</span>
                                                        {group.quantityTotal > 0 && (
                                                            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                                                {group.quantityTotal}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-medium text-slate-500">{group.materials.length} 규격</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {activeItemGroup && (
                                    <div className={`rounded-lg border p-2.5 shadow-sm ${activeItemGroup.quantityTotal > 0 ? accentClasses.cardActive : 'border-red-200 bg-white'}`}>
                                        <div className="mb-2 flex items-center justify-between rounded-md bg-red-50 px-2 py-2 text-red-900">
                                            <div className="truncate text-base font-bold">{activeItemGroup.itemName}</div>
                                            <div className="shrink-0 text-xs font-bold">{activeItemGroup.materials.length} 규격 / {activeItemGroup.quantityTotal}</div>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-white">
                                            <div className="grid grid-cols-[1fr_0.45fr_0.7fr] border-b border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-500">
                                                <span>규격</span>
                                                <span className="text-center">단위</span>
                                                <span className="text-center">수량</span>
                                            </div>
                                            <div className="max-h-[52vh] overflow-y-auto divide-y divide-slate-100">
                                                {activeItemGroup.materials.map((material) => {
                                                    const qty = quantities[material.id] || 0;
                                                    return (
                                                        <div key={material.id} className={`p-2 ${qty > 0 ? 'bg-red-50/70' : 'bg-white'}`}>
                                                            <div className="grid grid-cols-[1fr_0.45fr_0.7fr] items-center gap-2">
                                                                <div className="truncate text-base font-bold text-slate-800">{material.spec}</div>
                                                                <div className="text-center text-base font-bold text-slate-700">{material.unit}</div>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={qty || ''}
                                                                    onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                                                                    onKeyDown={handleMaterialQuantityInputKeyDown}
                                                                    placeholder="0"
                                                                    className={`h-11 w-full rounded-lg border px-1 text-center text-lg font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${qty > 0
                                                                        ? accentClasses.inputActive
                                                                        : 'border-slate-200 bg-slate-50 text-slate-500 focus:border-red-500 focus:bg-white focus:text-slate-800'
                                                                        }`}
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                            </div>
                                                            <div className="mt-2 grid grid-cols-6 gap-1.5">
                                                                {QUICK_QUANTITY_STEPS.map((step) => (
                                                                    <button
                                                                        key={step}
                                                                        type="button"
                                                                        disabled={step < 0 && qty <= 0}
                                                                        onClick={() => handleQuantityStep(material.id, step)}
                                                                        className={`h-8 rounded-md border text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${step > 0 ? accentClasses.positiveButton : accentClasses.negativeButton}`}
                                                                    >
                                                                        {step > 0 ? `+${step}` : step}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className="hidden overflow-x-auto md:block">
                    <div className={`p-2 grid ${getMaterialChunkGridClass(chunks.length)} gap-1.5 items-start`}>
                        {chunks.map((chunk, chunkIndex) => (
                            <div key={chunkIndex} className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full table-fixed text-[11px] leading-tight">
                                    <colgroup>
                                        <col />
                                        <col className="w-11" />
                                        <col className="w-8" />
                                    </colgroup>
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-1.5 py-1.5 text-left font-bold text-slate-500 uppercase whitespace-nowrap">품명/규격</th>
                                            <th className="px-0.5 py-1.5 text-center font-bold text-slate-500 uppercase whitespace-nowrap">수량</th>
                                            <th className="px-0.5 py-1.5 text-center font-bold text-slate-500 uppercase whitespace-nowrap">단위</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {chunk.map((material, rowIndex) => {
                                            const qty = quantities[material.id] || 0;
                                            return (
                                                <tr key={material.id} className={`transition-colors ${qty > 0 ? `bg-${colorClass}-50` : 'hover:bg-slate-50'}`}>
                                                    <td className="px-1.5 py-1" title={`${material.itemName} ${material.spec}`}>
                                                        <div className="flex min-w-0 items-center gap-0.5 whitespace-nowrap">
                                                            <span className="min-w-0 truncate text-slate-500">{material.itemName}</span>
                                                            <span className="shrink-0 text-slate-300">/</span>
                                                            <span className="shrink-0 font-bold text-slate-700">{material.spec}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-0.5 py-0.5 text-center">
                                                        <input
                                                            type="number"
                                                            value={qty || ''}
                                                            onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                                                            onKeyDown={handleMaterialQuantityInputKeyDown}
                                                            data-material-nav="true"
                                                            data-section-index={sectionIndex}
                                                            data-column-index={chunkIndex}
                                                            data-row-index={rowIndex}
                                                            placeholder="0"
                                                            className={`h-6 w-full border rounded px-0.5 text-center font-bold text-xs transition-all outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${qty > 0
                                                                ? `border-${colorClass}-500 text-${colorClass}-700 bg-white`
                                                                : `border-slate-200 bg-slate-50 text-slate-400 focus:bg-white focus:border-${colorClass}-500 focus:text-slate-800`
                                                                }`}
                                                            onFocus={(e) => e.target.select()}
                                                        />
                                                    </td>
                                                    <td className="px-0.5 py-0.5 text-center text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                        {material.unit}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto min-h-screen w-full max-w-[calc(100vw-30px)] overflow-x-hidden bg-slate-50 p-3 sm:max-w-[2100px] sm:p-6">
            <div className="mb-3 flex items-center justify-between sm:hidden">
                <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                    <FontAwesomeIcon icon={faArrowUp} className="text-red-600" />
                    출고 등록
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-extrabold text-red-700">
                    선택 {selectedItemCount}개 · 총 {selectedQuantityTotal}
                </div>
            </div>
            <div className="mb-4 hidden gap-4 sm:mb-6 sm:flex sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowUp} className="text-red-600" />
                        출고 등록
                    </h1>
                    <p className="text-slate-500 mt-1">시스템 비계(좌) / 시스템 동바리(우) 고정 배치</p>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                    <button
                        onClick={() => navigate('/materials/transactions')}
                        className="justify-center px-3 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition flex items-center gap-2 sm:px-4"
                    >
                        <FontAwesomeIcon icon={faEdit} />
                        수정
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="justify-center px-3 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50 sm:px-4"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="justify-center px-3 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md transition flex items-center gap-2 disabled:opacity-50 sm:px-6"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '출고 완료'}
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
                {/* 기본 정보 입력 */}
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-red-100 bg-red-50/30 p-2 md:grid-cols-2 xl:grid-cols-4 sm:mb-6 sm:gap-4 sm:bg-transparent sm:p-0 sm:border-0">
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">출고일자 *</label>
                        <input
                            type="date"
                            value={transactionDate}
                            onChange={(e) => setTransactionDate(e.target.value)}
                            className="h-10 w-full border border-slate-300 rounded-lg px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">현장명 *</label>
                        <select
                            value={siteId}
                            onChange={(e) => handleSiteChange(e.target.value)}
                            className="h-10 w-full border border-slate-300 rounded-lg bg-white px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        >
                            <option value="">현장 선택</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">차량번호</label>
                        <input
                            type="text"
                            value={vehicleNumber}
                            onChange={(e) => setVehicleNumber(e.target.value)}
                            placeholder="12가3456"
                            className="h-10 w-full border border-slate-300 rounded-lg px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">반출자</label>
                        <input
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder="반출자명"
                            className="h-10 w-full border border-slate-300 rounded-lg px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        />
                    </div>
                </div>

                <div className="mb-5 hidden flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between md:flex">
                    <div className="relative flex-1">
                        <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            placeholder="품명, 규격, 분류 검색"
                            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <div className="rounded-lg border border-red-100 bg-white px-3 py-2 text-center">
                            <div className="text-[11px] font-bold text-slate-400">선택 품목</div>
                            <div className="text-sm font-bold text-red-700">{selectedItemCount}개</div>
                        </div>
                        <div className="rounded-lg border border-red-100 bg-white px-3 py-2 text-center">
                            <div className="text-[11px] font-bold text-slate-400">총 수량</div>
                            <div className="text-sm font-bold text-red-700">{selectedQuantityTotal}</div>
                        </div>
                    </div>
                </div>

                <div className="mb-4 space-y-3 md:hidden">
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            placeholder="품명, 규격 검색"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="mb-2 text-[11px] font-bold text-slate-500">1단계: 분류 선택</div>
                        <div className="grid grid-cols-2 gap-2">
                            {mobileGroupOptions.map((option) => {
                                const active = activeMobileGroup?.key === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setMobileMaterialGroup(option.key)}
                                        className={`rounded-lg border px-3 py-2 text-left transition ${active
                                            ? 'border-red-500 bg-white text-red-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600'
                                            }`}
                                    >
                                        <div className="text-sm font-bold">{option.title}</div>
                                        <div className="mt-0.5 text-xs text-slate-500">{option.items.length} 품목</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">
                        2단계: 품목 선택 후 규격별 수량 입력
                    </div>
                </div>

                {/* 2. Side-by-Side Layout: Scaffolding (Left) | Dongbari (Right) */}
                {/* 2. Vertical Layout: Scaffolding (Row 1) -> Dongbari (Row 2) */}
                <div className="mb-6 md:hidden">
                    {activeMobileGroup
                        ? renderSection(activeMobileGroup.title, activeMobileGroup.items, activeMobileGroup.colorClass, mobileGroupOptions.findIndex((option) => option.key === activeMobileGroup.key))
                        : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                                표시할 자재가 없습니다.
                            </div>
                        )}
                </div>
                <div className="mb-6 hidden flex-col gap-6 md:flex">
                    {/* Row 1: System Scaffolding */}
                    <div className="w-full">
                        {renderSection('시스템 비계', scaffoldingList, 'red', 0)}
                    </div>

                    {/* Row 2: System Dongbari */}
                    <div className="w-full">
                        {renderSection('시스템 동바리', dongbariList, 'red', 1)}
                    </div>

                    {/* Others */}
                    {otherList.length > 0 && (
                        <div className="w-full">
                            {renderSection('기타 및 소모품', otherList, 'slate', 2)}
                        </div>
                    )}
                </div>

                {/* 임시저장 안내 */}
                {hasTempData && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2 sm:items-center">
                                <FontAwesomeIcon icon={faFloppyDisk} className="text-blue-600" />
                                <span className="text-blue-800 font-medium">
                                    임시저장된 데이터가 있습니다. 마지막 저장: {new Date(
                                        JSON.parse(localStorage.getItem('outbound_temp') || '{}').savedAt || Date.now()
                                    ).toLocaleString('ko-KR')}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    if (window.confirm('임시저장된 데이터를 삭제하시겠습니까?')) {
                                        clearTempData();
                                        handleReset();
                                    }
                                }}
                                className="self-end text-blue-600 hover:text-blue-800 transition-colors sm:self-auto"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    </div>
                )}

                {/* 액션 버튼 */}
                <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-6 flex gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:justify-end sm:bg-transparent sm:p-0 sm:pt-6 sm:backdrop-blur-0">
                    <button
                        onClick={() => window.history.back()}
                        className="hidden px-6 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors sm:block"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50 sm:flex-none sm:px-6"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-50 sm:flex-none sm:px-6"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '출고 완료'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialOutboundPage;
