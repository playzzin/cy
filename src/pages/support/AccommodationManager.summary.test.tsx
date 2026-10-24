import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccommodationManager from './AccommodationManager';
import { accommodationService } from '../../services/accommodationService';
import { teamService } from '../../services/teamService';
import { rememberSupportManagementYearMonth } from '../../utils/supportManagementState';
import { buildAccommodationStatusWorkbook, downloadAccommodationWorkbook } from '../../utils/accommodationExcelExport';
import type { Accommodation } from '../../types/accommodation';

jest.mock('sweetalert2', () => ({ fire: jest.fn() }));
jest.mock('../../utils/accommodationExcelExport', () => ({
    buildAccommodationStatusWorkbook: jest.fn(() => ({})),
    downloadAccommodationWorkbook: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    onSnapshot: (_ref: unknown, callback: (snapshot: unknown) => void) => {
        callback({ exists: () => true, data: () => ({ role: 'admin' }) });
        return () => undefined;
    },
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-admin' } }) }));
jest.mock('../../services/menuServiceV11', () => ({
    menuServiceV11: { subscribe: (callback: (config: unknown) => void) => { callback({}); return () => undefined; } },
}));
jest.mock('../../services/userMenuPositionService', () => ({
    userMenuPositionService: { getPositions: () => [], subscribe: () => () => undefined },
}));
jest.mock('../../utils/menuAccess', () => ({ buildMenuAccessRoles: () => ['admin'], canAccessMenuRoute: () => true }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkerByUid: async () => null } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaffByUid: async () => null } }));
jest.mock('../../services/accommodationService', () => ({ accommodationService: {
    listAllAccommodations: jest.fn(), getAssignments: jest.fn(), getMonthlyLedger: jest.fn(),
} }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/accommodationBillingTargetService', () => ({ accommodationBillingTargetService: { listTargets: async () => [] } }));
jest.mock('../../services/accommodationAssignmentService', () => ({ accommodationAssignmentService: {} }));
jest.mock('../../services/supportCancellationLogService', () => ({ supportCancellationLogService: {} }));
jest.mock('../../components/accommodation/AccommodationForm', () => () => null);
jest.mock('../../components/accommodation/QuickAssignmentModal', () => () => null);
jest.mock('../../components/accommodation/UtilityLedger', () => () => null);
jest.mock('../../components/support/SupportCancellationHistory', () => ({ SupportCancellationHistory: () => null }));
jest.mock('../../components/support/SupportCancellationModal', () => ({ SupportCancellationModal: () => null }));

const room = (id: string, rent: number, deposit: number, overrides: Partial<Accommodation> = {}): Accommodation => ({
    id, name: `시험숙소 ${id}`, address: '시험주소', type: 'OneRoom', status: 'active', ownership: 'Cheongyeon',
    contract: { startDate: '2026-01-01', endDate: '2030-12-31', monthlyRent: rent, deposit,
        paymentDay: 1, landlordName: '', landlordContact: '', isReported: false },
    costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'included', maintenance: 'variable' },
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(buildAccommodationStatusWorkbook).mockReturnValue({} as ReturnType<typeof buildAccommodationStatusWorkbook>);
    jest.mocked(downloadAccommodationWorkbook).mockResolvedValue(undefined);
    window.localStorage.clear();
    window.sessionStorage.setItem('cy.support-management.year-month', '2026-09');
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
    jest.mocked(accommodationService.listAllAccommodations).mockResolvedValue([
        room('운영', 500000, 1000000),
        room('조기종료', 650000, 5000000, { status: 'inactive' }),
        room('개인', 400000, 2000000, { ownership: 'Individual' }),
        room('다원', 350000, 3000000, { ownership: 'Dawon' }),
    ]);
    jest.mocked(accommodationService.getAssignments).mockResolvedValue([]);
    jest.mocked(accommodationService.getMonthlyLedger).mockResolvedValue([]);
    jest.mocked(teamService.getTeams).mockResolvedValue([]);
});

async function renderPage() {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccommodationManager /></MemoryRouter>);
    await screen.findByRole('heading', { name: '1,250,000' });
}

