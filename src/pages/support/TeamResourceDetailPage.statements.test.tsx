import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamResourceDetailPage from './TeamResourceDetailPage';
import CardStatementFilesDialog from '../../components/card/CardStatementFilesDialog';
import CardStatementUsageDialog from '../../components/card/CardStatementUsageDialog';
import { accommodationService } from '../../services/accommodationService';
import { cardService } from '../../services/cardService';
import { manpowerService } from '../../services/manpowerService';
import { vehicleService } from '../../services/vehicleService';
import { useWorkerAccessScope } from '../../hooks/useWorkerAccessScope';
import { useExpenseLedgerData } from './hooks/useExpenseLedgerData';
import type { Card, CardTransaction } from '../../types/card';
import type { CardBillingDocument } from '../../types/cardBilling';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/userService', () => ({ userService: {} }));
jest.mock('../../services/accommodationService', () => ({
    accommodationService: { getAccommodations: jest.fn(), getAssignments: jest.fn() },
}));
jest.mock('../../services/vehicleService', () => ({
    vehicleService: { getVehicles: jest.fn(), listAllVehicleAssignments: jest.fn() },
}));
jest.mock('../../services/cardService', () => ({
    cardService: { getCards: jest.fn(), listAllCardAssignments: jest.fn(), getTransactionsByMonth: jest.fn() },
}));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../hooks/useWorkerAccessScope', () => ({
    ...jest.requireActual('../../hooks/useWorkerAccessScope'), useWorkerAccessScope: jest.fn(),
}));
jest.mock('./hooks/useExpenseLedgerData', () => ({
    useExpenseLedgerData: jest.fn(),
    getBillingStatusLabel: (value: string) => value,
    getCategoryLabel: (value: string) => value,
    getEffectiveClaimType: (claim: { claimType?: string }) => claim.claimType,
    getStatusLabel: (value: string) => value,
    getSummaryTotal: () => 0,
    summarizeVehicleBillingCosts: () => ({ rent: 0, lease: 0, fuel: 0, fine: 0, repair: 0, toll: 0, other: 0, total: 0 }),
}));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('../../components/card/CardStatementFilesDialog', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../components/card/CardStatementUsageDialog', () => ({ __esModule: true, default: jest.fn() }));

const now = new Date();
const selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const firstPath = `card-billing-statements/${selectedMonth}/first.pdf`;
const secondPath = `card-billing-statements/${selectedMonth}/second.pdf`;
const teams = [{ id: 'team-a', name: '검증팀' }, { id: 'team-b', name: '다른검증팀' }];

const makeCard = (id: string, name: string): Card => ({
    id, name, issuer: '검증발급사', cardType: 'CREDIT', last4: '1234', maskedNumber: '**** 1234',
    status: 'ASSIGNED', currentAssigneeType: 'TEAM', currentAssigneeId: 'team-a', currentAssigneeName: '검증팀',
});

const makeBill = (overrides: Partial<CardBillingDocument> = {}): CardBillingDocument => ({
    id: 'bill-a', yearMonth: selectedMonth, cardId: 'card-a', cardLabel: '검증카드',
    teamId: 'team-a', teamName: '검증팀', issuedToType: 'team', variableCost: 3000,
    totalAmount: 3000, status: 'CONFIRMED', lineItems: [], statementAttachmentPaths: [firstPath],
    ...overrides,
});

const makeTransaction = (overrides: Partial<CardTransaction> = {}): CardTransaction => ({
    id: 'transaction-a', cardId: 'card-a', cardLabel: '검증카드', yearMonth: selectedMonth,
    date: `${selectedMonth}-05`, merchant: '검증가맹점', category: 'OTHER', amount: 3000,
    statementAttachmentPaths: [firstPath], ...overrides,
});

const setBills = (cardDocs: CardBillingDocument[]) => {
    (useExpenseLedgerData as jest.Mock).mockReturnValue({
        loading: false, teamOptions: teams, summaries: [],
        rawDocs: { accommodationDocs: [], vehicleDocs: [], cardDocs, claims: [] },
        resolveTeam: (id: unknown, name: unknown) => teams.find(team => team.id === id || team.name === name) ?? null,
        allCategoryOptions: [], loadData: jest.fn().mockResolvedValue(undefined),
    });
};

const openCardTab = async () => {
    render(<TeamResourceDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
    fireEvent.click(within(screen.getByRole('tablist', { name: '지원 상세 선택' })).getByRole('tab', { name: /^카드/ }));
    return screen.getAllByRole('table')[0];
};

const latestProps = (component: unknown) => {
    const calls = (component as jest.Mock).mock.calls;
    return calls[calls.length - 1][0];
};

beforeEach(() => {
    jest.clearAllMocks();
    (CardStatementFilesDialog as jest.Mock).mockImplementation(({ onClose }) => (
        <div role="dialog" aria-label="원본 파일 확인"><button onClick={onClose}>원본 닫기</button></div>
    ));
    (CardStatementUsageDialog as jest.Mock).mockImplementation(({ onClose }) => (
        <div role="dialog" aria-label="상세 사용내역 확인"><button onClick={onClose}>상세 닫기</button></div>
    ));
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    (accommodationService.getAccommodations as jest.Mock).mockResolvedValue([]);
    (accommodationService.getAssignments as jest.Mock).mockResolvedValue([]);
    (vehicleService.getVehicles as jest.Mock).mockResolvedValue([]);
    (vehicleService.listAllVehicleAssignments as jest.Mock).mockResolvedValue([]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (cardService.getCards as jest.Mock).mockResolvedValue([makeCard('card-a', '검증카드'), makeCard('empty-card', '파일없는카드')]);
    (cardService.listAllCardAssignments as jest.Mock).mockResolvedValue([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([]);
    (useWorkerAccessScope as jest.Mock).mockReturnValue({
        mode: 'team', loading: false, label: '소속팀', teamIds: ['team-a', 'team-b'], teamNameKeys: ['검증팀', '다른검증팀'],
        teamWorkerIds: [], teamWorkerNameKeys: [], workerIds: [], workerUids: [], workerNameKeys: [],
    });
    setBills([makeBill()]);
});

test('선택 카드의 중복 없는 첨부, 조회월과 식별자를 전달하고 팀 청구액을 전체 원본 대조액으로 쓰지 않는다', async () => {
    setBills([
        makeBill({ statementAttachmentPaths: [firstPath, ` ${firstPath} `, ''] }),
        makeBill({ id: 'bill-a-extra', totalAmount: 1500, statementAttachmentPaths: [secondPath, firstPath] }),
        makeBill({ id: 'other-team', teamId: 'team-b', teamName: '다른검증팀', statementAttachmentPaths: ['other-team.pdf'] }),
        makeBill({ id: 'personal', issuedToType: 'worker', issuedToWorkerId: 'worker-a', statementAttachmentPaths: ['personal.pdf'] }),
        makeBill({ id: 'other-card', cardId: 'another-card', cardLabel: '별도카드', statementAttachmentPaths: ['other-card.pdf'] }),
    ]);
    const table = within(await openCardTab());
    const row = within(table.getByRole('row', { name: /검증카드/ }));
    expect(table.getByRole('columnheader', { name: '사용내역서' })).toBeInTheDocument();
    expect(row.getByText('4,500원')).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: '원본 보기' }));
    await screen.findByRole('dialog', { name: '원본 파일 확인' });
    expect(latestProps(CardStatementFilesDialog).paths).toEqual([firstPath, secondPath]);
    fireEvent.click(screen.getByRole('button', { name: '원본 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(row.getByRole('button', { name: '상세내역' }));
    await screen.findByRole('dialog', { name: '상세 사용내역 확인' });
    expect(latestProps(CardStatementUsageDialog)).toMatchObject({
        yearMonth: selectedMonth, cardId: 'card-a', cardLast4: '1234', cardName: '검증카드',
        paths: [firstPath, secondPath],
    });
    expect(latestProps(CardStatementUsageDialog).ledgerTotal).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('첨부 파일이 없는 배정 카드의 원본 보기와 상세내역을 비활성화한다', async () => {
    const table = within(await openCardTab());
    const row = within(table.getByRole('row', { name: /파일없는카드/ }));
    expect(row.getByRole('button', { name: '원본 보기' })).toBeDisabled();
    expect(row.getByRole('button', { name: '상세내역' })).toBeDisabled();
    fireEvent.click(row.getByRole('button', { name: '원본 보기' }));
    expect(CardStatementFilesDialog).not.toHaveBeenCalled();
    expect(CardStatementUsageDialog).not.toHaveBeenCalled();
});

test('카드 기본 정보와 배정 이력이 없어도 청구서에 남은 카드명과 식별자로 상세내역을 연다', async () => {
    (cardService.getCards as jest.Mock).mockResolvedValue([]);
    setBills([makeBill({ cardId: 'archived-card', cardLabel: '이전검증카드 (9876)' })]);
    const table = within(await openCardTab());
    const row = within(table.getByRole('row', { name: /이전검증카드/ }));
    fireEvent.click(row.getByRole('button', { name: '상세내역' }));
    await screen.findByRole('dialog', { name: '상세 사용내역 확인' });
    expect(latestProps(CardStatementUsageDialog)).toMatchObject({
        yearMonth: selectedMonth, cardId: 'archived-card', cardName: '이전검증카드 (9876)',
        paths: [firstPath],
    });
});

test('배정기간 안의 원장 첨부를 합치고 다른 팀 기간, 취소 거래, 다른 월과 카드 첨부는 제외한다', async () => {
    (cardService.listAllCardAssignments as jest.Mock).mockResolvedValue([
        { id: 'assignment-a', cardId: 'card-a', cardLabel: '검증카드', assigneeType: 'TEAM', assigneeId: 'team-a', assigneeName: '검증팀', startDate: `${selectedMonth}-01`, endDate: `${selectedMonth}-10` },
        { id: 'assignment-b', cardId: 'card-a', cardLabel: '검증카드', assigneeType: 'TEAM', assigneeId: 'team-b', assigneeName: '다른검증팀', startDate: `${selectedMonth}-11` },
    ]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([
        makeTransaction({ evidenceUrl: ` ${firstPath} `, statementAttachmentPaths: [firstPath, secondPath] }),
        makeTransaction({ id: 'other-period', date: `${selectedMonth}-15`, statementAttachmentPaths: ['other-period.pdf'] }),
        makeTransaction({ id: 'cancelled', status: 'CANCELLED', statementAttachmentPaths: ['cancelled.pdf'] }),
        makeTransaction({ id: 'different-month', yearMonth: '2000-01', statementAttachmentPaths: ['different-month.pdf'] }),
        makeTransaction({ id: 'different-card', cardId: 'unknown-card', statementAttachmentPaths: ['different-card.pdf'] }),
    ]);
    const table = within(await openCardTab());
    fireEvent.click(within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: '원본 보기' }));
    await screen.findByRole('dialog', { name: '원본 파일 확인' });
    await waitFor(() => expect(latestProps(CardStatementFilesDialog).paths).toEqual([firstPath, secondPath]));
    expect(cardService.getTransactionsByMonth).toHaveBeenCalledWith(selectedMonth);
});

test('배정 이력이 없는 현재 배정 카드도 이번 달 원장에 연결된 사용내역서를 연다', async () => {
    setBills([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([makeTransaction({ evidenceUrl: firstPath })]);
    const table = within(await openCardTab());
    const button = within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: '상세내역' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByRole('dialog', { name: '상세 사용내역 확인' });
    expect(latestProps(CardStatementUsageDialog)).toMatchObject({ cardId: 'card-a', yearMonth: selectedMonth, paths: [firstPath] });
});

test.each(['원본 보기', '상세내역'])('조회월을 바꾸면 열려 있던 %s 창을 닫는다', async buttonName => {
    const table = within(await openCardTab());
    fireEvent.click(within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: buttonName }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const hookCalls = (useExpenseLedgerData as jest.Mock).mock.calls;
    expect(hookCalls[hookCalls.length - 1][0]).not.toBe(selectedMonth);
});

test.each(['원본 보기', '상세내역'])('다른 팀을 선택하면 열려 있던 %s 창을 닫는다', async buttonName => {
    const table = within(await openCardTab());
    fireEvent.click(within(table.getByRole('row', { name: /검증카드/ })).getByRole('button', { name: buttonName }));
    await screen.findByRole('dialog');
    const picker = within(screen.getByLabelText('팀 선택', { selector: 'div' }));
    fireEvent.click(picker.getByRole('button', { name: /팀 선택.*검증팀/ }));
    fireEvent.click(picker.getByRole('button', { name: /다른검증팀/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '다른검증팀' })).toBeInTheDocument();
});
