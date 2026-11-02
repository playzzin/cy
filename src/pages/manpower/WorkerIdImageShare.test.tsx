import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { saveAs } from 'file-saver';
import WorkerIdImageShare from './WorkerIdImageShare';
import { copyImageFile, imageFileFromUrl } from '../../utils/imageFileDelivery';
import { canSaveImageFolder, saveImageFolder, zipImageFiles } from '../../utils/imageBatchDownload';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';
import { copyWindowsPhotos, openWindowsPhotoWindow, WindowsPhotoClipboardError } from '../../utils/windowsPhotoClipboard';

let mockIsPreviewFrame = false;
jest.mock('../../utils/devPreviewRuntime', () => ({ get isDevPreviewFrame() { return mockIsPreviewFrame; } }));
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
    mockIsPreviewFrame = false;
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android) Chrome/133.0 Mobile' });
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

test.each(['Win32', 'iPhone'])('팀장 미리보기 %s는 원본 확인만 제공하고 전송·복사·저장 기능을 노출하지 않는다', async platform => {
    mockIsPreviewFrame = true;
    Object.defineProperty(navigator, 'platform', { configurable: true, value: platform });
    const loadImage = jest.fn().mockResolvedValue(new File(['fixture'], 'document.png', { type: 'image/png' }));
    render(<WorkerIdImageShare workers={workers} loadImage={loadImage} />);
    await prepare();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '다음 작업자' }));
    expect(screen.getByRole('img', { name: '테스트 나 신분증 공유 미리보기' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('조회 전용 화면에서는 사진 확인만 가능합니다.');
    expect(screen.queryByRole('button', { name: /사진.*(?:공유|복사|저장|끌어놓기)/ })).not.toBeInTheDocument();
    expect(screen.queryByText('PC 카카오톡으로 보내기')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /보조 프로그램/ })).not.toBeInTheDocument();
    expect(share).not.toHaveBeenCalled();
    expect(copyImageFile).not.toHaveBeenCalled();
    expect(copyWindowsPhotos).not.toHaveBeenCalled();
    expect(openWindowsPhotoWindow).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
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
    await screen.findByRole('alert');
    expect(screen.getByRole('link', { name: '운영 작업자요약 열기' })).toHaveAttribute('href', 'https://cyee-9c1e4.web.app/manpower/summary');
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
});

async function prepare() {
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
    await screen.findByText(/사진 \d+장을 준비했습니다/);
}

