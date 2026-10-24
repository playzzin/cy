import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import DocumentStampPage from './DocumentStampPage';
import { documentStampService, inspectStampFile } from '../../services/documentStampService';
import { applyStampCommand, createDefaultStampSettings, StampSettings } from '../../features/document-stamps/model';

let mockRole = 'admin';
const mockUser = { getIdTokenResult: async () => ({ claims: { role: mockRole } }) };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [{ name: '새 회사' }] } }));
jest.mock('../../services/documentStampService', () => ({
    documentStampService: { subscribe: jest.fn(), execute: jest.fn(), upload: jest.fn(), assetUrl: jest.fn() },
    inspectStampFile: jest.fn(),
}));
let settings: StampSettings;
let notify: (value: StampSettings) => void;
const execute = documentStampService.execute as jest.Mock;
const open = async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DocumentStampPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: '도장 등록' })).toBeEnabled());
};
beforeEach(() => {
    jest.clearAllMocks(); mockRole = 'admin'; settings = createDefaultStampSettings();
    Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'new-asset' } });
    (documentStampService.subscribe as jest.Mock).mockImplementation(callback => { notify = callback; callback(settings); return jest.fn(); });
    (documentStampService.assetUrl as jest.Mock).mockResolvedValue('/test.png');
    (inspectStampFile as jest.Mock).mockResolvedValue({ url: '/preview.png', width: 300, height: 300 });
    (documentStampService.upload as jest.Mock).mockResolvedValue({ url: '/uploaded.png', width: 300, height: 300 });
    execute.mockImplementation(async command => { settings = applyStampCommand(settings, command); notify(settings); });
});

it('이미지를 등록하고 같은 도장의 이름을 수정한 뒤 삭제할 수 있다', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: '도장 등록' }));
    fireEvent.change(screen.getByLabelText('도장 이름'), { target: { value: '테스트 직인' } });
    fireEvent.change(screen.getByLabelText('이미지 파일'), { target: { files: [new File(['png'], 'seal.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByRole('heading', { name: '테스트 직인' });
    expect(documentStampService.upload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '테스트 직인 수정' }));
    fireEvent.change(screen.getByLabelText('도장 이름'), { target: { value: '수정 직인' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByRole('heading', { name: '수정 직인' });
    expect(documentStampService.upload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '수정 직인 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제하기' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: '수정 직인' })).not.toBeInTheDocument());
});

it('전체 변경은 확인 전 저장하지 않고 확인 후 전체 대상에 적용한다', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: '전체 변경할 도장' }), { target: { value: 'legacy-dawon' } });
    fireEvent.click(screen.getByRole('button', { name: '전체 변경' }));
    expect(execute).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: '전체 도장 변경' });
    expect(dialog).toHaveTextContent('회사별 개별 지정도 모두 바뀝니다');
    fireEvent.click(within(dialog).getByRole('button', { name: '전체 변경 적용' }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith({ type: 'applyAll', scope: 'global', id: 'legacy-dawon' }, 0));
    expect(settings.profiles).toEqual({ global: { default: 'legacy-dawon' } });
});

it('회사별 문서 지정을 저장하며 실패 시 원래 선택을 유지한다', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: '적용 대상' }), { target: { value: 'company-cheongyeon' } });
    execute.mockRejectedValueOnce(new Error('연결 오류'));
    fireEvent.change(screen.getByRole('combobox', { name: '재직증명서 도장' }), { target: { value: 'legacy-round' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('연결 오류');
    expect(screen.getByRole('combobox', { name: '재직증명서 도장' })).toHaveValue('');
    expect(execute).toHaveBeenCalledWith({ type: 'assign', scope: 'company-cheongyeon', document: 'employment', id: 'legacy-round' }, 0);
});

it('설정 조회 실패와 관리자 아닌 사용자에게 변경 기능을 허용하지 않는다', async () => {
    mockRole = 'user';
    (documentStampService.subscribe as jest.Mock).mockImplementation((_, fail) => { fail(new Error('offline')); return jest.fn(); });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DocumentStampPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.getByRole('button', { name: '도장 등록' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '기본 도장' })).toBeDisabled();
    expect(execute).not.toHaveBeenCalled();
});
