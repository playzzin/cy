import { act, renderHook } from '@testing-library/react';
import { useTeamSettlementAccordion } from './useTeamSettlementAccordion';

test('자식 상세를 열면 부모는 유지하고 형제·다른 영역은 닫히며 팀이나 월을 바꾸면 초기화한다', () => {
  const { result, rerender } = renderHook(({ scope }) => useTeamSettlementAccordion(scope), { initialProps: { scope: 'A:2026-08' } });
  act(() => result.current.toggle(['deduction', 'room', 'address-a']));
  expect(result.current.isOpen(['deduction', 'room'])).toBe(true);
  act(() => result.current.toggle(['deduction', 'room', 'address-b']));
  expect(result.current.isOpen(['deduction', 'room', 'address-a'])).toBe(false);
  expect(result.current.child(['deduction', 'room'])).toBe('address-b');
  act(() => result.current.toggle(['deduction', 'room']));
  expect(result.current.isOpen(['deduction', 'room'])).toBe(false);
  act(() => result.current.open(['invoice', 'fee']));
  act(() => result.current.toggle(['validation']));
  expect(result.current.isOpen(['invoice'])).toBe(false);
  rerender({ scope: 'B:2026-08' });
  expect(result.current.isOpen(['validation'])).toBe(false);
  rerender({ scope: 'A:2026-08' });
  expect(result.current.isOpen(['validation'])).toBe(false);
  act(() => result.current.open(['invoice', 'claim']));
  rerender({ scope: 'A:2026-09' });
  expect(result.current.isOpen(['invoice'])).toBe(false);
});
