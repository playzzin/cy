import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxesStacked, faPlus, faEdit, faTrash, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
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
        category: '',
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
            result = result.filter(m => m.category.includes(categoryFilter));
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
            category: '',
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
        if (!formData.category || !formData.itemName || !formData.spec) {
            alert('분류, 품명, 규격은 필수입니다.');
            return;
        }

        // 중복 체크 (신규 등록 시에만)
        if (!editingItem) {
            const isDuplicate = materials.some(
                m => m.itemName.trim() === formData.itemName.trim() && 
                     m.spec.trim() === formData.spec.trim() &&
                     m.isActive !== false
            );
            if (isDuplicate) {
                alert(`이미 등록된 자재입니다: ${formData.itemName} (${formData.spec})`);
                return;
            }
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



    return (
        <div className="flex-1 min-h-0 flex flex-col p-6 max-w-[1800px] w-full mx-auto bg-slate-50 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
                        자재 마스터 관리
                    </h1>
                    <p className="text-slate-500 mt-1">자재 정보를 등록하고 관리합니다</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    자재 등록
                </button>
            </div>

            {/* 등록/수정 폼 */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">
                        {editingItem ? '자재 수정' : '자재 등록'}
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">분류 *</label>
                            <input
                                type="text"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                placeholder="분류 입력 (예: 시스템 동바리)"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
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
            <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col overflow-hidden">
                <div className="mb-4 flex gap-4 flex-shrink-0">
                    <input
                        type="text"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        placeholder="분류 검색..."
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
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
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10">
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
