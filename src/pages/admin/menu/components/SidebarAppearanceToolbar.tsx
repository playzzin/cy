import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRotateLeft } from '@fortawesome/free-solid-svg-icons';
import type { SiteData } from '../../../../types/menu';
import { DEFAULT_SIDEBAR_ACCENT, DEFAULT_SIDEBAR_BACKGROUND } from '../../../../utils/sidebarColors';
import SidebarFontSelect from './SidebarFontSelect';

const colorFields = [
    { key: 'sidebarBackgroundColor', label: '배경', name: '좌측 메뉴 배경색', reset: '배경색 기본값 복원' },
    { key: 'sidebarSelectedBackgroundColor', label: '선택', name: '좌측 메뉴 선택 배경색', reset: '선택 배경색 기본값 복원' },
    { key: 'sidebarAccentColor', label: '강조', name: '좌측 메뉴 기본색', reset: '시스템 기본값 복원' }
] as const;
const palettes = [
    { name: '기본', colors: {} },
    { name: '네이비', colors: { sidebarBackgroundColor: '#17243a', sidebarSelectedBackgroundColor: '#30486b', sidebarAccentColor: '#a8ceff' } },
    { name: '그린', colors: { sidebarBackgroundColor: '#17352c', sidebarSelectedBackgroundColor: '#2b5446', sidebarAccentColor: '#9ee3bb' } },
    { name: '샌드', colors: { sidebarBackgroundColor: '#faf5eb', sidebarSelectedBackgroundColor: '#ead8bd', sidebarAccentColor: '#714c27' } }
] satisfies { name: string; colors: Partial<Pick<SiteData, typeof colorFields[number]['key']>> }[];

export default function SidebarAppearanceToolbar({ site, onChange }: { site: SiteData; onChange: (site: SiteData) => void }) {
    return <section aria-label={`${site.name} 좌측 메뉴 스타일`}
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100">
        <strong className="max-w-full truncate text-blue-200">{site.name}</strong>
        <SidebarFontSelect label="좌측 메뉴 기본 글꼴" compactLabel="글꼴" value={site.sidebarFontPreset || ''} defaultLabel="기본 글꼴"
            onChange={font => {
                const next = { ...site };
                if (font) next.sidebarFontPreset = font;
                else delete next.sidebarFontPreset;
                onChange(next);
            }} />
        <div role="group" aria-label="색상 테마" className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-slate-300">테마</span>
            {palettes.map(({ name, colors }) => {
                const selected = colorFields.every(({ key }) => site[key]?.toLowerCase() === colors[key]);
                return <button type="button" key={name} aria-pressed={selected} onClick={() => {
                    const next = { ...site };
                    colorFields.forEach(({ key }) => delete next[key]);
                    onChange({ ...next, ...colors });
                }} className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:ring-blue-400 ${selected
                    ? 'border-blue-400 bg-blue-950 text-blue-100' : 'border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400'}`}>
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-white/30"
                        style={{ backgroundColor: colors.sidebarAccentColor || DEFAULT_SIDEBAR_ACCENT }} />{name}
                </button>;
            })}
        </div>
        <div role="group" aria-label="개별 색상" className="flex flex-wrap items-center gap-3">
            {colorFields.map(({ key, label, name, reset }) => {
                const fallback = key === 'sidebarAccentColor' ? DEFAULT_SIDEBAR_ACCENT
                    : key === 'sidebarSelectedBackgroundColor' ? site.sidebarBackgroundColor || DEFAULT_SIDEBAR_BACKGROUND : DEFAULT_SIDEBAR_BACKGROUND;
                const value = site[key] || fallback;
                return <div key={key} className="inline-flex items-center">
                    <label title={`${name} · ${value.toUpperCase()}`}
                        className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-1 text-xs text-slate-200 hover:bg-slate-700 focus-within:ring-2 focus-within:ring-blue-400">
                        {label}
                        <span className="relative h-5 w-5 overflow-hidden rounded border border-white/40" style={{ backgroundColor: value }}>
                            <input type="color" aria-label={name} value={value}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                onChange={event => onChange({ ...site, [key]: event.target.value })} />
                        </span>
                    </label>
                    {site[key] && <button type="button" title={reset} aria-label={reset}
                        className="h-7 w-6 rounded text-xs text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400"
                        onClick={() => { const next = { ...site }; delete next[key]; onChange(next); }}>
                        <FontAwesomeIcon icon={faArrowRotateLeft} />
                    </button>}
                </div>;
            })}
        </div>
    </section>;
}
