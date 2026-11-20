import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamResourceDetailPage from './TeamResourceDetailPage';
import CardStatementFilesDialog from '../../components/card/CardStatementFilesDialog';
import VehicleFinePhotos from '../../components/vehicle/VehicleFinePhotos';
import { accommodationService } from '../../services/accommodationService';
import { cardService } from '../../services/cardService';
import { manpowerService } from '../../services/manpowerService';
import { vehicleService } from '../../services/vehicleService';
import { useWorkerAccessScope } from '../../hooks/useWorkerAccessScope';
import { useExpenseLedgerData } from './hooks/useExpenseLedgerData';
import type { Card, CardTransaction } from '../../types/card';
import type { CardBillingDocument } from '../../types/cardBilling';
import type { VehicleBillingDocument } from '../../types/vehicleBilling';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/userService', () => ({ userService: {} }));
jest.mock('../../services/accommodationService', () => ({ accommodationService: { getAccommodations: jest.fn(), getAssignments: jest.fn() } }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { getVehicles: jest.fn(), listAllVehicleAssignments: jest.fn(), listAllVehicleExpenses: jest.fn() } }));
jest.mock('../../services/cardService', () => ({ cardService: { getCards: jest.fn(), listAllCardAssignments: jest.fn(), getTransactionsByMonth: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../hooks/useWorkerAccessScope', () => ({ ...jest.requireActual('../../hooks/useWorkerAccessScope'), useWorkerAccessScope: jest.fn() }));
jest.mock('./hooks/useExpenseLedgerData', () => ({
    useExpenseLedgerData: jest.fn(), getBillingStatusLabel: (value: string) => value,
    getCategoryLabel: (value: string) => value, getEffectiveClaimType: (claim: { claimType?: string }) => claim.claimType,
    getStatusLabel: (value: string) => value, getSummaryTotal: () => 0,
    summarizeVehicleBillingCosts: (doc: VehicleBillingDocument) => ({ rent: 0, lease: 0, fuel: 0, fine: doc.totalAmount, repair: 0, toll: 0, other: 0, total: doc.totalAmount }),
}));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('../../components/card/CardStatementFilesDialog', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../components/vehicle/VehicleFinePhotos', () => ({ __esModule: true, default: jest.fn() }));

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const firstPath = `card-billing-statements/${month}/first.pdf`;
const secondPath = `card-billing-statements/${month}/second.jpg`;
const teams = [{ id: 'team-a', name: '검증팀' }, { id: 'team-b', name: '다른검증팀' }];
const makeCard = (id: string, name: string): Card => ({ id, name, issuer: '검증발급사', cardType: 'CREDIT', last4: '1234', maskedNumber: '**** 1234', status: 'ASSIGNED', currentAssigneeType: 'TEAM', currentAssigneeId: 'team-a', currentAssigneeName: '검증팀' });
const makeBill = (overrides: Partial<CardBillingDocument> = {}): CardBillingDocument => ({ id: 'bill-a', yearMonth: month, cardId: 'card-a', cardLabel: '검증카드', teamId: 'team-a', teamName: '검증팀', issuedToType: 'team', variableCost: 3000, totalAmount: 3000, status: 'CONFIRMED', lineItems: [], statementAttachmentPaths: [firstPath], ...overrides });
const makeTransaction = (overrides: Partial<CardTransaction> = {}): CardTransaction => ({ id: 'transaction-a', cardId: 'card-a', cardLabel: '검증카드', yearMonth: month, date: `${month}-05`, merchant: '검증가맹점', category: 'OTHER', amount: 3000, statementAttachmentPaths: [firstPath], ...overrides });
const vehicleBill: VehicleBillingDocument = { id: 'vehicle-bill', vehicleId: 'vehicle-a', vehiclePlate: '12가3456', yearMonth: month, teamId: 'team-a', teamName: '검증팀', issuedToType: 'team', status: 'DRAFT', fixedCost: 0, variableCost: 32000, totalAmount: 32000, lineItems: [{ id: 'fine-a', label: '과태료', category: 'FINE', type: 'VARIABLE', amount: 32000 }] };
const fine = { id: 'fine-a', vehicleId: 'vehicle-a', vehiclePlate: '12가3456', date: `${month}-05`, type: 'FINE', amount: 32000, payer: 'COMPANY', fineNotice: { sourceSha256: 'a'.repeat(64), sourceFileName: '고지서.png' } };
const setBills = (cardDocs: CardBillingDocument[], vehicleDocs: VehicleBillingDocument[] = []) => {
    (useExpenseLedgerData as jest.Mock).mockReturnValue({ loading: false, teamOptions: teams, summaries: [], rawDocs: { accommodationDocs: [], vehicleDocs, cardDocs, claims: [] }, resolveTeam: (id: unknown, name: unknown) => teams.find(team => team.id === id || team.name === name) ?? null, allCategoryOptions: [], loadData: jest.fn().mockResolvedValue(undefined) });
};
const openTab = async (tab: '카드' | '차량' = '카드') => {
    render(<TeamResourceDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
    // eslint-disable-next-line testing-library/no-unnecessary-act -- Also flush the async expense fetch before this helper returns.
    await act(async () => { fireEvent.click(within(screen.getByRole('tablist', { name: '지원 상세 선택' })).getByRole('tab', { name: new RegExp(`^${tab}`) })); });
    return screen.getAllByRole('table')[0];
};
const latestProps = (component: unknown) => { const calls = (component as jest.Mock).mock.calls; return calls[calls.length - 1][0]; };

beforeEach(() => {
    jest.clearAllMocks();
    (CardStatementFilesDialog as jest.Mock).mockImplementation(({ onClose }) => <div role="dialog" aria-label="원본 파일 확인"><button onClick={onClose}>원본 닫기</button></div>);
    (VehicleFinePhotos as jest.Mock).mockImplementation(({ triggerLabel }) => <button>{triggerLabel}</button>);
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    (accommodationService.getAccommodations as jest.Mock).mockResolvedValue([]);
    (accommodationService.getAssignments as jest.Mock).mockResolvedValue([]);
    (vehicleService.getVehicles as jest.Mock).mockResolvedValue([]);
    (vehicleService.listAllVehicleAssignments as jest.Mock).mockResolvedValue([]);
    (vehicleService.listAllVehicleExpenses as jest.Mock).mockResolvedValue([]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (cardService.getCards as jest.Mock).mockResolvedValue([makeCard('card-a', '검증카드'), makeCard('empty-card', '파일없는카드')]);
    (cardService.listAllCardAssignments as jest.Mock).mockResolvedValue([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([]);
    (useWorkerAccessScope as jest.Mock).mockReturnValue({ mode: 'team', loading: false, label: '소속팀', teamIds: ['team-a', 'team-b'], teamNameKeys: ['검증팀', '다른검증팀'], teamWorkerIds: [], teamWorkerNameKeys: [], workerIds: [], workerUids: [], workerNameKeys: [] });
    setBills([makeBill()]);
});

test('카드는 원본 보기만 남기고 선택 팀의 중복 없는 첨부를 전달한다', async () => {
    setBills([makeBill({ statementAttachmentPaths: [firstPath, ` ${firstPath} `, ''] }), makeBill({ id: 'extra', statementAttachmentPaths: [secondPath] }), makeBill({ id: 'other-team', teamId: 'team-b', teamName: '다른검증팀', statementAttachmentPaths: ['other.pdf'] }), makeBill({ id: 'personal', issuedToType: 'worker', issuedToWorkerId: 'worker-a', statementAttachmentPaths: ['personal.pdf'] })]);
    const table = within(await openTab());
    expect(screen.queryByRole('button', { name: '상세내역' })).not.toBeInTheDocument();
    fireEvent.click(within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: '원본 보기' }));
    await screen.findByRole('dialog');
    expect(latestProps(CardStatementFilesDialog)).toMatchObject({ paths: [firstPath, secondPath], showDetailsLink: false });
    fireEvent.click(screen.getByRole('button', { name: '원본 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('첨부 파일이 없는 카드의 원본 보기는 비활성화한다', async () => {
    const table = within(await openTab());
    const row = within(table.getByRole('row', { name: /파일없는카드/ }));
    expect(row.getByRole('button', { name: '원본 보기' })).toBeDisabled();
    expect(row.queryByRole('button', { name: '상세내역' })).not.toBeInTheDocument();
});

test('카드 기본 정보가 없어도 청구서에 남은 원본을 연다', async () => {
    (cardService.getCards as jest.Mock).mockResolvedValue([]);
    setBills([makeBill({ cardId: 'archived-card', cardLabel: '이전카드' })]);
    const table = within(await openTab());
    fireEvent.click(within(table.getByRole('row', { name: /이전카드/ })).getByRole('button', { name: '원본 보기' }));
    await screen.findByRole('dialog');
    expect(latestProps(CardStatementFilesDialog)).toMatchObject({ paths: [firstPath], title: '이전카드 사용내역서 원본' });
});

test('배정기간 밖, 취소 거래, 다른 월과 카드의 원본은 제외한다', async () => {
    (cardService.listAllCardAssignments as jest.Mock).mockResolvedValue([
        { id: 'a', cardId: 'card-a', cardLabel: '검증카드', assigneeType: 'TEAM', assigneeId: 'team-a', assigneeName: '검증팀', startDate: `${month}-01`, endDate: `${month}-10` },
        { id: 'b', cardId: 'card-a', cardLabel: '검증카드', assigneeType: 'TEAM', assigneeId: 'team-b', assigneeName: '다른검증팀', startDate: `${month}-11` },
    ]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([makeTransaction({ evidenceUrl: firstPath, statementAttachmentPaths: [firstPath, secondPath] }), makeTransaction({ id: 'other-period', date: `${month}-15`, statementAttachmentPaths: ['other-period.pdf'] }), makeTransaction({ id: 'cancelled', status: 'CANCELLED', statementAttachmentPaths: ['cancelled.pdf'] }), makeTransaction({ id: 'other-month', yearMonth: '2000-01', statementAttachmentPaths: ['other-month.pdf'] }), makeTransaction({ id: 'other-card', cardId: 'unknown', statementAttachmentPaths: ['other-card.pdf'] })]);
    const table = within(await openTab());
    fireEvent.click(within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: '원본 보기' }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(latestProps(CardStatementFilesDialog).paths).toEqual([firstPath, secondPath]));
});

test('현재 배정 카드의 이번 달 원장에 연결된 원본을 연다', async () => {
    setBills([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([makeTransaction()]);
    const table = within(await openTab());
    const button = within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: '원본 보기' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByRole('dialog');
    expect(latestProps(CardStatementFilesDialog).paths).toEqual([firstPath]);
});

test.each(['month', 'team'])('%s를 바꾸면 카드 원본 창을 닫는다', async change => {
    const table = within(await openTab());
    fireEvent.click(within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: '원본 보기' }));
    await screen.findByRole('dialog');
    if (change === 'month') fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    else {
        const picker = within(screen.getByLabelText('팀 선택', { selector: 'div' }));
        fireEvent.click(picker.getByRole('button', { name: /팀 선택.*검증팀/ }));
        fireEvent.click(picker.getByRole('button', { name: /다른검증팀/ }));
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('차량 청구에 연결된 과태료만 원본 보기로 전달한다', async () => {
    setBills([], [vehicleBill, { ...vehicleBill, id: 'other-month', yearMonth: '2000-01' }]);
    (vehicleService.listAllVehicleExpenses as jest.Mock).mockResolvedValue([fine, { ...fine, id: 'other-fine' }, { ...fine, id: 'cancelled', status: 'CANCELLED' }]);
    await openTab('차량');
    await waitFor(() => expect(VehicleFinePhotos).toHaveBeenCalled());
    expect(latestProps(VehicleFinePhotos)).toMatchObject({ expenses: [fine], vehiclePlate: '12가3456', triggerLabel: '원본 보기' });
    expect(vehicleService.listAllVehicleExpenses).toHaveBeenCalledWith(undefined, month);
    // eslint-disable-next-line testing-library/no-unnecessary-act -- The month change also resolves a new expense fetch.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '이전 달' })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: '원본 보기' })).not.toBeInTheDocument());
});

test('과태료 연결 조회 실패는 고지서 없음과 구분한다', async () => {
    setBills([], [vehicleBill]);
    (vehicleService.listAllVehicleExpenses as jest.Mock).mockRejectedValue(new Error('fixture failure'));
    await openTab('차량');
    expect(await screen.findByText('조회 실패 · 새로고침해 주세요')).toBeInTheDocument();
    expect(VehicleFinePhotos).not.toHaveBeenCalled();
});
