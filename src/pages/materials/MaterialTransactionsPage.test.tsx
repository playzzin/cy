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
    { id: 'a', name: '강남 현장', code: 'GN-01', status: 'active', companyName: '청연이엔지' },
    { id: 'b', name: '부산 현장', code: 'BS-01', status: 'active', companyName: '청연이엔지' },
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
    fireEvent.click(within(day).getByRole('button', { name: /상세 내역 펼치기/ }));
    const detail = within(day).getByRole('table');
    expect(within(detail).getAllByRole('row')).toHaveLength(4);
    for (const spec of ['P17', 'P18', 'P19']) expect(detail).toHaveTextContent(spec);
    fireEvent.click(within(day).getByLabelText('2026-11-08 내역 전체 선택'));
    expect(screen.getByText('선택 3건')).toBeInTheDocument();
    fireEvent.click(within(detail).getByLabelText('2026-11-08 입고 P17 선택'));
    expect(screen.getByText('선택 2건')).toBeInTheDocument();
    expect(within(day).getByLabelText('2026-11-08 내역 전체 선택')).toBePartiallyChecked();
    fireEvent.click(within(day).getByRole('button', { name: /상세 내역 접기/ }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    choose('임대사', '검증', '검증 임대사');
    expect(groups()).toHaveLength(1);
    expect(day).not.toHaveTextContent('34나7890');
    expect(totalRows()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: '모두 펼치기' }));
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
    fireEvent.click(screen.getByRole('button', { name: '모두 펼치기' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '모두 접기' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('날짜 상세에서 출고만 현장·임대사·차량별 반출증으로 열고 수량과 주소를 표시한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue(sites.map(site => ({ ...site, address: '서울시 검증로 12' })));
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'rental-a', name: '검증 임대사', type: '임대사', address: '부산시 임대로 34' }]);
    (materialService.getOutboundTransactions as jest.Mock).mockResolvedValue([
        { ...transaction('one', '2026-11-08', 'a', 'rental-a', '검증 임대사'), quantity: 3 },
        { ...transaction('two', '2026-11-08', 'a', 'rental-a', '검증 임대사'), quantity: 7 },
        { ...transaction('other-car', '2026-11-08', 'a', 'rental-a', '검증 임대사'), vehicleNumber: '99나9999', quantity: 100 },
    ]);
    render(<MemoryRouter initialEntries={['/materials/transactions']}><Routes>
        <Route path="/materials/transactions" element={<MaterialTransactionsPage />} />
        <Route path="/materials/outbound-certificate" element={<MaterialOutboundCertificatePage />} />
    </Routes></MemoryRouter>);
    await screen.findByRole('article', { name: '2026-11-08 입출고' });
    fireEvent.click(screen.getByRole('button', { name: '모두 펼치기' }));
    const certificates = screen.getByRole('region', { name: '2026-11-08 반출증' });
    expect(within(certificates).getAllByRole('button', { name: '반출증 보기' })).toHaveLength(2);
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
