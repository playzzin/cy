import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import MaterialTransactionEvidence, { MaterialTransactionPhotoButton } from './MaterialTransactionEvidence';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import { InboundTransaction, OutboundTransaction } from '../../types/materials';
import { getMaterialTransactionRentalCompanyLink } from './materialTransactionRentalCompany';
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
    sourceRows: MaterialTransactionRow[];
    rentalCompanies: MaterialRentalCompanyOption[];
    loading: boolean;
    selectedKeys: Set<string>;
    canDelete: boolean;
    onToggleRows: (rows: MaterialTransactionRow[]) => void;
    onEdit: (row: MaterialTransactionRow) => void;
    onDelete: (row: MaterialTransactionRow) => void;
    onPhotos: (row: MaterialTransactionRow) => void;
    onCertificate: (row: MaterialTransactionRow) => void;
}

const uniqueLabels = (values: string[]) => Array.from(new Set(values)).join(', ');

const groupTransactionsBySite = (transactions: MaterialTransactionRow[]) => {
    const sites = new Map<string, { key: string; name: string; rows: MaterialTransactionRow[] }>();
    transactions.forEach(row => {
        const name = row.siteName?.trim() || '현장 미지정';
        // Site IDs keep different sites with the same display name separate.
        const key = row.siteId ? `id:${row.siteId}` : `name:${name}`;
        const site = sites.get(key) || { key, name, rows: [] };
        site.rows.push(row);
        sites.set(key, site);
    });
    return Array.from(sites.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }) || a.key.localeCompare(b.key));
};

const SelectionCheckbox: React.FC<{ label: string; rows: MaterialTransactionRow[]; selectedKeys: Set<string>; onToggle: () => void }> = ({ label, rows, selectedKeys, onToggle }) => {
    const count = rows.filter(row => selectedKeys.has(getMaterialTransactionRowKey(row))).length;
    return <input type="checkbox" aria-label={label} checked={rows.length > 0 && count === rows.length}
        ref={input => { if (input) input.indeterminate = count > 0 && count < rows.length; }}
        onChange={onToggle} />;
};

