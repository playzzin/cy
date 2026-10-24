import React, { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import ResponsiveDetailDialog from './ResponsiveDetailDialog';
import { canShareImageFile, copyImageFile, imageFileFromUrl, shareImageFile } from '../../utils/imageFileDelivery';
import './ImageFileActions.css';

export default function ImageFileActions({ imageUrl, name }: { imageUrl: string; name: string }) {
    const [prepared, setPrepared] = useState<{ source: string; file: File; url: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const request = useRef(0);
    const running = useRef(false);
    const abort = useRef<AbortController | null>(null);
    useEffect(() => {
        setPrepared(null); setOpen(false); setMessage(''); setBusy(false); running.current = false;
        return () => { request.current += 1; abort.current?.abort(); };
    }, [imageUrl, name]);
    useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);
    const prepare = async () => {
        if (running.current) return;
        if (prepared?.source === imageUrl) { setOpen(true); return; }
        const generation = ++request.current;
        running.current = true; setBusy(true); setMessage(''); abort.current = new AbortController();
        try {
            const file = await imageFileFromUrl(imageUrl, name, abort.current.signal);
            if (request.current !== generation) return;
            setPrepared({ source: imageUrl, file, url: URL.createObjectURL(file) }); setOpen(true);
        } catch {
            if (request.current === generation) setMessage('사진을 준비하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            if (request.current === generation) { running.current = false; setBusy(false); }
        }
    };
    const deliver = async (action: 'share' | 'copy') => {
        if (!prepared || prepared.source !== imageUrl || running.current) return;
        const generation = request.current;
        running.current = true; setBusy(true); setMessage('');
        try {
            if (action === 'share') await shareImageFile(prepared.file);
            else await copyImageFile(prepared.file);
            if (request.current === generation) setMessage(action === 'share' ? '공유창 처리를 마쳤습니다. 전송 여부는 선택한 앱에서 확인해 주세요.' : '사진을 복사했습니다. 채팅방에 붙여넣으세요.');
        } catch (error) {
            if (request.current === generation) setMessage((error as DOMException)?.name === 'AbortError' ? '공유를 취소했습니다.' : '사진 공유 또는 복사를 지원하지 않습니다. 사진을 저장해 첨부해 주세요.');
        } finally { if (request.current === generation) { running.current = false; setBusy(false); } }
    };
    return <div className="image-file-actions">
        <button type="button" disabled={busy} onClick={() => void prepare()}>{busy ? '사진 준비 중' : '사진 공유·저장'}</button>
        {!open && message && <p role="status">{message}</p>}
        <ResponsiveDetailDialog open={open && prepared?.source === imageUrl} onOpenChange={setOpen} title={name} description="사진을 확인한 뒤 공유하거나 저장하세요.">
            {prepared && <><img src={prepared.url} alt="공유할 사진" className="image-file-actions__preview" />
                <div className="image-file-actions__buttons">
                    {canShareImageFile(prepared.file) && <button type="button" disabled={busy} onClick={() => void deliver('share')}>공유창 열기</button>}
                    <button type="button" disabled={busy} onClick={() => void deliver('copy')}>이미지 복사</button>
                    <button type="button" disabled={busy} onClick={() => { saveAs(prepared.file, prepared.file.name); setMessage('사진 파일을 저장했습니다. 카카오톡에서 사진으로 첨부해 주세요.'); }}>사진 저장</button>
                </div>
                {!canShareImageFile(prepared.file) && <p>이 환경에서는 사진 저장 또는 이미지 복사를 이용해 주세요.</p>}
                <p role="status" aria-live="polite">{message}</p>
            </>}
        </ResponsiveDetailDialog>
    </div>;
}