test('준비 중인 작업자 순번과 이름을 표시하고 미등록·조회 실패도 선택 순서대로 확인한다', async () => {
    const selected = [{ id: 'a', name: '가상 첫째' }, { id: 'b', name: '동명이인' }, { id: 'c', name: '동명이인' }];
    let finish!: (photo: File) => void;
    const loadImage = jest.fn().mockResolvedValueOnce(null)
        .mockImplementationOnce(() => new Promise<File>(resolve => { finish = resolve; }))
        .mockRejectedValueOnce(Object.assign(new Error(), { status: 403 }));
    render(<WorkerIdImageShare workers={selected} loadImage={loadImage} />);
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
    const preparing = within(screen.getByRole('region', { name: '신분증 준비 진행' }));
    expect(await preparing.findByText('전체 3명 중 2번째 작업자를 준비하고 있습니다.')).toBeVisible();
    expect(preparing.getByRole('heading', { name: '동명이인' })).toBeVisible();
    expect(preparing.getByRole('progressbar')).toHaveAttribute('value', '1');
    await act(async () => { finish(new File(['fixture'], 'doc.png', { type: 'image/png' })); });
    const review = within(screen.getByRole('region', { name: '신분증 확인' }));
    expect(review.getByText('신분증 미등록')).toBeVisible();
    expect(review.getByLabelText('선택한 3명 중 1번째')).toBeVisible();
    expect(review.getByRole('button', { name: '이전 작업자' })).toBeDisabled();
    fireEvent.click(review.getByRole('button', { name: '다음 작업자' }));
    const photo = review.getByRole('img', { name: '동명이인 신분증 공유 미리보기' });
    fireEvent.load(photo);
    fireEvent.click(review.getByRole('button', { name: '확대' }));
    expect(review.getByRole('button', { name: '축소' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(review.getByRole('combobox'), { target: { value: '2' } });
    expect(review.getByLabelText('선택한 3명 중 3번째')).toBeVisible();
    expect(review.getByText(/권한이 없습니다/)).toBeVisible();
    expect(review.getByRole('button', { name: '다음 작업자' })).toBeDisabled();
    expect(share).not.toHaveBeenCalled();
});

test('여러 장의 전달 진행 상황과 자동 재시도를 표시하고 닫은 뒤 갱신하지 않는다', async () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    let report: (value: unknown) => void;
    (openWindowsPhotoWindow as jest.Mock).mockImplementationOnce((_files, _signal, progress) => { report = progress; return new Promise(() => {}); });
    render(<WorkerIdImageShare workers={workers} />); await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 한 번에 끌어놓기' }));
    act(() => report({ completed: 1, total: 2, sentBytes: 50, totalBytes: 100, retrying: true }));
    expect(screen.getByRole('status')).toHaveTextContent('사진 전달 1/2장 · 50% — 끊긴 부분을 다시 전달하고 있습니다.');
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유 닫기' }));
    act(() => report({ completed: 2, total: 2, sentBytes: 100, totalBytes: 100, retrying: false }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('선택한 신분증을 준비하고 다음 클릭에서 원본 사진 여러 장만 함께 공유한다', async () => {
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    expect(share).not.toHaveBeenCalled();
    expect(screen.getAllByRole('img')).toHaveLength(1);
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

test('11장은 원본 순서대로 10장과 1장을 별도 클릭으로 공유하고 취소한 묶음만 재시도할 수 있다', async () => {
    const selected = Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: `가상 ${i + 1}`, fileNameSaved: `${i}.jpg` }));
    render(<WorkerIdImageShare workers={selected} />);
    await prepare();
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '1번째 묶음 공유 · 사진 10장' }));
    const last = await screen.findByRole('button', { name: '2번째 묶음 공유 · 사진 1장' });
    expect(share).toHaveBeenCalledTimes(1);
    share.mockRejectedValueOnce(new DOMException('cancel', 'AbortError'));
    fireEvent.click(last);
    await screen.findByText(/공유창이 닫혔습니다/);
    expect(recordIdentityDocumentLog).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '2번째 묶음 다시 공유 · 사진 1장' }));
    await waitFor(() => expect(recordIdentityDocumentLog).toHaveBeenCalledTimes(2));
    const batches = share.mock.calls.map(([data]) => data.files as File[]);
    expect(batches.map(files => files.length)).toEqual([10, 1, 1]);
    expect(batches[0].concat(batches[2]).map(file => file.name)).toEqual(selected.map((worker, index) =>
        `${String(index + 1).padStart(2, '0')}_${worker.name}_신분증.jpg`));
    expect(recordIdentityDocumentLog).toHaveBeenLastCalledWith(expect.objectContaining({ personNames: ['가상 11'], fileCount: 1 }));
    expect(saveAs).not.toHaveBeenCalled();
});

test.each(['Linux armv8l', 'Win32'])('%s Chrome에서 20장 중 한 묶음이 실패해도 나머지 10장을 공유하고 전체 원본을 저장할 수 있다', async platform => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: platform });
    const selected = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `가상 ${i + 1}`, fileNameSaved: `${i}.jpg` }));
    render(<WorkerIdImageShare workers={selected} />);
    await prepare();
    fireEvent.click(screen.getByText('묶음별 사진 및 다시 공유'));
    const first = within(screen.getByRole('group', { name: '사진 묶음 1' }));
    const second = within(screen.getByRole('group', { name: '사진 묶음 2' }));
    share.mockRejectedValueOnce(new DOMException('private path', 'DataError'));
    fireEvent.click(first.getByRole('button', { name: /사진 10장/ }));
    expect(await first.findByRole('alert')).toHaveTextContent('1번째 묶음 · 브라우저가 받을 앱으로 사진을 전달하는 중 오류');
    fireEvent.click(second.getByRole('button', { name: /사진 10장/ }));
    await second.findByText(/공유창 열림/);
    expect(first.getByRole('alert')).toBeVisible();
    fireEvent.click(first.getByRole('button', { name: /사진 10장/ }));
    await first.findByText(/공유창 열림/);
    expect(first.queryByRole('alert')).not.toBeInTheDocument();
    const names = selected.map((w,i) => `${String(i + 1).padStart(2, '0')}_${w.name}_신분증.jpg`);
    expect(share.mock.calls[1][0].files.map((f: File) => f.name)).toEqual(names.slice(10));
    expect(share.mock.calls[2][0].files.map((f: File) => f.name)).toEqual(names.slice(0,10));
    fireEvent.click(screen.getByRole('button', { name: '사진 20장 ZIP 저장' }));
    await screen.findByText(/ZIP 다운로드를 요청했습니다/);
    expect((zipImageFiles as jest.Mock).mock.calls[0][0].map((f: File) => f.name)).toEqual(names);
});

