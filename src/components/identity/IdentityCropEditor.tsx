import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crop,
  Focus,
  Image as ImageIcon,
  ScanLine,
  X,
} from 'lucide-react';
import type {
  IdentityCorrectionMode,
  IdentityPerspectiveQuad,
  IdentityUploadItem,
} from '../../types/identityBundle';
import {
  cropBoxToIdentityQuad,
  drawWarpedIdentityDocument,
  getIdentityCropForOutput,
  getIdentityPerspectiveDimensions,
  isValidIdentityPerspectiveQuad,
} from '../../utils/identityBundleComposer';

interface IdentityCropEditorProps {
  item: IdentityUploadItem;
  onClose: () => void;
  onSave: (quad: IdentityPerspectiveQuad | undefined, mode: IdentityCorrectionMode) => void;
}

const FULL_IMAGE_QUAD: IdentityPerspectiveQuad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const cloneQuad = (quad: IdentityPerspectiveQuad): IdentityPerspectiveQuad => (
  quad.map((point) => ({ ...point })) as IdentityPerspectiveQuad
);

const IdentityCropEditor: React.FC<IdentityCropEditorProps> = ({ item, onClose, onSave }) => {
  const analysis = item.analysis!;

  const autoQuad = useMemo(() => cropBoxToIdentityQuad(getIdentityCropForOutput(
    analysis.crop,
    analysis.confidence,
    analysis.warnings,
  )), [analysis]);
  const initialMode = analysis.correctionMode || 'AUTO';
  const [mode, setMode] = useState<IdentityCorrectionMode>(initialMode);
  const [quad, setQuad] = useState<IdentityPerspectiveQuad>(() => {
    if (initialMode === 'ORIGINAL') return cloneQuad(FULL_IMAGE_QUAD);
    if (initialMode === 'MANUAL' && analysis.perspectiveQuad) return cloneQuad(analysis.perspectiveQuad);
    return cloneQuad(autoQuad);
  });
  const [imageSize, setImageSize] = useState({ width: 4, height: 3 });
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.complete || !image.naturalWidth) return;
    const perspective = getIdentityPerspectiveDimensions(quad, image.naturalWidth, image.naturalHeight);
    const previewWidth = 520;
    const previewHeight = Math.max(120, Math.min(520, Math.round(previewWidth / perspective.aspectRatio)));
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    drawWarpedIdentityDocument(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
      quad,
      { x: 0, y: 0, width: canvas.width, height: canvas.height },
    );
  }, [quad, imageSize]);

  const updateCorner = (event: React.PointerEvent<HTMLButtonElement>, cornerIndex: number) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const surface = event.currentTarget.parentElement;
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
    const candidate = cloneQuad(quad);
    candidate[cornerIndex] = point;
    if (!isValidIdentityPerspectiveQuad(candidate)) {
      setValidationMessage('네 모서리가 서로 교차하지 않도록 조정해 주세요.');
      return;
    }
    setValidationMessage('');
    setMode('MANUAL');
    setQuad(candidate);
  };

  const selectAuto = () => {
    setMode('AUTO');
    setQuad(cloneQuad(autoQuad));
    setValidationMessage('');
  };

  const selectOriginal = () => {
    setMode('ORIGINAL');
    setQuad(cloneQuad(FULL_IMAGE_QUAD));
    setValidationMessage('');
  };

  const handleSave = () => {
    if (!isValidIdentityPerspectiveQuad(quad)) {
      setValidationMessage('문서의 네 모서리를 올바른 순서로 지정해 주세요.');
      return;
    }
    onSave(mode === 'MANUAL' ? cloneQuad(quad) : undefined, mode);
  };

  const polygonPoints = quad.map((point) => `${point.x * 1000},${point.y * 1000}`).join(' ');
  const modeLabel = mode === 'AUTO' ? 'AI 자동 영역' : mode === 'ORIGINAL' ? '원본 전체' : '수동 원근 보정';

  return (
    <div className="identity-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="identity-crop-editor" role="dialog" aria-modal="true" aria-labelledby="identity-crop-title">
        <header className="identity-crop-editor__header">
          <div>
            <span className="identity-section-kicker">CROP &amp; PERSPECTIVE</span>
            <h2 id="identity-crop-title">문서 자르기·원근 보정</h2>
            <p>{analysis.documentLabel} · {item.file.name}</p>
          </div>
          <button type="button" className="identity-icon-button" onClick={onClose} aria-label="편집기 닫기"><X size={20} /></button>
        </header>

        <div className="identity-crop-editor__toolbar">
          <button type="button" className={mode === 'AUTO' ? 'is-active' : ''} onClick={selectAuto}>
            <Focus size={16} /><span>AI 자동 영역</span>
          </button>
          <button type="button" className={mode === 'ORIGINAL' ? 'is-active' : ''} onClick={selectOriginal}>
            <ImageIcon size={16} /><span>원본 전체</span>
          </button>
          <span className="identity-crop-editor__mode"><ScanLine size={14} /> {modeLabel}</span>
        </div>

        <div className="identity-crop-editor__body">
          <div className="identity-crop-editor__stage">
            <div
              className={`identity-crop-editor__surface ${draggingIndex !== null ? 'is-dragging' : ''}`}
              style={{
                aspectRatio: `${imageSize.width} / ${imageSize.height}`,
                maxWidth: `calc(58vh * ${imageSize.width / imageSize.height})`,
              }}
            >
              <img
                ref={imageRef}
                src={item.previewUrl}
                alt="자르기 대상 원본"
                draggable={false}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
                }}
              />
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <mask id="identity-crop-mask">
                    <rect width="1000" height="1000" fill="white" />
                    <polygon points={polygonPoints} fill="black" />
                  </mask>
                </defs>
                <rect width="1000" height="1000" fill="rgba(7, 11, 24, .66)" mask="url(#identity-crop-mask)" />
                <polygon className="identity-crop-editor__polygon" points={polygonPoints} />
              </svg>
              {quad.map((point, index) => (
                <button
                  type="button"
                  key={index}
                  className="identity-crop-editor__handle"
                  style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                  aria-label={`${index + 1}번 모서리 이동`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraggingIndex(index);
                  }}
                  onPointerMove={(event) => updateCorner(event, index)}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    setDraggingIndex(null);
                  }}
                  onPointerCancel={() => setDraggingIndex(null)}
                ><span>{index + 1}</span></button>
              ))}
            </div>
            <p className="identity-crop-editor__hint"><Crop size={15} /> 번호가 표시된 네 점을 문서의 실제 모서리에 맞추면 기울어진 문서를 정면으로 펴서 출력합니다.</p>
          </div>

          <aside className="identity-crop-editor__preview">
            <span>보정 결과 미리보기</span>
            <div><canvas ref={previewCanvasRef} /></div>
            <ul>
              <li><Check size={13} /> 네 모서리 안쪽만 사용</li>
              <li><Check size={13} /> 문서 비율 자동 계산</li>
              <li><Check size={13} /> 원근을 정면 형태로 보정</li>
            </ul>
          </aside>
        </div>

        <footer className="identity-crop-editor__footer">
          <span className={validationMessage ? 'is-error' : ''}>{validationMessage || '보정 내용은 브라우저에서만 처리되며 원본 파일은 변경하지 않습니다.'}</span>
          <div>
            <button type="button" className="identity-secondary-button" onClick={onClose}>취소</button>
            <button type="button" className="identity-confirm-button" onClick={handleSave}><Check size={16} /> 보정 적용</button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default IdentityCropEditor;
