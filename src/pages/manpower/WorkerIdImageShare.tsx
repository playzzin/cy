import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ref, getDownloadURL } from 'firebase/storage';
import { saveAs } from 'file-saver';
import { storage } from '../../config/firebase';
import type { Worker } from '../../services/manpowerService';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';
import { canShareImageFiles, copyImageFile, imageFileFromUrl, shareImageFiles } from '../../utils/imageFileDelivery';
import { canSaveImageFolder, saveImageFolder, zipImageFiles } from '../../utils/imageBatchDownload';
import { copyWindowsPhotos, openWindowsPhotoWindow, WindowsPhotoClipboardError, windowsPhotoClipboardErrorMessage } from '../../utils/windowsPhotoClipboard';
import { readWorkerBankPhoto } from '../../services/workerBankPhotoService';
import type { WorkerAccountPurpose } from '../../utils/workerAccount';
import type { IdentityLogInput } from '../../services/identityBundleLogService';
import './WorkerIdImageShare.css';

type IdWorker = Pick<Worker, 'id' | 'name' | 'fileNameSaved' | 'bankPhotoId' | 'directPayBankPhotoId'>;
type PreparedImage = { worker: IdWorker; file: File; url: string };
type Prepared = { workers: IdWorker[]; images: PreparedImage[]; failed: string[]; missing: string[] };

