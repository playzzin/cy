import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ReceiptChoiceSelect from './ReceiptChoiceSelect';
import { delegationChoices } from './receiptChoiceOptions';

it('방향키 탐색은 저장하지 않고 Enter로 선택하며 Escape는 변경 없이 닫는다', () => {
  const onChange = jest.fn();
  render(<ReceiptChoiceSelect label="입금방법" value="delegate" options={delegationChoices} onChange={onChange} />);
  const control = screen.getByRole('combobox', { name: '입금방법' });
  control.focus();
  fireEvent.keyDown(control, { key: 'ArrowDown' });
  fireEvent.keyDown(control, { key: 'ArrowDown' });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('option', { name: '직불' })).toHaveAttribute('id', control.getAttribute('aria-activedescendant'));
  fireEvent.keyDown(control, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('direct');
  expect(control).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(control); fireEvent.keyDown(control, { key: 'End' }); fireEvent.keyDown(control, { key: 'Escape' });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(control).toHaveAttribute('aria-expanded', 'false');
});

it('모달 안에서도 포커스를 유지하고 옵션 클릭이 폼 제출로 이어지지 않는다', () => {
  const onChange = jest.fn(); const onSubmit = jest.fn(event => event.preventDefault());
  render(<form onSubmit={onSubmit}><ReceiptChoiceSelect label="입금방법" value="delegate" options={delegationChoices} onChange={onChange} /><button>등록</button></form>);
  fireEvent.click(screen.getByRole('combobox'));
  const direct = screen.getByRole('option', { name: '직불' });
  expect(fireEvent.mouseDown(direct)).toBe(false);
  fireEvent.click(direct);
  expect(onChange).toHaveBeenCalledWith('direct'); expect(onSubmit).not.toHaveBeenCalled();
});

it('입력표가 저장 중이면 필드셋으로 잠긴 선택창을 열거나 바꾸지 않는다', () => {
  const onChange = jest.fn();
  render(<fieldset disabled><ReceiptChoiceSelect label="입금방법" value="delegate" options={delegationChoices} onChange={onChange} /></fieldset>);
  fireEvent.click(screen.getByRole('combobox')); fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
});

it('바깥 클릭과 Tab으로 선택창이 닫힌다', () => {
  render(<ReceiptChoiceSelect label="입금방법" value="direct" options={delegationChoices} onChange={jest.fn()} />);
  const control = screen.getByRole('combobox');
  fireEvent.click(control); fireEvent.pointerDown(document.body); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(control); fireEvent.keyDown(control, { key: 'Tab' }); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
