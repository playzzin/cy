import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerForm from './WorkerForm';
import type { Worker } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { showErrorAlert } from '../../utils/swal';

jest.mock('../../services/teamService', () => ({ teamService: { addTeam: jest.fn() } }));
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/swal', () => ({ showSuccessAlert: jest.fn(), showErrorAlert: jest.fn() }));

const props = { teams: [], companies: [], positions: [], onSave: jest.fn(), onCancel: jest.fn() };
const worker: Worker = { id: 'account-fixture', name: '가상작업자', idNumber: '000000-0000000',
    bankName: '기본은행', accountNumber: '0011223344', accountHolder: '다른예금주',
    directPayBankName: '직불은행', directPayAccountNumber: '0099887766', directPayAccountHolder: '가상작업자',
    bankPhotoId: 'basic-photo', directPayBankPhotoId: 'direct-photo' };
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => jest.clearAllMocks());

it('신규 작업자를 등록할 때 기본 타인 명의와 직불 본인 명의 계좌를 함께 저장한다', async () => {
    render(<WorkerForm {...props} />);
    fireEvent.change(screen.getByPlaceholderText('이름 입력'), { target: { value: worker.name } });
    fireEvent.change(screen.getByPlaceholderText('000000-0000000'), { target: { value: worker.idNumber } });
    change('기본 계좌 은행명', worker.bankName!);
    change('기본 계좌 계좌번호', worker.accountNumber!);
    change('기본 계좌 예금주', worker.accountHolder!);
    change('직불용 계좌 은행명', worker.directPayBankName!);
    change('직불용 계좌 계좌번호', worker.directPayAccountNumber!);
    change('직불용 계좌 예금주', '가상 작업자');
    fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        name: worker.name, bankName: worker.bankName, accountNumber: '0011223344', accountHolder: '다른예금주',
        directPayBankName: worker.directPayBankName, directPayAccountNumber: '0099887766', directPayAccountHolder: '가상 작업자',
    }), null));
});

it('기존 두 계좌를 표시하고 각각 수정하며 등록된 사진 참조를 보존한다', async () => {
    render(<WorkerForm {...props} initialData={worker} isEditMode />);
    expect(screen.getByLabelText('기본 계좌 예금주')).toHaveValue('다른예금주');
    expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue('0099887766');
    change('기본 계좌 계좌번호', '000111222');
    change('직불용 계좌 은행명', '변경직불은행');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        ...worker, accountNumber: '000111222', directPayBankName: '변경직불은행',
    }), null));
});

it('직불 예금주 불일치는 화면과 제출 경로에서 막고 새 팀도 생성하지 않는다', async () => {
    render(<WorkerForm {...props} initialData={worker} isEditMode />);
    fireEvent.click(screen.getByRole('radio', { name: '팀장' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '새 팀 등록 (팀 생성)' }));
    change('직불용 계좌 예금주', '다른사람');
    expect(screen.getByRole('alert')).toHaveTextContent('작업자 이름과 같아야');
    expect(screen.getByLabelText('직불용 계좌 예금주')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: '작업자 등록·수정' }));
    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledWith('직불용 계좌 확인', expect.stringContaining('작업자 이름과 같아야')));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(teamService.addTeam).not.toHaveBeenCalled();
    change('직불용 계좌 예금주', worker.name);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeEnabled();
});

it('직불계좌 입력 후 작업자 이름을 변경하면 예금주도 확인한다', () => {
    render(<WorkerForm {...props} initialData={worker} isEditMode />);
    fireEvent.change(screen.getByPlaceholderText('이름 입력'), { target: { value: '수정이름' } });
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    change('직불용 계좌 예금주', '수정이름');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeEnabled();
});

it('직불계좌를 등록하지 않아도 기본계좌만 저장할 수 있다', async () => {
    const basicOnly = { id: worker.id, name: worker.name, idNumber: worker.idNumber };
    render(<WorkerForm {...props} initialData={basicOnly} isEditMode />);
    change('기본 계좌 은행명', '기본은행');
    change('기본 계좌 계좌번호', '0011223344');
    change('기본 계좌 예금주', '타인명의');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ accountHolder: '타인명의' }), null));
    expect(props.onSave.mock.calls[0][0]).not.toHaveProperty('directPayAccountHolder');
});

