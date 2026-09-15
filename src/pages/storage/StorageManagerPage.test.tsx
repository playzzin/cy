import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StorageManagerPage from './StorageManagerPage';
import { storageService, StorageItem } from '../../services/storageService';
import Swal from 'sweetalert2';

jest.mock('../../services/storageService', () => ({ storageService: {
    listFiles: jest.fn(), getDownloadUrl: jest.fn(), uploadFile: jest.fn(),
    createFolder: jest.fn(), deleteFile: jest.fn(), rename: jest.fn(), moveFile: jest.fn(),
} }));
jest.mock('sweetalert2', () => ({ __esModule: true, default: {
    fire: jest.fn(), mixin: jest.fn(() => ({ fire: jest.fn() })),
} }));
jest.mock('framer-motion', () => {
    const React = require('react');
    return {
        AnimatePresence: ({ children }: any) => children,
        motion: { div: React.forwardRef(({ children, layout, layoutId, initial, animate, exit, transition, ...props }: any, ref: any) => <div ref={ref} {...props}>{children}</div>) },
    };
});

const folder: StorageItem = { name: 'documents', fullPath: 'documents', isFolder: true };
const file: StorageItem = { name: 'example.pdf', fullPath: 'documents/example.pdf', isFolder: false };
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => { resolve = res; });
    return { promise, resolve };
};

beforeEach(() => { jest.clearAllMocks(); });

test('denied listing stays an error, disables writes and retries successfully', async () => {
    (storageService.listFiles as jest.Mock)
        .mockRejectedValueOnce({ code: 'storage/unauthorized' })
        .mockResolvedValueOnce([folder]);
    render(<StorageManagerPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('접근할 권한이 없습니다');
    expect(screen.queryByText('이 폴더는 비어 있습니다')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '파일 업로드' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '새 폴더' })).toBeDisabled();
    expect(Swal.fire).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('documents')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '파일 업로드' })).toBeEnabled();
});

test('loading, an empty folder and no search results are distinct states', async () => {
    const pending = deferred<StorageItem[]>();
    (storageService.listFiles as jest.Mock).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([]);
    render(<StorageManagerPage />);
    expect(screen.getByText('목록 확인 중')).toBeInTheDocument();
    expect(screen.queryByText('이 폴더는 비어 있습니다')).not.toBeInTheDocument();
    await act(async () => pending.resolve([folder]));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 폴더 검색' }), { target: { value: 'missing' } });
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '현재 폴더 검색' }), { target: { value: '' } });
    fireEvent.click(screen.getByText('documents'));
    expect(await screen.findByText('이 폴더는 비어 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장소 홈' })).toBeEnabled();
});

test('late folder response cannot overwrite the newly selected home', async () => {
    const pending = deferred<StorageItem[]>();
    (storageService.listFiles as jest.Mock)
        .mockResolvedValueOnce([folder])
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce([{ name: 'root.pdf', fullPath: 'root.pdf', isFolder: false }]);
    render(<StorageManagerPage />);
    fireEvent.click(await screen.findByText('documents'));
    await waitFor(() => expect(storageService.listFiles).toHaveBeenLastCalledWith('documents'));
    fireEvent.click(screen.getByRole('button', { name: '저장소 홈' }));
    expect(await screen.findByText('root.pdf')).toBeInTheDocument();
    await act(async () => pending.resolve([file]));
    expect(screen.getByText('root.pdf')).toBeInTheDocument();
    expect(screen.queryByText('example.pdf')).not.toBeInTheDocument();
});

test('folder errors clear stale items and leave home navigation available', async () => {
    (storageService.listFiles as jest.Mock).mockResolvedValueOnce([folder]).mockRejectedValueOnce({ code: 'storage/retry-limit-exceeded' });
    render(<StorageManagerPage />);
    fireEvent.click(await screen.findByText('documents'));
    expect(await screen.findByRole('alert')).toHaveTextContent('연결 시간이 초과되었습니다');
    expect(screen.queryByRole('button', { name: 'documents 작업 메뉴' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장소 홈' })).toBeEnabled();
});

test('the action menu button opens actions without opening the file', async () => {
    (storageService.listFiles as jest.Mock).mockResolvedValueOnce([file]);
    render(<StorageManagerPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'example.pdf 작업 메뉴' }));
    expect(screen.getByRole('button', { name: 'Open / Download' })).toBeInTheDocument();
    expect(storageService.getDownloadUrl).not.toHaveBeenCalled();
});
