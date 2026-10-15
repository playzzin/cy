import React, { useEffect, useRef, useState } from 'react';
import { downloadTransferBackup, readTransferBackupFile } from './transferBackup';
import type { TransferBackup } from './transferBackup';
import { loadTransferDrafts, restoreTransferDrafts } from './transferDraftStorage';
import type { TransferDraft } from './types';

export default function TransferBackupPanel({ userId, current, onRestored }: {
    userId: string; current: TransferDraft; onRestored: (drafts: TransferDraft[]) => void;
}) {
    const [pending, setPending] = useState<TransferBackup | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const request = useRef(0);
    useEffect(() => () => { request.current += 1; }, []);
    const fail = (value: unknown) => setError(value instanceof Error ? value.message : '처리하지 못했습니다. 다시 시도해 주세요.');
    const download = (all: boolean) => {
        setError(''); setNotice('');
        try {
            const drafts = all ? loadTransferDrafts(userId) : [{ ...current, title: current.title.trim() || `${current.period} 송금 목록`, updatedAt: new Date().toISOString() }];
            if (!drafts.length) throw new Error('백업할 저장 목록이 없습니다. 현재 목록 백업을 이용해 주세요.');
            downloadTransferBackup(drafts);
            setNotice(`${drafts.length}개 목록의 백업 파일을 만들었습니다. 다른 PC에서 이 파일을 선택하면 이어서 작업할 수 있습니다.`);
        } catch (error) { fail(error); }
    };
    const read = async (file?: File) => {
        if (!file) return;
        const token = ++request.current;
        setBusy(true); setError(''); setNotice(''); setPending(null); setSelected(new Set());
        try {
            const result = await readTransferBackupFile(file);
            if (token !== request.current) return;
            setPending(result); setSelected(new Set(result.drafts.map(item => item.id)));
        } catch (error) { if (token === request.current) fail(error); }
        finally { if (token === request.current) setBusy(false); }
    };
    const restore = () => {
        if (!pending || !selected.size) return;
        setError(''); setNotice('');
        try {
            const result = restoreTransferDrafts(userId, pending.drafts.filter(item => selected.has(item.id)));
            onRestored(loadTransferDrafts(userId)); setPending(null); setSelected(new Set());
            setNotice(`${result.addedCount}개 목록을 복원했습니다.${result.skippedCount ? ` 동일한 내용 ${result.skippedCount}개는 건너뛰었습니다.` : ''}${result.copiedCount ? ` 기존 목록과 번호가 겹친 ${result.copiedCount}개는 별도로 보관했습니다.` : ''} ‘저장한 목록’에서 불러오세요.`);
        } catch (error) { fail(error); }
    };
    return <details className="bt-backup-panel"><summary>백업·다른 PC에서 이어하기</summary>
        <div className="bt-backup-content"><p>현재 목록 백업에는 저장 전 수정도 포함됩니다. 저장 목록 전체 백업은 마지막 저장본만 담습니다. 백업 파일에는 계좌와 급여 내역이 포함됩니다.</p>
            <div className="bt-backup-actions"><button onClick={() => download(false)}>현재 목록 백업</button><button onClick={() => download(true)}>저장 목록 전체 백업</button>
                <label className="bt-backup-file">백업 파일 선택<input type="file" accept=".json,application/json" aria-label="송금 백업 파일 선택" onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
            {busy && <p role="status">백업 파일을 확인하고 있습니다…</p>}{error && <p role="alert" className="bt-error">{error}</p>}{notice && <p role="status" className="bt-notice">{notice}</p>}
            {pending && <div className="bt-backup-preview"><strong>복원할 목록 선택 · {pending.drafts.length}개</strong><p>기존 목록과 화면의 편집 내용은 유지됩니다. 같은 번호에 다른 내용이 있으면 별도 목록으로 복원합니다.</p>
                {pending.drafts.map(item => <label key={item.id}><input type="checkbox" checked={selected.has(item.id)} aria-label={`${item.title} 복원 선택`} onChange={event => { const checked = event.target.checked; setSelected(previous => { const next = new Set(previous); checked ? next.add(item.id) : next.delete(item.id); return next; }); }} /><span><strong>{item.title}</strong><small>{item.rows.length}건 · {item.rows.reduce((sum, row) => sum + row.amount, 0).toLocaleString('ko-KR')}원 · 파일 생성 이력 {item.exportHistory?.length ?? 0}건</small></span></label>)}
                <div className="bt-backup-actions"><button disabled={!selected.size || busy} onClick={restore}>선택 {selected.size}개 복원</button><button onClick={() => { request.current += 1; setPending(null); setSelected(new Set()); setError(''); }}>취소</button></div>
            </div>}
        </div>
    </details>;
}
