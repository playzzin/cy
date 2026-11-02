import React from 'react';
import type { SiteDataType } from '../../../../types/menu';
import { getAvailableLinkedPositions, getRegisteredPositionGroups, positionSiteKey } from '../../../../utils/linkedPositionMenus';

export default function LinkedPositionSettings({ data, siteKey, onUpdate }: {
    data: SiteDataType; siteKey: string; onUpdate: (data: SiteDataType) => void;
}) {
    const groups = getRegisteredPositionGroups(data, siteKey);
    const positions = getAvailableLinkedPositions(data, siteKey);
    const remaining = positions.filter(p => !groups.some(group => group.sourceSite === positionSiteKey(p.id)));
    const save = (next: typeof groups) => onUpdate({ ...data, [siteKey]: { ...data[siteKey], linkedPositionGroups: next } });
    return <details className="w-full rounded-lg border border-slate-600 p-3 text-sm text-slate-200">
        <summary className="cursor-pointer font-semibold">연결 폴더 관리</summary>
        <p className="my-2 text-xs text-slate-400">폴더 이름을 바꾸거나 연결을 해제할 수 있습니다. 원본 직책의 메뉴는 계속 사용할 수 있습니다.</p>
        {groups.map(group => {
            const source = positions.find(position => positionSiteKey(position.id) === group.sourceSite);
            if (!source) return null;
            return <div key={group.sourceSite} className="mb-2 flex flex-wrap items-center gap-2">
                <span className="min-w-20">{source.name}</span>
                <input key={group.text ?? ''} aria-label={`${source.name} 연결 폴더 이름`} placeholder={source.name}
                    defaultValue={group.text ?? ''} className="rounded border border-slate-600 bg-slate-900 px-2 py-1"
                    onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); }}
                    onBlur={event => {
                        const text = event.currentTarget.value.trim() || undefined;
                        if (text !== group.text) save(groups.map(item => item === group ? { sourceSite: item.sourceSite, text } : item));
                    }} />
                <button type="button" aria-label={`${source.name} 연결 해제`} className="text-rose-300"
                    onClick={() => save(groups.filter(item => item !== group))}>연결 해제</button>
            </div>;
        })}
        {remaining.length > 0 && <select aria-label="직책 연결 추가" value="" onChange={event => {
            if (event.target.value) save([...groups, { sourceSite: event.target.value }]);
        }} className="rounded border border-slate-600 bg-slate-900 px-2 py-1">
            <option value="">연결할 직책 선택</option>
            {remaining.map(p => <option key={p.id} value={positionSiteKey(p.id)}>{p.name}</option>)}
        </select>}
    </details>;
}
