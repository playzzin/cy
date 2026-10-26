import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Worker } from '../../services/manpowerService';
import { BANK_PHOTO_ACCEPT, saveWorkerBankPhoto, validateWorkerBankPhoto } from '../../services/workerBankPhotoService';
import './WorkerIdImageShare.css';

type PhotoWorker = Pick<Worker, 'id' | 'name' | 'teamName' | 'directPayBankPhotoId'>;
type Row = { file: File; url: string; photoId: string; saved?: boolean; error?: string };
const newPhotoId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
export default function WorkerBankPhotoRegistration({ workers, disabled, onSaved }: {
    workers: PhotoWorker[]; disabled?: boolean; onSaved: (updates: { workerId: string; directPayBankPhotoId: string }[]) => void;
}) {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
    const [rows, setRows] = useState<Record<string, Row>>({}), [message, setMessage] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const alive = useRef(true), running = useRef(false), urls = useRef(new Set<string>());
    const selection = workers.map(worker => worker.id).join('|'), latestSelection = useRef(selection);
    latestSelection.current = selection;
    const titleId = useId();
    const clear = () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setRows({}); setErrors({}); setMessage(''); };
    useEffect(() => { alive.current = true; const currentUrls = urls.current; return () => { alive.current = false; currentUrls.forEach(url => URL.revokeObjectURL(url)); }; }, []);
    useEffect(() => { setOpen(false); clear(); }, [selection]);
    useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
    const close = () => { if (running.current) return; dialog.current?.close(); setOpen(false); clear(); trigger.current?.focus(); };
    const choose = (workerId: string, file?: File) => {
        if (!file || running.current) return;
        try {
            validateWorkerBankPhoto(file);
            if (rows[workerId]) { URL.revokeObjectURL(rows[workerId].url); urls.current.delete(rows[workerId].url); }
            const url = URL.createObjectURL(file); urls.current.add(url);
            setRows(previous => ({ ...previous, [workerId]: { file, url, photoId: newPhotoId() } }));
            setErrors(previous => ({ ...previous, [workerId]: '' })); setMessage('');
        } catch (error) { setErrors(previous => ({ ...previous, [workerId]: (error as Error).message })); }
    };
    const pending = workers.filter(worker => worker.id && rows[worker.id] && !rows[worker.id].saved && !errors[worker.id]);
    const save = async () => {
        if (running.current || !pending.length) return;
        running.current = true; setBusy(true); setMessage('직불용 통장사본 원본을 등록하고 있습니다.');
        const updates: { workerId: string; directPayBankPhotoId: string }[] = [];
        try {
            for (const worker of pending) {
                if (!alive.current || latestSelection.current !== selection) break;
                const row = rows[worker.id!];
                try {
                    const directPayBankPhotoId = await saveWorkerBankPhoto(worker.id!, row.file, row.photoId, worker.directPayBankPhotoId || '', 'directPay');
                    updates.push({ workerId: worker.id!, directPayBankPhotoId });
                    if (alive.current && latestSelection.current === selection) setRows(previous => ({ ...previous, [worker.id!]: { ...row, saved: true, error: undefined } }));
                } catch (error) {
                    if (alive.current && latestSelection.current === selection) setRows(previous => ({ ...previous, [worker.id!]: { ...row, error: error instanceof Error ? error.message : '등록하지 못했습니다. 다시 시도해 주세요.' } }));
                }
            }
            if (alive.current && latestSelection.current === selection) {
                if (updates.length) onSaved(updates);
                setMessage(`${updates.length}장 등록 완료${updates.length < pending.length ? ' · 실패한 사진을 확인한 뒤 다시 등록해 주세요.' : ' · 닫은 뒤 직불용 통장사본 공유를 누르세요.'}`);
            }
        } finally { running.current = false; if (alive.current) setBusy(false); }
    };
    return <>
        <button ref={trigger} type="button" className="ws-id-share-trigger ws-bank-register" disabled={disabled || !workers.length || busy} onClick={() => { clear(); setOpen(true); }}>직불용 통장사본 등록</button>
        {open && createPortal(<dialog ref={dialog} className="worker-id-share" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
            <header><div><h2 id={titleId}>직불용 통장사본 원본 등록</h2><p>작업자마다 직불용 통장사본이나 은행 앱의 계좌 화면 사진을 선택하세요. JPG·PNG·WEBP, 사진당 5MB까지 가능합니다.</p></div><button type="button" disabled={busy} onClick={close} aria-label="직불용 통장사본 등록 닫기">닫기</button></header>
            <p>공유할 직불용 통장사본 사진만 저장합니다. 은행명·계좌번호·예금주는 변경되지 않습니다. 등록할 작업자를 확인해 주세요. 기존 사진이 있으면 새 원본으로 교체됩니다.</p>
            <p role="status" aria-live="polite">{message}</p>
            <div className="worker-id-share__images">{workers.map(worker => worker.id && <article key={worker.id}>
                <strong>{worker.name}</strong><span>{worker.teamName}</span>
                <p>{rows[worker.id]?.saved ? '등록 완료' : worker.directPayBankPhotoId ? '기존 직불용 통장사본 있음' : '직불용 통장사본 미등록'}</p>
                {rows[worker.id] && <img src={rows[worker.id].url} alt={`${worker.name} 등록할 직불용 통장사본`} />}
                <label className="worker-bank-photo-input">사진 선택<input aria-label={`${worker.name} 직불용 통장사본 선택`} type="file" accept={BANK_PHOTO_ACCEPT} disabled={busy} onChange={event => { choose(worker.id!, event.target.files?.[0]); event.target.value = ''; }} /></label>
                {(errors[worker.id] || rows[worker.id]?.error) && <p role="alert" className="worker-id-share__error">{errors[worker.id] || rows[worker.id]?.error}</p>}
            </article>)}</div>
            <button type="button" className="worker-id-share__primary" style={{ marginTop: 16 }} disabled={busy || !pending.length} onClick={() => void save()}>{busy ? '등록 중…' : `사진 ${pending.length}장 원본 등록`}</button>
        </dialog>, document.body)}
    </>;
}
