import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faEdit, faFileInvoice, faImages, faTrash } from '@fortawesome/free-solid-svg-icons';
import { groupOutboundCertificates } from './materialTransactionCertificate';
import { InboundTransaction, OutboundTransaction } from '../../types/materials';
import { getMaterialTransactionRentalCompanyLink } from './materialTransactionRentalCompany';
import { getMaterialPhotoDisplayCount, hasMaterialPhotoReference } from './MaterialPhotoViewerModal';
import './MaterialTransactionDateList.css';

export type MaterialTransactionRow = (InboundTransaction | OutboundTransaction) & {
    type: 'inbound' | 'outbound';
    siteStatusLabel?: string;
};

export const getMaterialTransactionRowKey = (row: MaterialTransactionRow): string => `${row.type}:${row.id}`;

export const groupMaterialTransactionsByDate = (rows: MaterialTransactionRow[]) => {
    const groups = new Map<string, MaterialTransactionRow[]>();
    rows.forEach(row => {
        const date = row.transactionDate.trim().slice(0, 10);
        const group = groups.get(date) || [];
        group.push(row);
        groups.set(date, group);
    });
    return Array.from(groups, ([date, transactions]) => ({ date, transactions }))
        .sort((a, b) => b.date.localeCompare(a.date));
};

interface Props {
    rows: MaterialTransactionRow[];
    loading: boolean;
    selectedKeys: Set<string>;
    canDelete: boolean;
    onToggleRows: (rows: MaterialTransactionRow[]) => void;
    onEdit: (row: MaterialTransactionRow) => void;
    onDelete: (row: MaterialTransactionRow) => void;
    onPhotos: (row: MaterialTransactionRow) => void;
    onOutboundCertificate: (row: MaterialTransactionRow) => void;
}

const uniqueLabels = (values: string[]) => Array.from(new Set(values)).join(', ');

const SelectionCheckbox: React.FC<{ label: string; rows: MaterialTransactionRow[]; selectedKeys: Set<string>; onToggle: () => void }> = ({ label, rows, selectedKeys, onToggle }) => {
    const count = rows.filter(row => selectedKeys.has(getMaterialTransactionRowKey(row))).length;
    return <input type="checkbox" aria-label={label} checked={rows.length > 0 && count === rows.length}
        ref={input => { if (input) input.indeterminate = count > 0 && count < rows.length; }}
        onChange={onToggle} />;
};

