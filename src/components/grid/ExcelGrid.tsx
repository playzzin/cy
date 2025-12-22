import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { getColumnLabel, parseTSV, generateTSV } from '../../utils/excelUtils';

interface CellData {
    value: string | number;
    formula?: string;
    style?: React.CSSProperties;
}

interface ExcelGridProps {
    initialData?: CellData[][];
    rowCount?: number;
    colCount?: number;
    onDataChange?: (data: CellData[][]) => void;
    columnHeaders?: string[];
}

const ExcelGrid: React.FC<ExcelGridProps> = ({
    initialData,
    rowCount = 50,
    colCount = 26,
    onDataChange,
    columnHeaders
}) => {
    // State
    const [data, setData] = useState<CellData[][]>(() => {
        if (initialData) return initialData;
        return Array(rowCount).fill(null).map(() => Array(colCount).fill({ value: '' }));
    });

    const [selection, setSelection] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } }>({ start: { r: 0, c: 0 }, end: { r: 0, c: 0 } });
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [inputStyle, setInputStyle] = useState<React.CSSProperties>({ display: 'none' });

    const gridRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isCommitting = useRef(false);

    // Sync data with initialData
    useEffect(() => {
        if (initialData) {
            setData(initialData);
        }
    }, [initialData]);

    // Position the Input over the selected cell
    useLayoutEffect(() => {
        if (!gridRef.current || !selection) return;

        const { start } = selection;
        const cell = gridRef.current.querySelector(`td[data-r="${start.r}"][data-c="${start.c}"]`) as HTMLElement;

        if (cell) {
            const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = cell;
            setInputStyle({
                display: 'block',
                left: offsetLeft,
                top: offsetTop,
                width: offsetWidth,
                height: offsetHeight,
                opacity: isEditing ? 1 : 0,
                zIndex: isEditing ? 30 : 10, // Above cell content
            });

            // Ensure input is focused
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [selection, isEditing]);

    // Update input value when selection changes (if not editing)
    useEffect(() => {
        if (!isEditing && selection) {
            const cell = data[selection.start.r][selection.start.c];
            setEditValue(String(cell.value));
        }
    }, [selection, isEditing, data]);

    // Commit Logic
    const commitEdit = useCallback(() => {
        if (isCommitting.current) return;
        isCommitting.current = true;

        const { start } = selection;
        const newData = [...data];
        newData[start.r] = [...newData[start.r]];

        let val: string | number = editValue;
        if (!isNaN(Number(val)) && val !== '') {
            val = Number(val);
        }

        newData[start.r][start.c] = {
            ...newData[start.r][start.c],
            value: val
        };

        setData(newData);
        if (onDataChange) onDataChange(newData);
        setIsEditing(false);

        setTimeout(() => {
            isCommitting.current = false;
        }, 0);
    }, [data, editValue, selection, onDataChange]);

    // Input Key Handler (The Core Logic)
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // 1. Navigation (only if NOT editing, or special keys)
        const { key, shiftKey, ctrlKey, metaKey } = e;
        const isCmd = ctrlKey || metaKey;

        if (!isEditing) {
            // Navigation Keys
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab' || key === 'Enter') {
                e.preventDefault();
                handleNavigation(key, shiftKey, isCmd);
                return;
            }

            // Delete
            if (key === 'Delete' || key === 'Backspace') {
                e.preventDefault();
                deleteSelection();
                return;
            }

            // F2 -> Start Editing (Append)
            if (key === 'F2') {
                e.preventDefault();
                setIsEditing(true);
                return;
            }

            // Copy/Paste handled by native events or window listeners

            // Typing (Any other key)
            // We DO NOT preventDefault. We let the input capture the key.
            // We DO NOT set isEditing(true) here. We let onChange handle it.
            // This ensures the first character (especially IME) is captured correctly.
        } else {
            // Editing Mode
            if (key === 'Enter') {
                e.preventDefault();
                commitEdit();
                handleNavigation('Enter', shiftKey, false);
            } else if (key === 'Tab') {
                e.preventDefault();
                commitEdit();
                handleNavigation('Tab', shiftKey, false);
            } else if (key === 'Escape') {
                e.preventDefault();
                setIsEditing(false);
                // Revert value logic
                const cell = data[selection.start.r][selection.start.c];
                setEditValue(''); // Clear for nav mode
            } else if (key === 'ArrowUp' || key === 'ArrowDown') {
                e.preventDefault();
                commitEdit();
                handleNavigation(key, false, false);
            }
        }
    };

    // Refined: When selection changes, clear input if not editing
    useEffect(() => {
        if (!isEditing) {
            setEditValue('');
        }
    }, [selection, isEditing]);

    // Special Case: F2 needs to populate value
    const handleKeyDownCapture = (e: React.KeyboardEvent) => {
        if (e.key === 'F2' && !isEditing) {
            const cell = data[selection.start.r][selection.start.c];
            setEditValue(String(cell.value));
        }
    };

    const handleNavigation = (key: string, shift: boolean, cmd: boolean) => {
        const { start } = selection;
        let dr = 0;
        let dc = 0;

        if (key === 'ArrowUp') dr = -1;
        if (key === 'ArrowDown') dr = 1;
        if (key === 'ArrowLeft') dc = -1;
        if (key === 'ArrowRight') dc = 1;
        if (key === 'Enter') dr = shift ? -1 : 1;
        if (key === 'Tab') dc = shift ? -1 : 1;

        if (cmd) {
            if (dr !== 0) dr *= rowCount;
            if (dc !== 0) dc *= colCount;
        }

        const newR = Math.max(0, Math.min(rowCount - 1, start.r + dr));
        const newC = Math.max(0, Math.min(colCount - 1, start.c + dc));

        setSelection({ start: { r: newR, c: newC }, end: { r: newR, c: newC } });
    };

    const deleteSelection = () => {
        const { start, end } = selection;
        const minR = Math.min(start.r, end.r);
        const maxR = Math.max(start.r, end.r);
        const minC = Math.min(start.c, end.c);
        const maxC = Math.max(start.c, end.c);

        const newData = [...data];
        for (let r = minR; r <= maxR; r++) {
            newData[r] = [...newData[r]];
            for (let c = minC; c <= maxC; c++) {
                newData[r][c] = { ...newData[r][c], value: '' };
            }
        }
        setData(newData);
        if (onDataChange) onDataChange(newData);
    };

    // Mouse Handling (Selection)
    const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (isEditing) {
            commitEdit();
        }
        setSelection({ start: { r, c }, end: { r, c } });
    };

    const handleMouseEnter = (r: number, c: number, e: React.MouseEvent) => {
        if (e.buttons === 1) { // Dragging
            setSelection(prev => ({ ...prev, end: { r, c } }));
        }
    };

    const handleDoubleClick = () => {
        const cell = data[selection.start.r][selection.start.c];
        setEditValue(String(cell.value));
        setIsEditing(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value);
        if (!isEditing) {
            setIsEditing(true);
        }
    };

    return (
        <div className="w-full h-full overflow-auto select-none bg-white border border-slate-300 relative" ref={gridRef}>
            {/* The Persistent Input */}
            <input
                ref={inputRef}
                type="text"
                className="absolute outline-none px-2 py-1 text-sm font-normal border-2 border-blue-500 bg-white"
                style={{
                    ...inputStyle,
                    color: isEditing ? 'inherit' : 'transparent',
                    caretColor: isEditing ? 'auto' : 'transparent',
                    borderColor: isEditing ? '#3b82f6' : 'transparent',
                    backgroundColor: isEditing ? 'white' : 'transparent',
                }}
                value={editValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onKeyDownCapture={handleKeyDownCapture}
            />

            <table className="border-collapse w-full table-fixed">
                <thead>
                    <tr>
                        <th className="w-10 bg-slate-100 border border-slate-300 sticky top-0 left-0 z-20"></th>
                        {Array(colCount).fill(0).map((_, i) => (
                            <th key={i} className="bg-slate-100 border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 min-w-[80px] sticky top-0 z-10">
                                {columnHeaders ? (columnHeaders[i] || getColumnLabel(i)) : getColumnLabel(i)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, r) => (
                        <tr key={r}>
                            <td className="bg-slate-50 border border-slate-300 text-center text-xs text-slate-500 font-medium sticky left-0 z-10">
                                {r + 1}
                            </td>
                            {row.map((cell, c) => {
                                const isSelected = r >= Math.min(selection.start.r, selection.end.r) &&
                                    r <= Math.max(selection.start.r, selection.end.r) &&
                                    c >= Math.min(selection.start.c, selection.end.c) &&
                                    c <= Math.max(selection.start.c, selection.end.c);
                                const isFocused = selection.start.r === r && selection.start.c === c;

                                return (
                                    <td
                                        key={c}
                                        data-r={r}
                                        data-c={c}
                                        className={`
                                            border border-slate-200 px-2 py-1 text-sm relative cursor-cell
                                            ${isSelected ? 'bg-blue-50' : ''}
                                            ${isFocused ? 'ring-2 ring-blue-500 z-0' : ''} 
                                        `}
                                        onMouseDown={(e) => handleMouseDown(r, c, e)}
                                        onMouseEnter={(e) => handleMouseEnter(r, c, e)}
                                        onDoubleClick={handleDoubleClick}
                                    >
                                        <div className="truncate min-h-[20px]">
                                            {cell.value}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ExcelGrid;
