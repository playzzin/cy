import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { saveAs } from 'file-saver';
import WorkerIdImageShare from './WorkerIdImageShare';
import { imageFileFromUrl } from '../../utils/imageFileDelivery';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: (_storage: unknown, path: string) => path, getDownloadURL: async (path: string) => path }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/imageFileDelivery', () => ({ ...jest.requireActual('../../utils/imageFileDelivery'), imageFileFromUrl: jest.fn() }));

const workers = [
    { id: 'one', name: '테스트 가', fileNameSaved: 'one.jpg' },
    { id: 'two', name: '테스트 나', fileNameSaved: 'two.png' },
];
const share = jest.fn();
const canShare = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    share.mockResolvedValue(undefined);
    canShare.mockReturnValue(true);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn((file: File) => `blob:${file.name}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    (imageFileFromUrl as jest.Mock).mockImplementation(async (url: string, name: string) =>
        new File([url], `${name}.${url.endsWith('.jpg') ? 'jpg' : 'png'}`, { type: url.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }));
});

async function prepare() {
    fireEvent.click(screen.getByRole('button', { name: '신분증 사진 공유' }));
    await screen.findByText(/사진 \d+장을 준비했습니다/);
}

test('선택한 신분증을 준비하고 다음 클릭에서 원본 사진 여러 장만 함께 공유한다', async () => {
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    expect(share).not.toHaveBeenCalled();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 함께 공유' }));
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(['files']);
    expect(data.files.map((file: File) => [file.name, file.type])).toEqual([
        ['01_테스트 가_신분증.jpg', 'image/jpeg'], ['02_테스트 나_신분증.png', 'image/png'],
    ]);
    await waitFor(() => expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'share_image', fileCount: 2 })));
    expect(saveAs).not.toHaveBeenCalled();
});

test('여러 장 공유가 지원되지 않으면 개별 사진 공유와 저장을 제공한다', async () => {
    canShare.mockImplementation(({ files }) => files.length === 1);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    expect(screen.queryByRole('button', { name: '사진 2장 함께 공유' })).not.toBeInTheDocument();
    expect(screen.getByText(/함께 공유할 수 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '테스트 가 사진 저장' }));
    expect(saveAs).toHaveBeenCalledWith(expect.any(File), '01_테스트 가_신분증.jpg');
    fireEvent.click(screen.getByRole('button', { name: '테스트 나 사진 공유' }));
    expect(share.mock.calls[0][0].files).toHaveLength(1);
    await screen.findByText(/공유창 처리를 마쳤습니다/);
});

test.each(['AbortError', 'NotAllowedError'])('공유 %s는 자동 저장하거나 전송 성공으로 기록하지 않는다', async name => {
    share.mockRejectedValue(new DOMException('test', name));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 함께 공유' }));
    await screen.findByText(name === 'AbortError' ? /공유를 취소했습니다/ : /공유창을 열지 못했습니다/);
    expect(saveAs).not.toHaveBeenCalled();
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '사진 2장 함께 공유' })).toBeEnabled();
});

test('미등록과 불러오기 실패를 표시하고 준비된 사진 수만 명시해 공유한다', async () => {
    (imageFileFromUrl as jest.Mock).mockImplementation(async (url: string, name: string) => {
        if (url === 'two.png') throw new Error('load-failed');
        return new File(['synthetic'], `${name}.jpg`, { type: 'image/jpeg' });
    });
    render(<WorkerIdImageShare workers={[...workers, { id: 'none', name: '테스트 없음' }]} />);
    await prepare();
    expect(screen.getByText(/신분증 미등록 1명: 테스트 없음/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('불러오기 실패 1명: 테스트 나');
    fireEvent.click(screen.getByRole('button', { name: '사진 1장 함께 공유' }));
    expect(share.mock.calls[0][0].files).toHaveLength(1);
    await screen.findByText(/공유창 처리를 마쳤습니다/);
});

test('선택이 바뀌면 준비된 사진을 폐기하고 이전 선택을 공유하지 않는다', async () => {
    const { rerender } = render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    rerender(<WorkerIdImageShare workers={[workers[1]]} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 1장 함께 공유' }));
    expect(share.mock.calls[0][0].files[0].name).toBe('01_테스트 나_신분증.png');
    await screen.findByText(/공유창 처리를 마쳤습니다/);
});

test('준비 도중 닫으면 요청을 취소하고 뒤늦은 사진을 노출하지 않는다', async () => {
    let resolveFile!: (file: File) => void;
    (imageFileFromUrl as jest.Mock).mockImplementationOnce(() => new Promise<File>(resolve => { resolveFile = resolve; }));
    render(<WorkerIdImageShare workers={workers} />);
    fireEvent.click(screen.getByRole('button', { name: '신분증 사진 공유' }));
    await waitFor(() => expect(imageFileFromUrl).toHaveBeenCalledTimes(1));
    const signal = (imageFileFromUrl as jest.Mock).mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유 닫기' }));
    expect(signal.aborted).toBe(true);
    resolveFile(new File(['synthetic'], 'test.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(share).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('선택이 없거나 사진이 없는 경우 공유를 실행하지 않는다', async () => {
    const { rerender } = render(<WorkerIdImageShare workers={[]} />);
    expect(screen.getByRole('button', { name: '신분증 사진 공유' })).toBeDisabled();
    rerender(<WorkerIdImageShare workers={[{ id: 'none', name: '테스트 없음' }]} />);
    fireEvent.click(screen.getByRole('button', { name: '신분증 사진 공유' }));
    await screen.findByText('공유할 신분증 사진이 없습니다.');
    expect(share).not.toHaveBeenCalled();
});
