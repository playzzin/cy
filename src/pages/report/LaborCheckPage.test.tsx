import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LaborCheckPage from './LaborCheckPage';
import { dailyReportService } from '../../services/dailyReportService';
import { dailyWorkerReportSiteService } from '../../services/dailyWorkerReportSiteService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { teamService } from '../../services/teamService';

jest.mock('../../components/common/OutputManagementTabs', () => () => <div>인원체크</div>);
jest.mock('../../services/dailyReportService', () => ({
    dailyReportService: { getReportWorkerRowsByRange: jest.fn() },
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
});
