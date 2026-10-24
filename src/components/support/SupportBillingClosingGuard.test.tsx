import React from 'react';
import { render } from '@testing-library/react';
import { SupportBillingClosingGuardContext, useSupportBillingClosingGuard } from './SupportBillingClosingGuard';

function Ledger({ reason }: { reason: string | null }) {
  useSupportBillingClosingGuard('card', reason);
  return <div>대장</div>;
}

it('registers dirty/pending input and clears the guard after save or unmount', () => {
  const register = jest.fn();
  const { rerender, unmount } = render(<SupportBillingClosingGuardContext.Provider value={register}><Ledger reason="저장 필요" /></SupportBillingClosingGuardContext.Provider>);
  expect(register).toHaveBeenLastCalledWith('card', '저장 필요');
  rerender(<SupportBillingClosingGuardContext.Provider value={register}><Ledger reason="저장 중" /></SupportBillingClosingGuardContext.Provider>);
  expect(register).toHaveBeenLastCalledWith('card', '저장 중');
  rerender(<SupportBillingClosingGuardContext.Provider value={register}><Ledger reason={null} /></SupportBillingClosingGuardContext.Provider>);
  expect(register).toHaveBeenLastCalledWith('card', null);
  unmount();
  expect(register).toHaveBeenLastCalledWith('card', null);
});

it('keeps standalone ledger rendering compatible without a closing workspace', () => {
  expect(() => render(<Ledger reason="저장 필요" />)).not.toThrow();
});
