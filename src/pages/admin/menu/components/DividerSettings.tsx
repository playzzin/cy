import React, { useRef, useState } from 'react';
import type { MenuItem } from '../../../../types/menu';
import MenuDivider from '../../../../components/layout/MenuDivider';
import { getDividerAppearance } from '../../../../utils/menuDivider';

interface DividerSettingsProps {
    item: MenuItem;
    onChange: (item: MenuItem) => void;
}

const DividerSettings: React.FC<DividerSettingsProps> = ({ item, onChange }) => {
    const { spacing, lineStyle } = getDividerAppearance(item);
    const [draftTitle, setDraftTitle] = useState<string | null>(null);
    const composing = useRef(false);
    const title = draftTitle ?? item.dividerTitle ?? '';
    const optionClass = (selected: boolean) => `flex-1 rounded-lg border px-3 py-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? 'border-blue-400 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label htmlFor="menu-divider-title" className="block text-sm font-semibold text-slate-200">구분선 제목</label>
                <input id="menu-divider-title" type="text" value={title} maxLength={60} placeholder="제목 (선택)"
                    onChange={event => setDraftTitle(event.target.value)}
                    onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
                    onKeyDown={event => {
                        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                        if (event.key === 'Escape') { event.preventDefault(); setDraftTitle(null); }
                    }}
                    onBlur={event => {
                        const value = event.currentTarget.value.trim();
                        if (draftTitle !== null && value !== (item.dividerTitle || '')) onChange({ ...item, dividerTitle: value || undefined });
                        setDraftTitle(null);
                        composing.current = false;
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-400 focus:outline-none" />
            </div>
            <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-200">선 모양</legend>
                <div className="flex gap-2">
                    {(['solid', 'dashed'] as const).map(value => (
                        <button type="button" key={value} aria-pressed={lineStyle === value} className={optionClass(lineStyle === value)} onClick={() => onChange({ ...item, dividerStyle: value })}>
                            <span aria-hidden="true" className="mb-2 block w-full border-t border-current" style={{ borderTopStyle: value }} />
                            {value === 'solid' ? '실선' : '점선'}
                        </button>
                    ))}
                </div>
            </fieldset>
            <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-200">메뉴와의 간격</legend>
                <div className="flex gap-2">
                    {([{ value: 'compact', label: '좁게' }, { value: 'normal', label: '기본' }, { value: 'relaxed', label: '넓게' }] as const).map(({ value, label }) => (
                        <button type="button" key={value} aria-pressed={spacing === value} className={optionClass(spacing === value)} onClick={() => onChange({ ...item, dividerSpacing: value })}>{label}</button>
                    ))}
                </div>
            </fieldset>
            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400">사이드바 미리보기</h3>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
                    <div className="rounded-md px-3 py-2.5 text-sm text-slate-300">출력 관리</div>
                    <MenuDivider item={{ ...item, dividerTitle: title }} inset={12} />
                    <div className="rounded-md px-3 py-2.5 text-sm text-slate-300">급여 관리</div>
                </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
                구분선 표시
                <input type="checkbox" checked={!item.hide} onChange={event => onChange({ ...item, hide: !event.target.checked })} className="h-4 w-4 accent-blue-500" />
            </label>
        </div>
    );
};

export default DividerSettings;
