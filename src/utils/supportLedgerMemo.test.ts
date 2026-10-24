import { editableSupportMemo } from './supportLedgerMemo';
test('자동 조회기간과 PDF 문구만 제외하고 직접 입력한 메모는 보존한다', () => {
  expect(editableSupportMemo('조회기간 2026-08-01 ~ 2026-08-31\n직접 입력한 비고\nPDF import: source.pdf')).toBe('직접 입력한 비고');
  expect(editableSupportMemo('조회기간 확인 요청\nPDF 원본 확인 필요')).toBe('조회기간 확인 요청\nPDF 원본 확인 필요');
  expect(editableSupportMemo(null)).toBe('');
});
