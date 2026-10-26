import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerIdImageShare from './WorkerIdImageShare';
import { readWorkerBankPhoto } from '../../services/workerBankPhotoService';
import { imageFileFromUrl } from '../../utils/imageFileDelivery';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';
import { openWindowsPhotoWindow } from '../../utils/windowsPhotoClipboard';
import { zipImageFiles } from '../../utils/imageBatchDownload';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('../../services/workerBankPhotoService', () => ({ readWorkerBankPhoto: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/imageFileDelivery', () => ({ ...jest.requireActual('../../utils/imageFileDelivery'), imageFileFromUrl: jest.fn() }));
jest.mock('../../utils/windowsPhotoClipboard', () => ({ ...jest.requireActual('../../utils/windowsPhotoClipboard'), openWindowsPhotoWindow: jest.fn() }));
jest.mock('../../utils/imageBatchDownload', () => ({ canSaveImageFolder: () => false, zipImageFiles: jest.fn() }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
const share = jest.fn();
const workers = [{ id: 'one', name: '가상 가', fileNameSaved: 'identity-only', bankPhotoId: 'basic-photo', directPayBankPhotoId: 'direct-photo' }, { id: 'two', name: '가상 나', bankPhotoId: 'basic-only' }];
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn((file: File) => `blob:${file.name}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    (readWorkerBankPhoto as jest.Mock).mockImplementation(async (id, name) => new File([`original-${id}`], `${name}.png`, { type: 'image/png' }));
    (openWindowsPhotoWindow as jest.Mock).mockResolvedValue({ opened: true, photoCount: 2 });
    share.mockResolvedValue(undefined);
});
async function prepare() {
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 공유' }));
    await screen.findByText(/사진 \d+장을 준비했습니다/);
}
test('직불용 통장사본은 서버에서 현재 원본을 조회해 모바일에 개별 사진 두 장을 함께 공유한다', async () => {
    render(<WorkerIdImageShare workers={workers} kind="bank" />);
    await prepare();
    expect(readWorkerBankPhoto).toHaveBeenCalledTimes(2); // No cached metadata or identity photo fallback.
    expect(readWorkerBankPhoto).toHaveBeenNthCalledWith(1, 'one', '01_가상 가_직불용 통장사본', expect.any(AbortSignal), 'directPay');
    expect(readWorkerBankPhoto).toHaveBeenNthCalledWith(2, 'two', '02_가상 나_직불용 통장사본', expect.any(AbortSignal), 'directPay');
    expect(imageFileFromUrl).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 함께 공유' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const files: File[] = share.mock.calls[0][0].files;
    expect(files.map(file => file.name)).toEqual(['01_가상 가_직불용 통장사본.png', '02_가상 나_직불용 통장사본.png']);
    expect(files.map(file => file.size)).toEqual([12, 12]);
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
});
test('Windows 끌어놓기에는 준비한 계좌 원본 전체를 전달한다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    render(<WorkerIdImageShare workers={workers} kind="bank" />); await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' }));
    await waitFor(() => expect(openWindowsPhotoWindow).toHaveBeenCalledTimes(1));
    expect((openWindowsPhotoWindow as jest.Mock).mock.calls[0][0].map((file: File) => file.name)).toEqual(['01_가상 가_직불용 통장사본.png', '02_가상 나_직불용 통장사본.png']);
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
});
test('미등록과 조회 실패를 구별하고 성공한 직불용 통장사본만 묶는다', async () => {
    (readWorkerBankPhoto as jest.Mock).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('permission-denied'));
    render(<WorkerIdImageShare workers={[...workers, { id: 'three', name: '가상 다' }]} kind="bank" />); await prepare();
    expect(screen.getByText(/직불용 통장사본 미등록 1명: 가상 가/)).toBeInTheDocument();
    expect(screen.getByText(/불러오기 실패 1명: 가상 나/)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(imageFileFromUrl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('PC 카카오톡으로 보내기'));
    (zipImageFiles as jest.Mock).mockResolvedValue(new File(['zip'], '계좌_사진.zip'));
    fireEvent.click(screen.getByRole('button', { name: '사진 1장 ZIP 저장' }));
    await waitFor(() => expect(zipImageFiles).toHaveBeenCalledWith([expect.objectContaining({ name: '03_가상 다_직불용 통장사본.png' })], '직불용 통장사본'));
});
test('직불용 통장사본이 없으면 신분증 대신 원본 등록을 안내한다', async () => {
    (readWorkerBankPhoto as jest.Mock).mockResolvedValue(null);
    render(<WorkerIdImageShare workers={workers} kind="bank" />);
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 공유' }));
    await screen.findByText(/직불용 통장사본 등록에서 원본을 등록/);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(imageFileFromUrl).not.toHaveBeenCalled();
    expect(readWorkerBankPhoto).toHaveBeenCalledTimes(2);
    expect((readWorkerBankPhoto as jest.Mock).mock.calls.every(args => args[3] === 'directPay')).toBe(true);
});
