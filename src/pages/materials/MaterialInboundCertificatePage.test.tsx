import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaterialInboundCertificatePage from './MaterialInboundCertificatePage';
import { saveInboundCertificateDraft, deleteInboundCertificateDraft, InboundCertificateDraft } from './materialInboundCertificateDraftStore';
import { createInboundCertificateImageFile, createInboundPhotosPdfFile, downloadInboundFile } from './materialInboundCertificateExport';

jest.mock('./materialInboundCertificateExport', () => ({
    ...jest.requireActual('./materialInboundCertificateExport'),
    createInboundCertificateImageFile: jest.fn(), createInboundPhotosPdfFile: jest.fn(), downloadInboundFile: jest.fn(),
}));

const draft: InboundCertificateDraft = {
    id: 'certificate-test', transactionDate: '2026-11-09', siteId: 'site', siteName: '검증 현장', siteAddress: '서울시 검증로 12, 101동',
    vehicleNumber: '12가3456', supplier: '', rentalCompanyName: '검증 임대사', rentalCompanyAddress: '부산시 검증로 34',
    registeredByName: '검증 등록자', createdAt: 0,
    items: [{ id: 'mat', category: '동바리', itemName: '수직재', spec: 'P17', unit: 'EA', isActive: true, quantity: 1234 }],
    photos: Array.from({ length: 40 }, (_, index) => ({ id: String(index), file: new File(['photo'], `${index}.jpg`, { type: 'image/jpeg' }), source: 'gallery' })),
};
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:test-photo'); URL.revokeObjectURL = jest.fn();
    saveInboundCertificateDraft(draft);
    (createInboundCertificateImageFile as jest.Mock).mockResolvedValue(new File(['certificate'], 'certificate.jpg', { type: 'image/jpeg' }));
    (createInboundPhotosPdfFile as jest.Mock).mockResolvedValue(new File(['photos'], 'photos.pdf', { type: 'application/pdf' }));
});
afterEach(() => { deleteInboundCertificateDraft(draft.id); URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl; });

it('발행일 없이 모든 정보를 표시하고 입고증과 40장 사진을 별도 다운로드한다', async () => {
    render(<MemoryRouter initialEntries={['/materials/inbound-certificate?draftId=certificate-test']}><MaterialInboundCertificatePage /></MemoryRouter>);
    await screen.findByRole('heading', { name: '자재 입고증' });
    expect(screen.getByRole('img', { name: '청연이엔지 로고' })).toHaveAttribute('src', '/assets/estimate/cheongyeon-logo.png');
    expect(screen.queryByText(/발행일/)).not.toBeInTheDocument();
    for (const label of ['입고일자', '현장명', '현장주소', '임대사', '임대사 주소', '차량번호', '총품목', '총수량']) expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    expect(screen.getByText('서울시 검증로 12, 101동')).toBeInTheDocument();
    expect(screen.getByText('부산시 검증로 34')).toBeInTheDocument();
    for (const text of ['입고자', '반출자', '등록자', '검증 등록자']) expect(screen.queryByText(text, { exact: true })).not.toBeInTheDocument();
    const photos = screen.getByRole('region', { name: '첨부사진 미리보기' });
    expect(within(photos).getAllByRole('img')).toHaveLength(40);
    expect(within(photos).getByText('1 / 2 · 전체 40장')).toBeInTheDocument();
    expect(within(photos).getByText('2 / 2 · 전체 40장')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '입고증 저장' }));
    await waitFor(() => expect(downloadInboundFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'certificate.jpg' })));
    expect(createInboundPhotosPdfFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '사진 PDF 저장' }));
    await waitFor(() => expect(downloadInboundFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'photos.pdf' })));
    expect(createInboundPhotosPdfFile).toHaveBeenCalledWith(draft);
    expect(createInboundCertificateImageFile).toHaveBeenCalledTimes(1);
});

it('사진이 없으면 사진 다운로드만 비활성화한다', async () => {
    saveInboundCertificateDraft({ ...draft, photos: [] });
    render(<MemoryRouter initialEntries={['/materials/inbound-certificate?draftId=certificate-test']}><MaterialInboundCertificatePage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: '입고증 저장' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '사진 PDF 저장' })).toBeDisabled();
});
