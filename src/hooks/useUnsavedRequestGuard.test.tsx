import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter, MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { useUnsavedRequestGuard } from './useUnsavedRequestGuard';
import { useMobileSidebarHistory } from './useMobileSidebarHistory';

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

function MobileDraft() {
  useUnsavedRequestGuard(true);
  const menu = useMobileSidebarHistory(true);
  return <><input aria-label="작성 내용" defaultValue="초안" />
    <button onClick={() => menu.setOpen(true)}>메뉴 열기</button>
    {menu.isOpen && <><button onClick={() => menu.setOpen(false)}>메뉴 닫기</button>
      <button onClick={() => menu.navigateFromMenu('/other')}>메뉴 이동</button></>}
  </>;
}

it('실제 브라우저 뒤로가기를 취소하면 URL과 입력을 유지하고, 확인한 경우만 이동한다', async () => {
  window.history.replaceState({ idx: 0, key: 'previous' }, '', '/other');
  window.history.pushState({ idx: 1, key: 'draft' }, '', '/draft');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const view = render(<BrowserRouter><Routes><Route path="/draft" element={<MobileDraft />} /><Route path="/other" element={<p>이전 화면</p>} /></Routes></BrowserRouter>);
  fireEvent.change(screen.getByLabelText('작성 내용'), { target: { value: '보존할 입력' } });
  act(() => window.history.back());
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(window.location.pathname).toBe('/draft');
  expect(screen.getByLabelText('작성 내용')).toHaveValue('보존할 입력');
  confirm.mockReturnValue(true);
  act(() => window.history.back());
  await screen.findByText('이전 화면');
  expect(window.location.pathname).toBe('/other');
  expect(confirm).toHaveBeenCalledTimes(2);
  view.unmount(); confirm.mockRestore();
  window.history.replaceState(null, '', '/');
});

it('작성 중 메뉴 열기와 닫기는 막지 않고 메뉴 이동 취소 후에도 닫을 수 있다', async () => {
  window.history.replaceState({ idx: 0, key: 'draft' }, '', '/draft');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const view = render(<BrowserRouter><Routes><Route path="/draft" element={<MobileDraft />} /><Route path="/other" element={<p>이전 화면</p>} /></Routes></BrowserRouter>);
  fireEvent.click(screen.getByText('메뉴 열기'));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('메뉴 이동'));
  expect(confirm).toHaveBeenCalledTimes(1);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByText('메뉴 닫기'));
  await waitFor(() => expect(screen.queryByText('메뉴 닫기')).not.toBeInTheDocument());
  expect(screen.getByLabelText('작성 내용')).toHaveValue('초안');
  expect(confirm).toHaveBeenCalledTimes(1);
  view.unmount(); confirm.mockRestore();
  window.history.replaceState(null, '', '/');
});
