import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WorkerDatabase from './WorkerDatabase';
import { manpowerService, Worker } from '../../services/manpowerService';
import { geminiService } from '../../services/geminiService';
import { readWorkerBankPhoto, saveWorkerBankPhoto } from '../../services/workerBankPhotoService';

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
jest.mock('../../services/workerBankPhotoService', () => ({ BANK_PHOTO_ACCEPT: 'image/png', validateWorkerBankPhoto: jest.fn(), readWorkerBankPhoto: jest.fn(), saveWorkerBankPhoto: jest.fn() }));
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
    localStorage.clear();
    workers = [{ id: 'worker-a', name: '검증작업자', status: 'active', idNumber: 'synthetic-id', accountNumber: '009876543210', bankPhotoId: 'a'.repeat(32) },
        { id: 'worker-b', name: '다른작업자', status: 'active' }];
    (manpowerService.getWorkers as jest.Mock).mockImplementation(async () => workers.map(worker => ({ ...worker })));
    (manpowerService.updateWorker as jest.Mock).mockImplementation(async (id: string, patch: Partial<Worker>) => {
        workers = workers.map(worker => worker.id === id ? { ...worker, ...patch } : worker);
    });
    (geminiService.analyzeBankBook as jest.Mock).mockResolvedValue(fields);
    URL.createObjectURL = jest.fn(() => 'blob:synthetic');
    URL.revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
    (readWorkerBankPhoto as jest.Mock).mockResolvedValue(new File(['synthetic-original'], 'bank.png', { type: 'image/png' }));
    (saveWorkerBankPhoto as jest.Mock).mockImplementation(async (id: string, _file: File, photoId: string, _expected: string, purpose: string) => {
        workers = workers.map(worker => worker.id === id ? { ...worker, [purpose === 'directPay' ? 'directPayBankPhotoId' : 'bankPhotoId']: photoId } : worker);
        return photoId;
    });
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
    for (const name of ['이름', '소속팀', '기본 은행', '기본 계좌번호', '기본 예금주', '직불용 은행', '직불용 계좌번호', '직불용 예금주']) {
        expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
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

it('관리 칸에는 간단한 상태 버튼만 표시하고 계좌 상세는 기본·직불용 열로 구분한다', async () => {
    workers[0] = { ...workers[0], bankName: '기본은행', accountHolder: '기본예금주', directPayBankName: '직불은행', directPayAccountNumber: '001111222233', directPayAccountHolder: '직불예금주' };
    render(<WorkerDatabase hideHeader />);
    const basic = await screen.findByRole('button', { name: '검증작업자 기본 계좌·사진 등록/수정' });
    const direct = screen.getByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' });
    expect(basic).toHaveTextContent(/^기본계좌$/);
    expect(basic).toHaveAttribute('title', '기본 계좌: 계좌 등록됨 · 사진 등록됨');
    expect(direct).toHaveTextContent(/^직불용계좌$/);
    expect(direct).toHaveAttribute('title', '직불용 계좌: 계좌 등록됨 · 사진 미등록');
    const row = within(screen.getByRole('row', { name: /검증작업자/ }));
    for (const [label, value] of [['기본 은행', '기본은행'], ['기본 계좌번호', '009876543210'], ['기본 예금주', '기본예금주'], ['직불용 은행', '직불은행'], ['직불용 계좌번호', '001111222233'], ['직불용 예금주', '직불예금주']]) {
        expect(row.getByRole('cell', { name: label })).toHaveTextContent(value);
    }
    const management = row.getAllByRole('cell').slice(-1)[0];
    expect(management).not.toHaveTextContent('기본은행');
    expect(management).not.toHaveTextContent('001111222233');
    fireEvent.click(screen.getByRole('button', { name: '소속/상태' }));
    expect(direct).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('검증작업자 · 직불용 계좌 등록');
});

it('목록에서 동일 계좌와 사진을 직불용으로 복사해 저장하고 재조회해도 유지한다', async () => {
    workers[0] = { ...workers[0], bankName: '기본은행', accountHolder: '기본예금주' };
    const view = render(<WorkerDatabase hideHeader />);
    fireEvent.click(await screen.findByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' }));
    fireEvent.click(screen.getByRole('button', { name: '기본 계좌와 동일' }));
    await screen.findByAltText('직불용 계좌 사진 미리보기');
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '직불용 계좌 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const row = within(screen.getByRole('row', { name: /검증작업자/ }));
    expect(row.getByRole('cell', { name: '직불용 은행' })).toHaveTextContent('기본은행');
    expect(row.getByRole('cell', { name: '직불용 계좌번호' })).toHaveTextContent('009876543210');
    expect(row.getByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' })).toHaveAttribute('title', '직불용 계좌: 계좌 등록됨 · 사진 등록됨');
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-a', { directPayBankName: '기본은행', directPayAccountNumber: '009876543210', directPayAccountHolder: '기본예금주' });
    expect(workers[0].bankPhotoId).toBe('a'.repeat(32)); expect(workers[1].directPayAccountNumber).toBeUndefined();
    view.unmount(); render(<WorkerDatabase hideHeader />);
    await screen.findByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' });
    expect(within(screen.getByRole('row', { name: /검증작업자/ })).getByRole('cell', { name: '직불용 계좌번호' })).toHaveTextContent('009876543210');
});

it('계좌가 없는 작업자도 기본 계좌를 등록하고 직불용 계좌를 별도 등록할 수 있다', async () => {
    render(<WorkerDatabase hideHeader />);
    for (const [purpose, bank, number] of [['기본 계좌', '기본은행', '001234567890'], ['직불용 계좌', '직불은행', '009999888877']]) {
        fireEvent.click(await screen.findByRole('button', { name: `다른작업자 ${purpose}·사진 등록/수정` }));
        fireEvent.change(screen.getByLabelText(`${purpose} 은행명`), { target: { value: bank } });
        fireEvent.change(screen.getByLabelText(`${purpose} 계좌번호`), { target: { value: number } });
        fireEvent.change(screen.getByLabelText(`${purpose} 예금주`), { target: { value: '별도예금주' } });
        fireEvent.click(screen.getByRole('button', { name: `${purpose} 저장` }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        const row = within(screen.getByRole('row', { name: /다른작업자/ }));
        expect(row.getByRole('cell', { name: purpose === '기본 계좌' ? '기본 은행' : '직불용 은행' })).toHaveTextContent(bank);
        expect(row.getByRole('cell', { name: `${purpose}번호` })).toHaveTextContent(number);
    }
    expect(workers[1].accountNumber).toBe('001234567890'); expect(workers[1].directPayAccountNumber).toBe('009999888877');
    fireEvent.change(screen.getByPlaceholderText('이름, 주민번호, 연락처, 회사, 계좌 검색'), { target: { value: '009999888877' } });
    expect(screen.getByRole('button', { name: '다른작업자 직불용 계좌·사진 등록/수정' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '검증작업자 기본 계좌·사진 등록/수정' })).not.toBeInTheDocument();
});

it('직불용 계좌번호를 목록에서 수정하면 기본 계좌번호는 유지한다', async () => {
    workers[0].directPayAccountNumber = '001111222233';
    render(<WorkerDatabase hideHeader />);
    await screen.findByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' });
    const row = within(screen.getByRole('row', { name: /검증작업자/ }));
    fireEvent.click(within(row.getByRole('cell', { name: '직불용 계좌번호' })).getByText('001111222233'));
    fireEvent.change(screen.getByPlaceholderText('직불용 계좌번호'), { target: { value: '000123456789' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-a', { directPayAccountNumber: '000123456789' }));
    expect(workers[0].accountNumber).toBe('009876543210');
    expect(row.getByRole('cell', { name: '기본 계좌번호' })).toHaveTextContent('009876543210');
    expect(row.getByRole('cell', { name: '직불용 계좌번호' })).toHaveTextContent('000123456789');
});

it('목록에서 잘못된 계좌번호를 입력하면 저장하지 않고 기존 번호로 복구한다', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    try {
        workers[0].directPayAccountNumber = '001111222233';
        render(<WorkerDatabase hideHeader />);
        await screen.findByRole('button', { name: '검증작업자 직불용 계좌·사진 등록/수정' });
        fireEvent.click(screen.getByText('001111222233'));
        fireEvent.change(screen.getByPlaceholderText('직불용 계좌번호'), { target: { value: '123-****' } });
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
        await screen.findByText('001111222233');
        expect(manpowerService.updateWorker).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('숫자 6~20자리'));
    } finally { alert.mockRestore(); }
});
