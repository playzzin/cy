import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerAccountRegistrationModal from './WorkerAccountRegistrationModal';
import { manpowerService, Worker } from '../../services/manpowerService';
import { readWorkerBankPhoto, saveWorkerBankPhoto, validateWorkerBankPhoto } from '../../services/workerBankPhotoService';
jest.mock('../../services/manpowerService', () => ({ manpowerService: { updateWorker: jest.fn() } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/workerBankPhotoService', () => ({
    BANK_PHOTO_ACCEPT: 'image/png', validateWorkerBankPhoto: jest.fn(), readWorkerBankPhoto: jest.fn(), saveWorkerBankPhoto: jest.fn(),
}));
const worker: Worker = { id: 'one', name: '검증 작업자', bankName: '검증은행', accountNumber: '001234567890', accountHolder: '검증 예금주', bankPhotoId: 'basic-photo', directPayBankPhotoId: 'old-direct' };
const file = new File(['synthetic'], 'bank.png', { type: 'image/png' });
const onSaved = jest.fn(), onClose = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:synthetic'); URL.revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
    (manpowerService.updateWorker as jest.Mock).mockResolvedValue(undefined);
    (readWorkerBankPhoto as jest.Mock).mockResolvedValue(file);
    (saveWorkerBankPhoto as jest.Mock).mockResolvedValue('new-direct');
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
});
