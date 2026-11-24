import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OriginalDocumentThumbnail, type OriginalThumbnailSource } from './OriginalDocumentThumbnail';

jest.mock('../../services/cardStatementAttachmentService', () => ({ cardStatementAttachmentService: {}, getCardStatementFileName: jest.fn() }));
jest.mock('../../services/vehicleFineImportService', () => ({ vehicleFineImportService: {} }));
jest.mock('../../utils/pdfPreviewRuntime', () => ({ renderPdfThumbnail: () => ({ promise: Promise.resolve(1), destroy: jest.fn() }) }));

test('사진과 PDF 첫 페이지를 표시하고 파일 변경 시 이전 URL을 해제한다', async () => {
    const release = jest.fn();
    const photo = jest.fn(async (): Promise<OriginalThumbnailSource> => ({ url: 'blob:photo', kind: 'image', release }));
    const pdf = jest.fn(async (): Promise<OriginalThumbnailSource> => ({ url: 'blob:pdf', kind: 'pdf', release: jest.fn() }));
    const view = render(<OriginalDocumentThumbnail load={photo} label="고지서" />);
    expect(await screen.findByRole('img', { name: '고지서 미리보기' })).toHaveAttribute('src', 'blob:photo');
    view.rerender(<OriginalDocumentThumbnail load={pdf} label="명세서" />);
    expect(await screen.findByRole('img', { name: '명세서 PDF 첫 페이지' })).toBeVisible();
    expect(release).toHaveBeenCalledTimes(1);
});

test('조회 실패와 이미지 표시 실패를 빈 파일로 오해하지 않도록 안내한다', async () => {
    const load = jest.fn().mockRejectedValue(new Error('denied'));
    const view = render(<OriginalDocumentThumbnail load={load} label="고지서" />);
    expect(await screen.findByText('미리보기 불가 · 원본 확인')).toBeVisible();
    view.rerender(<OriginalDocumentThumbnail load={async () => ({ url: 'blob:bad-image', kind: 'image', release: jest.fn() })} label="다른 고지서" />);
    fireEvent.error(await screen.findByRole('img'));
    expect(screen.getByText('미리보기 불가 · 원본 확인')).toBeVisible();
});

test('화면을 떠난 뒤 도착한 원본은 표시하지 않고 즉시 해제한다', async () => {
    let finish!: (source: OriginalThumbnailSource) => void;
    const release = jest.fn();
    const load = () => new Promise<OriginalThumbnailSource>(resolve => { finish = resolve; });
    const view = render(<OriginalDocumentThumbnail load={load} label="이전 팀 고지서" />);
    await waitFor(() => expect(finish).toBeDefined());
    view.unmount();
    await act(async () => { finish({ url: 'blob:stale', kind: 'image', release }); });
    expect(release).toHaveBeenCalledTimes(1);
});
