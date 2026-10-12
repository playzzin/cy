import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import RecipientSelect from './RecipientSelect';

it('목록의 직접 입력은 저장 전까지 반영하지 않고 Enter로 한 번 저장한다', () => {
  const onChange = jest.fn();
  const { rerender } = render(<RecipientSelect label="받는 계좌" value="personal" onChange={onChange} saveCustom />);
  fireEvent.click(screen.getByRole('combobox')); fireEvent.click(screen.getByRole('option', { name: '직접 입력…' }));
  const input = screen.getByRole('textbox', { name: '받는 계좌 직접 입력' });
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  fireEvent.change(input, { target: { value: '  가상 수령인 계좌  ' } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('custom:가상 수령인 계좌');
  rerender(<RecipientSelect label="받는 계좌" value="custom:가상 수령인 계좌" onChange={onChange} saveCustom />);
  expect(screen.getByRole('combobox')).toHaveTextContent('가상 수령인 계좌');
  fireEvent.click(screen.getByRole('combobox')); fireEvent.click(screen.getByRole('option', { name: '직접 입력…' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '다른 입력' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('일괄 등록에서는 직접 입력값을 전달하며 일반 계좌로 다시 바꿀 수 있다', () => {
  const onChange = jest.fn();
  render(<RecipientSelect label="받는 계좌" value="custom:" onChange={onChange} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '가상 통장' } });
  expect(onChange).toHaveBeenCalledWith('custom:가상 통장');
  fireEvent.click(screen.getByRole('combobox')); fireEvent.click(screen.getByRole('option', { name: '개인통장' }));
  expect(onChange).toHaveBeenCalledWith('personal');
});
