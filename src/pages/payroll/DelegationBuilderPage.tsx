import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus, faFont, faTable, faMinus, faSearch, faTrash, faUndo, faRedo, faSave, faFolderOpen, faFileAlt, faLayerGroup,
    faHeading, faAlignLeft, faCalendarAlt, faSignature, faRulerCombined, faSearchMinus, faSearchPlus, faMousePointer, faGripLines, faMagnet,
    faPrint, faFileExport, faFileImport
} from '@fortawesome/free-solid-svg-icons';
import { produce } from 'immer';
import {
    DndContext, DragOverlay, useDraggable, useDroppable, DragStartEvent, DragEndEvent,
    MouseSensor, TouchSensor, useSensor, useSensors, DragCancelEvent
} from '@dnd-kit/core';
import { useReactToPrint } from 'react-to-print';

import { manpowerService, Worker } from '../../services/manpowerService';
import { toast } from '../../utils/swal';
import { useBuilder } from '../../components/delegation-v3/builder/useBuilder';
import { WidgetRenderer } from '../../components/delegation-v3/builder/WidgetRenderer';
import { PropertiesPanel } from '../../components/delegation-v3/builder/PropertiesPanel';
import { PRESETS } from '../../components/delegation-v3/builder/presets';
import { Ruler } from '../../components/delegation-v3/builder/Ruler';
import { mmToPx, MM_TO_PX } from '../../utils/units';
import { PrintPreview } from './components/PrintPreview';

// Types
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

const STORAGE_KEY = 'delegation-v3-template-builder';

// --- DND Components ---

// Icon helper for presets
const getIconForPreset = (iconName: string) => {
    switch (iconName) {
        case 'heading': return faHeading;
        case 'font': return faFont;
        case 'align-left': return faAlignLeft;
        case 'table': return faTable; // added table icon
        case 'calendar-alt': return faCalendarAlt;
        case 'signature': return faSignature;
        case 'user': return faMousePointer;
        case 'phone': return faSearch;
        case 'id-card': return faFileAlt;
        case 'map-marker-alt': return faFileAlt;
        default: return faFont;
    }
};

// Reusable Worker Row UI
const WorkerRowUI = ({ worker, isSelected, isDragging }: { worker: Worker, isSelected?: boolean, isDragging?: boolean }) => (
    <div
        className={`p-2 flex items-center gap-2 cursor-pointer border rounded mb-1 transition-colors
        ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}
        ${isDragging ? 'shadow-lg ring-2 ring-blue-400 opacity-90' : ''}
    `}
    >
        <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
            {isSelected && <div className="text-[10px]">✓</div>}
        </div>
        <div>
            <div className="text-sm font-medium text-slate-700">{worker.name}</div>
            <div className="text-xs text-slate-500">{worker.idNumber}</div>
        </div>
    </div>
);

const DraggableWorkerItem = ({ worker, isSelected, onClick }: { worker: Worker, isSelected: boolean, onClick: () => void }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `worker-${worker.id}`,
        data: { type: 'worker', worker }
    });

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.5 : 1 }} onClick={onClick}>
            <WorkerRowUI worker={worker} isSelected={isSelected} />
        </div>
    );
};

const DraggablePresetItem = ({ preset, onClick }: { preset: any, onClick: () => void }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `preset-${preset.id}`,
        data: { type: 'preset', preset }
    });

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.5 : 1 }} onClick={onClick}>
            <PresetRow>
                <div style={{ width: 24, textAlign: 'center', marginRight: 8 }}>
                    <FontAwesomeIcon icon={getIconForPreset(preset.icon)} />
                </div>
                {preset.label}
            </PresetRow>
        </div>
    );
};

// Droppable Zone for Canvas
const DroppableCanvasZone = ({ children }: { children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'canvas-drop-zone',
        data: { type: 'canvas' }
    });

    return (
        <CanvasWrapper ref={setNodeRef} $isOver={isOver} onClick={() => { }}>
            {children}
        </CanvasWrapper>
    );
};


