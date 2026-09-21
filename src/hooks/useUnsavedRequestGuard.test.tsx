import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { useUnsavedRequestGuard } from './useUnsavedRequestGuard';

function Draft() {
  useUnsavedRequestGuard(true);
  return <><input aria-label="미저장 입력" defaultValue="작성 중" /><Link to="/other">다른 메뉴</Link></>;
}
it('메뉴 이동 취소 시 입력을 보존하고 확인한 경우만 이동한다', () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<MemoryRouter><Routes><Route path="/" element={<Draft />} /><Route path="/other" element={<div>이동 완료</div>} /></Routes></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('미저장 입력'), { target: { value: '보존할 내용' } });
  fireEvent.click(screen.getByText('다른 메뉴'));
  expect(screen.getByLabelText('미저장 입력')).toHaveValue('보존할 내용');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText('다른 메뉴'));
  expect(screen.getByText('이동 완료')).toBeInTheDocument();
  confirm.mockRestore();
});