const WorkerIdImageShare: React.FC<{
    workers: IdWorker[];
    disabled?: boolean;
    kind?: 'identity' | 'bank';
    bankPurpose?: WorkerAccountPurpose;
    titlePrefix?: string;
    logSource?: IdentityLogInput['source'];
    loadImage?: (worker: IdWorker, name: string, signal: AbortSignal) => Promise<File | null>;
}> = ({ workers, disabled, kind = 'identity', bankPurpose = 'directPay', titlePrefix = '', logSource = 'worker_summary', loadImage }) => {
    const documentLabel = kind === 'bank' ? (bankPurpose === 'directPay' ? '직불용 통장사본' : '통장사본') : '신분증';
    const shareTitle = `${titlePrefix}${documentLabel} 공유`;
    // Keep the existing identity audit accurate; bank registrations are audited by the server.
    const recordPhotoLog: typeof recordIdentityDocumentLog = input => kind === 'identity' ? recordIdentityDocumentLog({ ...input, source: logSource }) : Promise.resolve();
    const isWindows = /Windows/i.test(navigator.userAgent) || /^Win/i.test(navigator.platform);
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
    }, [workers, kind, bankPurpose, titlePrefix, logSource, loadImage]);

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
        setMessage(`선택한 작업자의 ${documentLabel}을 준비하고 있습니다.`);
        const images: PreparedImage[] = [];
        const failed: string[] = [];
        const missing = kind === 'identity' && !loadImage ? workers.filter(worker => !worker.fileNameSaved).map(worker => worker.name) : [];
        try {
            // Read only the already-authorized selection. Keep original image bytes and format.
            for (const [index, worker] of workers.entries()) {
                if (kind === 'identity' && !loadImage && !worker.fileNameSaved) continue;
                try {
                    const name = `${String(index + 1).padStart(2, '0')}_${worker.name}_${documentLabel}`;
                    const file = loadImage ? await loadImage(worker, name, controller.signal) : kind === 'bank'
                        ? await readWorkerBankPhoto(worker.id!, name, controller.signal, bankPurpose)
                        : await imageFileFromUrl(await getDownloadURL(ref(storage, worker.fileNameSaved)), name, controller.signal);
                    if (!file) { missing.push(worker.name); continue; }
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
            setMessage(images.length ? `사진 ${images.length}장을 준비했습니다. 아래 사진을 확인한 뒤 공유하세요.` : kind === 'bank'
                ? bankPurpose === 'directPay'
                    ? '공유할 직불용 통장사본이 없습니다. 직불용 통장사본 등록에서 원본을 등록해 주세요.'
                    : '공유할 통장사본이 없습니다. 통합DB에서 해당 작업자의 기본 계좌 통장사본 원본을 등록해 주세요.'
                : '공유할 신분증 사진이 없습니다.');
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
            void recordPhotoLog({ action: 'share_image', source: 'worker_summary', status: 'success',
                personNames: images.map(image => image.worker.name), personCount: images.length, fileCount: images.length });
            if (request === requestRef.current) setMessage(isWindows
                ? 'Windows 공유창을 열었습니다. 붙여넣기가 안 되면 Windows 공유창을 닫고 사진 아래의 사진 복사 또는 폴더 저장을 이용하세요.'
                : '공유창을 열었습니다. 사진 전송 완료 여부는 받을 앱에서 확인해 주세요.');
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
        setMessage('');
        try {
            await copyImageFile(image.file);
            void recordPhotoLog({ action: 'copy_image', source: 'worker_summary', status: 'success', personNames: [image.worker.name], fileCount: 1 });
            if (request === requestRef.current) setMessage(`${image.worker.name} 사진 1장을 복사했습니다. 카카오톡 대화 입력칸에서 Ctrl+V(모바일은 붙여넣기)로 첨부하세요. 다른 사진을 복사하면 이전 사진은 교체됩니다.`);
        } catch {
            if (request === requestRef.current) setError('사진을 복사하지 못했습니다. 사진 저장 후 카카오톡에 첨부해 주세요.');
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const save = (image: PreparedImage) => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current) return;
        saveAs(image.file, image.file.name);
        void recordPhotoLog({ action: 'download_image', source: 'worker_summary', status: 'success', personNames: [image.worker.name], fileCount: 1 });
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
                const result = await saveImageFolder(selected.map(image => image.file), controller.signal, documentLabel);
                const savedImages = selected.filter(image => result.saved.includes(image.file));
                if (savedImages.length) void recordPhotoLog({ action: 'download_image', source: 'worker_summary',
                    status: result.saved.length === selected.length ? 'success' : 'partial',
                    personNames: savedImages.map(image => image.worker.name), personCount: savedImages.length, fileCount: savedImages.length });
                if (request !== requestRef.current) return;
                setMessage(result.saved.length ? `사진 ${result.saved.length}장을 선택한 위치의 “${result.folderName}” 폴더에 저장했습니다. 폴더 안의 사진을 모두 선택해 카카오톡 대화방에 첨부하세요.` : '저장된 사진이 없습니다. ZIP 저장을 이용해 주세요.');
                if (result.failed.length) setError(`사진 ${result.failed.length}장 저장 실패: ${selected.filter(image => result.failed.includes(image.file)).map(image => image.worker.name).join(', ')}. 해당 사진을 개별 저장하거나 ZIP 저장을 이용해 주세요.`);
            } else {
                const zip = await zipImageFiles(selected.map(image => image.file), documentLabel);
                if (request !== requestRef.current || controller.signal.aborted || prepared.workers !== currentWorkers.current) return;
                saveAs(zip, zip.name);
                void recordPhotoLog({ action: 'download_zip', source: 'worker_summary', status: 'success',
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

    const copyBatch = async () => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current || !prepared.images.length) return;
        const request = requestRef.current;
        const controller = new AbortController();
        controllerRef.current = controller;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('PC 보조 프로그램에 연결하고 있습니다. 브라우저가 로컬 네트워크 접근을 물으면 허용해 주세요.');
        const selected = prepared.images;
        try {
            const result = await copyWindowsPhotos(selected.map(image => image.file), controller.signal, progress => {
                if (request === requestRef.current && !controller.signal.aborted) setMessage(`사진 전달 ${progress.completed}/${progress.total}장 · ${Math.floor(progress.sentBytes / progress.totalBytes * 100)}%${progress.retrying ? ' — 끊긴 부분을 다시 전달하고 있습니다.' : ''}`);
            });
            const log = { source: 'worker_summary' as const, status: 'success' as const,
                personNames: selected.map(image => image.worker.name), personCount: selected.length, fileCount: result.photoCount };
            if (result.copied) void recordPhotoLog({ ...log, action: 'copy_image' });
            if (request !== requestRef.current) return;
            setMessage(result.copied
                ? `사진 ${result.photoCount}장을 Windows 클립보드에 모두 복사했습니다. 카카오톡에서 붙여넣기가 안 되면 위의 한 번에 끌어놓기를 이용하세요.`
                : '사진은 준비됐지만 클립보드에 복사하지 못했습니다. Windows 알림 영역의 CY 사진 전체 복사에서 ‘마지막 사진 전체 다시 복사’를 누르세요.');
        } catch (failure) {
            if (request === requestRef.current) {
                setMessage('');
                if ((failure as DOMException)?.name !== 'AbortError') setError(windowsPhotoClipboardErrorMessage(failure));
            }
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const openPhotoWindow = async () => {
        if (!prepared || prepared.workers !== currentWorkers.current || busyRef.current || !prepared.images.length) return;
        const request = requestRef.current;
        const controller = new AbortController();
        controllerRef.current = controller;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('Windows 사진창을 준비하고 있습니다. 브라우저가 로컬 네트워크 접근을 물으면 허용해 주세요.');
        try {
            const result = await openWindowsPhotoWindow(prepared.images.map(image => image.file), controller.signal, progress => {
                if (request === requestRef.current && !controller.signal.aborted) setMessage(progress.completed === progress.total
                    ? `사진 ${progress.total}장 전달 완료. Windows 사진창을 열고 있습니다.`
                    : `사진 전달 ${progress.completed}/${progress.total}장 · ${Math.floor(progress.sentBytes / progress.totalBytes * 100)}%${progress.retrying ? ' — 끊긴 부분을 다시 전달하고 있습니다.' : ''}`);
            });
            if (request !== requestRef.current || controller.signal.aborted || prepared.workers !== currentWorkers.current) return;
            // Opening a local window does not prove a clipboard copy or KakaoTalk attachment/share.
            if (!result.opened) throw new WindowsPhotoClipboardError('photo-window', 'open');
            setMessage(`사진 ${result.photoCount}장이 모두 선택된 Windows 사진창을 열었습니다. 선택된 사진 하나를 누른 채 카카오톡 대화창으로 끌어놓으세요. 첨부된 사진과 받을 대화방을 확인한 뒤 카카오톡에서 전송하세요.`);
        } catch (failure) {
            if (request === requestRef.current) {
                setMessage('');
                if ((failure as DOMException)?.name !== 'AbortError') setError(windowsPhotoClipboardErrorMessage(failure));
            }
        } finally {
            if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const images = prepared?.images ?? [];
    const canShareAll = canShareImageFiles(images.map(image => image.file));
    return <>
        <button ref={triggerRef} type="button" className="ws-id-share-trigger" disabled={disabled || !workers.length || busy}
            onClick={() => void prepare()}>{shareTitle}</button>
        {open && createPortal(<dialog ref={dialogRef} className="worker-id-share" aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); close(); }}>
            <header><div><h2 id={titleId}>{shareTitle}</h2><p>선택한 {workers.length}명의 {documentLabel}을 각각의 사진으로 보냅니다.</p></div>
                <button type="button" aria-label={`${documentLabel} 공유 닫기`} onClick={close}>닫기</button></header>
            <p role="status" aria-live="polite">{message}</p>
            {error && <p role="alert" className="worker-id-share__error">{error}</p>}
            {!!prepared?.missing.length && <p className="worker-id-share__notice">{documentLabel} 미등록 {prepared.missing.length}명: {prepared.missing.join(', ')}</p>}
            {!!prepared?.failed.length && <div role="alert" className="worker-id-share__error">
                <p>불러오기 실패 {prepared.failed.length}명: {prepared.failed.join(', ')}. 이 사진은 공유에 포함되지 않습니다.</p>
                <button type="button" disabled={busy} onClick={() => void prepare()}>사진 다시 준비</button></div>}
            {!!images.length && <div className="worker-id-share__send">
                {canShareAll && !isWindows ? <><button type="button" className="worker-id-share__primary" disabled={busy} onClick={() => void share(images)}>사진 {images.length}장 함께 공유</button>
                    <p>공유창에서 카카오톡과 받을 대화방을 선택하세요. 카카오톡이 보이지 않으면 아래 PC 저장 메뉴를 이용하세요.</p></>
                    : !canShareAll && !isWindows && <p>이 브라우저에서는 사진 {images.length}장을 바로 함께 공유할 수 없습니다. 아래에서 사진을 한꺼번에 저장해 카카오톡에 첨부하세요.</p>}
                <details className="worker-id-share__desktop" open={isWindows || !canShareAll}>
                    <summary>PC 카카오톡으로 보내기</summary>
                    {isWindows && <div className="worker-id-share__helper">
                        <button type="button" className="worker-id-share__primary" disabled={busy} onClick={() => void openPhotoWindow()}>사진 {images.length}장 한 번에 끌어놓기</button>
                        <p>버튼을 누르면 사진이 모두 선택된 Windows 사진창이 열립니다. <strong>선택된 사진 하나를 누른 채 카카오톡 대화창으로 끌어놓으세요.</strong> 각각의 원본 사진이 함께 첨부됩니다.</p>
                        <p>저장할 위치를 고를 필요가 없습니다. 카카오톡에서 첨부된 사진과 받을 대화방을 확인한 뒤 전송하세요.</p>
                        <details><summary>처음 사용하시나요? PC 보조 프로그램 설치</summary>
                            <ol><li><a href="/downloads/CYPhotoClipboardSetup.exe?v=1.4.0" download>Windows 보조 프로그램 1.4 다운로드 (.exe)</a> 후 실행하고 ‘설치하고 실행’을 누르세요. 여러 장 전달 중 끊김을 자동으로 재시도하려면 1.4로 업데이트해 주세요.</li>
                                <li>이 화면으로 돌아와 위의 끌어놓기 버튼을 누르세요. 로컬 네트워크 접근을 물으면 허용해 주세요.</li></ol>
                            <p>보조 프로그램이 공유용 임시 사진을 관리합니다. 작업을 마치면 Windows 사진창을 닫아 주세요.</p>
                        </details>
                        <details><summary>전체 복사로 붙여넣기 (보조 기능)</summary>
                            <button type="button" disabled={busy} onClick={() => void copyBatch()}>사진 {images.length}장 전체 복사</button>
                            <p>Windows 클립보드에 파일을 복사합니다. 카카오톡에서 붙여넣기가 안 되면 위의 끌어놓기 기능을 이용하세요. 다음 복사 작업은 기존 클립보드 내용을 바꿉니다.</p>
                        </details>
                    </div>}
                    <details open={!isWindows}>
                    <summary>폴더·ZIP으로 저장해서 보내기</summary>
                    <p>원본 파일을 저장한 뒤 카카오톡에 한꺼번에 첨부할 수도 있습니다.</p>
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
                    <p><strong>한 장씩 붙여넣기:</strong> 아래 사진의 <strong>사진 복사</strong>를 누른 뒤 카카오톡 대화 입력칸에서 Ctrl+V를 누르세요. 여러 장을 연속으로 복사하면 마지막 사진만 남습니다.</p>
                    {isWindows && canShareAll && <div className="worker-id-share__system">
                        <p>Windows 공유창의 카카오톡·복사 항목으로는 사진 붙여넣기가 안 될 수 있습니다. 아래 사진 복사나 폴더 저장을 이용해 주세요.</p>
                        <button type="button" disabled={busy} onClick={() => void share(images)}>Windows 공유창 열기 ({images.length}장)</button>
                    </div>}
                    </details>
                </details>
            </div>}
            <div className="worker-id-share__images">{images.map(image => <article key={image.worker.id}>
                <img src={image.url} alt={`${image.worker.name} ${documentLabel} 공유 미리보기`} />
                <strong>{image.worker.name}</strong>
                <div>{!isWindows && canShareImageFiles([image.file]) && <button type="button" disabled={busy} aria-label={`${image.worker.name} 사진 공유`} onClick={() => void share([image])}>개별 공유</button>}
                    <button type="button" disabled={busy} aria-label={`${image.worker.name} 사진 복사`} onClick={() => void copy(image)}>사진 복사</button>
                    <button type="button" disabled={busy} aria-label={`${image.worker.name} 사진 저장`} onClick={() => save(image)}>사진 저장</button></div>
            </article>)}</div>
        </dialog>, document.body)}
    </>;
};

export default WorkerIdImageShare;
