import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { MemoPage } from './MemoPage';
import { canViewAllSmartMemos } from '../utils/memoAccess';
import { memoReminderService } from '../services/memoReminderService';

let mockSearch = '';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ search: mockSearch, key: 'test' }) }));

let mockCurrentUser: { uid: string; email: string } | null = { uid: 'viewer', email: 'viewer@example.test' };
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ currentUser: mockCurrentUser })
}));
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    addDoc: jest.fn(),
    collection: jest.fn((_db, path) => ({ path })),
    deleteDoc: jest.fn(),
    doc: jest.fn((_db, path, id) => ({ path, id })),
    onSnapshot: jest.fn(),
    query: jest.fn((ref, ...filters) => ({ ...ref, filters })),
    serverTimestamp: jest.fn(() => 123),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    where: jest.fn((field, _operator, value) => ({ field, value })),
    writeBatch: jest.fn()
}));

type Subscription = {
    ref: { path: string; id?: string; filters?: { field: string; value: string }[] };
    next: (snapshot: any) => void;
    error: (error: Error) => void;
    active: boolean;
};

const rows = [
    { id: 'own', userId: 'viewer', scope: 'private', title: '내 개인 메모', content: '내 본문' },
    { id: 'other', userId: 'other-user', scope: 'private', title: '다른 사람의 메모', content: '다른 본문', categoryId: 'other-category' },
    { id: 'shared', userId: 'other-user', scope: 'public', title: '공통 메모 제목', content: '공통 본문' },
    { id: 'checklist', userId: 'other-user', scope: 'private', type: 'checklist', title: '다른 체크리스트', checklistItems: [
        { id: 'item', text: '확인할 항목', isChecked: true, comments: [{ id: 'comment', text: '항목에 대한 댓글', createdAt: 1 }] }
    ] }
];
const snapshotFor = (items: typeof rows) => ({ docs: items.map(row => ({ id: row.id, data: () => row })) });

