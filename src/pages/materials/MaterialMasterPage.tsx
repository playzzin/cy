import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxesStacked, faPlus, faEdit, faTrash, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import materialService, { buildMaterialBusinessKey } from '../../services/materialService';
import { Material } from '../../types/materials';
import { getMaterialGroupKey, sortMaterialDisplayRows, MaterialGroupKey } from '../../utils/materialOrdering';

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
        if (mainContent && window.matchMedia('(min-width: 1024px)').matches) {
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
            const data = await materialService.getUniqueMaterialsForSelection();
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
            isActive: material.isActive !== false
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
            const formMaterialKey = buildMaterialBusinessKey(formData);
            const isDuplicate = materials.some(
                m => (m.materialKey || buildMaterialBusinessKey(m)) === formMaterialKey &&
                     m.isActive !== false
            );
            if (isDuplicate) {
                alert(`이미 등록된 자재입니다: ${formData.category} / ${formData.itemName} (${formData.spec})`);
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
            await loadData();
        } catch (error) {
            console.error('Failed to save material:', error);
            alert('저장에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (material: Material) => {
        if (!window.confirm(`${material.itemName} (${material.spec})을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            await materialService.deleteMaterial(material);
            alert('삭제되었습니다.');
            await loadData();
        } catch (error) {
            console.error('Failed to delete material:', error);
            alert('삭제에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const groupedMaterials = useMemo(() => {
        const groups: Record<MaterialGroupKey, Material[]> = {
            dongbari: [],
            scaffolding: [],
            other: [],
        };

        filteredMaterials.forEach((material) => {
            groups[getMaterialGroupKey(material)].push(material);
        });

        return {
            dongbari: sortMaterialDisplayRows(groups.dongbari),
            scaffolding: sortMaterialDisplayRows(groups.scaffolding),
            other: sortMaterialDisplayRows(groups.other),
        };
    }, [filteredMaterials]);

    const renderMaterialTable = (rows: Material[], emptyText: string) => (
        rows.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
                {emptyText}
            </div>
        ) : (
            <div className="flex-1 overflow-auto">
                <div className="space-y-2 p-3 md:hidden">
                    {rows.map(material => (
                        <div key={material.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-900">{material.itemName}</div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                                        <span className="font-semibold text-slate-700">{material.spec}</span>
                                        <span>{material.unit}</span>
                                        <span className="truncate">· {material.category}</span>
                                    </div>
                                    {(material.safetyStock || material.description) && (
                                        <div className="mt-2 text-xs text-slate-500">
                                            안전재고 {material.safetyStock || '-'} · {material.description || '설명 없음'}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <button
                                        onClick={() => handleEdit(material)}
                                        className="flex h-9 w-9 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        title="수정"
                                    >
                                        <FontAwesomeIcon icon={faEdit} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(material)}
                                        className="flex h-9 w-9 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                                        title="삭제"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden h-full overflow-auto md:block">
                    <table className="w-full min-w-[760px] text-sm">
                        <colgroup>
                            <col className="w-32" />
                            <col className="w-40" />
                            <col className="w-32" />
                            <col className="w-20" />
                            <col className="w-28" />
                            <col />
                            <col className="w-24" />
                        </colgroup>
                        <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100">
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
                            {rows.map(material => (
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
                                            className="mx-1 text-blue-600 hover:text-blue-800"
                                            title="수정"
                                        >
                                            <FontAwesomeIcon icon={faEdit} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(material)}
                                            className="mx-1 text-red-600 hover:text-red-800"
                                            title="삭제"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    );

    const renderMaterialGroup = (
        title: string,
        rows: Material[],
        accentClass: string,
        emptyText: string
    ) => (
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className={`h-5 w-1.5 rounded-full ${accentClass}`} />
                    {title}
                </h2>
                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                    {rows.length} 품목
                </span>
            </div>
            {renderMaterialTable(rows, emptyText)}
        </section>
    );

    return (
        <div className="flex min-h-0 w-full max-w-[calc(100vw-30px)] flex-1 flex-col overflow-auto bg-slate-50 p-2 sm:max-w-none sm:p-6 lg:overflow-hidden">
            <div className="mb-3 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-2xl">
                        <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
                        자재 마스터 관리
                    </h1>
                    <p className="mt-1 hidden text-slate-500 sm:block">자재 정보를 등록하고 관리합니다</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto sm:py-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    자재 등록
                </button>
            </div>

            {/* 등록/수정 폼 */}
            {showForm && (
                <div className="mb-4 flex-shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">
                        {editingItem ? '자재 수정' : '자재 등록'}
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            onClick={() => setShowForm(false)}
                            className="flex items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-300 sm:py-2"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:py-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            저장
                        </button>
                    </div>
                </div>
            )}

            {/* 필터 및 목록 */}
            <div className="flex min-h-0 flex-1 flex-col overflow-visible rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6 lg:overflow-hidden">
                <div className="mb-4 grid flex-shrink-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <input
                        type="text"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        placeholder="분류 검색..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:py-2"
                    />
                    <input
                        type="text"
                        value={itemNameFilter}
                        onChange={(e) => setItemNameFilter(e.target.value)}
                        placeholder="품명 검색..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:py-2"
                    />
                    <input
                        type="text"
                        value={specFilter}
                        onChange={(e) => setSpecFilter(e.target.value)}
                        placeholder="규격 검색..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:py-2"
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
                    <div className="min-h-0 flex-1 overflow-visible lg:overflow-auto">
                        <div className="grid min-h-full grid-cols-1 gap-4 xl:grid-cols-2">
                            {renderMaterialGroup('동바리', groupedMaterials.dongbari, 'bg-indigo-500', '동바리 자재가 없습니다.')}
                            {renderMaterialGroup('비계', groupedMaterials.scaffolding, 'bg-emerald-500', '비계 자재가 없습니다.')}
                            {groupedMaterials.other.length > 0 && (
                                <div className="min-h-0 xl:col-span-2">
                                    {renderMaterialGroup('기타', groupedMaterials.other, 'bg-slate-400', '기타 자재가 없습니다.')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialMasterPage;
