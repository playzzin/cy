import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LaborCheckPage from './LaborCheckPage';
import { dailyReportService } from '../../services/dailyReportService';
import { dailyWorkerReportSiteService } from '../../services/dailyWorkerReportSiteService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { teamService } from '../../services/teamService';

// 월간 표 조회·편집 흐름이 전체 릴리스 검사와 병렬 실행될 시간을 확보한다.
jest.setTimeout(15000);

jest.mock('../../components/common/OutputManagementTabs', () => () => <div>인원체크</div>);
jest.mock('../../services/dailyReportService', () => ({
    dailyReportService: { getReportWorkerRowsByRange: jest.fn(), getWorkerRows: jest.fn() },
}));
jest.mock('../../services/dailyWorkerReportSiteService', () => ({
    dailyWorkerReportSiteService: {
        getByDateRange: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
    },
}));
jest.mock('../../services/companyService', () => ({
    companyService: { getCompanies: jest.fn() },
}));
jest.mock('../../services/manpowerService', () => ({
    manpowerService: { getWorkers: jest.fn() },
}));
jest.mock('../../services/siteService', () => ({
    siteService: { getSites: jest.fn() },
}));
jest.mock('../../services/teamService', () => ({
    teamService: { getTeams: jest.fn() },
}));

describe('LaborCheckPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{
            id: 'worker-1',
            name: '김효동',
            teamId: 'team-1',
            teamName: '김효동팀',
            status: 'active',
            isActive: true,
        }]);
        (teamService.getTeams as jest.Mock).mockResolvedValue([{
            id: 'team-1',
            name: '김효동팀',
            type: '시공팀',
            color: '#0f766e',
        }]);
        (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
        (siteService.getSites as jest.Mock).mockResolvedValue([]);
        (dailyWorkerReportSiteService.getByDateRange as jest.Mock).mockResolvedValue([]);
        (dailyWorkerReportSiteService.save as jest.Mock).mockImplementation(async (record) => ({ id: 'saved-record', ...record }));
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([{
            date: '2026-08-21',
            workerId: 'worker-1',
            workerName: '김효동',
            workerTeamId: 'team-1',
            workerTeamName: '김효동팀',
            paymentType: '노무',
            payType: '일급제',
            salaryModel: '일급제',
            siteName: '테스트 현장',
            manDay: 1,
            isEmptyReport: false,
        }]);
    });

    it('노무 출역이 반영된 흰색 칸에 과거 신고 현장명을 남기지 않는다', async () => {
        (dailyWorkerReportSiteService.getByDateRange as jest.Mock).mockResolvedValue([
            {workerKey: 'worker-1', date: '2026-08-21', reportedSiteName: '출역하지 않은 과거 현장'},
        ]);
        render(<MemoryRouter initialEntries={['/reports/labor-check?month=2026-08']}><LaborCheckPage /></MemoryRouter>);
        await screen.findByText('김효동');
        expect(screen.queryByText('출역하지 않은 과거 현장')).toBeNull();
        expect(dailyWorkerReportSiteService.delete).not.toHaveBeenCalled();
    });

    it('직불가능인원만 조회하고 전체인원으로 돌아올 수 있다', async () => {
        (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
            {id:'worker-1',name:'직불작업자',teamId:'team-1',teamName:'김효동팀',isActive:true},
            {id:'worker-2',name:'위임작업자',teamId:'team-1',teamName:'김효동팀',isActive:true,laborStatementPayType:'delegate'},
        ]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([1,2].map(id => ({
            workerId:`worker-${id}`,workerName:id === 1 ? '직불작업자' : '위임작업자',workerTeamId:'team-1',workerTeamName:'김효동팀',date:'2026-08-21',manDay:1,paymentType:'노무',isEmptyReport:false,
        })));
        render(<MemoryRouter initialEntries={['/reports/labor-check?month=2026-08']}><LaborCheckPage /></MemoryRouter>);
        await screen.findByText('위임작업자');
        fireEvent.click(screen.getByRole('button',{name:'직불가능인원'}));
        expect(screen.queryByText('위임작업자')).toBeNull();
        expect(screen.getByText('직불작업자')).not.toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'전체인원'}));
        expect(screen.getByText('위임작업자')).not.toBeNull();
    });

    it('공수가 0인 행을 실제 출역으로 보지 않는다', async () => {
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([
            {workerId:'worker-1',workerName:'김효동',workerTeamId:'team-1',workerTeamName:'김효동팀',date:'2026-08-21',manDay:0,paymentType:'노무',siteName:'미출역 현장'},
        ]);
        render(<MemoryRouter initialEntries={['/reports/labor-check?month=2026-08']}><LaborCheckPage /></MemoryRouter>);
        await waitFor(() => expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenCalled());
        expect(screen.queryByText('미출역 현장')).toBeNull();
        expect(screen.queryByText('김효동')).toBeNull();
    });

    it('활성화 후 작업자를 선택하면 첫 출역일 이전 칸에 현장을 입력할 수 있다', async () => {
        render(
            <MemoryRouter initialEntries={['/reports/labor-check?month=2026-08']}>
                <LaborCheckPage />
            </MemoryRouter>
        );

        await screen.findByText('김효동');
        expect(screen.queryByRole('button', { name: '김효동 2026-08-01 대체 현장명' })).toBeNull();

        fireEvent.click(screen.getByRole('checkbox', { name: '비활성 칸 입력' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '김효동 비활성 칸 입력 대상' }));

        const inactiveCellButton = await screen.findByRole('button', { name: '김효동 2026-08-01 대체 현장명' });
        fireEvent.click(inactiveCellButton);

        expect(screen.getByRole('dialog', { name: '신고 현장 선택 또는 직접 입력' })).not.toBeNull();
        expect(screen.getByLabelText('신고할 현장명')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '대체 현장 선택 닫기' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '비활성 칸 입력' }));

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: '김효동 2026-08-01 대체 현장명' })).toBeNull();
        });
    });

    const output = (workerId: string, date: string, manDay = 1, paymentType = '노무') => ({
        workerId, workerName: workerId, workerTeamId: 'team-1', workerTeamName: '김효동팀',
        date, manDay, paymentType, siteName: '검증 현장', isEmptyReport: false,
    });
    const cell = (workerName: string, day: number) => (
        within(screen.getByRole('row', { name: new RegExp(`^${workerName}`) })).getAllByRole('cell')[day - 1]
    );
    const renderSeptember = () => render(
        <MemoryRouter initialEntries={['/reports/labor-check?month=2026-09&teamId=team-1']}>
            <LaborCheckPage />
        </MemoryRouter>
    );

    it('기존 인원은 오래전 다른 팀 출역 이력도 반영해 월초부터 미출역 색상과 입력을 활성화한다', async () => {
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([
            { ...output('worker-1', '2025-12-31'), workerTeamId: 'old-team', workerTeamName: '이전 팀' },
            output('worker-1', '2026-09-02'),
        ]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([
            output('worker-1', '2026-09-02'), output('worker-1', '2026-09-03', 1, '계산서'),
        ]);
        renderSeptember();
        const firstDay = await screen.findByRole('button', { name: '김효동 2026-09-01 대체 현장명' });
        expect(cell('김효동', 1)).toHaveClass('bg-yellow-200');
        expect(cell('김효동', 2)).toHaveClass('bg-white');
        expect(cell('김효동', 3)).toHaveClass('bg-sky-200');
        fireEvent.click(firstDay);
        fireEvent.change(screen.getByLabelText('신고할 현장명'), { target: { value: '월초 신고 현장' } });
        fireEvent.click(screen.getByRole('button', { name: '“월초 신고 현장” 사용' }));
        await waitFor(() => expect(dailyWorkerReportSiteService.save).toHaveBeenCalledWith(expect.objectContaining({
            workerKey: 'worker-1', date: '2026-09-01', reportedSiteName: '월초 신고 현장',
        })));
    });

    it('신규 인원은 등록일이나 공수 0인 과거 행이 있어도 실제 첫 출역일부터 표시한다', async () => {
        (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
            { id: 'new-worker', name: '신규 인원', teamId: 'team-1', teamName: '김효동팀', isActive: true, createdAt: '2026-07-01' },
        ]);
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([
            output('new-worker', '2026-08-01', 0), output('new-worker', '2026-09-05'),
        ]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([output('new-worker', '2026-09-05')]);
        renderSeptember();
        await screen.findByText('신규 인원');
        expect(cell('신규 인원', 1)).toHaveClass('bg-slate-100');
        expect(cell('신규 인원', 4)).toHaveClass('bg-slate-100');
        expect(cell('신규 인원', 5)).toHaveClass('bg-white');
        expect(cell('신규 인원', 6)).toHaveClass('bg-yellow-200');
        expect(screen.queryByRole('button', { name: '신규 인원 2026-09-01 대체 현장명' })).toBeNull();
    });

    it('월을 변경하면 첫 출역일을 유지하고 과거 이력을 중복 조회하지 않는다', async () => {
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([output('worker-1', '2026-09-05')]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockImplementation(({ startDate }) => Promise.resolve([
            output('worker-1', `${startDate.slice(0, 7)}-05`),
        ]));
        renderSeptember();
        await screen.findByText('김효동');
        expect(cell('김효동', 1)).toHaveClass('bg-slate-100');
        fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
        await screen.findByRole('button', { name: '김효동 2026-10-01 대체 현장명' });
        expect(cell('김효동', 1)).toHaveClass('bg-yellow-200');
        expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1);
    });

    it('새로고침하면 추가 또는 삭제된 과거 출역 이력도 다시 반영한다', async () => {
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([output('worker-1', '2026-09-02')]);
        renderSeptember();
        await screen.findByText('김효동');
        expect(cell('김효동', 1)).toHaveClass('bg-slate-100');
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([output('worker-1', '2026-08-31')]);
        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
        await screen.findByRole('button', { name: '김효동 2026-09-01 대체 현장명' });
        expect(cell('김효동', 1)).toHaveClass('bg-yellow-200');
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([]);
        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
        await screen.findByText('김효동');
        expect(cell('김효동', 1)).toHaveClass('bg-slate-100');
        expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(3);
    });

    it('과거 이력 조회가 실패하면 기존 표를 숨기고 재시도한다', async () => {
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([output('worker-1', '2026-08-31')]);
            (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([output('worker-1', '2026-09-02')]);
            renderSeptember();
            await screen.findByText('김효동');
            (dailyReportService.getWorkerRows as jest.Mock).mockRejectedValueOnce(new Error('history unavailable'));
            fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
            await screen.findByRole('alert');
            expect(screen.queryByText('김효동')).toBeNull();
            fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
            await screen.findByRole('button', { name: '김효동 2026-09-01 대체 현장명' });
            expect(cell('김효동', 1)).toHaveClass('bg-yellow-200');
        } finally {
            errorLog.mockRestore();
        }
    });

    it('늦게 도착한 이전 달 응답이 현재 월의 표를 덮어쓰지 않는다', async () => {
        let resolveSeptember!: (rows: unknown[]) => void;
        const september = new Promise<unknown[]>(resolve => { resolveSeptember = resolve; });
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([output('worker-1', '2026-08-31')]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockImplementation(({ startDate }) => (
            startDate === '2026-09-01' ? september : Promise.resolve([output('worker-1', '2026-10-05')])
        ));
        renderSeptember();
        fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
        await screen.findByRole('button', { name: '김효동 2026-10-01 대체 현장명' });
        await act(async () => { resolveSeptember([output('worker-1', '2026-09-02')]); });
        expect(cell('김효동', 5)).toHaveClass('bg-white');
        expect(cell('김효동', 2)).toHaveClass('bg-yellow-200');
    });

    it('과거 출역만 있는 인원은 이번 달 출역자 필터를 해제했을 때만 월초부터 표시한다', async () => {
        (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([output('worker-1', '2026-07-31')]);
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([]);
        renderSeptember();
        await screen.findByText('선택한 달의 출역 기록이 없습니다.');
        expect(screen.queryByText('김효동')).toBeNull();
        fireEvent.click(screen.getByRole('checkbox', { name: '이번 달 출역자만' }));
        await screen.findByRole('button', { name: '김효동 2026-09-01 대체 현장명' });
        expect(cell('김효동', 1)).toHaveClass('bg-yellow-200');
    });

    it('출역 이력이 전혀 없는 인원은 전체 조회에서도 임의로 월초부터 색칠하지 않는다', async () => {
        (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue([]);
        renderSeptember();
        await screen.findByText('선택한 달의 출역 기록이 없습니다.');
        fireEvent.click(screen.getByRole('checkbox', { name: '이번 달 출역자만' }));
        await screen.findByText('김효동');
        expect(cell('김효동', 1)).toHaveClass('bg-slate-100');
        expect(cell('김효동', 1)).toHaveAttribute('title', '출역 이력 없음 · 신고 대상 아님');
    });
});
