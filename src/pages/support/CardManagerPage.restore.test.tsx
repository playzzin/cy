import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CardManagerPage } from './CardManagerPage';
import { cardService } from '../../services/cardService';
import type { Card } from '../../types/card';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../services/userService', () => ({ userService: {} }));
jest.mock('../../services/cardService', () => ({ cardService: {
    getCards: jest.fn(), listAllCardBillingTargets: jest.fn().mockResolvedValue([]), restoreCardUse: jest.fn(),
} }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: async () => [] } }));
jest.mock('../../components/card/CardForm', () => ({ CardForm: () => null }));
jest.mock('../../components/card/CardAssignmentManager', () => ({ CardAssignmentManager: () => null }));
jest.mock('../../components/card/CardBillingTargetManager', () => ({ CardBillingTargetManager: () => null }));
jest.mock('../../components/card/CardMonthlyLedger', () => ({ CardMonthlyLedger: () => null }));
jest.mock('../../components/support/SupportExcelDownloadButton', () => ({ SupportExcelDownloadButton: () => null }));

const card: Card = { id: 'closed-card', name: '해지 테스트 카드', issuer: '테스트', cardType: 'CREDIT', status: 'CLOSED', last4: '0001', maskedNumber: '****-****-****-0001' };

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(cardService.getCards).mockResolvedValue([card]);
    jest.mocked(cardService.listAllCardBillingTargets).mockResolvedValue([]);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const openInactiveCards = async () => {
    render(<MemoryRouter><CardManagerPage initialTab="status" /></MemoryRouter>);
    await waitFor(() => expect(cardService.getCards).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /정지\/해지/ }));
    return screen.findByRole('button', { name: '카드 해지 해제: 해지 테스트 카드' });
};

it('restores a closed card with the correct audit log and refreshes it as available', async () => {
    jest.mocked(cardService.restoreCardUse).mockImplementation(async () => {
        jest.mocked(cardService.getCards).mockResolvedValue([{ ...card, status: 'AVAILABLE' }]);
        return { changed: true, statusBefore: 'CLOSED', statusAfter: 'AVAILABLE', operationId: 'test', closedAssignmentCount: 0, closedBillingTargetCount: 0 };
    });
    fireEvent.click(await openInactiveCards());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('카드 해지를 해제하고 보관중'));
    await waitFor(() => expect(cardService.restoreCardUse).toHaveBeenCalledWith(expect.objectContaining({
        cardId: card.id,
        auditLog: expect.objectContaining({ reasonLabel: '카드 해지 해제', statusBefore: 'CLOSED', statusAfter: 'AVAILABLE' }),
    })));
    await waitFor(() => expect(cardService.getCards).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: /보관 중/ }));
    expect(await screen.findByText(card.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '카드 해지 해제: 해지 테스트 카드' })).not.toBeInTheDocument();
});

it('leaves the closed card unchanged when confirmation is cancelled', async () => {
    jest.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(await openInactiveCards());
    expect(cardService.restoreCardUse).not.toHaveBeenCalled();
    expect(cardService.getCards).toHaveBeenCalledTimes(1);
});

it('keeps the restore action available after an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(cardService.restoreCardUse).mockRejectedValue(new Error('permission-denied'));
    fireEvent.click(await openInactiveCards());
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('카드 해지 해제 중 오류가 발생했습니다.'));
    expect(screen.getByRole('button', { name: '카드 해지 해제: 해지 테스트 카드' })).toBeEnabled();
    expect(cardService.getCards).toHaveBeenCalledTimes(1);
});
