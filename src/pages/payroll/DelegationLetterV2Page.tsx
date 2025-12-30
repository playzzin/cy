import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas'; // @types/html2canvas mismatched, standard import works with casting options
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCopy, faPrint, faGripVertical, faPen, faArrowsRotate, faPlus, faTrash, faSlidersH } from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
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
    id: string;
    name: string;
    idNumber: string;
    address: string;
    unitPrice: number;
    workDays: number;
    claimAmount: number;
    signature: string;
}

type BlockType = 'header' | 'trustee' | 'content' | 'bank' | 'delegators';

interface Block {
    id: string;
    type: BlockType;
    content?: string; // For 'content' blocks
    settings?: {
        // For 'trustee' block resizing
        labelWidth?: number; // fallback generic width
        widths?: { [key: string]: number }; // per-field width overrides
        // For 'content' block
        minHeight?: number;
    };
    contentOverrides?: { [key: string]: string }; // For text editing (labels/values)
}

// ... helper for editable text
const EditableText = ({
    value,
    onChange,
    isEditMode,
    className,
    title
}: {
    value: string;
    onChange: (val: string) => void;
    isEditMode: boolean;
    className?: string;
    title?: string;
}) => {
    if (isEditMode) {
        return (
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`bg-indigo-50/50 hover:bg-indigo-50 border-b border-dashed border-indigo-300 w-full text-center focus:outline-none focus:border-indigo-500 bg-transparent ${className}`}
                title={title}
            />
        );
    }
    return <span className={className} title={title}>{value}</span>;
};


// --- Sortable Block Component ---
interface SortableBlockProps {
    block: Block;
    isEditMode: boolean;
    onRemove?: (id: string) => void;
    children: React.ReactNode;
}

const SortableBlock: React.FC<SortableBlockProps> = ({ block, isEditMode, onRemove, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: block.id, disabled: !isEditMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={`mb-4 ${isEditMode ? 'group' : ''}`}>
            {isEditMode && (
                <>
                    <div
                        {...attributes}
                        {...listeners}
                        className="absolute -left-8 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                        title="드래그하여 이동"
                    >
                        <FontAwesomeIcon icon={faGripVertical} className="text-slate-400" />
                    </div>
                    {block.type === 'content' && onRemove && (
                        <button
                            onClick={() => onRemove(block.id)}
                            className="absolute -right-8 top-0 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-full shadow-sm"
                            title="블록 삭제"
                        >
                            <FontAwesomeIcon icon={faTrash} size="xs" />
                        </button>
                    )}
                </>
            )}
            <div className={`${isEditMode ? 'border-2 border-dashed border-slate-200 rounded-lg p-2 hover:border-blue-300 transition-colors bg-white' : ''}`}>
                {children}
            </div>
        </div>
    );
};

