import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehicleFinePhotos from './VehicleFinePhotos';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';
import type { VehicleExpenseRecord } from '../../types/vehicle';

jest.mock('../../services/vehicleFineImportService', () => ({ vehicleFineImportService: { getDetails: jest.fn(), getAttachment: jest.fn(), removeAttachment: jest.fn() } }));
jest.mock('../common/OriginalDocumentThumbnail', () => ({ VehicleFineThumbnail: ({ label }: { label: string }) => <span role="img" aria-label={label} /> }));
const expenses = ['first', 'second'].map((id, index) => ({ id, vehicleId: 'test', date: `2026-11-0${index + 1}`, type: 'FINE', amount: 32000, payer: 'COMPANY', fineNotice: { sourceFileName: `${id}.png` } } as VehicleExpenseRecord));

test('월대장의 고지서 상세는 자동 표시하고 남아 있는 사진은 연결된 원본으로 바로 연다', async () => {
    const anchor = { ...expenses[0], id: 'vehicle-ledger__sample', fineNotice: undefined, amount: 64000 };
    jest.mocked(vehicleFineImportService.getDetails).mockResolvedValue([{ expenseId: anchor.id, notices: [
        { ...expenses[0], attachmentExpenseId: anchor.id, originalAvailable: true, fineNotice: { ...expenses[0].fineNotice!, sourceSha256: 'a'.repeat(64), violationLocation: '보존된 위반장소' } },
        { ...expenses[1], attachmentExpenseId: anchor.id, originalAvailable: false },
    ] }]);
    render(<VehicleFinePhotos expenses={[anchor]} vehiclePlate="검증차량" gallery />);
    expect(await screen.findByText('보존된 위반장소')).toBeVisible();
    expect(screen.getByText('원본 파일 없음 · 상세정보 보존')).toBeVisible();
    expect(vehicleFineImportService.getDetails).toHaveBeenCalledWith([anchor.id]);
    fireEvent.click(screen.getByRole('button', { name: /2026-11-01.*원본 보기/ }));
    await screen.findByAltText('과태료 고지서 원본');
    expect(vehicleFineImportService.getAttachment).toHaveBeenLastCalledWith('first', anchor.id);
    expect(screen.queryByRole('button', { name: '선택한 파일 삭제' })).not.toBeInTheDocument();
});

test('selected notice deletion is confirmed, failure is retryable and the second notice remains', async () => {
    const remove = jest.mocked(vehicleFineImportService.removeAttachment);
    remove.mockRejectedValueOnce(new Error('다시 시도해 주세요.')).mockResolvedValueOnce(undefined);
    render(<VehicleFinePhotos expenses={expenses} vehiclePlate="12가3456" />);
    fireEvent.click(screen.getByRole('button', { name: '12가3456 과태료 사진 보기' }));
    await screen.findByAltText('과태료 고지서 원본');
    fireEvent.click(screen.getByRole('button', { name: '선택한 파일 삭제' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '확인, 파일 삭제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 시도');
    fireEvent.click(screen.getByRole('button', { name: '확인, 파일 삭제' }));
    await waitFor(() => expect(screen.queryByRole('option', { name: /first.png/ })).not.toBeInTheDocument());
    expect(remove).toHaveBeenLastCalledWith('first');
    expect(screen.queryByRole('option', { name: /first.png/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /second.png/ })).toBeInTheDocument();
    await waitFor(() => expect(vehicleFineImportService.getAttachment).toHaveBeenLastCalledWith('second'));
    expect(expenses.map(expense => expense.amount)).toEqual([32000, 32000]);
});
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:test-preview');
    URL.revokeObjectURL = jest.fn();
    (vehicleFineImportService.getAttachment as jest.Mock).mockResolvedValue({ base64: 'aGVsbG8=', mimeType: 'image/png', fileName: 'notice.png' });
});

