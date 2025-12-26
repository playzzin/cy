/* Force Re-build: 2025-12-26 11:35 */
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faSave, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { Material, InboundTransaction } from '../../types/materials';
import { useAuth } from '../../contexts/AuthContext';

const MaterialInboundPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
    const [siteId, setSiteId] = useState('');
    const [siteName, setSiteName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [supplier, setSupplier] = useState('');

    const [sites, setSites] = useState<Site[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sitesData, materialsData] = await Promise.all([
                siteService.getSites(),
                materialService.getAllMaterials()
            ]);
            setSites(sitesData.filter(s => s.status === 'active'));
            setMaterials(materialsData);
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

        // 수량이 0보다 큰 항목만 필터링
        const transactions: Array<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>> = [];

        Object.entries(quantities).forEach(([materialId, quantity]) => {
            if (quantity > 0) {
                const material = materials.find(m => m.id === materialId);
                if (material) {
                    transactions.push({
                        transactionDate,
                        siteId,
                        siteName,
                        vehicleNumber: vehicleNumber || '',
                        materialId: material.id,
                        category: material.category,
                        itemName: material.itemName,
                        spec: material.spec,
                        quantity,
                        unit: material.unit,
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
        // 날짜와 현장은 유지 (연속 입력 편의)
    };

    const groupedMaterials = materials.reduce((acc, material) => {
        if (!acc[material.category]) {
            acc[material.category] = [];
        }
        acc[material.category].push(material);
        return acc;
    }, {} as Record<string, Material[]>);

    return (
        <div className="p-6 max-w-[1800px] mx-auto bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowDown} className="text-blue-600" />
                        입고 등록
                    </h1>
                    <p className="text-slate-500 mt-1">자재 입고 내역을 병렬로 확인하고 등록합니다</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {/* 기본 정보 입력 */}
                <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-200">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">입고일자 *</label>
                        <input
                            type="date"
                            value={transactionDate}
                            onChange={(e) => setTransactionDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">현장명 *</label>
                        <select
                            value={siteId}
                            onChange={(e) => handleSiteChange(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        >
                            <option value="">현장 선택</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">차량번호</label>
                        <input
                            type="text"
                            value={vehicleNumber}
                            onChange={(e) => setVehicleNumber(e.target.value)}
                            placeholder="12가3456"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">공급업체</label>
                        <input
                            type="text"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder="공급업체명"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </div>
                </div>

                {/* 자재 입력 (Grid 병렬 배치) */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                    {Object.entries(groupedMaterials).sort().map(([category, categoryMaterials]) => (
                        <div key={category} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <span className="bg-blue-600 w-2 h-6 rounded-sm"></span>
                                    {category}
                                </h3>
                                <div className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded border border-slate-200">
                                    {categoryMaterials.length} 품목
                                </div>
                            </div>

                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-white border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider pl-4">품명/규격</th>
                                            <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-24">수량</th>
                                            <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-16">단위</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {categoryMaterials.map(material => {
                                            const qty = quantities[material.id] || 0;
                                            return (
                                                <tr
                                                    key={material.id}
                                                    className={`transition-colors ${qty > 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="p-3 pl-4">
                                                        <div className="font-bold text-slate-700">{material.itemName}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">{material.spec}</div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={qty || ''}
                                                            onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                                                            placeholder="0"
                                                            className={`w-full border rounded-md px-2 py-1.5 text-center font-bold transition-all focus:ring-2 focus:ring-blue-200 outline-none ${qty > 0
                                                                    ? 'border-blue-500 text-blue-700 bg-white'
                                                                    : 'border-slate-200 bg-slate-50 text-slate-400 focus:bg-white focus:border-blue-500 focus:text-slate-800'
                                                                }`}
                                                            onFocus={(e) => e.target.select()}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center text-xs text-slate-400 font-medium">
                                                        {material.unit}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 액션 버튼 */}
                <div className="flex justify-end gap-2 pt-6 border-t border-slate-200">
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialInboundPage;