const MaterialTransactionDateList: React.FC<Props> = ({ rows, sourceRows, rentalCompanies, loading, selectedKeys, canDelete, onToggleRows, onEdit, onDelete, onPhotos, onCertificate }) => {
    const groups = useMemo(() => groupMaterialTransactionsByDate(rows).map(group => ({ ...group, sites: groupTransactionsBySite(group.transactions) })), [rows]);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [expandedSiteKey, setExpandedSiteKey] = useState<string | null>(null);
    const toggleDate = (date: string) => {
        setExpandedDate(previous => previous === date ? null : date);
        setExpandedSiteKey(null);
    };

    if (loading) return <div role="status" className="material-date-list__empty">데이터를 불러오는 중입니다...</div>;
    if (groups.length === 0) return <div className="material-date-list__empty"><strong>조회된 내역이 없습니다</strong><p>검색 조건을 변경하여 다시 조회해보세요.</p></div>;

    return <section className="material-date-list" aria-label="날짜별 입출고 내역">
        <p className="material-date-list__path">일자별 → 현장별 → 입출고 내역</p>
        <div className="material-date-list__toolbar">
            <label><SelectionCheckbox label="조회 내역 전체 선택" rows={rows} selectedKeys={selectedKeys} onToggle={() => onToggleRows(rows)} /> 전체 선택</label>
            <span>{groups.length.toLocaleString()}일 · 상세 {rows.length.toLocaleString()}건</span>
            <div className="material-date-list__expand-actions">
                <button type="button" onClick={() => { setExpandedDate(null); setExpandedSiteKey(null); }} disabled={expandedDate === null}>모두 접기</button>
            </div>
        </div>
        {groups.map(({ date, transactions, sites }) => {
            const expanded = expandedDate === date;
            const inboundCount = transactions.filter(row => row.type === 'inbound').length;
            const panelId = `material-date-${encodeURIComponent(date)}`;
            const label = date || '날짜 미지정';
            return <article key={date} className="material-date-group" aria-label={`${label} 입출고`}>
                <div className="material-date-group__heading">
                    <SelectionCheckbox label={`${label} 내역 전체 선택`} rows={transactions} selectedKeys={selectedKeys} onToggle={() => onToggleRows(transactions)} />
                    <button type="button" className="material-date-group__toggle" aria-expanded={expanded} aria-controls={panelId}
                        aria-label={`${label} 현장 목록 ${expanded ? '접기' : '펼치기'}`} onClick={() => toggleDate(date)}>
                        <span className="material-date-group__date"><strong>{label}</strong><span>{sites.length}개 현장 · 상세 {transactions.length}건</span></span>
                        <span className="material-date-group__counts"><span className="text-emerald-700">입고 {inboundCount}건</span><span className="text-orange-700">출고 {transactions.length - inboundCount}건</span></span>
                        <span className="material-date-group__field"><small>현장</small><span>{uniqueLabels(transactions.map(row => row.siteName?.trim() || '현장 미지정'))}</span></span>
                        <span className="material-date-group__field"><small>임대사</small><span>{uniqueLabels(transactions.map(row => getMaterialTransactionRentalCompanyLink(row).name || '임대사 미지정'))}</span></span>
                        <span className="material-date-group__field"><small>차량번호</small><span>{uniqueLabels(transactions.map(row => String(row.vehicleNumber || '').trim() || '차량 미지정'))}</span></span>
                        <FontAwesomeIcon icon={faChevronDown} className={expanded ? 'rotate-180' : ''} />
                    </button>
                </div>
                <div id={panelId} hidden={!expanded} className="material-date-group__sites">
                    {expanded && sites.map((site, siteIndex) => {
                        const siteOpen = expandedSiteKey === site.key;
                        const siteLabel = `${label} ${site.name}`;
                        const sitePanelId = `${panelId}-site-${siteIndex}`;
                        const siteInboundCount = site.rows.filter(row => row.type === 'inbound').length;
                        const siteStatus = uniqueLabels(site.rows.map(row => row.siteStatusLabel || '').filter(Boolean));
                        return <section key={site.key} className="material-date-site" aria-label={`${siteLabel} 현장`}>
                            <div className="material-date-site__heading">
                                <SelectionCheckbox label={`${siteLabel} 내역 전체 선택`} rows={site.rows} selectedKeys={selectedKeys} onToggle={() => onToggleRows(site.rows)} />
                                <button type="button" className="material-date-group__toggle material-date-site__toggle"
                                    aria-expanded={siteOpen} aria-controls={sitePanelId} aria-label={`${siteLabel} 입출고 ${siteOpen ? '접기' : '펼치기'}`}
                                    onClick={() => setExpandedSiteKey(previous => previous === site.key ? null : site.key)}>
                                    <span className="material-date-group__date"><strong>{site.name}</strong><span>{siteStatus ? `${siteStatus} · ` : ''}상세 {site.rows.length}건</span></span>
                                    <span className="material-date-group__counts"><span className="text-emerald-700">입고 {siteInboundCount}건</span><span className="text-orange-700">출고 {site.rows.length - siteInboundCount}건</span></span>
                                    <span className="material-date-group__field"><small>임대사</small><span>{uniqueLabels(site.rows.map(row => getMaterialTransactionRentalCompanyLink(row).name || '임대사 미지정'))}</span></span>
                                    <span className="material-date-group__field"><small>차량번호</small><span>{uniqueLabels(site.rows.map(row => String(row.vehicleNumber || '').trim() || '차량 미지정'))}</span></span>
                                    <FontAwesomeIcon icon={faChevronDown} className={siteOpen ? 'rotate-180' : ''} />
                                </button>
                            </div>
                            <div id={sitePanelId} hidden={!siteOpen}>
                                {siteOpen && <MaterialTransactionEvidence label={siteLabel} rows={site.rows} sourceRows={sourceRows}
                                    rentalCompanies={rentalCompanies} onCertificate={onCertificate} />}
                                {siteOpen && <div className="material-date-group__details" role="region" aria-label={`${siteLabel} 입출고 내역`} tabIndex={0}>
                                    <table aria-label={`${siteLabel} 입출고 내역`}>
                                        <colgroup><col style={{ width: 48 }} /><col style={{ width: 76 }} /><col style={{ width: 150 }} /><col style={{ width: 140 }} /><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 150 }} /><col style={{ width: 170 }} /><col style={{ width: 150 }} /><col style={{ width: 130 }} /><col style={{ width: 100 }} /></colgroup>
                                        <thead><tr>{['선택', '구분', '품명', '규격', '수량', '단위', '차량번호', '임대사', '입고처/출고자', '사진', '관리'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
                                        <tbody>{site.rows.map(row => {
                                            const key = getMaterialTransactionRowKey(row);
                                            return <tr key={key} className={selectedKeys.has(key) ? 'is-selected' : ''}>
                                                <td><SelectionCheckbox label={`${siteLabel} ${row.type === 'inbound' ? '입고' : '출고'} ${row.spec} 선택`} rows={[row]} selectedKeys={selectedKeys} onToggle={() => onToggleRows([row])} /></td>
                                                <td><span className={row.type === 'inbound' ? 'text-emerald-700' : 'text-orange-700'}>{row.type === 'inbound' ? '입고' : '출고'}</span></td>
                                                <td>{row.itemName || '-'}</td><td>{row.spec || '-'}</td>
                                                <td className="text-right font-bold">{row.quantity.toLocaleString()}</td><td>{row.unit || '-'}</td>
                                                <td>{String(row.vehicleNumber || '').trim() || '-'}</td><td>{getMaterialTransactionRentalCompanyLink(row).name || '-'}</td>
                                                <td>{row.type === 'inbound' ? (row as InboundTransaction).supplier || '-' : (row as OutboundTransaction).recipient || '-'}</td>
                                                <td><MaterialTransactionPhotoButton row={row} onPhotos={onPhotos} /></td>
                                                <td><div className="flex gap-2"><button type="button" className="material-date-list__action" onClick={() => onEdit(row)} title="수정"><FontAwesomeIcon icon={faEdit} /></button>
                                                    {canDelete && <button type="button" className="material-date-list__action text-red-600" onClick={() => onDelete(row)} title="삭제"><FontAwesomeIcon icon={faTrash} /></button>}</div></td>
                                            </tr>;
                                        })}</tbody>
                                    </table>
                                </div>}
                            </div>
                        </section>;
                    })}
                </div>
            </article>;
        })}
    </section>;
};

export default MaterialTransactionDateList;