test('사진 목록에 고지 금액·장소·기한을 표시하고 누른 고지서를 바로 연다', async () => {
    const rows = expenses.map((expense, index) => ({ ...expense, amount: index ? 64000 : 32000,
        fineNotice: { ...expense.fineNotice!, sourceSha256: 'a'.repeat(64), violationLocation: '가상 검증로', violationDescription: '주정차 위반', dueDate: '2026-11-30' },
    }));
    render(<VehicleFinePhotos expenses={rows} vehiclePlate="12가3456" gallery />);
    expect(screen.getAllByText('가상 검증로')).toHaveLength(2);
    const trigger = screen.getByRole('button', { name: '12가3456 2026-11-02 과태료 64,000원 원본 보기' });
    fireEvent.click(trigger);
    await screen.findByAltText('과태료 고지서 원본');
    expect(vehicleFineImportService.getAttachment).toHaveBeenLastCalledWith('second');
    expect(screen.getByLabelText('선택한 과태료 정보')).toHaveTextContent('64,000원');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(trigger).toHaveFocus());
});
test('원본은 열 때만 조회하고 사진·다운로드를 표시하며 닫을 때 해제한다', async () => {
    render(<VehicleFinePhotos expenses={expenses} vehiclePlate="12가3456" />);
    expect(vehicleFineImportService.getAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '12가3456 과태료 사진 보기' }));
    expect(await screen.findByAltText('과태료 고지서 원본')).toHaveAttribute('src', 'blob:test-preview');
    expect(vehicleFineImportService.getAttachment).toHaveBeenCalledWith('first');
    expect(screen.getByRole('link', { name: '원본 다운로드' })).toHaveAttribute('download', 'notice.png');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-preview');
});
test('다른 고지서의 PDF와 원본이 없는 기존 내역의 안내를 표시한다', async () => {
    render(<VehicleFinePhotos expenses={expenses} vehiclePlate="12가3456" />);
    fireEvent.click(screen.getByRole('button', { name: '12가3456 과태료 사진 보기' }));
    await screen.findByAltText('과태료 고지서 원본');
    (vehicleFineImportService.getAttachment as jest.Mock).mockResolvedValueOnce({ base64: 'cGRm', mimeType: 'application/pdf', fileName: 'notice.pdf' });
    fireEvent.click(screen.getByRole('button', { name: '다음 고지서' }));
    await screen.findByTitle('과태료 PDF 원본');
    expect(vehicleFineImportService.getAttachment).toHaveBeenLastCalledWith('second');
    (vehicleFineImportService.getAttachment as jest.Mock).mockRejectedValueOnce(new Error('같은 고지서를 다시 분석하면 기존 내역에 사진이 연결됩니다.'));
    fireEvent.change(screen.getByRole('combobox', { name: '과태료 고지서 선택' }), { target: { value: 'first' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 분석');
    expect(screen.queryByTitle('과태료 PDF 원본')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByAltText('과태료 고지서 원본')).toBeInTheDocument();
});

test('고지서를 넘기면 금액·위반일·기한과 확대 배율을 함께 갱신한다', async () => {
    const rows = expenses.map((expense, index) => ({ ...expense, amount: index ? 64000 : 32000,
        fineNotice: { ...expense.fineNotice!, violationDateTime: `2026-11-0${index + 1} 09:00`, dueDate: `2026-11-${index ? '30' : '20'}` },
    }));
    render(<VehicleFinePhotos expenses={rows} vehiclePlate="12가3456" />);
    fireEvent.click(screen.getByRole('button', { name: '12가3456 과태료 사진 보기' }));
    await screen.findByAltText('과태료 고지서 원본');
    expect(screen.getByRole('button', { name: '이전 고지서' })).toBeDisabled();
    expect(screen.getByLabelText('선택한 과태료 정보')).toHaveTextContent('32,000원');
    expect(screen.getByLabelText('선택한 과태료 정보')).toHaveTextContent('2026-11-20');
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(screen.getByLabelText('확대 배율')).toHaveTextContent('150%');
    fireEvent.click(screen.getByRole('button', { name: '다음 고지서' }));
    await screen.findByAltText('과태료 고지서 원본');
    expect(screen.getByLabelText('확대 배율')).toHaveTextContent('100%');
    expect(screen.getByLabelText('선택한 과태료 정보')).toHaveTextContent('64,000원');
    expect(screen.getByLabelText('선택한 과태료 정보')).toHaveTextContent('2026-11-02 09:00');
    expect(screen.getByLabelText('선택한 과태료 정보')).toHaveTextContent('2026-11-30');
    expect(screen.getByRole('button', { name: '다음 고지서' })).toBeDisabled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-preview');
});
test('빠르게 닫은 뒤 완료된 요청은 사진 URL을 만들지 않는다', async () => {
    let finish!: (value: unknown) => void;
    (vehicleFineImportService.getAttachment as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<VehicleFinePhotos expenses={expenses} vehiclePlate="12가3456" />);
    fireEvent.click(screen.getByRole('button', { name: '12가3456 과태료 사진 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    finish({ base64: 'cGRm', mimeType: 'application/pdf', fileName: 'notice.pdf' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
});


test('고지서가 없는 기존 과태료는 금액을 유지하고 불필요한 원본 조회를 막는다', () => {
    render(<VehicleFinePhotos expenses={[{ ...expenses[0], fineNotice: undefined }]} vehiclePlate="12가3456" gallery />);
    expect(screen.getByText('32,000원')).toBeVisible();
    expect(screen.getByRole('button', { name: /32,000원 원본 보기/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /32,000원 원본 보기/ }));
    expect(vehicleFineImportService.getAttachment).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
