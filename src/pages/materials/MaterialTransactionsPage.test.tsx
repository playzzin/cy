import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as XLSX from 'xlsx-js-style';
import materialService from '../../services/materialService';
import { siteService } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { settlementTargetService } from '../../services/settlementTargetService';
import MaterialTransactionsPage from './MaterialTransactionsPage';
import MaterialManagementPage from './MaterialManagementPage';
import MaterialOutboundCertificatePage from './MaterialOutboundCertificatePage';
import MaterialInboundCertificatePage from './MaterialInboundCertificatePage';

jest.mock('../../hooks/useMaterialAdministration', () => ({ useMaterialAdministration: () => true }));
jest.mock('../../contexts/SiteModeContext', () => ({ useSiteMode: () => ({ currentPosition: 'full' }) }));
jest.mock('../../services/materialService', () => ({ __esModule: true, default: {
    getUniqueMaterialsForSelection: jest.fn(), getInboundTransactions: jest.fn(), getOutboundTransactions: jest.fn(),
} }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/settlementTargetService', () => ({ settlementTargetService: { getTargets: jest.fn() } }));
jest.mock('xlsx-js-style', () => ({ ...jest.requireActual('xlsx-js-style'), writeFile: jest.fn() }));

const sites = [
    { id: 'a', name: '강남 현장', code: 'GN-01', status: 'active', companyName: '청연이엔지', clientCompanyId: 'c-a', clientCompanyName: '건설 A' },
    { id: 'b', name: '부산 현장', code: 'BS-01', status: 'active', companyName: '청연이엔지', clientCompanyId: 'c-b', clientCompanyName: '건설 B' },
    { id: 'c', name: '마감 현장', code: 'END-01', status: 'completed', companyName: '청연이엔지' },
    { id: 'd', name: '외부 현장', status: 'active', companyName: '다른회사' },
];
const material = { id: 'm', category: '동바리', itemName: '수직재', spec: 'P17', unit: 'EA' };
const transaction = (id: string, date: string, siteId: string, rentalId = '', rentalName = '') => ({
    ...material, id, materialId: 'm', transactionDate: date, siteId, siteName: sites.find(site => site.id === siteId)?.name,
    quantity: 1, rentalCompanyId: rentalId, rentalCompanyName: rentalName, vehicleNumber: '12가3456',
});
const inbounds = [
    transaction('before', '2026-11-01', 'a', 'rental-a', '검증 임대사'),
    transaction('start', '2026-11-02', 'a', 'rental-a', '검증 임대사'),
    transaction('legacy', '2026-11-03', 'a', '', '검증 임대사'),
    transaction('end', '2026-11-04', 'b', 'rental-b', '다른 임대사'),
    transaction('after', '2026-11-05', 'a'),
];
const outbounds = [
    transaction('out-start', '2026-11-02', 'a', 'rental-a', '검증 임대사'),
    transaction('unassigned', '2026-11-03', 'a'),
    transaction('completed', '2026-11-03', 'c', 'rental-a', '검증 임대사'),
    transaction('foreign', '2026-11-03', 'd', 'rental-a', '검증 임대사'),
];
type Filter = { startDate?: string; endDate?: string; siteId?: string; vehicleNumber?: string };
const applyServiceFilters = (rows: typeof inbounds, filters: Filter) => rows.filter(row =>
    (!filters.startDate || row.transactionDate >= filters.startDate) &&
    (!filters.endDate || row.transactionDate <= filters.endDate) && (!filters.siteId || row.siteId === filters.siteId) &&
    (!filters.vehicleNumber || row.vehicleNumber.includes(filters.vehicleNumber)));
const groups = () => screen.getAllByRole('article');
const dates = () => groups().map(group => group.getAttribute('aria-label')!.slice(0, 10));
const totalRows = () => Number(screen.queryByText(/^\d+일 · 상세 \d+건$/)?.textContent?.match(/상세 (\d+)건/)?.[1]);
const search = async () => {
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '조회' })).not.toBeDisabled());
};
const choose = (label: string, query: string, name: string | RegExp) => {
    const input = screen.getByRole('combobox', { name: label });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });
    fireEvent.click(screen.getByRole('option', { name }));
};
const openPage = async () => {
    render(<MemoryRouter><MaterialTransactionsPage /></MemoryRouter>);
    await waitFor(() => expect(totalRows()).toBe(7));
};

