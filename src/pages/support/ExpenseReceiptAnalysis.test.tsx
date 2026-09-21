import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExpenseReceiptAnalysis from './ExpenseReceiptAnalysis';
import { teamExpenseRequestService } from '../../services/teamExpenseRequestService';

jest.mock('../../services/teamExpenseRequestService', () => ({ teamExpenseRequestService: { analyze: jest.fn() } }));
const analyze = teamExpenseRequestService.analyze as jest.Mock;
const result = { date: '2026-09-18', amount: 12000, paymentMethod: '개인카드', category: 'meal', warnings: ['개인카드 결제인지 확인해 주세요.'], isReceipt: true };
const props = { receipt: { id: 'one', file: new File(['image'], '영수증.png', { type: 'image/png' }), preview: 'blob:receipt' }, teamId: 'team-a', categories: [{ id: 'meal', label: '식대' }, { id: 'parking', label: '주차비' }], onApply: jest.fn(), onClose: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); analyze.mockResolvedValue(result); });

test('자동 분석 값을 원본과 함께 보여주고 수정·확인 후에만 입력에 적용한다', async () => {
  render(<ExpenseReceiptAnalysis {...props} />);
  expect(props.onApply).not.toHaveBeenCalled();
  expect(screen.getByRole('img', { name: '영수증.png 원본 영수증' })).toHaveAttribute('src', 'blob:receipt');
  await waitFor(() => expect(screen.getByLabelText('분석 금액 (원)')).toHaveValue(12000));
  expect(screen.getByLabelText('분석 사용일')).toHaveValue('2026-09-18');
  expect(screen.getByLabelText('분석 결제수단')).toHaveValue('개인카드');
  expect(screen.getByText('개인카드 결제인지 확인해 주세요.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('분석 금액 (원)'), { target: { value: '13000' } });
  fireEvent.change(screen.getByLabelText('분석 경비 구분'), { target: { value: 'parking' } });
  fireEvent.click(screen.getByRole('button', { name: '확인 후 입력란에 적용' }));
  expect(props.onApply).toHaveBeenCalledWith({ date: '2026-09-18', amount: '13000', paymentMethod: '개인카드', category: 'parking' });
});
test('인식하지 못한 항목은 빈칸으로 두고 실패 시 직접 입력과 재분석을 제공한다', async () => {
  analyze.mockRejectedValueOnce(new Error('분석 연결 실패'));
  render(<ExpenseReceiptAnalysis {...props} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('분석 연결 실패');
  expect(screen.getByLabelText('분석 금액 (원)')).not.toBeDisabled();
  analyze.mockResolvedValueOnce({ ...result, date: null, amount: null, paymentMethod: null, category: null });
  fireEvent.click(screen.getByRole('button', { name: '다시 분석' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '다시 분석' })).not.toBeDisabled());
  expect(screen.getByLabelText('분석 사용일')).toHaveValue('');
  expect(screen.getByLabelText('분석 금액 (원)')).toHaveValue(null);
  expect(screen.getByLabelText('분석 결제수단')).toHaveValue('');
  expect(screen.getByLabelText('분석 경비 구분')).toHaveValue('');
  expect(props.onApply).not.toHaveBeenCalled();
});
test('닫은 미리보기의 늦은 분석 결과를 적용하지 않고 StrictMode에서도 한 번만 호출한다', async () => {
  let finish!: (value: typeof result) => void;
  analyze.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<React.StrictMode><ExpenseReceiptAnalysis {...props} /></React.StrictMode>);
  expect(analyze).toHaveBeenCalledTimes(1);
  view.unmount(); finish(result);
  await Promise.resolve();
  expect(props.onApply).not.toHaveBeenCalled();
});
