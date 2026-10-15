import React, { useEffect, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import { saveAs } from 'file-saver';
import type { PaymentData } from '../payroll/components/PayslipTemplate';
import { capturePayslipImage, payslipImageFilename } from '../../utils/payslipImage';
import './PayslipImageActions.css';

interface Props {
    targetRef: React.RefObject<HTMLDivElement>;
    data: PaymentData;
    month: string;
}

const canShareFile = (file: File) => {
    try { return !!navigator.share && !!navigator.canShare?.({ files: [file] }); }
    catch { return false; }
};

const PayslipImageActions: React.FC<Props> = ({ targetRef, data, month }) => {
    const [prepared, setPrepared] = useState<{ file: File; url: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const generation = useRef(0);
    const busyRef = useRef(false);
    const currentData = useRef(data);
    currentData.current = data;

    useEffect(() => {
        setPrepared(null);
        setMessage('');
        setError('');
        setBusy(false);
        busyRef.current = false;
        return () => { generation.current += 1; };
    }, [data, month]);

    useEffect(() => () => {
        if (prepared) URL.revokeObjectURL(prepared.url);
    }, [prepared]);

    const prepare = async (action: 'save' | 'share') => {
        if (!targetRef.current || busyRef.current) return;
        const request = ++generation.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('급여명세서 이미지를 만드는 중입니다.');
        try {
            const blob = await capturePayslipImage(targetRef.current);
            if (request !== generation.current || currentData.current !== data) return;
            const file = new File([blob], payslipImageFilename(data.workerName, month), { type: 'image/png' });
            if (action === 'save') {
                saveAs(file, file.name);
                setMessage('사진 파일을 저장했습니다. 카카오톡에서 사진 또는 파일로 첨부해 보내세요.');
            } else {
                setPrepared({ file, url: URL.createObjectURL(file) });
                setMessage('이미지를 확인한 뒤 공유하거나 복사해 보내세요.');
            }
        } catch {
            if (request === generation.current) {
                setMessage('');
                setError('이미지를 만들지 못했습니다. 다시 시도해 주세요.');
            }
        } finally {
            if (request === generation.current) {
                busyRef.current = false;
                setBusy(false);
            }
        }
    };

    const share = async () => {
        if (!prepared || busyRef.current) return;
        const request = generation.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            // The file is already prepared, so share runs within this click's activation.
            await navigator.share({ files: [prepared.file], title: `${data.workerName} ${month} 급여명세서` });
            if (request === generation.current) setMessage('공유창 처리를 마쳤습니다. 전송 여부는 선택한 앱에서 확인해 주세요.');
        } catch (failure) {
            if (request === generation.current) {
                if ((failure as DOMException)?.name === 'AbortError') setMessage('공유를 취소했습니다. 다시 공유하거나 사진을 저장할 수 있습니다.');
                else setError('공유창을 열지 못했습니다. 이미지 복사 또는 사진 저장으로 전달해 주세요.');
            }
        } finally {
            if (request === generation.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const copy = async () => {
        if (!prepared || busyRef.current) return;
        const request = generation.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': prepared.file })]);
            if (request === generation.current) setMessage('이미지를 복사했습니다. 카카오톡 채팅방에 붙여넣어 보내세요.');
        } catch {
            if (request === generation.current) setError('이미지 복사를 지원하지 않거나 권한이 없습니다. 사진 저장 후 카카오톡에 첨부해 주세요.');
        } finally {
            if (request === generation.current) { busyRef.current = false; setBusy(false); }
        }
    };

    return <div className="payslip-image-actions" data-html2canvas-ignore="true">
        <div className="payslip-image-actions__toolbar">
            <strong>급여명세서 전달</strong>
            <button type="button" disabled={busy} onClick={() => void prepare('save')}><Download size={17} />사진 저장</button>
            <button type="button" className="payslip-image-actions__share" disabled={busy} onClick={() => void prepare('share')}><Share2 size={17} />카톡·공유</button>
        </div>
        <p className="payslip-image-actions__hint">선택한 작업자와 조회월의 명세서를 사진으로 전달합니다.</p>
        <p role="status" aria-live="polite">{message}</p>
        {error && <p role="alert" className="payslip-image-actions__error">{error}</p>}
        {prepared && <section className="payslip-image-actions__preview" aria-label="전달할 급여명세서 이미지">
            <div className="payslip-image-actions__preview-heading">
                <strong>{data.workerName} · {month} 급여명세서</strong>
                <button type="button" aria-label="공유 미리보기 닫기" disabled={busy} onClick={() => setPrepared(null)}><X size={18} /></button>
            </div>
            <img src={prepared.url} alt={`${data.workerName} ${month} 급여명세서 미리보기`} />
            <p>{canShareFile(prepared.file)
                ? '공유창에서 카카오톡 등 보낼 앱을 선택하세요.'
                : '이 브라우저에서는 직접 공유를 지원하지 않습니다. 이미지를 복사해 붙여넣거나 사진을 저장해 첨부하세요.'}</p>
            <div className="payslip-image-actions__buttons">
                {canShareFile(prepared.file) && <button type="button" className="payslip-image-actions__share" disabled={busy} onClick={() => void share()}><Share2 size={17} />공유창 열기</button>}
                <button type="button" disabled={busy} onClick={() => void copy()}><Copy size={17} />이미지 복사</button>
                <button type="button" disabled={busy} onClick={() => { saveAs(prepared.file, prepared.file.name); setMessage('사진 파일을 저장했습니다.'); }}><Download size={17} />사진 파일 저장</button>
            </div>
        </section>}
    </div>;
};

export default PayslipImageActions;
