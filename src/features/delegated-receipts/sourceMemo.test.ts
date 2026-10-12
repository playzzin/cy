import { reconcileWorkbookMemo, sourceImportMemo } from './sourceMemo';
import type { DelegatedClaim } from './model';

const source: DelegatedClaim = { id: 'source', month: '2026-09', siteName: '가상 현장', workerName: '가상 작업자', delegationType: 'delegate', paymentMethod: 'unknown', grossAmount: 1000, expectedAmount: null, receipts: [], sourceStatus: '이재욱 위임 입금완료', sourceLabel: '가상시트!A3', memo: '', updatedAt: '' };

it.each(['', '입금 완료', '개인 통장', '이재욱 위임 입금 전', '위임 입금완료', '현장 팀장계좌', '그룹 표시 G3:G5: 이재욱 위임 입금 완료 (개별 확인 필요)'])('일반 표시 %s는 메모를 중복 생성하지 않는다', value => {
  expect(sourceImportMemo(value)).toBe('');
});

it.each(['가상팀장 위임 입금완료', '통장 확인 후 공제', '입금완료?', '이재욱 외 위임 입금완료', '확인 요청', '2026년 8월 공제'])('분류에 담기지 않는 %s는 원문을 그대로 메모로 보존한다', value => {
  expect(sourceImportMemo(value)).toBe(`엑셀 원문 메모: ${value}`);
});

it('원본과 다른 현재 값은 메모로만 기록하고 원본·수정값·이력을 유지한다', () => {
  const current = { ...source, grossAmount: 1200, expectedAmount: 900, delegationOverride: 'direct' as const, memo: '사용자 메모', confirmation: { id: 'user', recordedAt: '', note: '', status: 'pending' as const, recipient: 'personal' as const } };
  const before = JSON.stringify(current);
  const memo = reconcileWorkbookMemo(current, source);
  expect(memo).toContain('사용자 메모');
  expect(memo).toContain('원본 이재욱 위임 / 현재 개인통장');
  expect(memo).toContain('원본 입금완료 / 현재 입금 전');
  expect(memo).toContain('원본 위임 / 현재 직불');
  expect(memo).toContain('원본 1,000원 / 현재 1,200원');
  expect(memo).not.toContain('세후 금액');
  expect(JSON.stringify(current)).toBe(before);
  expect(reconcileWorkbookMemo({ ...current, memo }, source)).toBe(memo);
});

it('빈 원본 계좌·입금상태는 현재 값과의 불일치로 단정하지 않는다', () => {
  const original = { ...source, sourceStatus: '개인통장', expectedAmount: 0 };
  const current = { ...original, expectedAmount: 100, confirmation: { id: 'user', recordedAt: '', note: '', status: 'complete' as const, recipient: 'personal' as const } };
  expect(reconcileWorkbookMemo(current, original)).toBe('엑셀 대조 · 세후 금액: 원본 0원 / 현재 100원');
});
