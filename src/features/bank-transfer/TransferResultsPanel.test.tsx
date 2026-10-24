import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransferResultsPanel from './TransferResultsPanel';
import { readTransferResultFile } from './transferResults';
import { createExportRecord } from './transferWorkflow';
import { createTransferRow } from './transferModel';
jest.mock('./transferResults', () => ({ ...jest.requireActual('./transferResults'), readTransferResultFile: jest.fn() }));
const row = createTransferRow({ id: 'test', sourceId: 'test', source: 'account', category: 'worker', name: '가상작업자', groupName: '가상팀', bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '가상작업자', amount: 1000, period: '', detail: '' }, '가상', '{이름}');
beforeEach(() => { jest.clearAllMocks(); Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'file1' } }); });

it('파일 열기와 열 연결만으로 반영하지 않고 미리보기에서 선택한 결과만 명시적으로 반영한다', async () => {
    (readTransferResultFile as jest.Mock).mockResolvedValue({ names: ['결과'], sheets: { 결과: [['은행', '계좌', '금액', '상태'], ['004', '00123456789', '1000', '성공'], ['', '', '', ''], ['004', '00999999999', '1000', '실패']] } });
    const apply = jest.fn();
    render(<TransferResultsPanel record={createExportRecord([row], '검증.xlsx', '2026-10-15T00:00:00Z')} onApply={apply} onRetry={jest.fn()} />);
    fireEvent.click(screen.getByText('이체 결과 확인 · 성공 0 / 실패 0 / 미확인 1'));
    fireEvent.change(screen.getByLabelText('은행 결과 파일 선택'), { target: { files: [new File(['fake'], '결과.xlsx')] } });
    await screen.findByLabelText('은행코드 결과 열');
    ['은행코드', '계좌번호', '이체금액', '처리결과'].forEach((name, index) => fireEvent.change(screen.getByLabelText(`${name} 결과 열`), { target: { value: String(index) } }));
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '연결 결과 미리보기' }));
    expect(screen.getByRole('button', { name: '선택 0건 결과 반영' })).toBeDisabled();
    expect(screen.getByLabelText('결과 4행 선택')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('결과 2행 선택'));
    fireEvent.click(screen.getByRole('button', { name: '선택 1건 결과 반영' }));
    expect(apply).toHaveBeenCalledWith('file1', [{ rowId: row.rowId, status: 'success', note: '' }], '결과.xlsx');
});

it('열이나 결과 문구를 수정하면 이전 연결 미리보기와 선택을 해제한다', async () => {
    (readTransferResultFile as jest.Mock).mockResolvedValue({ names: ['결과'], sheets: { 결과: [['은행', '계좌', '금액', '상태'], ['004', '00123456789', '1000', '성공']] } });
    render(<TransferResultsPanel record={createExportRecord([row], '검증.xlsx', '2026-10-15T00:00:00Z')} onApply={jest.fn()} onRetry={jest.fn()} />);
    fireEvent.click(screen.getByText('이체 결과 확인 · 성공 0 / 실패 0 / 미확인 1'));
    fireEvent.change(screen.getByLabelText('은행 결과 파일 선택'), { target: { files: [new File(['fake'], '결과.xlsx')] } });
    await screen.findByLabelText('은행코드 결과 열');
    ['은행코드', '계좌번호', '이체금액', '처리결과'].forEach((name, index) => fireEvent.change(screen.getByLabelText(`${name} 결과 열`), { target: { value: String(index) } }));
    fireEvent.click(screen.getByRole('button', { name: '연결 결과 미리보기' })); fireEvent.click(screen.getByLabelText('결과 2행 선택'));
    fireEvent.change(screen.getByLabelText('성공 결과 표시'), { target: { value: '처리완료' } });
    expect(screen.queryByRole('button', { name: '선택 1건 결과 반영' })).not.toBeInTheDocument();
});
