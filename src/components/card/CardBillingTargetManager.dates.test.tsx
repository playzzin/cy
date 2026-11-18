import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CardBillingTargetManager } from './CardBillingTargetManager';
import { cardService } from '../../services/cardService';
import { toast } from '../../utils/swal';
import type { Card } from '../../types/card';

jest.mock('../../services/cardService', () => ({ cardService: { listAllCardBillingTargets: jest.fn(), applyCardBillingTargetChanges: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: async () => [] } }));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn() }, showConfirmAlert: async () => ({ isConfirmed: true }) }));

const card: Card = { id: 'fixture', name: '가상카드', last4: '1234', maskedNumber: '****1234', issuer: '가상', cardType: 'CREDIT', status: 'ASSIGNED',
  currentAssigneeType: 'TEAM', currentAssigneeId: 'team', currentAssigneeName: '가상팀' };
const teams = [{ id: 'team', name: '가상팀', companyName: '청연이엔지' }] as any;
const refresh = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(cardService.listAllCardBillingTargets).mockResolvedValue([]);
  jest.mocked(cardService.applyCardBillingTargetChanges).mockResolvedValue(undefined);
});
const view = (value = card) => <CardBillingTargetManager cards={[value]} initialCardId={card.id} selectableTeams={teams} loading={false} onRefresh={refresh} />;

it('배정자 청구에서도 2027년 시작일을 수정·저장하고 다시 열면 저장한 연도를 표시한다', async () => {
  const { rerender } = render(view());
  await waitFor(() => expect(screen.getByLabelText('청구 시작일')).toBeEnabled());
  const input = await screen.findByLabelText('청구 시작일');
  expect(input).toHaveValue('2026-01-01');
  fireEvent.change(input, { target: { value: '2027-01-15' } });
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole('button', { name: '배정자에게 청구 저장' }));
  await waitFor(() => expect(cardService.applyCardBillingTargetChanges).toHaveBeenCalledWith(expect.objectContaining({ billingStartDate: '2027-01-15', clearSnapshot: true })));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  rerender(view({ ...card, billingStartDate: '2027-01-15' }));
  await waitFor(() => expect(screen.getByLabelText('청구 시작일')).toHaveValue('2027-01-15'));
});

it('일반 별도청구에서도 숨겨진 분할 설정 없이 시작일을 수정한다', async () => {
  jest.mocked(cardService.listAllCardBillingTargets).mockResolvedValue([{ id: 'target', cardId: card.id, cardLabel: card.name, targetId: 'team', targetType: 'TEAM', targetName: '가상팀', startDate: '2026-01-01', endDate: '2027-12-31' }]);
  render(view());
  await waitFor(() => expect(screen.getByLabelText('청구 시작일')).toBeEnabled());
  const input = await screen.findByLabelText('청구 시작일');
  await waitFor(() => expect(screen.getByLabelText('청구 종료일')).toHaveValue('2027-12-31'));
  fireEvent.change(input, { target: { value: '2027-02-01' } });
  fireEvent.click(screen.getByRole('button', { name: '청구대상 저장' }));
  await waitFor(() => expect(cardService.applyCardBillingTargetChanges).toHaveBeenCalledWith(expect.objectContaining({
    upserts: [expect.objectContaining({ id: 'target', startDate: '2027-02-01', endDate: '2027-12-31' })]
  })));
});

it('잘못 입력한 날짜를 2026년 기본값으로 바꿔 저장하지 않는다', async () => {
  render(view());
  await waitFor(() => expect(screen.getByLabelText('청구 시작일')).toBeEnabled());
  fireEvent.change(await screen.findByLabelText('청구 시작일'), { target: { value: '2027-02-30' } });
  fireEvent.click(screen.getByRole('button', { name: '배정자에게 청구 저장' }));
  expect(toast.error).toHaveBeenCalled();
  expect(cardService.applyCardBillingTargetChanges).not.toHaveBeenCalled();
});
