import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartPie } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../../../constants/iconMap';
import type { MenuItem } from '../../../../types/menu';
import { isMenuDivider } from '../../../../utils/menuDivider';
import { DEFAULT_SIDEBAR_ACCENT, DEFAULT_SIDEBAR_BACKGROUND, sidebarColors, sidebarRowStyle, SidebarColorSource } from '../../../../utils/sidebarColors';
import { SIDEBAR_FONTS } from '../../../../constants/sidebarFonts';
import SidebarFontSelect from './SidebarFontSelect';

interface Props {
    items: MenuItem[];
    source: SidebarColorSource;
    onChange: (patch: Partial<MenuItem>) => void;
}

const fields = [
    { key: 'backgroundColor', tone: 'background', label: '메뉴 행 배경색', inherit: '사이드바 배경 사용' },
    { key: 'selectedBackgroundColor', tone: 'selectedBackground', label: '선택 배경색', inherit: '직책 선택 배경 사용' },
    { key: 'iconColor', tone: 'icon', label: '아이콘 색상', inherit: '기본색 사용' },
    { key: 'activeColor', tone: 'active', label: '현재 메뉴 강조색', inherit: '기본색 사용' }
] as const;

function ColorCodeInput({ label, value, hexOnly, placeholder, onCommit }: {
    label: string; value: string; hexOnly: boolean; placeholder: string; onCommit: (value?: string) => void;
}) {
    const [draft, setDraft] = React.useState<string | null>(null);
    const code = draft?.trim();
    const invalid = Boolean(code && !(hexOnly ? /^#[\da-f]{6}$/i.test(code)
        : /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(code) || window.CSS?.supports?.('color', code)));
    return <>
        <input type="text" aria-label={label + ' 코드'} aria-invalid={invalid} value={draft ?? value} placeholder={placeholder}
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            onChange={event => setDraft(event.target.value)}
            onBlur={() => {
                if (draft === null || invalid) return;
                onCommit(code || undefined);
                setDraft(null);
            }}
            onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') { event.stopPropagation(); setDraft(null); }
            }} />
        {invalid && <small role="alert" className="text-amber-300">색상 코드를 확인하세요. 예: #4080CC</small>}
    </>;
}

export default function SidebarColorSettings({ items, source, onChange }: Props) {
    const menus = items.filter(item => !isMenuDivider(item));
    if (!menus.length) return null;
    const item = menus[0];
    const site = source(item.id);
    const colors = sidebarColors(item, site);
    const sources = new Set(menus.map(entry => source(entry.id)?.name));
    const inheritedFont = sidebarColors({}, site).fontPreset;
    const fontValues = new Set(menus.map(entry => entry.fontPreset || ''));

    return <section className="space-y-3" aria-label="좌측 메뉴 스타일 설정">
        <h3 className="text-sm font-bold text-slate-200">좌측 메뉴 글꼴과 색상</h3>
        <SidebarFontSelect label="메뉴 글꼴" value={fontValues.size > 1 ? 'mixed' : item.fontPreset || ''}
            inherited={sources.size === 1 ? inheritedFont : undefined}
            defaultLabel={sources.size === 1 && inheritedFont ? `직책 글꼴 사용 · ${SIDEBAR_FONTS[inheritedFont].label}` : '직책 글꼴 사용'}
            onChange={font => onChange({ fontPreset: font })} />
        {fields.map(({ key, tone, label, inherit }) => {
            const values = new Set(menus.map(entry => entry[key] || ''));
            const mode = values.size > 1 ? 'mixed' : item[key] ? 'custom' : 'inherit';
            const effectiveColors = new Set(menus.map(entry => sidebarColors(entry, source(entry.id))[tone]));
            const [effectiveColor] = Array.from(effectiveColors);
            const color = effectiveColor || DEFAULT_SIDEBAR_BACKGROUND;
            return <div key={key} className="space-y-1">
                <div className="text-xs text-slate-300">{label}</div>
                <div className="flex items-center gap-2">
                    <select aria-label={label + ' 적용 방식'} className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 p-2 text-xs text-slate-100"
                        value={mode} onChange={event => onChange({ [key]: event.target.value === 'inherit' ? undefined : color })}>
                        {mode === 'mixed' && <option value="mixed" disabled>여러 설정</option>}
                        <option value="inherit">{inherit}</option><option value="custom">직접 지정</option>
                    </select>
                    <label className="relative h-8 w-10 overflow-hidden rounded border border-slate-500 focus-within:ring-2 focus-within:ring-blue-400"
                        style={{ background: effectiveColors.size > 1 ? 'linear-gradient(135deg, #334155 50%, #94a3b8 50%)' : color }}>
                        <input type="color" aria-label={label + ' 직접 지정'} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            value={/^#[\da-f]{6}$/i.test(color) ? color : DEFAULT_SIDEBAR_ACCENT}
                            onChange={event => onChange({ [key]: event.target.value })} />
                    </label>
                </div>
                <ColorCodeInput key={JSON.stringify([menus.map(entry => entry.id), mode, color])} label={label} hexOnly={tone === 'background' || tone === 'selectedBackground'}
                    placeholder={effectiveColors.size > 1 ? '여러 색상' : '사이드바 테마 기본값'}
                    value={effectiveColors.size > 1 ? '' : effectiveColor || ''} onCommit={value => onChange({ [key]: value })} />
            </div>;
        })}
        <button type="button" className="text-xs text-blue-300 underline disabled:text-slate-500"
            disabled={!menus.some(entry => entry.iconColor || entry.activeColor || entry.backgroundColor || entry.selectedBackgroundColor)}
            onClick={() => onChange({ iconColor: undefined, activeColor: undefined, backgroundColor: undefined, selectedBackgroundColor: undefined })}>
            {menus.length > 1 ? '선택 메뉴 모두 기본색 사용' : '모든 색상 기본값 사용'}
        </button>
        {menus.length === 1 && <div className="space-y-1 rounded-lg bg-slate-800 p-3" aria-label="좌측 메뉴 미리보기">
            {['일반', '롤오버', ...(item.sub?.length ? [] : ['현재 페이지'])].map((label, index) => <div key={label}
                className={`flex items-center gap-2 rounded py-2 pl-3 pr-2 text-sm text-slate-100 ${index === 1 ? 'sidebar-rollover-preview' : ''}`}
                style={sidebarRowStyle(colors, index === 2)}>
                <FontAwesomeIcon icon={resolveIcon(item.icon, faChartPie)} style={{ color: index ? colors.active : colors.icon }} />
                <span className="min-w-0 flex-1 truncate">{item.text}</span><small>{label}</small>
            </div>)}
        </div>}
    </section>;
}
