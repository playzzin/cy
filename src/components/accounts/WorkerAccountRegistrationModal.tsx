import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { manpowerService, Worker } from '../../services/manpowerService';
import { BANK_PHOTO_ACCEPT, readWorkerBankPhoto, saveWorkerBankPhoto, validateWorkerBankPhoto } from '../../services/workerBankPhotoService';
import { isCompleteBankAccount, normalizeBankAccountFields } from '../../services/bankAccountPhotoService';
import { getWorkerAccount, WorkerAccountPurpose, workerAccountLabel, workerAccountPatch, workerPhotoField } from '../../utils/workerAccount';

interface Props {
    worker: Worker;
    purpose: WorkerAccountPurpose;
    onSaved: (updates: Partial<Worker>) => void;
    onClose: () => void;
}
const newPhotoId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

export default function WorkerAccountRegistrationModal({ worker, purpose, onSaved, onClose }: Props) {
    const [fields, setFields] = useState(() => getWorkerAccount(worker, purpose));
    const [photo, setPhoto] = useState<{ file: File; id: string } | null>(null);
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [invalidPhoto, setInvalidPhoto] = useState(false);
    const running = useRef(false);
    // A photo retry must not write the already-saved account over a later edit elsewhere.
    const savedAccount = useRef<string | null>(null);
    const photoField = workerPhotoField(purpose);
    const expectedPhotoId = useRef(worker[photoField] || '');
    const label = workerAccountLabel(purpose);
    const basic = getWorkerAccount(worker, 'default');

    useEffect(() => {
        if (!photo) { setPreview(''); return; }
        const url = URL.createObjectURL(photo.file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [photo]);

    const copyBasic = async () => {
        if (running.current) return;
        running.current = true; setBusy(true); setError('');
        try {
            // Fetch before changing the draft so a failed read cannot silently copy only half of it.
            const file = worker.bankPhotoId ? await readWorkerBankPhoto(worker.id!, `${worker.name}_기본계좌`) : null;
            if (worker.bankPhotoId && !file) throw new Error('기본 계좌사진이 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
            const copiedPhoto = file ? { file, id: newPhotoId() } : null;
            setFields(basic);
            setPhoto(copiedPhoto);
            setInvalidPhoto(false);
            setNotice(file ? '기본 계좌정보와 사진을 가져왔습니다. 저장하면 직불용으로 별도 보관됩니다.'
                : '기본 계좌정보를 가져왔습니다. 기본 계좌사진이 없어 직불용 사진은 아래에서 선택해 주세요.');
        } catch (failure) { setError(failure instanceof Error ? failure.message : '기본 계좌를 가져오지 못했습니다.'); }
        finally { running.current = false; setBusy(false); }
    };
    const viewPhoto = async () => {
        if (running.current) return;
        running.current = true; setBusy(true); setError('');
        try {
            const file = await readWorkerBankPhoto(worker.id!, `${worker.name}_${label}`, undefined, purpose);
            if (!file) throw new Error('등록된 사진이 없습니다.');
            // Viewing the original must not stage it for another upload.
            const url = URL.createObjectURL(file);
            viewedUrls.current.push(url); setPreview(url);
        } catch (failure) { setError(failure instanceof Error ? failure.message : '사진을 불러오지 못했습니다.'); }
        finally { running.current = false; setBusy(false); }
    };
    const viewedUrls = useRef<string[]>([]);
    useEffect(() => { const urls = viewedUrls.current; return () => urls.forEach(url => URL.revokeObjectURL(url)); }, []);

    const save = async () => {
        if (running.current || !worker.id || invalidPhoto || !isCompleteBankAccount(fields)) return;
        running.current = true; setBusy(true); setError('');
        let accountSaved = savedAccount.current !== null;
        try {
            const updates = workerAccountPatch(normalizeBankAccountFields(fields), purpose);
            const serialized = JSON.stringify(updates);
            if (savedAccount.current !== serialized) {
                accountSaved = false;
                await manpowerService.updateWorker(worker.id, updates);
                savedAccount.current = serialized;
                accountSaved = true;
                onSaved(updates);
            }
            if (photo) {
                const id = await saveWorkerBankPhoto(worker.id, photo.file, photo.id, expectedPhotoId.current, purpose);
                expectedPhotoId.current = id;
                onSaved({ [photoField]: id });
            }
            onClose();
        } catch (failure) {
            setError(`${accountSaved ? '계좌정보는 저장됐지만 사진은 저장하지 못했습니다. 다시 저장을 눌러 주세요. ' : ''}${failure instanceof Error ? failure.message : '저장하지 못했습니다.'}`);
        } finally { running.current = false; setBusy(false); }
    };
    const close = () => { if (!running.current) onClose(); };

    return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (running.current) event.preventDefault(); }}>
            <Dialog.Title className="text-lg font-bold text-slate-900">{worker.name} · {label} 등록</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-600">은행·계좌번호·예금주와 계좌사진을 용도별로 보관합니다.</Dialog.Description>
            {purpose === 'directPay' && <div className="my-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <button type="button" disabled={busy || !isCompleteBankAccount(basic)} onClick={() => void copyBasic()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">기본 계좌와 동일</button>
                <p className="mt-2 text-xs text-indigo-800">기본 계좌정보와 등록된 사진을 함께 복사합니다. 이후 변경은 각각 저장합니다.</p>
                {!isCompleteBankAccount(basic) && <p className="mt-1 text-xs text-amber-800">기본 계좌의 은행·계좌번호·예금주를 먼저 입력해 주세요.</p>}
            </div>}
            <fieldset disabled={busy} className="mt-4 space-y-3">
                {(['bankName', 'accountNumber', 'accountHolder'] as const).map(key => <label key={key} className="block text-sm font-medium text-slate-700">
                    {{ bankName: '은행명', accountNumber: '계좌번호', accountHolder: '예금주' }[key]}
                    <input aria-label={`${label} ${{ bankName: '은행명', accountNumber: '계좌번호', accountHolder: '예금주' }[key]}`} value={fields[key]} inputMode={key === 'accountNumber' ? 'numeric' : 'text'} autoComplete="off" maxLength={100}
                        onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {key === 'accountNumber' && fields.accountNumber.trim() && !normalizeBankAccountFields(fields).accountNumber && <span role="alert" className="mt-1 block text-xs text-red-700">계좌번호는 앞자리 0을 포함한 숫자 6~20자리로 입력해 주세요. 공백과 하이픈은 저장할 때 제거됩니다.</span>}
                </label>)}
                <div className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-semibold">{label} 사진 · {photo ? '저장 대기' : expectedPhotoId.current ? '등록됨' : '미등록'}</span>
                        {!!expectedPhotoId.current && !photo && <button type="button" className="text-sm text-indigo-700 underline" onClick={() => void viewPhoto()}>등록된 사진 보기</button>}
                    </div>
                    <input type="file" accept={BANK_PHOTO_ACCEPT} aria-label={`${label} 사진 선택`} className="w-full text-sm" onChange={event => {
                        const file = event.target.files?.[0]; event.target.value = '';
                        if (!file) return;
                        try { validateWorkerBankPhoto(file); setPhoto({ file, id: newPhotoId() }); setInvalidPhoto(false); setError(''); setNotice('선택한 사진은 저장할 때 반영됩니다.'); }
                        catch (failure) { setInvalidPhoto(true); setError((failure as Error).message); }
                    }} />
                    <p className="mt-2 text-xs text-slate-500">JPG · PNG · WEBP / 5MB 이하. 사진을 선택하면 이 계좌의 기존 사진을 교체합니다.</p>
                    {preview && <img src={preview} alt={`${label} 사진 미리보기`} className="mt-3 max-h-56 w-full rounded-lg object-contain" />}
                </div>
            </fieldset>
            {notice && <p role="status" className="mt-3 text-sm text-indigo-700">{notice}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">취소</button>
                <button type="button" disabled={busy || invalidPhoto || !isCompleteBankAccount(fields)} onClick={() => void save()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? '처리 중…' : `${label} 저장`}</button>
            </div>
        </Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
}
