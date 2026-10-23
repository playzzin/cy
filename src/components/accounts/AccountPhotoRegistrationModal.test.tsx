import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountPhotoRegistrationModal from './AccountPhotoRegistrationModal';
import BankBookAnalysisModal from '../manpower/BankBookAnalysisModal';
import { geminiService } from '../../services/geminiService';
import { GeminiBillingError } from '../../services/geminiGatewayClient';

jest.mock('../../services/geminiService', () => ({ geminiService: { analyzeBankBook: jest.fn() } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));

const fields = { bankName: '검증은행', accountNumber: '001234567890', accountHolder: '별도예금주' };
const targets = [{ id: 'worker-a', label: '검증작업자 · 검증팀' }, { id: 'worker-b', label: '다른작업자 · 다른팀' }];
const photo = (name = '별도예금주.png') => new File(['synthetic'], name, { type: 'image/png' });
const upload = (files = [photo()]) => fireEvent.change(screen.getByLabelText('계좌 사진 선택'), { target: { files } });
const analyze = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Gemini로 계좌 읽기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '닫기' })).toBeEnabled());
};
const select = (index = 1, targetId = 'worker-a') => fireEvent.change(screen.getByLabelText(`${index}번 등록할 사람·대상`), { target: { value: targetId } });
const review = () => fireEvent.click(screen.getByRole('checkbox'));
const save = () => fireEvent.click(screen.getByRole('button', { name: /확인한 계좌 .*건 저장/ }));

beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(file => `blob:${(file as File).name}`);
    URL.revokeObjectURL = jest.fn();
    (geminiService.analyzeBankBook as jest.Mock).mockResolvedValue(fields);
});

it('requires manual recipient selection, shows the full account and saves a third-party holder without changing the worker name', async () => {
    const onUpdateWorkers = jest.fn().mockResolvedValue(undefined), onClose = jest.fn();
    render(<BankBookAnalysisModal isOpen onClose={onClose} workers={[{ id: 'worker-a', name: '검증작업자' }]} onUpdateWorkers={onUpdateWorkers} />);
    upload(); await analyze();
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toHaveValue('');
    expect(screen.getByLabelText('1번 계좌번호')).toHaveValue('001234567890');
    expect(screen.getByLabelText('1번 계좌번호')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '확인한 계좌 1건 저장' })).toBeDisabled();
    select(); review(); save();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onUpdateWorkers).toHaveBeenCalledWith([{ workerId: 'worker-a', ...fields }]);
});

it('requires confirmation again after correcting OCR, and never saves before the explicit save action', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AccountPhotoRegistrationModal targets={targets} onSave={onSave} onClose={jest.fn()} />);
    upload(); await analyze(); select(); review();
    fireEvent.change(screen.getByLabelText('1번 계좌번호'), { target: { value: '009-876-543210' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(onSave).not.toHaveBeenCalled();
    review(); save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('worker-a', { ...fields, accountNumber: '009876543210' }));
});

it('keeps the explicitly chosen list recipient through analysis and allows changing it', async () => {
    const onUpdateWorkers = jest.fn().mockResolvedValue(undefined);
    render(<BankBookAnalysisModal isOpen initialWorkerId="worker-a" onClose={jest.fn()}
        workers={[{ id: 'worker-a', name: '검증작업자' }, { id: 'worker-b', name: '다른작업자' }]}
        onUpdateWorkers={onUpdateWorkers} />);
    upload(); await analyze();
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toHaveValue('worker-a');
    expect(onUpdateWorkers).not.toHaveBeenCalled();
    select(1, 'worker-b'); review(); save();
    await waitFor(() => expect(onUpdateWorkers).toHaveBeenCalledWith([{ workerId: 'worker-b', ...fields }]));
});

it('does not preselect a recipient that is no longer available', () => {
    render(<AccountPhotoRegistrationModal targets={targets} initialTargetId="missing" onSave={jest.fn()} onClose={jest.fn()} />);
    upload();
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toHaveValue('');
});

it('blocks missing account data and duplicate recipients but allows the same account for different recipients', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AccountPhotoRegistrationModal targets={targets} onSave={onSave} onClose={jest.fn()} />);
    upload([photo('one.png'), photo('two.png')]); await analyze(); select(1); select(2);
    expect(screen.getByRole('alert')).toHaveTextContent('한 대상에 여러 계좌');
    expect(screen.getByRole('checkbox')).toBeDisabled();
    select(2, 'worker-b');
    fireEvent.change(screen.getByLabelText('2번 계좌번호'), { target: { value: '0012***7890' } });
    expect(screen.getByRole('checkbox')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('2번 계좌번호'), { target: { value: fields.accountNumber } });
    review(); save();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});

it('retains failed saves and retries only the unfinished recipient', async () => {
    const onSave = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<AccountPhotoRegistrationModal targets={targets} onSave={onSave} onClose={onClose} />);
    upload([photo('one.png'), photo('two.png')]); await analyze(); select(1); select(2, 'worker-b'); review(); save();
    await screen.findByText('일부 계좌를 저장하지 못했습니다. 저장 완료된 항목은 다시 저장하지 않습니다.');
    expect(onClose).not.toHaveBeenCalled();
    save(); await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls.map(call => call[0])).toEqual(['worker-a', 'worker-b', 'worker-b']);
});

it('locks photo and recipient changes during analysis and cleans previews on unmount', async () => {
    let resolve!: (value: typeof fields) => void;
    (geminiService.analyzeBankBook as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    const { unmount } = render(<AccountPhotoRegistrationModal targets={targets} onSave={jest.fn()} onClose={jest.fn()} />);
    upload(); fireEvent.click(screen.getByRole('button', { name: 'Gemini로 계좌 읽기' }));
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toBeDisabled();
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    fireEvent.drop(screen.getByRole('button', { name: /계좌 사진 추가/ }), { dataTransfer: { files: [photo('ignored.png')] } });
    expect(screen.queryByLabelText('계좌 사진 2')).not.toBeInTheDocument();
    await act(async () => resolve(fields));
    unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:별도예금주.png');
});

it('stops later requests on a billing failure and allows analysis retry', async () => {
    (geminiService.analyzeBankBook as jest.Mock).mockRejectedValueOnce(new GeminiBillingError());
    render(<AccountPhotoRegistrationModal targets={targets} onSave={jest.fn()} onClose={jest.fn()} />);
    upload([photo('one.png'), photo('two.png')]); await analyze();
    expect(geminiService.analyzeBankBook).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/이 파일은 요청하지 않았습니다/)).toBeInTheDocument();
    await analyze(); expect(geminiService.analyzeBankBook).toHaveBeenCalledTimes(3);
});

it('rejects invalid files without creating previews or sending an AI request', () => {
    render(<AccountPhotoRegistrationModal targets={targets} onSave={jest.fn()} onClose={jest.fn()} />);
    upload([new File(['pdf'], 'bank.pdf', { type: 'application/pdf' })]);
    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG, WEBP');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(geminiService.analyzeBankBook).not.toHaveBeenCalled();
});
