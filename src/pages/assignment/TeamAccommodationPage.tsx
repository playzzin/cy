import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { BedDouble, Building2, Check, CheckCheck, ChevronRight, GripVertical, Home, Loader2, MapPin, RefreshCw, Search, Undo2, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { teamAccommodationBoardService } from '../../services/teamAccommodationBoardService';
import type { TeamAccommodationBoard } from '../../types/teamAccommodationBoard';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { isDevPreviewFrame } from '../../utils/devPreviewRuntime';
import { teamAccommodationErrorMessage } from '../../utils/teamAccommodationError';
import { openRealAccommodationSession, teamAccommodationStyle } from '../../utils/teamAccommodationAppearance';
import './TeamAccommodationPage.css';

const labels: Record<string, string> = { OneRoom: '원룸', TwoRoom: '투룸', ThreeRoom: '쓰리룸', Apartment: '아파트' };
const unassigned = '__unassigned';
type Worker = TeamAccommodationBoard['workers'][number];
type Room = TeamAccommodationBoard['rooms'][number];

function WorkerCard({ worker, color, selected, changed, disabled, onSelect }: { worker: Worker; color?: string; selected: boolean; changed: boolean; disabled: boolean; onSelect: () => void }) {
    const locked = disabled || !!worker.lockedReason;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: worker.id, disabled: locked });
    return <div ref={setNodeRef} style={teamAccommodationStyle(color)} className={`ta-worker ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${locked ? 'is-locked' : ''}`}>
        <button className="ta-grip" {...attributes} {...listeners} disabled={locked} aria-label={`${worker.name} 끌어서 배정`}><GripVertical size={17} /></button>
        <label className="ta-worker-label">
            <input type="checkbox" aria-label={`${worker.name} 선택`} checked={selected} disabled={locked} onChange={onSelect} />
            <span className="ta-avatar">{worker.name.slice(-1)}</span>
            <span className="ta-worker-info"><strong>{worker.name}</strong><small className="ta-worker-team"><i aria-hidden="true" />{worker.teamName || '소속 미지정'}<span>· {worker.role || '작업자'}</span></small>{worker.lockedReason && <small className="ta-lock-reason">{worker.lockedReason}</small>}</span>
        </label>
        {changed && <span className="ta-change-dot" title="저장 전 변경" aria-label="저장 전 변경" />}
    </div>;
}

function RoomZone({ room, children, count, matchedCount, filteredTeam, teamBadges, selectedCount, disabled, onAssign }: { room?: Room; children: React.ReactNode; count: number; matchedCount: number; filteredTeam: boolean; teamBadges?: React.ReactNode; selectedCount: number; disabled: boolean; onAssign: () => void }) {
    const { setNodeRef, isOver } = useDroppable({ id: room?.id || unassigned, disabled });
    return <section ref={setNodeRef} className={`ta-zone ${room ? 'ta-room' : 'ta-pool'} ${isOver ? 'is-over' : ''}`} aria-label={room?.name || '미배정 작업자'}>
        {room ? <>
            <div className="ta-room-top"><span className={`ta-type ta-type-${room.type}`}>{labels[room.type] || '숙소'}</span><span className="ta-room-count"><Users size={14} />{filteredTeam ? '선택 팀 ' : ''}{count}명</span></div>
            <h3>{room.name}</h3><p className="ta-address"><MapPin size={13} />{room.address || '주소 미등록'}</p>
            <div className="ta-room-illustration" aria-hidden="true">{Array.from({ length: room.type === 'ThreeRoom' ? 3 : room.type === 'TwoRoom' ? 2 : 1 }, (_, index) => <span key={index}><BedDouble size={23} /><small>{room.type === 'Apartment' ? '주거 공간' : `방 ${index + 1}`}</small></span>)}</div>
            {teamBadges}
        </> : <div className="ta-pool-heading"><div><span className="ta-eyebrow">WORKERS</span><h2>미배정 작업자 <b>{count}</b></h2></div><Users size={21} /></div>}
        <div className="ta-residents">{children}{!matchedCount && <div className="ta-drop-hint"><Home size={22} /><p>{count ? '검색 조건에 맞는 작업자가 없습니다' : room ? '조회 중인 팀의 배정 인원이 없습니다' : '조회 중인 미배정 작업자가 없습니다'}</p><small>{room ? '작업자를 이곳으로 옮겨주세요' : '이곳으로 옮기면 배정을 해제합니다'}</small></div>}</div>
        <button type="button" className="ta-assign-button" disabled={disabled || !selectedCount} onClick={onAssign}>{room ? '선택 작업자 배정' : '선택 작업자 배정 해제'}{selectedCount > 0 && ` (${selectedCount}명)`}<ChevronRight size={15} /></button>
    </section>;
}