it('기존 명의 불일치 직불계좌를 건드리지 않는 기본계좌 수정은 허용한다', async () => {
    render(<WorkerForm {...props} initialData={{ ...worker, directPayAccountHolder: '기존명의' }} isEditMode />);
    change('기본 계좌 예금주', '기본새명의');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        accountHolder: '기본새명의', directPayAccountHolder: '기존명의',
    }), null));
    change('직불용 계좌 은행명', '다른은행');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
});

it('다른 작업자와 신규 등록으로 전환하면 이전 계좌 입력을 남기지 않는다', () => {
    const { rerender } = render(<WorkerForm {...props} initialData={worker} isEditMode />);
    change('직불용 계좌 예금주', '불일치');
    rerender(<WorkerForm {...props} initialData={{ id: 'another', name: '다른작업자' }} isEditMode />);
    expect(screen.getByLabelText('기본 계좌 계좌번호')).toHaveValue('');
    expect(screen.getByLabelText('직불용 계좌 예금주')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<WorkerForm {...props} initialData={null} />);
    expect(screen.getByLabelText('직불용 계좌 은행명')).toHaveValue('');
    expect(screen.getByRole('button', { name: '등록 완료' })).toBeEnabled();
});

it('등록번호를 입력하면 외국인 예외를 자동 적용하고 내국인 번호로 바꾸면 검증한다', async () => {
    render(<WorkerForm {...props} initialData={worker} isEditMode />);
    change('직불용 계좌 예금주', 'SYNTHETIC HOLDER');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    change('주민·외국인등록번호', '000000-7000000');
    expect(screen.getByRole('checkbox', { name: '외국인 작업자' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '외국인 작업자' })).toBeDisabled();
    expect(screen.getByText('등록번호로 외국인이 자동 적용되었습니다.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ idNumber: '000000-7000000', directPayAccountHolder: 'SYNTHETIC HOLDER' }), null));
    change('주민·외국인등록번호', '000000-1000000');
    expect(screen.getByRole('checkbox', { name: '외국인 작업자' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
});

it('번호가 없는 외국인을 직접 선택해 다른 예금주로 신규 등록하고 재조회한다', async () => {
    const { rerender } = render(<WorkerForm {...props} />);
    fireEvent.change(screen.getByPlaceholderText('이름 입력'), { target: { value: 'SYNTHETIC WORKER' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '외국인 작업자' }));
    expect(screen.getByLabelText('주민·외국인등록번호')).not.toBeRequired();
    change('직불용 계좌 은행명', '가상은행');
    change('직불용 계좌 계좌번호', '001234567890');
    change('직불용 계좌 예금주', '다른표기');
    fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ isForeignWorker: true, idNumber: '', directPayAccountHolder: '다른표기' }), null));
    rerender(<WorkerForm {...props} isEditMode initialData={{ ...props.onSave.mock.calls[0][0], id: 'saved-foreign' }} />);
    expect(screen.getByRole('checkbox', { name: '외국인 작업자' })).toBeChecked();
    change('직불용 계좌 예금주', '');
    expect(screen.getByRole('alert')).toHaveTextContent('예금주를 입력');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
});

it('수동 외국인 선택을 해제하면 명의 검증을 복원하고 새 작업자에 선택을 남기지 않는다', () => {
    const { rerender } = render(<WorkerForm {...props} isEditMode initialData={{ ...worker, isForeignWorker: true, directPayAccountHolder: '다른표기' }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: '외국인 작업자' }));
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    expect(screen.getByLabelText('주민·외국인등록번호')).toBeRequired();
    fireEvent.click(screen.getByRole('checkbox', { name: '외국인 작업자' }));
    rerender(<WorkerForm {...props} initialData={null} />);
    expect(screen.getByRole('checkbox', { name: '외국인 작업자' })).not.toBeChecked();
    expect(screen.getByLabelText('주민·외국인등록번호')).toBeRequired();
});

jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/workerBankPhotoService', () => ({ saveWorkerBankPhoto: jest.fn(), deleteWorkerBankPhoto: jest.fn() }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: {} }));
