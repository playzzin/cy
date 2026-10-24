import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountManagementPage from './AccountManagementPage';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { accountDirectoryService } from '../../services/accountDirectoryService';
import { primaryAccountService } from '../../services/primaryAccountService';
import { geminiService } from '../../services/geminiService';

jest.mock('../../components/accounts/PagePrimaryAccountManager', () => () => null);
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(), updateWorker: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn(), updateTeam: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn(), updateCompany: jest.fn() } }));
jest.mock('../../services/accountDirectoryService', () => ({ accountDirectoryService: { getEntries: jest.fn().mockResolvedValue([]), updateEntry: jest.fn() } }));
jest.mock('../../services/geminiService', () => ({ geminiService: { analyzeBankBook: jest.fn() } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/primaryAccountService', () => ({
    primaryAccountService: {
        subscribe: jest.fn(() => () => undefined),
        getPrimaryAccount: jest.fn().mockResolvedValue(null),
    },
}));
jest.mock('xlsx', () => ({}));

const worker = (id: string, overrides: Partial<Worker> = {}): Worker => ({
    id, name: `검증-${id}`, status: '재직', isActive: true,
    teamId: 'team', salaryModel: '일급제', ...overrides,
});

const openPage = async () => {
    render(<MemoryRouter initialEntries={['/database/account-management?tab=workers']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccountManagementPage /></MemoryRouter>);
    return screen.findByRole('button', { name: /^퇴사자 / });
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([]);
    (primaryAccountService.getPrimaryAccount as jest.Mock).mockResolvedValue(null);
    (primaryAccountService.subscribe as jest.Mock).mockImplementation(() => () => undefined);
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'team', name: '검증팀', companyId: 'company', type: '시공팀', status: 'active' },
        { id: 'ended-team', name: '종료팀', companyId: 'ended-company', type: '시공팀', status: '종료' },
        { id: 'hidden-team', name: '숨김팀', companyId: 'company', type: '시공팀', status: 'active' },
    ]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([
        { id: 'company', name: '청연 검증회사', status: 'active' },
        { id: 'ended-company', name: '청연 종료회사', status: '종료' },
        { id: 'outside-company', name: '외부 검증회사', status: 'active' },
    ]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
});

it('shows retired counts and switches between active, retired and all without enabling hidden accounts', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        worker('active'), worker('korean', { status: '퇴사' }),
        worker('flag', { isActive: false }), worker('inactive', { status: ' inactive ' }),
        worker('resigned', { status: ' RESIGNED ' }), worker('retired', { status: 'retired' }),
    ]);
    const retired = await openPage();
    expect(retired).toHaveTextContent('퇴사자5');
    expect(screen.getByRole('button', { name: '현재 작업자 1' })).toBeInTheDocument();
    expect(screen.getByText('검증-active')).toBeInTheDocument();
    expect(screen.queryByText('검증-korean')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /숨긴 계좌 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /숨김\/종료 포함/ })).not.toBeInTheDocument();

    fireEvent.click(retired);
    ['korean', 'flag', 'inactive', 'resigned', 'retired'].forEach(id => {
        expect(screen.getByText(`검증-${id}`)).toBeInTheDocument();
    });
    expect(screen.queryByText('검증-active')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 6' }));
    expect(screen.getByText('검증-active')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7);
    expect(manpowerService.getWorkers).toHaveBeenCalledWith(true);
});

it('includes retired workers from ended or missing teams using their known company, without including outside workers', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        worker('ended', { status: '퇴사', teamId: 'ended-team' }),
        worker('unassigned', { status: '퇴사', teamId: '', companyId: 'company' }),
        worker('legacy', { status: '퇴사', teamId: 'removed-team', teamName: '과거팀', companyName: '청연 검증회사' }),
        worker('outside', { status: '퇴사', teamId: '', companyId: 'outside-company' }),
        worker('unknown', { status: '퇴사', teamId: '' }),
    ]);
    fireEvent.click(await openPage());
    ['ended', 'unassigned', 'legacy'].forEach(id => expect(screen.getByText(`검증-${id}`)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '퇴사자 3' })).toBeInTheDocument();
    expect(screen.queryByText('검증-outside')).not.toBeInTheDocument();
    expect(screen.queryByText('검증-unknown')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /미배정 작업자/ })).toBeInTheDocument();
});

it('keeps manually hidden workers and team/company scopes hidden until explicitly included', async () => {
    localStorage.setItem('cy_account_management_hidden_accounts_v1', JSON.stringify([
        'worker:manual', 'team:hidden-team', 'company:ended-company',
    ]));
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        worker('visible', { status: '퇴사' }), worker('manual', { status: '퇴사' }),
        worker('team-hidden', { status: '퇴사', teamId: 'hidden-team' }),
        worker('company-hidden', { status: '퇴사', teamId: 'ended-team' }),
    ]);
    fireEvent.click(await openPage());
    expect(screen.getByRole('button', { name: '퇴사자 1' })).toBeInTheDocument();
    ['manual', 'team-hidden', 'company-hidden'].forEach(id => expect(screen.queryByText(`검증-${id}`)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: /숨긴 계좌 보기/ }));
    expect(screen.getByRole('button', { name: '퇴사자 4' })).toBeInTheDocument();
    ['manual', 'team-hidden', 'company-hidden'].forEach(id => expect(screen.getByText(`검증-${id}`)).toBeInTheDocument());
});

