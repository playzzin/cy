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
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn()
    }))
}));

const memoStorageKey = 'cy-smart-memo-dev-admin-memos';
const categoryStorageKey = 'cy-smart-memo-dev-admin-categories';
const viewModeStorageKey = 'cy-smart-memo-view-mode';
const stickyColumnCountStorageKey = 'cy-smart-memo-sticky-column-count';

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

    it('creates a memo in the shared category for every memo user', async () => {
        render(<MemoPage />);

        const sharedCategory = screen.getByRole('button', { name: /공통 메모.*0/ });
        expect(screen.queryByRole('button', { name: '공통 메모 카테고리 수정' })).toBeNull();
        expect(screen.queryByRole('button', { name: '공통 메모 카테고리 삭제' })).toBeNull();

        fireEvent.click(sharedCategory);
        createTextMemo();

        await waitFor(() => {
            expect(readStoredMemos()).toEqual([
                expect.objectContaining({
                    userId: 'dev-admin',
                    scope: 'public',
                    categoryId: 'public'
                })
            ]);
        });

        expect(screen.getByText('모든 사용자와 공유되는 공통 메모를 만들었습니다.')).toBeTruthy();
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

    it('returns to a saved status after hydrating an unchanged memo', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'unchanged-memo',
                type: 'text',
                title: '변경 없는 메모',
                content: '기존 본문',
                checklistItems: [],
                categoryId: null,
                order: 0
            }
        ]));

        render(<MemoPage />);

        await waitFor(() => {
            expect(screen.queryByText('자동 저장 대기')).toBeNull();
        });
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

    it('keeps a newly added checklist row while an earlier checklist change auto-saves', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'checklist-auto-save-memo',
                type: 'checklist',
                title: '체크리스트 자동 저장',
                content: '',
                checklistItems: [
                    { id: 'first-check-item', text: '첫 항목', isChecked: false }
                ],
                categoryId: null,
                order: 0
            }
        ]));

        render(<MemoPage />);

        const checklistTitleInput = screen.getByRole('textbox', { name: '체크리스트 제목' });
        expect(checklistTitleInput.className).toContain('h-9');
        expect(screen.getByLabelText('체크리스트 항목 편집 영역').className).toContain('p-2');

        fireEvent.click(await screen.findByRole('checkbox', { name: '첫 항목 완료 여부' }));
        fireEvent.click(screen.getByRole('button', { name: '항목 추가' }));

        expect(screen.getAllByPlaceholderText('할 일을 입력하세요')).toHaveLength(2);
        await waitFor(() => {
            expect(screen.getAllByPlaceholderText('할 일을 입력하세요')[1].matches(':focus')).toBe(true);
        });

        await act(async () => {
            await new Promise(resolve => window.setTimeout(resolve, 900));
        });

        expect(screen.getAllByPlaceholderText('할 일을 입력하세요')).toHaveLength(2);
        expect((screen.getByRole('checkbox', { name: '첫 항목 완료 여부' }) as HTMLInputElement).checked).toBe(true);
    });

    it('saves a dirty memo before creating the next memo', async () => {
        render(<MemoPage />);
        createTextMemo();

        await waitFor(() => {
            expect(readStoredMemos()).toHaveLength(1);
        });
        await waitForSavingUnlock();

        fireEvent.change(await screen.findByRole('textbox', { name: '메모 제목과 본문' }), {
            target: { value: '먼저 저장할 메모\n저장 후 새 메모 생성' }
        });
        createTextMemo();

        await waitFor(() => {
            expect(readStoredMemos()).toHaveLength(2);
        });
        expect(readStoredMemos()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: '먼저 저장할 메모',
                content: '저장 후 새 메모 생성'
            })
        ]));
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
            },
            {
                id: 'top-aligned-sticky-memo',
                type: 'checklist',
                title: '상단 정렬 메모',
                content: '',
                checklistItems: [
                    { id: 'top-aligned-item', text: '헤더 바로 아래 항목', isChecked: false }
                ],
                categoryId: null,
                order: 1
            }
        ]));

        render(<MemoPage />);
        fireEvent.click(screen.getByRole('button', { name: '스티커 보기' }));

        const stickyBoard = screen.getByLabelText('스티커 메모 목록');
        expect(stickyBoard.className).toContain('auto-rows-[360px]');

        const stickyMemoBody = await screen.findByRole('button', { name: '크게 볼 메모 내용 열기' });
        expect(stickyMemoBody.className).toContain('justify-start');
        expect(stickyMemoBody.className).toContain('items-stretch');
        expect(stickyMemoBody.className).toContain('p-2');

        fireEvent.click(await screen.findByRole('button', { name: '크게 볼 메모 세로로 크게 보기' }));

        const stickyMemo = screen.getByLabelText('크게 볼 메모 스티커 메모');
        const regularStickyMemo = screen.getByLabelText('상단 정렬 메모 스티커 메모');
        expect(stickyMemo.className).toContain('h-full');
        expect(regularStickyMemo.className).toContain('h-full');
        expect(stickyMemo.getAttribute('data-expansion-level')).toBe('1');
        expect(stickyMemo.className).toContain('row-span-2');
        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '크게 볼 메모 가로까지 더 크게 보기' }));
        expect(stickyMemo.getAttribute('data-expansion-level')).toBe('2');

        fireEvent.click(screen.getByRole('button', { name: '크게 볼 메모 원래 크기로' }));
        expect(stickyMemo.getAttribute('data-expansion-level')).toBe('0');
    });

    it('persists the selected default view and sticky column count', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'layout-preference-memo',
                type: 'text',
                title: '배치 확인 메모',
                content: '배치 확인용 본문',
                checklistItems: [],
                categoryId: null,
                order: 0
            }
        ]));

        const { unmount } = render(<MemoPage />);

        fireEvent.click(screen.getByRole('button', { name: '스티커 보기' }));
        fireEvent.click(await screen.findByRole('button', { name: '한 줄에 스티커 4개 보기' }));

        expect(window.localStorage.getItem(viewModeStorageKey)).toBe('sticky');
        expect(window.localStorage.getItem(stickyColumnCountStorageKey)).toBe('4');
        expect(screen.getByLabelText('스티커 메모 목록').getAttribute('data-column-count')).toBe('4');

        unmount();
        render(<MemoPage />);

        expect(screen.getByRole('button', { name: '스티커 보기' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: '한 줄에 스티커 4개 보기' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByLabelText('스티커 메모 목록').getAttribute('data-column-count')).toBe('4');
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

    it('restores a deleted memo from the undo notification', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'undo-memo',
                type: 'text',
                title: '복구할 메모',
                content: '삭제 후 다시 돌아와야 합니다.',
                checklistItems: [],
                categoryId: null,
                order: 0
            }
        ]));

        const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
        render(<MemoPage />);

        fireEvent.click(screen.getByRole('button', { name: '선택한 메모 삭제' }));

        await waitFor(() => {
            expect(readStoredMemos()).toHaveLength(0);
        });
        expect(confirmSpy).toHaveBeenCalled();
        expect(screen.getByText('1개 메모를 삭제했습니다.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));

        await waitFor(() => {
            expect(readStoredMemos()).toEqual([
                expect.objectContaining({ id: 'undo-memo', title: '복구할 메모' })
            ]);
        });
        expect(screen.queryByRole('button', { name: '실행 취소' })).toBeNull();
    });

    it('pins an important memo above newer memos and persists the state', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'older-important-memo',
                type: 'text',
                title: '중요한 과거 메모',
                content: '',
                checklistItems: [],
                categoryId: null,
                order: 1,
                updatedAt: 1
            },
            {
                id: 'newer-memo',
                type: 'text',
                title: '최근 메모',
                content: '',
                checklistItems: [],
                categoryId: null,
                order: 2,
                updatedAt: 2
            }
        ]));

        render(<MemoPage />);
        expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
            '최근 메모',
            '중요한 과거 메모'
        ]);

        fireEvent.click(screen.getByRole('button', { name: '중요한 과거 메모 중요 메모로 고정' }));

        await waitFor(() => {
            expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
                '중요한 과거 메모',
                '최근 메모'
            ]);
        });
        expect(readStoredMemos().find((memo: { id: string }) => memo.id === 'older-important-memo').isPinned).toBe(true);
    });

    it('sorts memos by title and persists the selected sort mode', async () => {
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'memo-b',
                type: 'text',
                title: '나 메모',
                content: '',
                checklistItems: [],
                categoryId: null,
                order: 2
            },
            {
                id: 'memo-a',
                type: 'text',
                title: '가 메모',
                content: '',
                checklistItems: [],
                categoryId: null,
                order: 1
            }
        ]));

        render(<MemoPage />);
        fireEvent.change(screen.getByLabelText('메모 정렬'), { target: { value: 'title-asc' } });

        expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
            '가 메모',
            '나 메모'
        ]);
        expect(window.localStorage.getItem('cy-smart-memo-sort-mode')).toBe('title-asc');
    });
});