describe('smart memo dev access', () => {
    let subscriptions: Subscription[];
    let profile: Record<string, unknown>;
    let authors: { id: string; data: Record<string, unknown> }[];
    const authorSnapshot = () => ({ docs: authors.map(author => ({ id: author.id, data: () => author.data })) });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSearch = '';
        window.localStorage.clear();
        mockCurrentUser = { uid: 'viewer', email: 'viewer@example.test' };
        subscriptions = [];
        profile = { role: 'user', position: 'DEV', status: 'active' };
        authors = [
            { id: 'viewer', data: { uid: 'viewer', displayName: '개발 담당자', email: 'viewer@example.test' } },
            { id: 'other-user', data: { uid: 'other-user', displayName: '김메모', email: 'memo@example.test' } }
        ];
        (collection as jest.Mock).mockImplementation((_db, path) => ({ path }));
        (doc as jest.Mock).mockImplementation((_db, path, id) => ({ path, id }));
        (query as jest.Mock).mockImplementation((ref, ...filters) => ({ ...ref, filters }));
        (where as jest.Mock).mockImplementation((field, _operator, value) => ({ field, value }));
        (serverTimestamp as jest.Mock).mockReturnValue(123);
        (updateDoc as jest.Mock).mockResolvedValue(undefined);
        (onSnapshot as jest.Mock).mockImplementation((ref, next, error) => {
            const subscription = { ref, next, error, active: true };
            subscriptions.push(subscription);
            if (ref.path === 'users' && ref.id) next({ data: () => profile });
            else if (ref.path === 'users') next(authorSnapshot());
            else {
                const matchingRows = ref.path === 'smart_memos'
                    ? rows.filter(row => ref.filters.every(({ field, value }: { field: string; value: string }) => (
                        (row as Record<string, unknown>)[field] === value
                    )))
                    : [];
                next(snapshotFor(matchingRows));
            }
            return () => { subscription.active = false; };
        });
    });

    const allMemoSubscription = () => subscriptions.find(sub => (
        sub.active && sub.ref.path === 'smart_memos' && sub.ref.filters?.length === 0
    ));
    const authorSubscription = () => subscriptions.find(sub => sub.active && sub.ref.path === 'users' && !sub.ref.id);
    const changeProfile = (nextProfile: Record<string, unknown>) => {
        act(() => subscriptions.find(sub => sub.active && sub.ref.path === 'users')?.next({ data: () => nextProfile }));
    };

    it('opens the memo identified by a notification link', async () => {
        mockSearch = '?memoId=other';
        render(<MemoPage />);
        const panel = await screen.findByLabelText('다른 사용자 메모 읽기 전용');
        expect(within(panel).getByText('다른 본문')).toBeInTheDocument();
    });

    it('explains when the notification points to an unavailable memo', async () => {
        mockSearch = '?memoId=removed';
        render(<MemoPage />);
        expect(await screen.findByText('알림의 메모를 찾을 수 없거나 조회 권한이 없습니다.')).toBeInTheDocument();
    });

    it('lets dev configure a personal repeating reminder on a read-only memo', async () => {
        const save = jest.spyOn(memoReminderService, 'save').mockResolvedValue(undefined);
        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '다른 사람의 메모 알림 설정' }));
        const dialog = screen.getByRole('dialog', { name: '알림 설정' });
        expect(within(dialog).getByText('다른 사람의 메모')).toBeInTheDocument();
        fireEvent.change(within(dialog).getByLabelText('반복 주기'), { target: { value: 'weekly' } });
        fireEvent.click(within(dialog).getByRole('button', { name: '알림 저장' }));
        await waitFor(() => expect(save).toHaveBeenCalledWith('other', expect.any(Number), 'weekly'));
        expect(updateDoc).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        save.mockRestore();
    });

    it.each(['dev', 'DEV', ' Dev ', 'developer', '개발자'])('recognizes the %s position', position => {
        expect(canViewAllSmartMemos({ role: 'user', position })).toBe(true);
    });

    it('accepts an additional dev position and excludes non-dev or inactive profiles', () => {
        expect(canViewAllSmartMemos({ additionalPositions: ['일반', 'DEV'] })).toBe(true);
        expect(canViewAllSmartMemos({ role: 'DEV' })).toBe(true);
        expect(canViewAllSmartMemos({ role: 'admin', position: '사장' })).toBe(false);
        expect(canViewAllSmartMemos({ position: 'dev', status: 'suspended' })).toBe(false);
        expect(canViewAllSmartMemos(null)).toBe(false);
    });

    it('loads all users for dev and shows other private memos as read-only', async () => {
        render(<MemoPage />);
        expect(allMemoSubscription()).toBeDefined();
        expect(screen.getByText('DEV · 전체 사용자 메모 조회')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '다른 사람의 메모' } });
        const panel = await screen.findByLabelText('다른 사용자 메모 읽기 전용');
        expect(within(panel).getByText('다른 본문')).toBeTruthy();
        expect(within(panel).queryByRole('textbox')).toBeNull();
        expect(screen.getByLabelText('다른 사람의 메모 선택')).toBeDisabled();
        expect(screen.getByRole('button', { name: '전체 선택' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: '메모 삭제' }));
        fireEvent.click(screen.getByRole('button', { name: '다른 사람의 메모 중요 메모로 고정' }));
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 750)); });
        expect(updateDoc).not.toHaveBeenCalled();
        expect(writeBatch).not.toHaveBeenCalled();
    });

    it('preserves editing for own and shared memos and excludes other users from bulk selection', async () => {
        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '전체 선택' }));
        expect(screen.getByLabelText('내 개인 메모 선택')).toBeChecked();
        expect(screen.getByLabelText('공통 메모 제목 선택')).toBeChecked();
        expect(screen.getByLabelText('다른 사람의 메모 선택')).not.toBeChecked();
        for (const title of ['내 개인 메모', '공통 메모 제목']) {
            fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: title } });
            expect(await screen.findByRole('textbox', { name: '메모 제목과 본문' })).toBeTruthy();
            expect(screen.getByRole('button', { name: '선택한 메모 삭제' })).not.toBeDisabled();
        }
        fireEvent.change(screen.getByRole('textbox', { name: '메모 제목과 본문' }), { target: { value: '공통 메모 제목\n수정 본문' } });
        await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(
            { path: 'smart_memos', id: 'shared' }, expect.objectContaining({ content: '수정 본문' })
        ));
    });

    it('keeps other users read-only in sticky view including checklist comments', async () => {
        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '스티커 보기' }));
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '다른 체크리스트' } });
        fireEvent.click(screen.getByRole('button', { name: '다른 체크리스트 내용 열기' }));
        const card = screen.getByRole('article', { name: '다른 체크리스트 스티커 메모' });
        expect(within(card).getByText('확인할 항목')).toBeTruthy();
        expect(within(card).getByText('항목에 대한 댓글')).toBeTruthy();
        expect(within(card).queryByRole('textbox')).toBeNull();
        fireEvent.click(within(card).getByRole('button', { name: '다른 체크리스트 메모 작업 더보기' }));
        expect(within(card).getByRole('menuitem', { name: '다른 체크리스트 메모 삭제' })).toBeDisabled();
        expect(within(card).getByRole('menuitem', { name: '다른 체크리스트 중요 메모로 고정' })).toBeDisabled();
        expect(within(card).getByRole('menuitem', { name: '다른 체크리스트 메모 복사' })).not.toBeDisabled();
        expect(updateDoc).not.toHaveBeenCalled();
    });

    it('keeps ordinary users on their own and public queries', () => {
        profile = { role: 'admin', position: '일반' };
        render(<MemoPage />);
        expect(allMemoSubscription()).toBeUndefined();
        expect(authorSubscription()).toBeUndefined();
        expect(screen.queryByRole('combobox', { name: '메모 사용자 선택' })).toBeNull();
        expect(screen.queryByText('다른 사람의 메모')).toBeNull();
        expect(screen.getByText('내 개인 메모')).toBeTruthy();
        expect(screen.getByText('공통 메모 제목')).toBeTruthy();
    });

    it('selects a named user, combines search and returns to all users', async () => {
        render(<MemoPage />);
        const filter = screen.getByRole('combobox', { name: '메모 사용자 선택' });
        expect(within(filter).getByRole('option', { name: '김메모 (memo@example.test) · 3개' })).toBeInTheDocument();
        fireEvent.change(filter, { target: { value: 'author:other-user' } });
        await waitFor(() => expect(screen.queryByText('내 개인 메모')).not.toBeInTheDocument());
        expect(screen.getByLabelText('다른 사람의 메모 선택')).toBeDisabled();
        expect(screen.getByText('공통 메모 제목')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '다른 본문' } });
        expect(screen.queryByText('공통 메모 제목')).not.toBeInTheDocument();
        expect(screen.getAllByText('다른 사람의 메모').length).toBeGreaterThan(0);
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '' } });
        fireEvent.change(filter, { target: { value: '' } });
        expect(await screen.findByText('내 개인 메모')).toBeInTheDocument();
    });

    it('filters sticky cards and handles users with no memos', async () => {
        authors.push({ id: 'empty-user', data: { displayName: '메모 없는 사용자' } });
        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '스티커 보기' }));
        const filter = screen.getByRole('combobox', { name: '메모 사용자 선택' });
        fireEvent.change(filter, { target: { value: 'author:other-user' } });
        await waitFor(() => expect(screen.queryByRole('article', { name: '내 개인 메모 스티커 메모' })).toBeNull());
        expect(screen.getAllByRole('article')).toHaveLength(3);
        fireEvent.change(filter, { target: { value: 'author:empty-user' } });
        await waitFor(() => expect(screen.queryAllByRole('article')).toHaveLength(0));
        expect(screen.getByText('표시할 메모가 없습니다.')).toBeInTheDocument();
    });

    it('saves the current draft before changing user and clears bulk selection', async () => {
        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '전체 선택' }));
        fireEvent.change(screen.getByRole('textbox', { name: '메모 제목과 본문' }), { target: { value: '내 개인 메모\n사용자 전환 전 수정' } });
        fireEvent.change(screen.getByRole('combobox', { name: '메모 사용자 선택' }), { target: { value: 'author:other-user' } });
        await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ path: 'smart_memos', id: 'own' }, expect.objectContaining({ content: '사용자 전환 전 수정' })));
        await waitFor(() => expect(screen.getByRole('combobox', { name: '메모 사용자 선택' })).toHaveValue('author:other-user'));
        expect(screen.getByLabelText('공통 메모 제목 선택')).not.toBeChecked();
        expect(screen.queryByDisplayValue('내 개인 메모\n사용자 전환 전 수정')).toBeNull();
    });

    it('keeps the selected user and draft when saving before a switch fails', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (updateDoc as jest.Mock).mockRejectedValue(new Error('offline'));
        render(<MemoPage />);
        fireEvent.change(screen.getByRole('textbox', { name: '메모 제목과 본문' }), { target: { value: '내 개인 메모\n저장할 내용' } });
        fireEvent.change(screen.getByRole('combobox', { name: '메모 사용자 선택' }), { target: { value: 'author:other-user' } });
        expect(await screen.findByText('메모를 저장하지 못했습니다.')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: '메모 사용자 선택' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: '메모 제목과 본문' })).toHaveValue('내 개인 메모\n저장할 내용');
        errorSpy.mockRestore();
    });

    it('clears the user filter on role change and when opening a notification for another user', async () => {
        const { rerender } = render(<MemoPage />);
        fireEvent.change(screen.getByRole('combobox', { name: '메모 사용자 선택' }), { target: { value: 'author:viewer' } });
        await waitFor(() => expect(screen.queryByText('공통 메모 제목')).toBeNull());
        mockSearch = '?memoId=other';
        rerender(<MemoPage />);
        await waitFor(() => expect(screen.getByRole('combobox', { name: '메모 사용자 선택' })).toHaveValue(''));
        expect(screen.getByLabelText('다른 사용자 메모 읽기 전용')).toHaveTextContent('다른 본문');
        fireEvent.change(screen.getByRole('combobox', { name: '메모 사용자 선택' }), { target: { value: 'author:other-user' } });
        await waitFor(() => expect(screen.getByRole('combobox', { name: '메모 사용자 선택' })).toHaveValue('author:other-user'));
        changeProfile({ role: 'user', position: '일반' });
        expect(screen.queryByRole('combobox', { name: '메모 사용자 선택' })).toBeNull();
        changeProfile({ role: 'user', position: 'DEV' });
        expect(screen.getByRole('combobox', { name: '메모 사용자 선택' })).toHaveValue('');
    });

    it('clears other users when dev is removed and ignores stale listener results', () => {
        render(<MemoPage />);
        const oldSubscription = allMemoSubscription()!;
        changeProfile({ role: 'user', position: '일반' });
        expect(oldSubscription.active).toBe(false);
        expect(allMemoSubscription()).toBeUndefined();
        act(() => oldSubscription.next(snapshotFor(rows)));
        expect(screen.queryByText('다른 사람의 메모')).toBeNull();
        expect(screen.queryByText('DEV · 전체 사용자 메모 조회')).toBeNull();
    });

    it('clears all-user results when their query fails', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<MemoPage />);
        act(() => allMemoSubscription()!.error(new Error('permission-denied')));
        expect(screen.queryByText('다른 사람의 메모')).toBeNull();
        expect(screen.getByText('전체 사용자 메모를 불러오지 못했습니다.')).toBeTruthy();
        errorSpy.mockRestore();
    });

    it('clears private memos and subscriptions on logout', () => {
        const { rerender } = render(<MemoPage />);
        const oldSubscription = allMemoSubscription()!;
        mockCurrentUser = null;
        rerender(<MemoPage />);
        expect(subscriptions.every(sub => !sub.active)).toBe(true);
        act(() => oldSubscription.next(snapshotFor(rows)));
        expect(screen.queryByText('다른 사람의 메모')).toBeNull();
        expect(screen.queryByText('내 개인 메모')).toBeNull();
        expect(screen.queryByText('DEV · 전체 사용자 메모 조회')).toBeNull();
    });

    it('falls back to own and shared memos when the profile listener fails', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<MemoPage />);
        act(() => subscriptions.find(sub => sub.active && sub.ref.path === 'users')!.error(new Error('unavailable')));
        expect(allMemoSubscription()).toBeUndefined();
        expect(screen.queryByText('다른 사람의 메모')).toBeNull();
        expect(screen.getByText('내 개인 메모')).toBeTruthy();
        errorSpy.mockRestore();
    });

    it('shows the author name in the list and read-only detail with email for identification', () => {
        render(<MemoPage />);
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '다른 사람의 메모' } });
        const labels = screen.getAllByText('작성자: 김메모 · 읽기 전용');
        expect(labels).toHaveLength(2);
        labels.forEach(label => expect(label).toHaveAttribute('title', '작성자: 김메모 (memo@example.test) · 읽기 전용'));
        expect(screen.getByLabelText('다른 사용자 메모 읽기 전용')).toHaveTextContent('작성자: 김메모');
    });

    it('searches by author name or email and displays authors in sticky view', async () => {
        render(<MemoPage />);
        expect(screen.getByLabelText('메모 검색')).toHaveAttribute('placeholder', '제목, 내용, 작성자, 카테고리 검색');
        for (const value of ['김메모', 'MEMO@example.test']) {
            fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value } });
            expect(screen.queryByText('내 개인 메모')).toBeNull();
            expect(screen.getAllByText('다른 사람의 메모').length).toBeGreaterThan(0);
            expect(screen.getByText('공통 메모 제목')).toBeTruthy();
        }
        fireEvent.click(screen.getByRole('button', { name: '스티커 보기' }));
        const otherCard = screen.getByRole('article', { name: '다른 사람의 메모 스티커 메모' });
        expect(within(otherCard).getByText('작성자: 김메모 · 읽기 전용')).toBeTruthy();
        const sharedCard = screen.getByRole('article', { name: '공통 메모 제목 스티커 메모' });
        fireEvent.click(within(sharedCard).getByRole('button', { name: '공통 메모 제목 내용 열기' }));
        expect(await within(sharedCard).findByPlaceholderText('제목')).toHaveValue('공통 메모 제목');
        expect(within(sharedCard).getByText('작성자: 김메모')).toBeTruthy();
    });

    it('updates names and falls back to email or user ID when author information is missing', () => {
        render(<MemoPage />);
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '다른 사람의 메모' } });
        const subscription = authorSubscription()!;
        authors = [{ id: 'other-user', data: { displayName: '변경된 이름', email: 'memo@example.test' } }];
        act(() => subscription.next(authorSnapshot()));
        expect(screen.getAllByText('작성자: 변경된 이름 · 읽기 전용')).toHaveLength(2);
        authors = [{ id: 'other-user', data: { displayName: ' ', email: 'memo@example.test' } }];
        act(() => subscription.next(authorSnapshot()));
        expect(screen.getAllByText('작성자: memo@example.test · 읽기 전용')).toHaveLength(2);
        authors = [];
        act(() => subscription.next(authorSnapshot()));
        expect(screen.getAllByText('작성자: 사용자 ID: other-user · 읽기 전용')).toHaveLength(2);
    });

    it('cleans up the author directory on role removal and ignores stale directory results', () => {
        render(<MemoPage />);
        const oldSubscription = authorSubscription()!;
        changeProfile({ role: 'user', position: '일반' });
        expect(oldSubscription.active).toBe(false);
        expect(authorSubscription()).toBeUndefined();
        act(() => oldSubscription.next(authorSnapshot()));
        expect(screen.queryByText(/작성자: 김메모/)).toBeNull();
    });

    it('keeps memos readable with user IDs when author lookup fails', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<MemoPage />);
        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '다른 사람의 메모' } });
        act(() => authorSubscription()!.error(new Error('unavailable')));
        expect(screen.getAllByText('작성자: 사용자 ID: other-user · 읽기 전용')).toHaveLength(2);
        expect(screen.getByText('다른 본문')).toBeTruthy();
        expect(updateDoc).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
