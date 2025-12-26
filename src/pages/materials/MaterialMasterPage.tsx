import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxesStacked, faPlus, faDownload, faUpload, faEdit, faTrash, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService } from '../../services/siteService';
import { Material } from '../../types/materials';

const MaterialMasterPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [itemNameFilter, setItemNameFilter] = useState('');
    const [specFilter, setSpecFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Material | undefined>(undefined);

    // 폼 상태
    const [formData, setFormData] = useState({
        category: '시스템 동바리' as '시스템 동바리' | '시스템 비계' | '기타',
        itemName: '',
        spec: '',
        unit: 'EA',
        safetyStock: 0,
        description: '',
        isActive: true
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [materials, categoryFilter, itemNameFilter, specFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await materialService.getAllMaterials();
            setMaterials(data);
        } catch (error) {
            console.error('Failed to load materials:', error);
            alert('자재 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...materials];

        if (categoryFilter) {
            result = result.filter(m => m.category === categoryFilter);
        }
        if (itemNameFilter) {
            result = result.filter(m => m.itemName.toLowerCase().includes(itemNameFilter.toLowerCase()));
        }
        if (specFilter) {
            result = result.filter(m => m.spec.toLowerCase().includes(specFilter.toLowerCase()));
        }

        setFilteredMaterials(result);
    };

    const handleAdd = () => {
        setEditingItem(undefined);
        setFormData({
            category: '시스템 동바리',
            itemName: '',
            spec: '',
            unit: 'EA',
            safetyStock: 0,
            description: '',
            isActive: true
        });
        setShowForm(true);
    };

    const handleEdit = (material: Material) => {
        setEditingItem(material);
        setFormData({
            category: material.category,
            itemName: material.itemName,
            spec: material.spec,
            unit: material.unit,
            safetyStock: material.safetyStock || 0,
            description: material.description || '',
            isActive: material.isActive
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.itemName || !formData.spec) {
            alert('품명과 규격은 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            if (editingItem) {
                await materialService.updateMaterial(editingItem.id, formData);
                alert('수정되었습니다.');
            } else {
                await materialService.addMaterial(formData);
                alert('등록되었습니다.');
            }
            setShowForm(false);
            loadData();
        } catch (error) {
            console.error('Failed to save material:', error);
            alert('저장에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string, spec: string) => {
        if (!window.confirm(`${name} (${spec})을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            await materialService.deleteMaterial(id);
            alert('삭제되었습니다.');
            loadData();
        } catch (error) {
            console.error('Failed to delete material:', error);
            alert('삭제에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSeedData = async () => {
        if (!window.confirm('샘플 자재 데이터를 등록하시겠습니까?')) return;

        const sampleMaterials: Array<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>> = [
            // 시스템 동바리
            { category: '시스템 동바리', itemName: '수직재', spec: 'P17', unit: 'EA', safetyStock: 100, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '수직재', spec: 'P15', unit: 'EA', safetyStock: 100, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '수평재', spec: 'H18', unit: 'EA', safetyStock: 50, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '수평재', spec: 'H15', unit: 'EA', safetyStock: 50, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '대각재', spec: 'D12', unit: 'EA', safetyStock: 30, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '받침철물', spec: '하부자키', unit: 'EA', safetyStock: 20, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '부속철물', spec: '5018', unit: 'EA', safetyStock: 50, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '해치', spec: '600x600', unit: 'EA', safetyStock: 10, description: '', isActive: true },
            { category: '시스템 동바리', itemName: '발판', spec: '900x900', unit: 'EA', safetyStock: 30, description: '', isActive: true },

            // 시스템 비계
            { category: '시스템 비계', itemName: '받침철물', spec: '5018', unit: 'EA', safetyStock: 50, description: '', isActive: true },
            { category: '시스템 비계', itemName: '받침철물', spec: '5015', unit: 'EA', safetyStock: 50, description: '', isActive: true },
            { category: '시스템 비계', itemName: '수직재', spec: 'V20', unit: 'EA', safetyStock: 100, description: '', isActive: true },
            { category: '시스템 비계', itemName: '수평재', spec: 'H18', unit: 'EA', safetyStock: 80, description: '', isActive: true },
        ];

        setLoading(true);
        try {
            for (const material of sampleMaterials) {
                await materialService.addMaterial(material);
            }
            alert(`${sampleMaterials.length}개의 샘플 자재가 등록되었습니다.`);
            loadData();
        } catch (error) {
            console.error('Failed to seed data:', error);
            alert('샘플 데이터 등록에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSeedTransactions = async () => {
        if (!window.confirm('샘플 입고 데이터를 등록하시겠습니까?\n(자재 마스터 5개와 샘플 현장이 사용됩니다)')) {
            return;
        }

        setLoading(true);
        try {
            // 자재 목록 조회
            const allMaterials = await materialService.getAllMaterials();

            if (allMaterials.length === 0) {
                alert('먼저 "샘플 자재" 버튼을 눌러 자재 마스터 데이터를 등록하세요.');
                setLoading(false);
                return;
            }

            // 현장 목록 조회
            const sites = await siteService.getSites();
            let activeSites = sites.filter(s => s.status === 'active');
            let sampleSite = activeSites[0];

            // 활성 현장이 없으면 자동 생성
            if (activeSites.length === 0) {
                console.log('활성 현장이 없음. 샘플 현장 자동 생성 중...');
                const newSiteId = await siteService.addSite({
                    name: '샘플 현장 (Automated)',
                    code: 'SAMPLE-001',
                    address: '서울시 강남구 삼성동',
                    status: 'active'
                });

                // 생성된 현장 정보 구성
                sampleSite = {
                    id: newSiteId,
                    name: '샘플 현장 (Automated)',
                    code: 'SAMPLE-001',
                    address: '서울시 강남구 삼성동',
                    status: 'active'
                };
            }

            // 샘플 입고 트랜잭션 생성 (첫 번째 현장, 처음 5개 자재)
            const sampleMaterials = allMaterials.slice(0, Math.min(5, allMaterials.length));

            const transactions = sampleMaterials.map(material => ({
                transactionDate: new Date().toISOString().slice(0, 10),
                siteId: sampleSite.id!, // ID is guaranteed here
                siteName: sampleSite.name,
                vehicleNumber: '테스트차량',
                materialId: material.id,
                category: material.category,
                itemName: material.itemName,
                spec: material.spec,
                quantity: Math.floor(Math.random() * 50) + 10,
                unit: material.unit,
                supplier: '샘플공급업체',
                notes: '샘플 데이터',
                registeredBy: 'system',
                registeredByName: '시스템'
            }));

            await materialService.addInboundTransactionsBatch(transactions as any);

            alert(`✅ ${transactions.length}건의 샘플 입고가 등록되었습니다!\n\n재고 현황 페이지(/materials/inventory)에서 확인하세요.`);
        } catch (error) {
            console.error('샘플 입고 데이터 등록 실패:', error);
            alert(`❌ 샘플 입고 데이터 등록에 실패했습니다.\n\n에러: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-[1800px] mx-auto bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
                        자재 마스터 관리
                    </h1>
                    <p className="text-slate-500 mt-1">자재 정보를 등록하고 관리합니다</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSeedData}
                        disabled={loading}
                        className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faUpload} />
                        샘플 자재
                    </button>
                    <button
                        onClick={handleSeedTransactions}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faUpload} />
                        샘플 입고
                    </button>
                    <button className="bg-white text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition flex items-center gap-2 shadow-sm border border-slate-300">
                        <FontAwesomeIcon icon={faDownload} />
                        Excel 다운로드
                    </button>
                    <button
                        onClick={handleAdd}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        자재 등록
                    </button>
                </div>
            </div>

            {/* 등록/수정 폼 */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">
                        {editingItem ? '자재 수정' : '자재 등록'}
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">분류 *</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            >
                                <option value="시스템 동바리">시스템 동바리</option>
                                <option value="시스템 비계">시스템 비계</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">품명 *</label>
                            <input
                                type="text"
                                value={formData.itemName}
                                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                                placeholder="수직재, 수평재 등"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">규격 *</label>
                            <input
                                type="text"
                                value={formData.spec}
                                onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                                placeholder="P17, H15 등"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">단위</label>
                            <input
                                type="text"
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                placeholder="EA, SET 등"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">안전재고</label>
                            <input
                                type="number"
                                value={formData.safetyStock}
                                onChange={(e) => setFormData({ ...formData, safetyStock: parseInt(e.target.value) || 0 })}
                                placeholder="0"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">설명</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="선택사항"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            onClick={() => setShowForm(false)}
                            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            저장
                        </button>
                    </div>
                </div>
            )}

            {/* 필터 및 목록 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="mb-4 flex gap-4">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="">전체 분류</option>
                        <option value="시스템 동바리">시스템 동바리</option>
                        <option value="시스템 비계">시스템 비계</option>
                        <option value="기타">기타</option>
                    </select>
                    <input
                        type="text"
                        value={itemNameFilter}
                        onChange={(e) => setItemNameFilter(e.target.value)}
                        placeholder="품명 검색..."
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1"
                    />
                    <input
                        type="text"
                        value={specFilter}
                        onChange={(e) => setSpecFilter(e.target.value)}
                        placeholder="규격 검색..."
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40"
                    />
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-400">
                        로딩 중...
                    </div>
                ) : filteredMaterials.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <FontAwesomeIcon icon={faBoxesStacked} className="text-6xl mb-4 text-slate-200" />
                        <p>등록된 자재가 없습니다.</p>
                        <p className="text-sm mt-2">우측 상단의 '자재 등록' 버튼을 눌러 자재를 추가하세요.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 border-b border-slate-300">
                                <tr>
                                    <th className="p-3 text-left font-bold text-slate-700">분류</th>
                                    <th className="p-3 text-left font-bold text-slate-700">품명</th>
                                    <th className="p-3 text-left font-bold text-slate-700">규격</th>
                                    <th className="p-3 text-center font-bold text-slate-700">단위</th>
                                    <th className="p-3 text-right font-bold text-slate-700">안전재고</th>
                                    <th className="p-3 text-left font-bold text-slate-700">설명</th>
                                    <th className="p-3 text-center font-bold text-slate-700">액션</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredMaterials.map(material => (
                                    <tr key={material.id} className="hover:bg-slate-50">
                                        <td className="p-3">{material.category}</td>
                                        <td className="p-3 font-semibold">{material.itemName}</td>
                                        <td className="p-3">{material.spec}</td>
                                        <td className="p-3 text-center">{material.unit}</td>
                                        <td className="p-3 text-right">{material.safetyStock || '-'}</td>
                                        <td className="p-3">{material.description || '-'}</td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => handleEdit(material)}
                                                className="text-blue-600 hover:text-blue-800 mx-1"
                                            >
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(material.id, material.itemName, material.spec)}
                                                className="text-red-600 hover:text-red-800 mx-1"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
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

export default MaterialMasterPage;
