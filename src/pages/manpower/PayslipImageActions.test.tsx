import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { saveAs } from 'file-saver';
import PayslipImageActions from './PayslipImageActions';
import type { PaymentData } from '../payroll/components/PayslipTemplate';
import { capturePayslipImage } from '../../utils/payslipImage';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('../../utils/payslipImage', () => ({
    ...jest.requireActual('../../utils/payslipImage'), capturePayslipImage: jest.fn(),
}));

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
const originalCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalClipboardItem = Object.getOwnPropertyDescriptor(window, 'ClipboardItem');
const targetRef = React.createRef<HTMLDivElement>();
const data = { workerName: '가상하나' } as PaymentData;
const blob = new Blob(['synthetic image'], { type: 'image/png' });
const share = jest.fn();
const clipboardWrite = jest.fn();
const renderActions = () => render(<><div ref={targetRef}>가상 명세서</div><PayslipImageActions targetRef={targetRef} data={data} month="2026-10" /></>);
const prepare = async () => {
    fireEvent.click(screen.getByRole('button', { name: '카톡·공유' }));
    await screen.findByRole('region', { name: '전달할 급여명세서 이미지' });
};

beforeEach(() => {
    jest.clearAllMocks();
    (capturePayslipImage as jest.Mock).mockResolvedValue(blob);
    share.mockResolvedValue(undefined);
    clipboardWrite.mockResolvedValue(undefined);
    URL.createObjectURL = jest.fn(() => 'blob:payslip-preview');
    URL.revokeObjectURL = jest.fn();
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: clipboardWrite } });
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: class { constructor(readonly items: Record<string, Blob>) {} } });
});

afterAll(() => {
    for (const [target, key, descriptor] of [
        [navigator, 'share', originalShare], [navigator, 'canShare', originalCanShare],
        [navigator, 'clipboard', originalClipboard], [window, 'ClipboardItem', originalClipboardItem],
    ] as const) {
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
    }
});

test('선택한 명세서만 캡처하여 이름과 조회월을 포함한 PNG 파일로 저장한다', async () => {
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: '사진 저장' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(capturePayslipImage).toHaveBeenCalledWith(targetRef.current);
    const [file, filename] = (saveAs as unknown as jest.Mock).mock.calls[0];
    expect(filename).toBe('급여명세서_가상하나_2026-10.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(blob.size);
    expect(share).not.toHaveBeenCalled();
});

test('공유 이미지를 먼저 준비하고 두 번째 클릭에서 즉시 파일 공유를 호출한다', async () => {
    renderActions();
    await prepare();
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '공유창 열기' }));
    expect(share).toHaveBeenCalledWith({ title: '가상하나 2026-10 급여명세서', files: [expect.any(File)] });
    expect(capturePayslipImage).toHaveBeenCalledTimes(1);
    await screen.findByText(/공유창 처리를 마쳤습니다/);
    expect(saveAs).not.toHaveBeenCalled();
});

test('파일 공유 미지원 환경에서도 이미지 복사와 사진 저장을 제공한다', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    renderActions();
    await prepare();
    expect(screen.queryByRole('button', { name: '공유창 열기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이미지 복사' }));
    await screen.findByText(/이미지를 복사했습니다/);
    expect(clipboardWrite).toHaveBeenCalledWith([expect.objectContaining({ items: { 'image/png': expect.any(File) } })]);
    fireEvent.click(screen.getByRole('button', { name: '사진 파일 저장' }));
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(capturePayslipImage).toHaveBeenCalledTimes(1);
});

test('공유 취소 시 자동 다운로드나 오류 알림이 발생하지 않는다', async () => {
    share.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    renderActions();
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '공유창 열기' }));
    await screen.findByText(/공유를 취소했습니다/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(saveAs).not.toHaveBeenCalled();
});

test('복사 권한 거부와 공유 실패 시 저장 경로를 안내하고 다시 사용할 수 있다', async () => {
    clipboardWrite.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    share.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    renderActions();
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '이미지 복사' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('사진 저장 후 카카오톡에 첨부');
    fireEvent.click(screen.getByRole('button', { name: '공유창 열기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('공유창을 열지 못했습니다'));
    expect(screen.getByRole('button', { name: '사진 파일 저장' })).toBeEnabled();
});

test('생성 도중 작업자가 바뀌거나 페이지를 나가면 이전 이미지를 저장하지 않는다', async () => {
    let resolve!: (value: Blob) => void;
    (capturePayslipImage as jest.Mock).mockReturnValue(new Promise<Blob>(done => { resolve = done; }));
    const { rerender, unmount } = renderActions();
    fireEvent.click(screen.getByRole('button', { name: '사진 저장' }));
    rerender(<><div ref={targetRef}>가상 명세서</div><PayslipImageActions targetRef={targetRef} data={{ workerName: '가상둘' } as PaymentData} month="2026-09" /></>);
    await act(async () => { resolve(blob); });
    expect(saveAs).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: '전달할 급여명세서 이미지' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '카톡·공유' }));
    unmount();
    await act(async () => { resolve(blob); });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('생성 실패를 알리고 미리보기 이미지는 닫을 때 해제한다', async () => {
    (capturePayslipImage as jest.Mock).mockRejectedValueOnce(new Error('capture failed'));
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: '카톡·공유' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미지를 만들지 못했습니다');
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: '공유 미리보기 닫기' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:payslip-preview');
});
