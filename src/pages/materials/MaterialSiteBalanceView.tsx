import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import materialService from '../../services/materialService';
import type { Site } from '../../services/siteService';
import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import MaterialSearchSelect from './MaterialSearchSelect';
import { filterSitesByMaterialStatus, getSiteStatusLabel, MaterialSiteStatusFilter } from './materialSiteFilters';
import MaterialBalanceGroupList from './MaterialBalanceGroupList';
import {
    buildMaterialBalanceExcelRows, buildMaterialDailyExcelRows, buildMaterialSiteBalances, flattenMaterialBalanceGroups, groupMaterialBalances,
    MATERIAL_BALANCE_EXCEL_HEADERS, MATERIAL_DAILY_EXCEL_HEADERS, MaterialBalanceGrouping, UNASSIGNED_BALANCE_RENTAL,
} from './materialBalanceSummary';
import './MaterialSiteBalances.css';

interface Props {
    active: boolean;
    grouping: MaterialBalanceGrouping;
    sites: Site[];
    rentalCompanies: MaterialRentalCompanyOption[];
    initialSiteId: string;
    initialSiteStatus: MaterialSiteStatusFilter;
    initialRentalCompany: string;
    onPhotos: (row: MaterialTransactionRow) => void;
    onCertificate: (row: MaterialTransactionRow, sourceRows: MaterialTransactionRow[]) => void;
}

