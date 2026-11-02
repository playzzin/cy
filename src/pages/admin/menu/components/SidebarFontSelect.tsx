import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { isSidebarFont, SIDEBAR_FONT_GROUPS, SIDEBAR_FONT_IDS, SIDEBAR_FONTS, sidebarFontFamily, type SidebarFontId } from '../../../../constants/sidebarFonts';
import { useSidebarFont } from '../../../../hooks/useSidebarFonts';

interface Props {
    label: string;
    compactLabel?: string;
    value: SidebarFontId | 'mixed' | '';
    defaultLabel: string;
    inherited?: SidebarFontId;
    onChange: (font?: SidebarFontId) => void;
}

export default function SidebarFontSelect({ label, compactLabel, value, defaultLabel, inherited, onChange }: Props) {
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchToggle = useRef<HTMLButtonElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const picker = useRef<HTMLSelectElement>(null);
    useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
    const font = isSidebarFont(value) ? value : inherited;
    useSidebarFont(font);
    const term = normalizeSearch(query);
    const matches = SIDEBAR_FONT_IDS.filter(id => {
        const { label: name, family, group } = SIDEBAR_FONTS[id];
        return !term || normalizeSearch([name, group, id, family.split(',')[0]].join(' ')).includes(term);
    });
    return <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
        <label className="flex flex-wrap items-center gap-2">
            {compactLabel || label}
            <select ref={picker} aria-label={label} value={value} style={{ fontFamily: sidebarFontFamily(font) }}
                className={`min-w-0 max-w-full rounded border border-slate-600 bg-slate-800 text-sm text-slate-100 ${compactLabel ? 'w-40 p-1.5' : 'p-2'}`}
                onChange={event => {
                    onChange(isSidebarFont(event.target.value) ? event.target.value : undefined);
                    setQuery('');
                    setSearchOpen(false);
                }}>
                {value === 'mixed' && <option disabled value="mixed">여러 설정</option>}
                <option value="">{defaultLabel}</option>
                {isSidebarFont(value) && !matches.includes(value) && <optgroup label="현재 선택">
                    <option value={value}>{SIDEBAR_FONTS[value].label}</option>
                </optgroup>}
                {SIDEBAR_FONT_GROUPS.map(group => {
                    const options = matches.filter(id => SIDEBAR_FONTS[id].group === group);
                    return options.length > 0 && <optgroup key={group} label={group}>
                        {options.map(id => <option key={id} value={id}>{SIDEBAR_FONTS[id].label}</option>)}
                    </optgroup>;
                })}
            </select>
        </label>
        {compactLabel && <button type="button" ref={searchToggle} aria-label={label + ' 검색'} title="글꼴 검색" aria-expanded={searchOpen}
            className="h-8 w-8 rounded text-slate-300 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => { setQuery(''); setSearchOpen(!searchOpen); }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>}
        {(!compactLabel || searchOpen) && <input type="search" aria-label={label + ' 검색'} placeholder={compactLabel ? '글꼴 검색' : `글꼴 ${SIDEBAR_FONT_IDS.length}종 검색`}
            ref={searchInput}
            className="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'Escape' && compactLabel) {
                    event.preventDefault();
                    setQuery('');
                    setSearchOpen(false);
                    searchToggle.current?.focus();
                } else if (event.key === 'Enter' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    picker.current?.focus();
                }
            }} />}
        {term && <span role="status" className={compactLabel && matches.length ? 'sr-only' : 'text-xs text-slate-300'}>{matches.length ? `${matches.length}종 일치` : '일치하는 글꼴이 없습니다.'}</span>}
    </div>;
}

const normalizeSearch = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\s-]/g, '');
