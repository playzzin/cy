import React, { useEffect, useMemo, useState } from 'react';
import ResponsiveDetailDialog from '../common/ResponsiveDetailDialog';
import CardStatementFilesDialog from './CardStatementFilesDialog';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import { getCardStatementFileName } from '../../services/cardStatementAttachmentService';
import { getCardStatementResults } from '../../utils/cardStatementReconciliation';
import type { CardStatementFileDetailPayload } from '../../types/cardStatementImport';
import type { CardTransaction } from '../../types/card';
import './TeamCardStatementDetails.css';

export interface CardUsageDateRange { startDate: string; endDate: string; }
interface Props {
    yearMonth: string;
    cardId: string;
    cardLast4: string;
    cardName: string;
    paths: string[];
    transactions: CardTransaction[];
    dateRanges: CardUsageDateRange[];
    onClose?: () => void;
    inline?: boolean;
}
interface LoadedFile { path: string; payload?: CardStatementFileDetailPayload; error?: boolean; }
const categories: Record<string, string> = { FUEL: '유류비', TOLL: '통행료', MEAL: '식비', MATERIAL: '자재비', OTHER: '기타' };
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

/** Card identity, billing month and visible assignment periods all have to match. */
export function selectTeamCardStatementRows(files: LoadedFile[], cardId: string, last4: string, month: string, ranges: CardUsageDateRange[]) {
    const seen = new Set<string>();
    return files.flatMap(({ path, payload }) => {
        if (!payload || payload.analysisStatus !== 'completed' || ['uploading', 'cancelled'].includes(payload.file.status)) return [];
        const hashes = Array.from(new Set(payload.results.map(result => result.sourceSha256).filter(Boolean)));
        const identity = payload.file.sha256 || (hashes.length === 1 ? hashes[0] : '') || payload.file.storagePath || path;
        if (seen.has(identity)) return [];
        const matching = getCardStatementResults(payload.results, cardId, last4).filter(result => result.status !== 'failed').flatMap(result =>
            (result.transactions || []).filter(row => Number.isFinite(row.amount) && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
                && row.date.startsWith(`${month}-`) && ranges.some(range => row.date >= range.startDate && row.date <= range.endDate))
                .map((row, index) => ({ ...row, id: `${identity}:${result.id}:${row.id || index}`, path })),
        );
        if (matching.length) seen.add(identity);
        return matching;
    }).sort((a, b) => b.date.localeCompare(a.date));
}

