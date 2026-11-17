import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WorkerModal from './WorkerModal';
import { analyzeBankAccountPhoto } from '../../services/bankAccountPhotoService';
import { deleteWorkerBankPhoto, saveWorkerBankPhoto } from '../../services/workerBankPhotoService';
import { showErrorAlert } from '../../utils/swal';
jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), uploadBytes: jest.fn() }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { updateWorker: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../utils/swal', () => ({ showSuccessAlert: jest.fn(), showErrorAlert: jest.fn() }));
jest.mock('../../services/bankAccountPhotoService', () => ({ ...jest.requireActual('../../services/bankAccountPhotoService'), analyzeBankAccountPhoto: jest.fn() }));
jest.mock('../../services/workerBankPhotoService', () => ({
    BANK_PHOTO_ACCEPT: 'image/png', validateWorkerBankPhoto: jest.fn(), readWorkerBankPhoto: jest.fn(), saveWorkerBankPhoto: jest.fn(), deleteWorkerBankPhoto: jest.fn(),
}));
const file = new File(['synthetic'], 'bank.png', { type: 'image/png' });
const account = { bankName: '분석은행', accountNumber: '0012345678', accountHolder: '가상 작업자' };
const existing = { id: 'worker', name: '가상 작업자', idNumber: '000000-1000000', ...account, bankPhotoId: 'old-basic',
    directPayBankName: '직불은행', directPayAccountNumber: '000999888', directPayAccountHolder: '가상 작업자', directPayBankPhotoId: 'old-direct' };
const save = jest.fn(), close = jest.fn(), refresh = jest.fn();
const open = (edit = false) => render(<WorkerModal isOpen onSave={save} onClose={close} onSaved={refresh} initialData={edit ? existing : null} teams={[]} companies={[]} positions={[]} />);
const openAccount = (label: string) => {
    fireEvent.click(screen.getByRole('button', { name: `${label} 통장사본 등록·수정` }));
    return screen.getByRole('dialog');
};
const attach = async (label: string) => {
    const dialog = within(openAccount(label));
    fireEvent.change(dialog.getByLabelText(`${label} 사진 선택`), { target: { files: [file] } });
    await waitFor(() => expect(dialog.getByRole('button', { name: '입력 적용' })).toBeEnabled());
    fireEvent.click(dialog.getByRole('button', { name: '입력 적용' }));
};
beforeEach(() => {
    jest.resetAllMocks(); URL.createObjectURL = jest.fn(() => 'blob:synthetic'); URL.revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
    save.mockResolvedValue({ id: 'worker' });
    (analyzeBankAccountPhoto as jest.Mock).mockResolvedValue(account);
    (saveWorkerBankPhoto as jest.Mock).mockImplementation(async (_worker, _file, id) => id);
});

test('신규자 두 계좌 Gemini 분석은 최종 저장 전 쓰지 않고 실패한 사진만 동일 작업자에 재시도한다', async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText('이름 입력'), { target: { value: '가상 작업자' } });
    fireEvent.change(screen.getByLabelText('주민·외국인등록번호'), { target: { value: '000000-1000000' } });
    await attach('기본 계좌'); await attach('직불용 계좌');
    expect(save).not.toHaveBeenCalled(); expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    (saveWorkerBankPhoto as jest.Mock).mockImplementationOnce(async (_worker, _file, id) => id).mockRejectedValueOnce(new Error('사진 업로드 실패'));
    fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledWith('저장 실패', expect.stringContaining('이 창에서 다시 저장')));
    expect(close).not.toHaveBeenCalled(); expect(save).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: '등록 완료' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(save).toHaveBeenCalledTimes(1); expect(saveWorkerBankPhoto).toHaveBeenCalledTimes(3); expect(refresh).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
});

test.each(['기본 계좌', '직불용 계좌'])('%s 사진만 삭제는 계좌정보를 보존하고 최종 저장 때 반영한다', async label => {
    open(true); const dialog = within(openAccount(label));
    fireEvent.click(dialog.getByRole('button', { name: '통장사본만 삭제' }));
    fireEvent.click(dialog.getByRole('button', { name: '사진 삭제 확인' }));
    expect(deleteWorkerBankPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ bankName: '분석은행', directPayBankName: '직불은행' }), 'worker');
    expect(deleteWorkerBankPhoto).toHaveBeenCalledWith('worker', label === '기본 계좌' ? 'old-basic' : 'old-direct', label === '기본 계좌' ? 'default' : 'directPay');
});

test.each(['기본 계좌', '직불용 계좌'])('%s 계좌 삭제는 해당 정보와 사진만 제거한다', async label => {
    open(true); const dialog = within(openAccount(label));
    fireEvent.click(dialog.getByRole('button', { name: `${label} 삭제` }));
    fireEvent.click(dialog.getByRole('button', { name: '삭제 확인' }));
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(expect.objectContaining(label === '기본 계좌'
        ? { bankName: '', accountNumber: '', accountHolder: '', directPayBankName: '직불은행' }
        : { directPayBankName: '', directPayAccountNumber: '', directPayAccountHolder: '', bankName: '분석은행' }), 'worker');
    expect(deleteWorkerBankPhoto).toHaveBeenCalledTimes(1);
});

test('기존 사진 교체 후 취소하면 계좌와 사진을 변경하지 않는다', async () => {
    open(true); await attach('기본 계좌');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(close).toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
});

test('기존 통장사본은 Gemini 결과를 수정한 뒤 원래 사진 버전으로 교체한다', async () => {
    open(true); await attach('기본 계좌');
    fireEvent.change(screen.getByLabelText('기본 계좌 예금주'), { target: { value: '타인명의' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ accountHolder: '타인명의' }), 'worker');
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('worker', file, expect.stringMatching(/^[a-f0-9]{32}$/), 'old-basic', 'default');
});
