import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickMemoEditor } from './QuickMemoEditor';

let mockUser = { uid: 'viewer', email: 'viewer@example.test' };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));
const mockStore = {
    memos: [] as any[],
    addMemo: jest.fn(), updateMemo: jest.fn(), subscribeMemos: jest.fn()
};
jest.mock('../../features/smart-memo/store/useMemoStore', () => ({ useMemoStore: () => mockStore }));

const ownMemo = { id: 'own', userId: 'viewer', title: 'Quick Note', content: '기존 메모', color: 'yellow', isPinned: false, updatedAt: 10 };
const sharedMemo = { id: 'shared', userId: 'other', title: '공통 업무', content: '공통 내용', scope: 'public', color: 'yellow' };
const editor = () => screen.getByRole('textbox');

beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'viewer', email: 'viewer@example.test' };
    mockStore.memos = [];
    mockStore.addMemo.mockResolvedValue('created');
    mockStore.updateMemo.mockResolvedValue(undefined);
    mockStore.subscribeMemos.mockReturnValue(() => undefined);
});

it('does not create a blank note when public memos arrive before private memos', async () => {
    const { rerender, unmount } = render(<QuickMemoEditor />);
    mockStore.memos = [sharedMemo];
    rerender(<QuickMemoEditor />);
    expect(mockStore.addMemo).not.toHaveBeenCalled();
    mockStore.memos = [sharedMemo, ownMemo];
    rerender(<QuickMemoEditor />);
    expect(editor()).toHaveValue('기존 메모');
    unmount();
    render(<QuickMemoEditor />);
    expect(mockStore.addMemo).not.toHaveBeenCalled();
});

it('only opens the signed-in user’s quick notes and recognizes legacy email ownership', () => {
    mockStore.memos = [
        { ...ownMemo, id: 'foreign', userId: 'other', content: '다른 사용자', updatedAt: 30 },
        { ...ownMemo, userId: 'VIEWER@example.test' }
    ];
    render(<QuickMemoEditor />);
    expect(editor()).toHaveValue('기존 메모');
    expect(mockStore.addMemo).not.toHaveBeenCalled();
});

it('keeps empty drafts local and saves the first entered content as one note', async () => {
    const { unmount } = render(<QuickMemoEditor />);
    fireEvent.click(screen.getByRole('button', { name: '새 메모 작성' }));
    await act(async () => undefined);
    expect(mockStore.addMemo).not.toHaveBeenCalled();
    fireEvent.change(editor(), { target: { value: '첫 내용' } });
    unmount();
    await waitFor(() => expect(mockStore.addMemo).toHaveBeenCalledTimes(1));
    expect(mockStore.addMemo).toHaveBeenCalledWith(expect.objectContaining({ title: 'Quick Note', content: '첫 내용' }), 'viewer');
});

it('retains edits made while the first save is in flight without creating another note', async () => {
    let finish!: (id: string) => void;
    mockStore.addMemo.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<QuickMemoEditor />);
    fireEvent.change(editor(), { target: { value: '첫 내용' } });
    await waitFor(() => expect(mockStore.addMemo).toHaveBeenCalledTimes(1));
    fireEvent.change(editor(), { target: { value: '계속 작성한 내용' } });
    mockStore.memos = [ownMemo];
    rerender(<QuickMemoEditor />);
    expect(editor()).toHaveValue('계속 작성한 내용');
    await act(async () => finish('created'));
    await waitFor(() => expect(mockStore.updateMemo).toHaveBeenCalledWith('created', expect.objectContaining({ content: '계속 작성한 내용' })));
    expect(mockStore.addMemo).toHaveBeenCalledTimes(1);
});

it('saves an existing draft before starting a new local note and preserves it on failure', async () => {
    mockStore.memos = [ownMemo];
    mockStore.updateMemo.mockRejectedValue(new Error('offline'));
    render(<QuickMemoEditor />);
    fireEvent.change(editor(), { target: { value: '저장할 내용' } });
    fireEvent.click(screen.getByRole('button', { name: '새 메모 작성' }));
    await waitFor(() => expect(mockStore.updateMemo).toHaveBeenCalledWith('own', expect.objectContaining({ content: '저장할 내용' })));
    expect(editor()).toHaveValue('저장할 내용');
    expect(mockStore.addMemo).not.toHaveBeenCalled();
    mockStore.updateMemo.mockResolvedValue(undefined);
    fireEvent.click(await screen.findByRole('button', { name: '다시 저장' }));
    await screen.findByText('저장됨');
    fireEvent.click(screen.getByRole('button', { name: '새 메모 작성' }));
    await waitFor(() => expect(editor()).toHaveValue(''));
    expect(mockStore.addMemo).not.toHaveBeenCalled();
});

it('flushes the previous account’s draft without writing it to the next account', async () => {
    mockStore.memos = [ownMemo];
    const { rerender } = render(<QuickMemoEditor />);
    fireEvent.change(editor(), { target: { value: '이전 계정 내용' } });
    mockUser = { uid: 'next-user', email: 'next@example.test' };
    rerender(<QuickMemoEditor />);
    await waitFor(() => expect(mockStore.updateMemo).toHaveBeenCalledWith('own', expect.objectContaining({ content: '이전 계정 내용' })));
    expect(editor()).toHaveValue('');
    expect(mockStore.addMemo).not.toHaveBeenCalled();
});
