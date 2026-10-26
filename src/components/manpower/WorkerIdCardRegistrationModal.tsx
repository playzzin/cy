import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { manpowerService, Worker } from '../../services/manpowerService';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';

interface Props {
    worker: Worker;
    onSaved: (storagePath: string) => void;
    onClose: () => void;
}

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const EXTENSION_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export default function WorkerIdCardRegistrationModal({ worker, onSaved, onClose }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const running = useRef(false);
    const uploadedPath = useRef('');

    useEffect(() => {
        if (!file) { setPreview(''); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const selectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        event.target.value = '';
        if (!selected || running.current) return;
        // Clear the previous draft so an invalid replacement cannot save the old selection.
        setFile(null); uploadedPath.current = ''; setError('');
        const type = (!selected.type || selected.type === 'application/octet-stream')
            ? EXTENSION_TYPES[selected.name.split('.').pop()?.toLowerCase() || ''] : selected.type.toLowerCase();
        if (!IMAGE_TYPES[type] || !selected.size || selected.size > 5 * 1024 * 1024) {
            setError('JPG·PNG·WEBP 사진을 5MB 이하로 선택해 주세요.');
            return;
        }
        setFile(type === selected.type ? selected : new File([selected], selected.name, { type, lastModified: selected.lastModified }));
    };

    const save = async () => {
        if (running.current || !file || !worker.id) return;
        running.current = true; setBusy(true); setError('');
        try {
            if (!uploadedPath.current) {
                const photoId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
                const path = `id_cards/${photoId}.${IMAGE_TYPES[file.type]}`;
                await uploadBytes(ref(storage, path), file);
                uploadedPath.current = path;
            }
            // Attach the photo to the selected existing worker; never replace their other fields.
            await manpowerService.updateWorker(worker.id, { fileNameSaved: uploadedPath.current });
            onSaved(uploadedPath.current);
            onClose();
        } catch (failure) {
            const code = (failure as { code?: string })?.code;
            setError(code === 'storage/unauthorized' || code === 'permission-denied' || code === 'firestore/permission-denied'
                ? '신분증을 저장할 권한이 없습니다. 로그인 계정과 권한을 확인해 주세요.'
                : '신분증을 저장하지 못했습니다. 연결 상태를 확인한 뒤 다시 저장해 주세요.');
            void recordIdentityDocumentLog({
                action: worker.fileNameSaved ? 'document_replaced' : 'document_registered', status: 'failure',
                workerId: worker.id, personNames: [worker.name], fileCount: 1, reason: 'processing_failed',
            });
        } finally { running.current = false; setBusy(false); }
    };
    const close = () => { if (!running.current) onClose(); };

    return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (running.current) event.preventDefault(); }}>
            <Dialog.Title className="text-lg font-bold text-slate-900">{worker.name} · 신분증 {worker.fileNameSaved ? '교체' : '등록'}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-600">이 작업자의 신분증 사진을 선택해 저장해 주세요. AI 인식 없이 사진만 등록하며, 이름·주민번호 등 기존 정보는 유지됩니다.</Dialog.Description>
            <label className="mt-4 block text-sm font-medium text-slate-700">
                신분증 사진 선택
                <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={selectFile} className="mt-2 block w-full text-sm" />
            </label>
            <p className="mt-2 text-xs text-slate-500">JPG · PNG · WEBP / 5MB 이하</p>
            {file && <p className="mt-3 break-all text-sm text-slate-700">{file.name} · 저장 대기</p>}
            {preview && <img src={preview} alt="등록할 신분증 사진 미리보기" className="mt-3 max-h-64 w-full rounded-lg border border-slate-200 object-contain"
                onError={() => { if (!running.current) { setFile(null); uploadedPath.current = ''; setError('사진을 열지 못했습니다. 다른 JPG·PNG·WEBP 사진을 선택해 주세요.'); } }} />}
            {worker.fileNameSaved && <p className="mt-3 text-sm text-amber-700">저장하면 이 작업자의 신분증 사진이 선택한 사진으로 교체됩니다.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">취소</button>
                <button type="button" disabled={busy || !file || !worker.id} onClick={() => void save()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? '저장 중…' : '신분증 저장'}</button>
            </div>
        </Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
}
