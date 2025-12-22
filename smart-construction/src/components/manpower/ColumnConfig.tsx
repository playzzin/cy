import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faXmark, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Column {
    id: string;
    label: string;
    fixed?: boolean;
}

interface ColumnConfigProps {
    isOpen: boolean;
    onClose: () => void;
    columns: Column[];
    visibleColumns: string[];
    onToggleColumn: (colId: string) => void;
    onDragEnd: (event: DragEndEvent) => void;
}

function SortableItem(props: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {props.children}
        </div>
    );
}

const ColumnConfig: React.FC<ColumnConfigProps> = ({
    isOpen,
    onClose,
    columns,
    visibleColumns,
    onToggleColumn,
    onDragEnd
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!isOpen) return null;

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCog} className="text-slate-400" />
                    테이블 열 설정
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={columns.filter(c => !c.fixed).map(c => c.id)}
                        strategy={rectSortingStrategy}
                    >
                        {columns.filter(c => !c.fixed).map(column => (
                            <SortableItem key={column.id} id={column.id}>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
                                    <div className="flex items-center gap-2">
                                        <FontAwesomeIcon icon={faGripVertical} className="text-slate-300" />
                                        <span className="font-medium text-slate-700">{column.label}</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.includes(column.id)}
                                        onChange={() => onToggleColumn(column.id)}
                                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                        onPointerDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </SortableItem>
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
};

export default ColumnConfig;
