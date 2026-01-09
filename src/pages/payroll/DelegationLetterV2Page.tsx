import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCopy, faPrint, faGripVertical, faPen, faArrowsRotate, faPlus, faTrash, faCheckSquare, faSquare } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { toast } from '../../utils/swal';

// Dnd Kit Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
interface TrusteeInfo {
    name: string;
    idNumber: string;
    address: string;
    contact: string;
    signature: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
}

interface DelegatorItem {
    id: string; // matches Worker ID
    name: string;
    idNumber: string;
    address: string;
    unitPrice: number;
    workDays: number;
    claimAmount: number;
    signature: string;
}

type BlockType = 'header' | 'trustee' | 'content' | 'bank' | 'delegators';

interface TrusteeCell {
    id: string; // unique
    label: string; // Display label lookup key (or raw text)
    valueKey?: keyof TrusteeInfo; // Key to bind to data (optional)
    width: number; // Percentage
}

interface TrusteeRow {
    id: string;
    cells: TrusteeCell[];
}

interface Block {
    id: string;
    type: BlockType;
    content?: string; // For 'content' blocks
    settings?: {
        // For 'trustee' dynamic layout
        layout?: TrusteeRow[];
        // For 'content' block
        minHeight?: number;
        // Legacy/Bank block support
        widths?: { [key: string]: number };
    };
    contentOverrides?: { [key: string]: string }; // For text editing (labels/values)
}

// Default Initial Layout for Trustee
const INITIAL_TRUSTEE_LAYOUT: TrusteeRow[] = [
    {
        id: 'row-1',
        cells: [
            { id: 'cell-1', label: '성 명', width: 15 },
            { id: 'cell-2', label: 'val_name', valueKey: 'name', width: 35 },
            { id: 'cell-3', label: '주민등록번호', width: 15 },
            { id: 'cell-4', label: 'val_id', valueKey: 'idNumber', width: 35 }
        ]
    },
    {
        id: 'row-2',
        cells: [
            { id: 'cell-5', label: '연락처', width: 15 },
            { id: 'cell-6', label: 'val_contact', valueKey: 'contact', width: 85 }
        ]
    },
    {
        id: 'row-3',
        cells: [
            { id: 'cell-7', label: '주 소', width: 15 },
            { id: 'cell-8', label: 'val_addr', valueKey: 'address', width: 55 },
            { id: 'cell-9', label: '서 명', width: 15 },
            { id: 'cell-10', label: 'val_sign', valueKey: 'signature', width: 15 } // Signature image
        ]
    }
];

// --- Helper Components ---

// Simple Editable Text Component
const EditableText: React.FC<{
    value: string;
    onChange: (val: string) => void;
    isEditMode: boolean;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, isEditMode, placeholder, className }) => {
    if (isEditMode) {
        return (
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`bg-slate-50 border border-slate-300 rounded px-1 w-full text-center ${className || ''}`}
                onClick={(e) => e.stopPropagation()}
            />
        );
    }
    return <span className={className}>{value}</span>;
};