const DelegationLetterV2Page: React.FC = () => {
    // --- State ---
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    // Form Data
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [siteName, setSiteName] = useState('');

    // Trustee (수임인 - 청연 대표)
    const [trustee, setTrustee] = useState<TrusteeInfo | null>(null);

    // Delegators (위임인 - 선택된 작업자들)
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [delegators, setDelegators] = useState<DelegatorItem[]>([]);

    // Layout State (Blocks)
    const [isEditMode, setIsEditMode] = useState(false);
    const [blocks, setBlocks] = useState<Block[]>([
        { id: 'header-1', type: 'header' },
        { id: 'trustee-1', type: 'trustee', settings: { labelWidth: 15 } }, // default label width 15%
        { id: 'content-1', type: 'content', content: '' },
        { id: 'bank-1', type: 'bank' },
        { id: 'delegators-1', type: 'delegators' }
    ]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [batchUnitPrice, setBatchUnitPrice] = useState<number>(0);
    const [batchWorkDays, setBatchWorkDays] = useState<number>(1);
    const [copying, setCopying] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // --- Load Data ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [companiesData, workersData] = await Promise.all([
                companyService.getCompanies(),
                manpowerService.getWorkers()
            ]);

            setCompanies(companiesData);
            setWorkers(workersData);

            // 청연 대표 자동 로드
            loadTrustee(companiesData, workersData);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('데이터 로딩에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 수임인 (청연 대표) 자동 로드
    const loadTrustee = (companiesData: Company[], workersData: Worker[]) => {
        const cheongyeonCompany = companiesData.find(c => c.type === '시공사');
        if (!cheongyeonCompany) {
            // toast.warning('시공사(청연)를 찾을 수 없습니다.');
            return;
        }

        const ceo = workersData.find(w =>
            w.companyId === cheongyeonCompany.id &&
            w.role === '대표'
        );

        if (ceo) {
            setTrustee({
                name: ceo.name,
                idNumber: ceo.idNumber,
                address: ceo.address || '',
                contact: ceo.contact || '',
                signature: ceo.signatureUrl || '',
                bankName: ceo.bankName || '',
                accountNumber: ceo.accountNumber || '',
                accountHolder: ceo.accountHolder || ceo.name
            });
        }
    };

    // --- 청연 소속 작업자 필터링 ---
    const cheongyeonWorkers = useMemo(() => {
        const cheongyeonCompany = companies.find(c => c.type === '시공사');
        if (!cheongyeonCompany) return [];

        return workers.filter(w =>
            w.companyId === cheongyeonCompany.id &&
            w.status === 'active' &&
            w.role !== '대표' // 대표는 제외
        );
    }, [companies, workers]);

    // --- 검색 필터링 ---
    const filteredWorkers = useMemo(() => {
        if (!searchTerm) return cheongyeonWorkers;
        return cheongyeonWorkers.filter(w =>
            w.name.includes(searchTerm) ||
            w.idNumber.includes(searchTerm)
        );
    }, [cheongyeonWorkers, searchTerm]);

    // --- 위임인 선택/해제 ---
    const toggleWorker = (workerId: string) => {
        const worker = workers.find(w => w.id === workerId);
        if (!worker) return;

        if (selectedWorkerIds.includes(workerId)) {
            setSelectedWorkerIds(prev => prev.filter(id => id !== workerId));
            setDelegators(prev => prev.filter(d => d.id !== workerId));
        } else {
            setSelectedWorkerIds(prev => [...prev, workerId]);
            setDelegators(prev => [...prev, {
                id: workerId,
                name: worker.name,
                idNumber: worker.idNumber,
                address: worker.address || '',
                unitPrice: worker.unitPrice || 0,
                workDays: 1,
                claimAmount: (worker.unitPrice || 0) * 1,
                signature: worker.signatureUrl || ''
            }]);
        }
    };

    // --- 전체 선택/해제 ---
    const toggleAll = () => {
        if (selectedWorkerIds.length === filteredWorkers.length) {
            setSelectedWorkerIds([]);
            setDelegators([]);
        } else {
            const newIds = filteredWorkers.map(w => w.id!);
            setSelectedWorkerIds(newIds);
            setDelegators(filteredWorkers.map(w => ({
                id: w.id!,
                name: w.name,
                idNumber: w.idNumber,
                address: w.address || '',
                unitPrice: w.unitPrice || 0,
                workDays: 1,
                claimAmount: (w.unitPrice || 0) * 1,
                signature: w.signatureUrl || ''
            })));
        }
    };

    // --- 단가/공수 변경 ---
    const updateDelegator = (id: string, field: 'unitPrice' | 'workDays', value: number) => {
        setDelegators(prev => prev.map(d => {
            if (d.id !== id) return d;
            const updated = { ...d, [field]: value };
            updated.claimAmount = updated.unitPrice * updated.workDays;
            return updated;
        }));
    };

    // --- 일괄 변경 ---
    const applyBatchChange = (type: 'unitPrice' | 'workDays') => {
        const value = type === 'unitPrice' ? batchUnitPrice : batchWorkDays;
        setDelegators(prev => prev.map(d => {
            const updated = { ...d, [type]: value };
            updated.claimAmount = updated.unitPrice * updated.workDays;
            return updated;
        }));
        toast.success(`${type === 'unitPrice' ? '단가' : '공수'}를 일괄 적용했습니다.`);
    };

    // --- 총합 계산 ---
    const totalAmount = useMemo(() => {
        return delegators.reduce((sum, d) => sum + d.claimAmount, 0);
    }, [delegators]);

    // --- 이미지 복사 ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        setCopying(true);
        const previousEditMode = isEditMode;
        if (previousEditMode) setIsEditMode(false);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const canvas = await html2canvas(printRef.current, {
                useCORS: true,
                scale: 2
            } as any);

            canvas.toBlob(blob => {
                if (blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    toast.success('위임장이 이미지로 복사되었습니다!');
                }
            });
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('복사에 실패했습니다.');
        } finally {
            setCopying(false);
            if (previousEditMode) setIsEditMode(true);
        }
    };

    // --- Block Management ---
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const addContentBlock = () => {
        const newId = `content-${Date.now()}`;
        // Insert after the last content block or at the end
        setBlocks(prev => {
            const lastContentIndex = prev.map(b => b.type).lastIndexOf('content');
            const insertIndex = lastContentIndex >= 0 ? lastContentIndex + 1 : prev.length;
            const newBlocks = [...prev];
            newBlocks.splice(insertIndex, 0, { id: newId, type: 'content', content: '' });
            return newBlocks;
        });
    };

    const removeBlock = (id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id));
    };

    const updateBlockContent = (id: string, content: string) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    };

    const updateBlockSettings = (id: string, newSettings: any) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, settings: { ...b.settings, ...newSettings } } : b));
    };

    const updateBlockOverride = (id: string, key: string, value: string) => {
        setBlocks(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
                ...b,
                contentOverrides: { ...b.contentOverrides, [key]: value }
            };
        }));
    };

    const handleResetLayout = () => {
        if (window.confirm('화면 구성을 초기화 하시겠습니까?')) {
            setBlocks([
                { id: 'header-1', type: 'header' },
                { id: 'trustee-1', type: 'trustee', settings: { labelWidth: 15 } },
                { id: 'content-1', type: 'content', content: '' },
                { id: 'bank-1', type: 'bank' },
                { id: 'delegators-1', type: 'delegators' }
            ]);
        }
    };

    // --- Render Functions (Sections) ---
    const renderHeader = () => (
        <h1 className="text-center text-3xl font-bold border-b-2 border-slate-800 pb-4 mb-4 select-none">위 임 장</h1>
    );

    const renderTrustee = (block: Block) => {
        if (!trustee) return <div className="p-4 text-center text-red-500 font-bold border border-red-200 bg-red-50 rounded">수임인 정보 없음</div>;

        const defaultLabelW = 15;
        const getLabelW = (key: string) => block.settings?.widths?.[key] || block.settings?.labelWidth || defaultLabelW;

        // Helper to update specific width
        const updateWidth = (key: string, w: number) => {
            const newWidths = { ...block.settings?.widths, [key]: w };
            updateBlockSettings(block.id, { widths: newWidths });
        };

        // Helper to get display text (override or default)
        const getText = (key: string, defaultText: string) => block.contentOverrides?.[key] ?? defaultText;
        const setText = (key: string, val: string) => updateBlockOverride(block.id, key, val);

        return (
            <div className="mb-4 text-sm relative">
                <div className="mb-2 flex justify-between items-end">
                    <span className="font-bold text-sm">수임인</span>
                    <span className="font-bold text-sm">{year}년 {month}월분</span>
                </div>

                <div className="border-t border-l border-slate-800">
                    {/* Row 1: Name, ID, Contact */}
                    <div className="flex border-b border-slate-800">
                        {/* Label: Suim-in */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_name')}%` }}>
                            {isEditMode && <input type="range" min="5" max="40" value={getLabelW('label_name')} onChange={e => updateWidth('label_name', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_name', '수임인')} onChange={val => setText('label_name', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center">
                            <EditableText isEditMode={isEditMode} value={getText('val_name', trustee.name)} onChange={val => setText('val_name', val)} />
                        </div>

                        {/* Label: ID */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_id')}%` }}>
                            {isEditMode && <input type="range" min="5" max="40" value={getLabelW('label_id')} onChange={e => updateWidth('label_id', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_id', '주민번호')} onChange={val => setText('label_id', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center">
                            <EditableText isEditMode={isEditMode} value={getText('val_id', trustee.idNumber)} onChange={val => setText('val_id', val)} />
                        </div>

                        {/* Label: Contact */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_contact')}%` }}>
                            {isEditMode && <input type="range" min="5" max="40" value={getLabelW('label_contact')} onChange={e => updateWidth('label_contact', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_contact', '연락처')} onChange={val => setText('label_contact', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center">
                            <EditableText isEditMode={isEditMode} value={getText('val_contact', trustee.contact)} onChange={val => setText('val_contact', val)} />
                        </div>
                    </div>

                    {/* Row 2: Address (Wide), Signature */}
                    <div className="flex border-b border-slate-800">
                        {/* Label: Address */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_addr')}%` }}>
                            {isEditMode && <input type="range" min="5" max="40" value={getLabelW('label_addr')} onChange={e => updateWidth('label_addr', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_addr', '주소')} onChange={val => setText('label_addr', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-[3] flex items-center break-all whitespace-normal" style={{ flexGrow: 3 }}>
                            <EditableText isEditMode={isEditMode} value={getText('val_addr', trustee.address)} onChange={val => setText('val_addr', val)} />
                        </div>

                        {/* Label: Signature */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_sign')}%` }}>
                            {isEditMode && <input type="range" min="5" max="40" value={getLabelW('label_sign')} onChange={e => updateWidth('label_sign', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_sign', '서명 또는 인')} onChange={val => setText('label_sign', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center justify-center">
                            {trustee.signature && <img src={trustee.signature} alt="수임인 서명" className="max-h-12" />}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = (block: Block) => (
        <div className="mb-4 group/content" style={{ minHeight: isEditMode ? undefined : (block.settings?.minHeight || 'auto') }}>
            {block.content || isEditMode ? (
                <div
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${!block.content && !isEditMode ? 'hidden' : ''} ${isEditMode ? 'resize-y overflow-hidden border border-dashed border-slate-300 p-2 min-h-[100px]' : ''}`}
                    style={isEditMode ? { height: block.settings?.minHeight || 'auto' } : {}}
                    onMouseUp={(e) => {
                        if (isEditMode) {
                            const height = (e.target as HTMLDivElement).clientHeight;
                            updateBlockSettings(block.id, { minHeight: height });
                        }
                    }}
                >
                    {block.content || (isEditMode ? "(본문 내용이 여기에 표시됩니다. 좌측 설정 패널에서 입력해주세요)" : "")}
                </div>
            ) : null}
            {isEditMode && <div className="text-[10px] text-center text-slate-400 opacity-0 group-hover/content:opacity-100">↕ 높이 조절 가능</div>}
        </div>
    );

    const renderBank = (block: Block) => {
        if (!trustee) return null;

        const defaultLabelW = 10;
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
                        {/* Bank Name */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_bank')}%` }}>
                            {isEditMode && <input type="range" min="5" max="30" value={getLabelW('label_bank')} onChange={e => updateWidth('label_bank', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_bank', '은행')} onChange={val => setText('label_bank', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center">
                            <EditableText isEditMode={isEditMode} value={getText('val_bank', trustee.bankName)} onChange={val => setText('val_bank', val)} />
                        </div>

                        {/* Account Number */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_account')}%` }}>
                            {isEditMode && <input type="range" min="5" max="30" value={getLabelW('label_account')} onChange={e => updateWidth('label_account', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_account', '계좌번호')} onChange={val => setText('label_account', val)} />
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-[1.5] flex items-center">
                            <EditableText isEditMode={isEditMode} value={getText('val_account', trustee.accountNumber)} onChange={val => setText('val_account', val)} />
                        </div>

                        {/* Account Holder */}
                        <div className="bg-slate-50 font-medium px-1 py-2 border-r border-slate-800 flex items-center justify-center shrink-0 relative group/cell" style={{ width: `${getLabelW('label_holder')}%` }}>
                            {isEditMode && <input type="range" min="5" max="30" value={getLabelW('label_holder')} onChange={e => updateWidth('label_holder', Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover/cell:opacity-100 cursor-ew-resize" title="너비 조절" />}
                            <EditableText isEditMode={isEditMode} value={getText('label_holder', '예금주')} onChange={val => setText('label_holder', val)} />
                        </div>
                        <div className="px-3 py-2 flex-1 flex items-center">
                            <EditableText isEditMode={isEditMode} value={getText('val_holder', trustee.accountHolder)} onChange={val => setText('val_holder', val)} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

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
                                <td className="border border-slate-800 px-2 py-1 text-center">
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
        ) : null
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

            {/* Left Panel: Settings */}
            <div className="w-full md:w-[400px] shrink-0 space-y-4 print:hidden">
                <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPen} className="text-indigo-500" />
                        설정 및 입력
                    </h2>

                    <div className="space-y-4">
                        {/* Global Settings */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">년도</label>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">월</label>
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{m}월</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">현장명</label>
                            <input
                                type="text"
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="현장명 입력"
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Dynamic Content Block Inputs */}
                        <div className="border-t border-slate-100 pt-3">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-slate-600">본문 내용 입력</label>
                                <button
                                    onClick={addContentBlock}
                                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors"
                                >
                                    <FontAwesomeIcon icon={faPlus} /> 내용 추가
                                </button>
                            </div>

                            <div className="space-y-3">
                                {blocks.filter(b => b.type === 'content').map((block, index) => (
                                    <div key={block.id} className="relative group">
                                        <label className="block text-[10px] text-slate-400 mb-1">본문 블록 {index + 1}</label>
                                        <textarea
                                            value={block.content || ''}
                                            onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                            placeholder={`본문 내용 ${index + 1} 입력...`}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-y"
                                        />
                                        {/* show delete if multiple? or always allow deleting? */}
                                        {blocks.filter(b => b.type === 'content').length > 1 && (
                                            <button
                                                onClick={() => removeBlock(block.id)}
                                                className="absolute top-0 right-0 p-1 text-red-300 hover:text-red-500 transition-colors"
                                                title="삭제"
                                            >
                                                <FontAwesomeIcon icon={faTrash} size="xs" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Worker Selection (Same as before) */}
                <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">작업자 선택</h2>

                    <div className="space-y-3">
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="이름/주민번호 검색"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">일괄 단가</label>
                                <div className="flex">
                                    <input type="number" value={batchUnitPrice} onChange={e => setBatchUnitPrice(Number(e.target.value))} className="w-full text-xs px-2 py-1 border rounded-l-lg border-r-0" />
                                    <button onClick={() => applyBatchChange('unitPrice')} className="px-2 py-1 bg-slate-100 border border-slate-300 rounded-r-lg text-xs hover:bg-slate-200">적용</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">일괄 공수</label>
                                <div className="flex">
                                    <input type="number" value={batchWorkDays} onChange={e => setBatchWorkDays(Number(e.target.value))} className="w-full text-xs px-2 py-1 border rounded-l-lg border-r-0" />
                                    <button onClick={() => applyBatchChange('workDays')} className="px-2 py-1 bg-slate-100 border border-slate-300 rounded-r-lg text-xs hover:bg-slate-200">적용</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                            <div className="text-xs text-slate-500">
                                총 {selectedWorkerIds.length}명 선택됨
                            </div>
                            <button onClick={toggleAll} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 font-medium">
                                {selectedWorkerIds.length === filteredWorkers.length ? '전체 해제' : '전체 선택'}
                            </button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {filteredWorkers.map(worker => {
                                const isSelected = selectedWorkerIds.includes(worker.id!);
                                const delegator = delegators.find(d => d.id === worker.id);
                                return (
                                    <div
                                        key={worker.id}
                                        onClick={() => toggleWorker(worker.id!)}
                                        className={`p-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{worker.name}</span>
                                            {delegator && <span className="text-xs font-bold text-blue-600">{delegator.claimAmount.toLocaleString()}원</span>}
                                        </div>
                                        {isSelected && delegator && (
                                            <div className="mt-2 grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="number"
                                                    value={delegator.unitPrice}
                                                    onChange={e => updateDelegator(worker.id!, 'unitPrice', Number(e.target.value))}
                                                    className="w-full text-xs px-1 py-0.5 border rounded"
                                                    placeholder="단가"
                                                />
                                                <input
                                                    type="number"
                                                    value={delegator.workDays}
                                                    onChange={e => updateDelegator(worker.id!, 'workDays', Number(e.target.value))}
                                                    className="w-full text-xs px-1 py-0.5 border rounded"
                                                    placeholder="공수"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex justify-between items-center print:hidden border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isEditMode ? 'text-indigo-600' : 'text-slate-600'}`}>
                                {isEditMode ? '레이아웃 편집 모드' : '미리보기 모드'}
                            </span>
                            <button
                                onClick={() => setIsEditMode(!isEditMode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEditMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEditMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {isEditMode && (
                            <button onClick={handleResetLayout} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                <FontAwesomeIcon icon={faArrowsRotate} /> 초기화
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCopyToClipboard}
                            disabled={copying || delegators.length === 0}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <FontAwesomeIcon icon={faCopy} />
                            {copying ? '복사 중...' : '이미지 복사'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            disabled={delegators.length === 0}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <FontAwesomeIcon icon={faPrint} />
                            출력
                        </button>
                    </div>
                </div>

                {/* A4 Preview Container */}
                <div className="flex-1 overflow-auto bg-slate-100 flex justify-center items-start p-4 md:p-8">
                    <div
                        ref={printRef}
                        className={`bg-white shadow-2xl p-10 md:p-14 w-[210mm] min-h-[297mm] mx-auto print:shadow-none print:w-full print:p-0 transition-all ${isEditMode ? 'scale-[0.9] origin-top' : ''}`}
                    >
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={blocks.map(b => b.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {blocks.map(block => (
                                    <SortableBlock
                                        key={block.id}
                                        block={block}
                                        isEditMode={isEditMode}
                                        onRemove={block.type === 'content' ? removeBlock : undefined}
                                    >
                                        {renderBlock(block)}
                                    </SortableBlock>
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterV2Page;
