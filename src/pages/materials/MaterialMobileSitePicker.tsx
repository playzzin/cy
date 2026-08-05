import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';

export type MaterialMobileSiteOption = {
    id?: string;
    name: string;
};

type SelectableMaterialMobileSiteOption = MaterialMobileSiteOption & { id: string };

interface MaterialMobileSitePickerProps {
    sites: MaterialMobileSiteOption[];
    value: string;
    onChange: (siteId: string) => void;
    tone: 'blue' | 'red';
    label?: string;
}

const toneClasses = {
    blue: {
        border: 'border-blue-200',
        ring: 'focus:ring-blue-100',
        text: 'text-blue-700',
        selected: 'border-blue-200 bg-blue-50 text-blue-800',
        icon: 'text-blue-600',
    },
    red: {
        border: 'border-red-200',
        ring: 'focus:ring-red-100',
        text: 'text-red-700',
        selected: 'border-red-200 bg-red-50 text-red-800',
        icon: 'text-red-600',
    },
};

const MaterialMobileSitePicker: React.FC<MaterialMobileSitePickerProps> = ({
    sites,
    value,
    onChange,
    tone,
    label = '현장 선택',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const classes = toneClasses[tone];
    const selectableSites = useMemo(
        () => sites.filter((site): site is SelectableMaterialMobileSiteOption => Boolean(site.id)),
        [sites]
    );
    const selectedSite = selectableSites.find((site) => site.id === value);
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
    const filteredSites = useMemo(() => {
        if (!normalizedQuery) return selectableSites;
        return selectableSites.filter((site) => site.name.toLocaleLowerCase('ko-KR').includes(normalizedQuery));
    }, [normalizedQuery, selectableSites]);

    const closePicker = () => {
        setIsOpen(false);
        setQuery('');
    };

    const selectSite = (siteId: string) => {
        onChange(siteId);
        closePicker();
    };

    return (
        <div className="relative col-span-2 space-y-1 md:hidden">
            <label className="text-xs font-bold text-slate-600">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={selectedSite ? `${label}: ${selectedSite.name}` : label}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 ${classes.border} ${classes.ring}`}
            >
                <MapPin size={17} className={`shrink-0 ${classes.icon}`} aria-hidden="true" />
                <span className={`min-w-0 flex-1 truncate ${selectedSite ? 'text-slate-800' : 'text-slate-500'}`}>
                    {selectedSite?.name || '현장을 검색하여 선택하세요'}
                </span>
                <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {isOpen ? (
                <div className="absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="relative">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="현장명 검색"
                            autoFocus
                            className={`h-11 w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-9 text-sm outline-none focus:border-transparent focus:ring-2 ${classes.ring}`}
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                aria-label="현장 검색어 지우기"
                                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                            >
                                <X size={16} />
                            </button>
                        ) : null}
                    </div>
                    <div role="listbox" aria-label={label} className="mt-2 max-h-60 overflow-y-auto overscroll-contain pr-0.5">
                        {filteredSites.length > 0 ? filteredSites.map((site) => {
                            const isSelected = site.id === value;
                            return (
                                <button
                                    key={site.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => selectSite(site.id)}
                                    className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-semibold transition last:mb-0 ${isSelected
                                        ? classes.selected
                                        : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="min-w-0 flex-1 truncate">{site.name}</span>
                                    {isSelected ? <Check size={17} className={`shrink-0 ${classes.icon}`} aria-hidden="true" /> : null}
                                </button>
                            );
                        }) : (
                            <p className="px-3 py-5 text-center text-sm font-medium text-slate-500">검색 결과가 없습니다.</p>
                        )}
                    </div>
                    {value ? (
                        <button
                            type="button"
                            onClick={() => selectSite('')}
                            className="mt-2 w-full rounded-lg py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        >
                            선택 해제
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default MaterialMobileSitePicker;
