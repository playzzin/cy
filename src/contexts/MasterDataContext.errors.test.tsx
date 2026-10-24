import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MasterDataProvider, useMasterData } from './MasterDataContext';
import MasterDataLoadNotice from '../components/common/MasterDataLoadNotice';
import { companyService } from '../services/companyService';
import { teamService } from '../services/teamService';
import { siteService } from '../services/siteService';
import { positionService } from '../services/positionService';

jest.mock('../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../services/positionService', () => ({ positionService: { getPositions: jest.fn() } }));
jest.mock('../services/teamScopedReadService', () => ({ invalidateTeamScopedCache: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));

function TestConsumer() {
    const { teams, refreshAll } = useMasterData();
    return <><MasterDataLoadNotice /><p>{teams.map(team => team.name).join(',')}</p><button onClick={() => void refreshAll()}>조회 재시도</button></>;
}

beforeEach(() => {
    [companyService.getCompanies, teamService.getTeams, siteService.getSites, positionService.getPositions]
        .forEach(read => (read as jest.Mock).mockResolvedValue([]));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('팀 누락으로 여러 조회가 실패하면 공통 원인을 한 번 표시하고 연결 수정 후 재조회로 복구한다', async () => {
    const error = Object.assign(new Error('연결된 작업자에게 소속 팀이 지정되지 않았습니다.'), { code: 'functions/failed-precondition' });
    (teamService.getTeams as jest.Mock).mockRejectedValueOnce(error);
    (siteService.getSites as jest.Mock).mockRejectedValueOnce(error);
    render(<MasterDataProvider><TestConsumer /></MasterDataProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('기존 작업자와 계정 연결, 소속 팀 지정');
    expect(screen.getAllByText(/관리자에게 기존 작업자/)).toHaveLength(1);
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'team-a', name: '검증용 팀' }]);
    fireEvent.click(screen.getByRole('button', { name: '조회 재시도' }));
    await screen.findByText('검증용 팀');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('재조회가 실패하면 이전 데이터가 최신 결과로 남지 않는다', async () => {
    (teamService.getTeams as jest.Mock).mockResolvedValueOnce([{ id: 'team-a', name: '검증용 팀' }]);
    render(<MasterDataProvider><TestConsumer /></MasterDataProvider>);
    await screen.findByText('검증용 팀');
    (teamService.getTeams as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
    fireEvent.click(screen.getByRole('button', { name: '조회 재시도' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 권한');
    expect(screen.queryByText('검증용 팀')).not.toBeInTheDocument();
});
