import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkbookArchivePanel, { ArchiveService } from './WorkbookArchivePanel';
import type { WorkbookArchive } from '../../features/delegated-receipts/workbookArchiveService';

jest.mock('../../features/delegated-receipts/workbookArchiveService', () => ({ workbookArchiveService: {} }));

const archive: WorkbookArchive = {
  id: 'synthetic-archive', recordType: 'source-workbook', fileName: '가상 원본.xlsx', sha256: 'synthetic-sha', byteLength: 1500, chunkCount: 1,
  claimCount: 2, reviewRowCount: 1, months: ['2025-02', '2025-03'], status: 'complete', createdAt: '2026-09-01T00:00:00Z',
  sheetSummaries: [{ name: '가상자료', populatedCells: 30, claimCount: 2, reviewRowCount: 1 }], warnings: ['검증용 안내'],
};
const row = {
  id: 'synthetic-review', sourceLabel: '가상자료!A4:C4', sourceTitle: '월 없는 제목', workerName: '검증 미분류', grossAmount: 15000,
  sourceStatus: '완료', reason: '귀속월을 확인할 수 없습니다.', rawCells: [{ address: 'B4', value: 15000, formattedText: '15,000원', formula: 'SUM(B1:B3)', comment: '가상 메모' }],
};
const createService = (): ArchiveService => ({ listArchives: jest.fn(), importWorkbook: jest.fn(), listReviewRows: jest.fn().mockResolvedValue([row]), downloadOriginal: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) });

describe('원본 보관함', () => {
  it('보관한 월별 내역과 분류 대기를 구분하고 원본 값·수식·메모를 보여 준다', async () => {
    const service = createService();
    const onSelectMonth = jest.fn();
    render(<WorkbookArchivePanel service={service} archives={[archive]} loading={false} error="" onReload={jest.fn()} onSelectMonth={onSelectMonth} />);
    expect(screen.getByText('원본 보관 완료')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2025-03 저장 내역 보기' }));
    expect(onSelectMonth).toHaveBeenCalledWith('2025-03');
    fireEvent.click(screen.getByRole('button', { name: '분류 대기 내역 1건 보기' }));
    await screen.findByText('검증 미분류');
    expect(service.listReviewRows).toHaveBeenCalledWith(archive.id);
    expect(screen.getByText('가상자료!A4:C4')).toBeInTheDocument();
    expect(screen.getByText('수식: SUM(B1:B3)')).toBeInTheDocument();
    expect(screen.getByText('메모: 가상 메모')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /입금.*저장/ })).not.toBeInTheDocument();
  });

  it('완료되지 않은 보관 작업은 저장 확인 필요로 표시한다', () => {
    render(<WorkbookArchivePanel service={createService()} archives={[{ ...archive, status: 'archiving' }]} loading={false} error="" onReload={jest.fn()} onSelectMonth={jest.fn()} />);
    expect(screen.getByText('저장 확인 필요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '원본 다운로드' })).toBeDisabled();
    expect(screen.getByText(/같은 파일을 다시 가져오면/)).toBeInTheDocument();
  });

  it('원본 파일을 동일한 이름으로 내려받고 중복 클릭을 막는다', async () => {
    let complete: ((value: Uint8Array) => void) | undefined;
    const service = createService();
    (service.downloadOriginal as jest.Mock).mockImplementation(() => new Promise<Uint8Array>((resolve) => { complete = resolve; }));
    const createUrl = jest.fn().mockReturnValue('blob:synthetic');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    let downloadedName = '';
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloadedName = this.download; });
    render(<WorkbookArchivePanel service={service} archives={[archive]} loading={false} error="" onReload={jest.fn()} onSelectMonth={jest.fn()} />);
    const button = screen.getByRole('button', { name: '원본 다운로드' });
    fireEvent.click(button); fireEvent.click(button);
    expect(service.downloadOriginal).toHaveBeenCalledTimes(1);
    complete?.(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(downloadedName).toBe('가상 원본.xlsx');
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    click.mockRestore();
  });

  it('분류 대기 조회 실패 시 사용자에게 알리고 재시도한다', async () => {
    const service = createService();
    (service.listReviewRows as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([row]);
    render(<WorkbookArchivePanel service={service} archives={[archive]} loading={false} error="" onReload={jest.fn()} onSelectMonth={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '분류 대기 내역 1건 보기' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByText('검증 미분류');
    expect(service.listReviewRows).toHaveBeenCalledTimes(2);
  });
});
