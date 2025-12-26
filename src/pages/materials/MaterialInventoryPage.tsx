import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxes, faSearch, faExclamationTriangle, faCheckCircle, faPlus } from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { Inventory } from '../../types/materials';

const MaterialInventoryPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'sufficient' | 'warning' | 'shortage'>('all');

    const [inventories, setInventories] = useState<Inventory[]>([]);

    useEffect(() => {
        loadInventory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadInventory = async () => {
        setLoading(true);
        console.log('[DEBUG] loadInventory started');
        try {
            const data = await materialService.getAllInventory();
            console.log(`[DEBUG] Received inventory data: ${data.length} items`, data);
            setInventories(data);
        } catch (error) {
            console.error('Failed to load inventory:', error);
            // toast.error('재고 현황을 불러오지 못했습니다.'); // toast가 있다면 사용, 없으면 alert
            // alert('재고 현황을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 통계 계산
    const stats = inventories.reduce((acc, inv) => {
        acc.total++;
        if (inv.status === 'sufficient') acc.sufficient++;
        else if (inv.status === 'warning') acc.warning++;
        else if (inv.status === 'shortage') acc.shortage++;
        return acc;
    }, { total: 0, sufficient: 0, warning: 0, shortage: 0 });

    // 필터링
    const filteredInventories = inventories.filter(inv => {
        if (categoryFilter && inv.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
        return true;
    });

    //  카테고리 목록
    const categories = Array.from(new Set(inventories.map(inv => inv.category)));

    return (
        <div className="p-6 max-w-[1800px] mx-auto bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBoxes} className="text-green-600" />
                        재고 현황
                    </h1>
                    <p className="text-slate-500 mt-1">전체 재고 현황을 확인합니다</p>
                </div>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-slate-500 text-sm">총 자재</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
                        </div>
                        <FontAwesomeIcon icon={faBoxes} className="text-4xl text-slate-300" />
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-slate-500 text-sm">충분</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">{stats.sufficient}</p>
                        </div>
                        <FontAwesomeIcon icon={faCheckCircle} className="text-4xl text-green-200" />
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-slate-500 text-sm">주의</p>
                            <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.warning}</p>
                        </div>
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl text-yellow-200" />
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-slate-500 text-sm">부족</p>
                            <p className="text-3xl font-bold text-red-600 mt-1">{stats.shortage}</p>
                        </div>
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl text-red-200" />
                    </div>
                </div>
            </div>

            {/* 필터 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">분류</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        >
                            <option value="">전체 분류</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">재고 상태</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        >
                            <option value="all">전체</option>
                            <option value="sufficient">충분</option>
                            <option value="warning">주의</option>
                            <option value="shortage">부족</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={loadInventory}
                            disabled={loading}
                            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            {loading ? '조회 중...' : '새로고침'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 재고 테이블 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {loading ? (
                    <div className="text-center py-20">
                        <p className="text-slate-400">로딩 중...</p>
                    </div>
                ) : filteredInventories.length === 0 ? (
                    <div className="text-center py-32 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
                            <FontAwesomeIcon icon={faBoxes} className="text-4xl text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">재고 데이터가 없습니다</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                            아직 등록된 입출고 내역이 없습니다.<br />
                            자재를 입고하거나 출고하면 자동으로 재고가 계산되어 여기에 표시됩니다.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => window.location.href = '/materials/inbound'}
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                입고 등록하기
                            </button>
                            <button
                                onClick={() => window.location.href = '/materials/master'}
                                className="bg-white text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition font-medium shadow-sm border border-slate-200 flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faSearch} />
                                샘플 데이터 생성
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 border-b border-slate-300">
                                <tr>
                                    <th className="p-3 text-left font-bold text-slate-700">분류</th>
                                    <th className="p-3 text-left font-bold text-slate-700">품명</th>
                                    <th className="p-3 text-left font-bold text-slate-700">규격</th>
                                    <th className="p-3 text-right font-bold text-slate-700">입고</th>
                                    <th className="p-3 text-right font-bold text-slate-700">출고</th>
                                    <th className="p-3 text-right font-bold text-slate-700">현재고</th>
                                    <th className="p-3 text-right font-bold text-slate-700">안전재고</th>
                                    <th className="p-3 text-center font-bold text-slate-700">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredInventories.map(inv => (
                                    <tr key={`${inv.materialId}-${inv.siteId}`} className="hover:bg-slate-50">
                                        <td className="p-3">{inv.category}</td>
                                        <td className="p-3 font-semibold">{inv.itemName}</td>
                                        <td className="p-3">{inv.spec}</td>
                                        <td className="p-3 text-right text-blue-600">{inv.totalInbound.toLocaleString()}</td>
                                        <td className="p-3 text-right text-red-600">{inv.totalOutbound.toLocaleString()}</td>
                                        <td className="p-3 text-right font-bold">{inv.currentStock.toLocaleString()}</td>
                                        <td className="p-3 text-right text-slate-500">{inv.safetyStock?.toLocaleString() || '-'}</td>
                                        <td className="p-3 text-center">
                                            {inv.status === 'sufficient' && (
                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                                                    <FontAwesomeIcon icon={faCheckCircle} />
                                                    충분
                                                </span>
                                            )}
                                            {inv.status === 'warning' && (
                                                <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-semibold">
                                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                                    주의
                                                </span>
                                            )}
                                            {inv.status === 'shortage' && (
                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">
                                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                                    부족
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialInventoryPage;
