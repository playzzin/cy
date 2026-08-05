import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { analyzeTaxInvoiceFiles, TaxInvoiceExtractedCandidate } from '../../../services/taxInvoiceBulkImportService';
import TaxInvoiceBulkImportModal from './TaxInvoiceBulkImportModal';

jest.mock('../../../services/taxInvoiceBulkImportService', () => {
    const actual = jest.requireActual('../../../services/taxInvoiceBulkImportService');
    return {
        ...actual,
        analyzeTaxInvoiceFiles: jest.fn(),
    };
});

const mockedAnalyzeTaxInvoiceFiles = analyzeTaxInvoiceFiles as jest.MockedFunction<typeof analyzeTaxInvoiceFiles>;

const candidate: TaxInvoiceExtractedCandidate = {
    id: '0-0-sample.jpg',
    sourceFileName: 'sample.jpg',
    sourceFileIndex: 0,
    sourceRecordIndex: 0,
    documentKind: '전자세금계산서',
    transactionType: '매입',
    issueDate: '2026-06-30',
    approvalNumber: '20260630-10260707-941149171',
    supplierName: '씨에스시스템(주)',
    supplierBusinessNumber: '786-88-02283',
    recipientName: '주식회사 청연이엔지',
    recipientBusinessNumber: '660-88-01871',
    partnerName: '씨에스시스템(주)',
    siteName: '',
    description: '단관파이프 외',
    supplyAmount: 296800,
    taxAmount: 29680,
    totalAmount: 326480,
    confidence: 0.97,
    note: 'Gemini 세금계산서 검수 · sample.jpg',
    warnings: [],
};

describe('TaxInvoiceBulkImportModal', () => {
    beforeEach(() => {
        mockedAnalyzeTaxInvoiceFiles.mockResolvedValue({ candidates: [candidate], errors: [] });
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: jest.fn(() => 'blob:tax-invoice-preview'),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: jest.fn(),
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('AI 결과를 검수 행으로 표시하고 사용자가 선택한 행만 입력폼 반영 콜백으로 전달한다', async () => {
        const onApply = jest.fn();
        const onClose = jest.fn();
        const files = [new File(['invoice'], 'sample.jpg', { type: 'image/jpeg' })];
        const knownFingerprints = new Set<string>();

        render(
            <TaxInvoiceBulkImportModal
                files={files}
                companyLabel="청연"
                knownFingerprints={knownFingerprints}
                onClose={onClose}
                onApply={onApply}
            />,
        );

        await waitFor(() => expect(screen.getByText('씨에스시스템(주)')).toBeInTheDocument());
        expect(screen.getByText('원본 대조')).toBeInTheDocument();
        const sourceImage = screen.getByAltText('sample.jpg 원본');
        expect(sourceImage).toHaveStyle({ transform: 'rotate(0deg)' });
        fireEvent.click(screen.getByRole('button', { name: '원본 오른쪽으로 회전' }));
        expect(sourceImage).toHaveStyle({ transform: 'rotate(90deg)' });
        expect(screen.getByText('확인 · 현장명이 비어 있습니다.')).toBeInTheDocument();
        expect(screen.getByDisplayValue('296800')).toBeInTheDocument();
        expect(screen.getByDisplayValue('326480')).toBeInTheDocument();

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        fireEvent.click(screen.getByRole('button', { name: /검수 완료 · 입력폼 반영/ }));

        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onApply).toHaveBeenCalledWith([expect.objectContaining({
            transactionType: '매입',
            issueDate: '2026-06-30',
            partnerName: '씨에스시스템(주)',
            totalAmount: 326480,
        })]);
    });
});
