import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDeleteLeft, faFloppyDisk, faPaste, faTrash } from '@fortawesome/free-solid-svg-icons';

const MEMORY_STORAGE_KEY = 'quickCalculator.memoryValues.v1';
const MAX_MEMORY_ITEMS = 8;

interface CalculatorMemoryItem {
    id: string;
    value: string;
    createdAt: number;
}

const isMemoryValue = (value: string) => {
    if (!value || value === 'Error') return false;
    return Number.isFinite(Number(value));
};

const formatEquationForDisplay = (value: string) => value
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/\s+/g, ' ')
    .trim();

const loadMemoryItems = (): CalculatorMemoryItem[] => {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item, index): CalculatorMemoryItem | null => {
                if (typeof item === 'string') {
                    return {
                        id: `legacy-${index}-${item}`,
                        value: item,
                        createdAt: Date.now() - index
                    };
                }

                if (item && typeof item.value === 'string') {
                    return {
                        id: typeof item.id === 'string' ? item.id : `memory-${index}-${item.value}`,
                        value: item.value,
                        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now() - index
                    };
                }

                return null;
            })
            .filter((item): item is CalculatorMemoryItem => item !== null && isMemoryValue(item.value))
            .slice(0, MAX_MEMORY_ITEMS);
    } catch {
        return [];
    }
};

