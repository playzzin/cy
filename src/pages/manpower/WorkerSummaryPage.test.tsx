import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WorkerSummaryPage from './WorkerSummaryPage';
import { manpowerService } from '../../services/manpowerService';
import html2canvas from 'html2canvas';
import { useRestrictedTeamWorkflow } from '../../routes/TeamWorkflowGate';
import { getTeamScopedRows } from '../../services/teamScopedReadService';
import { readWorkerBankPhoto, saveWorkerBankPhoto } from '../../services/workerBankPhotoService';

jest.mock('../../routes/TeamWorkflowGate', () => ({ useRestrictedTeamWorkflow: jest.fn() }));
jest.mock('../../services/teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));

jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(), updateWorker: jest.fn() } }));
jest.mock('../../services/workerBankPhotoService', () => ({
    ...jest.requireActual('../../services/workerBankPhotoService'), readWorkerBankPhoto: jest.fn(), saveWorkerBankPhoto: jest.fn(),
}));
jest.mock('../../services/teamService', () => ({
    teamService: { getTeams: async () => [
        { id: 'a', name: '가상 A팀', companyName: '청연', color: '#228be6' },
        { id: 'b', name: '가상 B팀', companyName: '청연', color: '#12b886' }
    ] }
}));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), warning: jest.fn(), info: jest.fn(), success: jest.fn() } }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(false);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        { id: 'one', name: '가상가', teamId: 'a', teamName: '가상 A팀', status: '재직', fileNameSaved: 'synthetic/identity.png', bankPhotoId: 'basic-photo' },
        { id: 'two', name: '가상나', teamId: 'a', teamName: '가상 A팀', status: '재직', fileNameSaved: ' ', directPayBankPhotoId: 'direct-pay-photo' },
        { id: 'three', name: '가상다', teamId: 'b', teamName: '가상 B팀', status: '재직' },
        { id: 'inactive', name: '가상퇴사', teamId: 'a', status: '퇴사' }
    ]);
});

test('팀장은 같은 회사의 다른 팀 인원을 섞어 명단을 만들고 서류 권한은 내 팀에 유지한다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (getTeamScopedRows as jest.Mock).mockResolvedValue([{
        teams: [{ id: 'a', legacyId: 'legacy-a', name: '가상 A팀' }, { id: 'b', name: '가상 B팀' }],
        workers: [
            { id: 'one', name: '가상가', teamId: 'a', status: '재직' },
            { id: 'two', name: '가상나', teamId: 'legacy-a', status: '재직' },
            { id: 'other', name: '다른 팀 인원', teamId: 'b' },
            { id: 'unassigned', name: '미배정 인원' },
            { id: 'retired', name: '퇴사 인원', teamId: 'b', status: '퇴사' },
        ], documentWorkerIds: ['one', 'two'],
    }]);
    await openPage();
    expect(getTeamScopedRows).toHaveBeenCalledWith('worker_summary_directory');
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: '전체 팀 보기 (3명)' })).toBeInTheDocument();
    expect(screen.queryByText('미배정 인원')).not.toBeInTheDocument();
    expect(screen.queryByText('퇴사 인원')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    fireEvent.change(screen.getByRole('combobox', { name: '소속 팀' }), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '다른 팀 인원 선택' }));
    expect(screen.getByRole('status')).toHaveTextContent('2명 선택');
    expect(screen.getByRole('table')).toHaveTextContent('가상가');
    expect(screen.getByRole('table')).toHaveTextContent('다른 팀 인원');
    expect(screen.getByText(/서류 공유·등록은 선택한 내 팀 인원 1명/)).toBeInTheDocument();
    const otherTeamRow = screen.getByRole('row', { name: /다른 팀 인원/ });
    expect(within(otherTeamRow).getByLabelText('신분증 확인 불가')).toBeInTheDocument();
    expect(within(otherTeamRow).getByLabelText('직불용 통장사본 확인 불가')).toBeInTheDocument();
    expect(within(otherTeamRow).queryByText('미등록')).not.toBeInTheDocument();
});

test('팀 조회 권한을 확인하지 못하면 전체 작업자 조회로 대체하지 않는다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<WorkerSummaryPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('소속 팀 연결');
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    log.mockRestore();
});

async function openPage() {
    render(<WorkerSummaryPage />);
    await screen.findByRole('checkbox', { name: '가상가 선택' });
}

test('팀과 검색어를 바꿔도 선택을 유지하고 전체 선택은 현재 목록에만 적용한다', async () => {
    await openPage();
    expect(screen.queryByRole('checkbox', { name: '가상퇴사 선택' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상다 선택' }));
    fireEvent.change(screen.getByRole('combobox', { name: '소속 팀' }), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /목록 전체 선택/ }));
    expect(screen.getByRole('status')).toHaveTextContent('3명 선택');
    const firstRow = screen.getByRole('row', { name: /가상가/ });
    expect(within(firstRow).getByLabelText('신분증 등록')).toBeInTheDocument();
    expect(within(firstRow).getByLabelText('직불용 통장사본 미등록')).toBeInTheDocument();
    const secondRow = screen.getByRole('row', { name: /가상나/ });
    expect(within(secondRow).getByLabelText('신분증 미등록')).toBeInTheDocument();
    expect(within(secondRow).getByLabelText('직불용 통장사본 등록')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /목록 전체 선택/ }));
    expect(screen.getByRole('status')).toHaveTextContent('1명 선택');
    expect(screen.getByRole('status')).toHaveTextContent('현재 목록 밖 1명 포함');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  가상다  ' } });
    expect(screen.getByRole('checkbox', { name: '가상다 선택' })).toBeChecked();
});