const MaterialTransactionDateList: React.FC<Props> = ({ rows, loading, selectedKeys, canDelete, onToggleRows, onEdit, onDelete, onPhotos, onOutboundCertificate }) => {
    const groups = useMemo(() => groupMaterialTransactionsByDate(rows), [rows]);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const toggleDate = (date: string) => setExpandedDates(previous => {
        const next = new Set(previous);
        if (next.has(date)) next.delete(date); else next.add(date);
        return next;
    });

    if (loading) return <div role="status" className="material-date-list__empty">데이터를 불러오는 중입니다...</div>;
    if (groups.length === 0) return <div className="material-date-list__empty"><strong>조회된 내역이 없습니다</strong><p>검색 조건을 변경하여 다시 조회해보세요.</p></div>;

    return <section className="material-date-list" aria-label="날짜별 입출고 내역">
        <div className="material-date-list__toolbar">
            <label><SelectionCheckbox label="조회 내역 전체 선택" rows={rows} selectedKeys={selectedKeys} onToggle={() => onToggleRows(rows)} /> 전체 선택</label>
            <span>{groups.length.toLocaleString()}일 · 상세 {rows.length.toLocaleString()}건</span>
            <div className="material-date-list__expand-actions">
                <button type="button" onClick={() => setExpandedDates(new Set(groups.map(group => group.date)))}>모두 펼치기</button>
                <button type="button" onClick={() => setExpandedDates(new Set())}>모두 접기</button>
            </div>
        </div>
        {groups.map(({ date, transactions }) => {
            const expanded = expandedDates.has(date);
            const inboundCount = transactions.filter(row => row.type === 'inbound').length;
            const panelId = `material-date-${encodeURIComponent(date)}`;
            const label = date || '날짜 미지정';
            return <article key={date} className="material-date-group" aria-label={`${label} 입출고`}>
                <div className="material-date-group__heading">
                    <SelectionCheckbox label={`${label} 내역 전체 선택`} rows={transactions} selectedKeys={selectedKeys} onToggle={() => onToggleRows(transactions)} />
                    <button type="button" className="material-date-group__toggle" aria-expanded={expanded} aria-controls={panelId}
                        aria-label={`${label} 상세 내역 ${expanded ? '접기' : '펼치기'}`} onClick={() => toggleDate(date)}>
                        <span className="material-date-group__date"><strong>{label}</strong><span>상세 {transactions.length}건</span></span>
                        <span className="material-date-group__counts"><span className="text-emerald-700">입고 {inboundCount}건</span><span className="text-orange-700">출고 {transactions.length - inboundCount}건</span></span>
                        <span className="material-date-group__field"><small>현장</small><span>{uniqueLabels(transactions.map(row => row.siteName?.trim() || '현장 미지정'))}</span></span>
                        <span className="material-date-group__field"><small>임대사</small><span>{uniqueLabels(transactions.map(row => getMaterialTransactionRentalCompanyLink(row).name || '임대사 미지정'))}</span></span>
                        <span className="material-date-group__field"><small>차량번호</small><span>{uniqueLabels(transactions.map(row => String(row.vehicleNumber || '').trim() || '차량 미지정'))}</span></span>
                        <FontAwesomeIcon icon={faChevronDown} className={expanded ? 'rotate-180' : ''} />
                    </button>
                </div>
                <div id={panelId} hidden={!expanded}>
                    {expanded && groupOutboundCertificates(transactions).length > 0 && <section className="material-date-group__certificates" aria-label={`${label} 반출증`}>
                        <p>출고 반출증 · 현장·임대사·차량별</p>
                        {groupOutboundCertificates(transactions).map(([row]) => <div key={getMaterialTransactionRowKey(row)}>
                            <span>{row.siteName || '현장 미지정'} · {getMaterialTransactionRentalCompanyLink(row).name || '임대사 미지정'} · {row.vehicleNumber || '차량 미지정'}</span>
                            <button type="button" className="material-date-list__action" onClick={() => onOutboundCertificate(row)}><FontAwesomeIcon icon={faFileInvoice} /> 반출증 보기</button>
                        </div>)}
                    </section>}
                    {expanded && <div className="material-date-group__details" role="region" aria-label={`${label} 상세 내역`} tabIndex={0}>
                        <table aria-label={`${label} 상세 내역`}>
                            <colgroup><col style={{ width: 48 }} /><col style={{ width: 76 }} /><col style={{ width: 180 }} /><col style={{ width: 150 }} /><col style={{ width: 140 }} /><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 150 }} /><col style={{ width: 170 }} /><col style={{ width: 150 }} /><col style={{ width: 130 }} /><col style={{ width: 200 }} /><col style={{ width: 100 }} /></colgroup>
                            <thead><tr>{['선택', '구분', '현장', '품명', '규격', '수량', '단위', '차량번호', '임대사', '입고처/출고자', '사진', '비고', '관리'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
                            <tbody>{transactions.map(row => {
                                const key = getMaterialTransactionRowKey(row);
                                const photoCount = getMaterialPhotoDisplayCount(row);
                                return <tr key={key} className={selectedKeys.has(key) ? 'is-selected' : ''}>
                                    <td><SelectionCheckbox label={`${label} ${row.type === 'inbound' ? '입고' : '출고'} ${row.spec} 선택`} rows={[row]} selectedKeys={selectedKeys} onToggle={() => onToggleRows([row])} /></td>
                                    <td><span className={row.type === 'inbound' ? 'text-emerald-700' : 'text-orange-700'}>{row.type === 'inbound' ? '입고' : '출고'}</span></td>
                                    <td>{row.siteName || '-'}<small className="block text-slate-400">{row.siteStatusLabel}</small></td>
                                    <td>{row.itemName || '-'}</td><td>{row.spec || '-'}</td>
                                    <td className="text-right font-bold">{row.quantity.toLocaleString()}</td><td>{row.unit || '-'}</td>
                                    <td>{String(row.vehicleNumber || '').trim() || '-'}</td><td>{getMaterialTransactionRentalCompanyLink(row).name || '-'}</td>
                                    <td>{row.type === 'inbound' ? (row as InboundTransaction).supplier || '-' : (row as OutboundTransaction).recipient || '-'}</td>
                                    <td>{hasMaterialPhotoReference(row) ? <button type="button" className="material-date-list__action" onClick={() => onPhotos(row)} title="첨부사진 보기"><FontAwesomeIcon icon={faImages} /> {photoCount === null ? '사진 확인' : `사진 ${photoCount}장`}</button> : '-'}</td>
                                    <td className="whitespace-pre-wrap">{row.notes || '-'}</td>
                                    <td><div className="flex gap-2"><button type="button" className="material-date-list__action" onClick={() => onEdit(row)} title="수정"><FontAwesomeIcon icon={faEdit} /></button>
                                        {canDelete && <button type="button" className="material-date-list__action text-red-600" onClick={() => onDelete(row)} title="삭제"><FontAwesomeIcon icon={faTrash} /></button>}</div></td>
                                </tr>;
                            })}</tbody>
                        </table>
                    </div>}
                </div>
            </article>;
        })}
    </section>;
};

export default MaterialTransactionDateList;
