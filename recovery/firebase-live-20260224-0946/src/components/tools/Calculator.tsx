import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDeleteLeft } from '@fortawesome/free-solid-svg-icons';

const Calculator: React.FC = () => {
    const [display, setDisplay] = useState('0');
    const [equation, setEquation] = useState('');
    const [isNewNumber, setIsNewNumber] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('');

    // Focus on mount (with retry)
    useEffect(() => {
        const attemptFocus = () => {
            if (containerRef.current) {
                containerRef.current.focus();
                // Check if focus succeeded
                if (document.activeElement === containerRef.current) {
                    setDebugInfo('Ready');
                } else {
                    setDebugInfo(`Focus: ${document.activeElement?.tagName}`);
                }
            }
        };

        attemptFocus();
        const timer = setTimeout(attemptFocus, 100); // Retry after render/animation
        return () => clearTimeout(timer);
    }, []);

    const handleNumber = useCallback((num: string) => {
        setDisplay(prev => {
            if (isNewNumber || prev === '0') {
                return num;
            }
            return prev + num;
        });
        setIsNewNumber(false);
    }, [isNewNumber]);

    const handleOperator = useCallback((op: string) => {
        setEquation(display + ' ' + op + ' ');
        setIsNewNumber(true);
    }, [display]);

    const calculate = useCallback(() => {
        try {
            // Safe evaluation of the equation
            const cleanEquation = (equation + display)
                .replace(/×/g, '*')
                .replace(/÷/g, '/');

            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + cleanEquation)();

            setDisplay(String(result));
            setEquation('');
            setIsNewNumber(true);
        } catch (error) {
            setDisplay('Error');
            setEquation('');
            setIsNewNumber(true);
        }
    }, [equation, display]);

    const clear = useCallback(() => {
        setDisplay('0');
        setEquation('');
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

            // Logging for debug
            const targetTag = target.tagName;
            setDebugInfo(`Target: ${targetTag} (${target.className.slice(0, 10)}...)`);

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

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex flex-col p-4 bg-gray-900 rounded-lg shadow-xl border border-gray-700 outline-none focus:ring-2 focus:ring-blue-500/50"
            tabIndex={0}
            onClick={() => containerRef.current?.focus()}
        >
            {/* Display */}
            <div className="bg-gray-800 p-4 rounded-lg mb-4 text-right transition-colors border border-transparent">
                <div className="text-gray-500 text-[10px] h-4 mb-1">{debugInfo}</div>
                <div className="text-gray-400 text-sm h-6">{equation}</div>
                <div className="text-white text-4xl font-mono tracking-wider overflow-hidden text-ellipsis">{display}</div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-3 flex-1">
                {buttons.map((btn, idx) => (
                    <button
                        key={idx}
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

            <div className="mt-2 text-center">
                <span className="text-[10px] text-gray-500">
                    Click here if keyboard inputs are not detected
                </span>
            </div>
        </div>
    );
};

export default Calculator;
