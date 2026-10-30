import React from 'react';
import type { MenuItem } from '../../../../types/menu';
import MenuDivider from '../../../../components/layout/MenuDivider';
import { getDividerAppearance } from '../../../../utils/menuDivider';
import { LINKED_POSITION_DIVIDER_ID } from '../../../../utils/linkedPositionMenus';

interface DividerSettingsProps {
    item: MenuItem;
    onChange: (item: MenuItem) => void;
}

const DividerSettings: React.FC<DividerSettingsProps> = ({ item, onChange }) => {
    const { spacing, lineStyle } = getDividerAppearance(item);
    const optionClass = (selected: boolean) => `flex-1 rounded-lg border px-3 py-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? 'border-blue-400 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`;

    return (
        <div className="space-y-6">
            <p className="text-xs leading-relaxed text-slate-400">{item.id === LINKED_POSITION_DIVIDER_ID
                ? 'DEV 메뉴와 직책별 연결 메뉴 사이의 구분선입니다. 제목, 선 모양, 간격과 표시 여부를 설정하세요.'
                : '메뉴 그룹 사이에 선과 여백을 넣어 구역을 나눕니다. 원하는 위치로 드래그해 배치하세요.'}</p>
            <div className="space-y-2">
                <label htmlFor="menu-divider-title" className="block text-sm font-semibold text-slate-200">구분선 제목</label>
                <input id="menu-divider-title" type="text" value={item.dividerTitle || ''} maxLength={60}
                    placeholder="예: 현장 관리" aria-describedby="menu-divider-title-help"
                    onChange={event => onChange({ ...item, dividerTitle: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-400 focus:outline-none" />
                <p id="menu-divider-title-help" className="text-[11px] leading-relaxed text-slate-500">선 가운데 작은 글씨로 표시합니다. 비워두면 선만 표시합니다.</p>
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
                <p className="text-[11px] leading-relaxed text-slate-500">선 위아래에 같은 여백을 적용합니다.</p>
            </fieldset>
            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400">사이드바 미리보기</h3>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
                    <div className="rounded-md px-3 py-2.5 text-sm text-slate-300">출력 관리</div>
                    <MenuDivider item={item} inset={12} />
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
