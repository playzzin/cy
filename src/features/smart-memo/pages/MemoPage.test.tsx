import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { MemoPage } from './MemoPage';

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ currentUser: { uid: 'dev-admin' } })
}));

jest.mock('../../../config/firebase', () => ({
    db: {}
}));

jest.mock('firebase/firestore', () => ({
    addDoc: jest.fn(),
    collection: jest.fn(),
    deleteDoc: jest.fn(),
    doc: jest.fn(),
    onSnapshot: jest.fn(() => jest.fn()),
    query: jest.fn(),
    serverTimestamp: jest.fn(() => Date.now()),
    updateDoc: jest.fn(),
    where: jest.fn(),
    writeBatch: jest.fn(() => ({
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn()
    }))
}));

const memoStorageKey = 'cy-smart-memo-dev-admin-memos';
const categoryStorageKey = 'cy-smart-memo-dev-admin-categories';

const readStoredMemos = () => JSON.parse(window.localStorage.getItem(memoStorageKey) || '[]');
const readStoredCategories = () => JSON.parse(window.localStorage.getItem(categoryStorageKey) || '[]');

const waitForSavingUnlock = async () => {
    await act(async () => {
        await new Promise(resolve => window.setTimeout(resolve, 220));
    });
};

const createTextMemo = () => {
    fireEvent.click(screen.getByRole('button', { name: '새 메모 메뉴 열기' }));
    const createOption = screen.getByRole('menuitem', { name: '일반 메모' });
    fireEvent.click(createOption);
    return createOption;
};