beforeEach(() => {
    jest.clearAllMocks();
    (siteService.getSites as jest.Mock).mockResolvedValue(sites);
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([material]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([
        { id: 'rental-a', name: '검증 임대사', type: '임대사' }, { id: 'rental-b', name: '다른 임대사', type: '임대사' },
        { id: 'c-a', name: '건설 A', type: '건설사' }, { id: 'c-b', name: '건설 B', type: '건설사' },
    ]);
    (settlementTargetService.getTargets as jest.Mock).mockResolvedValue([]);
    (materialService.getInboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters(inbounds, filters));
    (materialService.getOutboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters(outbounds, filters));
});

it('날짜 범위를 입고·출고 조회에 전달하고 경계 날짜 및 엑셀 결과에도 적용한다', async () => {
    await openPage();
    expect(screen.queryByRole('button', { name: '현장·날짜별 보기' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-11-04' } });
    await search();
    for (const service of [materialService.getInboundTransactions, materialService.getOutboundTransactions]) {
        expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2026-11-02', endDate: '2026-11-04' }));
    }
    expect(dates()).toEqual(['2026-11-04', '2026-11-03', '2026-11-02']);
    fireEvent.click(screen.getByRole('button', { name: 'Excel 다운로드' }));
    const book = (XLSX.writeFile as jest.Mock).mock.calls[0][0];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['입출고내역'], { header: 1 });
    expect(rows.slice(1).map(row => row[0])).toEqual(['2026-11-04', '2026-11-03', '2026-11-03', '2026-11-02', '2026-11-02']);
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-11-02' } });
    await search();
    expect(dates()).toEqual(['2026-11-02']);
});

it('현장을 한 검색 목록에서 선택하고 임대사·미지정·전체 조건을 조합한다', async () => {
    await openPage();
    expect(screen.queryByLabelText('현장명 검색')).not.toBeInTheDocument();
    choose('현장', '강남현', /^강남 현장/);
    choose('임대사', '검증임', '검증 임대사');
    await search();
    expect(materialService.getInboundTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 'a' }));
    expect(totalRows()).toBe(4); // Includes legacy rows linked by rental company name.
    choose('임대사', '미지정', '임대사 미지정');
    expect(totalRows()).toBe(2);
    choose('임대사', '전체', '전체 임대사');
    expect(totalRows()).toBe(6);
    choose('현장', '전체', '전체 현장');
    await search();
    expect(totalRows()).toBe(7);
});

it('잘못된 기간은 조회하지 않고 전체 기간·마감현장·입출고 구분으로 다시 조회한다', async () => {
    await openPage();
    const calls = (materialService.getInboundTransactions as jest.Mock).mock.calls.length;
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-11-02' } });
    await search();
    expect(screen.getByRole('alert')).toHaveTextContent('시작일은 종료일보다 늦을 수 없습니다.');
    expect(materialService.getInboundTransactions).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole('button', { name: '전체 기간' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-11-04' } });
    await search();
    expect(dates()).toEqual(['2026-11-05', '2026-11-04']);
    fireEvent.click(screen.getByRole('button', { name: '전체 기간' }));
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-11-02' } });
    await search();
    expect(dates()).toEqual(['2026-11-02', '2026-11-01']);
    fireEvent.click(screen.getByRole('button', { name: '전체 기간' }));
    choose('현장', '강남', /^강남 현장/);
    fireEvent.change(screen.getByLabelText('현장구분'), { target: { value: 'completed' } });
    expect(screen.getByRole('combobox', { name: '현장' })).toHaveValue('');
    choose('현장', '마감', /^마감 현장/);
    fireEvent.change(screen.getByLabelText('구분'), { target: { value: 'outbound' } });
    await search();
    expect(materialService.getOutboundTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: undefined, endDate: undefined, siteId: 'c' }));
    expect(totalRows()).toBe(1);
    expect(groups()[0]).toHaveTextContent('마감 현장');
});

it('사무실 자재관리 메뉴에서도 별도 현장·일자 탭을 제거한다', () => {
    render(<MemoryRouter initialEntries={['/materials/transactions']}><MaterialManagementPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /입출고 내역/ })).toHaveAttribute('href', '/materials/transactions');
    expect(screen.queryByRole('link', { name: /현장·일자/ })).not.toBeInTheDocument();
});

