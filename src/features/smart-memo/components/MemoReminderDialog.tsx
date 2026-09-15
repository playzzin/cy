import React, { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
    MemoReminder, ReminderRepeat, memoReminderService, reminderDateInput,
    parseReminderDateInput, reminderRepeatLabels
} from '../services/memoReminderService';

export function MemoReminderDialog({ memoId, memoTitle, reminder, onClose, onSaved }: {
    memoId: string; memoTitle: string; reminder?: MemoReminder; onClose: () => void; onSaved: (cancelled: boolean) => void;
}) {
    const [date, setDate] = useState(() => reminderDateInput(reminder?.status === 'scheduled' ? reminder.remindAt : Math.ceil((Date.now() + 3600000) / 60000) * 60000));
    const [repeat, setRepeat] = useState<ReminderRepeat>(reminder?.repeat || 'none');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const panelRef = useRef<HTMLElement>(null);
    const openingControl = useRef(document.activeElement as HTMLElement | null);
    useEffect(() => {
        panelRef.current?.querySelector('input')?.focus();
        const control = openingControl.current;
        return () => { if (control?.isConnected) control.focus(); };
    }, []);
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !saving) onClose();
            if (event.key !== 'Tab') return;
            const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
            if (!controls?.length) { event.preventDefault(); return; }
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, saving]);
    const save = async (cancel: boolean) => {
        if (saving) return;
        const time = parseReminderDateInput(date);
        if (!cancel && (!Number.isFinite(time) || time <= Date.now())) {
            setError('현재보다 이후의 알림 시간을 선택해 주세요.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await memoReminderService.save(memoId, cancel ? null : time, repeat);
            onSaved(cancel);
            onClose();
        } catch {
            setError('알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.');
            setSaving(false);
        }
    };
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
            <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="memo-reminder-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="memo-reminder-title" className="flex items-center gap-2 text-lg font-bold text-slate-950"><Bell className="h-5 w-5" />알림 설정</h2>
                        <p className="mt-1 break-words text-sm text-slate-600">{memoTitle}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} aria-label="알림 설정 닫기" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">나에게만 알립니다. 대시보드와 상단 메시지 알림에서 확인할 수 있습니다.</p>
                <form onSubmit={event => { event.preventDefault(); void save(false); }}>
                    <label className="mt-4 block text-sm font-bold text-slate-700">알림 날짜·시간 (한국 시간)
                        <input type="datetime-local" value={date} onChange={event => setDate(event.target.value)} disabled={saving} required className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
                    </label>
                    <label className="mt-4 block text-sm font-bold text-slate-700">반복 주기
                        <select value={repeat} onChange={event => setRepeat(event.target.value as ReminderRepeat)} disabled={saving} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal">
                            {Object.entries(reminderRepeatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <p className="mt-2 text-xs text-slate-500">평일 반복은 주말을 건너뜁니다. 매월 반복 시 해당 날짜가 없는 달은 마지막 날에 알립니다.</p>
                    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
                    <div className="mt-5 flex justify-end gap-2">
                        {reminder && <button type="button" disabled={saving} onClick={() => void save(true)} className="mr-auto rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50">알림 해제</button>}
                        <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">닫기</button>
                        <button type="submit" disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '저장 중…' : '알림 저장'}</button>
                    </div>
                </form>
            </section>
        </div>
    );
}