it('applies search, team and salary filters to retired workers and reports the displayed count', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        worker('daily', { status: '퇴사' }),
        worker('monthly', { status: '퇴사', salaryModel: '월급제' }),
        worker('other-team', { status: '퇴사', teamId: 'ended-team' }),
    ]);
    fireEvent.click(await openPage());
    fireEvent.change(screen.getByLabelText('팀 선택'), { target: { value: 'team' } });
    expect(screen.queryByText('검증-other-team')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '월급제 1' }));
    expect(screen.getByText('검증-monthly')).toBeInTheDocument();
    expect(screen.queryByText('검증-daily')).not.toBeInTheDocument();
    expect(screen.getByText(/명 중 현재/)).toHaveTextContent('현재 1명을 보고 있습니다.');
    fireEvent.change(screen.getByRole('textbox', { name: '계좌번호 관리 검색' }), { target: { value: '없는 대상' } });
    expect(screen.queryByText('검증-monthly')).not.toBeInTheDocument();
    expect(screen.getByText(/명 중 현재/)).toHaveTextContent('현재 0명을 보고 있습니다.');
});

it('shows ended team, company and custom accounts without an include-ended option', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([worker('active-ended-team', { teamId: 'ended-team' })]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([
        { id: 'ended-custom', name: '종료된 매입계좌', category: 'purchase', status: 'inactive' },
    ]);
    await openPage();
    expect(screen.getByText('검증-active-ended-team')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /숨긴 계좌 보기|숨김\/종료 포함/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '팀 계좌' }));
    expect(screen.getByText('종료팀')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '회사 계좌' }));
    expect(screen.getByText('청연 종료회사')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '매입/기타 계좌' }));
    expect(screen.getByText('종료된 매입계좌')).toBeInTheDocument();
});

it('distinguishes a load failure from an empty list and allows retry', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
        (manpowerService.getWorkers as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
        render(<MemoryRouter><AccountManagementPage /></MemoryRouter>);
        expect(await screen.findByRole('alert')).toHaveTextContent('계좌 데이터를 불러오지 못했습니다');
        (manpowerService.getWorkers as jest.Mock).mockResolvedValue([worker('retry', { status: '퇴사' })]);
        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
        fireEvent.click(await screen.findByRole('tab', { name: '작업자 계좌' }));
        fireEvent.click(await screen.findByRole('button', { name: '퇴사자 1' }));
        expect(screen.getByText('검증-retry')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
        consoleError.mockRestore();
    }
});

it.each(['worker', 'team', 'company', 'custom'] as const)('registers a photo to the selected %s without requiring the recipient name to equal the account holder', async kind => {
    URL.createObjectURL = jest.fn(() => 'blob:synthetic-bank');
    URL.revokeObjectURL = jest.fn();
    const fields = { bankName: '검증은행', accountNumber: '001234567890', accountHolder: '타인명의검증' };
    (geminiService.analyzeBankBook as jest.Mock).mockResolvedValue(fields);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([worker('recipient')]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([{ id: 'custom-id', name: '검증 매입', category: 'purchase', status: 'active' }]);
    const id = { worker: 'recipient', team: 'team', company: 'company', custom: 'custom-id' }[kind];
    const writers = { worker: manpowerService.updateWorker, team: teamService.updateTeam, company: companyService.updateCompany, custom: accountDirectoryService.updateEntry };
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: '계좌번호 등록 (사진 분석)' }));
    fireEvent.change(screen.getByLabelText('계좌 사진 선택'), { target: { files: [new File(['synthetic'], 'bank.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemini로 계좌 읽기' }));
    await waitFor(() => expect(screen.getByLabelText('1번 계좌번호')).toHaveValue(fields.accountNumber));
    expect(screen.getByLabelText('1번 등록할 사람·대상')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('1번 등록할 사람·대상'), { target: { value: `${kind}:${id}` } });
    fireEvent.click(screen.getByRole('checkbox', { name: '등록할 대상과 은행·전체 계좌번호·예금주를 확인했습니다.' }));
    fireEvent.click(screen.getByRole('button', { name: '확인한 계좌 1건 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writers[kind]).toHaveBeenCalledWith(id, fields);
    Object.entries(writers).filter(([key]) => key !== kind).forEach(([, writer]) => expect(writer).not.toHaveBeenCalled());
    expect(screen.getByText('검증-recipient')).toBeVisible();
});
