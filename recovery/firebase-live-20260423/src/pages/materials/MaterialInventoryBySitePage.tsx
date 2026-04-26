import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faSearch } from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { Inventory } from '../../types/materials';

const MaterialInventoryBySitePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [siteId, setSiteId] = useState('');
    const [siteName, setSiteName] = useState('');

    const [sites, setSites] = useState<Site[]>([]);
    const [inventories, setInventories] = useState<Inventory[]>([]);

    useEffect(() => {
        loadSites();
    }, []);

    const loadSites = async () => {
        try {
            const data = await siteService.getSites();
            setSites(data.filter(s => s.status === 'active'));
        } catch (error) {
            console.error('Failed to load sites:', error);
        }
    };

    const handleSiteChange = (selectedSiteId: string) => {
        setSiteId(selectedSiteId);
        const site = sites.find(s => s.id === selectedSiteId);
        setSiteName(site?.name || '');
    };

    const handleSearch = async () => {
        if (!siteId) {
            alert('현장을 선택하세요.');
            return;
        }

        setLoading(true);
        try {
            const data = await materialService.getInventoryBySite(siteId);
            setInventories(data);
        } catch (error) {
            console.error('Failed to load inventory:', error);
            alert('재고 현황을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 카테고리별 그룹화
    const groupedInventories = inventories.reduce((acc, inv) => {
        if (!acc[inv.category]) {
            acc[inv.category] = [];
        }
        acc[inv.category].push(inv);
        return acc;
    }, {} as Record<string, Inventory[]>);

    return (
        <div className="p-6 max-w-[2200px] mx-auto bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-indigo-600" />
                        현장별 재고
                    </h1>
                    <p className="text-slate-500 mt-1">현장별 자재 재고를 조회합니다</p>
                </div>
            </div>

            {/* 현장 선택 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">현장 선택 *</label>
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
                    <div className="flex items-end">
                        <button
                            onClick={handleSearch}
                            disabled={loading || !siteId}
                            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            {loading ? '조회 중...' : '조회'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 현장 정보 */}
            {siteName && inventories.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">📍 {siteName}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-blue-600 text-sm font-semibold">총 자재 종류</p>
                            <p className="text-2xl font-bold text-blue-700 mt-1">{inventories.length}개</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-green-600 text-sm font-semibold">총 입고</p>
                            <p className="text-2xl font-bold text-green-700 mt-1">
                                {inventories.reduce((sum, inv) => sum + inv.totalInbound, 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                            <p className="text-red-600 text-sm font-semibold">총 출고</p>
                            <p className="text-2xl font-bold text-red-700 mt-1">
                                {inventories.reduce((sum, inv) => sum + inv.totalOutbound, 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 재고 테이블 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {!siteName ? (
                    <div className="text-center py-20 text-slate-400">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-6xl mb-4 text-slate-200" />
                        <p>현장을 선택하고 조회 버튼을 누르세요.</p>
                    </div>
                ) : loading ? (
                    <div className="text-center py-20">
                        <p className="text-slate-400">로딩 중...</p>
                    </div>
                ) : inventories.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <p>해당 현장의 재고 데이터가 없습니다.</p>
                    </div>
                ) : (
                    <div>
                        {Object.entries(groupedInventories).map(([category, categoryInventories]) => (
                            <div key={category} className="mb-8">
                                <h3 className="text-lg font-bold text-slate-800 mb-3 bg-indigo-50 px-4 py-2 rounded-lg">
                                    🏗️ {category}
                                </h3>
                                <div className="overflow-auto min-h-[720px] max-h-[calc(100vh-240px)]">
                                    <table className="w-full min-w-[1080px] text-sm">
                                        <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 text-left font-bold text-slate-700 sticky left-0 z-10 bg-slate-100 min-w-[220px]">품명</th>
                                                <th className="p-3 text-left font-bold text-slate-700 sticky left-[220px] z-10 bg-slate-100 min-w-[180px]">규격</th>
                                                <th className="p-3 text-right font-bold text-slate-700">입고</th>
                                                <th className="p-3 text-right font-bold text-slate-700">출고</th>
                                                <th className="p-3 text-right font-bold text-slate-700 bg-green-50">현재고</th>
                                                <th className="p-3 text-center font-bold text-slate-700">단위</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {categoryInventories.map(inv => (
                                                <tr key={inv.materialId} className="hover:bg-slate-50">
                                                    <td className="p-3 sticky left-0 z-10 bg-white font-semibold">{inv.itemName}</td>
                                                    <td className="p-3 sticky left-[220px] z-10 bg-white">{inv.spec}</td>
                                                    <td className="p-3 text-right text-blue-600">{inv.totalInbound.toLocaleString()}</td>
                                                    <td className="p-3 text-right text-red-600">{inv.totalOutbound.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-bold text-lg">{inv.currentStock.toLocaleString()}</td>
                                                    <td className="p-3 text-center text-slate-500">{inv.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialInventoryBySitePage;
