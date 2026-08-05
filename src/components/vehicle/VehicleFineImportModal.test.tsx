import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehicleFineImportModal from './VehicleFineImportModal';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';
import type { Vehicle } from '../../types/vehicle';
import type { VehicleFineNoticeAnalysis } from '../../types/vehicleFineImport';

jest.mock('../../services/vehicleFineImportService', () => ({
    vehicleFineImportService: {
        validateFiles: jest.fn(),
        analyzeFiles: jest.fn(),
        createOperationId: jest.fn(() => 'vehicle-fine-import:test'),
        commit: jest.fn(),
    },
}));

const mockedAnalyze = vehicleFineImportService.analyzeFiles as jest.MockedFunction<typeof vehicleFineImportService.analyzeFiles>;
const mockedCommit = vehicleFineImportService.commit as jest.MockedFunction<typeof vehicleFineImportService.commit>;
const mockedCreateOperationId = vehicleFineImportService.createOperationId as jest.MockedFunction<typeof vehicleFineImportService.createOperationId>;

const vehicle: Vehicle = {
    id: 'vehicle-198-3585',
    licensePlate: '198하3585',
    model: '카니발',
    type: 'RENT',
    status: 'ASSIGNED',
    fineChargeTarget: 'DRIVER',
    contract: {
        type: 'RENT',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        deposit: 0,
        monthlyFee: 0,
        paymentDay: 1,
        financeCompany: { name: '현대캐피탈', contact: '' },
    },
};

const analysis = (patch: Partial<VehicleFineNoticeAnalysis> = {}): VehicleFineNoticeAnalysis => ({
    fileIndex: 0,
    originalFileName: '20260710154457_00008.jpg',
    issuer: '안산시 상록구청',
    noticeType: 'PARKING_FINE',
    licensePlate: '198하3585',
    violationDateTime: '2026-05-19T14:56:00',
    violationDate: '2026-05-19',
    violationLocation: '사동 장화로',
    violationDescription: '주정차위반과태료',
    dueDate: '2026-07-01',
    noticeNumber: '',
    electronicPaymentNumber: '4127022661494756294',
    originalAmount: 40_000,
    reductionAmount: 8_000,
    payableAmount: 32_000,
    driverPenaltyAmount: 0,
    ownerFineAmount: 0,
    confidence: 0.97,
    warnings: [],
    dedupeKey: 'payment:4127022661494756294',
    duplicate: false,
    existingExpenseId: '',
    ...patch,
});

