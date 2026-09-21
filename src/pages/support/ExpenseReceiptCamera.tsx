import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

type Props = { onCapture: (file: File) => void; onClose: () => void; onDeviceCamera: () => void };

export default function ExpenseReceiptCamera({ onCapture, onClose, onDeviceCamera }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(true);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    active.current = true;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (disposed) { next.getTracks().forEach(track => track.stop()); return; }
        stream = next;
        if (video.current) { video.current.srcObject = next; await video.current.play(); }
      } catch (cause) {
        if (disposed) return;
        stream?.getTracks().forEach(track => track.stop());
        setError((cause as DOMException).name === 'NotAllowedError' ? '카메라 권한을 허용해 주세요. 파일 첨부로도 등록할 수 있습니다.' : '카메라를 열지 못했습니다. 기기 카메라나 파일 첨부를 이용해 주세요.');
      }
    };
    void start();
    return () => { disposed = true; active.current = false; stream?.getTracks().forEach(track => track.stop()); };
  }, []);

  const capture = () => {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight || capturing) return;
    setCapturing(true);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2048 / Math.max(source.videoWidth, source.videoHeight));
    canvas.width = Math.round(source.videoWidth * scale);
    canvas.height = Math.round(source.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) { setError('사진을 만들지 못했습니다. 다시 촬영해 주세요.'); setCapturing(false); return; }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!active.current) return;
      setCapturing(false);
      if (!blob) { setError('사진을 만들지 못했습니다. 다시 촬영해 주세요.'); return; }
      onCapture(new File([blob], `영수증-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.88);
  };

  return <div className="expense-request-modal" role="dialog" aria-modal="true" aria-labelledby="expense-camera-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className="expense-camera-panel">
      <div className="expense-request-header"><h2 id="expense-camera-title">영수증 사진 촬영</h2><button type="button" autoFocus aria-label="카메라 닫기" onClick={onClose}><X size={18} /></button></div>
      <p>영수증의 날짜와 금액이 선명하게 보이도록 맞춰 주세요.</p>
      {error ? <p role="alert" className="expense-request-error">{error}</p> : <>
        <video ref={video} autoPlay playsInline muted aria-label="영수증 카메라 미리보기" onLoadedData={() => setReady(true)} />
        {!ready && <p role="status"><Loader2 className="animate-spin" size={18} />카메라 연결 중…</p>}
      </>}
      <div className="expense-request-actions">
        <button type="button" onClick={onDeviceCamera}>기기 카메라 열기</button>
        <button type="button" className="primary" disabled={!ready || capturing || Boolean(error)} onClick={capture}><Camera size={18} />촬영해서 첨부</button>
      </div>
    </div>
  </div>;
}
