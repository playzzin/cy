import { useState, useCallback, useRef } from 'react';
import { produce } from 'immer';
import { BuilderElement } from './types';

interface UseBuilderReturn {
    elements: BuilderElement[];
    selection: string[];
    addElement: (type: 'text' | 'table', initialProps?: Partial<BuilderElement>) => void;
    updateElement: (id: string, updates: Partial<BuilderElement>) => void;
    updateSelection: (id: string | null, multi?: boolean) => void;
    deleteSelection: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    setElements: (elements: BuilderElement[]) => void;
    moveSelection: (dx: number, dy: number) => void;
}

const MAX_HISTORY = 50;

export const useBuilder = (initialElements: BuilderElement[] = []): UseBuilderReturn => {
    const [elements, _setElements] = useState<BuilderElement[]>(initialElements);
    const [selection, setSelection] = useState<string[]>([]);

    // History
    const historyRef = useRef<{ past: BuilderElement[][]; future: BuilderElement[][] }>({
        past: [],
        future: []
    });

    // Helper to push state to history
    const pushHistory = (newElements: BuilderElement[]) => {
        const { past } = historyRef.current;
        const newPast = [...past, elements];
        if (newPast.length > MAX_HISTORY) newPast.shift();

        historyRef.current = {
            past: newPast,
            future: []
        };
        _setElements(newElements);
    };

    const addElement = useCallback((type: 'text' | 'table', initialProps: Partial<BuilderElement> = {}) => {
        const newElement: BuilderElement = {
            id: `${type}-${Date.now()}`,
            type,
            x: 10,
            y: 10,
            width: type === 'table' ? 180 : 60,
            height: type === 'table' ? 50 : 10,
            isSelected: false,
            style: {
                fontSize: 10,
                fontWeight: 'normal',
                textAlign: 'left',
                color: '#000000',
                ...initialProps.style
            },
            content: {
                text: type === 'text' ? '텍스트를 입력하세요' : '',
                ...initialProps.content
            },
            ...initialProps
        };

        pushHistory([...elements, newElement]);
        setSelection([newElement.id]);
    }, [elements]);

    const updateElement = useCallback((id: string, updates: Partial<BuilderElement>) => {
        const nextElements = produce(elements, draft => {
            const index = draft.findIndex(el => el.id === id);
            if (index !== -1) {
                // Merge top-level properties
                Object.assign(draft[index], updates);
                // Merge nested style if provided
                if (updates.style) {
                    draft[index].style = { ...draft[index].style, ...updates.style };
                }
                // Merge nested content if provided
                if (updates.content) {
                    draft[index].content = { ...draft[index].content, ...updates.content };
                }
            }
        });

        // Optimize history: Don't push if nothing changed (deep check is expensive, assume 'updates' intends change)
        // For dragging, we might want to debounce history pushing, but for now strict strict simple.
        // Actually for high-freq updates like drag, this might be too heavy. 
        // usually drag -> temp state -> dragEnd -> history push.
        // We will assume 'updateElement' is called on dragEnd.

        pushHistory(nextElements);
    }, [elements]);

    const updateSelection = useCallback((id: string | null, multi: boolean = false) => {
        if (id === null) {
            setSelection([]);
            return;
        }
        if (multi) {
            setSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        } else {
            setSelection([id]);
        }
    }, []);

    const deleteSelection = useCallback(() => {
        if (selection.length === 0) return;

        const nextElements = elements.filter(el => !selection.includes(el.id));
        pushHistory(nextElements);
        setSelection([]);
    }, [elements, selection]);

    const undo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (past.length === 0) return;

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);

        historyRef.current = {
            past: newPast,
            future: [elements, ...future]
        };
        _setElements(previous);
    }, [elements]);

    const moveSelection = useCallback((dx: number, dy: number) => {
        if (selection.length === 0) return;

        const nextElements = produce(elements, draft => {
            draft.forEach(el => {
                if (selection.includes(el.id)) {
                    el.x += dx;
                    el.y += dy;
                }
            });
        });

        // Update state directly without history for every pixel move if it's continuous? 
        // For Nudge (keyboard), we usually want history.
        // Let's push to history for now, or maybe debounce it?
        // For keyboard nudge, individual key presses are distinct actions, so history is fine.
        pushHistory(nextElements);
    }, [elements, selection]);

    const redo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (future.length === 0) return;

        const next = future[0];
        const newFuture = future.slice(1);

        historyRef.current = {
            past: [...past, elements],
            future: newFuture
        };
        _setElements(next);
    }, [elements]);

    return {
        elements,
        selection,
        addElement,
        updateElement,
        updateSelection,
        deleteSelection,
        undo,
        redo,
        canUndo: historyRef.current.past.length > 0,
        canRedo: historyRef.current.future.length > 0,
        setElements: (els) => {
            pushHistory(els);
            setSelection([]);
        },
        moveSelection
    };
};