describe('VehicleFineImportModal', () => {
    beforeEach(() => {
        mockedCreateOperationId.mockReturnValue('vehicle-fine-import:test');
        mockedAnalyze.mockResolvedValue([analysis()]);
        mockedCommit.mockResolvedValue({
            ok: true,
            operationId: 'vehicle-fine-import:test',
            createdCount: 1,
            duplicateCount: 0,
            results: [{ fileIndex: 0, expenseId: 'vehicle_fine_1', status: 'created' }],
        });
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:fine-preview') });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    });

    afterEach(() => jest.clearAllMocks());

    it('빈 모달에서 과태료 고지서를 드롭한 뒤 분석을 시작한다', async () => {
        render(
            <VehicleFineImportModal
                yearMonth="2026-07"
                files={[]}
                vehicles={[vehicle]}
                onClose={jest.fn()}
                onCommitted={jest.fn()}
            />,
        );

        const file = new File(['fine'], 'dropped-fine.jpg', { type: 'image/jpeg', lastModified: 1 });
        fireEvent.drop(screen.getByTestId('ai-document-dropzone'), { dataTransfer: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: '1건 업로드 후 분석' }));

        await waitFor(() => expect(mockedAnalyze).toHaveBeenCalledWith(
            [file],
            expect.any(Function),
            ['198하3585'],
        ));
        await waitFor(() => expect(screen.getAllByText('자동 연결').length).toBeGreaterThan(0));
    });

    it('auto matches the exact plate and commits the discounted payable amount', async () => {
        const onCommitted = jest.fn();
        render(
            <VehicleFineImportModal
                yearMonth="2026-07"
                files={[new File(['fine'], '20260710154457_00008.jpg', { type: 'image/jpeg' })]}
                vehicles={[vehicle]}
                onClose={jest.fn()}
                onCommitted={onCommitted}
            />,
        );

        await waitFor(() => expect(screen.getAllByText('자동 연결').length).toBeGreaterThan(0));
        expect(screen.getByRole('combobox')).toHaveValue(vehicle.id);
        expect(screen.getByDisplayValue('32000')).toBeInTheDocument();
        expect(screen.getByText(/운전자 부과/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '1건 대장 등록' }));
        await waitFor(() => expect(mockedCommit).toHaveBeenCalled());
        expect(mockedCommit).toHaveBeenCalledWith(expect.objectContaining({
            operationId: 'vehicle-fine-import:test',
            items: [expect.objectContaining({
                vehicleId: vehicle.id,
                manualMatch: false,
                expenseDate: '2026-07-01',
                payableAmount: 32_000,
            })],
        }));
        await waitFor(() => expect(onCommitted).toHaveBeenCalled());
    });

    it('excludes a duplicate notice from registration', async () => {
        mockedAnalyze.mockResolvedValue([analysis({ duplicate: true, existingExpenseId: 'vehicle_fine_1' })]);
        render(
            <VehicleFineImportModal
                yearMonth="2026-07"
                files={[new File(['fine'], 'duplicate.jpg', { type: 'image/jpeg' })]}
                vehicles={[vehicle]}
                onClose={jest.fn()}
                onCommitted={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getAllByText('중복 제외').length).toBeGreaterThan(0));
        expect(screen.getByLabelText('20260710154457_00008.jpg 등록 선택')).toBeDisabled();
        expect(screen.getByRole('button', { name: '0건 대장 등록' })).toBeDisabled();
    });

    it('requires an explicit manual vehicle selection when the plate is not exact', async () => {
        mockedAnalyze.mockResolvedValue([analysis({ licensePlate: '124호3585' })]);
        render(
            <VehicleFineImportModal
                yearMonth="2026-07"
                files={[new File(['fine'], 'manual.jpg', { type: 'image/jpeg' })]}
                vehicles={[vehicle]}
                onClose={jest.fn()}
                onCommitted={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByText('차량 확인 필요')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: '1건 대장 등록' })).toBeDisabled();
        fireEvent.change(screen.getByRole('combobox'), { target: { value: vehicle.id } });
        expect(screen.getByText(/수동 매칭 검수/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1건 대장 등록' })).toBeEnabled();
    });

    it('preselects a one-character OCR near match but requires explicit confirmation', async () => {
        mockedAnalyze.mockResolvedValue([analysis({
            licensePlate: '198H3585',
            plateConfidence: 0.78,
        })]);
        render(
            <VehicleFineImportModal
                yearMonth="2026-07"
                files={[new File(['fine'], 'ocr-near.jpg', { type: 'image/jpeg' })]}
                vehicles={[vehicle]}
                onClose={jest.fn()}
                onCommitted={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByText('차량 확인 필요')).toBeInTheDocument());
        expect(screen.getByRole('combobox')).toHaveValue(vehicle.id);
        expect(screen.getByText('추천 차량번호를 확인해 주세요.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1건 대장 등록' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: '추천 차량 확인' }));
        expect(screen.getByRole('button', { name: '1건 대장 등록' })).toBeEnabled();
        expect(screen.getByText(/수동 매칭 검수/)).toBeInTheDocument();
    });

    it('blocks registration when the ledger date is outside the selected month', async () => {
        render(
            <VehicleFineImportModal
                yearMonth="2026-07"
                files={[new File(['fine'], 'outside-month.jpg', { type: 'image/jpeg' })]}
                vehicles={[vehicle]}
                onClose={jest.fn()}
                onCommitted={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByRole('button', { name: '1건 대장 등록' })).toBeEnabled());
        fireEvent.change(screen.getByLabelText('20260710154457_00008.jpg 대장 반영일'), { target: { value: '2026-06-30' } });
        expect(screen.getByText('2026-07 대장에 포함되는 반영일만 등록할 수 있습니다.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1건 대장 등록' })).toBeDisabled();
    });
});