function expectSummaries(rent: number, deposit: number, companyRent: number) {
    const rentCard = screen.getByRole('region', { name: '월세 요약' });
    expect(within(rentCard).getByRole('heading')).toHaveTextContent(rent.toLocaleString());
    const depositCard = screen.getByRole('region', { name: '보증금 요약' });
    expect(within(depositCard).getByRole('heading')).toHaveTextContent(deposit.toLocaleString());
    const ownershipRents = screen.getByLabelText('명의별 월세 지출액');
    expect(within(ownershipRents).getAllByRole('definition')[0]).toHaveTextContent(`${companyRent.toLocaleString()}원`);
    const bottom = screen.getByRole('region', { name: '명의별 현황 요약' });
    const totals = within(bottom).getByRole('group', { name: '전체 합계' });
    expect(totals).toHaveTextContent(`총 고정비 (월세)${rent.toLocaleString()}원`);
    expect(totals).toHaveTextContent(`총 예치 보증금${deposit.toLocaleString()}원`);
    expect(within(bottom).getByRole('group', { name: '청연' })).toHaveTextContent(`${companyRent.toLocaleString()}원 / 월`);
}

it('계약만료일이 남은 종료 숙소를 운영 중 합계에서 제외하고 상하단을 일치시킨다', async () => {
    // Wait for loading independently of the expected result so this test also
    // reaches its assertions on the old, incorrectly inflated summary.
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccommodationManager /></MemoryRouter>);
    await screen.findByRole('heading', { name: '명의별 현황 요약 (2026-09 · 운영 중)' });
    await waitFor(() => expectSummaries(1250000, 6000000, 500000));
    expect(screen.getByText('2026-09 조회 숙소의 계약 월세 기준')).toBeInTheDocument();
});

it('전체와 보관/종료 상태 필터에서도 상하단 합계가 조회 목록을 따른다', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: '전체 4호' }));
    expectSummaries(1900000, 11000000, 1150000);
    fireEvent.click(screen.getByRole('button', { name: '보관/종료 1호' }));
    expectSummaries(650000, 5000000, 650000);
});

it('검색 결과와 빈 결과의 월세·보증금·명의별 합계가 모두 일치한다', async () => {
    await renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: '숙소 검색' }), { target: { value: '개인' } });
    expectSummaries(400000, 2000000, 0);
    fireEvent.change(screen.getByRole('textbox', { name: '숙소 검색' }), { target: { value: '없는숙소' } });
    expectSummaries(0, 0, 0);
    expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
});

it('8월 엑셀에는 사용 종료 65만원과 9월 시작 45만원 숙소가 들어가지 않는다', async () => {
    const september = room('9월신규', 450000, 5000000);
    september.contract.startDate = '2026-09-12';
    jest.mocked(accommodationService.listAllAccommodations).mockResolvedValue([
        room('운영', 500000, 1000000),
        room('조기종료', 650000, 5000000, { status: 'inactive' }), september,
    ]);
    window.sessionStorage.setItem('cy.support-management.year-month', '2026-08');
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccommodationManager /></MemoryRouter>);
    const download = await screen.findByRole('button', { name: '엑셀 다운로드' });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    await waitFor(() => expect(downloadAccommodationWorkbook).toHaveBeenCalledWith({}, '숙소_배정경비현황_2026-08.xlsx'));
    const options = jest.mocked(buildAccommodationStatusWorkbook).mock.calls[0][0];
    expect(options.yearMonth).toBe('2026-08');
    expect(options.rows.map(row => row.accommodation.id)).toEqual(['운영']);
    expect(options.rows[0]).toMatchObject({ rent: 500000, deposit: 1000000 });
    expectSummaries(500000, 1000000, 500000);
});

it('검색으로 좁힌 목록만 엑셀의 공통 집계에 전달한다', async () => {
    await renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: '숙소 검색' }), { target: { value: '개인' } });
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    await waitFor(() => expect(buildAccommodationStatusWorkbook).toHaveBeenCalledTimes(1));
    const options = jest.mocked(buildAccommodationStatusWorkbook).mock.calls[0][0];
    expect(options.searchText).toBe('개인');
    expect(options.rows.map(row => row.accommodation.id)).toEqual(['개인']);
    expect(options.rows[0]).toMatchObject({ rent: 400000, deposit: 2000000 });
    await waitFor(() => expect(downloadAccommodationWorkbook).toHaveBeenCalledTimes(1));
});