const DelegationBuilderPage: React.FC = () => {
    // --- Builder Engine ---
    const builder = useBuilder();

    // --- Data Source ---
    const [trusteeData, setTrusteeData] = useState({
        name: '홍길동',
        contact: '010-1234-5678',
        idNumber: '123456-1234567',
        address: '서울시 강남구',
        bankName: '국민은행',
        accountNumber: '123-456-789012',
        accountHolder: '홍길동'
    });

    // --- Workers Logic ---
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingWorkers, setLoadingWorkers] = useState(false);
    const [bulkUnitPrice, setBulkUnitPrice] = useState<string>('');
    const [saveUnitPriceToDb, setSaveUnitPriceToDb] = useState<boolean>(false);

    // --- UI State ---
    const [rightRef, setRightRef] = useState<'editor' | 'workers'>('editor');
    const [zoom, setZoom] = useState(1);
    const [showRulers, setShowRulers] = useState(true);
    const [snapping, setSnapping] = useState(true);

    // DND State
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [activeDragData, setActiveDragData] = useState<any>(null);

    // Print & Export Refs
    const printComponentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePrint = useReactToPrint({
        content: () => printComponentRef.current,
        documentTitle: '위임장_출력',
        onBeforeGetContent: () => {
            // Optional: Loading state or preparation
        },
        onAfterPrint: () => {
            toast.success('출력이 완료되었습니다.');
        }
    });

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );


    // --- Effects ---
    useEffect(() => {
        loadWorkers();
    }, []);

    const loadWorkers = async () => {
        setLoadingWorkers(true);
        try {
            const data = await manpowerService.getWorkers();
            setWorkers(data);
        } catch (e) {
            console.error(e);
            toast.error('작업자 목록을 불러오지 못했습니다.');
        } finally {
            setLoadingWorkers(false);
        }
    };

    const updateDynamicTablesForWorker = useCallback((workerId: string, updates: Record<string, string | number>) => {
        const dynamicTables = builder.elements.filter(el => el.type === 'table' && el.content.tableType === 'dynamic');
        dynamicTables.forEach(table => {
            const nextOverrides: any = { ...(table.content.dataOverrides || {}) };
            const prevRow = nextOverrides[workerId] || {};

            const hasUnitPriceUpdate = Object.prototype.hasOwnProperty.call(updates, 'unitPrice');
            const hasClaimAmountUpdate = Object.prototype.hasOwnProperty.call(updates, 'claimAmount');
            const nextUnitPrice = hasUnitPriceUpdate ? updates.unitPrice : prevRow.unitPrice;

            const workDaysRaw = prevRow.workDays;
            const workDays = typeof workDaysRaw === 'number'
                ? workDaysRaw
                : (typeof workDaysRaw === 'string' ? Number(workDaysRaw) : 1);

            const normalizedWorkDays = Number.isFinite(workDays) && workDays > 0 ? workDays : 1;

            nextOverrides[workerId] = {
                ...prevRow,
                ...updates,
                ...((hasUnitPriceUpdate && !hasClaimAmountUpdate)
                    ? {
                        claimAmount:
                            (typeof nextUnitPrice === 'number'
                                ? nextUnitPrice
                                : (typeof nextUnitPrice === 'string' ? Number(nextUnitPrice) : 0)) * normalizedWorkDays
                    }
                    : {})
            };
            builder.updateElement(table.id, { content: { ...table.content, dataOverrides: nextOverrides } });
        });
    }, [builder]);

    const applyUnitPriceToSelection = async (unitPriceValue: number, persistToDb: boolean) => {
        if (selectedWorkerIds.length === 0) {
            toast.error('선택된 작업자가 없습니다.');
            return;
        }

        setWorkers(prev => prev.map(w =>
            w.id && selectedWorkerIds.includes(w.id)
                ? { ...w, unitPrice: unitPriceValue }
                : w
        ));

        const dynamicTables = builder.elements.filter(el => el.type === 'table' && el.content.tableType === 'dynamic');
        dynamicTables.forEach(table => {
            const nextOverrides: any = { ...(table.content.dataOverrides || {}) };
            selectedWorkerIds.forEach(workerId => {
                const prevRow = nextOverrides[workerId] || {};
                const workDays = typeof prevRow.workDays === 'number'
                    ? prevRow.workDays
                    : (typeof prevRow.workDays === 'string' ? Number(prevRow.workDays) : 1);

                nextOverrides[workerId] = {
                    ...prevRow,
                    unitPrice: unitPriceValue,
                    claimAmount: unitPriceValue * (Number.isFinite(workDays) && workDays > 0 ? workDays : 1)
                };
            });
            builder.updateElement(table.id, { content: { ...table.content, dataOverrides: nextOverrides } });
        });

        if (!persistToDb) {
            toast.success('단가를 적용했습니다.');
            return;
        }

        try {
            await manpowerService.updateWorkersBatch(selectedWorkerIds, { unitPrice: unitPriceValue });
            toast.success('단가를 DB에 저장했습니다.');
        } catch (e) {
            console.error(e);
            toast.error('DB 저장에 실패했습니다.');
        }
    };

    const handleApplyBulkUnitPrice = async () => {
        const n = Number(bulkUnitPrice.toString().replaceAll(',', '').trim());
        if (!Number.isFinite(n) || n < 0) {
            toast.error('올바른 단가를 입력하세요.');
            return;
        }
        await applyUnitPriceToSelection(n, saveUnitPriceToDb);
    };

    const saveSingleWorkerUnitPrice = async (workerId: string, unitPriceValue: number) => {
        try {
            await manpowerService.updateWorker(workerId, { unitPrice: unitPriceValue });
            toast.success('단가를 DB에 저장했습니다.');
        } catch (e) {
            console.error(e);
            toast.error('DB 저장에 실패했습니다.');
        }
    };

    // Derived Delegators Data
    const delegators = useMemo(() => {
        return selectedWorkerIds.map(id => {
            const w = workers.find(worker => worker.id === id);
            if (!w) return null;
            return {
                id: w.id!,
                name: w.name,
                idNumber: w.idNumber,
                address: w.address || '',
                unitPrice: w.unitPrice || 0,
                workDays: 1,
                claimAmount: (w.unitPrice || 0) * 1,
                signature: w.signatureUrl || ''
            } as DelegatorItem;
        }).filter((item): item is DelegatorItem => item !== null);
    }, [selectedWorkerIds, workers]);

    // NEW: Auto-resize dynamic tables based on content
    useEffect(() => {
        const dynamicTables = builder.elements.filter(el =>
            el.type === 'table' &&
            el.content.tableType === 'dynamic' &&
            el.content.autoFitHeight !== false
        );

        dynamicTables.forEach(table => {
            // Calculate required height in mm
            // Header (10) + Row (8 * N) + Summary (8) + Footer/Padding (5)
            const rowCount = Math.max(1, delegators.length); // At least 1 row (empty message)
            const hasSummary = delegators.length > 0;

            const headerHeight = 8;
            const rowHeight = 8;
            const summaryHeight = hasSummary ? 8 : 0;

            const newHeight = headerHeight + (rowCount * rowHeight) + summaryHeight + 2; // +2 for borders/padding

            // Only update if difference is significant to avoid loops (though 1mm logic should be fine)
            if (Math.abs(table.height - newHeight) > 1) {
                builder.updateElement(table.id, { height: newHeight });
            }
        });
    }, [delegators.length, builder.elements.length]); // Check when count changes or elements added/removed
    // Note: We don't depend on builder.elements deeply to avoid resize loops if we were updating height inside.
    // However, here we only update if height is different. 
    // Ideally we should depend on `delegators.length` and presence of tables.


    // Worker Selection Helpers
    const toggleWorker = (id: string, select: boolean | undefined = undefined) => {
        setSelectedWorkerIds(prev => {
            const isSelected = prev.includes(id);
            const shouldSelect = select !== undefined ? select : !isSelected;

            if (shouldSelect && !isSelected) return [...prev, id];
            if (!shouldSelect && isSelected) return prev.filter(w => w !== id);
            return prev;
        });
    };

    const filteredWorkers = useMemo(() => {
        return workers.filter(w =>
            w.name.includes(searchTerm) || (w.idNumber ?? '').includes(searchTerm)
        );
    }, [workers, searchTerm]);

    const toggleAllWorkers = () => {
        if (filteredWorkers.length === 0) return;
        const allFilteredIds = filteredWorkers.map(w => w.id!);
        const isAllSelected = allFilteredIds.every(id => selectedWorkerIds.includes(id));

        if (isAllSelected) {
            setSelectedWorkerIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
        } else {
            const newIds = allFilteredIds.filter(id => !selectedWorkerIds.includes(id));
            setSelectedWorkerIds(prev => [...prev, ...newIds]);
        }
    };

    // Template Management
    const saveTemplate = () => {
        const templateData = {
            elements: builder.elements,
            trusteeData,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templateData));
        toast.success('브라우저에 임시 저장되었습니다.');
    };

    const loadTemplate = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            if (window.confirm('브라우저 저장된 템플릿을 불러오시겠습니까?')) {
                try {
                    const parsed = JSON.parse(saved);
                    builder.setElements(parsed.elements || []);
                    if (parsed.trusteeData) setTrusteeData(parsed.trusteeData);
                } catch (e) {
                    console.error(e);
                    toast.error('로드 실패');
                }
            }
        }
    };

    const exportToJson = () => {
        const templateData = {
            version: '1.0',
            elements: builder.elements,
            trusteeData,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `위임장_템플릿_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const triggerImport = () => {
        fileInputRef.current?.click();
    };

    const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (json.elements && Array.isArray(json.elements)) {
                    if (window.confirm('현재 작업 내용을 덮어쓰고 파일을 로드하시겠습니까?')) {
                        builder.setElements(json.elements);
                        if (json.trusteeData) setTrusteeData(json.trusteeData);
                        toast.success('파일을 성공적으로 불러왔습니다.');
                    }
                } else {
                    toast.error('올바르지 않은 템플릿 파일입니다.');
                }
            } catch (err) {
                console.error(err);
                toast.error('파일 파싱 중 오류가 발생했습니다.');
            }
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';

            if (isInput) return;

            // Nudge
            if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let dx = 0;
                let dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;
                builder.moveSelection(dx, dy);
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                builder.deleteSelection();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    builder.redo();
                } else {
                    builder.undo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [builder]);



    // --- Drag and Drop Handlers ---
    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
        setActiveDragData(event.active.data.current);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { over, active } = event;
        setActiveDragId(null);
        setActiveDragData(null);

        if (over && over.id === 'canvas-drop-zone') {
            const data = active.data.current;

            // Handle Worker Drop
            if (data?.type === 'worker') {
                const worker = data.worker as Worker;
                toggleWorker(worker.id!, true);

                // Check if a Dynamic Table already exists
                const hasDynamicTable = builder.elements.some(
                    el => el.type === 'table' && el.content.tableType === 'dynamic'
                );

                if (!hasDynamicTable) {
                    // Auto-create "Delegator List" table if missing
                    const delegatorPreset = PRESETS.find(p => p.id === 'delegator-table');
                    if (delegatorPreset) {
                        builder.addElement('table', {
                            ...delegatorPreset.element,
                            x: 15, // A4 left margin approx
                            y: 80  // Slightly below header
                        });
                        toast.success(`${worker.name}님 추가됨 (명단 표 자동 생성)`);
                    } else {
                        // Fallback
                        builder.addElement('table', { x: 20, y: 100 });
                        toast.success(`${worker.name}님 추가됨`);
                    }
                } else {
                    toast.success(`${worker.name}님 추가됨`);
                }
            }

            // Handle Preset Drop
            if (data?.type === 'preset') {
                const preset = data.preset;
                const canvasEl = document.getElementById('canvas-drop-zone');
                if (canvasEl && active.rect.current.translated) {
                    const canvasRect = canvasEl.getBoundingClientRect();
                    const dropRect = active.rect.current.translated;

                    // Calculate relative position accounting for zoom
                    const relativeX = (dropRect.left - canvasRect.left) / zoom;
                    const relativeY = (dropRect.top - canvasRect.top) / zoom;

                    // Convert to mm (assuming screen pixels ~96dpi, but we use mmToPx utility reversed?)
                    // Actually our x/y in builder are in mm.
                    // mmToPx assumes 1mm = 3.78px.
                    // So pxToMm = px / 3.78.
                    // We need to import pxToMm or define it. It's imported in other files, but not here?
                    // Let's assume usage of MM_TO_PX const which is 3.7795...
                    // Or let's just use a hardcoded value if import is missing, but better to use builder utilities.
                    // Wait, MM_TO_PX is imported in line 23.

                    const xMm = relativeX / MM_TO_PX;
                    const yMm = relativeY / MM_TO_PX;

                    builder.addElement(preset.element.type, {
                        ...preset.element,
                        x: Math.max(0, xMm),
                        y: Math.max(0, yMm)
                    });
                } else {
                    // Fallback to center if coords fail
                    builder.addElement(preset.element.type, {
                        ...preset.element,
                        x: 50,
                        y: 50
                    });
                }
            }
        }
    };

    const handleDragCancel = (event: DragCancelEvent) => {
        setActiveDragId(null);
        setActiveDragData(null);
    };


    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <PageContainer>
                {/* Hidden Elements for Functionality */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={importFromJson}
                />
                <PrintPreview
                    ref={printComponentRef}
                    elements={builder.elements}
                    trusteeData={trusteeData}
                    delegators={delegators}
                />

                {/* Toolbar */}
                <Toolbar>
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faFileAlt} className="text-blue-600" />
                            위임장 Builder <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Commercial v1.0</span>
                        </h1>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>

                        {/* Undo/Redo */}
                        <div className="flex gap-1">
                            <ToolButton onClick={builder.undo} disabled={!builder.canUndo} title="실행 취소 (Ctrl+Z)">
                                <FontAwesomeIcon icon={faUndo} />
                            </ToolButton>
                            <ToolButton onClick={builder.redo} disabled={!builder.canRedo} title="다시 실행 (Ctrl+Shift+Z)">
                                <FontAwesomeIcon icon={faRedo} />
                            </ToolButton>
                        </div>

                        <div className="h-6 w-px bg-slate-200 mx-2"></div>

                        {/* View Controls */}
                        <div className="flex gap-1 items-center bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            <ZoomButton onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} title="축소">
                                <FontAwesomeIcon icon={faSearchMinus} />
                            </ZoomButton>
                            <span className="text-xs font-mono w-12 text-center text-slate-600">
                                {Math.round(zoom * 100)}%
                            </span>
                            <ZoomButton onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} title="확대">
                                <FontAwesomeIcon icon={faSearchPlus} />
                            </ZoomButton>
                            <div className="h-4 w-px bg-slate-200 mx-1"></div>
                            <ZoomButton
                                onClick={() => setShowRulers(!showRulers)}
                                title="눈금자 토글"
                                $active={showRulers}
                            >
                                <FontAwesomeIcon icon={faRulerCombined} />
                            </ZoomButton>
                            <ZoomButton
                                onClick={() => setSnapping(!snapping)}
                                title="그리드 스냅"
                                $active={snapping}
                            >
                                <FontAwesomeIcon icon={faMagnet} />
                            </ZoomButton>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {/* Export/Import/Print Group */}
                        <ToolButton onClick={triggerImport} title="파일에서 불러오기">
                            <FontAwesomeIcon icon={faFileImport} className="text-slate-600" />
                        </ToolButton>
                        <ToolButton onClick={exportToJson} title="파일로 저장하기">
                            <FontAwesomeIcon icon={faFileExport} className="text-slate-600" />
                        </ToolButton>

                        <div className="h-6 w-px bg-slate-200 mx-1"></div>

                        <ActionButton onClick={saveTemplate} style={{ marginRight: 8 }}>
                            <FontAwesomeIcon icon={faSave} className="mr-2" />
                            임시저장
                        </ActionButton>

                        <ActionButton onClick={handlePrint} $primary>
                            <FontAwesomeIcon icon={faPrint} className="mr-2" />
                            출력 / PDF
                        </ActionButton>
                    </div>
                </Toolbar>

                <MainContent>
                    {/* Left Sidebar - Presets */}
                    <LeftPanel>
                        <SectionTitlePadded>기본 도구</SectionTitlePadded>
                        <ToolsGrid>
                            <PresetButton onClick={() => builder.addElement('text')}>
                                <PresetIcon><FontAwesomeIcon icon={faFont} /></PresetIcon>
                                <PresetLabel>텍스트</PresetLabel>
                            </PresetButton>
                            <PresetButton onClick={() => {
                                const preset = PRESETS.find(p => p.id === 'delegator-table');
                                builder.addElement('table', preset?.element);
                            }}>
                                <PresetIcon><FontAwesomeIcon icon={faTable} /></PresetIcon>
                                <PresetLabel>위임자 명단</PresetLabel>
                            </PresetButton>
                        </ToolsGrid>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <PresetButton onClick={() => {
                                const preset = PRESETS.find(p => p.id === 'basic-table');
                                builder.addElement('table', preset?.element);
                            }}>
                                <PresetIcon><FontAwesomeIcon icon={faTable} /></PresetIcon>
                                <PresetLabel>일반 표 (3x3)</PresetLabel>
                            </PresetButton>
                        </div>

                        <Divider />

                        <SectionTitlePadded>프리셋 블록</SectionTitlePadded>
                        <PresetList>
                            {PRESETS.map(preset => (
                                <DraggablePresetItem
                                    key={preset.id}
                                    preset={preset}
                                    onClick={() => builder.addElement(preset.element.type || 'text', preset.element)}
                                />
                            ))}
                        </PresetList>
                    </LeftPanel>

                    {/* Canvas */}
                    <DroppableCanvasZone>
                        <div onClick={() => builder.updateSelection(null)}>
                            {/* Sticky Rulers Container */}
                            {showRulers && (
                                <StickyRulerH>
                                    <Ruler
                                        orientation="horizontal"
                                        length={210}
                                        scale={zoom}
                                        mmToPx={MM_TO_PX}
                                    />
                                </StickyRulerH>
                            )}

                            <div className="flex relative">
                                {showRulers && (
                                    <StickyRulerV>
                                        <Ruler
                                            orientation="vertical"
                                            length={297}
                                            scale={zoom}
                                            mmToPx={MM_TO_PX}
                                        />
                                    </StickyRulerV>
                                )}

                                <CanvasCentering>
                                    <CanvasInner style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                                        <A4Canvas>
                                            {builder.elements.length === 0 && (
                                                <Placeholder>
                                                    <div className="text-center text-slate-300 select-none">
                                                        <div className="text-4xl mb-4 opacity-20">
                                                            <FontAwesomeIcon icon={faLayerGroup} />
                                                        </div>
                                                        <p>좌측 패널에서 요소를 추가하여<br />위임장을 디자인하세요.</p>
                                                        <p className="text-sm mt-2">우측에서 작업자를 드래그하여 추가할 수 있습니다.</p>
                                                        <p className="text-sm mt-2">우측에서 작업자를 드래그하여 문서에 추가할 수 있습니다.</p>
                                                    </div>
                                                </Placeholder>
                                            )}
                                            {builder.elements.map(el => (
                                                <WidgetRenderer
                                                    key={el.id}
                                                    element={el}
                                                    isSelected={builder.selection.includes(el.id)}
                                                    dataContext={{ trusteeData, delegators }}
                                                    onSelect={(multi) => builder.updateSelection(el.id, multi)}
                                                    onChange={builder.updateElement}
                                                    snapping={snapping}
                                                    zoom={zoom}
                                                />
                                            ))}
                                        </A4Canvas>
                                    </CanvasInner>
                                </CanvasCentering>
                            </div>
                        </div>
                    </DroppableCanvasZone>


                    {/* Right Panel */}
                    <RightPanel>
                        <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
                            <TabButton $active={rightRef === 'editor'} onClick={() => setRightRef('editor')}>
                                속성 / 문서설정
                            </TabButton>
                            <TabButton $active={rightRef === 'workers'} onClick={() => setRightRef('workers')}>
                                작업자 목록
                            </TabButton>
                        </div>

                        <PanelContent>
                            {rightRef === 'editor' && (
                                <>
                                    {builder.selection.length > 0 ? (
                                        <PropertiesPanel
                                            selection={builder.selection}
                                            elements={builder.elements}
                                            updateElement={builder.updateElement}
                                            trusteeData={trusteeData}
                                        />
                                    ) : (
                                        <div className="p-4">
                                            <SectionTitle>문서 설정</SectionTitle>

                                            <div className="text-sm text-slate-500 mb-6 leading-relaxed">
                                                이곳은 문서의 전체적인 속성을 설정하는 공간입니다.<br />
                                                현재는 특별한 설정이 필요하지 않습니다.
                                            </div>

                                            <div className="mt-8 p-3 bg-blue-50 rounded text-xs text-blue-700 leading-relaxed border border-blue-200">
                                                <h4 className="font-bold mb-1">💡 사용 팁</h4>
                                                <ul className="list-disc pl-3 space-y-1">
                                                    <li><strong>위임자 명단</strong>: 우측 '작업자 목록' 탭에서 작업자를 선택해 드래그하세요.</li>
                                                    <li><strong>일반 표</strong>: 직접 내용을 입력할 수 있는 빈 표를 추가합니다.</li>
                                                    <li>빈 곳을 클릭하면 이 화면으로 돌아옵니다.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {rightRef === 'workers' && (
                                <div className="h-full flex flex-col p-4">
                                    <div className="mb-4 p-3 rounded border border-slate-200 bg-slate-50">
                                        <div className="text-xs font-bold text-slate-600 mb-2">선택 작업자 단가 일괄 수정</div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                placeholder="단가"
                                                value={bulkUnitPrice}
                                                onChange={(e) => setBulkUnitPrice(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm border rounded bg-white"
                                            />
                                            <button
                                                onClick={handleApplyBulkUnitPrice}
                                                className="px-3 py-2 text-sm font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                            >
                                                적용
                                            </button>
                                        </div>
                                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 select-none">
                                            <input
                                                type="checkbox"
                                                checked={saveUnitPriceToDb}
                                                onChange={(e) => setSaveUnitPriceToDb(e.target.checked)}
                                            />
                                            DB에도 저장 (Firestore workers.unitPrice)
                                        </label>
                                    </div>

                                    {selectedWorkerIds.length > 0 && (
                                        <div className="mb-4">
                                            <div className="text-xs font-bold text-slate-600 mb-2">선택 작업자 (개별 수정)</div>
                                            <div className="max-h-44 overflow-auto border rounded border-slate-200 bg-white">
                                                {selectedWorkerIds.map(id => {
                                                    const w = workers.find(x => x.id === id);
                                                    if (!w) return null;
                                                    return (
                                                        <div key={id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0">
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium text-slate-700">{w.name}</div>
                                                                <div className="text-xs text-slate-400">{w.idNumber}</div>
                                                            </div>
                                                            <input
                                                                type="number"
                                                                value={w.unitPrice || 0}
                                                                onChange={(e) => {
                                                                    const n = Number(e.target.value);
                                                                    const next = Number.isFinite(n) ? n : 0;
                                                                    setWorkers(prev => prev.map(p => p.id === id ? { ...p, unitPrice: next } : p));
                                                                    updateDynamicTablesForWorker(id, { unitPrice: next });
                                                                }}
                                                                className="w-28 px-2 py-1 text-sm border rounded"
                                                            />
                                                            <button
                                                                onClick={() => saveSingleWorkerUnitPrice(id, Number(w.unitPrice || 0))}
                                                                className="px-2 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                                title="이 작업자만 DB에 저장"
                                                            >
                                                                저장
                                                            </button>
                                                            <button
                                                                onClick={() => applyUnitPriceToSelection(Number(w.unitPrice || 0), saveUnitPriceToDb)}
                                                                className="px-2 py-1 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-900"
                                                                title="현재 단가를 선택된 작업자 전체에 적용"
                                                            >
                                                                일괄
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <div className="relative mb-2">
                                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2.5 text-slate-400 text-sm" />
                                            <input
                                                type="text"
                                                placeholder="작업자 검색..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 text-sm border rounded"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 px-1">
                                            <span>총 {filteredWorkers.length}명</span>
                                            <button onClick={toggleAllWorkers} className="text-blue-600 hover:underline">
                                                전체 선택/해제
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto border rounded border-slate-200 bg-slate-50 p-1">
                                        {loadingWorkers ? (
                                            <div className="p-4 text-center text-slate-500 text-sm">로딩 중...</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {filteredWorkers.map(w => (
                                                    <DraggableWorkerItem
                                                        key={w.id}
                                                        worker={w}
                                                        isSelected={selectedWorkerIds.includes(w.id!)}
                                                        onClick={() => toggleWorker(w.id!)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </PanelContent>
                    </RightPanel>
                </MainContent>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeDragId && activeDragData?.type === 'worker' ? (
                        <div style={{ transform: 'none' }}>
                            <WorkerRowUI worker={activeDragData.worker} isDragging />
                        </div>
                    ) : null}
                </DragOverlay>

            </PageContainer>
        </DndContext>
    );
};

// Helper to clear localStorage
const handleDeleteTemplate = () => {
    if (window.confirm('모든 내용을 초기화하시겠습니까?')) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    }
};

export default DelegationBuilderPage;

// --- Styled Components ---

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f1f5f9;
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  z-index: 30;
  height: 50px;
`;

const ToolButton = styled.button<{ disabled?: boolean }>`
    display: flex;
    align-items: center;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    transition: all 0.1s;
    opacity: ${props => props.disabled ? 0.5 : 1};
    cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};

    &:hover {
        background: ${props => !props.disabled && '#f8fafc'};
        border-color: ${props => !props.disabled && '#cbd5e1'};
    }
    
    &:active {
        background: ${props => !props.disabled && '#f1f5f9'};
        transform: ${props => !props.disabled && 'translateY(1px)'};
    }
`;

const ZoomButton = styled(ToolButton) <{ $active?: boolean }>`
    padding: 4px 8px;
    border: none;
    background: ${props => props.$active ? '#e2e8f0' : 'transparent'};
    color: ${props => props.$active ? '#0f172a' : '#64748b'};
    
    &:hover {
        background: #e2e8f0;
    }
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
    display: flex;
    align-items: center;
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 4px;
    transition: all 0.1s;
    
    background: ${props => props.$primary ? '#2563eb' : 'white'};
    color: ${props => props.$primary ? 'white' : '#475569'};
    border: 1px solid ${props => props.$primary ? '#2563eb' : '#e2e8f0'};

    &:hover {
        background: ${props => props.$primary ? '#1d4ed8' : '#f8fafc'};
    }
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

// Left sidebar for tools
const LeftPanel = styled.div`
    width: 260px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    z-index: 20;
    overflow-y: auto;
    padding-bottom: 20px;
`;

const CanvasWrapper = styled.div<{ $isOver?: boolean }>`
  flex: 1;
  background: ${props => props.$isOver ? '#e0e7ff' : '#e2e8f0'}; // Visual feedback on drag over
  transition: background-color 0.2s;
  overflow: auto;
  position: relative;
  display: flex;
  flex-direction: column;
`;

const CanvasCentering = styled.div`
    flex: 1;
    display: flex;
    justify-content: center;
    padding: 40px;
    min-width: min-content; // Allow scrolling if canvas is large
`;

const CanvasInner = styled.div`
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transition: transform 0.1s ease-out; // Smoother zoom
`;

const A4Canvas = styled.div`
  position: relative;
  width: 210mm;
  height: 297mm;
  background: white;
  pointer-events: auto;
`;

const Placeholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const RightPanel = styled.div`
  width: 320px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  z-index: 20;
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const TabButton = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 12px;
    font-size: 13px;
    font-weight: 600;
    color: ${props => props.$active ? '#2563eb' : '#64748b'};
    border-bottom: 2px solid ${props => props.$active ? '#2563eb' : 'transparent'};
    background: ${props => props.$active ? '#eff6ff' : 'white'};
    transition: all 0.2s;

    &:hover {
        background: #f8fafc;
        color: #1e293b;
    }
`;

const SectionTitle = styled.h3`
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 12px;
`;

const SectionTitlePadded = styled(SectionTitle)`
    padding: 16px 16px 8px 16px;
    margin-bottom: 0;
`;

const InputGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
`;

const Label = styled.div`
    width: 80px;
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
`;

const Input = styled.input`
    flex: 1;
    padding: 6px 10px;
    font-size: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: #f8fafc;
    transition: all 0.2s;

    &:focus {
        outline: none;
        border-color: #3b82f6;
        background: white;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    
    &:hover {
        border-color: #cbd5e1;
    }
`;

const Divider = styled.div`
    height: 1px;
    background: #f1f5f9;
    margin: 12px 0;
`;

// New Styled Components for Left Panel
const ToolsGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0 16px;
`;

const PresetButton = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    color: #475569;
    transition: all 0.2s;

    &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        transform: translateY(-2px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
`;

const PresetIcon = styled.div`
    font-size: 20px;
    margin-bottom: 6px;
    color: #64748b;
`;

const PresetLabel = styled.div`
    font-size: 12px;
    font-weight: 500;
`;

const PresetList = styled.div`
    display: flex;
    flex-direction: column;
`;

const PresetRow = styled.button`
    display: flex;
    align-items: center;
    padding: 10px 16px;
    width: 100%;
    text-align: left;
    font-size: 13px;
    color: #334155;
    transition: all 0.1s;
    border-left: 2px solid transparent;

    &:hover {
        background: #f8fafc;
        color: #0f172a;
        border-left-color: #94a3b8;
    }
`;

// Ruler Positioners
const StickyRulerH = styled.div`
    position: sticky;
    top: 0;
    z-index: 10;
    margin-left: 20px; // Offset for vertical ruler width
`;

const StickyRulerV = styled.div`
    position: sticky;
    left: 0;
    z-index: 10;
    height: fit-content;
`;