// Sortable Block Wrapper
const SortableBlock: React.FC<{
    block: Block;
    isEditMode: boolean;
    onRemove?: (id: string) => void;
    children: React.ReactNode;
}> = ({ block, isEditMode, onRemove, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: block.id, disabled: !isEditMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative ${isEditMode ? 'mb-6 ring-2 ring-transparent hover:ring-indigo-100 rounded-lg' : ''}`}>
            {isEditMode && (
                <div className="absolute top-2 right-2 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1 rounded shadow-sm backdrop-blur-sm">
                    <div {...attributes} {...listeners} className="cursor-grab hover:text-indigo-600 p-1">
                        <FontAwesomeIcon icon={faGripVertical} />
                    </div>
                    {onRemove && (
                        <button onClick={() => onRemove(block.id)} className="text-red-400 hover:text-red-600 p-1">
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    )}
                </div>
            )}
            {children}
        </div>
    );
};


// --- Main Page Component ---

const DelegationLetterV2Page: React.FC = () => {
    // --- State: Global ---
    const [loading, setLoading] = useState(true);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);

    // --- State: Settings ---
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [trustee, setTrustee] = useState<TrusteeInfo>({
        name: '', idNumber: '', address: '', contact: '', signature: '',
        bankName: '', accountNumber: '', accountHolder: ''
    });

    // --- State: Layout & Content ---
    const [blocks, setBlocks] = useState<Block[]>([
        { id: 'header', type: 'header' },
        { id: 'trustee', type: 'trustee', settings: { layout: INITIAL_TRUSTEE_LAYOUT } },
        {
            id: 'content',
            type: 'content',
            content: '상기 위임인은 귀사(귀하)의 공사현장에서 ' + new Date().getFullYear() + '년 ' + (new Date().getMonth() + 1) + '월분 노무비(임금, 식대 및 기타 경비 포함)를 청구 및 수령하는 권한 일체를 수임인에게 위임하며, 수임인에게 지급된 노무비는 위임인에게 직접 지급된 것으로 간주하여, 추후 이에 대한 어떠한 이의도 제기하지 않을 것을 서명 또는 날인으로 각 서약합니다.'
        },
        {
            id: 'bank',
            type: 'bank',
            settings: {
                widths: {
                    label_bank: 15, label_account: 15, label_holder: 15
                }
            }
        },
        { id: 'delegators', type: 'delegators' }
    ]);

    // --- State: Workers & Selection ---
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [delegators, setDelegators] = useState<DelegatorItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [batchUnitPrice, setBatchUnitPrice] = useState<number>(0);
    const [batchWorkDays, setBatchWorkDays] = useState<number>(0);

    // --- State: UI ---
    const [isEditMode, setIsEditMode] = useState(false);
    const [copying, setCopying] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // --- Dnd Sensors ---
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // --- Effects ---
    useEffect(() => {
        const fetchWorkers = async () => {
            setLoading(true);
            try {
                const workers = await manpowerService.getWorkers();
                setAllWorkers(workers);
            } catch (error) {
                console.error('Failed to load workers', error);
                // Fixed toast syntax: expected 1 argument usually for simplest usage or concatenated
                toast.error('작업자 목록 로드 실패: 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchWorkers();
    }, []);

    // Sync Delegators with Selected IDs
    useEffect(() => {
        // Add new selections
        const newDelegators = [...delegators];
        let hasChanges = false;

        // Add missing
        selectedWorkerIds.forEach(id => {
            if (!newDelegators.find(d => d.id === id)) {
                const worker = allWorkers.find(w => w.id === id);
                if (worker) {
                    newDelegators.push({
                        id: worker.id!,
                        name: worker.name,
                        idNumber: worker.idNumber || '',
                        address: worker.address || '',
                        unitPrice: worker.unitPrice || 150000,
                        workDays: 1,
                        claimAmount: (worker.unitPrice || 150000) * 1,
                        signature: worker.signatureUrl || ''
                    });
                    hasChanges = true;
                }
            }
        });

        // Remove unselected
        const filtered = newDelegators.filter(d => selectedWorkerIds.includes(d.id));
        if (filtered.length !== newDelegators.length) hasChanges = true;

        if (hasChanges) {
            setDelegators(filtered);
        }
    }, [selectedWorkerIds, allWorkers]);

    // --- Derived ---
    const filteredWorkers = useMemo(() => {
        if (!searchTerm) return allWorkers;
        return allWorkers.filter(w =>
            w.name.includes(searchTerm) ||
            (w.idNumber && w.idNumber.includes(searchTerm))
        );
    }, [allWorkers, searchTerm]);

    const totalAmount = useMemo(() => delegators.reduce((sum, d) => sum + d.claimAmount, 0), [delegators]);

    // --- Handlers ---

    // Block Settings & Overrides
    const updateBlockSettings = (blockId: string, settings: any) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, settings: { ...b.settings, ...settings } } : b));
    };

    const updateBlockOverride = (blockId: string, key: string, value: string) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? {
            ...b,
            contentOverrides: { ...b.contentOverrides, [key]: value }
        } : b));
    };

    const updateBlockContent = (blockId: string, content: string) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    };

    const addContentBlock = () => {
        const newBlock: Block = {
            id: `content-${Date.now()}`,
            type: 'content',
            content: '',
            settings: { minHeight: 100 }
        };
        setBlocks(prev => {
            const bankIdx = prev.findIndex(b => b.type === 'bank');
            if (bankIdx >= 0) {
                const newBlocks = [...prev];
                newBlocks.splice(bankIdx, 0, newBlock);
                return newBlocks;
            }
            return [...prev, newBlock];
        });
    };

    const removeBlock = (id: string) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        setBlocks(prev => prev.filter(b => b.id !== id));
    };

    // Trustee Info
    const updateTrusteeField = (key: keyof TrusteeInfo, value: string) => {
        setTrustee(prev => ({ ...prev, [key]: value }));
    };

    // Worker Selection
    const toggleWorker = (id: string) => {
        setSelectedWorkerIds(prev =>
            prev.includes(id) ? prev.filter(wid => wid !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedWorkerIds.length === filteredWorkers.length) {
            setSelectedWorkerIds([]);
        } else {
            setSelectedWorkerIds(filteredWorkers.map(w => w.id!));
        }
    };

    const updateDelegator = (id: string, field: 'unitPrice' | 'workDays', value: number) => {
        setDelegators(prev => prev.map(d => {
            if (d.id === id) {
                const updates = { [field]: value };
                const newUnitPrice = field === 'unitPrice' ? value : d.unitPrice;
                const newWorkDays = field === 'workDays' ? value : d.workDays;
                return { ...d, ...updates, claimAmount: newUnitPrice * newWorkDays };
            }
            return d;
        }));
    };

    const applyBatchChange = (field: 'unitPrice' | 'workDays') => {
        const val = field === 'unitPrice' ? batchUnitPrice : batchWorkDays;
        if (!val) return;

        setDelegators(prev => prev.map(d => {
            const newUnitPrice = field === 'unitPrice' ? val : d.unitPrice;
            const newWorkDays = field === 'workDays' ? val : d.workDays;
            return {
                ...d,
                unitPrice: newUnitPrice,
                workDays: newWorkDays,
                claimAmount: newUnitPrice * newWorkDays
            };
        }));

        toast.success('일괄 적용 완료: ' + selectedWorkerIds.length + '명의 데이터가 수정되었습니다.');
    };

    // Layout
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleResetLayout = () => {
        if (window.confirm('레이아웃을 초기화하시겠습니까? 모든 설정이 기본값으로 돌아갑니다.')) {
            setBlocks([
                { id: 'header', type: 'header' },
                { id: 'trustee', type: 'trustee', settings: { layout: INITIAL_TRUSTEE_LAYOUT } },
                { id: 'content', type: 'content', content: '상기 위임인은 귀사(귀하)의 공사현장에서...' },
                { id: 'bank', type: 'bank', settings: { widths: { label_bank: 10 } } },
                { id: 'delegators', type: 'delegators' }
            ]);
        }
    };

    // Export
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        setCopying(true);
        try {
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) throw new Error('Blob creation failed');

                // Clipboard API
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                toast.success('복사 완료: 위임장 이미지가 클립보드에 복사되었습니다.');
            });
        } catch (err) {
            console.error('Copy failed', err);
            toast.error('복사 실패: 이미지 생성 중 오류가 발생했습니다.');
        } finally {
            setCopying(false);
        }
    };

    // --- Render Helpers (Inside Component Scope) ---

    // 1. Header
    const renderHeader = () => (
        <h1 className="text-center text-3xl font-bold border-b-2 border-slate-800 pb-4 mb-4 select-none">위 임 장</h1>
    );

    // 2. Trustee
    const renderTrustee = (block: Block) => {
        if (!trustee) return <div className="p-4 text-center text-red-500 font-bold border border-red-200 bg-red-50 rounded">수임인 정보 없음</div>;

        const layout = block.settings?.layout || INITIAL_TRUSTEE_LAYOUT;

        const updateLayout = (newLayout: TrusteeRow[]) => {
            updateBlockSettings(block.id, { layout: newLayout });
        };
        const getText = (key: string, defaultText: string) => block.contentOverrides?.[key] ?? defaultText;
        const setText = (key: string, val: string) => updateBlockOverride(block.id, key, val);

        const handleResize = (rowId: string, cellId: string, newWidth: number) => {
            const row = layout.find(r => r.id === rowId);
            if (!row) return;
            const updatedRow = { ...row, cells: row.cells.map(c => c.id === cellId ? { ...c, width: newWidth } : c) };
            updateLayout(layout.map(r => r.id === rowId ? updatedRow : r));
        };

        const handleAddCell = (rowId: string) => {
            const row = layout.find(r => r.id === rowId);
            if (!row) return;
            const newCell: TrusteeCell = {
                id: `cell-${Date.now()}`,
                label: `label_new`,
                width: 20
            };
            const updatedRow = { ...row, cells: [...row.cells, newCell] };
            updateLayout(layout.map(r => r.id === rowId ? updatedRow : r));
        };

        const handleRemoveCell = (rowId: string, cellId: string) => {
            const row = layout.find(r => r.id === rowId);
            if (!row) return;
            const updatedRow = { ...row, cells: row.cells.filter(c => c.id !== cellId) };
            updateLayout(layout.map(r => r.id === rowId ? updatedRow : r));
        };

        const handleAddRow = () => {
            const newRow: TrusteeRow = {
                id: `row-${Date.now()}`,
                cells: [{ id: `c-${Date.now()}`, label: 'new', width: 100 }]
            };
            updateLayout([...layout, newRow]);
        };

        const handleRemoveRow = (rowId: string) => {
            if (window.confirm('행을 삭제하시겠습니까?')) {
                updateLayout(layout.filter(r => r.id !== rowId));
            }
        };

        return (
            <div className="mb-4 text-sm relative group/trustee">
                <div className="mb-2 flex justify-between items-end">
                    <span className="font-bold text-sm">수임인</span>
                    <span className="font-bold text-sm">{year}년 {month}월분</span>
                </div>

                <div className="border-t border-l border-slate-800">
                    {layout.map((row, rIdx) => (
                        <div key={row.id} className="flex border-b border-slate-800 relative group/row">
                            {row.cells.map((cell, cIdx) => {
                                const isLabelStyle = !cell.valueKey && (cell.label === '성 명' || cell.label === '주민등록번호' || cell.label === '연락처' || cell.width <= 25);
                                return (
                                    <div
                                        key={cell.id}
                                        className={`${isLabelStyle ? 'bg-slate-50 font-medium justify-center' : 'bg-white pl-3'} px-1 py-2 border-r border-slate-800 flex items-center shrink-0 relative group/cell min-w-0 overflow-hidden`}
                                        style={{ width: `${cell.width}%` }}
                                    >
                                        {/* Edit Controls */}
                                        {isEditMode && (
                                            <>
                                                <input
                                                    type="range"
                                                    min="5" max="100" step="1"
                                                    value={cell.width}
                                                    onChange={e => handleResize(row.id, cell.id, Number(e.target.value))}
                                                    className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize z-20"
                                                    title={`너비: ${cell.width}%`}
                                                />
                                                <div className="absolute top-0 right-0 hidden group-hover/cell:flex gap-1 z-20 bg-white/50">
                                                    <button onClick={() => handleRemoveCell(row.id, cell.id)} className="text-red-400 p-0.5"><FontAwesomeIcon icon={faTrash} size="xs" /></button>
                                                </div>
                                            </>
                                        )}

                                        {/* Value */}
                                        {cell.valueKey === 'signature' && trustee.signature ? (
                                            <div className="w-full flex justify-center">
                                                <img src={trustee.signature} alt="수임인 서명" className="max-h-12 object-contain" />
                                            </div>
                                        ) : (
                                            <EditableText
                                                isEditMode={isEditMode}
                                                // Fixed: Strict binding. If valueKey is present, show ONLY the data value.
                                                // If no valueKey (Label cell), use getText to allow overrides.
                                                value={cell.valueKey ? (trustee[cell.valueKey] as string) : getText(cell.label, cell.label)}
                                                onChange={val => cell.valueKey ? updateTrusteeField(cell.valueKey as keyof TrusteeInfo, val) : setText(cell.label, val)}
                                                className="w-full break-keep whitespace-nowrap"
                                            />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Row Controls */}
                            {isEditMode && (
                                <div className="absolute -right-6 top-0 h-full flex flex-col justify-center gap-1 opacity-0 group-hover/row:opacity-100 z-30">
                                    <button onClick={() => handleAddCell(row.id)} className="w-5 h-5 bg-blue-50 text-blue-500 rounded border flex items-center justify-center"><FontAwesomeIcon icon={faPlus} size="xs" /></button>
                                    <button onClick={() => handleRemoveRow(row.id)} className="w-5 h-5 bg-red-50 text-red-500 rounded border flex items-center justify-center"><FontAwesomeIcon icon={faTrash} size="xs" /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {isEditMode && (
                    <button onClick={handleAddRow} className="mt-2 text-xs text-blue-500 border border-blue-200 rounded px-2 py-1 w-full dashed">
                        + 행 추가
                    </button>
                )}
            </div>
        );
    };

    // 3. Content
    const renderContent = (block: Block) => (
        <div className="mb-4 group/content" style={{ minHeight: isEditMode ? undefined : (block.settings?.minHeight || 'auto') }}>
            {block.content || isEditMode ? (
                <div
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${!block.content && !isEditMode ? 'hidden' : ''} ${isEditMode ? 'resize-y overflow-hidden border border-dashed border-slate-300 p-2 min-h-[100px]' : ''}`}
                    style={isEditMode ? { height: block.settings?.minHeight || 'auto' } : {}}
                    onMouseUp={(e) => {
                        if (isEditMode) {
                            const newH = (e.target as HTMLDivElement).clientHeight;
                            updateBlockSettings(block.id, { minHeight: newH });
                        }
                    }}
                >
                    {block.content || (isEditMode ? "(본문 내용)" : "")}
                </div>
            ) : null}
            {isEditMode && <div className="text-[10px] text-center text-slate-400 opacity-0 group-hover/content:opacity-100">↕ 높이 조절 가능</div>}
        </div>
    );

    // 4. Bank
    const renderBank = (block: Block) => {
        const defaultLabelW = 15;
        const getLabelW = (key: string) => block.settings?.widths?.[key] || defaultLabelW;
        const updateWidth = (key: string, w: number) => {
            const newWidths = { ...block.settings?.widths, [key]: w };
            updateBlockSettings(block.id, { widths: newWidths });
        };
        const getText = (key: string, defaultText: string) => block.contentOverrides?.[key] ?? defaultText;
        const setText = (key: string, val: string) => updateBlockOverride(block.id, key, val);

        return (
            <div className="mb-4">
                <div className="border border-slate-800 text-sm bg-white">
                    <div className="flex">
                        {/* Bank */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_bank')}%` }}>
                            {isEditMode && <input type="range" min="5" max="30" step="0.1" value={getLabelW('label_bank')} onChange={e => updateWidth('label_bank', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize z-20" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_bank', '은행')} onChange={val => setText('label_bank', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center">
                            {/* Fixed: Use trustee data for value */}
                            <EditableText isEditMode={isEditMode} value={trustee.bankName} onChange={val => updateTrusteeField('bankName', val)} />
                        </div>

                        {/* Account */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_account')}%` }}>
                            {isEditMode && <input type="range" min="5" max="30" step="0.1" value={getLabelW('label_account')} onChange={e => updateWidth('label_account', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize z-20" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_account', '계좌번호')} onChange={val => setText('label_account', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-[1.5] flex items-center">
                            {/* Fixed: Use trustee data for value */}
                            <EditableText isEditMode={isEditMode} value={trustee.accountNumber} onChange={val => updateTrusteeField('accountNumber', val)} />
                        </div>

                        {/* Holder */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_holder')}%` }}>
                            {isEditMode && <input type="range" min="5" max="30" step="0.1" value={getLabelW('label_holder')} onChange={e => updateWidth('label_holder', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize z-20" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_holder', '예금주')} onChange={val => setText('label_holder', val)} />
                        </div>
                        <div className="px-3 py-2 flex-1 flex items-center">
                            {/* Fixed: Use trustee data for value */}
                            <EditableText isEditMode={isEditMode} value={trustee.accountHolder} onChange={val => updateTrusteeField('accountHolder', val)} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 5. Delegators
    const renderDelegators = () => (
        delegators.length > 0 ? (
            <div className="mb-4">
                <div className="font-bold mb-2 text-sm">- 아 래 -</div>
                <table className="w-full border-collapse border border-slate-800 text-xs">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="border border-slate-800 px-2 py-1">번호</th>
                            <th className="border border-slate-800 px-2 py-1">위임인</th>
                            <th className="border border-slate-800 px-2 py-1">주민번호</th>
                            <th className="border border-slate-800 px-2 py-1">주소</th>
                            <th className="border border-slate-800 px-2 py-1">청구금액</th>
                            <th className="border border-slate-800 px-2 py-1">서명 또는 인</th>
                        </tr>
                    </thead>
                    <tbody>
                        {delegators.map((delegator, idx) => (
                            <tr key={delegator.id} className="break-inside-avoid">
                                <td className="border border-slate-800 px-2 py-1 text-center">{idx + 1}</td>
                                <td className="border border-slate-800 px-2 py-1">{delegator.name}</td>
                                <td className="border border-slate-800 px-2 py-1 text-xs">{delegator.idNumber}</td>
                                <td className="border border-slate-800 px-2 py-1 text-xs">{delegator.address}</td>
                                <td className="border border-slate-800 px-2 py-1 text-right">{delegator.claimAmount.toLocaleString()}</td>
                                <td className="border border-slate-800 px-2 py-1 text-center h-10 align-middle">
                                    {delegator.signature && <img src={delegator.signature} alt="서명" className="max-h-8 mx-auto" />}
                                </td>
                            </tr>
                        ))}
                        <tr className="font-bold bg-slate-50 break-inside-avoid">
                            <td colSpan={4} className="border border-slate-800 px-2 py-1 text-center">합계</td>
                            <td className="border border-slate-800 px-2 py-1 text-right">{totalAmount.toLocaleString()}</td>
                            <td className="border border-slate-800 px-2 py-1"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        ) : <div className="text-center text-slate-400 py-4 border border-dashed rounded">위임인(작업자)을 선택해주세요.</div>
    );

    const renderBlock = (block: Block) => {
        switch (block.type) {
            case 'header': return renderHeader();
            case 'trustee': return renderTrustee(block);
            case 'content': return renderContent(block);
            case 'bank': return renderBank(block);
            case 'delegators': return renderDelegators();
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-slate-600">데이터 로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-6 flex flex-col md:flex-row gap-6">

            {/* Settings Panel */}
            <div className={`w-full md:w-[400px] shrink-0 space-y-4 print:hidden ${isEditMode ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
                <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPen} className="text-indigo-500" />
                        기본 설정
                    </h2>

                    {/* Year/Month */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-600">년도</label>
                            <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full px-3 py-2 text-sm border rounded">
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600">월</label>
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full px-3 py-2 text-sm border rounded">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{m}월</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Trustee Inputs */}
                    <div className="space-y-2 border-t pt-4">
                        <label className="text-xs font-semibold text-slate-600">수임인 정보</label>
                        <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="이름" value={trustee.name} onChange={e => updateTrusteeField('name', e.target.value)} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="주민번호" value={trustee.idNumber} onChange={e => updateTrusteeField('idNumber', e.target.value)} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="주소" value={trustee.address} onChange={e => updateTrusteeField('address', e.target.value)} />
                        <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="연락처" value={trustee.contact} onChange={e => updateTrusteeField('contact', e.target.value)} />
                        <div className="grid grid-cols-2 gap-2">
                            <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="은행명" value={trustee.bankName} onChange={e => updateTrusteeField('bankName', e.target.value)} />
                            <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="예금주" value={trustee.accountHolder} onChange={e => updateTrusteeField('accountHolder', e.target.value)} />
                        </div>
                        <input className="w-full px-3 py-1.5 text-sm border rounded" placeholder="계좌번호" value={trustee.accountNumber} onChange={e => updateTrusteeField('accountNumber', e.target.value)} />
                    </div>

                    {/* Content Blocks */}
                    <div className="flex justify-between items-center mt-6">
                        <label className="text-xs font-semibold text-slate-600">본문 블록</label>
                        <button onClick={addContentBlock} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                            <FontAwesomeIcon icon={faPlus} /> 추가
                        </button>
                    </div>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {blocks.filter(b => b.type === 'content').map((b, idx) => (
                            <textarea key={b.id} className="w-full px-3 py-2 text-sm border rounded min-h-[80px]" value={b.content} onChange={e => updateBlockContent(b.id, e.target.value)} placeholder={`본문 ${idx + 1}`} />
                        ))}
                    </div>
                </div>

                {/* Worker Selector */}
                <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 h-[400px] flex flex-col">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">작업자 선택</h2>
                    <div className="relative mb-3">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2.5 text-slate-400 text-sm" />
                        <input className="w-full pl-9 px-3 py-2 text-sm border rounded" placeholder="이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 input-group">
                            <input type="number" className="w-full border rounded px-2 py-1 text-xs" placeholder="일괄 단가" value={batchUnitPrice || ''} onChange={e => setBatchUnitPrice(Number(e.target.value))} />
                            <button onClick={() => applyBatchChange('unitPrice')} className="text-xs bg-slate-100 px-2 rounded hover:bg-slate-200">적용</button>
                        </div>
                        <div className="flex-1 input-group">
                            <input type="number" className="w-full border rounded px-2 py-1 text-xs" placeholder="일괄 공수" value={batchWorkDays || ''} onChange={e => setBatchWorkDays(Number(e.target.value))} />
                            <button onClick={() => applyBatchChange('workDays')} className="text-xs bg-slate-100 px-2 rounded hover:bg-slate-200">적용</button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-2 text-xs text-slate-500">
                        <span>{selectedWorkerIds.length}명 선택됨</span>
                        <button onClick={toggleAll} className="text-indigo-600 hover:underline">
                            {selectedWorkerIds.length === filteredWorkers.length ? '전체 해제' : '전체 선택'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredWorkers.map(worker => {
                            const isSelected = selectedWorkerIds.includes(worker.id!);
                            const delegator = delegators.find(d => d.id === worker.id);
                            return (
                                <div key={worker.id} onClick={() => toggleWorker(worker.id!)} className={`p-2 rounded border cursor-pointer ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className={isSelected ? 'text-indigo-600' : 'text-slate-300'} />
                                            <span className="text-sm font-medium">{worker.name}</span>
                                        </div>
                                        {isSelected && delegator && <span className="text-xs font-bold text-indigo-700">{delegator.claimAmount.toLocaleString()}원</span>}
                                    </div>
                                    {isSelected && delegator && (
                                        <div className="mt-2 grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                                            <input type="number" className="text-xs border rounded px-1" value={delegator.unitPrice} onChange={e => updateDelegator(worker.id!, 'unitPrice', Number(e.target.value))} placeholder="단가" />
                                            <input type="number" className="text-xs border rounded px-1" value={delegator.workDays} onChange={e => updateDelegator(worker.id!, 'workDays', Number(e.target.value))} placeholder="공수" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Preview Panel */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex justify-between items-center print:hidden border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                            <button onClick={() => setIsEditMode(false)} className={`px-3 py-1 text-sm rounded-md transition-all ${!isEditMode ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>미리보기</button>
                            <button onClick={() => setIsEditMode(true)} className={`px-3 py-1 text-sm rounded-md transition-all ${isEditMode ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>레이아웃 편집</button>
                        </div>
                        {isEditMode && <button onClick={handleResetLayout} className="text-xs text-slate-500 hover:text-red-500"><FontAwesomeIcon icon={faArrowsRotate} /> 초기화</button>}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCopyToClipboard} disabled={copying || delegators.length === 0} className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-sm font-medium flex gap-2 items-center">
                            <FontAwesomeIcon icon={faCopy} spin={copying} /> 이미지 복사
                        </button>
                        <button onClick={() => window.print()} disabled={delegators.length === 0} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium flex gap-2 items-center">
                            <FontAwesomeIcon icon={faPrint} /> 출력
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-200/50 flex justify-center items-start p-8">
                    <div
                        ref={printRef}
                        className={`bg-white shadow-xl p-10 md:p-14 w-[210mm] min-h-[297mm] mx-auto print:shadow-none print:w-full print:p-0 transition-transform origin-top ${isEditMode ? 'scale-95 ring-4 ring-indigo-500/10' : ''}`}
                    >
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                {blocks.map(block => (
                                    <div key={block.id} className="relative">
                                        <SortableBlock block={block} isEditMode={isEditMode} onRemove={block.type === 'content' ? () => removeBlock(block.id) : undefined}>
                                            {renderBlock(block)}
                                        </SortableBlock>
                                    </div>
                                ))}
                            </SortableContext>
                        </DndContext>

                        {/* Footer (Static Date) */}
                        <div className="text-center font-bold text-base mt-8 mb-4">
                            {year}. {month}. {new Date().getDate()}.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterV2Page;
