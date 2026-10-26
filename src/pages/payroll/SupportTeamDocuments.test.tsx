import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SupportTeamDocuments from './SupportTeamDocuments';
import { supportTeamDocumentService, type SupportDocumentPerson } from '../../services/supportTeamDocumentService';
import { shareImageFiles } from '../../utils/imageFileDelivery';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('../../services/supportTeamDocumentService', () => ({ supportTeamDocumentService: { list: jest.fn(), read: jest.fn() } }));
jest.mock('../../services/workerBankPhotoService', () => ({ readWorkerBankPhoto: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/imageFileDelivery', () => ({ canShareImageFiles: () => true, shareImageFiles: jest.fn() }));
jest.mock('../../utils/imageBatchDownload', () => ({ canSaveImageFolder: () => false }));
jest.mock('../../utils/windowsPhotoClipboard', () => ({}));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
const people: SupportDocumentPerson[] = [
    { id: 'own', name: '가상 팀장', teamId: 'own-team', teamName: '내 팀', role: '팀장', relation: 'own', hasIdentity: true, hasBank: true, hasDirectPayBank: false },
    { id: 'guest', name: '가상 지원자', teamId: 'guest-team', teamName: '방문팀', role: '', relation: 'other', hasIdentity: true, hasBank: true, hasDirectPayBank: true },
];
beforeEach(() => {
    jest.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:fixture') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    jest.mocked(supportTeamDocumentService.list).mockResolvedValue(people);
    jest.mocked(supportTeamDocumentService.read).mockResolvedValue(new File(['fixture'], 'photo.png', { type: 'image/png' }));
});
async function selectGuest() {
    fireEvent.click(await screen.findByRole('checkbox', { name: '방문팀 가상 지원자 서류 선택' }));
}

test('지원·월·현장 조건 없이 팀장과 다른 팀 인원을 표시하고 선택한 신분증만 준비한다', async () => {
    render(<SupportTeamDocuments />);
    expect(screen.getByRole('button', { name: '신분증 공유' })).toBeDisabled();
    await selectGuest();
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
    await screen.findByAltText('가상 지원자 신분증 공유 미리보기');
    expect(supportTeamDocumentService.list).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(supportTeamDocumentService.read).toHaveBeenCalledWith('guest', 'identity', expect.any(String), expect.any(AbortSignal));
    expect(shareImageFiles).not.toHaveBeenCalled();
});

test.each([['default', 'bank', '통장사본 공유'], ['directPay', 'directPayBank', '직불용 통장사본 공유']])('통장 종류 %s를 구분하여 해당 원본만 요청한다', async (purpose, kind, button) => {
    render(<SupportTeamDocuments />);
    await selectGuest();
    fireEvent.change(screen.getByRole('combobox', { name: '공유할 통장 종류' }), { target: { value: purpose } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    await screen.findByRole('img');
    expect(supportTeamDocumentService.read).toHaveBeenCalledWith('guest', kind, expect.any(String), expect.any(AbortSignal));
});

test('팀을 바꾸면 준비된 서류를 비우고 부모 화면 갱신은 선택을 유지한다', async () => {
    const view = render(<SupportTeamDocuments />);
    await selectGuest();
    fireEvent.click(screen.getByRole('button', { name: '신분증 공유' }));
    await screen.findByRole('img');
    fireEvent.change(screen.getByRole('combobox', { name: '서류 공유 팀' }), { target: { value: 'own-team' } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신분증 공유' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '내 팀 가상 팀장 서류 선택' }));
    view.rerender(<SupportTeamDocuments />);
    expect(screen.getByRole('button', { name: '신분증 공유' })).toBeEnabled();
    expect(supportTeamDocumentService.list).toHaveBeenCalledTimes(1);
});

test('권한 조회 실패 시 전체 작업자로 우회하지 않고 재시도를 제공한다', async () => {
    jest.mocked(supportTeamDocumentService.list).mockRejectedValueOnce(new Error('permission-denied'));
    render(<SupportTeamDocuments />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신분증 공유' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await selectGuest();
    expect(screen.getByRole('button', { name: '신분증 공유' })).toBeEnabled();
});
