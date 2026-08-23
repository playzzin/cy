import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Card } from '../../types/card';
import { CardStatusBoard } from './CardStatusBoard';
import { cardService } from '../../services/cardService';
import { manpowerService } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';

jest.mock('../../services/cardService', () => ({
    cardService: { listAllCardBillingTargets: jest.fn() },
}));
jest.mock('../../services/manpowerService', () => ({
    manpowerService: { getWorkers: jest.fn() },
}));
jest.mock('../../services/officeStaffService', () => ({
    officeStaffService: { getOfficeStaff: jest.fn() },
}));

const mockedCardService = cardService as jest.Mocked<typeof cardService>;
const mockedManpowerService = manpowerService as jest.Mocked<typeof manpowerService>;
const mockedOfficeStaffService = officeStaffService as jest.Mocked<typeof officeStaffService>;

const makeCard = (id: string, name: string, status: Card['status']): Card => ({
    id,
    name,
    issuer: '국민카드',
    cardType: 'CREDIT',
    last4: id.slice(-4),
    maskedNumber: `****-****-****-${id.slice(-4)}`,
    status,
    currentAssigneeId: 'team-1',
    currentAssigneeType: 'TEAM',
    currentAssigneeName: '김진민팀',
    billingTargetId: 'team-1',
    billingTargetType: 'TEAM',
    billingTargetName: '김진민팀',
});

describe('CardStatusBoard inactive card controls', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedCardService.listAllCardBillingTargets.mockResolvedValue([]);
        mockedManpowerService.getWorkers.mockResolvedValue([]);
        mockedOfficeStaffService.getOfficeStaff.mockResolvedValue([]);
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: jest.fn().mockReturnValue({
                matches: false,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }),
        });
    });

    it('offers restore only for suspended cards and disables inactive assignment/billing controls', async () => {
        const onAssign = jest.fn();
        const onBillingTargetAssign = jest.fn();
        const onCancelUse = jest.fn();
        const onRestoreUse = jest.fn();
        render(
            <CardStatusBoard
                cards={[
                    makeCard('card-3909', '정지카드', 'SUSPENDED'),
                    makeCard('card-9911', '해지카드', 'CLOSED'),
                ]}
                loading={false}
                onEdit={jest.fn()}
                onAssign={onAssign}
                onBillingTargetAssign={onBillingTargetAssign}
                onCancelUse={onCancelUse}
                onRestoreUse={onRestoreUse}
            />
        );

        await waitFor(() => expect(mockedCardService.listAllCardBillingTargets).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: /정지\/해지/ }));

        expect(screen.getByRole('button', { name: '카드 정지 해제: 정지카드' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: '카드 정지 해제: 해지카드' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /카드 사용취소 처리/ })).not.toBeInTheDocument();

        const staleAssigneeButtons = screen.getAllByRole('button', { name: '김진민팀' });
        expect(staleAssigneeButtons.length).toBeGreaterThan(0);
        staleAssigneeButtons.forEach((button) => expect(button).toBeDisabled());
        fireEvent.click(staleAssigneeButtons[0]);
        expect(onAssign).not.toHaveBeenCalled();
        expect(onBillingTargetAssign).not.toHaveBeenCalled();
    });
});