const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const MaterialSiteBalanceView: React.FC<Props> = ({ active, grouping, sites, rentalCompanies, initialSiteId, initialSiteStatus, initialRentalCompany, onPhotos, onCertificate }) => {
    const [siteId, setSiteId] = useState(initialSiteId);
    const [siteStatus, setSiteStatus] = useState(initialSiteStatus);
    const [constructionKey, setConstructionKey] = useState('');
    const [rentalKey, setRentalKey] = useState(initialRentalCompany === '__rental_unassigned__'
        ? UNASSIGNED_BALANCE_RENTAL : initialRentalCompany ? `id:${initialRentalCompany}` : '');
    const [asOfDate, setAsOfDate] = useState(today);
    const [search, setSearch] = useState('');
    const [nonzeroOnly, setNonzeroOnly] = useState(false);
    const [data, setData] = useState<{ date: string; rows: MaterialTransactionRow[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        setError('');
        setData(null);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        // A balance uses all history through the cutoff. Never inherit the history
        // view's start date, vehicle or inbound/outbound-only filters.
        Promise.all([
            materialService.getInboundTransactions({ endDate: asOfDate }),
            materialService.getOutboundTransactions({ endDate: asOfDate }),
        ]).then(([inbound, outbound]) => {
            if (cancelled) return;
            setData({ date: asOfDate, rows: [
                ...inbound.map(row => ({ ...row, type: 'inbound' as const })),
                ...outbound.map(row => ({ ...row, type: 'outbound' as const })),
            ] });
        }).catch(() => {
            if (!cancelled) setError('입출고 현황을 불러오지 못했습니다. 다시 시도해 주세요.');
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [active, asOfDate, refresh]);

    const balances = useMemo(() => {
        const siteById = new Map(sites.map(site => [site.id, site]));
        return buildMaterialSiteBalances((data?.rows || [])
            .filter(row => siteById.has(row.siteId))
            .map(row => ({ ...row, siteName: siteById.get(row.siteId)?.name || row.siteName })), rentalCompanies, data?.date || '', sites);
    }, [data, sites, rentalCompanies]);
    const constructionOptions = Array.from(new Map(balances.map(row => [row.constructionKey, { id: row.constructionKey, name: row.constructionName }])).values())
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const constructionSiteIds = new Set(balances.filter(row => row.constructionKey === constructionKey).map(row => row.siteId));
    const filteredSites = filterSitesByMaterialStatus(sites, siteStatus).filter(site => !constructionKey || constructionSiteIds.has(site.id || ''));
    const siteIds = new Set(filteredSites.map(site => site.id));
    const siteBalances = balances.filter(row => siteIds.has(row.siteId) && (!siteId || row.siteId === siteId));
    const rentalOptions = Array.from(new Map([
        ...rentalCompanies.map(company => [`id:${company.id}`, { id: `id:${company.id}`, name: company.name }] as const),
        ...balances.map(row => [row.rentalKey, { id: row.rentalKey, name: row.rentalName }] as const),
        [UNASSIGNED_BALANCE_RENTAL, { id: UNASSIGNED_BALANCE_RENTAL, name: '임대사 미지정' }] as const,
    ]).values());
    const normalizedSearch = search.replace(/\s+/g, '').toLowerCase();
    const visibleRows = siteBalances.filter(row => (!rentalKey || row.rentalKey === rentalKey)
        && (!nonzeroOnly || row.balance !== 0)
        && [row.category, row.itemName, row.spec].join('').replace(/\s+/g, '').toLowerCase().includes(normalizedSearch));
    const ready = !loading && !error && !!data && data.date === asOfDate;
    const negativeCount = visibleRows.filter(row => row.balance < 0).length;
    const balanceGroups = groupMaterialBalances(visibleRows, grouping);
    const transactionCount = visibleRows.reduce((count, row) => count + row.transactions.length, 0);

    const download = () => {
        if (!ready) return;
        const orderedRows = flattenMaterialBalanceGroups(balanceGroups);
        const sheet = XLSX.utils.aoa_to_sheet([MATERIAL_BALANCE_EXCEL_HEADERS, ...buildMaterialBalanceExcelRows(orderedRows, asOfDate)]);
        sheet['!cols'] = [12, 22, 24, 22, 12, 18, 18, 8, 12, 12, 12, 26].map(wch => ({ wch }));
        sheet['!autofilter'] = { ref: `A1:L${visibleRows.length + 1}` };
        const book = XLSX.utils.book_new();
        const dailyRows = buildMaterialDailyExcelRows(balanceGroups);
        const dailySheet = XLSX.utils.aoa_to_sheet([MATERIAL_DAILY_EXCEL_HEADERS, ...dailyRows]);
        dailySheet['!cols'] = [22, 24, 22, 12, 8, 12, 18, 18, 8, 12, 12, 16, 16, 30].map(wch => ({ wch }));
        dailySheet['!autofilter'] = { ref: `A1:N${dailyRows.length + 1}` };
        XLSX.utils.book_append_sheet(book, dailySheet, '날짜별입출고');
        XLSX.utils.book_append_sheet(book, sheet, '현장잔량');
        XLSX.writeFile(book, `${grouping === 'site' ? '건설사별_현장별_임대사별' : '임대사별_건설사별_현장별'}_입출고_${asOfDate}.xlsx`);
    };

    return <section className="material-balances" aria-label="현장별 임대사별 입출고 현황">
        <div className="material-panel material-balances__filters">
            <div className="material-balances__filter-grid">
                <div><label htmlFor="balance-construction">건설사</label>
                    <MaterialSearchSelect id="balance-construction" label="건설사" value={constructionKey}
                        onChange={value => { setConstructionKey(value); setSiteId(''); }} options={constructionOptions}
                        placeholder="전체 건설사 · 검색" emptyOptionLabel="전체 건설사" /></div>
                <div><label htmlFor="balance-site-status">현장구분</label>
                    <select id="balance-site-status" value={siteStatus} onChange={event => { setSiteStatus(event.target.value as MaterialSiteStatusFilter); setSiteId(''); }}>
                        <option value="active">진행현장</option><option value="completed">마감현장</option><option value="all">전체현장</option>
                    </select></div>
                <div><label htmlFor="balance-site">현장</label>
                    <MaterialSearchSelect id="balance-site" label="현장" value={siteId}
                        onChange={value => { setSiteId(value); }}
                        options={filteredSites.map(site => ({ id: site.id, name: site.name, description: getSiteStatusLabel(site.status) }))}
                        placeholder="전체 현장 · 검색" emptyOptionLabel="전체 현장" /></div>
                <div><label htmlFor="balance-rental">임대사</label>
                    <MaterialSearchSelect id="balance-rental" label="임대사" value={rentalKey}
                        onChange={value => { setRentalKey(value); }} options={rentalOptions}
                        placeholder="전체 임대사 · 검색" emptyOptionLabel="전체 임대사" /></div>
                <div><label htmlFor="balance-date">기준일</label>
                    <input id="balance-date" type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} /></div>
            </div>
            <p className="material-balances__hint">기준일까지 등록된 입출고를 날짜별로 확인합니다. 거래 후 잔량은 누적 입고 − 출고이며, 현장 실사 수량과 다를 수 있습니다.</p>
        </div>
        <div className="material-balances__toolbar">
            <input type="search" aria-label="품명·규격 검색" placeholder="품명·규격 검색" value={search} onChange={event => setSearch(event.target.value)} />
            <label className="material-balances__checkbox"><input type="checkbox" checked={nonzeroOnly} onChange={event => setNonzeroOnly(event.target.checked)} />잔량 있는 자재만</label>
            <div className="material-balances__actions">
                <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading || !asOfDate}><RefreshCw size={15} />새로고침</button>
                <button type="button" onClick={download} disabled={!ready || visibleRows.length === 0}><Download size={15} />입출고 엑셀</button>
            </div>
        </div>
        {!asOfDate ? <p role="alert" className="material-balances__empty">입출고를 확인할 기준일을 선택해 주세요.</p>
            : error ? <div role="alert" className="material-balances__empty"><p>{error}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>다시 시도</button></div>
                : !ready ? <p role="status" className="material-balances__empty">입출고 현황을 불러오고 있습니다…</p>
                    : <>
                        <div className="material-balances__summary" aria-live="polite">
                            <p><strong>{balanceGroups.length}{grouping === 'site' ? '개 건설사 구분' : '개 임대사 구분'}</strong><span> · </span>입출고 {transactionCount}건</p>
                            <span>{asOfDate}까지 · 날짜를 펼쳐 품목별 내역 확인</span>
                        </div>
                        {negativeCount > 0 && <p className="material-balances__warning">출고가 입고보다 많은 항목이 {negativeCount}개 있습니다. 입고 누락이나 임대사 연결을 확인해 주세요.</p>}
                        {visibleRows.length === 0 ? <div className="material-balances__empty"><strong>조건에 맞는 자재가 없습니다</strong><p>현장·임대사를 바꾸거나 ‘잔량 있는 자재만’을 해제해 보세요.</p></div>
                            : <MaterialBalanceGroupList groups={balanceGroups} grouping={grouping} onPhotos={onPhotos}
                                sourceRows={data?.rows || []} rentalCompanies={rentalCompanies}
                                onCertificate={row => onCertificate(row, data?.rows || [])} />}
                    </>}
    </section>;
};

export default MaterialSiteBalanceView;