test('부분 선택을 표시하고 선택만 보기에서 개별 해제와 빈 목록 복구가 가능하다', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    expect((screen.getByRole('checkbox', { name: /목록 전체 선택/ }) as HTMLInputElement).indeterminate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '선택만 1' }));
    expect(screen.queryByRole('checkbox', { name: '가상나 선택' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    expect(screen.getByRole('checkbox', { name: /목록 전체 선택/ })).toBeDisabled();
    expect(screen.getByText('선택한 작업자가 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 작업자 보기' }));
    expect(screen.getByRole('checkbox', { name: '가상나 선택' })).toBeInTheDocument();
});

test('화면 전환 후 요약에 초점을 옮기고 카드에서 선택을 해제한다', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: '요약 보기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '요약 보기' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '작업자 요약 1명 선택됨' })).toHaveFocus());
    expect(screen.getByRole('button', { name: '요약 확인 1' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '가상가 선택 해제' }));
    expect(screen.getByRole('status')).toHaveTextContent('0명 선택');
    expect(screen.getByRole('button', { name: 'PC 공유' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '모바일 공유' })).toBeDisabled();
});

test('검색 결과가 없어도 선택은 보존되며 검색어만 지울 수 있다', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없는 이름' } });
    expect(screen.getByText('조건에 맞는 작업자가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1명 선택');
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByRole('checkbox', { name: '가상가 선택' })).toBeChecked();
});

test.each(['PC 공유', '모바일 공유'])('%s는 신분증·직불용 통장사본 사진을 제외한 명단만 만든다', async action => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const write = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: jest.fn() });
    (html2canvas as jest.Mock).mockImplementation(async (table, options) => {
        const clone = table.cloneNode(true) as HTMLTableElement;
        // html2canvas omits these UI-only cells before invoking onclone.
        // eslint-disable-next-line testing-library/no-node-access -- reproduce html2canvas's detached export clone
        clone.querySelectorAll('[data-html2canvas-ignore]').forEach(node => node.remove());
        options.onclone(document, clone);
        expect(clone).toHaveAttribute('data-export', 'true');
        expect(clone.style.width).toBe('1080px');
        expect(clone.textContent).not.toContain('신분증');
        expect(clone.textContent).not.toContain('직불용 통장사본');
        expect(within(clone).queryByRole('img')).not.toBeInTheDocument();
        expect(options.windowWidth).toBe(1280);
        expect(table).not.toHaveAttribute('data-export');
        return { toBlob: (callback: BlobCallback) => callback(new Blob(['synthetic'], { type: 'image/png' })) };
    });
    await openPage();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    expect(screen.queryByRole('checkbox', { name: '신분증 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '신분증' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '통장사본 직불용' })).toBeInTheDocument();
    expect(readWorkerBankPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => expect(action === 'PC 공유' ? write : share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls.map(([data]) => data.files.length)).toEqual(action === '모바일 공유' ? [1] : []);
});

test.each([false, true])('작업자 요약에서 직불용 통장사본을 등록·공유한다 (팀 제한: %s)', async restricted => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(restricted);
    (getTeamScopedRows as jest.Mock).mockResolvedValue([{
        teams: [{ id: 'a', name: '가상 A팀' }],
        workers: [{ id: 'one', name: '가상가', teamId: 'a', status: '재직', bankPhotoId: 'a'.repeat(32) }],
        documentWorkerIds: ['one'],
    }]);
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:bank-copy') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
    const file = new File(['synthetic-original'], 'bank.png', { type: 'image/png' });
    (saveWorkerBankPhoto as jest.Mock).mockImplementation(async (_id, _file, photoId) => photoId);
    (readWorkerBankPhoto as jest.Mock).mockResolvedValue(file);
    await openPage();
    for (const label of ['PC 공유', '모바일 공유', '신분증 공유', '직불용 통장사본 공유', '직불용 통장사본 등록']) {
        expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    const selectedRow = screen.getByRole('row', { name: /가상가/ });
    expect(within(selectedRow).getByLabelText('직불용 통장사본 미등록')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 등록' }));
    expect(screen.getByText(/은행명·계좌번호·예금주는 변경되지 않습니다/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('가상가 직불용 통장사본 선택'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '사진 1장 원본 등록' }));
    await screen.findByText(/1장 등록 완료/);
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('one', file, expect.any(String), '', 'directPay');
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 등록 닫기' }));
    expect(within(selectedRow).getByLabelText('직불용 통장사본 등록')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 공유' }));
    await screen.findByAltText('가상가 직불용 통장사본 공유 미리보기');
    expect(readWorkerBankPhoto).toHaveBeenCalledWith('one', '01_가상가_직불용 통장사본', expect.any(AbortSignal), 'directPay');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    const savedPhotoId = (saveWorkerBankPhoto as jest.Mock).mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 공유 닫기' }));
    fireEvent.click(screen.getByRole('button', { name: '직불용 통장사본 등록' }));
    expect(screen.getByText('기존 직불용 통장사본 있음')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('가상가 직불용 통장사본 선택'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '사진 1장 원본 등록' }));
    await waitFor(() => expect(saveWorkerBankPhoto).toHaveBeenCalledTimes(2));
    expect(saveWorkerBankPhoto).toHaveBeenLastCalledWith('one', file, expect.any(String), savedPhotoId, 'directPay');
});