export default function TeamCardStatementDetails({ yearMonth, cardId, cardLast4, cardName, paths, transactions, dateRanges, onClose, inline = false }: Props) {
    const fileKey = JSON.stringify(Array.from(new Set(paths.map(path => path.trim()).filter(Boolean))));
    const files = useMemo<string[]>(() => JSON.parse(fileKey), [fileKey]);
    const [loaded, setLoaded] = useState<LoadedFile[]>([]);
    const [loading, setLoading] = useState(files.length > 0);
    const [revision, setRevision] = useState(0);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('ALL');
    const [limit, setLimit] = useState(30);
    const [expanded, setExpanded] = useState(!inline);
    const [original, setOriginal] = useState<string | null>(null);
    useEffect(() => {
        let disposed = false;
        setLoading(files.length > 0); setLoaded([]);
        void (async () => {
            const next: LoadedFile[] = [];
            for (let index = 0; index < files.length; index += 3) {
                if (disposed) return;
                next.push(...await Promise.all(files.slice(index, index + 3).map(async path => {
                    try { return { path, payload: await cardStatementImportService.getFileDetail({ storagePath: path, yearMonth }) }; }
                    catch { return { path, error: true }; }
                })));
            }
            if (!disposed) { setLoaded(next); setLoading(false); }
        })();
        return () => { disposed = true; };
    }, [files, yearMonth, revision]);
    const extracted = useMemo(() => selectTeamCardStatementRows(loaded, cardId, cardLast4, yearMonth, dateRanges), [loaded, cardId, cardLast4, yearMonth, dateRanges]);
    const registered = useMemo(() => transactions.filter(row => row.cardId === cardId && row.yearMonth === yearMonth && row.status !== 'CANCELLED' && !row.cancelledAt
        && Number.isFinite(row.amount) && row.date.startsWith(`${yearMonth}-`) && dateRanges.some(range => row.date >= range.startDate && row.date <= range.endDate))
        .map(row => ({ ...row, path: row.statementAttachmentPaths?.find(path => files.includes(path)) || (row.evidenceUrl && files.includes(row.evidenceUrl) ? row.evidenceUrl : ''), confidence: 1 })), [transactions, cardId, yearMonth, files, dateRanges]);
    const rows = extracted.length ? extracted : registered;
    const filtered = rows.filter(row => (category === 'ALL' || row.category === category)
        && [row.merchant, row.date, row.memo, row.amount].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const failures = loaded.filter(file => file.error).length;
    const incomplete = loaded.filter(file => file.payload && file.payload.analysisStatus !== 'completed').length;
    const content = (
            <div className={`team-card-usage${inline ? ' team-card-usage--inline' : ''}`}>
                <div className="team-card-usage__summary"><span>{extracted.length ? '명세서에 저장된 상세내역' : '등록된 사용내역'} · {filtered.length}건</span><strong>{rows.length ? won(filtered.reduce((sum, row) => sum + row.amount, 0)) : '내역 확인 필요'}</strong></div>
                <p className="team-card-usage__hint">표시한 내역의 합계입니다. 월 청구액과 다를 수 있으며, 정산 금액은 변경되지 않습니다.</p>
                {loading && <p role="status">저장된 명세서 상세내역을 불러오는 중…</p>}
                {failures > 0 && <p role="alert" className="team-card-usage__notice">원본 {failures}개의 상세내역을 조회하지 못했습니다. 표시된 내역은 일부일 수 있습니다. <button type="button" onClick={() => setRevision(value => value + 1)}>다시 조회</button></p>}
                {!loading && incomplete > 0 && <p className="team-card-usage__notice">원본 {incomplete}개는 저장된 분석이 완료되지 않았습니다. 원본으로 확인해 주세요.</p>}
                {expanded && <div className="team-card-usage__filters">
                    <input aria-label="카드 상세내역 검색" placeholder="가맹점·날짜·금액 검색" value={search} onChange={event => { setSearch(event.target.value); setLimit(30); }} />
                    <select aria-label="카드 상세내역 분류" value={category} onChange={event => { setCategory(event.target.value); setLimit(30); }}><option value="ALL">전체 분류</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                </div>}
                <div className="team-card-usage__rows" aria-label="카드 사용 상세내역">
                    {filtered.slice(0, expanded ? limit : 3).map(row => <article key={row.id}>
                        <div><strong>{row.merchant || '가맹점 미등록'}</strong><b>{won(row.amount)}</b></div>
                        <p><time>{row.date}</time> · {categories[row.category] || '기타'}</p>
                        {row.memo && <p>{row.memo}</p>}
                        {row.confidence < .8 && <small>원본 확인이 필요한 내역입니다.</small>}
                        {row.path && <button type="button" onClick={() => setOriginal(row.path)}>이 내역의 원본 보기</button>}
                    </article>)}
                    {!loading && !filtered.length && <p className="team-card-usage__empty">{rows.length ? '검색에 맞는 내역이 없습니다.' : '조회 가능한 상세내역이 없습니다. 아래 원본에서 확인해 주세요.'}</p>}
                </div>
                {inline && (rows.length > 3 || expanded) && <button type="button" className="team-card-usage__more" aria-expanded={expanded} onClick={() => { setExpanded(value => !value); setSearch(''); setCategory('ALL'); setLimit(30); }}>{expanded ? '간단히 보기' : `전체 ${rows.length}건 펼치기`}</button>}
                {expanded && filtered.length > limit && <button type="button" className="team-card-usage__more" onClick={() => setLimit(value => value + 30)}>사용내역 더 보기 ({filtered.length - limit}건)</button>}
                {!inline && files.length > 0 && <details className="team-card-usage__files"><summary>연결된 원본 {files.length}개</summary>{files.map(path => <button type="button" key={path} onClick={() => setOriginal(path)}>{getCardStatementFileName(path)}</button>)}</details>}
            </div>
    );
    return <>
        {inline ? content : <ResponsiveDetailDialog open onOpenChange={open => { if (!open) onClose?.(); }} mobileBreakpoint={768}
            title={`${cardName} 사용 상세`} description={`${yearMonth} · ${cardLast4 ? `끝번호 ${cardLast4} · ` : ''}선택한 카드의 조회 가능한 내역`} className="team-card-usage-dialog">{content}</ResponsiveDetailDialog>}
        {original && <CardStatementFilesDialog paths={files} initialPath={original} showDetailsLink={false} title={`${cardName} 사용내역서 원본`} onClose={() => setOriginal(null)} />}
    </>;
}
