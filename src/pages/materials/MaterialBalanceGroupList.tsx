import React, { useState } from 'react';
import { Building2, CalendarDays, ChevronDown, MapPin } from 'lucide-react';
import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import MaterialTransactionEvidence, { MaterialTransactionPhotoButton } from './MaterialTransactionEvidence';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import { groupMaterialBalanceTransactionsByDate, MaterialBalanceGroup, MaterialBalanceGrouping } from './materialBalanceSummary';

interface Props {
    groups: MaterialBalanceGroup[];
    grouping: MaterialBalanceGrouping;
    sourceRows: MaterialTransactionRow[];
    rentalCompanies: MaterialRentalCompanyOption[];
    onPhotos: (row: MaterialTransactionRow) => void;
    onCertificate: (row: MaterialTransactionRow) => void;
}
const formatQuantity = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 9 });
const chevron = (open: boolean) => <ChevronDown size={16} className={`material-balances__group-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />;
const closedSelection = { constructionKey: '', siteId: '', rentalKey: '', date: '' };

const MaterialBalanceGroupList: React.FC<Props> = ({ groups, grouping, sourceRows, rentalCompanies, onPhotos, onCertificate }) => {
    const [selection, setSelection] = useState(closedSelection);
    const isSite = grouping === 'site';
    const fields = isSite ? ['constructionKey', 'siteId', 'rentalKey', 'date'] as const : ['rentalKey', 'constructionKey', 'siteId', 'date'] as const;
    const GroupIcon = Building2;
    const SectionIcon = isSite ? MapPin : Building2;
    const ChildIcon = isSite ? Building2 : MapPin;
    // One selected path keeps siblings mutually exclusive. Selecting an ancestor
    // closes its descendants; transposing the hierarchy keeps the same selection.
    const toggleLevel = (level: number, value: string) => setSelection(previous => {
        const field = fields[level];
        const next = { ...previous, [field]: previous[field] === value ? '' : value };
        fields.slice(level + 1).forEach(childField => { next[childField] = ''; });
        return next;
    });

    return <div className="material-balances__groups" role="region" aria-label="현장·임대사별 입출고 묶음">
        <div className="material-balances__group-tools">
            <span>{isSite ? '건설사 → 현장 → 임대사 → 날짜별 입출고' : '임대사 → 건설사 → 현장 → 날짜별 입출고'}</span>
            <button type="button" onClick={() => setSelection(closedSelection)} disabled={!selection[fields[0]]}>모두 접기</button>
        </div>
        {groups.map((group, groupIndex) => {
            const groupValue = group.children[0].children[0].rows[0][fields[0]];
            const open = selection[fields[0]] === groupValue;
            const contentId = `balance-group-${grouping}-${groupIndex}`;
            const needsRentalReview = !isSite && group.children.some(section => section.children.some(child => child.rows.some(row => row.rentalNeedsReview)));
            const recordCount = group.children.reduce((total, section) => total + section.children.reduce((count, child) => count + child.rows.reduce((sum, row) => sum + row.transactions.length, 0), 0), 0);
            return <section key={group.key} className="material-panel material-balances__group" aria-label={`${group.name} 입출고 묶음`}>
                <h2 className="material-balances__group-heading"><button type="button" aria-expanded={open}
                    aria-controls={open ? contentId : undefined} aria-label={`${group.name} ${open ? '접기' : '펼치기'}`} onClick={() => toggleLevel(0, groupValue)}>
                    <span className="material-balances__group-icon"><GroupIcon size={19} aria-hidden="true" /></span>
                    <span className="material-balances__group-title"><strong>{group.name}</strong>
                        <small>{group.children.length}{isSite ? '개 현장' : '개 건설사 구분'} · 입출고 {recordCount}건</small>
                    </span>
                    {needsRentalReview && <span className="material-balances__group-review">임대사 확인 필요</span>}
                    {chevron(open)}
                </button></h2>
                {open && <div id={contentId} className="material-balances__group-content">
                    {group.children.map((section, sectionIndex) => {
                        const sectionValue = section.children[0].rows[0][fields[1]];
                        const sectionOpen = selection[fields[1]] === sectionValue;
                        const sectionId = `${contentId}-section-${sectionIndex}`;
                        return <section key={section.key} className="material-balances__section" aria-label={`${section.name} ${isSite ? '입출고 묶음' : '건설사별 현장 묶음'}`}>
                            <h3 className="material-balances__section-heading"><button type="button" aria-expanded={sectionOpen}
                                aria-controls={sectionOpen ? sectionId : undefined} aria-label={`${section.name} ${sectionOpen ? '접기' : '펼치기'}`} onClick={() => toggleLevel(1, sectionValue)}>
                                <SectionIcon size={17} aria-hidden="true" /><strong>{section.name}</strong>
                                <span>{section.children.length}{isSite ? '개 임대사 구분' : '개 현장'}</span>{chevron(sectionOpen)}
                            </button></h3>
                            {sectionOpen && <div id={sectionId} className="material-balances__section-content">
                                {section.children.map((child, childIndex) => {
                                    const days = groupMaterialBalanceTransactionsByDate(child.rows);
                                    const pair = child.rows[0];
                                    const dateKey = (date: string) => JSON.stringify([pair.siteId, pair.rentalKey, date]);
                                    const childValue = pair[fields[2]];
                                    const childOpen = selection[fields[2]] === childValue;
                                    const childId = `${sectionId}-child-${childIndex}`;
                                    return <section key={child.key} className="material-balances__subgroup" aria-label={`${child.name} 날짜별 입출고`}>
                                        <h4 className="material-balances__subgroup-heading"><button type="button" aria-expanded={childOpen}
                                            aria-controls={childOpen ? childId : undefined} aria-label={`${child.name} 날짜별 입출고 ${childOpen ? '접기' : '펼치기'}`} onClick={() => toggleLevel(2, childValue)}>
                                            <ChildIcon size={16} aria-hidden="true" /><strong>{child.name}</strong>
                                            {isSite && child.rows.some(row => row.rentalNeedsReview) && <span className="material-balances__group-review">임대사 확인 필요</span>}
                                            <span className="material-balances__subgroup-count">{days.length}일</span>{chevron(childOpen)}
                                        </button></h4>
                                        {childOpen && <div id={childId}>
                                            <div className="material-balances__date-tools"><span>최근 날짜순 · 품목 내역 기준</span></div>
                                            {days.map((day, dayIndex) => {
                                                const key = dateKey(day.date);
                                                const dayOpen = selection.date === day.date;
                                                const dayId = `${childId}-date-${dayIndex}`;
                                                return <article key={key} className="material-balances__date" aria-label={`${child.siteName} · ${child.rentalName} · ${day.date} 입출고`}>
                                                    <h5><button type="button" className="material-balances__date-heading" aria-expanded={dayOpen}
                                                        aria-controls={dayOpen ? dayId : undefined} aria-label={`${child.siteName} ${child.rentalName} ${day.date} 입출고 ${dayOpen ? '접기' : '펼치기'}`} onClick={() => toggleLevel(3, day.date)}>
                                                        <CalendarDays size={16} aria-hidden="true" /><time dateTime={day.date}>{day.date}</time>
                                                        <span className="material-balances__date-counts"><span className="is-inbound">입고 {day.inboundCount}건</span><span className="is-outbound">출고 {day.outboundCount}건</span></span>{chevron(dayOpen)}
                                                    </button></h5>
                                                    {dayOpen && <div id={dayId} className="material-balances__date-detail">
                                                        <MaterialTransactionEvidence label={`${child.siteName} · ${child.rentalName} · ${day.date}`}
                                                            rows={day.entries.map(entry => entry.transaction)} sourceRows={sourceRows}
                                                            rentalCompanies={rentalCompanies} onCertificate={onCertificate} />
                                                        <table className="material-balances__table" aria-label={`${child.siteName} · ${child.rentalName} · ${day.date} 입출고 내역`}>
                                                            <thead><tr><th>품명 · 규격</th><th className="is-number">입고</th><th className="is-number">출고</th><th className="is-number">거래 후 잔량</th><th>차량 · 사진</th></tr></thead>
                                                            <tbody>{day.entries.map(({ material, transaction, balance }) => <tr className="material-balances__row" key={`${transaction.type}:${transaction.id}`}>
                                                                <td className="material-balances__item"><strong>{material.itemName || material.category || '자재'}</strong><small>{material.spec || '규격 없음'} · {material.unit || '단위 미지정'}</small></td>
                                                                <td data-label="입고" className="is-number is-inbound">{transaction.type === 'inbound' ? formatQuantity(transaction.quantity) : '—'}</td>
                                                                <td data-label="출고" className="is-number is-outbound">{transaction.type === 'outbound' ? formatQuantity(transaction.quantity) : '—'}</td>
                                                                <td data-label="거래 후 잔량" className="is-number"><span className={`material-balances__quantity${balance < 0 ? ' is-negative' : ''}`}><strong>{formatQuantity(balance)}</strong><span>{material.unit}</span></span></td>
                                                                <td className="material-balances__evidence"><span>{transaction.vehicleNumber || '차량 미등록'}</span><MaterialTransactionPhotoButton row={transaction} onPhotos={onPhotos} /></td>
                                                            </tr>)}</tbody>
                                                        </table>
                                                        <p className="material-balances__date-note">잔량은 같은 자재·단위 기준이며, 같은 날은 입고 후 출고 순으로 계산합니다.</p>
                                                    </div>}
                                                </article>;
                                            })}
                                        </div>}
                                    </section>;
                                })}
                            </div>}
                        </section>;
                    })}
                </div>}
            </section>;
        })}
    </div>;
};

export default MaterialBalanceGroupList;
