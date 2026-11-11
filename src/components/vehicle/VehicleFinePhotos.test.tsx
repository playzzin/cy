import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehicleFinePhotos from './VehicleFinePhotos';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';
import type { VehicleExpenseRecord } from '../../types/vehicle';

jest.mock('../../services/vehicleFineImportService', () => ({ vehicleFineImportService: { getAttachment: jest.fn(), removeAttachment: jest.fn() } }));
const expenses = ['first', 'second'].map((id, index) => ({ id, vehicleId: 'test', date: `2026-11-0${index + 1}`, type: 'FINE', amount: 32000, payer: 'COMPANY', fineNotice: { sourceFileName: `${id}.png` } } as VehicleExpenseRecord));

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
    await waitFor(() => expect(screen.queryByRole('button', { name: /first.png/ })).not.toBeInTheDocument());
    expect(remove).toHaveBeenLastCalledWith('first');
    expect(screen.queryByRole('button', { name: /first.png/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /second.png/ })).toBeInTheDocument();
    await waitFor(() => expect(vehicleFineImportService.getAttachment).toHaveBeenLastCalledWith('second'));
    expect(expenses.map(expense => expense.amount)).toEqual([32000, 32000]);
});
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:test-preview');
    URL.revokeObjectURL = jest.fn();
    (vehicleFineImportService.getAttachment as jest.Mock).mockResolvedValue({ base64: 'aGVsbG8=', mimeType: 'image/png', fileName: 'notice.png' });
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
    fireEvent.click(screen.getByRole('button', { name: /second.png/ }));
    await screen.findByTitle('과태료 PDF 원본');
    expect(vehicleFineImportService.getAttachment).toHaveBeenLastCalledWith('second');
    (vehicleFineImportService.getAttachment as jest.Mock).mockRejectedValueOnce(new Error('같은 고지서를 다시 분석하면 기존 내역에 사진이 연결됩니다.'));
    fireEvent.click(screen.getByRole('button', { name: /first.png/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 분석');
    expect(screen.queryByTitle('과태료 PDF 원본')).not.toBeInTheDocument();
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
