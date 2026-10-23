import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Camera, Loader2, Plus, Trash2, X } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { GEMINI_BILLING_SKIPPED_MESSAGE, isGeminiBillingError } from '../../services/geminiGatewayClient';
import {
    BANK_ACCOUNT_PHOTO_ACCEPT, BankAccountFields, isCompleteBankAccount,
    normalizeBankAccountFields, validateBankAccountPhoto,
} from '../../services/bankAccountPhotoService';

export interface AccountPhotoTarget { id: string; label: string }
interface Props {
    targets: AccountPhotoTarget[];
    initialTargetId?: string;
    onSave: (targetId: string, fields: BankAccountFields) => Promise<void>;
    onClose: () => void;
}
interface PhotoRow {
    id: number;
    file: File;
    preview: string;
    status: 'idle' | 'analyzing' | 'success' | 'error' | 'saved';
    targetId: string;
    fields: BankAccountFields;
    error?: string;
}
const labels: Record<keyof BankAccountFields, string> = { bankName: '은행명', accountNumber: '계좌번호', accountHolder: '예금주' };
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100';

export default function AccountPhotoRegistrationModal({ targets, initialTargetId, onSave, onClose }: Props) {
    const [rows, setRows] = useState<PhotoRow[]>([]);
    const [busy, setBusy] = useState<'analysis' | 'save' | null>(null);
    const [error, setError] = useState('');
    const [reviewed, setReviewed] = useState(false);
    const [dragging, setDragging] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const nextId = useRef(0);
    const urls = useRef(new Set<string>());
    const running = useRef(false);
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;
        const previews = urls.current;
        return () => {
            alive.current = false;
            previews.forEach(url => URL.revokeObjectURL(url));
            previews.clear();
        };
    }, []);
    const updateRow = (id: number, change: Partial<PhotoRow>) => {
        if (alive.current) setRows(previous => previous.map(row => row.id === id ? { ...row, ...change } : row));
    };
    const addFiles = (files: File[]) => {
        if (running.current) return;
        const added: PhotoRow[] = [];
        const errors: string[] = [];
        for (const file of files) {
            try {
                validateBankAccountPhoto(file);
                if (rows.length + added.length >= 20) throw new Error('한 번에 사진 20장까지 등록할 수 있습니다.');
                const preview = URL.createObjectURL(file);
                urls.current.add(preview);
                added.push({ id: ++nextId.current, file, preview, status: 'idle',
                    targetId: initialTargetId && targets.some(target => target.id === initialTargetId) ? initialTargetId : '',
                    fields: { bankName: '', accountNumber: '', accountHolder: '' } });
            } catch (failure) {
                errors.push(failure instanceof Error ? failure.message : '사진을 추가하지 못했습니다.');
            }
        }
        setRows(previous => [...previous, ...added]);
        setError([...new Set(errors)].join(' ')); setReviewed(false);
    };
    const analyze = async () => {
        if (running.current) return;
        running.current = true;
        setBusy('analysis'); setError(''); setReviewed(false);
        const pending = rows.filter(row => row.status === 'idle' || row.status === 'error');
        try {
            for (let i = 0; i < pending.length && alive.current; i += 1) {
                const row = pending[i];
                updateRow(row.id, { status: 'analyzing', error: undefined });
                try {
                    const fields = normalizeBankAccountFields(await geminiService.analyzeBankBook(row.file));
                    // The recipient is selected by the user, independently of the account holder.
                    updateRow(row.id, { status: 'success', fields });
                } catch (failure) {
                    updateRow(row.id, { status: 'error', error: failure instanceof Error ? failure.message : '사진 분석에 실패했습니다.' });
                    if (isGeminiBillingError(failure)) {
                        pending.slice(i + 1).forEach(item => updateRow(item.id, { status: 'error', error: GEMINI_BILLING_SKIPPED_MESSAGE }));
                        break;
                    }
                }
            }
        } finally {
            running.current = false;
            if (alive.current) setBusy(null);
        }
    };
    const pending = rows.filter(row => row.status !== 'saved');
    const duplicateTarget = rows.some((row, index) => row.targetId && rows.some((other, otherIndex) => index !== otherIndex && other.targetId === row.targetId));
    const complete = pending.length > 0 && pending.every(row => row.status === 'success'
        && targets.some(target => target.id === row.targetId) && isCompleteBankAccount(row.fields));
    const canSave = complete && !duplicateTarget && reviewed && !busy;
    const save = async () => {
        if (!canSave || running.current) return;
        running.current = true; setBusy('save'); setError('');
        let failed = false;
        try {
            for (const row of pending) {
                if (!alive.current) break;
                try {
                    await onSave(row.targetId, normalizeBankAccountFields(row.fields));
                    updateRow(row.id, { status: 'saved', error: undefined });
                } catch {
                    failed = true;
                    updateRow(row.id, { error: '저장하지 못했습니다. 연결 상태와 권한을 확인한 뒤 다시 저장해 주세요.' });
                }
            }
            if (alive.current) {
                if (failed) setError('일부 계좌를 저장하지 못했습니다. 저장 완료된 항목은 다시 저장하지 않습니다.');
                else onClose();
            }
        } finally {
            running.current = false;
            if (alive.current) setBusy(null);
        }
    };
    const close = () => { if (!running.current) onClose(); };

    return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
        <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (running.current) event.preventDefault(); }}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
                    <div>
                        <Dialog.Title className="flex items-center gap-2 text-lg font-bold text-slate-900"><Camera size={20} className="text-orange-600" />계좌번호 등록 (사진 분석)</Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm text-slate-600">사진에서 은행·계좌번호·예금주를 읽어 계좌정보를 등록합니다. 공유용 통장사본 사진은 저장하거나 교체하지 않습니다.</Dialog.Description>
                    </div>
                    <button type="button" aria-label="계좌번호 등록 (사진 분석) 닫기" disabled={!!busy} onClick={close} className="rounded-lg p-2 text-slate-600 disabled:opacity-40"><X size={20} /></button>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 sm:p-5">
                    <p className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">등록할 사람·대상을 직접 선택하세요. 다른 사람 명의의 계좌도 등록할 수 있습니다. 계좌번호는 전체 표시되며, 저장하면 선택한 대상의 기존 계좌정보가 변경됩니다.</p>
                    <input ref={input} type="file" multiple accept={BANK_ACCOUNT_PHOTO_ACCEPT} aria-label="계좌 사진 선택" className="hidden" disabled={!!busy}
                        onChange={event => { addFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
                    <button type="button" disabled={!!busy} onClick={() => input.current?.click()}
                        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
                        onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
                        className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed p-5 text-sm disabled:opacity-50 ${dragging ? 'border-orange-500 bg-orange-50' : 'border-slate-300 bg-white text-slate-700'}`}>
                        <span className="flex items-center gap-2 font-semibold"><Plus size={18} />{rows.length ? '계좌 사진 추가' : '계좌 사진 선택 또는 끌어놓기'}</span>
                        <span className="text-xs text-slate-500">JPG · PNG · WEBP / 장당 5MB 이하 / 최대 20장</span>
                    </button>
                    {rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-slate-600">사진 {rows.length}장 · 저장 완료 {rows.filter(row => row.status === 'saved').length}건</span>
                        <button type="button" onClick={() => void analyze()} disabled={!!busy || !rows.some(row => row.status === 'idle' || row.status === 'error')}
                            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            {busy === 'analysis' && <Loader2 size={16} className="animate-spin" />}{busy === 'analysis' ? 'Gemini 분석 중…' : 'Gemini로 계좌 읽기'}
                        </button>
                    </div>}
                    {rows.map((row, index) => <section key={row.id} aria-label={`계좌 사진 ${index + 1}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium text-slate-700">{index + 1}. {row.file.name}</span>
                            <button type="button" disabled={!!busy || row.status === 'saved'} aria-label={`${index + 1}번 사진 제거`} className="shrink-0 p-2 text-slate-500 disabled:opacity-40" onClick={() => {
                                URL.revokeObjectURL(row.preview); urls.current.delete(row.preview);
                                setRows(previous => previous.filter(item => item.id !== row.id)); setReviewed(false);
                            }}><Trash2 size={16} /></button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <a href={row.preview} target="_blank" rel="noreferrer" className="block text-center text-xs text-slate-500">
                                <img src={row.preview} alt={`${index + 1}번 계좌 사진 원본`} className="mx-auto max-h-40 w-full rounded-lg bg-slate-100 object-contain" />원본 크게 보기
                            </a>
                            <fieldset disabled={!!busy || row.status === 'saved'} className="min-w-0 space-y-3">
                                <label className="block text-sm font-semibold text-slate-700">등록할 사람·대상
                                    <select aria-label={`${index + 1}번 등록할 사람·대상`} value={row.targetId} className={`${inputClass} mt-1`} onChange={event => { updateRow(row.id, { targetId: event.target.value, error: undefined }); setReviewed(false); }}>
                                        <option value="">직접 선택해 주세요</option>
                                        {targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
                                    </select>
                                </label>
                                <div className="grid gap-2 md:grid-cols-3">
                                    {(Object.keys(labels) as Array<keyof BankAccountFields>).map(key => <label key={key} className="block text-xs text-slate-600">{labels[key]}
                                        <input type="text" aria-label={`${index + 1}번 ${labels[key]}`} autoComplete="off" inputMode={key === 'accountNumber' ? 'numeric' : 'text'} maxLength={key === 'accountNumber' ? 40 : 100}
                                            disabled={row.status !== 'success'} value={row.fields[key]} className={`${inputClass} mt-1`} placeholder="확인 후 입력"
                                            onChange={event => { updateRow(row.id, { fields: { ...row.fields, [key]: event.target.value }, error: undefined }); setReviewed(false); }} />
                                    </label>)}
                                </div>
                                <p role="status" className="text-xs text-slate-600">{row.status === 'saved' ? '저장 완료' : row.status === 'success' ? '인식 완료 · 원본과 비교하고 틀린 항목을 수정하세요.' : row.status === 'analyzing' ? 'Gemini 분석 중…' : row.status === 'error' ? '분석 실패 · 다시 분석하거나 사진을 바꿔 주세요.' : '분석 대기'}</p>
                                {row.status === 'success' && !isCompleteBankAccount(row.fields) && <p className="text-xs text-amber-700">은행명·전체 계좌번호(숫자 6~20자리)·예금주를 확인해 주세요. 가려진 숫자는 추측하지 않습니다.</p>}
                                {row.error && <p role="alert" className="text-sm text-red-700">{row.error}</p>}
                            </fieldset>
                        </div>
                    </section>)}
                    {duplicateTarget && <p role="alert" className="text-sm text-red-700">한 대상에 여러 계좌를 저장할 수 없습니다. 등록할 대상을 바꾸거나 중복 사진을 제거해 주세요.</p>}
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    {targets.length === 0 && <p className="text-sm text-amber-700">등록할 대상이 없습니다. 작업자·팀·회사 또는 매입/기타 계좌 항목을 먼저 추가해 주세요.</p>}
                </div>
                <div className="space-y-3 border-t border-slate-200 bg-white p-4 sm:p-5">
                    <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={reviewed} disabled={!complete || duplicateTarget || !!busy} onChange={event => setReviewed(event.target.checked)} />등록할 대상과 은행·전체 계좌번호·예금주를 확인했습니다.</label>
                    <div className="flex justify-end gap-2">
                        <button type="button" disabled={!!busy} onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">닫기</button>
                        <button type="button" disabled={!canSave} onClick={() => void save()} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'save' ? '저장 중…' : `확인한 계좌 ${pending.length}건 저장`}</button>
                    </div>
                </div>
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
