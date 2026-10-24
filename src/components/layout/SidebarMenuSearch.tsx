import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { MenuItem } from '../../types/menu';
import './SidebarMenuSearch.css';

interface SidebarMenuSearchProps {
    enabled: boolean;
    collapsed: boolean;
    // Receive only the menu entries already filtered by the sidebar's permissions.
    items: MenuItem[];
    menuPaths: Record<string, string>;
    displayText: (text: string) => string;
    isActive: (path: string) => boolean;
    onNavigate: (path: string) => void;
    onExpand?: () => void;
    children: React.ReactNode;
}

interface SearchResult {
    label: string;
    path: string;
    parents: string[];
}

const normalizeSearch = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');

const SidebarMenuSearch: React.FC<SidebarMenuSearchProps> = ({
    enabled, collapsed, items, menuPaths, displayText, isActive, onNavigate, onExpand, children
}) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const focusOnExpand = useRef(false);
    const searchTerm = normalizeSearch(query);
    const isSearching = enabled && !collapsed && searchTerm.length > 0;

    useEffect(() => {
        if (!collapsed && focusOnExpand.current) {
            inputRef.current?.focus();
            focusOnExpand.current = false;
        }
    }, [collapsed]);

    const results = useMemo(() => {
        if (!isSearching) return [];
        const matches: SearchResult[] = [];
        const visit = (entries: (MenuItem | string)[], parents: string[]) => {
            entries.forEach(entry => {
                if (typeof entry !== 'string' && entry.hide) return;
                const rawText = typeof entry === 'string' ? entry : entry.text;
                if (rawText === '-') return;
                const label = displayText(rawText);
                if (typeof entry !== 'string' && entry.sub?.length) {
                    visit(entry.sub, [...parents, label]);
                    return;
                }
                const path = typeof entry === 'string' ? menuPaths[entry] : entry.path || menuPaths[entry.text];
                if (path && normalizeSearch([...parents, label].join(' ')).includes(searchTerm)) {
                    matches.push({ label, path, parents });
                }
            });
        };
        visit(items, []);
        return matches;
    }, [isSearching, items, menuPaths, displayText, searchTerm]);

    const clearSearch = () => {
        setQuery('');
        inputRef.current?.focus();
    };

    if (!enabled) return <>{children}</>;

    return (
        <>
            {collapsed ? (
                <button
                    type="button"
                    className="sidebar-search-expand"
                    aria-label="메뉴 검색 열기"
                    title="메뉴 검색"
                    onClick={() => {
                        focusOnExpand.current = true;
                        onExpand?.();
                    }}
                >
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
            ) : (
                <div className="sidebar-search-field" role="search" aria-label="사이드 메뉴 검색">
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                    <input
                        ref={inputRef}
                        type="search"
                        aria-label="메뉴 검색"
                        placeholder="메뉴 검색"
                        value={query}
                        autoComplete="off"
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                clearSearch();
                            }
                        }}
                    />
                    {query && (
                        <button type="button" aria-label="메뉴 검색어 지우기" onClick={clearSearch}>
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    )}
                </div>
            )}
            {isSearching ? (
                <div className="menu-list-wrapper sidebar-search-results">
                    <p className="sidebar-search-status" role="status">
                        {results.length ? `검색 결과 ${results.length}개` : '검색 결과가 없습니다.'}
                    </p>
                    <ul aria-label="메뉴 검색 결과">
                        {results.map((result, index) => (
                            <li key={`${result.path}-${index}`}>
                                <a
                                    href={result.path}
                                    className="sidebar-search-result"
                                    aria-current={isActive(result.path) ? 'page' : undefined}
                                    onClick={event => {
                                        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                                        event.preventDefault();
                                        onNavigate(result.path);
                                        setQuery('');
                                    }}
                                >
                                    <span>{result.label}</span>
                                    {result.parents.length > 0 && <small>{result.parents.join(' › ')}</small>}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : children}
        </>
    );
};

export default SidebarMenuSearch;
