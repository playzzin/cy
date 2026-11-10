import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerForm from './WorkerForm';
import { Worker } from '../../services/manpowerService';

jest.mock('../../services/teamService', () => ({ teamService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/swal', () => ({ showSuccessAlert: jest.fn(), showErrorAlert: jest.fn() }));

const props = { teams: [], companies: [], positions: [], onSave: jest.fn(), onCancel: jest.fn() };
const worker: Worker = {
    id: 'payment-fixture', name: '가상작업자', idNumber: '000000-0000000',
    payType: '월급제', salaryModel: '월급제',
    bankName: '가상은행', accountNumber: 'TEST-ACCOUNT', accountHolder: '가상예금주',
};

beforeEach(() => jest.clearAllMocks());

it.each(['direct', 'delegate'] as const)('신규 작업자의 지급 방식 %s를 저장한다', async payment => {
    render(<WorkerForm {...props} />);
    expect(screen.getByRole('radio', { name: '직불' })).toBeChecked();
    fireEvent.change(screen.getByPlaceholderText('이름 입력'), { target: { value: worker.name } });
    fireEvent.change(screen.getByPlaceholderText('000000-0000000'), { target: { value: worker.idNumber } });
    if (payment === 'delegate') fireEvent.click(screen.getByRole('radio', { name: '위임' }));
    fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        name: worker.name, laborStatementPayType: payment, payType: '일급제', salaryModel: '일급제',
    }), null));
});

it.each(['direct', 'delegate'] as const)('기존 지급 방식 %s를 표시하고 반대 방식으로 수정한다', async payment => {
    render(<WorkerForm {...props} isEditMode initialData={{ ...worker, laborStatementPayType: payment }} />);
    const currentLabel = payment === 'direct' ? '직불' : '위임';
    const nextLabel = payment === 'direct' ? '위임' : '직불';
    expect(screen.getByRole('radio', { name: currentLabel })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: nextLabel }));
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        ...worker, laborStatementPayType: payment === 'direct' ? 'delegate' : 'direct',
    }), null));
});

it('다른 작업자나 신규 등록으로 전환하면 이전 지급 방식을 남기지 않는다', () => {
    const { rerender } = render(<WorkerForm {...props} isEditMode initialData={{ ...worker, laborStatementPayType: 'delegate' }} />);
    expect(screen.getByRole('radio', { name: '위임' })).toBeChecked();
    rerender(<WorkerForm {...props} isEditMode initialData={{ ...worker, id: 'legacy-worker' }} />);
    expect(screen.getByRole('radio', { name: '직불' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '위임' }));
    rerender(<WorkerForm {...props} initialData={null} />);
    expect(screen.getByRole('radio', { name: '직불' })).toBeChecked();
});