it('날짜로 묶은 요약에서 임대사·차량을 표시하고 검색 후에도 상세·선택·수정 기능을 유지한다', async () => {
    const sample = [
        { ...transaction('shared', '2026-11-08', 'a', 'rental-a', '검증 임대사'), spec: 'P17', materialId: 'spec1', photoUrls: ['https://example.test/photo.jpg'] },
        { ...transaction('second', '2026-11-08', 'b', 'rental-b', '다른 임대사'), spec: 'P18', materialId: 'spec2', vehicleNumber: '34나7890', quantity: 3, unit: 'SET' },
    ];
    (materialService.getInboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters(sample, filters));
    (materialService.getOutboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters([
        { ...transaction('shared', '2026-11-08', 'a', 'rental-a', '검증 임대사'), spec: 'P19', materialId: 'spec3' },
    ], filters));
    render(<MemoryRouter><MaterialTransactionsPage /></MemoryRouter>);
    const day = await screen.findByRole('article', { name: '2026-11-08 입출고' });
    expect(groups()).toHaveLength(1);
    expect(day).toHaveTextContent('입고 2건');
    expect(day).toHaveTextContent('출고 1건');
    for (const text of ['검증 임대사', '다른 임대사', '12가3456', '34나7890']) expect(day).toHaveTextContent(text);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(within(day).getByRole('button', { name: /현장 목록 펼치기/ }));
    expect(within(day).queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 강남 현장 입출고 펼치기' }));
    const detail = within(day).getByRole('table');
    expect(within(detail).getAllByRole('row')).toHaveLength(3);
    for (const spec of ['P17', 'P19']) expect(detail).toHaveTextContent(spec);
    expect(detail).not.toHaveTextContent('P18');
    fireEvent.click(within(day).getByLabelText('2026-11-08 내역 전체 선택'));
    expect(screen.getByText('선택 3건')).toBeInTheDocument();
    fireEvent.click(within(detail).getByLabelText('2026-11-08 강남 현장 입고 P17 선택'));
    expect(screen.getByText('선택 2건')).toBeInTheDocument();
    expect(within(day).getByLabelText('2026-11-08 내역 전체 선택')).toBePartiallyChecked();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 부산 현장 입출고 펼치기' }));
    expect(screen.getByRole('button', { name: '2026-11-08 강남 현장 입출고 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('table')).toHaveTextContent('P18');
    expect(screen.getByRole('table')).not.toHaveTextContent('P19');
    fireEvent.click(screen.getByLabelText('2026-11-08 부산 현장 내역 전체 선택'));
    expect(screen.getByText('선택 1건')).toBeInTheDocument();
    fireEvent.click(within(day).getByRole('button', { name: /현장 목록 접기/ }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    choose('임대사', '검증', '검증 임대사');
    expect(groups()).toHaveLength(1);
    expect(day).not.toHaveTextContent('34나7890');
    expect(totalRows()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 현장 목록 펼치기' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 강남 현장 입출고 펼치기' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    fireEvent.click(screen.getByTitle('첨부사진 보기'));
    await screen.findByRole('img', { name: /1/ });
    fireEvent.click(screen.getByRole('button', { name: '사진 창 닫기' }));
    fireEvent.click(within(screen.getByRole('table')).getAllByTitle('수정')[0]);
    expect(await screen.findByText('입고 내역 수정')).toBeInTheDocument();
});

it('차량번호로 검색해도 날짜별 요약과 조회된 상세만 표시한다', async () => {
    (materialService.getInboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters([
        transaction('one', '2026-11-08', 'a'),
        { ...transaction('two', '2026-11-08', 'a'), vehicleNumber: '34나7890' },
        transaction('three', '2026-11-07', 'a'),
    ], filters));
    (materialService.getOutboundTransactions as jest.Mock).mockResolvedValue([]);
    render(<MemoryRouter><MaterialTransactionsPage /></MemoryRouter>);
    await screen.findByRole('article', { name: '2026-11-08 입출고' });
    fireEvent.change(screen.getByLabelText('차량번호'), { target: { value: '7890' } });
    await search();
    expect(dates()).toEqual(['2026-11-08']);
    expect(totalRows()).toBe(1);
    expect(groups()[0]).toHaveTextContent('34나7890');
    expect(groups()[0]).not.toHaveTextContent('12가3456');
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 현장 목록 펼치기' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 강남 현장 입출고 펼치기' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '모두 접기' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('날짜 상세에서 출고만 현장·임대사·차량별 반출증으로 열고 수량과 주소를 표시한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue(sites.map(site => ({ ...site, address: '서울시 검증로 12' })));
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'rental-a', name: '검증 임대사', type: '임대사', address: '부산시 임대로 34' }]);
    (materialService.getOutboundTransactions as jest.Mock).mockResolvedValue([
        { ...transaction('one', '2026-11-08', 'a', 'rental-a', '검증 임대사'), quantity: 3, notes: '하차장 확인' },
        { ...transaction('two', '2026-11-08', 'a', 'rental-a', '검증 임대사'), quantity: 7, notes: ' 하차장 확인 ' },
        { ...transaction('other-car', '2026-11-08', 'a', 'rental-a', '검증 임대사'), vehicleNumber: '99나9999', quantity: 100 },
    ]);
    render(<MemoryRouter initialEntries={['/materials/transactions']}><Routes>
        <Route path="/materials/transactions" element={<MaterialTransactionsPage />} />
        <Route path="/materials/outbound-certificate" element={<MaterialOutboundCertificatePage />} />
    </Routes></MemoryRouter>);
    await screen.findByRole('article', { name: '2026-11-08 입출고' });
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 현장 목록 펼치기' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08 강남 현장 입출고 펼치기' }));
    const certificates = screen.getByRole('region', { name: '2026-11-08 강남 현장 증빙 및 비고' });
    expect(within(certificates).getAllByRole('button', { name: '반출증 보기' })).toHaveLength(2);
    expect(within(certificates).getAllByText('하차장 확인')).toHaveLength(1);
    expect(screen.getByRole('table')).not.toHaveTextContent('하차장 확인');
    expect(within(screen.getByRole('table')).queryByRole('button', { name: '반출증 보기' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByRole('columnheader', { name: '비고' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '2026-11-01 반출증' })).not.toBeInTheDocument();
    fireEvent.click(within(certificates).getAllByRole('button', { name: '반출증 보기' })[0]);
    expect(await screen.findByRole('heading', { name: '자재 반출증' })).toBeInTheDocument();
    expect(screen.getByText('서울시 검증로 12')).toBeInTheDocument();
    expect(screen.getByText('부산시 임대로 34')).toBeInTheDocument();
    expect(screen.getAllByRole('definition').map(item => item.textContent)).toEqual(expect.arrayContaining(['1개', '10']));
    expect(screen.queryByText('99나9999')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '반출증 저장' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '입출고 내역으로 돌아가기' }));
    expect(await screen.findByRole('article', { name: '2026-11-08 입출고' })).toBeInTheDocument();
});

it.each([
    ['일자별', 'inbound', '입고증'], ['일자별', 'outbound', '반출증'],
    ['건설사별', 'inbound', '입고증'], ['건설사별', 'outbound', '반출증'],
    ['임대사별', 'inbound', '입고증'], ['임대사별', 'outbound', '반출증'],
] as const)('%s에서 %s 거래의 %s를 같은 현장·임대사·차량의 전체 품목으로 연다', async (view, type, label) => {
    const sample = [
        { ...transaction('one', '2026-11-08', 'a', 'rental-a', '검증 임대사'), quantity: 3, notes: '수직재 확인' },
        { ...transaction('two', '2026-11-08', 'a', '', '검증임대사'), quantity: 7, materialId: 'hidden', spec: 'P99', notes: '숨긴 품목 메모' },
        { ...transaction('other-car', '2026-11-08', 'a', 'rental-a', '검증 임대사'), vehicleNumber: '99나9999', quantity: 100, notes: '다른 차량 메모' },
        { ...transaction('other-rental', '2026-11-08', 'a', 'rental-b', '다른 임대사'), quantity: 200 },
        { ...transaction('other-site', '2026-11-08', 'b', 'rental-a', '검증 임대사'), quantity: 300 },
    ];
    (materialService.getInboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters(type === 'inbound' ? sample : inbounds, filters));
    (materialService.getOutboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters(type === 'outbound' ? sample : outbounds, filters));
    render(<MemoryRouter initialEntries={['/materials/transactions']}><Routes>
        <Route path="/materials/transactions" element={<MaterialTransactionsPage />} />
        <Route path="/materials/inbound-certificate" element={<MaterialInboundCertificatePage />} />
        <Route path="/materials/outbound-certificate" element={<MaterialOutboundCertificatePage />} />
    </Routes></MemoryRouter>);
    await screen.findByRole('article', { name: '2026-11-08 입출고' });
    let table: HTMLElement;
    if (view === '일자별') {
        fireEvent.change(screen.getByLabelText('구분'), { target: { value: type } });
        await search();
        fireEvent.click(screen.getByRole('button', { name: '2026-11-08 현장 목록 펼치기' }));
        fireEvent.click(screen.getByRole('button', { name: '2026-11-08 강남 현장 입출고 펼치기' }));
        table = screen.getByRole('table');
    } else {
        // History intentionally excludes the target date. Grouped certificates
        // must use their own complete dataset, not the history search results.
        fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-11-01' } });
        await search();
        await openBalances(view);
        fireEvent.change(screen.getByRole('searchbox', { name: '품명·규격 검색' }), { target: { value: 'P17' } });
        table = openDay('강남 현장', '검증 임대사', '2026-11-08');
    }
    expect(table.textContent?.includes('P99')).toBe(view === '일자별');
    expect(within(table).queryByRole('button', { name: `${label} 보기` })).not.toBeInTheDocument();
    expect(table).not.toHaveTextContent('수직재 확인');
    const documents = screen.getByRole('region', { name: view === '일자별'
        ? '2026-11-08 강남 현장 증빙 및 비고' : '강남 현장 · 검증 임대사 · 2026-11-08 증빙 및 비고' });
    const document = within(documents).getByRole('group', { name: `${type === 'inbound' ? '입고' : '출고'} 검증 임대사 12가3456 증빙 및 비고` });
    expect(within(document).getAllByRole('button', { name: `${label} 보기` })).toHaveLength(1);
    expect(document).toHaveTextContent('수직재 확인');
    expect(document).toHaveTextContent('숨긴 품목 메모');
    expect(document).not.toHaveTextContent('다른 차량 메모');
    fireEvent.click(within(document).getByRole('button', { name: `${label} 보기` }));
    expect(await screen.findByRole('heading', { name: `자재 ${label}` })).toBeInTheDocument();
    expect(screen.getAllByRole('definition').map(item => item.textContent)).toEqual(expect.arrayContaining(['2개', '10']));
    expect(screen.getByRole('table')).toHaveTextContent('P99');
    expect(screen.queryByText('99나9999')).not.toBeInTheDocument();
    expect(screen.queryByText('부산 현장', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('다른 임대사', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${label} 저장` })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '입출고 내역으로 돌아가기' }));
    expect(await screen.findByRole('button', { name: '일자별' })).toBeInTheDocument();
});

const openBalances = async (view: '건설사별' | '임대사별' = '건설사별') => {
    fireEvent.click(screen.getByRole('button', { name: view }));
    fireEvent.change(screen.getByLabelText('기준일'), { target: { value: '2026-11-09' } });
    await screen.findByRole('region', { name: '현장·임대사별 입출고 묶음' });
};
const openBalancePath = (site: string, rental: string, construction = sites.find(row => row.name === site)?.clientCompanyName || '건설사 미지정') => {
    const isConstruction = screen.getByRole('button', { name: '건설사별' }).getAttribute('aria-pressed') === 'true';
    const path = isConstruction ? [construction, site, `${rental} 날짜별 입출고`] : [rental, construction, `${site} 날짜별 입출고`];
    path.forEach(name => {
        if (!screen.queryByRole('button', { name: `${name} 접기` })) fireEvent.click(screen.getByRole('button', { name: `${name} 펼치기` }));
    });
};
const openDay = (site: string, rental: string, date: string) => {
    openBalancePath(site, rental);
    fireEvent.click(screen.getByRole('button', { name: `${site} ${rental} ${date} 입출고 펼치기` }));
    return screen.getByRole('table', { name: `${site} · ${rental} · ${date} 입출고 내역` });
};

it('현장관리의 건설사 연결을 회사 마스터 이름으로 조회하고 건설사 필터를 양방향 조회에 유지한다', async () => {
    (companyService.getCompanies as jest.Mock).mockResolvedValue([
        { id: 'client-current', legacyId: 'c-a', name: '새이름건설', type: '건설사' },
        { id: 'c-b', name: '건설 B', type: '건설사' },
        { id: 'rental-a', name: '검증 임대사', type: '임대사' },
        { id: 'rental-b', name: '다른 임대사', type: '임대사' },
    ]);
    await openPage();
    await openBalances();
    openBalancePath('강남 현장', '검증 임대사', '새이름건설');
    expect(screen.getByRole('region', { name: '새이름건설 입출고 묶음' })).toHaveTextContent('강남 현장');
    expect(screen.queryByRole('region', { name: '청연이엔지 입출고 묶음' })).not.toBeInTheDocument();
    choose('현장', '부산', /^부산 현장/);
    choose('건설사', '새이름', '새이름건설');
    expect(screen.getByRole('combobox', { name: '현장' })).toHaveValue('');
    expect(screen.queryByRole('region', { name: '부산 현장 입출고 묶음' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '임대사별' }));
    expect(screen.getByRole('combobox', { name: '건설사' })).toHaveValue('새이름건설');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: '건설 B 건설사별 현장 묶음' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '입출고 엑셀' }));
    const book = (XLSX.writeFile as jest.Mock).mock.calls[0][0];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['날짜별입출고'], { header: 1 }).slice(1);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map(row => row[0]))).toEqual(new Set(['새이름건설']));
});

it('현장·임대사별 조회는 이전 기간·차량·구분과 무관하게 날짜별 전체 입출고를 표시한다', async () => {
    await openPage();
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-11-04' } });
    fireEvent.change(screen.getByLabelText('구분'), { target: { value: 'outbound' } });
    fireEvent.change(screen.getByLabelText('차량번호'), { target: { value: '없는차량' } });
    await search();
    await openBalances();
    for (const service of [materialService.getInboundTransactions, materialService.getOutboundTransactions]) {
        expect(service).toHaveBeenLastCalledWith({ endDate: '2026-11-09' });
    }
    openBalancePath('강남 현장', '검증 임대사');
    const group = screen.getByRole('region', { name: '강남 현장 입출고 묶음' });
    const rental = within(group).getByRole('region', { name: '검증 임대사 날짜별 입출고' });
    expect(within(rental).getAllByRole('article').map(article => article.getAttribute('aria-label')))
        .toEqual(['2026-11-03', '2026-11-02', '2026-11-01'].map(date => `강남 현장 · 검증 임대사 · ${date} 입출고`));
    expect(screen.queryByRole('region', { name: '외부 현장 입출고 묶음' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '마감 현장 입출고 묶음' })).not.toBeInTheDocument();
    const day = within(rental).getByRole('article', { name: /2026-11-02 입출고$/ });
    expect(day).toHaveTextContent('입고 1건');
    expect(day).toHaveTextContent('출고 1건');
    const table = openDay('강남 현장', '검증 임대사', '2026-11-02');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent)))
        .toEqual([
            ['수직재P17 · EA', '1', '—', '2EA', '12가3456'],
            ['수직재P17 · EA', '—', '1', '1EA', '12가3456'],
        ]);
    fireEvent.click(screen.getByRole('button', { name: '일자별' }));
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-11-04');
    expect(screen.getByLabelText('차량번호')).toHaveValue('없는차량');
});

it('현장·임대사·품목 필터를 날짜별 내역과 잔량 엑셀 두 시트에 적용한다', async () => {
    await openPage();
    await openBalances();
    choose('현장', '강남', /^강남 현장/);
    choose('임대사', '검증', '검증 임대사');
    openBalancePath('강남 현장', '검증 임대사');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '입출고 엑셀' }));
    const book = (XLSX.writeFile as jest.Mock).mock.calls[0][0];
    expect(book.SheetNames).toEqual(['날짜별입출고', '현장잔량']);
    const dailyRows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['날짜별입출고'], { header: 1 });
    expect(dailyRows.slice(1).map(row => row[3])).toEqual(['2026-11-03', '2026-11-02', '2026-11-02', '2026-11-01']);
    expect(dailyRows[1].slice(0, 12)).toEqual(['건설 A', '강남 현장', '검증 임대사', '2026-11-03', '입고', '동바리', '수직재', 'P17', 'EA', 1, '', 2]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['현장잔량'], { header: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(['2026-11-09', '건설 A', '강남 현장', '검증 임대사', '동바리', '수직재', 'P17', 'EA', 3, 1, 2, '']);
    fireEvent.change(screen.getByRole('searchbox', { name: '품명·규격 검색' }), { target: { value: '없는품목' } });
    expect(screen.getByText('조건에 맞는 자재가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '입출고 엑셀' })).toBeDisabled();
});

it('음수 잔량과 최종 잔량이 0인 미지정 자재의 날짜별 기록도 기본으로 포함한다', async () => {
    await openPage();
    await openBalances();
    expect(screen.getByLabelText('잔량 있는 자재만')).not.toBeChecked();
    fireEvent.change(screen.getByRole('combobox', { name: '현장구분' }), { target: { value: 'completed' } });
    expect(screen.getByRole('region', { name: '건설사 미지정 입출고 묶음' })).toBeInTheDocument();
    expect(screen.getByText(/출고가 입고보다 많은 항목이 1개/)).toBeInTheDocument();
    const negative = openDay('마감 현장', '검증 임대사', '2026-11-03');
    expect(within(negative).getAllByRole('cell')[3]).toHaveTextContent('-1EA');
    fireEvent.change(screen.getByRole('combobox', { name: '현장구분' }), { target: { value: 'active' } });
    choose('임대사', '미지정', '임대사 미지정');
    openBalancePath('강남 현장', '임대사 미지정');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const zero = openDay('강남 현장', '임대사 미지정', '2026-11-05');
    expect(within(zero).getAllByRole('cell')[3]).toHaveTextContent('0EA');
    expect(screen.getByText('임대사 확인 필요')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('잔량 있는 자재만'));
    expect(screen.getByText('조건에 맞는 자재가 없습니다')).toBeInTheDocument();
});

it('조회 실패 시 이전 날짜별 현황과 엑셀을 노출하지 않고 재시도로 복구한다', async () => {
    await openPage();
    await openBalances();
    (materialService.getOutboundTransactions as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('입출고 현황을 불러오지 못했습니다');
    expect(screen.queryByRole('region', { name: '현장·임대사별 입출고 묶음' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '입출고 엑셀' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('region', { name: '현장·임대사별 입출고 묶음' });
});

it('기준일 이전 누계는 보존하고 기준일 이후 날짜는 제외한다', async () => {
    await openPage();
    await openBalances();
    fireEvent.change(screen.getByLabelText('기준일'), { target: { value: '2026-11-02' } });
    await screen.findByRole('region', { name: '현장·임대사별 입출고 묶음' });
    openBalancePath('강남 현장', '검증 임대사');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const table = openDay('강남 현장', '검증 임대사', '2026-11-02');
    expect(within(table).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[3].textContent)).toEqual(['2EA', '1EA']);
    fireEvent.change(screen.getByLabelText('기준일'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('기준일을 선택');
    expect(screen.getByRole('button', { name: '입출고 엑셀' })).toBeDisabled();
});

it('건설사→현장→임대사→날짜와 임대사→건설사→현장→날짜를 전환해도 열린 날짜와 품목·사진을 유지한다', async () => {
    await openPage();
    const photoRow = { ...transaction('photo', '2026-11-06', 'a', 'rental-a', '검증 임대사'), photoUrls: ['https://example.test/photo.jpg'] };
    (materialService.getInboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters([
        ...inbounds,
        { ...transaction('shared-vendor', '2026-11-06', 'b', 'rental-a', '검증 임대사'), quantity: 5 },
        { ...transaction('other-vendor', '2026-11-06', 'a', 'rental-b', '다른 임대사'), quantity: 9 },
        photoRow,
    ], filters));
    await openBalances();
    openBalancePath('강남 현장', '검증 임대사');
    const constructionGroup = screen.getByRole('region', { name: '건설 A 입출고 묶음' });
    const siteGroup = within(constructionGroup).getByRole('region', { name: '강남 현장 입출고 묶음' });
    expect(siteGroup).toHaveTextContent('3개 임대사 구분');
    expect(within(siteGroup).getByRole('region', { name: '검증 임대사 날짜별 입출고' })).toBeInTheDocument();
    expect(within(siteGroup).getByRole('region', { name: '다른 임대사 날짜별 입출고' })).toBeInTheDocument();
    openDay('강남 현장', '검증 임대사', '2026-11-06');
    const calls = (materialService.getInboundTransactions as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '임대사별' }));
    const rentalGroup = screen.getByRole('region', { name: '검증 임대사 입출고 묶음' });
    expect(rentalGroup).toHaveTextContent('2개 건설사 구분');
    const constructionA = within(rentalGroup).getByRole('region', { name: '건설 A 건설사별 현장 묶음' });
    const constructionB = within(rentalGroup).getByRole('region', { name: '건설 B 건설사별 현장 묶음' });
    const gangnam = within(constructionA).getByRole('region', { name: '강남 현장 날짜별 입출고' });
    expect(within(gangnam).getByRole('button', { name: '강남 현장 검증 임대사 2026-11-06 입출고 접기' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(constructionB).getByRole('button', { name: '건설 B 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(constructionB).queryByRole('article')).not.toBeInTheDocument();
    expect(rentalGroup).not.toHaveTextContent('다른 임대사');
    expect(materialService.getInboundTransactions).toHaveBeenCalledTimes(calls);
    fireEvent.click(within(gangnam).getByRole('button', { name: '사진 보기' }));
    await screen.findByRole('img', { name: /1/ });
    fireEvent.click(screen.getByRole('button', { name: '사진 창 닫기' }));
    fireEvent.click(screen.getByRole('button', { name: '건설사별' }));
    expect(screen.getByRole('button', { name: '강남 현장 검증 임대사 2026-11-06 입출고 접기' })).toBeInTheDocument();
});

it('상단 임대사별에서 바로 조회하고 건설사별과 전환해도 조건과 엑셀 기준을 유지한다', async () => {
    await openPage();
    const views = within(screen.getByRole('group', { name: '보기 방식' }));
    expect(views.getAllByRole('button').map(button => button.textContent)).toEqual(['일자별', '건설사별', '임대사별']);
    await openBalances('임대사별');
    expect(views.getByRole('button', { name: '임대사별' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: '입출고 묶는 기준' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '검증 임대사 입출고 묶음' })).toBeInTheDocument();
    choose('현장', '강남', /^강남 현장/);
    choose('임대사', '검증', '검증 임대사');
    fireEvent.change(screen.getByRole('searchbox', { name: '품명·규격 검색' }), { target: { value: 'P17' } });
    fireEvent.click(screen.getByLabelText('잔량 있는 자재만'));
    fireEvent.click(views.getByRole('button', { name: '건설사별' }));
    expect(screen.getByRole('region', { name: '건설 A 입출고 묶음' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '임대사별' }));
    expect(screen.getByRole('combobox', { name: '현장' })).toHaveValue('강남 현장');
    expect(screen.getByRole('combobox', { name: '임대사' })).toHaveValue('검증 임대사');
    expect(screen.getByRole('searchbox', { name: '품명·규격 검색' })).toHaveValue('P17');
    expect(screen.getByLabelText('기준일')).toHaveValue('2026-11-09');
    expect(screen.getByLabelText('잔량 있는 자재만')).toBeChecked();
    openBalancePath('강남 현장', '검증 임대사');
    expect(screen.getByRole('region', { name: '검증 임대사 입출고 묶음' })).toHaveTextContent('1개 현장');
    fireEvent.click(screen.getByRole('button', { name: '입출고 엑셀' }));
    const [book, filename] = (XLSX.writeFile as jest.Mock).mock.calls[0];
    expect(filename).toBe('임대사별_건설사별_현장별_입출고_2026-11-09.xlsx');
    expect(XLSX.utils.sheet_to_json(book.Sheets['날짜별입출고'])).toHaveLength(4);
});

it('건설사·현장·임대사·날짜는 같은 단계에서 하나만 열리고 접힌 거래도 엑셀에 포함한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue([...sites, { ...sites[0], id: 'e', name: '수원 현장' }]);
    await openPage();
    (materialService.getInboundTransactions as jest.Mock).mockImplementation(async filters => applyServiceFilters([
        ...inbounds,
        transaction('same-builder', '2026-11-07', 'e', 'rental-a', '검증 임대사'),
        transaction('shared-vendor', '2026-11-06', 'b', 'rental-a', '검증 임대사'),
        transaction('other-vendor', '2026-11-06', 'a', 'rental-b', '다른 임대사'),
    ], filters));
    await openBalances();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /모두 펼치기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '건설 A 펼치기' })).toHaveAttribute('aria-expanded', 'false');

    openDay('강남 현장', '검증 임대사', '2026-11-02');
    openDay('강남 현장', '검증 임대사', '2026-11-03');
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '강남 현장 검증 임대사 2026-11-02 입출고 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: '강남 현장 검증 임대사 2026-11-03 입출고 접기' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다른 임대사 날짜별 입출고 펼치기' }));
    expect(screen.getByRole('button', { name: '검증 임대사 날짜별 입출고 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '수원 현장 펼치기' }));
    expect(screen.getByRole('button', { name: '강남 현장 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검증 임대사 날짜별 입출고 펼치기' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '건설 B 펼치기' }));
    expect(screen.getByRole('button', { name: '건설 A 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: '수원 현장 입출고 묶음' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '임대사별' }));
    openBalancePath('강남 현장', '검증 임대사');
    fireEvent.click(screen.getByRole('button', { name: '수원 현장 날짜별 입출고 펼치기' }));
    expect(screen.getByRole('button', { name: '강남 현장 날짜별 입출고 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '건설 B 펼치기' }));
    expect(screen.getByRole('button', { name: '건설 A 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '부산 현장 날짜별 입출고 펼치기' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '다른 임대사 펼치기' }));
    expect(screen.getByRole('button', { name: '검증 임대사 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '모두 접기' }));
    expect(screen.getByRole('button', { name: '다른 임대사 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '모두 접기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '입출고 엑셀' }));
    const book = (XLSX.writeFile as jest.Mock).mock.calls[0][0];
    expect(XLSX.utils.sheet_to_json(book.Sheets['날짜별입출고'])).toHaveLength(10);
});

it('일자별은 날짜와 현장을 하나씩 펼치며 다른 날짜를 열어도 선택한 거래를 유지한다', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-03 현장 목록 펼치기' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-11-03 강남 현장 입출고 펼치기' }));
    fireEvent.click(screen.getByLabelText('2026-11-03 내역 전체 선택'));
    expect(screen.getByText('선택 2건')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-02 현장 목록 펼치기' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-02 강남 현장 입출고 펼치기' }));
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('table', { name: '2026-11-02 강남 현장 입출고 내역' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026-11-03 현장 목록 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('선택 2건')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-02 현장 목록 접기' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '모두 펼치기' })).not.toBeInTheDocument();
});

it('같은 날짜의 동명 현장을 ID로 구분하고 현장별 선택·상세가 서로 섞이지 않는다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue(sites.map(site => ({ ...site, name: '동명 현장' })));
    (materialService.getInboundTransactions as jest.Mock).mockResolvedValue([
        { ...transaction('site-a', '2026-11-06', 'a'), siteName: '동명 현장', quantity: 3 },
        { ...transaction('site-b', '2026-11-06', 'b'), siteName: '동명 현장', quantity: 7 },
    ]);
    (materialService.getOutboundTransactions as jest.Mock).mockResolvedValue([]);
    render(<MemoryRouter><MaterialTransactionsPage /></MemoryRouter>);
    await screen.findByRole('article', { name: '2026-11-06 입출고' });
    expect(screen.getByRole('button', { name: '일자별' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '2026-11-06 현장 목록 펼치기' }));
    const siteGroups = screen.getAllByRole('region', { name: '2026-11-06 동명 현장 현장' });
    expect(siteGroups).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(within(siteGroups[0]).getByRole('button', { name: /입출고 펼치기/ }));
    expect(within(screen.getByRole('table')).getAllByRole('cell')[4]).toHaveTextContent('3');
    fireEvent.click(within(siteGroups[0]).getByLabelText('2026-11-06 동명 현장 내역 전체 선택'));
    expect(screen.getByText('선택 1건')).toBeInTheDocument();
    fireEvent.click(within(siteGroups[1]).getByRole('button', { name: /입출고 펼치기/ }));
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(within(screen.getByRole('table')).getAllByRole('cell')[4]).toHaveTextContent('7');
    expect(within(siteGroups[0]).getByRole('button', { name: /입출고 펼치기/ })).toHaveAttribute('aria-expanded', 'false');
    expect(within(siteGroups[0]).getByLabelText('2026-11-06 동명 현장 내역 전체 선택')).toBeChecked();
    expect(within(siteGroups[1]).getByLabelText('2026-11-06 동명 현장 내역 전체 선택')).not.toBeChecked();
    expect(screen.getByLabelText('2026-11-06 내역 전체 선택')).toBePartiallyChecked();
});
