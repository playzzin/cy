import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CardStatementFilesDialog from './CardStatementFilesDialog';
import { cardStatementAttachmentService, type CardStatementAttachmentLink } from '../../services/cardStatementAttachmentService';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';

jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));

jest.mock('../../services/cardStatementAttachmentService', () => ({
  cardStatementAttachmentService: { resolve: jest.fn() },
  getCardStatementFileName: (path: string) => path.split('/').pop() || '청구서 파일',
  getCardStatementAttachmentError: () => '파일 조회 권한을 확인해 주세요.',
}));
const resolve = jest.mocked(cardStatementAttachmentService.resolve);
beforeEach(() => { resolve.mockImplementation(async path => ({ url: `https://example.com/${path}`, release: jest.fn() })); });

test('offers all unique files and opens only the selected original through a native link', async () => {
  render(<CardStatementFilesDialog paths={['folder/first.pdf', 'folder/second.pdf', 'folder/first.pdf', '']} onClose={jest.fn()} />);
  expect(screen.getByText('연결된 2개 파일 중 확인할 원본을 선택해 주세요.')).toBeInTheDocument();
  const link = await screen.findByRole('link', { name: '새 탭에서 원본 열기' });
  expect(link).toHaveAttribute('href', 'https://example.com/folder/second.pdf');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  fireEvent.click(screen.getByRole('button', { name: '1. first.pdf' }));
  await waitFor(() => expect(screen.getByRole('link', { name: '새 탭에서 원본 열기' })).toHaveAttribute('href', 'https://example.com/folder/first.pdf'));
  expect(screen.getByRole('link', { name: '현재 탭에서 열기' })).toHaveAttribute('target', '_self');
});

test('explains failed reads and retries without closing the file list', async () => {
  resolve.mockRejectedValueOnce({ code: 'storage/unauthorized' });
  render(<CardStatementFilesDialog paths={['folder/first.pdf']} fileNames={{ 'folder/first.pdf': '원본 청구서.pdf' }} onClose={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('파일 조회 권한');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '1. 원본 청구서.pdf' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('link', { name: '새 탭에서 원본 열기' })).toBeInTheDocument();
  expect(resolve).toHaveBeenCalledTimes(2);
});

test('links a ledger attachment to its own month and encoded detail source even when the original fails to load', async () => {
  resolve.mockRejectedValueOnce({ code: 'storage/unauthorized' });
  const path = 'card-ledger-statements/2026-08/card/row/카드 & 명세서.pdf';
  render(<CardStatementFilesDialog paths={[path]} onClose={jest.fn()} />);
  await screen.findByRole('alert');
  const link = screen.getByRole('link', { name: 'Gemini 분석 · 상세내역 보기' });
  const target = new URL(link.getAttribute('href')!, 'http://localhost');
  expect(target.pathname).toBe('/support/cards/statements');
  expect(target.searchParams.get('month')).toBe('2026-08');
  expect(target.searchParams.get('storagePath')).toBe(path);
});

test('releases stale asynchronous files and the active object URL on unmount', async () => {
  let finish!: (link: CardStatementAttachmentLink) => void;
  const staleRelease = jest.fn();
  const activeRelease = jest.fn();
  resolve.mockImplementationOnce(() => new Promise(result => { finish = result; }))
    .mockResolvedValueOnce({ url: 'blob:active', release: activeRelease });
  const view = render(<CardStatementFilesDialog paths={['first.pdf', 'second.pdf']} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '1. first.pdf' }));
  expect(await screen.findByRole('link', { name: '새 탭에서 원본 열기' })).toHaveAttribute('href', 'blob:active');
  await act(async () => { finish({ url: 'blob:stale', release: staleRelease }); });
  expect(staleRelease).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: '새 탭에서 원본 열기' })).toHaveAttribute('href', 'blob:active');
  view.unmount();
  expect(activeRelease).toHaveBeenCalledTimes(1);
});

test('empty attachments never make a request and the dialog can close', () => {
  const onClose = jest.fn();
  render(<CardStatementFilesDialog paths={[]} onClose={onClose} />);
  expect(resolve).not.toHaveBeenCalled();
  expect(screen.getByText(/연결된 파일이 없습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '청구서 파일 닫기' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('explains how to leave the sample account when file access is refused', async () => {
  window.history.replaceState({}, '', '/support/cards?view=ledger&devAdmin=1#statement');
  jest.mocked(isDevAdminSessionEnabled).mockReturnValue(true);
  resolve.mockRejectedValue({ code: 'storage/unauthorized' });
  render(<CardStatementFilesDialog paths={['statement.pdf']} onClose={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('개발용 샘플 계정');
  expect(screen.getByRole('alert')).toHaveTextContent('실제 파일 조회용 로그인이 아닙니다');
  expect(screen.getByRole('link', { name: '실제 계정으로 돌아가기' })).toHaveAttribute('href', '/support/cards?view=ledger&devAdmin=0#statement');
  window.history.replaceState({}, '', '/');
});