test('파일 공유가 가능한 기기에는 20장이 넘어도 한 번의 클릭으로 원본을 넘긴다', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Version/18.0 Mobile Safari/605.1' });
    const selected = Array.from({ length: 23 }, (_, i) => ({ id: String(i), name: `가상 ${i + 1}`, fileNameSaved: `${i}.png` }));
    render(<WorkerIdImageShare workers={selected} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 23장 함께 공유' }));
    await screen.findByText(/공유창 열림/);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files).toHaveLength(23);
});

test('기기가 허용한다고 응답한 묶음을 거절해도 재전송 없이 더 작게 나눌 수 있다', async () => {
    share.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '사진 2장 함께 공유' }));
    await screen.findByRole('alert');
    fireEvent.click(await screen.findByRole('button', { name: '이 묶음을 더 작게 나누기' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(share).toHaveBeenCalledTimes(1);
    expect(recordIdentityDocumentLog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '1/2 묶음 공유 (사진 1장)' }));
    await screen.findByText(/공유창 열림 ·/);
    expect(share.mock.calls[1][0].files.map((file: File) => file.name)).toEqual(['01_테스트 가_신분증.jpg']);
});

test.each(['닫힘', '공유창 열림'])('받는 앱의 첨부 결과를 알 수 없는 경우(%s) 선택한 묶음만 나누고 다른 묶음을 다시 보내지 않는다', async outcome => {
    const selected = Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: `가상 ${i + 1}`, fileNameSaved: `${i}.jpg` }));
    render(<WorkerIdImageShare workers={selected} />);
    await prepare();
    const batch = (n: number) => within(screen.getByRole('group', { name: `사진 묶음 ${n}` }));
    fireEvent.click(screen.getByText('묶음별 사진 및 다시 공유'));
    fireEvent.click(batch(2).getByRole('button', { name: /묶음 공유/ }));
    await batch(2).findByText(/공유창 열림/);

    if (outcome === '닫힘') share.mockRejectedValueOnce(new DOMException('closed', 'AbortError'));
    fireEvent.click(batch(1).getByRole('button', { name: /묶음 공유/ }));
    if (outcome === '닫힘') await screen.findByText(/공유창이 닫혔습니다/);
    else await batch(1).findByText(/공유창 열림/);
    fireEvent.click(batch(1).getByRole('button', { name: '이 묶음을 더 작게 나누기' }));
    expect(share).toHaveBeenCalledTimes(2);
    expect(batch(3).getByText('가상 11')).toBeVisible();
    expect(batch(3).getByText(/공유창 열림/)).toBeVisible();
    fireEvent.click(batch(2).getByRole('button', { name: /묶음 공유/ }));
    await batch(2).findByText(/공유창 열림/);
    expect(share.mock.calls[2][0].files.map((file: File) => file.name)).toEqual(
        selected.slice(5, 10).map((worker, i) => `${String(i + 6).padStart(2, '0')}_${worker.name}_신분증.jpg`));
});

