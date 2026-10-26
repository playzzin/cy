import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { uploadBytes } from 'firebase/storage';
import WorkerDatabase from './WorkerDatabase';
import { manpowerService, Worker } from '../../services/manpowerService';
import { geminiService } from '../../services/geminiService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: (_storage: unknown, path: string) => ({ fullPath: path }), uploadBytes: jest.fn(), getDownloadURL: jest.fn(), getBlob: jest.fn() }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(), updateWorker: jest.fn(), addWorker: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/positionService', () => ({ positionService: { getPositions: async () => [] } }));
jest.mock('../../services/statisticsService', () => ({ statisticsService: { getCumulativeManpower: async () => ({ workerStats: {} }) } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: { analyzeImage: jest.fn(), analyzeBankBook: jest.fn() } }));
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

let workers: Worker[];
const photo = () => new File(['synthetic photo'], 'fixture.png', { type: 'image/png' });
const choose = (file = photo()) => fireEvent.change(screen.getByLabelText('신분증 사진 선택'), { target: { files: [file] } });
const save = () => fireEvent.click(screen.getByRole('button', { name: '신분증 저장' }));
const open = async (name = '검증작업자 신분증 등록') => {
    render(<WorkerDatabase hideHeader />);
    fireEvent.click(await screen.findByRole('button', { name }));
    expect(screen.getByRole('dialog')).toBeVisible();
};

beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    workers = [
        { id: 'worker-a', name: '검증작업자', status: 'active', idNumber: 'synthetic-id', address: '검증용 주소', accountNumber: '001234567890' },
        { id: 'worker-b', name: '다른작업자', status: 'active', fileNameSaved: 'id_cards/existing.png' },
    ];
    (manpowerService.getWorkers as jest.Mock).mockImplementation(async () => workers.map(worker => ({ ...worker })));
    (manpowerService.updateWorker as jest.Mock).mockImplementation(async (id: string, patch: Partial<Worker>) => {
        workers = workers.map(worker => worker.id === id ? { ...worker, ...patch } : worker);
    });
    (uploadBytes as jest.Mock).mockResolvedValue({});
    URL.createObjectURL = jest.fn(() => 'blob:synthetic-id-photo');
    URL.revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
});

it('기존 작업자에게 AI 없이 사진만 등록하고 다시 조회해도 등록 상태를 유지한다', async () => {
    const before = workers.map(worker => ({ ...worker }));
    const view = render(<WorkerDatabase hideHeader />);
    fireEvent.click(await screen.findByRole('button', { name: '검증작업자 신분증 등록' }));
    expect(screen.getByRole('button', { name: '신분증 저장' })).toBeDisabled();
    choose();
    expect(screen.getByAltText('등록할 신분증 사진 미리보기')).toBeVisible();
    expect(uploadBytes).not.toHaveBeenCalled();
    save();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const path = (uploadBytes as jest.Mock).mock.calls[0][0].fullPath;
    expect(path).toMatch(/^id_cards\/[a-f0-9]{32}\.png$/);
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-a', { fileNameSaved: path });
    expect(workers).toEqual([{ ...before[0], fileNameSaved: path }, before[1]]);
    expect(manpowerService.addWorker).not.toHaveBeenCalled();
    expect(geminiService.analyzeImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '검증작업자 신분증 등록' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검증작업자 신분증 교체' })).toBeVisible();
    expect(within(screen.getByRole('row', { name: /검증작업자/ })).getByRole('button', { name: /^신분증$/ })).toHaveAttribute('title', '신분증 다운로드');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-id-photo');
    view.unmount(); render(<WorkerDatabase hideHeader />);
    expect(await screen.findByRole('button', { name: '검증작업자 신분증 교체' })).toBeVisible();
});

it('등록된 신분증은 선택한 작업자의 사진만 교체한다', async () => {
    await open('다른작업자 신분증 교체');
    expect(screen.getByRole('dialog')).toHaveTextContent('다른작업자 · 신분증 교체');
    choose(); save();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-b', { fileNameSaved: expect.stringMatching(/^id_cards\//) });
    expect(workers[0].fileNameSaved).toBeUndefined();
});

it('사진 선택 후 취소하면 업로드하거나 작업자를 변경하지 않는다', async () => {
    await open(); choose();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '검증작업자 신분증 등록' }));
    expect(screen.getByRole('button', { name: '신분증 저장' })).toBeDisabled();
});

it.each([
    ['잘못된 형식', () => new File(['fixture'], 'fixture.pdf', { type: 'application/pdf' })],
    ['빈 사진', () => new File([], 'empty.png', { type: 'image/png' })],
    ['용량 초과', () => new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })],
] as const)('%s 사진을 선택하면 이전 사진도 저장하지 않는다', async (_label, makeFile) => {
    await open(); choose(); choose(makeFile());
    expect(screen.getByRole('alert')).toHaveTextContent('5MB 이하');
    expect(screen.getByRole('button', { name: '신분증 저장' })).toBeDisabled();
    expect(screen.queryByAltText('등록할 신분증 사진 미리보기')).not.toBeInTheDocument();
    expect(uploadBytes).not.toHaveBeenCalled();
});

it('브라우저에서 열리지 않는 사진은 저장하지 않는다', async () => {
    await open(); choose();
    fireEvent.error(screen.getByAltText('등록할 신분증 사진 미리보기'));
    expect(screen.getByRole('alert')).toHaveTextContent('사진을 열지 못했습니다');
    expect(screen.getByRole('button', { name: '신분증 저장' })).toBeDisabled();
});

it('MIME 형식이 비어 있으면 확장자로 보완해 업로드한다', async () => {
    await open(); choose(new File(['fixture'], 'fixture.PNG')); save();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((uploadBytes as jest.Mock).mock.calls[0][1].type).toBe('image/png');
});

it('업로드 권한 오류 시 미등록 상태와 선택한 사진을 유지해 재시도할 수 있다', async () => {
    (uploadBytes as jest.Mock).mockRejectedValueOnce({ code: 'storage/unauthorized' });
    await open(); choose(); save();
    await screen.findByText('신분증을 저장할 권한이 없습니다. 로그인 계정과 권한을 확인해 주세요.');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    expect(workers[0].fileNameSaved).toBeUndefined();
    save();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(uploadBytes).toHaveBeenCalledTimes(2);
});

it('작업자 연결 실패 시 등록 완료로 표시하지 않고 이미 올린 사진으로 재시도한다', async () => {
    (manpowerService.updateWorker as jest.Mock).mockRejectedValueOnce(new Error('synthetic write failure'));
    await open(); choose(); save();
    await screen.findByRole('alert');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(workers[0].fileNameSaved).toBeUndefined();
    save();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(manpowerService.updateWorker).toHaveBeenCalledTimes(2);
});

it('저장 중 중복 저장·취소·사진 변경을 막는다', async () => {
    let finishUpload!: (value: object) => void;
    (uploadBytes as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve; }));
    await open(); choose(); save();
    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    expect(screen.getByLabelText('신분증 사진 선택')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '저장 중…' }));
    await act(async () => finishUpload({}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(manpowerService.updateWorker).toHaveBeenCalledTimes(1);
});
