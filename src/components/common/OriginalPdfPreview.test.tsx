import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OriginalPdfPreview from './OriginalPdfPreview';
import { openPdfDocument } from '../../utils/pdfPreviewRuntime';

jest.mock('../../utils/pdfPreviewRuntime', () => ({ openPdfDocument: jest.fn() }));
const cancel = jest.fn();
const destroy = jest.fn().mockResolvedValue(undefined);
const drawImage = jest.fn();
const document = { numPages: 2, getPage: jest.fn().mockImplementation(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel }),
})) };
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as any);
    destroy.mockResolvedValue(undefined);
    document.getPage.mockImplementation(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve(), cancel }),
    }));
    jest.mocked(openPdfDocument).mockReturnValue({ promise: Promise.resolve(document), destroy } as any);
});
afterEach(() => jest.restoreAllMocks());

test('웹에서 PDF 페이지를 표시하고 넘김·확대 후 닫으면 문서를 해제한다', async () => {
    const view = render(<OriginalPdfPreview url="blob:private" title="검증 PDF" />);
    const first = await screen.findByRole('img', { name: '검증 PDF 1쪽' });
    const width = (first as HTMLCanvasElement).width;
    expect(screen.getByRole('button', { name: 'PDF 이전 페이지' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'PDF 확대' }));
    await waitFor(() => expect((screen.getByRole('img') as HTMLCanvasElement).width).toBeGreaterThan(width));
    fireEvent.click(screen.getByRole('button', { name: 'PDF 다음 페이지' }));
    expect(await screen.findByRole('img', { name: '검증 PDF 2쪽' })).toBeVisible();
    expect(screen.getByLabelText('PDF 페이지')).toHaveTextContent('2 / 2쪽');
    expect(openPdfDocument).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
});

test('PDF 표시 실패는 안내하고 같은 화면에서 재시도할 수 있다', async () => {
    jest.mocked(openPdfDocument).mockReturnValueOnce({ promise: Promise.reject(new Error('failed')), destroy } as any);
    render(<OriginalPdfPreview url="blob:private" title="검증 PDF" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF를 불러오지 못했습니다');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('img', { name: '검증 PDF 1쪽' })).toBeVisible();
});

test('확대 렌더링을 기다리는 동안 기존 원본을 숨기거나 교체하지 않는다', async () => {
    render(<OriginalPdfPreview url="blob:private" title="검증 PDF" />);
    const original = await screen.findByRole('img');
    const originalWidth = (original as HTMLCanvasElement).width;
    let complete!: () => void;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    document.getPage.mockImplementationOnce(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: pending, cancel }),
    }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF 확대' }));
    await waitFor(() => expect(document.getPage).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('img')).toBe(original);
    expect(original).toBeVisible();
    expect((original as HTMLCanvasElement).width).toBe(originalWidth);
    expect(drawImage).toHaveBeenCalledTimes(1);
    await act(async () => { complete(); await pending; });
    expect(screen.getByRole('img')).toBe(original);
    expect((original as HTMLCanvasElement).width).toBeGreaterThan(originalWidth);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(openPdfDocument).toHaveBeenCalledTimes(1);
});

test('이전 렌더링이 늦게 완료되어도 현재 페이지를 덮어쓰지 않는다', async () => {
    render(<OriginalPdfPreview url="blob:private" title="검증 PDF" />);
    await screen.findByRole('img');
    let complete!: () => void;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    document.getPage.mockImplementationOnce(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: pending, cancel }),
    }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF 확대' }));
    await waitFor(() => expect(document.getPage).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'PDF 다음 페이지' }));
    const current = await screen.findByRole('img', { name: '검증 PDF 2쪽' });
    const paints = drawImage.mock.calls.length;
    await act(async () => { complete(); await pending; });
    expect(screen.getByRole('img', { name: '검증 PDF 2쪽' })).toBe(current);
    expect(drawImage).toHaveBeenCalledTimes(paints);
    expect(cancel).toHaveBeenCalled();
});
