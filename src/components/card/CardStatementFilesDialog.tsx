import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import {
  cardStatementAttachmentService, getCardStatementAttachmentError, getCardStatementFileName,
  type CardStatementAttachmentLink,
} from '../../services/cardStatementAttachmentService';

interface Props {
  paths: string[];
  title?: string;
  fileNames?: Record<string, string>;
  onClose: () => void;
}

const getRealAccountUrl = (): string => {
  const url = new URL(window.location.href);
  url.searchParams.set('devAdmin', '0');
  return `${url.pathname}${url.search}${url.hash}`;
};

const CardStatementFilesDialog: React.FC<Props> = ({ paths, title = '청구서 파일', fileNames, onClose }) => {
  const files = useMemo(() => Array.from(new Set(paths.map(path => path.trim()).filter(Boolean))), [paths]);
  const [selected, setSelected] = useState(() => files[files.length - 1] || '');
  const [loaded, setLoaded] = useState<{ path: string; link: CardStatementAttachmentLink } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const activePath = files.includes(selected) ? selected : files[files.length - 1] || '';
  const activeName = fileNames?.[activePath] || getCardStatementFileName(activePath);
  const link = loaded?.path === activePath ? loaded.link : null;
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
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-900/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><Dialog.Title className="break-words text-lg font-extrabold text-slate-900">{title}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">연결된 {files.length}개 파일 중 확인할 원본을 선택해 주세요.</Dialog.Description></div>
            <button type="button" onClick={onClose} aria-label="청구서 파일 닫기" className="shrink-0 rounded-lg border px-3 py-2 text-sm">닫기</button>
          </div>
          <div className="my-4 max-h-64 space-y-2 overflow-y-auto" aria-label="청구서 파일 목록">
            {files.map((path, index) => <button key={path} type="button" aria-pressed={activePath === path} onClick={() => setSelected(path)} className={`flex w-full gap-2 rounded-xl border p-3 text-left text-sm ${activePath === path ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}><span className="shrink-0 text-slate-400">{index + 1}.</span><span className="break-all">{fileNames?.[path] || getCardStatementFileName(path)}</span></button>)}
            {!files.length && <p className="p-4 text-sm text-slate-500">연결된 파일이 없습니다. 업로드 내역에서 조회월과 원본을 확인해 주세요.</p>}
          </div>
          {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            <p>{error}</p>
            {isDevAdminSessionEnabled() && <div className="mt-2">
              <p>개발용 샘플 계정은 실제 파일 조회용 로그인이 아닙니다. 실제 계정으로 전환한 뒤 파일을 다시 열어 주세요.</p>
              <a href={getRealAccountUrl()} className="mt-2 inline-block font-bold underline">실제 계정으로 돌아가기</a>
            </div>}
            <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-2 font-bold">다시 시도</button>
          </div>}
          {statementMonth && <a href={`/support/cards/statements?${detailParams.toString()}`} className="mb-4 inline-flex rounded-lg border border-indigo-200 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Gemini 분석 · 상세내역 보기</a>}
          {activePath && !error && !link && <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">원본 파일을 준비하는 중…</p>}
          {link && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="break-all text-sm font-bold text-emerald-900">{activeName}</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">아래 버튼을 눌러 원본을 여세요. 새 탭이 열리지 않으면 현재 탭에서 열 수 있습니다.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">새 탭에서 원본 열기</a>
              <a href={link.url} target="_self" referrerPolicy="no-referrer" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">현재 탭에서 열기</a>
            </div>
          </div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CardStatementFilesDialog;
