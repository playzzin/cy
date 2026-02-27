import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faChevronRight, faChartPie, faCircle, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { MenuItem } from '../../types/menu';
import { resolveIcon } from '../../constants/iconMap';

interface SidebarSubmenuProps {
    item: MenuItem;
    top: number;
    menuPaths: { [key: string]: string };
    onClose: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onItemClick: (path: string) => void;
    onOpenInNewWindow: (path: string) => void;
    isActiveCheck: (path: string | undefined) => boolean;
}

export const SidebarSubmenu: React.FC<SidebarSubmenuProps> = ({
    item,
    top,
    menuPaths,
    onClose,
    onMouseEnter,
    onMouseLeave,
    onItemClick,
    onOpenInNewWindow,
    isActiveCheck
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedTop, setAdjustedTop] = useState(top);

    useEffect(() => {
        if (menuRef.current) {
            const height = menuRef.current.offsetHeight;
            const windowHeight = window.innerHeight;
            // Ensure at least 20px padding from bottom
            const maxTop = windowHeight - height - 20;
            // Ensure not negative
            const newTop = Math.max(10, Math.min(top, maxTop));
            setAdjustedTop(newTop);
        }
    }, [top, item.sub]); // Re-calculate when item changes

    const headerColor = item.activeColor || '#1abc9c';

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[250] w-64 bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden transition-all duration-200"
            style={{
                top: `${adjustedTop}px`,
                left: '70px', // slightly offset from collapsed sidebar
                animation: 'submenu-slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700/50">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <FontAwesomeIcon
                        icon={resolveIcon(item.icon)}
                        style={{ color: headerColor }}
                        className="w-4 h-4 opacity-100" // Ensure visible
                    />
                    <span>{item.text}</span>
                </div>
                {/* Close button mostly for mobile or explicit intent, though hover usually handles it */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>

            {/* Content List */}
            <div className="py-2 max-h-[70vh] overflow-y-auto custom-scrollbar flex flex-col">
                {item.sub?.map((subItem: string | MenuItem, idx: number) => {
                    // Normalize Sub Item
                    let isLeaf = false;
                    let text = '';
                    let path = '';
                    let iconFn = undefined;
                    let activeColor = '#f59e0b';
                    let iconColor = undefined;
                    let subChildren: (string | MenuItem)[] = [];

                    if (typeof subItem === 'string') {
                        isLeaf = true;
                        text = subItem;
                        path = menuPaths[subItem] || '';
                        iconFn = faCircle; // Default fallback for string items
                    } else {
                        const mi = subItem as MenuItem;
                        text = mi.text;
                        iconFn = mi.icon ? resolveIcon(mi.icon) : faCircle; // Default fallback if no icon
                        activeColor = mi.activeColor || '#f59e0b';
                        iconColor = mi.iconColor;

                        if (!mi.sub || mi.sub.length === 0) {
                            isLeaf = true;
                            path = mi.path || menuPaths[text] || '';
                        } else {
                            isLeaf = false;
                            subChildren = mi.sub;
                        }
                    }

                    if (isLeaf) {
                        const active = isActiveCheck(path);
                        const canOpenInNewWindow = Boolean(path);
                        return (
                            <div key={`sub-${idx}`} className="relative group">
                                <button
                                    onClick={() => path && onItemClick(path)}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-all flex items-center gap-3
                                    ${canOpenInNewWindow ? 'pr-10' : ''}
                                    ${active
                                        ? 'bg-slate-700/50 text-white font-semibold border-l-2'
                                        : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border-l-2 border-transparent hover:pl-5'
                                    }`}
                                    style={{ borderColor: active ? activeColor : 'transparent' }}
                                >
                                    <FontAwesomeIcon
                                        icon={iconFn}
                                        style={{ color: active ? activeColor : iconColor }}
                                        className={iconFn === faCircle ? "w-1.5 h-1.5 opacity-50" : "w-3 h-3"}
                                    />
                                    <span className={active ? '' : ''}>{text}</span>
                                </button>

                                {canOpenInNewWindow && (
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                                        title={`${text} 새창 열기`}
                                        aria-label={`${text} 새창 열기`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onOpenInNewWindow(path);
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faUpRightFromSquare} className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    } else {
                        // Render Group (Nested)
                        return (
                            <div key={`group-${idx}`} className="mt-2 mb-1">
                                <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <FontAwesomeIcon
                                        icon={iconFn || faCircle}
                                        className={(iconFn === faCircle || !iconFn) ? "w-1.5 h-1.5 opacity-50" : "w-3 h-3 opacity-70"}
                                    />
                                    {text}
                                </div>
                                <div className="flex flex-col ml-2 border-l border-slate-700/50 space-y-0.5">
                                    {subChildren.map((child: string | MenuItem, cIdx) => {
                                        let cText = '';
                                        let cPath = '';

                                        if (typeof child === 'string') {
                                            cText = child;
                                            cPath = menuPaths[child] || '';
                                        } else {
                                            cText = child.text;
                                            cPath = child.path || menuPaths[cText] || '';
                                        }

                                        const cActive = isActiveCheck(cPath);
                                        const canOpenInNewWindow = Boolean(cPath);
                                        return (
                                            <div key={`child-${cIdx}`} className="relative group">
                                                <button
                                                    onClick={() => cPath && onItemClick(cPath)}
                                                    className={`w-full text-left pl-4 py-2 text-sm transition-all flex items-center
                                                    ${canOpenInNewWindow ? 'pr-10' : 'pr-3'}
                                                    ${cActive
                                                        ? 'text-white font-medium'
                                                        : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors ${cActive ? 'bg-indigo-500' : 'bg-slate-600 group-hover:bg-slate-500'}`}></span>
                                                    {cText}
                                                </button>

                                                {canOpenInNewWindow && (
                                                    <button
                                                        type="button"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                                                        title={`${cText} 새창 열기`}
                                                        aria-label={`${cText} 새창 열기`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onOpenInNewWindow(cPath);
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faUpRightFromSquare} className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }
                })}
            </div>

            <style>{`
                @keyframes submenu-slide-in {
                    from { opacity: 0; transform: translateX(-8px) scale(0.98); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
            `}</style>
        </div>,
        document.body
    );
};
