import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WorkerDatabase from './WorkerDatabase';
import { manpowerService, Worker } from '../../services/manpowerService';
import { geminiService } from '../../services/geminiService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(), updateWorker: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/positionService', () => ({ positionService: { getPositions: async () => [] } }));
jest.mock('../../services/statisticsService', () => ({ statisticsService: { getCumulativeManpower: async () => ({ workerStats: {} }) } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: { analyzeBankBook: jest.fn() } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../components/SecureSignature', () => () => null);
jest.mock('../../components/manpower/AccountLinkingModal', () => () => null);
jest.mock('../../components/manpower/BulkProgressModal', () => () => null);
jest.mock('../../components/manpower/BulkEditWorkerModal', () => () => null);
jest.mock('../../components/manpower/IdCardAnalysisModal', () => () => null);
jest.mock('../../components/signatures/SignatureGeneratorModal', () => () => null);
jest.mock('../manpower/WorkerModal', () => () => null);

const fields = { bankName: '검증은행', accountNumber: '001234567890', accountHolder: '별도예금주' };
let workers: Worker[];

beforeEach(() => {
    jest.clearAllMocks();
    workers = [{ id: 'worker-a', name: '검증작업자', status: 'active', idNumber: 'synthetic-id', accountNumber: '009876543210', bankPhotoId: 'a'.repeat(32) },
        { id: 'worker-b', name: '다른작업자', status: 'active' }];
    (manpowerService.getWorkers as jest.Mock).mockImplementation(async () => workers.map(worker => ({ ...worker })));
    (manpowerService.updateWorker as jest.Mock).mockImplementation(async (id: string, patch: Partial<Worker>) => {
        workers = workers.map(worker => worker.id === id ? { ...worker, ...patch } : worker);
    });
    (geminiService.analyzeBankBook as jest.Mock).mockResolvedValue(fields);
    URL.createObjectURL = jest.fn(() => 'blob:synthetic');
    URL.revokeObjectURL = jest.fn();
});

const openRowPhoto = async () => {
    fireEvent.click(await screen.findByRole('button', { name: '검증작업자 계좌번호 등록 (사진 분석)' }));
    fireEvent.change(screen.getByLabelText('계좌 사진 선택'), {
        target: { files: [new File(['synthetic'], 'account.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gemini로 계좌 읽기' }));
    await waitFor(() => expect(screen.getByLabelText('1번 계좌번호')).toHaveValue(fields.accountNumber));
};
const savePhoto = async () => {
    fireEvent.click(screen.getByRole('checkbox', { name: /등록할 대상과 은행/ }));
    fireEvent.click(screen.getByRole('button', { name: '확인한 계좌 1건 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
};

it('shows an account-only list with full numbers and restores the other columns when toggled off', async () => {
    render(<WorkerDatabase hideHeader />);
    await screen.findByRole('button', { name: '검증작업자 계좌번호 등록 (사진 분석)' });
    const toggle = screen.getByRole('button', { name: '계좌만 보기' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('columnheader', { name: /주민번호/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /단가/ })).not.toBeInTheDocument();
    for (const name of ['이름', '소속팀', '은행', '계좌번호', '예금주']) {
        expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByText('009876543210')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('columnheader', { name: /주민번호/ })).toBeInTheDocument();
});

it('registers only account fields for the clicked person without requiring an ID photo', async () => {
    render(<WorkerDatabase hideHeader />);
    await openRowPhoto();
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toHaveValue('worker-a');
    expect(screen.getByLabelText('1번 계좌번호')).toHaveAttribute('type', 'text');
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    await savePhoto();
    expect(manpowerService.updateWorker).toHaveBeenCalledTimes(1);
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-a', fields);
    const row = screen.getByRole('row', { name: /검증작업자/ });
    expect(within(row).getByText(fields.accountNumber)).toBeInTheDocument();
    expect(workers[0].name).toBe('검증작업자');
    expect(workers[0].idNumber).toBe('synthetic-id');
    expect(workers[0].bankPhotoId).toBe('a'.repeat(32));
});

it('supports changing the recipient and clears the list selection when reopening from the toolbar', async () => {
    render(<WorkerDatabase hideHeader />);
    await openRowPhoto();
    fireEvent.change(screen.getByLabelText('1번 등록할 사람·대상'), { target: { value: 'worker-b' } });
    await savePhoto();
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-b', fields);
    expect(workers[0].accountNumber).toBe('009876543210');
    fireEvent.click(screen.getByRole('button', { name: '계좌번호 등록 (사진 분석)' }));
    fireEvent.change(screen.getByLabelText('계좌 사진 선택'), {
        target: { files: [new File(['synthetic'], 'next.png', { type: 'image/png' })] },
    });
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toHaveValue('');
});
