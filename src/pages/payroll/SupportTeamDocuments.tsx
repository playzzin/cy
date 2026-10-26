import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supportTeamDocumentService, type SupportDocumentPerson } from '../../services/supportTeamDocumentService';
import type { WorkerAccountPurpose } from '../../utils/workerAccount';
import WorkerIdImageShare from '../manpower/WorkerIdImageShare';

export default function SupportTeamDocuments() {
    const [people, setPeople] = useState<SupportDocumentPerson[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [teamId, setTeamId] = useState('');
    const [purpose, setPurpose] = useState<WorkerAccountPurpose>('default');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setPeople([]); setSelected(new Set()); setTeamId('');
        void supportTeamDocumentService.list(controller.signal).then(rows => {
            if (!controller.signal.aborted) setPeople(rows);
        }).catch(() => {
            if (!controller.signal.aborted) setError('서류 공유 대상을 불러오지 못했습니다. 계정의 팀 연결과 서버 연결을 확인한 뒤 다시 불러와 주세요.');
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [revision]);
    const teams = useMemo(() => Array.from(new Map(people.map(person => [person.teamId, person.teamName])).entries()), [people]);
    const visible = useMemo(() => people.filter(person => !teamId || person.teamId === teamId), [people, teamId]);
    const selectedWorkers = useMemo(() => visible.filter(person => selected.has(person.id)), [visible, selected]);
    const readIdentity = useCallback((worker: { id?: string }, name: string, signal: AbortSignal) =>
        supportTeamDocumentService.read(worker.id!, 'identity', name, signal), []);
    const readBank = useCallback((worker: { id?: string }, name: string, signal: AbortSignal) =>
        supportTeamDocumentService.read(worker.id!, purpose === 'directPay' ? 'directPayBank' : 'bank', name, signal), [purpose]);
    const allSelected = visible.length > 0 && visible.every(person => selected.has(person.id));

    return <section aria-label="신분증·통장사본 공유" className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-black text-slate-800">신분증·통장사본 공유</h2>
            <select aria-label="서류 공유 팀" value={teamId} onChange={event => { setTeamId(event.target.value); setSelected(new Set()); }}
                className="max-w-full rounded-lg border border-slate-200 px-2 py-2 text-sm">
                <option value="">전체 공유 가능 팀</option>
                {teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select aria-label="공유할 통장 종류" value={purpose} onChange={event => setPurpose(event.target.value as WorkerAccountPurpose)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                <option value="default">기본 통장사본</option><option value="directPay">직불용 통장사본</option>
            </select>
            <span className="text-sm font-bold">선택 {selectedWorkers.length}명</span>
            <WorkerIdImageShare workers={selectedWorkers} disabled={loading} logSource="support_team" loadImage={readIdentity} />
            <WorkerIdImageShare workers={selectedWorkers} disabled={loading} kind="bank" bankPurpose={purpose} logSource="support_team" loadImage={readBank} />
        </div>
        <p className="mt-2 text-xs text-slate-600">팀장도 지원 이력과 관계없이 소속 회사의 다른 팀 인원·팀장 서류를 확인하고 공유할 수 있습니다. 사진을 확인한 뒤 보낼 앱을 선택하세요.</p>
        {loading ? <p role="status" className="mt-2 text-sm">서류 공유 대상을 불러오는 중입니다…</p>
            : error ? <div role="alert" className="mt-2 text-sm text-red-700">{error} <button type="button" onClick={() => setRevision(value => value + 1)} className="underline">다시 불러오기</button></div>
                : <details className="mt-2" open>
                    <summary className="cursor-pointer text-sm font-bold">공유 대상 선택 ({visible.length}명)</summary>
                    <label className="my-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} disabled={!visible.length}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(person => person.id)))} />표시된 인원 전체 선택</label>
                    {!visible.length && <p role="status" className="text-sm text-slate-500">공유 가능한 인원이 없습니다.</p>}
                    <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                        {visible.map(person => <label key={person.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                            <input type="checkbox" aria-label={`${person.teamName} ${person.name} 서류 선택`} className="mt-1" checked={selected.has(person.id)}
                                onChange={() => setSelected(previous => { const next = new Set(previous); if (next.has(person.id)) next.delete(person.id); else next.add(person.id); return next; })} />
                            <span><strong>{person.name}</strong> {person.role === '팀장' ? '· 팀장' : ''} · {person.teamName}
                                {person.relation !== 'own' && <span className="ml-1 text-blue-700">다른 팀</span>}
                                <span className="mt-1 block text-xs text-slate-500">신분증 {person.hasIdentity ? '등록' : '미등록'} · 통장사본 {(purpose === 'directPay' ? person.hasDirectPayBank : person.hasBank) ? '등록' : '미등록'}</span>
                            </span>
                        </label>)}
                    </div>
                </details>}
    </section>;
}
