/* Force Re-build: 2025-12-26 11:45 - Fixed Split Layout */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faSave, faRotateRight, faFloppyDisk, faTrash, faEdit, faSearch } from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { Material, InboundTransaction } from '../../types/materials';
import { useAuth } from '../../contexts/AuthContext';
import { filterCheongyeonMaterialSites } from './materialSiteFilters';
import { handleMaterialQuantityInputKeyDown } from './materialKeyboardNavigation';

// 임시저장 데이터 타입
type InboundTempData = {
    transactionDate: string;
    siteId: string;
    siteName: string;
    vehicleNumber: string;
    supplier: string;
    quantities: Record<string, number>;
    savedAt: number;
};

const ITEMS_PER_COLUMN = 10;

const getMaterialChunkGridClass = (chunkCount: number) => {
    if (chunkCount >= 7) return 'grid-cols-7 min-w-[1330px]';
    if (chunkCount === 6) return 'grid-cols-6 min-w-[1140px]';
    if (chunkCount === 5) return 'grid-cols-5 min-w-[950px]';
    if (chunkCount === 4) return 'grid-cols-4 min-w-[760px]';
    if (chunkCount === 3) return 'grid-cols-3 min-w-[570px]';
    if (chunkCount === 2) return 'grid-cols-2 min-w-[380px]';
    return 'grid-cols-1 min-w-[190px]';
};

const MaterialInboundPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
    const [siteId, setSiteId] = useState('');
    const [siteName, setSiteName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [searchFilter, setSearchFilter] = useState('');

    const [sites, setSites] = useState<Site[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [hasTempData, setHasTempData] = useState(false);

    // 임시저장 데이터 로드
    const loadTempData = () => {
        try {
            const tempDataStr = localStorage.getItem('inbound_temp');
            if (!tempDataStr) return;

            const tempData: InboundTempData = JSON.parse(tempDataStr);

            // 24시간 이상 된 데이터는 정리
            const now = Date.now();
            if (now - tempData.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('inbound_temp');
                return;
            }

            // 데이터 복원
            setTransactionDate(tempData.transactionDate);
            setSiteId(tempData.siteId);
            setSiteName(tempData.siteName);
            setVehicleNumber(tempData.vehicleNumber);
            setSupplier(tempData.supplier);
            setQuantities(tempData.quantities || {});
            setHasTempData(true);

            // Ref도 즉시 동기화 (Strict Mode 대응)
            stateRef.current = {
                transactionDate: tempData.transactionDate,
                siteId: tempData.siteId,
                siteName: tempData.siteName,
                vehicleNumber: tempData.vehicleNumber,
                supplier: tempData.supplier,
                quantities: tempData.quantities || {}
            };

            console.log('[Inbound] 임시저장 데이터를 복원했습니다:', tempData);
        } catch (error) {
            console.error('[Inbound] 임시저장 데이터 로드 실패:', error);
            localStorage.removeItem('inbound_temp');
        }
    };

    // 임시저장 데이터 저장
    const saveTempData = () => {
        try {
            const tempData: InboundTempData = {
                transactionDate,
                siteId,
                siteName,
                vehicleNumber,
                supplier,
                quantities,
                savedAt: Date.now()
            };
            localStorage.setItem('inbound_temp', JSON.stringify(tempData));
            setHasTempData(true);
        } catch (error) {
            console.error('[Inbound] 임시저장 데이터 저장 실패:', error);
        }
    };

    // 임시저장 데이터 삭제
    const clearTempData = () => {
        localStorage.removeItem('inbound_temp');
        setHasTempData(false);
    };

    // 최신 상태를 추적하기 위한 Ref
    const stateRef = React.useRef({
        transactionDate,
        siteId,
        siteName,
        vehicleNumber,
        supplier,
        quantities
    });

    // 렌더링마다 Ref 업데이트
    useEffect(() => {
        stateRef.current = {
            transactionDate,
            siteId,
            siteName,
            vehicleNumber,
            supplier,
            quantities
        };
    }, [transactionDate, siteId, siteName, vehicleNumber, supplier, quantities]);

    // 실제 저장 로직 (Ref 기준)
    const performSave = () => {
        try {
            const current = stateRef.current;
            const tempData: InboundTempData = {
                transactionDate: current.transactionDate,
                siteId: current.siteId,
                siteName: current.siteName,
                vehicleNumber: current.vehicleNumber,
                supplier: current.supplier,
                quantities: current.quantities,
                savedAt: Date.now()
            };
            localStorage.setItem('inbound_temp', JSON.stringify(tempData));
            setHasTempData(true);
            console.log('[Inbound] Auto-saved data:', tempData);
        } catch (error) {
            console.error('[Inbound] Temp save failed:', error);
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

    // 자동 저장 (Debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            performSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [transactionDate, siteId, siteName, vehicleNumber, supplier, quantities]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sitesData, materialsData] = await Promise.all([
                siteService.getSites(),
                materialService.getUniqueMaterialsForSelection()
            ]);
            setSites(filterCheongyeonMaterialSites(sitesData));
            setMaterials(materialsData);

            // [FIX] 만약 이미 quantities에 데이터가 있다면 (임시저장 등),
            // 새로 불러온 자재 목록에 존재하는 ID들만 남기고 유지합니다.
            setQuantities((prev) => {
                const validIds = new Set(materialsData.map((m) => m.id));
                const filteredEntries = Object.entries(prev).filter(([id]) => validIds.has(id));
                // 만약 prev가 비어있고 임시저장 데이터 로드가 아직 안됐다면 빈 객체 유지
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
        const numValue = parseInt(value) || 0;
        setQuantities(prev => ({
            ...prev,
            [materialId]: numValue
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

        const transactions: Array<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>> = [];

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
                        supplier: supplier || '',
                        notes: '',
                        registeredBy: currentUser?.uid || '',
                        registeredByName: currentUser?.displayName || currentUser?.email || '관리자'
                    });
                }
            }
        });

        if (transactions.length === 0) {
            alert('입고할 자재를 입력하세요.');
            return;
        }

        setLoading(true);
        try {
            await materialService.addInboundTransactionsBatch(transactions);
            alert(`${transactions.length}건의 입고가 등록되었습니다.`);
            // 저장 성공 후 임시저장 데이터 삭제
            clearTempData();
            handleReset();
        } catch (error) {
            console.error('Failed to save inbound transactions:', error);
            alert('입고 등록에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setQuantities({});
        setVehicleNumber('');
        setSupplier('');
        // 리셋 시 임시저장 데이터도 삭제
        clearTempData();
    };



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

        // 1. Right Column: SCAFFOLDING (비계)
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

    // Helper to render a "Section" (Card)
    const renderSection = (title: string, items: Material[], colorClass = 'blue', sectionIndex = 0) => {
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

        return (
            <div
                className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-6 h-full"
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

                <div className="overflow-x-auto">
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

    if (loading) return <div className="p-8 text-center">데이터 로딩 중...</div>;

    return (
        <div className="max-w-[2100px] mx-auto p-4 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowDown} className="text-blue-600" />
                        입고 등록 (Inbound)
                    </h1>
                    <p className="text-slate-500 mt-1">시스템 비계(좌) / 시스템 동바리(우) 고정 배치</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => navigate('/materials/transactions')}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faEdit} />
                        수정
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '입고 완료'}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                {/* 1. 기본 정보 입력 (날짜, 현장, 차량번호, 공급업체) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">입고 일자</label>
                        <input
                            type="date"
                            value={transactionDate}
                            onChange={(e) => setTransactionDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">현장 선택</label>
                        <select
                            value={siteId}
                            onChange={(e) => handleSiteChange(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm bg-white"
                        >
                            <option value="">현장을 선택하세요</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">차량번호</label>
                        <input
                            type="text"
                            value={vehicleNumber}
                            onChange={(e) => setVehicleNumber(e.target.value)}
                            placeholder="12가3456"
                            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-600">공급업체</label>
                        <input
                            type="text"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder="공급업체명"
                            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>


                {/* 2. Side-by-Side Layout: Scaffolding (Left) | Dongbari (Right) */}
                {/* 2. Vertical Layout: Scaffolding (Row 1) -> Dongbari (Row 2) */}
                <div className="flex flex-col gap-6 mb-6">
                    {/* Row 1: System Scaffolding */}
                    <div className="w-full">
                        {renderSection('시스템 비계', scaffoldingList, 'blue', 0)}
                    </div>

                    {/* Row 2: System Dongbari */}
                    <div className="w-full">
                        {renderSection('시스템 동바리', dongbariList, 'blue', 1)}
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
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faFloppyDisk} className="text-blue-600" />
                                <span className="text-blue-800 font-medium">
                                    임시저장된 데이터가 있습니다. 마지막 저장: {new Date(
                                        JSON.parse(localStorage.getItem('inbound_temp') || '{}').savedAt || Date.now()
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
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {loading ? '저장 중...' : '입고 완료'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialInboundPage;
