import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClipboardList,
    faSearch,
    faDownload,
    faTruck,
    faArrowRight,
    faArrowLeft,
    faFilter,
    faEdit,
    faTrash,
    faTimes,
    faSave
} from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { InboundTransaction, Material, OutboundTransaction } from '../../types/materials';
import * as XLSX from 'xlsx';
import { createSiteIdSet, filterCheongyeonMaterialSites } from './materialSiteFilters';

type Transaction = (InboundTransaction | OutboundTransaction) & { type: 'inbound' | 'outbound' };

const MaterialTransactionsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [siteId, setSiteId] = useState('');
    const [siteKeyword, setSiteKeyword] = useState('');
    const [transactionType, setTransactionType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [materialName, setMaterialName] = useState('');

    // Edit State
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        transactionDate: '',
        siteId: '',
        vehicleNumber: '',
        quantity: 0,
        notes: ''
    });

    const normalizeDateInput = (value: string): string => {
        const digits = String(value ?? '').replace(/[^\d]/g, '').slice(0, 8);
        if (digits.length <= 4) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    };

    const isValidDateText = (value: string): boolean => {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim());
    };

    const trimText = (value: unknown): string => String(value ?? '').trim();
    const normalizeSearchText = (value: unknown): string => trimText(value).replace(/\s+/g, '').toLowerCase();

    useEffect(() => {
        loadMasterData();
        handleSearch();
    }, []);

    // Lock main content scroll
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);

    const loadMasterData = async () => {
        try {
            const [siteRows, materialRows] = await Promise.all([
                siteService.getSites(),
                materialService.getUniqueMaterialsForSelection(),
            ]);
            setSites(filterCheongyeonMaterialSites(siteRows));
            setMaterials(materialRows);
        } catch (error) {
            console.error('Failed to load transaction master data:', error);
        }
    };

    const filteredSites = sites.filter((site) => {
        if (!siteKeyword.trim()) return true;
        return normalizeSearchText(site.name).includes(normalizeSearchText(siteKeyword));
    });

    const handleSearch = async () => {
        if (!isValidDateText(startDate) || !isValidDateText(endDate)) {
            alert('날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
            return;
        }

        setLoading(true);
        try {
            let fetchedInbound: InboundTransaction[] = [];
            let fetchedOutbound: OutboundTransaction[] = [];

            const filters = {
                startDate,
                endDate,
                siteId: siteId || undefined,
                vehicleNumber: vehicleNumber || undefined,
            };

            if (transactionType === 'all' || transactionType === 'inbound') {
                fetchedInbound = await materialService.getInboundTransactions(filters);
            }
            if (transactionType === 'all' || transactionType === 'outbound') {
                fetchedOutbound = await materialService.getOutboundTransactions(filters);
            }

            // Merge and Tag
            const labeledInbound = fetchedInbound.map(t => ({ ...t, type: 'inbound' as const }));
            const labeledOutbound = fetchedOutbound.map(t => ({ ...t, type: 'outbound' as const }));

            const allowedSiteIds = createSiteIdSet(sites);
            let all = [...labeledInbound, ...labeledOutbound].filter((tx) => allowedSiteIds.has(tx.siteId));

            // Client-side filtering for Material Name
            if (materialName) {
                all = all.filter(t => t.itemName.includes(materialName) || t.spec?.includes(materialName));
            }

            // Sort by Date DESC
            all.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

            const materialById = new Map(
                materials.flatMap((m) => [
                    [m.id, m],
                    ...(m.materialKey ? [[m.materialKey, m] as const] : []),
                ])
            );
            const normalized = all.map((t) => {
                const master = materialById.get(t.materialId) || materialById.get(t.materialKey || '');
                return {
                    ...t,
                    materialKey: t.materialKey || master?.materialKey,
                    category: trimText(master?.category) || trimText(t.category),
                    itemName: trimText(master?.itemName) || trimText(t.itemName),
                    spec: trimText(master?.spec) || trimText(t.spec),
                    unit: trimText(master?.unit) || trimText(t.unit),
                };
            });

            setTransactions(normalized);
        } catch (error) {
            console.error('Failed to search transactions:', error);
            alert('데이터를 조회하는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (tx: Transaction) => {
        if (!window.confirm(`${tx.transactionDate} ${tx.itemName} 내역을 삭제하시겠습니까?`)) return;

        try {
            if (tx.type === 'inbound') {
                await materialService.deleteInboundTransaction(tx.id);
            } else {
                await materialService.deleteOutboundTransaction(tx.id);
            }
            alert('삭제되었습니다.');
            handleSearch(); // Refresh list
        } catch (error) {
            console.error('Deletion failed:', error);
            alert('삭제에 실패했습니다.');
        }
    };

    const openEditModal = (tx: Transaction) => {
        setEditingTx(tx);
        setEditForm({
            transactionDate: tx.transactionDate,
            siteId: tx.siteId,
            vehicleNumber: tx.vehicleNumber || '',
            quantity: tx.quantity,
            notes: tx.notes || ''
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingTx) return;
        if (!isValidDateText(editForm.transactionDate)) {
            alert('일자는 YYYY-MM-DD 형식으로 입력해 주세요.');
            return;
        }

        try {
            const updates = {
                transactionDate: editForm.transactionDate,
                siteId: editForm.siteId,
                siteName: sites.find(s => s.id === editForm.siteId)?.name || '',
                vehicleNumber: editForm.vehicleNumber,
                quantity: Number(editForm.quantity),
                notes: editForm.notes
            };

            if (editingTx.type === 'inbound') {
                await materialService.updateInboundTransaction(editingTx.id, updates);
            } else {
                await materialService.updateOutboundTransaction(editingTx.id, updates);
            }

            alert('수정되었습니다.');
            setIsEditModalOpen(false);
            setEditingTx(null);
            handleSearch(); // Refresh list
        } catch (error) {
            console.error('Update failed:', error);
            alert('수정에 실패했습니다.');
        }
    };

    const handleDownloadExcel = () => {
        const data = visibleTransactions.map(t => ({
            '일자': t.transactionDate,
            '구분': t.type === 'inbound' ? '입고' : '출고',
            '현장': t.siteName,
            '품명': t.itemName,
            '규격': t.spec,
            '수량': t.quantity,
            '단위': t.unit,
            '차량번호': t.vehicleNumber || '-',
            '담당자': t.registeredByName,
            '비고': t.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "입출고내역");
        XLSX.writeFile(wb, `자재입출고내역_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const visibleTransactions = transactions.filter((t) => {
        if (!siteKeyword.trim()) return true;
        return normalizeSearchText(t.siteName).includes(normalizeSearchText(siteKeyword));
    });

    return (
        <div className="flex-1 min-h-0 flex flex-col p-6 max-w-[2200px] w-full mx-auto bg-slate-50 overflow-hidden font-sans">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" />
                        자재 입출고 내역
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">기간별, 차량별, 현장별 자재 이동 내역을 조회합니다.</p>
                </div>
                <button
                    onClick={handleDownloadExcel}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm font-medium"
                >
                    <FontAwesomeIcon icon={faDownload} />
                    Excel 다운로드
                </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex-shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">시작일</label>
                        <input
                            type="text"
                            value={startDate}
                            onChange={(e) => setStartDate(normalizeDateInput(e.target.value))}
                            onBlur={(e) => setStartDate(normalizeDateInput(e.target.value))}
                            placeholder="YYYY-MM-DD"
                            inputMode="numeric"
                            autoComplete="off"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">종료일</label>
                        <input
                            type="text"
                            value={endDate}
                            onChange={(e) => setEndDate(normalizeDateInput(e.target.value))}
                            onBlur={(e) => setEndDate(normalizeDateInput(e.target.value))}
                            placeholder="YYYY-MM-DD"
                            inputMode="numeric"
                            autoComplete="off"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">현장</label>
                        <select
                            value={siteId}
                            onChange={(e) => setSiteId(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            <option value="">전체 현장</option>
                            {filteredSites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">현장명 검색</label>
                        <input
                            type="text"
                            value={siteKeyword}
                            onChange={(e) => setSiteKeyword(e.target.value)}
                            placeholder="현장명 포함 검색"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">구분</label>
                        <select
                            value={transactionType}
                            onChange={(e) => setTransactionType(e.target.value as any)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            <option value="all">전체</option>
                            <option value="inbound">입고 (In)</option>
                            <option value="outbound">출고 (Out)</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">차량번호</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value)}
                                placeholder="차량번호 (예: 12가3456)"
                                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                            <FontAwesomeIcon icon={faTruck} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        </div>
                    </div>
                    <div className="md:col-span-1 flex gap-2">
                        <button
                            onClick={handleSearch}
                            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto min-h-[780px] max-h-[calc(100vh-220px)]">
                    <table className="w-full min-w-[1680px] text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-left font-bold text-slate-600 w-32 sticky left-0 z-20 bg-slate-50">일자</th>
                                <th className="p-4 text-center font-bold text-slate-600 w-24 sticky left-[128px] z-20 bg-slate-50">구분</th>
                                <th className="p-4 text-left font-bold text-slate-600 min-w-[220px] sticky left-[224px] z-20 bg-slate-50">현장</th>
                                <th className="p-4 text-left font-bold text-slate-600 min-w-[220px] sticky left-[444px] z-20 bg-slate-50">품명</th>
                                <th className="p-4 text-left font-bold text-slate-600 min-w-[180px]">규격</th>
                                <th className="p-4 text-right font-bold text-slate-600 w-24">수량</th>
                                <th className="p-4 text-left font-bold text-slate-600 w-20">단위</th>
                                <th className="p-4 text-left font-bold text-slate-600 min-w-[160px]">차량번호</th>
                                <th className="p-4 text-left font-bold text-slate-600 min-w-[120px]">등록자</th>
                                <th className="p-4 text-left font-bold text-slate-600 min-w-[220px]">비고</th>
                                <th className="p-4 text-center font-bold text-slate-600 w-24">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="p-20 text-center text-slate-400">
                                        <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"></div>
                                        <p>데이터를 불러오는 중입니다...</p>
                                    </td>
                                </tr>
                            ) : visibleTransactions.length > 0 ? (
                                visibleTransactions.map((t, index) => (
                                    <tr key={`${t.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-600 sticky left-0 z-10 bg-white">{t.transactionDate}</td>
                                        <td className="p-4 text-center sticky left-[128px] z-10 bg-white">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5
                                                ${t.type === 'inbound'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : 'bg-orange-50 text-orange-700 border border-orange-100'
                                                }`}
                                            >
                                                <FontAwesomeIcon icon={t.type === 'inbound' ? faArrowRight : faArrowLeft} />
                                                {t.type === 'inbound' ? '입고' : '출고'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-medium text-slate-800 sticky left-[224px] z-10 bg-white">{t.siteName}</td>
                                        <td className="p-4 font-medium text-slate-800 sticky left-[444px] z-10 bg-white">{t.itemName}</td>
                                        <td className="p-4 text-slate-500">{t.spec}</td>
                                        <td className={`p-4 text-right font-bold ${t.type === 'inbound' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                            {t.quantity.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-slate-500">{t.unit}</td>
                                        <td className="p-4 text-slate-600">
                                            {(t.vehicleNumber != null && String(t.vehicleNumber).trim()) ? (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">
                                                    {String(t.vehicleNumber).trim()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-500 text-xs">{t.registeredByName}</td>
                                        <td className="p-4 text-slate-500 whitespace-pre-wrap break-words">{t.notes || '-'}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition"
                                                    title="수정"
                                                >
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(t)}
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition"
                                                    title="삭제"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={11} className="p-24 text-center text-slate-400">
                                        <div className="bg-slate-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                            <FontAwesomeIcon icon={faFilter} className="text-3xl text-slate-300" />
                                        </div>
                                        <p className="text-lg font-medium text-slate-600 mb-1">조회된 내역이 없습니다</p>
                                        <p className="text-sm">검색 조건을 변경하여 다시 조회해보세요.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 text-xs text-slate-400 flex justify-end">
                    Total {visibleTransactions.length} records found
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FontAwesomeIcon icon={faEdit} />
                                {editingTx?.type === 'inbound' ? '입고 내역 수정' : '출고 내역 수정'}
                            </h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-white/80 hover:text-white transition"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                                    <p className="text-sm text-slate-500 mb-1">수정 대상 자재</p>
                                    <p className="font-bold text-slate-800">{editingTx?.itemName}</p>
                                    <p className="text-xs text-slate-500">{editingTx?.spec} ({editingTx?.unit})</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">일자</label>
                                        <input
                                            type="text"
                                            value={editForm.transactionDate}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, transactionDate: normalizeDateInput(e.target.value) }))}
                                            onBlur={(e) => setEditForm(prev => ({ ...prev, transactionDate: normalizeDateInput(e.target.value) }))}
                                            placeholder="YYYY-MM-DD"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">수량</label>
                                        <input
                                            type="number"
                                            value={editForm.quantity}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">현장</label>
                                    <select
                                        value={editForm.siteId}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, siteId: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    >
                                        {sites.map(site => (
                                            <option key={site.id} value={site.id}>{site.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">차량번호</label>
                                    <input
                                        type="text"
                                        value={editForm.vehicleNumber}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                                        placeholder="차량번호 입력"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">비고</label>
                                    <input
                                        type="text"
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="비고 입력"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialTransactionsPage;
