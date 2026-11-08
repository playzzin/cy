import './MaterialWorkspace.css';
import { useMaterialAdministration } from '../../hooks/useMaterialAdministration';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxesStacked, faPlus, faEdit, faTrash, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import materialService, { buildMaterialBusinessKey } from '../../services/materialService';
import { Material } from '../../types/materials';
import { sortMaterialDisplayRows } from '../../utils/materialOrdering';
import { getMaterialMasterCategory, getMaterialMasterDisplayGroupKey, MATERIAL_MASTER_CATEGORIES, MaterialMasterDisplayGroupKey } from './materialMasterGrouping';

const MATERIAL_GROUPS: Array<{ key: MaterialMasterDisplayGroupKey; title: string; accent: string }> = [
    { key: 'dongbari', title: '동바리', accent: 'bg-indigo-500' },
    { key: 'scaffolding', title: '비계', accent: 'bg-emerald-500' },
    { key: 'other', title: '기타', accent: 'bg-slate-400' },
];

const MATERIAL_FIELDS = { category: '분류', itemName: '품명', spec: '규격', unit: '단위' } as const;
type MaterialField = keyof typeof MATERIAL_FIELDS;

const getMaterialErrorMessage = (error: unknown, fallback: string): string => {
    if ((error as { code?: string })?.code === 'permission-denied') {
        return '자재를 변경할 권한이 없습니다. 로그인 계정의 권한을 확인해 주세요.';
    }
    return error instanceof Error ? error.message : fallback;
};