test('총용량으로 나누고 한 장이 제한을 넘더라도 뒤의 사진은 공유할 수 있다', async () => {
    const sizes = [30, 25, 51, 1];
    const selected = sizes.map((_, i) => ({ id: String(i), name: `가상 ${i + 1}`, fileNameSaved: String(i) }));
    (imageFileFromUrl as jest.Mock).mockImplementation(async (url: string, name: string) => {
        const file = new File(['test'], `${name}.jpg`, { type: 'image/jpeg' });
        Object.defineProperty(file, 'size', { value: sizes[Number(url)] * 1024 * 1024 });
        return file;
    });
    render(<WorkerIdImageShare workers={selected} />);
    await prepare();
    fireEvent.click(screen.getByText('묶음별 사진 및 다시 공유'));
    expect(screen.getByRole('button', { name: '1/4 묶음 공유 (사진 1장)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '2/4 묶음 공유 (사진 1장)' })).toBeEnabled();
    expect(screen.getByText(/3번째 묶음의 사진은 공유창에서 열 수 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '4/4 묶음 공유 (사진 1장)' }));
    await screen.findByText(/공유창 열림 ·/);
    expect(share.mock.calls[0][0].files.map((file: File) => file.name)).toEqual(['04_가상 4_신분증.jpg']);
});

test('여러 장 공유가 지원되지 않으면 한 장씩 공유하고 묶음 저장도 사용할 수 있다', async () => {
    canShare.mockImplementation(({ files }) => files.length === 1);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    expect(screen.queryByRole('button', { name: '사진 2장 함께 공유' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 2장 전체 복사' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('묶음별 사진 및 다시 공유'));
    expect(screen.getByText(/2개 묶음으로 나눴습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('사진 저장으로 보내기'));
    expect(screen.getByRole('button', { name: '사진 2장 ZIP 저장' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 2장 폴더에 저장' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '테스트 가 사진 저장' }));
    expect(saveAs).toHaveBeenCalledWith(expect.any(File), '01_테스트 가_신분증.jpg');
    fireEvent.click(screen.getByRole('button', { name: '다음 작업자' }));
    fireEvent.click(screen.getByRole('button', { name: '테스트 나 사진 공유' }));
    expect(share.mock.calls[0][0].files).toHaveLength(1);
    await screen.findByText(/공유창을 열었습니다/);
});

test('파일 공유를 지원해도 PC 카카오톡 대체 메뉴에서 원본 사진을 폴더에 저장할 수 있다', async () => {
    (canSaveImageFolder as jest.Mock).mockReturnValue(true);
    render(<WorkerIdImageShare workers={workers} />);
    await prepare();
    // PC canShare() can return true even when KakaoTalk is absent from the OS share targets.
    fireEvent.click(screen.getByText('사진 저장으로 보내기'));
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
    await screen.findByText(name === 'AbortError' ? /저장을 취소했습니다/ : /저장 권한이 거절됐습니다/);
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
    await screen.findByText(name === 'AbortError' ? /공유창이 닫혔습니다/ : /브라우저가 공유를 거절했습니다/);
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
    fireEvent.click(screen.getByText('미등록 1명 · 조회 실패 1명'));
    expect(screen.getByText(/신분증 미등록 1명: 테스트 없음/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('불러오기 실패 1명');
    expect(screen.getByRole('alert')).toHaveTextContent('테스트 나 · 상세 원인이 제공되지 않았습니다.');
    fireEvent.click(screen.getByRole('button', { name: '사진 1장 함께 공유' }));
    expect(share.mock.calls[0][0].files).toHaveLength(1);
    await screen.findByText(/공유창을 열었습니다/);
});

test('원본이 없거나 접근이 거절되면 작업자별로 확인된 원인을 표시한다', async () => {
    (imageFileFromUrl as jest.Mock)
        .mockRejectedValueOnce(Object.assign(new Error('private reference'), { status: 404 }))
        .mockRejectedValueOnce(Object.assign(new Error('private download URL'), { code: 'storage/unauthorized' }));
    render(<WorkerIdImageShare workers={workers} />);
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
    const issues = await screen.findByRole('alert');
    expect(issues).toHaveTextContent('테스트 가 · 등록된 경로에 원본 사진이 없습니다');
    expect(issues).toHaveTextContent('테스트 나 · 원본 사진을 조회할 권한이 없습니다');
    expect(issues).not.toHaveTextContent('private');
    expect(screen.getByRole('status')).toHaveTextContent('준비된 사진이 없습니다');
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
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
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
    expect(screen.getByRole('button', { name: '신분증 공유' })).toBeDisabled();
    rerender(<WorkerIdImageShare workers={[{ id: 'none', name: '테스트 없음' }]} />);
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
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
    fireEvent.click(screen.getByRole('button', { name: '다음 작업자' }));
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
    fireEvent.click(screen.getByRole('button', { name: '다음 작업자' }));
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
    expect(screen.getByRole('link', { name: 'Windows 보조 프로그램 1.4.3 다운로드 (.exe)' })).toHaveAttribute('href', '/downloads/CYPhotoClipboardSetup.exe?v=1.4.3');
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
    ['photo-window-busy', '마우스를 놓고 잠시 뒤 다시 눌러 주세요'],
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
