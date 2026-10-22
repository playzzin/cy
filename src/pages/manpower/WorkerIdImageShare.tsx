import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ref, getDownloadURL } from 'firebase/storage';
import { saveAs } from 'file-saver';
import { storage } from '../../config/firebase';
import type { Worker } from '../../services/manpowerService';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';
import { canShareImageFiles, copyImageFile, imageFileFromUrl, shareImageFiles } from '../../utils/imageFileDelivery';
import { canSaveImageFolder, saveImageFolder, zipImageFiles } from '../../utils/imageBatchDownload';
import './WorkerIdImageShare.css';

type IdWorker = Pick<Worker, 'id' | 'name' | 'fileNameSaved'>;
type PreparedImage = { worker: IdWorker; file: File; url: string };
type Prepared = { workers: IdWorker[]; images: PreparedImage[]; failed: string[]; missing: string[] };

const WorkerIdImageShare: React.FC<{ workers: IdWorker[]; disabled?: boolean }> = ({ workers, disabled }) => {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [prepared, setPrepared] = useState<Prepared | null>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const requestRef = useRef(0);
    const busyRef = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);
    const currentWorkers = useRef(workers);
    currentWorkers.current = workers;
    const titleId = useId();

    useEffect(() => {
        setOpen(false);
        setPrepared(null);
        setBusy(false);
        busyRef.current = false;
        return () => { requestRef.current += 1; controllerRef.current?.abort(); };
    }, [workers]);

    useEffect(() => () => {
        prepared?.images.forEach(image => URL.revokeObjectURL(image.url));
    }, [prepared]);

    useEffect(() => {
        if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    }, [open]);

    const close = () => {
        requestRef.current += 1;
        controllerRef.current?.abort();
        busyRef.current = false;
        setBusy(false);
        setPrepared(null);
        dialogRef.current?.close();
        setOpen(false);
        triggerRef.current?.focus();
    };

    const prepare = async () => {
        if (!workers.length || busyRef.current) return;
        const request = ++requestRef.current;
        const controller = new AbortController();
        controllerRef.current = controller;
        busyRef.current = true;
        setBusy(true);
        setOpen(true);
        setPrepared(null);
        setError('');
        setMessage('선택한 작업자의 신분증 사진을 준비하고 있습니다.');
        const images: PreparedImage[] = [];
        const failed: string[] = [];
        const missing = workers.filter(worker => !worker.fileNameSaved).map(worker => worker.name);
        try {
            // Read only the already-authorized selection. Keep original image bytes and format.
            for (const [index, worker] of workers.entries()) {
                if (!worker.fileNameSaved) continue;
                try {
                    const url = await getDownloadURL(ref(storage, worker.fileNameSaved));
                    if (controller.signal.aborted) break;
                    const file = await imageFileFromUrl(url, `${String(index + 1).padStart(2, '0')}_${worker.name}_신분증`, controller.signal);
                    if (controller.signal.aborted) break;
                    images.push({ worker, file, url: URL.createObjectURL(file) });
                } catch {
                    if (controller.signal.aborted) break;
                    failed.push(worker.name);
                }
            }
            if (request !== requestRef.current || currentWorkers.current !== workers) {
                images.forEach(image => URL.revokeObjectURL(image.url));
                return;
            }
            setPrepared({ workers, images, failed, missing });
            setMessage(images.length ? `사진 ${images.length}장을 준비했습니다. 아래 사진을 확인한 뒤 공유하세요.` : '공유할 신분증 사진이 없습니다.');
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const share = async (images: PreparedImage[]) => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current || !images.length) return;
        const request = requestRef.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            // No network or image processing before share: preserve this button click's activation.
            await shareImageFiles(images.map(image => image.file));
            void recordIdentityDocumentLog({ action: 'share_image', source: 'worker_summary', status: 'success',
                personNames: images.map(image => image.worker.name), personCount: images.length, fileCount: images.length });
            if (request === requestRef.current) setMessage('공유창 처리를 마쳤습니다. 전송 여부는 카카오톡에서 확인해 주세요.');
        } catch (failure) {
            if (request === requestRef.current) {
                if ((failure as DOMException)?.name === 'AbortError') setMessage('공유를 취소했습니다. 사진은 다시 공유할 수 있습니다.');
                else setError('공유창을 열지 못했습니다. 아래 PC 저장 메뉴에서 사진을 한꺼번에 저장해 카카오톡에 첨부해 주세요.');
            }
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const copy = async (image: PreparedImage) => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current) return;
        const request = requestRef.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        try {
            await copyImageFile(image.file);
            void recordIdentityDocumentLog({ action: 'copy_image', source: 'worker_summary', status: 'success', personNames: [image.worker.name], fileCount: 1 });
            if (request === requestRef.current) setMessage('사진을 복사했습니다. 카카오톡 채팅방에 붙여넣어 보내세요.');
        } catch {
            if (request === requestRef.current) setError('사진을 복사하지 못했습니다. 사진 저장 후 카카오톡에 첨부해 주세요.');
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const save = (image: PreparedImage) => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current) return;
        saveAs(image.file, image.file.name);
        void recordIdentityDocumentLog({ action: 'download_image', source: 'worker_summary', status: 'success', personNames: [image.worker.name], fileCount: 1 });
        setMessage('사진 저장을 요청했습니다. 카카오톡에서 저장한 사진을 첨부해 주세요.');
    };

    const saveBatch = async (format: 'folder' | 'zip') => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current || !prepared.images.length) return;
        const request = requestRef.current;
        const controller = new AbortController();
        controllerRef.current = controller;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage(format === 'folder' ? '사진을 저장할 위치를 선택해 주세요.' : '사진을 ZIP 파일로 준비하고 있습니다.');
        const selected = prepared.images;
        try {
            if (format === 'folder') {
                const result = await saveImageFolder(selected.map(image => image.file), controller.signal);
                const savedImages = selected.filter(image => result.saved.includes(image.file));
                if (savedImages.length) void recordIdentityDocumentLog({ action: 'download_image', source: 'worker_summary',
                    status: result.saved.length === selected.length ? 'success' : 'partial',
                    personNames: savedImages.map(image => image.worker.name), personCount: savedImages.length, fileCount: savedImages.length });
                if (request !== requestRef.current) return;
                setMessage(result.saved.length ? `사진 ${result.saved.length}장을 선택한 위치의 “${result.folderName}” 폴더에 저장했습니다. 폴더 안의 사진을 모두 선택해 카카오톡 대화방에 첨부하세요.` : '저장된 사진이 없습니다. ZIP 저장을 이용해 주세요.');
                if (result.failed.length) setError(`사진 ${result.failed.length}장 저장 실패: ${selected.filter(image => result.failed.includes(image.file)).map(image => image.worker.name).join(', ')}. 해당 사진을 개별 저장하거나 ZIP 저장을 이용해 주세요.`);
            } else {
                const zip = await zipImageFiles(selected.map(image => image.file));
                if (request !== requestRef.current || controller.signal.aborted || prepared.workers !== currentWorkers.current) return;
                saveAs(zip, zip.name);
                void recordIdentityDocumentLog({ action: 'download_zip', source: 'worker_summary', status: 'success',
                    personNames: selected.map(image => image.worker.name), personCount: selected.length, fileCount: selected.length });
                setMessage(`사진 ${selected.length}장이 들어 있는 ZIP 다운로드를 요청했습니다. 압축을 풀고 사진 파일을 모두 선택해 카카오톡 대화방에 첨부하세요.`);
            }
        } catch (failure) {
            if (request === requestRef.current) {
                setMessage('');
                if ((failure as DOMException)?.name === 'AbortError') setMessage('저장을 취소했습니다. 사진은 다시 저장할 수 있습니다.');
                else setError(format === 'folder' ? '폴더에 저장하지 못했습니다. ZIP 저장을 이용하거나 저장 권한을 확인해 주세요.' : 'ZIP 파일을 만들지 못했습니다. 다시 시도하거나 개별 사진을 저장해 주세요.');
            }
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const images = prepared?.images ?? [];
    const canShareAll = canShareImageFiles(images.map(image => image.file));
    return <>
        <button ref={triggerRef} type="button" className="ws-id-share-trigger" disabled={disabled || !workers.length || busy}
            onClick={() => void prepare()}>신분증 사진 공유</button>
        {open && createPortal(<dialog ref={dialogRef} className="worker-id-share" aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); close(); }}>
            <header><div><h2 id={titleId}>신분증 사진 공유</h2><p>선택한 {workers.length}명의 신분증을 각각의 사진으로 보냅니다.</p></div>
                <button type="button" aria-label="신분증 공유 닫기" onClick={close}>닫기</button></header>
            <p role="status" aria-live="polite">{message}</p>
            {error && <p role="alert" className="worker-id-share__error">{error}</p>}
            {!!prepared?.missing.length && <p className="worker-id-share__notice">신분증 미등록 {prepared.missing.length}명: {prepared.missing.join(', ')}</p>}
            {!!prepared?.failed.length && <div role="alert" className="worker-id-share__error">
                <p>불러오기 실패 {prepared.failed.length}명: {prepared.failed.join(', ')}. 이 사진은 공유에 포함되지 않습니다.</p>
                <button type="button" disabled={busy} onClick={() => void prepare()}>사진 다시 준비</button></div>}
            {!!images.length && <div className="worker-id-share__send">
                {canShareAll ? <><button type="button" className="worker-id-share__primary" disabled={busy} onClick={() => void share(images)}>사진 {images.length}장 함께 공유</button>
                    <p>공유창에서 카카오톡과 받을 대화방을 선택하세요. 카카오톡이 보이지 않으면 아래 PC 저장 메뉴를 이용하세요.</p></>
                    : <p>이 브라우저에서는 사진 {images.length}장을 바로 함께 공유할 수 없습니다. 아래에서 사진을 한꺼번에 저장해 카카오톡에 첨부하세요.</p>}
                <details className="worker-id-share__desktop" open={!canShareAll}>
                    <summary>PC 카카오톡으로 보내기</summary>
                    <p>PC에서는 카카오톡이 공유창에 나타나지 않을 수 있습니다. 사진을 각각의 원본 파일로 저장한 뒤 한꺼번에 첨부할 수 있습니다.</p>
                    <div className="worker-id-share__batch-actions">
                        {canSaveImageFolder() && <button type="button" disabled={busy} onClick={() => void saveBatch('folder')}>사진 {images.length}장 폴더에 저장</button>}
                        <button type="button" disabled={busy} onClick={() => void saveBatch('zip')}>사진 {images.length}장 ZIP 저장</button>
                    </div>
                    <ol>
                        <li>{canSaveImageFolder() ? '저장할 위치를 선택하면 사진 전용 폴더가 만들어집니다. ZIP으로 저장했다면 먼저 압축을 풀어 주세요.' : 'ZIP을 다운로드한 뒤 압축을 풀어 주세요.'}</li>
                        <li>저장된 폴더를 열고 사진 파일을 모두 선택하세요.</li>
                        <li>카카오톡 대화방으로 끌어 놓거나 파일 첨부에서 선택해 보내세요.</li>
                    </ol>
                    <p>ZIP 파일 자체를 보내면 사진 대신 압축파일로 전달됩니다.</p>
                </details>
            </div>}
            <div className="worker-id-share__images">{images.map(image => <article key={image.worker.id}>
                <img src={image.url} alt={`${image.worker.name} 신분증 공유 미리보기`} />
                <strong>{image.worker.name}</strong>
                <div>{canShareImageFiles([image.file]) && <button type="button" disabled={busy} aria-label={`${image.worker.name} 사진 공유`} onClick={() => void share([image])}>개별 공유</button>}
                    <button type="button" disabled={busy} aria-label={`${image.worker.name} 사진 복사`} onClick={() => void copy(image)}>복사</button>
                    <button type="button" disabled={busy} aria-label={`${image.worker.name} 사진 저장`} onClick={() => save(image)}>사진 저장</button></div>
            </article>)}</div>
        </dialog>, document.body)}
    </>;
};

export default WorkerIdImageShare;
