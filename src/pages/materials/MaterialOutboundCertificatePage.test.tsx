import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaterialOutboundCertificatePage from './MaterialOutboundCertificatePage';
import { saveOutboundCertificateDraft, deleteOutboundCertificateDraft, OutboundCertificateDraft } from './materialOutboundCertificateDraftStore';
import { createOutboundCertificateImageFile, createOutboundPhotosPdfFile, downloadOutboundFile } from './materialOutboundCertificateExport';
import materialService from '../../services/materialService';

jest.mock('../../services/materialService', () => ({ __esModule: true, default: { getMaterialPhotoDownloadUrls: jest.fn() } }));

jest.mock('./materialOutboundCertificateExport', () => ({
    ...jest.requireActual('./materialOutboundCertificateExport'),
    createOutboundCertificateImageFile: jest.fn(), createOutboundPhotosPdfFile: jest.fn(), downloadOutboundFile: jest.fn(),
}));

const draft: OutboundCertificateDraft = {
    id: 'certificate-test', transactionDate: '2026-11-09', siteId: 'site', siteName: '검증 현장', siteAddress: '서울시 검증로 12, 101동',
    vehicleNumber: '12가3456', recipient: '검증 반출자', rentalCompanyId: 'rental', rentalCompanyName: '검증 임대사', rentalCompanyAddress: '부산시 검증로 34',
    registeredByName: '검증 등록자', createdAt: 0,
    items: [{ id: 'mat', category: '동바리', itemName: '수직재', spec: 'P17', unit: 'EA', isActive: true, quantity: 1234 }],
    photos: Array.from({ length: 40 }, (_, index) => ({ id: String(index), file: new File(['photo'], `${index}.jpg`, { type: 'image/jpeg' }), source: 'gallery' })),
};
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;
const originalFetch = global.fetch;
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:test-photo'); URL.revokeObjectURL = jest.fn();
    saveOutboundCertificateDraft(draft);
    (createOutboundCertificateImageFile as jest.Mock).mockResolvedValue(new File(['certificate'], 'certificate.jpg', { type: 'image/jpeg' }));
    (createOutboundPhotosPdfFile as jest.Mock).mockResolvedValue(new File(['photos'], 'photos.pdf', { type: 'application/pdf' }));
});
afterEach(() => { deleteOutboundCertificateDraft(draft.id); URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl; global.fetch = originalFetch; });

it('발행일 없이 모든 정보를 표시하고 반출증과 40장 사진을 별도 다운로드한다', async () => {
    render(<MemoryRouter initialEntries={['/materials/outbound-certificate?draftId=certificate-test']}><MaterialOutboundCertificatePage /></MemoryRouter>);
    await screen.findByRole('heading', { name: '자재 반출증' });
    expect(screen.getByRole('img', { name: '청연이엔지 로고' })).toHaveAttribute('src', '/assets/estimate/cheongyeon-logo.png');
    expect(screen.queryByText(/발행일/)).not.toBeInTheDocument();
    for (const label of ['출고일자', '현장명', '현장주소', '임대사', '임대사 주소', '차량번호', '총품목', '총수량']) expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    expect(screen.getByText('서울시 검증로 12, 101동')).toBeInTheDocument();
    expect(screen.getByText('부산시 검증로 34')).toBeInTheDocument();
    for (const text of ['입고자', '반출자', '등록자', '검증 반출자', '검증 등록자']) expect(screen.queryByText(text, { exact: true })).not.toBeInTheDocument();
    const photos = screen.getByRole('region', { name: '첨부사진 미리보기' });
    expect(within(photos).getAllByRole('img')).toHaveLength(40);
    expect(within(photos).getByText('1 / 2 · 전체 40장')).toBeInTheDocument();
    expect(within(photos).getByText('2 / 2 · 전체 40장')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '반출증 저장' }));
    await waitFor(() => expect(downloadOutboundFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'certificate.jpg' })));
    expect(createOutboundPhotosPdfFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '사진 PDF 저장' }));
    await waitFor(() => expect(downloadOutboundFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'photos.pdf' })));
    expect(createOutboundPhotosPdfFile).toHaveBeenCalledWith(draft);
    expect(createOutboundCertificateImageFile).toHaveBeenCalledTimes(1);
});

it('사진이 없으면 사진 다운로드만 비활성화한다', async () => {
    saveOutboundCertificateDraft({ ...draft, photos: [] });
    render(<MemoryRouter initialEntries={['/materials/outbound-certificate?draftId=certificate-test']}><MaterialOutboundCertificatePage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: '반출증 저장' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '사진 PDF 저장' })).toBeDisabled();
});

it('기존 출고 사진 조회에 실패해도 반출증을 표시하고 재시도 후 중복 없이 PDF에 넣는다', async () => {
    saveOutboundCertificateDraft({ ...draft, photos: [], returnTo: '/materials/transactions', photoReferences: [{ photoBatchId: 'batch' }, { photoBatchId: 'batch' }] });
    (materialService.getMaterialPhotoDownloadUrls as jest.Mock).mockRejectedValueOnce(new Error('사진 접근 오류')).mockResolvedValue(['https://example.test/1.jpg']);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) });
    render(<MemoryRouter initialEntries={['/materials/outbound-certificate?draftId=certificate-test']}><MaterialOutboundCertificatePage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('사진 접근 오류');
    expect(screen.getByRole('heading', { name: '자재 반출증' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '반출증 저장' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('img', { name: '반출 사진 1' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '첨부사진 미리보기' })).getAllByRole('img')).toHaveLength(1);
    expect(materialService.getMaterialPhotoDownloadUrls).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '사진 PDF 저장' }));
    await waitFor(() => expect(createOutboundPhotosPdfFile).toHaveBeenCalledWith(expect.objectContaining({ photos: [expect.objectContaining({ file: expect.any(File) })] })));
});
