import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerAccountRegistrationModal from './WorkerAccountRegistrationModal';
import { manpowerService, Worker } from '../../services/manpowerService';
import { readWorkerBankPhoto, saveWorkerBankPhoto, validateWorkerBankPhoto } from '../../services/workerBankPhotoService';
import { analyzeBankAccountPhoto, BankAccountFields } from '../../services/bankAccountPhotoService';
jest.mock('../../services/manpowerService', () => ({ manpowerService: { updateWorker: jest.fn() } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/bankAccountPhotoService', () => ({
    ...jest.requireActual('../../services/bankAccountPhotoService'), analyzeBankAccountPhoto: jest.fn(),
}));
jest.mock('../../services/workerBankPhotoService', () => ({
    BANK_PHOTO_ACCEPT: 'image/png', validateWorkerBankPhoto: jest.fn(), readWorkerBankPhoto: jest.fn(), saveWorkerBankPhoto: jest.fn(),
}));
const worker: Worker = { id: 'one', name: '검증 작업자', bankName: '검증은행', accountNumber: '001234567890', accountHolder: '검증 예금주', bankPhotoId: 'basic-photo', directPayBankPhotoId: 'old-direct' };
const file = new File(['synthetic'], 'bank.png', { type: 'image/png' });
const analyzedAccount = { bankName: '분석은행', accountNumber: '000222333444', accountHolder: '분석예금주' };
const onSaved = jest.fn(), onClose = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:synthetic'); URL.revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
    (manpowerService.updateWorker as jest.Mock).mockResolvedValue(undefined);
    (readWorkerBankPhoto as jest.Mock).mockResolvedValue(file);
    (saveWorkerBankPhoto as jest.Mock).mockResolvedValue('new-direct');
    (analyzeBankAccountPhoto as jest.Mock).mockResolvedValue(analyzedAccount);
});
const open = (value = worker) => render(<WorkerAccountRegistrationModal worker={value} purpose="directPay" onSaved={onSaved} onClose={onClose} />);
const copy = async () => {
    fireEvent.click(screen.getByRole('button', { name: '기본 계좌와 동일' }));
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(worker.accountNumber));
};
test('동일 계좌는 정보와 사진을 초안으로 복사하고 저장할 때 직불 필드만 갱신한다', async () => {
    open(); await copy();
    expect(screen.getByAltText('직불용 계좌 사진 미리보기')).toBeVisible();
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('one', {
        directPayBankName: '검증은행', directPayAccountNumber: '001234567890', directPayAccountHolder: '검증 예금주',
    });
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('one', file, expect.stringMatching(/^[a-f0-9]{32}$/), 'old-direct', 'directPay');
    expect(onSaved).toHaveBeenLastCalledWith({ directPayBankPhotoId: 'new-direct' });
});
test('복사 후 취소하면 계좌나 사진을 저장하지 않는다', async () => {
    open(); await copy(); fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalled(); expect(manpowerService.updateWorker).not.toHaveBeenCalled(); expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
});
test('기본 사진이 없어도 정보를 복사하고 직불 사진을 별도로 선택할 수 있다', async () => {
    open({ ...worker, bankPhotoId: undefined }); await copy();
    expect(readWorkerBankPhoto).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toHaveTextContent('기본 계좌사진이 없어');
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(analyzedAccount.accountNumber));
    fireEvent.change(screen.getByLabelText('직불용 계좌 계좌번호'), { target: { value: '009876543210' } });
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('one', expect.objectContaining({ directPayAccountNumber: '009876543210' }));
    expect(saveWorkerBankPhoto).toHaveBeenCalled();
});
test('사진 복사 실패 시 빈 직불 초안을 유지하고 오류를 표시한다', async () => {
    (readWorkerBankPhoto as jest.Mock).mockRejectedValueOnce(new Error('사진 조회 실패'));
    open(); fireEvent.click(screen.getByRole('button', { name: '기본 계좌와 동일' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('사진 조회 실패');
    expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(''); expect(onSaved).not.toHaveBeenCalled();
});
test('사진 저장 실패를 알리고 같은 업로드 ID로 재시도한다', async () => {
    (saveWorkerBankPhoto as jest.Mock).mockRejectedValueOnce(new Error('연결 실패'));
    open(); await copy(); fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('계좌정보는 저장됐지만 사진은 저장하지 못했습니다');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const calls = (saveWorkerBankPhoto as jest.Mock).mock.calls;
    expect(calls[0]).toEqual(calls[1]);
    expect(manpowerService.updateWorker).toHaveBeenCalledTimes(1);
});

test('사진 재시도 전에 계좌 초안을 바꾸면 바꾼 정보만 다시 저장한다', async () => {
    (saveWorkerBankPhoto as jest.Mock).mockRejectedValueOnce(new Error('연결 실패'));
    open(); await copy(); fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await screen.findByRole('alert');
    fireEvent.change(screen.getByLabelText('직불용 계좌 은행명'), { target: { value: '수정은행' } });
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(manpowerService.updateWorker).toHaveBeenCalledTimes(2);
    expect(manpowerService.updateWorker).toHaveBeenLastCalledWith('one', expect.objectContaining({ directPayBankName: '수정은행' }));
});

test('계좌번호가 잘못되면 이유를 표시하고 저장을 차단한다', async () => {
    open(); await copy();
    fireEvent.change(screen.getByLabelText('직불용 계좌 계좌번호'), { target: { value: '123' } });
    expect(screen.getByRole('alert')).toHaveTextContent('숫자 6~20자리');
    expect(screen.getByRole('button', { name: '직불용 계좌 저장' })).toBeDisabled();
});
test('등록된 직불 사진 조회는 직불 용도로 읽고 재업로드하지 않는다', async () => {
    open({ ...worker, directPayBankName: '직불은행', directPayAccountNumber: '001111222233', directPayAccountHolder: '가상예금주' });
    fireEvent.click(screen.getByRole('button', { name: '등록된 사진 보기' }));
    await screen.findByAltText('직불용 계좌 사진 미리보기');
    expect(readWorkerBankPhoto).toHaveBeenCalledWith('one', '검증 작업자_직불용 계좌', undefined, 'directPay');
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled()); expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
});

test('지원하지 않는 사진을 선택하면 이전 사진이 저장되지 않도록 차단한다', async () => {
    open(); await copy();
    (validateWorkerBankPhoto as jest.Mock).mockImplementationOnce(() => { throw new Error('사진 형식 오류'); });
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [new File(['invalid'], 'bad.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('사진 형식 오류');
    expect(screen.getByRole('button', { name: '직불용 계좌 저장' })).toBeDisabled();
    expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
    expect(analyzeBankAccountPhoto).not.toHaveBeenCalled();
});

test('직불 사진 선택 시 Gemini로 자동입력하고 저장 시 직불 계좌·사진만 반영한다', async () => {
    open();
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [file] } });
    expect(await screen.findByRole('status')).toHaveTextContent('Gemini');
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue('000222333444'));
    expect(screen.getByLabelText('직불용 계좌 은행명')).toHaveValue('분석은행');
    expect(screen.getByLabelText('직불용 계좌 예금주')).toHaveValue('분석예금주');
    expect(analyzeBankAccountPhoto).toHaveBeenCalledWith(file);
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('one', {
        directPayBankName: '분석은행', directPayAccountNumber: '000222333444', directPayAccountHolder: '분석예금주',
    });
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('one', file, expect.any(String), 'old-direct', 'directPay');
});