const Calculator: React.FC = () => {
    const [display, setDisplay] = useState('0');
    const [equation, setEquation] = useState('');
    const [lastCalculation, setLastCalculation] = useState('');
    const [isNewNumber, setIsNewNumber] = useState(true);
    const [memoryItems, setMemoryItems] = useState<CalculatorMemoryItem[]>(loadMemoryItems);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);

    // Focus on mount (with retry)
    useEffect(() => {
        const attemptFocus = () => {
            if (containerRef.current) {
                containerRef.current.focus();
            }
        };

        attemptFocus();
        const timer = setTimeout(attemptFocus, 100); // Retry after render/animation
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memoryItems));
        } catch {
            // Ignore storage failures so the calculator remains usable.
        }
    }, [memoryItems]);

    const handleNumber = useCallback((num: string) => {
        setDisplay(prev => {
            if (num === '.') {
                if (!isNewNumber && prev.includes('.')) return prev;
                if (isNewNumber || prev === '0' || prev === 'Error') return '0.';
            }

            if (isNewNumber || prev === '0' || prev === 'Error') {
                return num;
            }
            return prev + num;
        });
        setIsNewNumber(false);
    }, [isNewNumber]);

    const handleOperator = useCallback((op: string) => {
        if (display === 'Error') return;

        setEquation(display + ' ' + op + ' ');
        setIsNewNumber(true);
    }, [display]);

    const calculate = useCallback(() => {
        if (!equation.trim()) return;

        try {
            const expression = equation + display;
            // Safe evaluation of the equation
            const cleanEquation = expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/');

            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + cleanEquation)();
            const resultDisplay = String(result);

            setLastCalculation(`${formatEquationForDisplay(expression)} = ${resultDisplay}`);
            setDisplay(resultDisplay);
            setEquation('');
            setIsNewNumber(true);
        } catch (error) {
            setDisplay('Error');
            setEquation('');
            setLastCalculation('');
            setIsNewNumber(true);
        }
    }, [equation, display]);

    const saveCurrentValue = useCallback(() => {
        if (!isMemoryValue(display)) return;

        const createdAt = Date.now();
        const memoryItem: CalculatorMemoryItem = {
            id: `memory-${createdAt}`,
            value: display,
            createdAt
        };

        setMemoryItems(prev => [
            memoryItem,
            ...prev.filter(item => item.value !== display)
        ].slice(0, MAX_MEMORY_ITEMS));
        setActiveKey('MS');
        setTimeout(() => setActiveKey(null), 150);
        containerRef.current?.focus();
    }, [display]);

    const pasteMemoryValue = useCallback((value: string, activeId = 'MR') => {
        if (!isMemoryValue(value)) return;

        setDisplay(value);
        setIsNewNumber(false);
        setActiveKey(activeId);
        setTimeout(() => setActiveKey(null), 150);
        containerRef.current?.focus();
    }, []);

    const deleteMemoryValue = useCallback((id: string) => {
        setMemoryItems(prev => prev.filter(item => item.id !== id));
        containerRef.current?.focus();
    }, []);

    const clearMemory = useCallback(() => {
        setMemoryItems([]);
        setActiveKey('MC');
        setTimeout(() => setActiveKey(null), 150);
        containerRef.current?.focus();
    }, []);

    const clear = useCallback(() => {
        setDisplay('0');
        setEquation('');
        setLastCalculation('');
        setIsNewNumber(true);
    }, []);

    const backspace = useCallback(() => {
        setDisplay(prev => {
            if (prev.length === 1 || isNewNumber) {
                return '0';
            }
            return prev.slice(0, -1);
        });
    }, [isNewNumber]);

    // Keyboard Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;

            const targetTag = target.tagName;

            // Smart blocking: Only block if it's a user-visible input
            // Handsontable often uses a hidden textarea for copy/paste/input
            // We want to block if the user is genuinely typing into a field.
            const isInput = (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || target.isContentEditable);

            // If specific keys (Enter, Esc) are pressed, we might want to consume them if Calculator is focused
            // But if generic typing, respect input focus.
            if (isInput) return;

            const key = e.key;
            let actionTaken = false;

            if (/[0-9]/.test(key)) {
                handleNumber(key);
                setActiveKey(key);
                actionTaken = true;
            } else if (['+', '-', '*', '/'].includes(key)) {
                handleOperator(key);
                setActiveKey(key);
                actionTaken = true;
            } else if (key === 'Enter' || key === '=') {
                e.preventDefault();
                calculate();
                setActiveKey('=');
                actionTaken = true;
            } else if (key === 'Escape') {
                clear();
                setActiveKey('C');
                actionTaken = true;
            } else if (key === 'Backspace') {
                backspace();
                setActiveKey('backspace');
                actionTaken = true;
            } else if (key === '.') {
                if (!display.includes('.')) {
                    handleNumber('.');
                    setActiveKey('.');
                    actionTaken = true;
                }
            }

            if (actionTaken) {
                // If we handled it, stop others from seeing it (e.g. global hotkeys)
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => setActiveKey(null), 150);
            }
        };

        // Use capture phase to catch events before some other aggressive listeners
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [handleNumber, handleOperator, calculate, clear, backspace, display]);

    const buttons = [
        { id: 'C', label: 'C', onClick: clear, className: 'text-red-500 font-bold' },
        { id: '/', label: '÷', onClick: () => handleOperator('/'), className: 'text-blue-400' },
        { id: '*', label: '×', onClick: () => handleOperator('*'), className: 'text-blue-400' },
        { id: 'backspace', label: <FontAwesomeIcon icon={faDeleteLeft} />, onClick: backspace, className: 'text-orange-400' },
        { id: '7', label: '7', onClick: () => handleNumber('7') },
        { id: '8', label: '8', onClick: () => handleNumber('8') },
        { id: '9', label: '9', onClick: () => handleNumber('9') },
        { id: '-', label: '-', onClick: () => handleOperator('-'), className: 'text-blue-400' },
        { id: '4', label: '4', onClick: () => handleNumber('4') },
        { id: '5', label: '5', onClick: () => handleNumber('5') },
        { id: '6', label: '6', onClick: () => handleNumber('6') },
        { id: '+', label: '+', onClick: () => handleOperator('+'), className: 'text-blue-400' },
        { id: '1', label: '1', onClick: () => handleNumber('1') },
        { id: '2', label: '2', onClick: () => handleNumber('2') },
        { id: '3', label: '3', onClick: () => handleNumber('3') },
        { id: '=', label: '=', onClick: calculate, className: 'row-span-2 bg-blue-600 text-white border-none', style: { height: '100%' } },
        { id: '0', label: '0', onClick: () => handleNumber('0'), className: 'col-span-2' },
        { id: '.', label: '.', onClick: () => handleNumber('.') },
    ];

    const latestMemoryValue = memoryItems[0]?.value;
    const canSaveDisplay = isMemoryValue(display);
    const currentEquation = equation
        ? formatEquationForDisplay(equation + (isNewNumber ? '' : display))
        : '';
    const memoryActionButtonClass = 'min-h-[38px] rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-[11px] font-semibold text-gray-200 transition-all hover:bg-gray-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div
            ref={containerRef}
            className="w-full h-full min-h-[560px] flex flex-col p-4 bg-gray-900 rounded-lg shadow-xl border border-gray-700 outline-none focus:ring-2 focus:ring-blue-500/50"
            tabIndex={0}
            onClick={() => containerRef.current?.focus()}
        >
            {/* Display */}
            <div className="bg-gray-800 p-4 rounded-lg mb-4 text-right transition-colors border border-transparent">
                <div
                    className="h-4 mb-1 truncate text-[11px] text-gray-500"
                    data-testid="calculator-last-calculation"
                >
                    {lastCalculation}
                </div>
                <div
                    className="h-6 truncate text-sm text-gray-400"
                    data-testid="calculator-equation"
                >
                    {currentEquation}
                </div>
                <div
                    className="text-white text-4xl font-mono tracking-wider overflow-hidden text-ellipsis"
                    data-testid="calculator-display"
                >
                    {display}
                </div>
            </div>

            {/* Memory controls */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                    type="button"
                    onClick={saveCurrentValue}
                    disabled={!canSaveDisplay}
                    className={`${memoryActionButtonClass} ${activeKey === 'MS' ? 'border-emerald-500 bg-emerald-900/50 text-emerald-100' : ''}`}
                    title="현재 결과값 저장"
                >
                    <FontAwesomeIcon icon={faFloppyDisk} className="mr-1" />
                    결과 저장
                </button>
                <button
                    type="button"
                    onClick={() => latestMemoryValue && pasteMemoryValue(latestMemoryValue)}
                    disabled={!latestMemoryValue}
                    className={`${memoryActionButtonClass} ${activeKey === 'MR' ? 'border-blue-500 bg-blue-900/50 text-blue-100' : ''}`}
                    title="최근 저장값 붙여넣기"
                >
                    <FontAwesomeIcon icon={faPaste} className="mr-1" />
                    최근값
                </button>
                <button
                    type="button"
                    onClick={clearMemory}
                    disabled={memoryItems.length === 0}
                    className={`${memoryActionButtonClass} ${activeKey === 'MC' ? 'border-red-500 bg-red-900/50 text-red-100' : ''}`}
                    title="저장값 전체 삭제"
                >
                    <FontAwesomeIcon icon={faTrash} className="mr-1" />
                    전체삭제
                </button>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-3 flex-1">
                {buttons.map((btn, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={btn.onClick}
                        className={`
                            rounded-lg p-4 text-xl font-semibold transition-all duration-100
                            border border-gray-700 bg-gray-800
                            ${activeKey === btn.id ? 'bg-gray-600 scale-95 border-gray-500' : 'hover:bg-opacity-80 active:scale-95'}
                            ${btn.id === '=' && activeKey === '=' ? 'bg-blue-700' : ''}
                            ${btn.className || 'text-white'}
                            flex items-center justify-center
                        `}
                        style={btn.style}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-300">저장된 값</span>
                    <span className="text-[10px] text-gray-500">최대 {MAX_MEMORY_ITEMS}개</span>
                </div>

                {memoryItems.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-700 px-3 py-3 text-center text-xs text-gray-500">
                        저장된 결과값이 없습니다
                    </div>
                ) : (
                    <div className="max-h-32 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {memoryItems.map(item => (
                            <div
                                key={item.id}
                                className={`flex items-center gap-2 rounded-md border bg-gray-900/80 p-2 transition-colors ${activeKey === item.id ? 'border-blue-500' : 'border-gray-700'}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => pasteMemoryValue(item.value, item.id)}
                                    className="min-w-0 flex-1 text-left"
                                    title="계산기에 붙여넣기"
                                >
                                    <span className="block truncate font-mono text-sm text-white">{item.value}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => pasteMemoryValue(item.value, item.id)}
                                    className="h-8 shrink-0 rounded-md border border-blue-500/40 px-2 text-[11px] font-semibold text-blue-200 transition-colors hover:bg-blue-500/15"
                                    title="계산기에 붙여넣기"
                                >
                                    <FontAwesomeIcon icon={faPaste} className="mr-1" />
                                    붙여넣기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => deleteMemoryValue(item.id)}
                                    className="h-8 w-8 shrink-0 rounded-md text-gray-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
                                    aria-label={`${item.value} 삭제`}
                                    title="저장값 삭제"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-2 text-center">
                <span className="text-[10px] text-gray-500">
                    Click here if keyboard inputs are not detected
                </span>
            </div>
        </div>
    );
};

export default Calculator;
