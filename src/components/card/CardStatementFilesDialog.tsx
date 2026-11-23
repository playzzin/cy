import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import OriginalDocumentPreview from '../common/OriginalDocumentPreview';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import {
  cardStatementAttachmentService, getCardStatementAttachmentError, getCardStatementFileName,
  type CardStatementAttachmentLink,
} from '../../services/cardStatementAttachmentService';

interface Props {
  paths: string[];
  title?: string;
  fileNames?: Record<string, string>;
  showDetailsLink?: boolean;
  onClose: () => void;
  onRemoved?: (path: string) => void;
  removalDisabled?: boolean;
}

const getRealAccountUrl = (): string => {
  const url = new URL(window.location.href);
  url.searchParams.set('devAdmin', '0');
  return `${url.pathname}${url.search}${url.hash}`;
};

const isImageName = (name: string) => /\.(?:png|jpe?g|webp|gif|bmp|avif)$/i.test(name);

const CardStatementFilesDialog: React.FC<Props> = ({ paths, title = '청구서 파일', fileNames, showDetailsLink = true, onClose, onRemoved, removalDisabled }) => {
  const [removed, setRemoved] = useState<string[]>([]);
  const files = useMemo(() => Array.from(new Set(paths.map(path => path.trim()).filter(path => path && !removed.includes(path)))), [paths, removed]);
  const [confirmPath, setConfirmPath] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const removingRef = useRef(false);
  const remove = async () => {
    if (!confirmPath || removingRef.current || removalDisabled) return;
    removingRef.current = true; setRemoving(true); setRemoveError('');
    const path = confirmPath;
    try {
      await cardStatementAttachmentService.remove(path);
      setRemoved(current => [...current, path]); setConfirmPath('');
      onRemoved?.(path);
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : '파일 삭제에 실패했습니다. 다시 시도해 주세요.');
    } finally { removingRef.current = false; setRemoving(false); }
  };
  const returnFocus = useRef<HTMLElement | null>(null);
  const defaultPath = [...files].reverse().find(path => isImageName(fileNames?.[path] || getCardStatementFileName(path))) || files[files.length - 1] || '';
  const [selected, setSelected] = useState(() => defaultPath);
  const [loaded, setLoaded] = useState<{ path: string; link: CardStatementAttachmentLink } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const activePath = files.includes(selected) ? selected : defaultPath;
  const activeIndex = files.indexOf(activePath);
  const activeName = fileNames?.[activePath] || getCardStatementFileName(activePath);
  const link = loaded?.path === activePath ? loaded.link : null;
  const isImage = isImageName(getCardStatementFileName(activePath)) || isImageName(activeName);
  const isPdf = /\.pdf$/i.test(activeName) || /\.pdf$/i.test(getCardStatementFileName(activePath));
  const statementMonth = activePath.match(/^card-(?:billing|ledger)-statements\/(\d{4}-\d{2})\//)?.[1];
  const detailParams = new URLSearchParams({ storagePath: activePath, fileName: activeName });
  if (statementMonth) detailParams.set('month', statementMonth);

  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    setLoaded(null); setError('');
    if (activePath) {
      cardStatementAttachmentService.resolve(activePath).then(resolved => {
        if (!active) { resolved.release(); return; }
        release = resolved.release;
        setLoaded({ path: activePath, link: resolved });
      }).catch(cause => { if (active) setError(getCardStatementAttachmentError(cause)); });
    }
    return () => { active = false; release?.(); };
  }, [activePath, retry]);

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !removingRef.current) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="original-files-overlay" />
        <Dialog.Content className="original-files-dialog"
          onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement; }}
          onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus(); }}>
          <div className="original-files-dialog__header">
            <div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>연결된 {files.length}개 파일 중 확인할 원본을 선택해 주세요.</Dialog.Description></div>
            <button type="button" disabled={removing} onClick={onClose} aria-label="청구서 파일 닫기">닫기</button>
          </div>
          {!!files.length && <div className="original-files-dialog__navigation" aria-label="청구서 파일 목록">
            <select disabled={removing || !!confirmPath} aria-label="청구서 원본 선택" value={activePath} onChange={event => setSelected(event.target.value)}>
              {files.map((path, index) => <option key={path} value={path}>{index + 1}. {fileNames?.[path] || getCardStatementFileName(path)}</option>)}
            </select>
            <button type="button" aria-label="이전 원본" disabled={removing || !!confirmPath || activeIndex <= 0} onClick={() => setSelected(files[activeIndex - 1])}><ChevronLeft size={17} />이전</button>
            <span aria-live="polite">{activeIndex + 1} / {files.length}</span>
            <button type="button" aria-label="다음 원본" disabled={removing || !!confirmPath || activeIndex >= files.length - 1} onClick={() => setSelected(files[activeIndex + 1])}>다음<ChevronRight size={17} /></button>
          </div>}
          {!files.length && <p className="original-files-dialog__message">연결된 파일이 없습니다. 업로드 내역에서 조회월과 원본을 확인해 주세요.</p>}
          {activePath && /^card-(?:billing-statements|ledger-statements|statement-imports)\//.test(activePath) && <button type="button" disabled={removalDisabled || removing || !!confirmPath} aria-label={`${activeName} 삭제`} onClick={() => { setConfirmPath(activePath); setRemoveError(''); }} className="self-start rounded border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">선택한 파일 삭제</button>}
          {removalDisabled && <p className="mb-3 text-sm text-amber-800">변경사항을 저장한 뒤 첨부파일을 삭제해 주세요.</p>}
          {confirmPath && <div role="group" aria-label="첨부파일 삭제 확인" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="break-all font-bold">{fileNames?.[confirmPath] || getCardStatementFileName(confirmPath)}</p>
            <p className="mt-2">이 파일을 첨부 목록에서 삭제할까요? 다른 파일과 저장된 금액은 유지됩니다. 원본과 삭제 기록은 이력에 보관됩니다.</p>
            {removeError && <p role="alert" className="mt-2 font-bold">{removeError}</p>}
            <div className="mt-3 flex gap-2"><button type="button" disabled={removing} onClick={() => setConfirmPath('')} className="rounded-lg border bg-white px-3 py-2">돌아가기</button><button type="button" disabled={removing || removalDisabled} onClick={() => void remove()} className="rounded-lg bg-rose-700 px-3 py-2 font-bold text-white disabled:opacity-50">{removing ? '삭제 중…' : '확인, 파일 삭제'}</button></div>
          </div>}
          {error && <div role="alert" className="original-files-dialog__message">
            <p>{error}</p>
            {isDevAdminSessionEnabled() && <div className="mt-2">
              <p>개발용 샘플 계정은 실제 파일 조회용 로그인이 아닙니다. 실제 계정으로 전환한 뒤 파일을 다시 열어 주세요.</p>
              <a href={getRealAccountUrl()} className="mt-2 inline-block font-bold underline">실제 계정으로 돌아가기</a>
            </div>}
            <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-2 font-bold">다시 시도</button>
          </div>}
          {showDetailsLink && statementMonth && <a href={`/support/cards/statements?${detailParams.toString()}`} className="original-files-dialog__details">Gemini 분석 · 상세내역 보기</a>}
          {activePath && !error && !link && <p role="status" className="original-files-dialog__message">원본 파일을 준비하는 중…</p>}
          {link && <OriginalDocumentPreview key={`${activePath}:${link.url}`} url={link.url} fileName={activeName}
            kind={isImage ? 'image' : isPdf ? 'pdf' : 'file'} imageAlt={`${activeName} 원본 사진`} pdfTitle={`${activeName} PDF 원본`} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CardStatementFilesDialog;