const MaterialMasterPage: React.FC = () => {
    const canManageCatalog = useMaterialAdministration();
    const [loading, setLoading] = useState(false);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
    const [groupFilter, setGroupFilter] = useState<MaterialMasterDisplayGroupKey | ''>('');
    const [itemNameFilter, setItemNameFilter] = useState('');
    const [specFilter, setSpecFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Material | undefined>(undefined);
    const [customItemName, setCustomItemName] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const savingRef = useRef(false);
    const itemNameRef = useRef<HTMLInputElement>(null);
    const specRef = useRef<HTMLInputElement>(null);
    const inlineRowRef = useRef<HTMLElement | null>(null);
    const inlineFieldRef = useRef<MaterialField>('itemName');

    // 폼 상태
    const [formData, setFormData] = useState({
        category: '동바리',
        itemName: '',
        spec: '',
        unit: 'EA',
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
    }, [materials, groupFilter, itemNameFilter, specFilter]);

    useEffect(() => {
        if (showForm) specRef.current?.focus();
    }, [showForm]);

    useEffect(() => {
        if (editingItem) focusInlineField(inlineFieldRef.current);
    }, [editingItem]);

    const focusInlineField = (field: MaterialField) => {
        const input = inlineRowRef.current?.querySelector<HTMLInputElement>(`input[data-inline-field="${field}"]`)
            || inlineRowRef.current?.querySelector<HTMLSelectElement>(`select[data-inline-field="${field}"]`);
        input?.focus();
        if (input instanceof HTMLInputElement) input.select();
    };

    const focusField = (field: 'itemName' | 'spec') => {
        if (editingItem) focusInlineField(field);
        else (field === 'itemName' ? itemNameRef : specRef).current?.focus();
    };

    const categoryMaterials = useMemo(() => materials.filter(material =>
        getMaterialMasterCategory(material) === formData.category
    ), [materials, formData.category]);
    const itemNameOptions = Array.from(new Set(categoryMaterials.map(material => material.itemName)));
    // Keep the current name available when only its category is being changed.
    const inlineItemNameOptions = Array.from(new Set([formData.itemName, ...itemNameOptions]
        .filter(name => name.trim()))).sort((a, b) => a.localeCompare(b, 'ko'));
    const specOptions = Array.from(new Set(categoryMaterials
        .filter(material => material.itemName === formData.itemName.trim())
        .map(material => material.spec)));

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

        if (groupFilter) {
            result = result.filter(m => getMaterialMasterDisplayGroupKey(m) === groupFilter);
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
        if (savingRef.current || editingItem) return;
        setEditingItem(undefined);
        setFormError('');
        setStatusMessage('');
        setFormData({
            category: groupFilter ? MATERIAL_MASTER_CATEGORIES[groupFilter] : '동바리',
            itemName: '',
            spec: '',
            unit: 'EA',
            isActive: true
        });
        setShowForm(true);
    };

    const handleEdit = (material: Material, field: MaterialField, target: HTMLElement) => {
        if (savingRef.current || editingItem || showForm || !canManageCatalog) return;
        inlineRowRef.current = target.closest<HTMLElement>('[data-material-row]');
        inlineFieldRef.current = field;
        setEditingItem(material);
        setCustomItemName(false);
        setFormError('');
        setStatusMessage('');
        setFormData({
            category: getMaterialMasterCategory(material),
            itemName: material.itemName,
            spec: material.spec,
            unit: material.unit,
            isActive: material.isActive !== false
        });
        setShowForm(false);
    };

    const handleCancelEdit = () => {
        if (savingRef.current) return;
        const row = inlineRowRef.current;
        setEditingItem(undefined);
        setFormError('');
        requestAnimationFrame(() => row?.querySelector<HTMLButtonElement>('button[data-inline-trigger]')?.focus());
    };

    const handleInlineKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (!editingItem || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            handleCancelEdit();
        } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            void handleSave();
        }
    };

    const handleSave = async (keepAdding = false) => {
        if (savingRef.current || !canManageCatalog) return;
        const payload = {
            ...formData,
            itemName: formData.itemName.trim(),
            spec: formData.spec.trim(),
            unit: formData.unit.trim() || 'EA',
        };
        setFormError('');
        setStatusMessage('');
        if (!payload.spec) {
            setFormError('규격을 입력해 주세요.');
            focusField('spec');
            return;
        }

        const formMaterialKey = buildMaterialBusinessKey(payload);
        const identityChanged = !editingItem || formMaterialKey !== buildMaterialBusinessKey({
            ...editingItem, category: getMaterialMasterCategory(editingItem),
        });
        const isDuplicate = identityChanged && materials.some(material =>
            material.id !== editingItem?.id && material.isActive !== false &&
            buildMaterialBusinessKey({ ...material, category: getMaterialMasterCategory(material) }) === formMaterialKey
        );
        if (isDuplicate) {
            setFormError(`이미 등록된 자재입니다: ${payload.category} / ${payload.itemName} (${payload.spec})`);
            focusField('spec');
            return;
        }

        savingRef.current = true;
        setSaving(true);
        try {
            if (editingItem) {
                // A display-only category mapping must not rewrite legacy business keys.
                const updates = {
                    ...payload,
                    category: payload.category === getMaterialMasterCategory(editingItem)
                        ? editingItem.category : payload.category,
                };
                await materialService.updateMaterial(editingItem.id, updates);
                setMaterials(previous => previous.map(material => material.id === editingItem.id
                    ? { ...material, ...updates, materialKey: buildMaterialBusinessKey(updates) } : material));
            } else {
                const id = await materialService.addMaterial(payload);
                setMaterials(previous => [...previous, { ...payload, id }]);
            }
            setStatusMessage(`${payload.itemName} (${payload.spec}) ${editingItem ? '수정' : '등록'}되었습니다.`);
            if (keepAdding && !editingItem) {
                setFormData({ ...payload, spec: '' });
            } else {
                setShowForm(false);
                setEditingItem(undefined);
            }
            await loadData();
        } catch (error) {
            console.error('Failed to save material:', error);
            setFormError(getMaterialErrorMessage(error, '저장에 실패했습니다.'));
        } finally {
            savingRef.current = false;
            setSaving(false);
            if (keepAdding && !editingItem) requestAnimationFrame(() => specRef.current?.focus());
        }
    };

    const handleDelete = async (material: Material) => {
        if (savingRef.current || editingItem || showForm) return;
        if (!window.confirm(`${material.itemName} (${material.spec})을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            await materialService.deleteMaterial(material);
            alert('삭제되었습니다.');
            await loadData();
        } catch (error) {
            console.error('Failed to delete material:', error);
            alert(getMaterialErrorMessage(error, '삭제에 실패했습니다.'));
        } finally {
            setLoading(false);
        }
    };

    const groupedMaterials = useMemo(() => {
        const groups: Record<MaterialMasterDisplayGroupKey, Material[]> = {
            dongbari: [],
            scaffolding: [],
            other: [],
        };

        filteredMaterials.forEach((material) => {
            groups[getMaterialMasterDisplayGroupKey(material)].push(material);
        });

        return {
            dongbari: sortMaterialDisplayRows(groups.dongbari),
            scaffolding: sortMaterialDisplayRows(groups.scaffolding),
            other: sortMaterialDisplayRows(groups.other),
        };
    }, [filteredMaterials]);

    const renderInlineField = (field: MaterialField) => {
        const props = {
            'aria-label': MATERIAL_FIELDS[field],
            'data-inline-field': field,
            value: formData[field],
            disabled: saving,
            className: 'w-full min-w-0 rounded-md border border-indigo-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60',
            onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
                inlineRowRef.current = event.currentTarget.closest<HTMLElement>('[data-material-row]');
            },
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
                const value = event.target.value;
                setFormData(previous => ({ ...previous, [field]: value }));
                setFormError('');
            },
        };
        if (field === 'category') return <select {...props}>
                {MATERIAL_GROUPS.map(group => <option key={group.key} value={group.title}>{group.title}</option>)}
            </select>;
        if (field === 'itemName') return <div className="space-y-1">
            <select {...props}
                value={customItemName ? 'custom' : formData.itemName ? `name:${formData.itemName}` : ''}
                onChange={event => {
                    const value = event.target.value;
                    setCustomItemName(value === 'custom');
                    setFormError('');
                    if (value === 'custom') requestAnimationFrame(() => focusInlineField('itemName'));
                    else setFormData(previous => ({ ...previous, itemName: value.slice('name:'.length) }));
                }}
            >
                <option value="">품명 없음</option>
                {inlineItemNameOptions.map(name => <option key={name} value={`name:${name}`}>{name}</option>)}
                <option value="custom">직접 입력...</option>
            </select>
            {customItemName && <input {...props} aria-label="품명 직접 입력" type="text" placeholder="새 품명 입력" />}
        </div>;
        return <input {...props} type="text" placeholder={field === 'unit' ? 'EA' : MATERIAL_FIELDS[field]} />;
    };

    const renderEditableValue = (material: Material, field: MaterialField) => {
        const value = field === 'category' ? getMaterialMasterCategory(material) : material[field];
        if (!canManageCatalog) return value;
        return <button
            type="button"
            data-inline-trigger={field}
            aria-label={`${MATERIAL_FIELDS[field]} 수정: ${value}`}
            disabled={saving || Boolean(editingItem) || showForm}
            onClick={event => handleEdit(material, field, event.currentTarget)}
            className="max-w-full rounded px-1 py-1 text-left underline decoration-slate-300 decoration-dotted underline-offset-4 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-default disabled:no-underline"
        >{value || '-'}</button>;
    };

    const renderInlineActions = () => <>
        <div className="flex flex-wrap justify-end gap-1">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="material-primary-button rounded-md bg-indigo-600 px-2 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
            </button>
            <button type="button" onClick={handleCancelEdit} disabled={saving} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">취소</button>
        </div>
        {formError && <p role="alert" className="mt-2 text-left text-xs font-semibold text-red-600">{formError}</p>}
    </>;

    const renderMaterialTable = (rows: Material[], emptyText: string) => (
        rows.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
                {emptyText}
            </div>
        ) : (
            <div className="flex-1 overflow-auto">
                <div className="space-y-2 p-3 md:hidden">
                    {rows.map(material => (
                        <div key={material.id} data-material-row={material.id} onKeyDown={handleInlineKeyDown} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            {editingItem?.id === material.id && canManageCatalog ? <>
                                <div className="mb-3 grid grid-cols-2 gap-3">
                                    {(Object.keys(MATERIAL_FIELDS) as MaterialField[]).map(field => <div key={field} className="min-w-0 space-y-1 text-xs font-bold text-slate-600">
                                        <span>{MATERIAL_FIELDS[field]}</span>
                                        {renderInlineField(field)}
                                    </div>)}
                                </div>
                                {renderInlineActions()}
                            </> : (
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-900">{renderEditableValue(material, 'itemName')}</div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                                        <span className="font-semibold text-slate-700">{renderEditableValue(material, 'spec')}</span>
                                        <span>{renderEditableValue(material, 'unit')}</span>
                                        <span className="truncate">· {renderEditableValue(material, 'category')}</span>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    {canManageCatalog && (<button
                                        onClick={event => handleEdit(material, 'itemName', event.currentTarget)}
                                        disabled={saving || Boolean(editingItem) || showForm}
                                        className="flex h-9 w-9 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        title="수정"
                                    >
                                        <FontAwesomeIcon icon={faEdit} />
                                    </button>)}
                                    {canManageCatalog && (<button
                                        onClick={() => handleDelete(material)}
                                        disabled={saving || Boolean(editingItem) || showForm}
                                        className="flex h-9 w-9 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                                        title="삭제"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>)}
                                </div>
                            </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="hidden h-full overflow-auto md:block">
                    <table className="w-full min-w-[480px] text-sm">
                        <colgroup>
                            <col className="w-32" />
                            <col className="w-40" />
                            <col className="w-32" />
                            <col className="w-20" />
                            <col className="w-24" />
                        </colgroup>
                        <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100">
                            <tr>
                                <th className="p-3 text-left font-bold text-slate-700">분류</th>
                                <th className="p-3 text-left font-bold text-slate-700">품명</th>
                                <th className="p-3 text-left font-bold text-slate-700">규격</th>
                                <th className="p-3 text-center font-bold text-slate-700">단위</th>
                                <th className="p-3 text-center font-bold text-slate-700">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rows.map(material => (
                                <tr key={material.id} data-material-row={material.id} onKeyDown={handleInlineKeyDown} className={editingItem?.id === material.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                    {(Object.keys(MATERIAL_FIELDS) as MaterialField[]).map(field => <td key={field} className={`p-2 ${field === 'itemName' ? 'font-semibold' : ''} ${field === 'unit' ? 'text-center' : ''}`}>
                                        {editingItem?.id === material.id && canManageCatalog ? renderInlineField(field) : renderEditableValue(material, field)}
                                    </td>)}
                                    <td className="p-3 text-center">
                                        {editingItem?.id === material.id && canManageCatalog ? renderInlineActions() : <>
                                        {canManageCatalog && (<button
                                            onClick={event => handleEdit(material, 'itemName', event.currentTarget)}
                                            disabled={saving || Boolean(editingItem) || showForm}
                                            className="mx-1 text-blue-600 hover:text-blue-800"
                                            title="수정"
                                        >
                                            <FontAwesomeIcon icon={faEdit} />
                                        </button>)}
                                        {canManageCatalog && (<button
                                            onClick={() => handleDelete(material)}
                                            disabled={saving || Boolean(editingItem) || showForm}
                                            className="mx-1 text-red-600 hover:text-red-800"
                                            title="삭제"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>)}
                                        </>}
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
        <section aria-label={`${title} 자재`} className="material-master-group flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className={`h-5 w-1.5 rounded-full ${accentClass}`} />
                    {title}
                </h2>
                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                    {rows.length} 품목
                </span>
            </header>
            {renderMaterialTable(rows, emptyText)}
        </section>
    );

    return (
        <div className="material-page material-page--master flex min-h-0 w-full max-w-[calc(100vw-30px)] flex-1 flex-col overflow-auto bg-slate-50 p-2 sm:max-w-none sm:p-6 lg:overflow-hidden">
            <div className="material-page__heading mb-3 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-2xl">
                        <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
                        자재 마스터 관리
                    </h1>
                    <p className="mt-1 hidden text-slate-500 sm:block">동바리·비계·기타 자재를 분류별로 관리합니다</p>
                </div>
                {canManageCatalog && (<button
                    onClick={handleAdd}
                    disabled={saving || Boolean(editingItem)}
                    className="material-primary-button flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto sm:py-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    자재 등록
                </button>)}
            </div>

            {statusMessage && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{statusMessage}</p>}

            {/* 등록/수정 폼 */}
            {showForm && (
                <form aria-labelledby="material-form-title" noValidate onSubmit={(event) => { event.preventDefault(); void handleSave(); }} className="material-panel mb-4 flex-shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
                    <h2 id="material-form-title" className="text-lg font-bold text-slate-800 mb-1">
                        {editingItem ? '자재 수정' : '자재 등록'}
                    </h2>
                    <p className="mb-4 text-sm text-slate-500">규격만 입력해도 등록할 수 있습니다. 분류와 단위는 기본값을 사용하며 품명은 선택 사항입니다.</p>
                    <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <label htmlFor="material-category" className="block text-sm font-bold text-slate-700 mb-2">분류</label>
                            <select
                                id="material-category"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg bg-white px-3 py-2"
                            >
                                {MATERIAL_GROUPS.map(group => <option key={group.key} value={group.title}>{group.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="material-item-name" className="block text-sm font-bold text-slate-700 mb-2">품명</label>
                            <input
                                id="material-item-name"
                                ref={itemNameRef}
                                list="material-item-name-options"
                                type="text"
                                value={formData.itemName}
                                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                                placeholder="예: 수직재"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                            <datalist id="material-item-name-options">
                                {itemNameOptions.map(name => <option key={name} value={name} />)}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="material-spec" className="block text-sm font-bold text-slate-700 mb-2">규격 *</label>
                            <input
                                id="material-spec"
                                ref={specRef}
                                list="material-spec-options"
                                type="text"
                                required
                                value={formData.spec}
                                onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                                placeholder="예: P17"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                            <datalist id="material-spec-options">
                                {specOptions.map(spec => <option key={spec} value={spec} />)}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="material-unit" className="block text-sm font-bold text-slate-700 mb-2">단위</label>
                            <input
                                id="material-unit"
                                list="material-unit-options"
                                type="text"
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                placeholder="EA, SET 등"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                            />
                            <datalist id="material-unit-options">
                                {['EA', 'SET', 'M', '개', '장', '본'].map(unit => <option key={unit} value={unit} />)}
                            </datalist>
                        </div>
                    </fieldset>
                    {formError && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{formError}</p>}
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => setShowForm(false)}
                            className="flex items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-300 sm:py-2"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            취소
                        </button>
                        {!editingItem && <button
                            type="button"
                            onClick={() => void handleSave(true)}
                            disabled={saving}
                            className="flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 sm:py-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            저장 후 계속 등록
                        </button>}
                        <button
                            type="submit"
                            disabled={saving}
                            className="material-primary-button flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:py-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            )}

            {/* 필터 및 목록 */}
            <div className="material-panel flex min-h-0 flex-1 flex-col overflow-visible rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6 lg:overflow-hidden">
                {canManageCatalog && <p className="mb-3 text-xs text-slate-500">{editingItem ? '분류·품명은 목록에서 선택하세요. 새 품명은 직접 입력할 수 있습니다. Enter 저장 · Esc 취소' : '목록의 분류·품명·규격·단위를 누르면 바로 수정할 수 있습니다.'}</p>}
                <div role="group" aria-label="자재 대분류" className="material-master-tabs mb-4 flex flex-shrink-0 flex-wrap gap-2">
                    {[{ key: '' as const, title: '전체' }, ...MATERIAL_GROUPS].map(group => {
                        const count = group.key
                            ? materials.filter(material => getMaterialMasterDisplayGroupKey(material) === group.key).length
                            : materials.length;
                        return (
                            <button
                                key={group.key}
                                type="button"
                                disabled={Boolean(editingItem) || saving}
                                aria-pressed={groupFilter === group.key}
                                onClick={() => setGroupFilter(group.key)}
                                className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${groupFilter === group.key
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                            >
                                {group.title} <span className="ml-1 text-xs">{count}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="mb-4 grid flex-shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <input
                        type="text"
                        value={itemNameFilter}
                        disabled={Boolean(editingItem) || saving}
                        onChange={(e) => setItemNameFilter(e.target.value)}
                        aria-label="품명 검색" placeholder="품명 검색..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:py-2"
                    />
                    <input
                        type="text"
                        value={specFilter}
                        disabled={Boolean(editingItem) || saving}
                        onChange={(e) => setSpecFilter(e.target.value)}
                        aria-label="규격 검색" placeholder="규격 검색..."
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
                        <p>{groupFilter || itemNameFilter || specFilter ? '검색 조건에 맞는 자재가 없습니다.' : '등록된 자재가 없습니다.'}</p>
                        <p className="text-sm mt-2">검색 조건을 바꾸거나 '자재 등록' 버튼을 눌러 자재를 추가하세요.</p>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-visible lg:overflow-auto">
                        <div className={`grid min-h-full grid-cols-1 gap-4 ${groupFilter ? '' : 'xl:grid-cols-2'}`}>
                            {MATERIAL_GROUPS
                                .filter(group => !groupFilter || group.key === groupFilter)
                                .map(group => (
                                    <React.Fragment key={group.key}>
                                        {renderMaterialGroup(group.title, groupedMaterials[group.key], group.accent, `${group.title} 자재가 없습니다.`)}
                                    </React.Fragment>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialMasterPage;