it('팀 필터는 현재 팀이 아니라 조회월에 유효했던 배정을 따른다', async () => {
    jest.mocked(teamService.getTeams).mockResolvedValue([{ id: 'team-a', name: '시험팀', companyName: '청연ENG' } as any]);
    jest.mocked(accommodationService.getAssignments).mockResolvedValue([
        { accommodationId: '운영', workerId: 'current', teamId: 'team-a', teamName: '시험팀', status: 'active', startDate: '2020-01-01' },
        { accommodationId: '개인', workerId: 'previous', teamId: 'team-a', teamName: '시험팀', status: 'ended', startDate: '2026-01-01', endDate: '2026-09-30' },
    ]);
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: '팀별 보기: 시험팀' }));
    expectSummaries(900000, 3000000, 500000);
    act(() => rememberSupportManagementYearMonth('2026-08'));
    await waitFor(() => expect(accommodationService.getMonthlyLedger).toHaveBeenLastCalledWith('2026-08'));
    await waitFor(() => expectSummaries(900000, 3000000, 500000));
    act(() => rememberSupportManagementYearMonth('2026-10'));
    await waitFor(() => expectSummaries(500000, 1000000, 500000));
});

it('9월 12일 시작한 숙소의 월세·보증금을 6~8월에서 제외하고 9월부터 함께 반영한다', async () => {
    const septemberRoom = room('9월신규', 450000, 5000000);
    septemberRoom.contract.startDate = '2026-09-12';
    jest.mocked(accommodationService.listAllAccommodations).mockResolvedValue([
        room('기존', 500000, 1000000), septemberRoom,
    ]);
    // Even a stale ledger row cannot put the room before its contract start.
    jest.mocked(accommodationService.getMonthlyLedger).mockImplementation(async yearMonth => [{
        id: 'stale', accommodationId: septemberRoom.id, accommodationName: septemberRoom.name, yearMonth,
        costs: { rent: 450000, electricity: 0, gas: 0, water: 0, internet: 0, maintenance: 0, other: 0, total: 450000 },
        paymentStatus: 'unpaid',
    }]);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccommodationManager /></MemoryRouter>);
    await waitFor(() => expectSummaries(950000, 6000000, 950000));
    for (const month of ['2026-08', '2026-07', '2026-06']) {
        act(() => rememberSupportManagementYearMonth(month));
        await waitFor(() => expectSummaries(500000, 1000000, 500000));
        expect(screen.queryByText(septemberRoom.name)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '운영 중 1호' })).toBeInTheDocument();
    }
    for (const month of ['2026-09', '2026-10']) {
        act(() => rememberSupportManagementYearMonth(month));
        await waitFor(() => expectSummaries(950000, 6000000, 950000));
        expect(screen.getByText(septemberRoom.name)).toBeInTheDocument();
    }
});

it('계약 종료 다음 달부터 목록·상하단 집계에서 제외한다', async () => {
    const ended = room('9월만료', 450000, 5000000);
    ended.contract.endDate = '2026-09-12';
    jest.mocked(accommodationService.listAllAccommodations).mockResolvedValue([ended]);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccommodationManager /></MemoryRouter>);
    await waitFor(() => expectSummaries(450000, 5000000, 450000));
    act(() => rememberSupportManagementYearMonth('2026-10'));
    await waitFor(() => expectSummaries(0, 0, 0));
    expect(screen.queryByText(ended.name)).not.toBeInTheDocument();
});

it('시작일 미입력 숙소는 임의로 날짜를 추정하지 않고 확인 필요 건수를 표시한다', async () => {
    const unknownStart = room('날짜미상', 450000, 5000000);
    unknownStart.contract.startDate = '';
    jest.mocked(accommodationService.listAllAccommodations).mockResolvedValue([unknownStart]);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccommodationManager /></MemoryRouter>);
    await waitFor(() => expectSummaries(450000, 5000000, 450000));
    expect(screen.getByText(/계약 시작일 미입력 1곳/)).toBeInTheDocument();
    act(() => rememberSupportManagementYearMonth('2026-08'));
    await waitFor(() => expectSummaries(450000, 5000000, 450000));
    expect(screen.getByText(/시작일이 없어 이전 월에도 포함됩니다/)).toBeInTheDocument();
});
