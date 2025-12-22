import { useState, useCallback, useRef, useMemo } from 'react';

interface HistoryState<T> {
    past: T[];
    present: T | null;
    future: T[];
}

interface HistoryActions<T> {
    set: (newPresent: T, skipHistory?: boolean) => void;
    undo: () => T | null;
    redo: () => T | null;
    canUndo: boolean;
    canRedo: boolean;
    clear: () => void;
}

const MAX_HISTORY_SIZE = 50;

/**
 * useHistory - Undo/Redo 기능을 제공하는 커스텀 훅
 * 
 * @param initialPresent - 초기 상태 값
 * @returns [현재 상태, 히스토리 액션들]
 */
export function useHistory<T>(initialPresent: T | null = null): [T | null, HistoryActions<T>] {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialPresent,
        future: []
    });

    // 마지막 저장 시간 추적 (debounce용)
    const lastSaveTime = useRef<number>(0);
    const DEBOUNCE_MS = 300;

    const set = useCallback((newPresent: T, skipHistory: boolean = false) => {
        const now = Date.now();

        setState(currentState => {
            // skipHistory가 true이면 히스토리에 추가하지 않음 (초기 로드, 외부 동기화 등)
            if (skipHistory || currentState.present === null) {
                return {
                    ...currentState,
                    present: newPresent
                };
            }

            // Debounce: 너무 빠른 연속 변경은 히스토리에 합침
            const shouldMerge = now - lastSaveTime.current < DEBOUNCE_MS;
            lastSaveTime.current = now;

            if (shouldMerge && currentState.past.length > 0) {
                // 마지막 past 항목을 유지하고 present만 업데이트
                return {
                    ...currentState,
                    present: newPresent,
                    future: [] // Redo 가능 영역 초기화
                };
            }

            // 새로운 히스토리 항목 추가
            const newPast = [...currentState.past, currentState.present];

            // 히스토리 크기 제한
            if (newPast.length > MAX_HISTORY_SIZE) {
                newPast.shift();
            }

            return {
                past: newPast,
                present: newPresent,
                future: [] // 새 변경 시 redo 스택 초기화
            };
        });
    }, []);

    const undo = useCallback((): T | null => {
        let undoneState: T | null = null;

        setState(currentState => {
            if (currentState.past.length === 0) {
                return currentState;
            }

            const previous = currentState.past[currentState.past.length - 1];
            const newPast = currentState.past.slice(0, -1);

            undoneState = previous;

            return {
                past: newPast,
                present: previous,
                future: currentState.present !== null
                    ? [currentState.present, ...currentState.future]
                    : currentState.future
            };
        });

        return undoneState;
    }, []);

    const redo = useCallback((): T | null => {
        let redoneState: T | null = null;

        setState(currentState => {
            if (currentState.future.length === 0) {
                return currentState;
            }

            const next = currentState.future[0];
            const newFuture = currentState.future.slice(1);

            redoneState = next;

            return {
                past: currentState.present !== null
                    ? [...currentState.past, currentState.present]
                    : currentState.past,
                present: next,
                future: newFuture
            };
        });

        return redoneState;
    }, []);

    const clear = useCallback(() => {
        setState(currentState => ({
            past: [],
            present: currentState.present,
            future: []
        }));
    }, []);

    // useMemo로 actions 객체를 안정화하여 매 렌더링마다 새 객체가 생성되지 않도록 함
    const actions = useMemo<HistoryActions<T>>(() => ({
        set,
        undo,
        redo,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
        clear
    }), [set, undo, redo, state.past.length, state.future.length, clear]);

    return [state.present, actions];
}

export default useHistory;
