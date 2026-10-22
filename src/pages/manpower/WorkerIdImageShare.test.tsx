import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { saveAs } from 'file-saver';
import WorkerIdImageShare from './WorkerIdImageShare';
import { copyImageFile, imageFileFromUrl } from '../../utils/imageFileDelivery';
import { canSaveImageFolder, saveImageFolder, zipImageFiles } from '../../utils/imageBatchDownload';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';
import { copyWindowsPhotos, openWindowsPhotoWindow, WindowsPhotoClipboardError } from '../../utils/windowsPhotoClipboard';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: (_storage: unknown, path: string) => path, getDownloadURL: async (path: string) => path }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/imageFileDelivery', () => ({ ...jest.requireActual('../../utils/imageFileDelivery'), imageFileFromUrl: jest.fn(), copyImageFile: jest.fn() }));
jest.mock('../../utils/imageBatchDownload', () => ({ canSaveImageFolder: jest.fn(), saveImageFolder: jest.fn(), zipImageFiles: jest.fn() }));
jest.mock('../../utils/windowsPhotoClipboard', () => ({ ...jest.requireActual('../../utils/windowsPhotoClipboard'), copyWindowsPhotos: jest.fn(), openWindowsPhotoWindow: jest.fn() }));

const workers = [
    { id: 'one', name: '테스트 가', fileNameSaved: 'one.jpg' },
    { id: 'two', name: '테스트 나', fileNameSaved: 'two.png' },
];
const share = jest.fn();
const canShare = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Linux' });
    (copyImageFile as jest.Mock).mockResolvedValue(undefined);
    (openWindowsPhotoWindow as jest.Mock).mockResolvedValue({ batchId: 'b'.repeat(32), photoCount: 2, opened: true });
    share.mockResolvedValue(undefined);
    canShare.mockReturnValue(true);
    (canSaveImageFolder as jest.Mock).mockReturnValue(false);
    (zipImageFiles as jest.Mock).mockResolvedValue(new File(['zip'], 'photos.zip', { type: 'application/zip' }));
    (saveImageFolder as jest.Mock).mockImplementation(async (files: File[]) => ({ folderName: '신분증_사진_테스트', saved: files, failed: [] }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn((file: File) => `blob:${file.name}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    (imageFileFromUrl as jest.Mock).mockImplementation(async (url: string, name: string) =>
        new File([url], `${name}.${url.endsWith('.jpg') ? 'jpg' : 'png'}`, { type: url.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }));
});

test('Windows 전체 복사는 선택한 개별 원본 파일만 전달하고 복사만 기록한다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    (copyWindowsPhotos as jest.Mock).mockResolvedValue({ copied: true, photoCount: 2, folderName: '테스트 폴더' });
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByText('전체 복사로 붙여넣기 (보조 기능)'));
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 전체 복사' }));
    await screen.findByText(/사진 2장을 Windows 클립보드에 모두 복사했습니다/);
    expect((copyWindowsPhotos as jest.Mock).mock.calls[0][0].map((file: File) => file.type)).toEqual(['image/jpeg', 'image/png']);
    expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'copy_image', fileCount: 2 }));
    expect(recordIdentityDocumentLog).toHaveBeenCalledTimes(1);
    expect(saveAs).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
});

test('보조 프로그램이 복사 실패를 반환하면 성공 기록 없이 재복사를 안내한다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    (copyWindowsPhotos as jest.Mock).mockResolvedValue({ copied: false, photoCount: 2, folderName: '테스트 폴더' });
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByText('전체 복사로 붙여넣기 (보조 기능)'));
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 전체 복사' }));
    await screen.findByText(/사진은 준비됐지만 클립보드에 복사하지 못했습니다/);
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
});

test('연결 실패는 성공으로 표시하거나 자동 공유하지 않는다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    (copyWindowsPhotos as jest.Mock).mockRejectedValue(new WindowsPhotoClipboardError('connection'));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByText('전체 복사로 붙여넣기 (보조 기능)'));
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 전체 복사' }));
    await screen.findByText(/PC 보조 프로그램에 연결하지 못했습니다/);
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
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

test('여러 장 공유가 지원되지 않으면 PC 묶음 저장과 개별 사진 공유를 제공한다', async () => {
    canShare.mockImplementation(({ files }) => files.length === 1);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    expect(screen.queryByRole('button', { name: '사진 2장 함께 공유' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 2장 전체 복사' })).not.toBeInTheDocument();
    expect(screen.getByText(/함께 공유할 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 2장 ZIP 저장' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 2장 폴더에 저장' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '테스트 가 사진 저장' }));
    expect(saveAs).toHaveBeenCalledWith(expect.any(File), '01_테스트 가_신분증.jpg');
    fireEvent.click(screen.getByRole('button', { name: '테스트 나 사진 공유' }));
    expect(share.mock.calls[0][0].files).toHaveLength(1);
    await screen.findByText(/공유창을 열었습니다/);
});

test('파일 공유를 지원해도 PC 카카오톡 대체 메뉴에서 원본 사진을 폴더에 저장할 수 있다', async () => {
    (canSaveImageFolder as jest.Mock).mockReturnValue(true);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    // PC canShare() can return true even when KakaoTalk is absent from the OS share targets.
    fireEvent.click(screen.getByText('PC 카카오톡으로 보내기'));
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 폴더에 저장' }));
    expect(saveImageFolder).toHaveBeenCalledTimes(1);
    const files = (saveImageFolder as jest.Mock).mock.calls[0][0] as File[];
    expect(files.map(file => [file.name, file.type])).toEqual([
        ['01_테스트 가_신분증.jpg', 'image/jpeg'], ['02_테스트 나_신분증.png', 'image/png'],
    ]);
    await screen.findByText(/사진 2장을 선택한 위치의/);
    expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'download_image', status: 'success', fileCount: 2 }));
    expect(share).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
});

test('폴더 저장 미지원 브라우저에서 사진 전체를 담은 ZIP을 한 번만 다운로드한다', async () => {
    canShare.mockReturnValue(false);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 ZIP 저장' }));
    await screen.findByText(/사진 2장이 들어 있는 ZIP 다운로드를 요청했습니다/);
    expect((zipImageFiles as jest.Mock).mock.calls[0][0]).toHaveLength(2);
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(saveAs).toHaveBeenCalledWith(expect.any(File), 'photos.zip');
    expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'download_zip', fileCount: 2 }));
    expect(share).not.toHaveBeenCalled();
});

test.each(['AbortError', 'NotAllowedError'])('폴더 저장 %s는 자동 ZIP 다운로드나 성공 기록을 남기지 않는다', async name => {
    canShare.mockReturnValue(false);
    (canSaveImageFolder as jest.Mock).mockReturnValue(true);
    (saveImageFolder as jest.Mock).mockRejectedValue(new DOMException('test', name));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 폴더에 저장' }));
    await screen.findByText(name === 'AbortError' ? /저장을 취소했습니다/ : /폴더에 저장하지 못했습니다/);
    expect(zipImageFiles).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '사진 2장 폴더에 저장' })).toBeEnabled();
});

test('폴더에 일부 사진만 저장되면 성공 수와 실패 대상을 따로 표시한다', async () => {
    canShare.mockReturnValue(false);
    (canSaveImageFolder as jest.Mock).mockReturnValue(true);
    (saveImageFolder as jest.Mock).mockImplementation(async (files: File[]) => ({ folderName: 'photos', saved: [files[0]], failed: [files[1]] }));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 폴더에 저장' }));
    await screen.findByText(/사진 1장을 선택한 위치의/);
    expect(screen.getByRole('alert')).toHaveTextContent('사진 1장 저장 실패: 테스트 나');
    expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial', fileCount: 1, personNames: ['테스트 가'] }));
});

test('ZIP 준비 중 선택을 바꾸면 이전 선택의 파일을 다운로드하지 않는다', async () => {
    let resolveZip!: (file: File) => void;
    (zipImageFiles as jest.Mock).mockImplementationOnce(() => new Promise<File>(resolve => { resolveZip = resolve; }));
    canShare.mockReturnValue(false);
    const { rerender } = render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 ZIP 저장' }));
    rerender(<WorkerIdImageShare workers={[workers[1]]} />);
    resolveZip(new File(['zip'], 'test.zip'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveAs).not.toHaveBeenCalled();
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
});

test('폴더 선택 중 닫으면 저장 작업의 취소 신호를 전달한다', async () => {
    let rejectSave!: (error: Error) => void;
    (saveImageFolder as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    canShare.mockReturnValue(false);
    (canSaveImageFolder as jest.Mock).mockReturnValue(true);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 폴더에 저장' }));
    const signal = (saveImageFolder as jest.Mock).mock.calls[0][1];
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유 닫기' }));
    expect(signal.aborted).toBe(true);
    rejectSave(new DOMException('cancel', 'AbortError'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveAs).not.toHaveBeenCalled();
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
    await screen.findByText(/공유창을 열었습니다/);
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
    await screen.findByText(/공유창을 열었습니다/);
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

test('Windows에서는 끌어놓기를 먼저 안내하고 복사·저장·시스템 공유를 구분한다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    (canSaveImageFolder as jest.Mock).mockReturnValue(true);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    expect(screen.queryByRole('button', { name: '사진 2장 함께 공유' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '사진 2장 전체 복사', hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByText('폴더·ZIP으로 저장해서 보내기'));
    expect(screen.getByRole('button', { name: '사진 2장 폴더에 저장' })).toBeVisible();
    expect(screen.getByText(/Windows 공유창의 카카오톡·복사 항목/)).toBeVisible();
    expect(screen.queryByRole('button', { name: '테스트 가 사진 공유' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Windows 공유창 열기 (2장)' }));
    expect(share.mock.calls[0][0].files).toHaveLength(2);
    await screen.findByText(/Windows 공유창을 열었습니다/);
    expect(copyImageFile).not.toHaveBeenCalled();
});

test('사진 복사는 선택한 한 장을 직접 클립보드로 전달하고 다음 사진으로 교체됨을 안내한다', async () => {
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '테스트 가 사진 복사' }));
    await screen.findByText(/테스트 가 사진 1장을 복사했습니다/);
    expect(copyImageFile).toHaveBeenLastCalledWith(expect.objectContaining({ name: '01_테스트 가_신분증.jpg', type: 'image/jpeg' }));
    expect(screen.getByRole('status')).toHaveTextContent('다른 사진을 복사하면 이전 사진은 교체됩니다.');
    fireEvent.click(screen.getByRole('button', { name: '테스트 나 사진 복사' }));
    await screen.findByText(/테스트 나 사진 1장을 복사했습니다/);
    expect(copyImageFile).toHaveBeenLastCalledWith(expect.objectContaining({ name: '02_테스트 나_신분증.png', type: 'image/png' }));
    expect(recordIdentityDocumentLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'copy_image', fileCount: 1, personNames: ['테스트 나'] }));
    expect(share).not.toHaveBeenCalled();
});

test('사진 복사 실패 시 이전 성공 문구를 지우고 저장 대안을 안내한다', async () => {
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '테스트 가 사진 복사' }));
    await screen.findByText(/테스트 가 사진 1장을 복사했습니다/);
    (copyImageFile as jest.Mock).mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    fireEvent.click(screen.getByRole('button', { name: '테스트 나 사진 복사' }));
    await screen.findByText(/사진을 복사하지 못했습니다/);
    expect(screen.getByRole('status')).not.toHaveTextContent('복사했습니다');
    expect(recordIdentityDocumentLog).toHaveBeenCalledTimes(1);
    expect(saveAs).not.toHaveBeenCalled();
});

test('Windows 사진창에는 선택된 각각의 원본을 전달하고 창 열기를 전송·복사 성공으로 기록하지 않는다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' }));
    await screen.findByText(/사진 2장이 모두 선택된 Windows 사진창을 열었습니다/);
    expect((openWindowsPhotoWindow as jest.Mock).mock.calls[0][0].map((file: File) => [file.name, file.type])).toEqual([
        ['01_테스트 가_신분증.jpg', 'image/jpeg'], ['02_테스트 나_신분증.png', 'image/png'],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('선택된 사진 하나를 누른 채');
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(copyWindowsPhotos).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('처음 사용하시나요? PC 보조 프로그램 설치'));
    expect(screen.getByRole('link', { name: 'Windows 보조 프로그램 1.3 다운로드 (.exe)' })).toHaveAttribute('href', '/downloads/CYPhotoClipboardSetup.exe?v=1.3.0');
});

test('사진창을 준비하는 중 중복 클릭은 창을 추가로 열지 않는다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    let resolveWindow!: (value: unknown) => void;
    (openWindowsPhotoWindow as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveWindow = resolve; }));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    const button = screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(openWindowsPhotoWindow).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => resolveWindow({ photoCount: 2, opened: true }));
    expect(button).toBeEnabled();
});

test.each(['close', 'selection'])('사진창 준비 중 %s 시 취소하고 이전 선택의 늦은 응답을 표시하지 않는다', async action => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    let resolveWindow!: (value: unknown) => void;
    (openWindowsPhotoWindow as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveWindow = resolve; }));
    const { rerender } = render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' }));
    const signal = (openWindowsPhotoWindow as jest.Mock).mock.calls[0][1] as AbortSignal;
    if (action === 'close') fireEvent.click(screen.getByRole('button', { name: '신분증 공유 닫기' }));
    else rerender(<WorkerIdImageShare workers={[workers[1]]} />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolveWindow({ photoCount: 2, opened: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
});

test.each([
    ['photo-window-version', '1.3 이상이 필요합니다'],
    ['photo-window-busy', '이미 열려 있는 Windows 사진창을 닫은 뒤'],
    ['photo-window', 'Windows 사진창을 열지 못했습니다'],
])('사진창 오류 %s를 안내하고 자동 복사나 공유로 대체하지 않는다', async (code, message) => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    (openWindowsPhotoWindow as jest.Mock).mockRejectedValueOnce(new WindowsPhotoClipboardError(code, 'open'));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
    expect(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' })).toBeEnabled();
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(copyWindowsPhotos).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
});

test('사진창 opened=false는 창을 열었다고 표시하지 않는다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    (openWindowsPhotoWindow as jest.Mock).mockResolvedValueOnce({ photoCount: 2, opened: false });
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' }));
    await screen.findByText(/Windows 사진창을 열지 못했습니다/);
    expect(screen.getByRole('status')).not.toHaveTextContent('열었습니다');
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
});
