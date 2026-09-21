import React, { useEffect, useRef, useState } from 'react';

export interface DraftPage {
  retentionDays: number;
  nextCursor: string | null;
  drafts: { id: string; lastActivityAt: string; retry: boolean }[];
}
interface Props {
  service: { listDrafts: (cursor?: string) => Promise<DraftPage>; discardDraft: (id: string) => Promise<unknown> };
}

export default function TeamRequestDraftMaintenance({ service }: Props) {
  const [page, setPage] = useState<DraftPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const lock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : '임시 신청을 정리하지 못했습니다. 다시 시도해 주세요.'); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  const load = (cursor?: string) => run(async () => {
    const result = await service.listDrafts(cursor);
    if (active.current) setPage(previous => ({ ...result, drafts: cursor ? [...new Map([...(previous?.drafts || []), ...result.drafts].map(row => [row.id, row])).values()] : result.drafts }));
  });
  const remove = (id: string) => {
    if (!window.confirm('30일 이상 사용하지 않은 이 미제출 신청과 첨부를 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
    void run(async () => {
      await service.discardDraft(id);
      if (active.current) setPage(previous => previous && ({ ...previous, drafts: previous.drafts.filter(row => row.id !== id) }));
    });
  };
  return <section aria-label="미제출 첨부 정리">
    <h2>미제출 첨부 정리</h2>
    <p>30일 이상 사용하지 않은 미제출 자료를 확인하고 건별로 삭제합니다. 제출·승인·반려 자료는 제외됩니다.</p>
    <button type="button" disabled={busy} onClick={() => void load()}>정리 대상 확인</button>
    {error && <p role="alert">{error}</p>}
    {page && <><p>확인된 정리 대상 {page.drafts.length}건{page.nextCursor ? ' · 아직 확인하지 않은 임시 신청이 있습니다.' : ''}</p>
      <ul>{page.drafts.map(row => <li key={row.id}>신청 {row.id.slice(0, 12)} · 마지막 사용 {new Date(row.lastActivityAt).toLocaleDateString('ko-KR')}{row.retry && ' · 정리 재시도 필요'} <button type="button" disabled={busy} onClick={() => remove(row.id)}>첨부와 임시 신청 삭제</button></li>)}</ul>
      {page.nextCursor && <button type="button" disabled={busy} onClick={() => void load(page.nextCursor!)}>다음 정리 대상 확인</button>}
    </>}
    {busy && <p role="status">처리 중입니다.</p>}
  </section>;
}
