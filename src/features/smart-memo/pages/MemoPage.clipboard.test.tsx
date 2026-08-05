import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

describe('MemoPage clipboard copy', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        delete (navigator as { clipboard?: unknown }).clipboard;
        window.localStorage.clear();
    });

    it('copies the title and body through the memo copy icon', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });
        window.localStorage.setItem(memoStorageKey, JSON.stringify([
            {
                id: 'copyable-memo',
                type: 'text',
                title: 'Copy title',
                content: 'Copy body',
                checklistItems: [],
                categoryId: null,
                order: 0
            }
        ]));

        render(<MemoPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Copy title 메모 복사' }));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith('Copy title\nCopy body');
        });
    });
});