test('일부만 인식되면 이전 계좌정보를 섞지 않고 빈 항목의 수동 입력을 안내한다', async () => {
    (analyzeBankAccountPhoto as jest.Mock).mockResolvedValueOnce({ bankName: '새은행', accountNumber: '', accountHolder: '' });
    open({ ...worker, directPayBankName: '이전은행', directPayAccountNumber: '001111222233', directPayAccountHolder: '이전예금주' });
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 은행명')).toHaveValue('새은행'));
    expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue('');
    expect(screen.getByLabelText('직불용 계좌 예금주')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('직접 입력');
    expect(screen.getByRole('button', { name: '직불용 계좌 저장' })).toBeDisabled();
});

test('분석 실패 후 같은 사진으로 다시 분석할 수 있다', async () => {
    (analyzeBankAccountPhoto as jest.Mock).mockRejectedValueOnce(new Error('Gemini 연결 실패'));
    open();
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 분석하거나 계좌정보를 직접 입력');
    expect(screen.getByLabelText('직불용 계좌 계좌번호')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Gemini로 자동입력' }));
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(analyzedAccount.accountNumber));
    expect(analyzeBankAccountPhoto).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('사진을 바꾼 뒤 도착한 이전 분석 결과는 새 계좌를 덮어쓰지 않는다', async () => {
    let resolveFirst!: (fields: BankAccountFields) => void;
    (analyzeBankAccountPhoto as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    open();
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [file] } });
    expect(screen.getByRole('button', { name: '직불용 계좌 저장' })).toBeDisabled();
    expect(screen.getByLabelText('직불용 계좌 계좌번호')).toBeDisabled();
    const nextFile = new File(['second-synthetic'], 'second.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [nextFile] } });
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(analyzedAccount.accountNumber));
    await act(async () => resolveFirst({ bankName: '오래된은행', accountNumber: '999999999999', accountHolder: '오래된예금주' }));
    expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(analyzedAccount.accountNumber);
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('one', nextFile, expect.any(String), 'old-direct', 'directPay');
});

test('분석 중 취소할 수 있으며 늦게 도착한 결과를 저장하지 않는다', async () => {
    let finish!: (fields: BankAccountFields) => void;
    (analyzeBankAccountPhoto as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = open();
    fireEvent.change(screen.getByLabelText('직불용 계좌 사진 선택'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => finish(analyzedAccount));
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
});

test('이미 등록된 직불 사진도 Gemini로 읽고 사진 재업로드 없이 계좌만 저장한다', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: '등록된 사진 보기' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gemini로 자동입력' }));
    await waitFor(() => expect(screen.getByLabelText('직불용 계좌 계좌번호')).toHaveValue(analyzedAccount.accountNumber));
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('one', expect.objectContaining({ directPayAccountNumber: analyzedAccount.accountNumber }));
    expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
});

test('기본 계좌 사진의 분석 결과는 기본 계좌와 사진에만 저장한다', async () => {
    render(<WorkerAccountRegistrationModal worker={worker} purpose="default" onSaved={onSaved} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('기본 계좌 사진 선택'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('기본 계좌 계좌번호')).toHaveValue(analyzedAccount.accountNumber));
    fireEvent.click(screen.getByRole('button', { name: '기본 계좌 저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('one', analyzedAccount);
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('one', file, expect.any(String), 'basic-photo', 'default');
    expect(onSaved).toHaveBeenLastCalledWith({ bankPhotoId: 'new-direct' });
});