describe('MemoPage dev-admin local storage mode', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        window.localStorage.clear();
    });

    it('creates, saves, persists, searches, and deletes a local memo', async () => {
        const title = 'CODEX_QA_MEMO';
        const { unmount } = render(<MemoPage />);

        createTextMemo();

        await waitFor(() => {
            expect(readStoredMemos()).toHaveLength(1);
        });

        const textarea = await screen.findByRole('textbox', { name: '메모 제목과 본문' });
        fireEvent.change(textarea, { target: { value: `${title}\nSaved body` } });

        await waitFor(() => {
            const saveButton = screen.getByRole('button', { name: /저장/ }) as HTMLButtonElement;
            expect(saveButton.disabled).toBe(false);
        });

        fireEvent.click(screen.getByRole('button', { name: /저장/ }));

        await waitFor(() => {
            expect(readStoredMemos().some((memo: { title?: string; content?: string }) => (
                memo.title === title && memo.content === 'Saved body'
            ))).toBe(true);
        });

        fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: title } });
        expect(screen.getByText(title)).toBeTruthy();

        await waitForSavingUnlock();
        unmount();

        const { unmount: unmountPersisted } = render(<MemoPage />);

        await waitFor(() => {
            expect(screen.getByText(title)).toBeTruthy();
        });

        const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
        fireEvent.click(screen.getByRole('button', { name: '선택한 메모 삭제' }));

        await waitFor(() => {
            expect(readStoredMemos().some((memo: { title?: string }) => memo.title === title)).toBe(false);
        });
        expect(confirmSpy).toHaveBeenCalled();

        unmountPersisted();
    });

    it('ignores rapid duplicate create clicks', async () => {
        const { unmount } = render(<MemoPage />);
        const createOption = createTextMemo();
        fireEvent.click(createOption);

        await waitFor(() => {
            expect(readStoredMemos()).toHaveLength(1);
        });

        await waitForSavingUnlock();
        unmount();
    });

    it('auto-saves memo changes after a short pause', async () => {
        render(<MemoPage />);
        createTextMemo();

        const textarea = await screen.findByRole('textbox', { name: '메모 제목과 본문' });
        fireEvent.change(textarea, { target: { value: '자동 저장 제목\n자동 저장 본문' } });

        await waitFor(() => {
            expect(readStoredMemos()).toEqual([
                expect.objectContaining({
                    title: '자동 저장 제목',
                    content: '자동 저장 본문'
                })
            ]);
        }, { timeout: 2500 });

        expect(screen.getAllByText('저장됨').length).toBeGreaterThan(0);
    });

    it('switches from the mobile list pane to the editor pane after selecting a memo', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'mobile-memo',
                type: 'text',
                title: '모바일 메모',
                content: '본문',
                checklistItems: [],
                categoryId: null,
                order: 0
            }
        ]));

        render(<MemoPage />);

        expect(screen.getByRole('tab', { name: '메모 목록' }).getAttribute('aria-selected')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: '모바일 메모 분류 없음' }));

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: '편집' }).getAttribute('aria-selected')).toBe('true');
        });
    });

    it('cycles a sticky memo from vertical expansion to a two-by-two size', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'large-sticky-memo',
                type: 'text',
                title: '크게 볼 메모',
                content: '크게 표시할 메모 본문입니다.',
                checklistItems: [],
                categoryId: null,
                order: 0
            }
        ]));

        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '스티커 보기' }));
        fireEvent.click(await screen.findByRole('button', { name: '크게 볼 메모 세로로 크게 보기' }));

        const stickyMemo = screen.getByLabelText('크게 볼 메모 스티커 메모');
        expect(stickyMemo.getAttribute('aria-expanded')).toBe('true');
        expect(stickyMemo.getAttribute('data-expansion-level')).toBe('1');
        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '크게 볼 메모 가로까지 더 크게 보기' }));
        expect(stickyMemo.getAttribute('data-expansion-level')).toBe('2');

        fireEvent.click(screen.getByRole('button', { name: '크게 볼 메모 원래 크기로' }));
        expect(stickyMemo.getAttribute('aria-expanded')).toBe('false');
        expect(stickyMemo.getAttribute('data-expansion-level')).toBe('0');
    });

    it('normalizes legacy category colors and persists a newly selected color', async () => {
        window.localStorage.setItem(categoryStorageKey, JSON.stringify([
            {
                id: 'legacy-category',
                name: '기존 카테고리',
                order: 0,
                color: 'gray'
            }
        ]));

        const { unmount } = render(<MemoPage />);

        fireEvent.click(screen.getByRole('button', { name: '기존 카테고리 카테고리 수정' }));
        const legacyColorPicker = screen.getByLabelText('기존 카테고리 카테고리 색상 선택');

        expect(within(legacyColorPicker).getByRole('button', {
            name: '카테고리 색상 #64748b'
        }).getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(within(legacyColorPicker).getByRole('button', { name: '카테고리 색상 #16a34a' }));
        fireEvent.click(screen.getByRole('button', { name: '기존 카테고리 카테고리 저장' }));

        await waitFor(() => {
            expect(readStoredCategories()).toEqual([
                expect.objectContaining({
                    id: 'legacy-category',
                    color: '#16a34a'
                })
            ]);
        });

        await waitForSavingUnlock();
        unmount();

        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '기존 카테고리 카테고리 수정' }));
        const persistedColorPicker = screen.getByLabelText('기존 카테고리 카테고리 색상 선택');

        expect(within(persistedColorPicker).getByRole('button', {
            name: '카테고리 색상 #16a34a'
        }).getAttribute('aria-pressed')).toBe('true');
    });

    it('shows categorized and uncategorized memos together in 전체보기', async () => {
        window.localStorage.setItem(categoryStorageKey, JSON.stringify([
            {
                id: 'work',
                name: '업무',
                order: 0,
                color: '#2563eb'
            }
        ]));
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'uncategorized-memo',
                type: 'text',
                title: '분류 없는 메모',
                content: '',
                checklistItems: [],
                categoryId: null,
                order: 0
            },
            {
                id: 'work-memo',
                type: 'text',
                title: '업무 메모',
                content: '',
                checklistItems: [],
                categoryId: 'work',
                order: 1
            }
        ]));

        render(<MemoPage />);

        expect(screen.getByRole('button', { name: '분류 없는 메모 분류 없음' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '업무 메모 업무' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '업무 1' }));
        expect(screen.queryByRole('button', { name: '분류 없는 메모 분류 없음' })).toBeNull();
        expect(screen.getByRole('button', { name: '업무 메모 업무' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '전체보기 2' }));
        expect(screen.getByRole('button', { name: '분류 없는 메모 분류 없음' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '업무 메모 업무' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: '분류 없음 1' })).toBeNull();
    });
});
