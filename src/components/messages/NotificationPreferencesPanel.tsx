import React, { useEffect, useState } from 'react';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import { notificationCenterService } from '../../services/notificationCenterService';
import { notificationSourceLabels } from '../../utils/notificationCenter';
import type { NotificationSource } from '../../types/notificationCenter';
import './NotificationInbox.css';
import './NotificationCenterDetails.css';

export default function NotificationPreferencesPanel({ uid }: { uid?: string }) {
    const profile = useNotificationCenter(uid);
    const [draft, setDraft] = useState(profile.preferences);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    useEffect(() => { if (!dirty) setDraft(profile.preferences); }, [profile.preferences, dirty]);
    const save = async () => {
        setBusy(true); setError(''); setStatus('');
        try { await notificationCenterService.savePreferences(draft); setDirty(false); setStatus('개인 알림 설정을 저장했습니다.'); }
        catch { setError('설정을 저장하지 못했습니다. 입력한 설정을 유지했으니 다시 시도해 주세요.'); }
        finally { setBusy(false); }
    };
    return <section className="notification-inbox notification-settings" aria-label="개인 알림 설정">
        <h2>내게 맞는 알림</h2><p>계정에 저장되어 다른 기기에서도 같은 설정을 사용합니다. 끈 종류는 확인할 일과 헤더 배지에서 제외하고, 전체 목록에는 남겨둡니다. 확인 완료 요청은 항상 표시합니다.</p>
        {profile.error && <div role="alert" className="notification-error">설정을 불러오지 못했습니다. <button onClick={profile.retry}>다시 불러오기</button></div>}
        <fieldset disabled={busy || profile.loading || !!profile.error || !uid} onChange={() => { setDirty(true); setStatus(''); }}>
            <legend>종류별 알림과 소리</legend>
            <label><input type="checkbox" checked={draft.sound} onChange={e => setDraft(d => ({ ...d, sound: e.target.checked }))} />새 알림 소리와 진동 켜기</label>
            <p>앱을 열어 사용하는 동안 적용됩니다. 기기나 브라우저에서 소리 재생을 허용해야 합니다.</p>
            <div className="notification-settings-options">{(Object.keys(notificationSourceLabels) as NotificationSource[]).map(source => <label key={source}>
                <input type="checkbox" checked={draft.sources[source]} onChange={e => setDraft(d => ({ ...d, sources: { ...d.sources, [source]: e.target.checked } }))} />{notificationSourceLabels[source]} 알림 표시·소리
            </label>)}</div>
            <label className="notification-field">일반 알림 소리 모아 받기<select value={draft.digestMinutes} onChange={e => setDraft(d => ({ ...d, digestMinutes: Number(e.target.value) }))}>
                {[0, 5, 15, 30, 60].map(value => <option key={value} value={value}>{value ? value + '분마다 한 번' : '도착할 때마다'}</option>)}
            </select></label><p>알림 목록에는 즉시 표시합니다. 중요·긴급 알림은 모으지 않고 바로 알려드립니다.</p>
            <label><input type="checkbox" checked={draft.quietEnabled} onChange={e => setDraft(d => ({ ...d, quietEnabled: e.target.checked }))} />방해 금지 시간 사용</label>
            <div className="notification-settings-options"><label className="notification-field">시작 (한국 시간)<input type="time" value={draft.quietStart} onChange={e => setDraft(d => ({ ...d, quietStart: e.target.value }))} /></label>
                <label className="notification-field">종료 (한국 시간)<input type="time" value={draft.quietEnd} onChange={e => setDraft(d => ({ ...d, quietEnd: e.target.value }))} /></label></div>
            <p>방해 금지 중에는 중요·긴급 알림도 소리와 진동 없이 표시합니다. 시작과 종료가 같으면 하루 종일 조용히 받습니다.</p>
            <button className="notification-primary" onClick={() => void save()} disabled={!dirty}>{busy ? '저장 중…' : '설정 저장'}</button>
        </fieldset>
        {error && <p role="alert" className="notification-error">{error}</p>}
        {status && <p role="status" className="notification-success">{status}</p>}
    </section>;
}
