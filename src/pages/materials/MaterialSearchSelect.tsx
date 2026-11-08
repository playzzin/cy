import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';
import './MaterialSearchSelect.css';

export interface MaterialSearchOption {
    id?: string;
    name: string;
    description?: string;
    keywords?: string;
}

interface MaterialSearchSelectProps {
    id: string;
    label: string;
    options: MaterialSearchOption[];
    value: string;
    selectedName?: string;
    placeholder: string;
    disabled?: boolean;
    emptyOptionLabel?: string;
    onChange: (id: string) => void;
}

const normalize = (text: string) => text.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');

const MaterialSearchSelect: React.FC<MaterialSearchSelectProps> = ({
    id, label, options, value, selectedName, placeholder, disabled = false, emptyOptionLabel, onChange,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState<React.CSSProperties>({ visibility: 'hidden' });
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selectableOptions = useMemo(() => Array.from(new Map(options
        .filter((option): option is MaterialSearchOption & { id: string } => Boolean(option.id))
        .map(option => [option.id, option])).values()), [options]);
    const selected = selectableOptions.find(option => option.id === value);
    const normalizedQuery = normalize(query);
    const matchingOptions = selectableOptions.filter(option =>
        normalize([option.name, option.description, option.keywords].filter(Boolean).join(' ')).includes(normalizedQuery));
    const matches: Array<MaterialSearchOption & { id: string }> = emptyOptionLabel && normalize(emptyOptionLabel).includes(normalizedQuery)
        ? [{ id: '', name: emptyOptionLabel }, ...matchingOptions] : matchingOptions;
    const isOpen = open && !disabled;
    const listId = `${id}-options`;

    const close = () => { setOpen(false); setQuery(''); };
    const choose = (nextValue: string) => {
        if (nextValue !== value) onChange(nextValue);
        close();
    };
    const showOptions = () => {
        if (disabled) return;
        setQuery('');
        const selectedIndex = selectableOptions.findIndex(option => option.id === value);
        setActiveIndex(selectedIndex < 0 ? 0 : selectedIndex + (emptyOptionLabel ? 1 : 0));
        setOpen(true);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
        };
        document.addEventListener('pointerdown', handleOutside);
        return () => document.removeEventListener('pointerdown', handleOutside);
    }, [isOpen]);

    // The header has container/overflow boundaries; render the list at the viewport level.
    useLayoutEffect(() => {
        if (!isOpen) return;
        const updatePosition = () => {
            if (!inputRef.current) return;
            const rect = inputRef.current.getBoundingClientRect();
            const viewport = window.visualViewport;
            const viewportTop = viewport?.offsetTop || 0;
            const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
            const below = Math.max(0, viewportBottom - rect.bottom - 12);
            const above = Math.max(0, rect.top - viewportTop - 12);
            const desiredHeight = Math.min(280, menuRef.current?.scrollHeight || 280);
            const placeAbove = below < desiredHeight && above > below;
            const maxHeight = Math.min(280, placeAbove ? above : below);
            const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 16);
            setPosition({
                left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
                top: placeAbove ? rect.top - Math.min(desiredHeight, maxHeight) - 4 : rect.bottom + 4,
                width, maxHeight,
            });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        window.visualViewport?.addEventListener('resize', updatePosition);
        window.visualViewport?.addEventListener('scroll', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            window.visualViewport?.removeEventListener('resize', updatePosition);
            window.visualViewport?.removeEventListener('scroll', updatePosition);
        };
    }, [isOpen, matches.length, value]);

    useEffect(() => {
        if (isOpen) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex, isOpen, listId, query]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) { showOptions(); return; }
            setActiveIndex(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Enter' && isOpen) {
            event.preventDefault();
            if (matches[activeIndex]) choose(matches[activeIndex].id);
        } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === 'Tab') close();
    };

    return <div ref={rootRef} className="material-search-select">
        <input ref={inputRef} id={id} className="material-search-select__input" type="text" role="combobox"
            aria-label={label} aria-autocomplete="list" aria-expanded={isOpen} aria-controls={isOpen ? listId : undefined}
            aria-activedescendant={isOpen && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off" placeholder={placeholder} disabled={disabled}
            value={isOpen ? query : selected?.name || (value ? selectedName || '' : '')}
            onFocus={showOptions} onClick={() => { if (!isOpen) showOptions(); }}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
            onBlur={close} onKeyDown={handleKeyDown}
        />
        <Search size={15} className="material-search-select__icon" aria-hidden="true" />
        {isOpen && createPortal(<div ref={menuRef} className="material-search-select__menu" style={position}
            onMouseDown={event => event.preventDefault()}>
            {value && !emptyOptionLabel && <button type="button" tabIndex={-1} className="material-search-select__clear"
                aria-label={`${label} 선택 해제`} onClick={() => choose('')}>선택 해제</button>}
            <div id={listId} role="listbox" aria-label={label}>
                {matches.map((option, index) => <div key={option.id} id={`${listId}-${index}`} role="option"
                    aria-selected={option.id === value}
                    className={`material-search-select__option ${index === activeIndex ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option.id)}>
                    <span className="material-search-select__name">{option.name}
                        {option.description && <span className="material-search-select__description">{option.description}</span>}
                    </span>
                    {option.id === value && <Check size={16} aria-hidden="true" />}
                </div>)}
                {matches.length === 0 && <p role="status" className="material-search-select__empty">검색 결과가 없습니다.</p>}
            </div>
        </div>, document.body)}
    </div>;
};

export default MaterialSearchSelect;