export default function TeamAccommodationPage() {
    const { currentUser } = useAuth();
    const [board, setBoard] = useState<TeamAccommodationBoard | null>(null);
    const [draft, setDraft] = useState<Record<string, string | null>>({});
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [roomQuery, setRoomQuery] = useState('');
    const [type, setType] = useState('all');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [dragging, setDragging] = useState<string | null>(null);
    const request = useRef(0);
    const requestedTeam = useRef<string>();
    const savingRef = useRef(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const teamTabsRef = useRef<HTMLElement>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
    const sample = isDevAdminSessionEnabled();
    const disabled = loading || saving || sample || isDevPreviewFrame;
    const changes = board?.workers.filter(worker => draft[worker.id] !== undefined && draft[worker.id] !== worker.accommodationId)
        .map(worker => ({ workerId: worker.id, accommodationId: draft[worker.id] })) || [];
    const dirty = changes.length > 0;

    const load = useCallback(async (teamId?: string) => {
        requestedTeam.current = teamId;
        const version = ++request.current;
        setLoading(true); setError(''); setBoard(null); setDraft({}); setSelected([]);
        try {
            const next = await teamAccommodationBoardService.load(teamId);
            if (version !== request.current) return;
            setBoard(next); setDraft(Object.fromEntries(next.workers.map(worker => [worker.id, worker.accommodationId])));
        } catch (reason) {
            if (version === request.current) setError(teamAccommodationErrorMessage(reason, 'load'));
        } finally { if (version === request.current) setLoading(false); }
    }, []);
    useEffect(() => {
        if (sample) { openRealAccommodationSession(); return; }
        setConfirming(false); setNotice('');
        void load();
        return () => { request.current += 1; };
    }, [load, currentUser?.uid, sample]);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    useEffect(() => {
        if (confirming) dialogRef.current?.showModal();
        else dialogRef.current?.close();
    }, [confirming]);
    useEffect(() => {
        const tabs = teamTabsRef.current;
        const active = tabs?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
        if (tabs && active) tabs.scrollLeft = active.offsetLeft - (tabs.clientWidth - active.clientWidth) / 2;
    }, [board?.teamId]);

    const assign = (ids: string[], roomId: string | null) => {
        if (disabled || !board || (roomId && !board.rooms.some(room => room.id === roomId))) return;
        const permitted = ids.filter(id => board.workers.some(worker => worker.id === id && !worker.lockedReason));
        setDraft(previous => ({ ...previous, ...Object.fromEntries(permitted.map(id => [id, roomId])) }));
        setSelected([]); setNotice(`${permitted.length}명의 배정을 변경했습니다. 변경사항을 저장해 주세요.`); setError('');
    };
    const onDrop = ({ active, over }: DragEndEvent) => {
        setDragging(null);
        if (!over) return;
        const id = String(active.id);
        assign(selected.includes(id) ? selected : [id], over.id === unassigned ? null : String(over.id));
    };
    const save = async () => {
        if (!board || disabled || !changes.length || savingRef.current) return;
        savingRef.current = true; setSaving(true); setError('');
        try {
            await teamAccommodationBoardService.save(board, changes);
            setConfirming(false);
            setNotice(`${changes.length}명의 배정을 저장했습니다.`);
            await load(board.teamId);
        } catch (reason) {
            setConfirming(false);
            setError(teamAccommodationErrorMessage(reason, 'save'));
        } finally { savingRef.current = false; setSaving(false); }
    };
    const reset = () => {
        if (!board || disabled || (dirty && !window.confirm('저장 전 변경사항을 되돌리시겠습니까?'))) return;
        setDraft(Object.fromEntries(board.workers.map(worker => [worker.id, worker.accommodationId]))); setSelected([]); setNotice('변경사항을 되돌렸습니다.');
    };
    const reload = (teamId?: string) => {
        if (disabled || (dirty && !window.confirm('저장 전 변경사항을 버리고 다시 불러오시겠습니까?'))) return;
        if (teamId !== board?.teamId) { setQuery(''); setRoomQuery(''); setType('all'); }
        setNotice(''); void load(teamId);
    };
    const visible = (worker: Worker) => !query || `${worker.name} ${worker.role} ${worker.teamName || ''}`.toLowerCase().includes(query.toLowerCase().trim());
    const residents = (roomId: string | null, search = true) => (board?.workers || []).filter(worker => draft[worker.id] === roomId && (!search || visible(worker)));
    const colorFor = (worker: Worker) => board?.teams.find(team => team.id === worker.teamId)?.color;
    const renderWorker = (worker: Worker) => <WorkerCard key={worker.id} worker={worker} color={colorFor(worker)} selected={selected.includes(worker.id)} changed={draft[worker.id] !== worker.accommodationId} disabled={disabled}
        onSelect={() => setSelected(previous => previous.includes(worker.id) ? previous.filter(id => id !== worker.id) : [...previous, worker.id])} />;
    const roomName = (id: string | null) => board?.rooms.find(room => room.id === id)?.name || '미배정';
    const assignedCount = board?.workers.filter(worker => draft[worker.id] && !worker.lockedReason).length || 0;
    const unassignedCount = board?.workers.filter(worker => !draft[worker.id] && !worker.lockedReason).length || 0;
    const lockedCount = board?.workers.filter(worker => worker.lockedReason).length || 0;
    const rooms = board?.rooms.filter(room => (type === 'all' || type === room.type) && `${room.name} ${room.address}`.includes(roomQuery.trim()))
        .sort((a, b) => Number(residents(b.id, false).length > 0) - Number(residents(a.id, false).length > 0) || a.name.localeCompare(b.name, 'ko')) || [];
    const activeTeam = board?.teams.find(team => team.id === board.teamId);
    const filteredTeam = board?.teamId !== '__all__';
    const teamBadges = (roomId: string) => {
        const groups = new Map<string, { worker: Worker; count: number }>();
        residents(roomId, false).forEach(worker => {
            const key = worker.teamId || '';
            const group = groups.get(key);
            groups.set(key, { worker, count: (group?.count || 0) + 1 });
        });
        return <div className="ta-room-teams" aria-label="배정된 작업자의 소속 팀">{[...groups].map(([id, { worker, count }]) => <span key={id} style={teamAccommodationStyle(colorFor(worker))}><i aria-hidden="true" />{worker.teamName || '소속 미지정'}<b>{count}</b></span>)}</div>;
    };

    return <main className="ta-page" style={teamAccommodationStyle(activeTeam?.color)}>
        <header className="ta-header"><div><div className="ta-eyebrow"><Home size={14} /> TEAM LIVING</div><h1>{board?.canManageAll ? '전체 숙소 배정' : '우리 팀 숙소 배정'}</h1><p>{board?.canManageAll ? '청연이엔지 소속 팀을 선택하고, 작업자가 머무를 숙소를 배정하세요.' : '청연이엔지 소속 우리 팀 작업자가 머무는 곳을 한눈에 보고 배정하세요.'}</p></div><button className="ta-icon-button" disabled={disabled} onClick={() => reload(board?.teamId)} aria-label="배정 새로고침"><RefreshCw size={18} /></button></header>
        {sample && <p className="ta-sample">실제 작업자와 숙소를 불러오기 위해 계정을 연결하고 있습니다.</p>}
        {isDevPreviewFrame && <p className="ta-sample">사용자 미리보기에서는 배정 현황만 조회할 수 있습니다.</p>}
        {error && <div className="ta-error" role="alert"><span>{error}</span><button disabled={saving || loading} onClick={() => reload(requestedTeam.current)}>다시 불러오기</button></div>}
        <p className="ta-announcement" role="status" aria-live="polite">{notice}</p>
        {loading ? <div className="ta-loading"><Loader2 className="ta-spin" /> 팀 숙소와 작업자를 불러오고 있습니다.</div> : board && <>
            <div className="ta-overview"><div className="ta-team"><span className="ta-team-icon"><Building2 size={24} /></span><div><label htmlFor="ta-team">{board.canManageAll ? '작업자 팀' : '배정할 팀'}</label><select id="ta-team" value={board.teamId} disabled={disabled || (!board.canManageAll && board.teams.length <= 1)} onChange={event => reload(event.target.value)}>{board.canManageAll && <option value="__all__">청연이엔지 전체 팀</option>}{board.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select><small>{board.date} 기준{board.canManageAll && board.teamId !== '__all__' ? ' · 선택 팀 인원 표시' : ''}</small></div></div>
                <div className="ta-stat"><span>{filteredTeam ? '팀 숙소' : '전체 숙소'}</span><strong>{board.rooms.length}<small>곳</small></strong></div><div className="ta-stat"><span>배정 완료</span><strong>{assignedCount}<small>명</small></strong></div><div className="ta-stat ta-stat-wait"><span>미배정</span><strong>{unassignedCount}<small>명</small></strong></div>{lockedCount > 0 && <div className="ta-stat"><span>확인 필요</span><strong>{lockedCount}<small>명</small></strong></div>}
            </div>
            <nav ref={teamTabsRef} className="ta-team-tabs" aria-label="팀별 작업자 불러오기">{board.teams.map(team => <button key={team.id} style={teamAccommodationStyle(team.color)} className={board.teamId === team.id ? 'is-active' : ''} aria-pressed={board.teamId === team.id} disabled={disabled} onClick={() => { if (team.id !== board.teamId) reload(team.id); }}><i aria-hidden="true" />{team.name}{board.teamId === team.id && <Check size={14} />}</button>)}{board.canManageAll && <button className={board.teamId === '__all__' ? 'is-active' : ''} aria-pressed={board.teamId === '__all__'} disabled={disabled} onClick={() => { if (board.teamId !== '__all__') reload('__all__'); }}><Users size={14} />청연 전체 팀</button>}</nav>
            <div className="ta-scope-heading"><div><span className="ta-color-dot" aria-hidden="true" /><h2>{activeTeam?.name || '청연 전체 팀'} 작업자 <b>{board.workers.length}명</b></h2></div><p>{filteredTeam ? '선택한 팀의 작업자와 현재 배정된 숙소만 표시합니다.' : '청연이엔지 소속팀만 표시합니다. 선택한 작업자를 전체 숙소에 배정할 수 있습니다.'}</p></div>
            <div className="ta-toolbar"><label className="ta-search"><Search size={17} /><input aria-label="작업자 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="작업자 이름, 직종 검색" /></label><label className="ta-search ta-room-search"><Building2 size={17} /><input aria-label="숙소 검색" value={roomQuery} onChange={event => setRoomQuery(event.target.value)} placeholder="숙소 이름, 주소 검색" /></label><div className="ta-filters" aria-label="숙소 유형 필터">{[['all', '전체'], ...Object.entries(labels)].map(([value, label]) => <button key={value} aria-pressed={type === value} className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>{label}</button>)}</div></div>
            <div className="ta-instruction"><span><GripVertical size={16} /> 작업자를 끌어 옮기거나, 선택 후 숙소의 배정 버튼을 누르세요.</span><span>{selected.length ? `${selected.length}명 선택됨` : '여러 명을 함께 배정할 수 있어요'}{selected.length > 0 && <button onClick={() => setSelected([])}>선택 해제</button>}</span></div>
            <DndContext sensors={sensors} onDragStart={event => setDragging(String(event.active.id))} onDragEnd={onDrop} onDragCancel={() => setDragging(null)}>
                <div className="ta-board"><aside><RoomZone count={residents(null, false).length} matchedCount={residents(null).length} filteredTeam={filteredTeam} selectedCount={selected.length} disabled={disabled} onAssign={() => assign(selected, null)}>{residents(null).map(renderWorker)}</RoomZone></aside>
                    <div className="ta-rooms">{rooms.map(room => <RoomZone key={room.id} room={room} count={residents(room.id, false).length} matchedCount={residents(room.id).length} filteredTeam={filteredTeam} teamBadges={teamBadges(room.id)} selectedCount={selected.length} disabled={disabled} onAssign={() => assign(selected, room.id)}>{residents(room.id).map(renderWorker)}</RoomZone>)}
                        {!rooms.length && <div className="ta-empty"><Building2 size={38} /><h2>{board.rooms.length ? '조건에 맞는 숙소가 없습니다' : filteredTeam ? '아직 팀에 배정된 숙소가 없습니다' : '현재 배정 가능한 숙소가 없습니다'}</h2><p>{board.rooms.length ? '숙소 검색어나 유형을 변경해 주세요.' : filteredTeam ? '숙소 관리에서 해당 팀에 숙소를 배정하면 여기에 표시됩니다.' : '숙소 관리에서 운영 상태와 계약 기간을 확인해 주세요.'}</p></div>}
                    </div></div><DragOverlay>{dragging && <div className="ta-drag-preview"><Users size={18} />{selected.includes(dragging) && selected.length > 1 ? `${selected.length}명 함께 배정` : board.workers.find(worker => worker.id === dragging)?.name}</div>}</DragOverlay>
            </DndContext>
            {!board.workers.length && <p className="ta-sample">{board.canManageAll ? '선택한 조회 범위에 재직 작업자가 없습니다.' : '현재 소속 팀에 등록된 재직 작업자가 없습니다.'}</p>}
            <footer className={`ta-savebar ${dirty ? 'has-changes' : ''}`}><div><span className={`ta-save-icon ${dirty ? 'is-dirty' : ''}`}>{dirty ? <CheckCheck size={20} /> : <Check size={20} />}</span><p><strong>{dirty ? `${changes.length}명의 배정이 변경되었습니다` : '현재 배정 현황입니다'}</strong><small>{dirty ? '내용을 확인하고 저장하면 숙소 배정에 반영됩니다.' : '숙소 유형의 방 수는 입실 정원을 의미하지 않습니다.'}</small></p></div><div><button className="ta-secondary" disabled={disabled || !dirty} onClick={reset}><Undo2 size={16} />되돌리기</button><button className="ta-primary" disabled={disabled || !dirty || changes.length > 100} onClick={() => setConfirming(true)}>{saving ? <Loader2 className="ta-spin" size={17} /> : <CheckCheck size={17} />}변경사항 저장{dirty && ` (${changes.length})`}</button></div></footer>
            {changes.length > 100 && <p role="alert" className="ta-error">한 번에 최대 100명까지 저장할 수 있습니다.</p>}
        </>}
        <dialog className="ta-dialog" ref={dialogRef} onCancel={event => { if (saving) event.preventDefault(); else setConfirming(false); }} onClose={() => setConfirming(false)}>
            <div className="ta-dialog-header"><div><span className="ta-eyebrow">REVIEW CHANGES</span><h2>배정 변경 확인</h2></div><button className="ta-icon-button" aria-label="배정 확인 닫기" disabled={saving} onClick={() => setConfirming(false)}><X size={20} /></button></div>
            <p>{board?.date}부터 적용할 {changes.length}명의 배정을 확인해 주세요.</p>
            <ul>{changes.map(change => { const worker = board?.workers.find(row => row.id === change.workerId); return <li key={change.workerId}><strong>{worker?.name}</strong><div><span>{roomName(worker?.accommodationId || null)}</span><ChevronRight size={14} /><b>{roomName(change.accommodationId)}</b></div></li>; })}</ul>
            <div className="ta-dialog-actions"><button className="ta-secondary" disabled={saving} onClick={() => setConfirming(false)}>계속 편집</button><button className="ta-primary" disabled={disabled} onClick={() => void save()}>{saving ? '저장 중…' : '배정 확정 저장'}</button></div>
        </dialog>
    </main>;
}
