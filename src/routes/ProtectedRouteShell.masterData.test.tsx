import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRouteShell from './ProtectedRouteShell';
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
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../hooks/useWorkerTeamIdMigration', () => ({ useWorkerTeamIdMigration: () => ({ status: 'done', result: null }) }));
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../components/auth/ProfileSetup', () => () => null);
jest.mock('../components/auth/AccountApprovalStatus', () => () => null);
jest.mock('../components/common/AppIntroScreen', () => () => <p>준비 중</p>);
jest.mock('../components/layout/DashboardLayout', () => {
  const { useNavigate } = jest.requireActual('react-router-dom');
  const { useMasterData } = jest.requireActual('../contexts/MasterDataContext');
  return function TestLayout() {
    const navigate = useNavigate();
    const { companies, loading, refreshAll } = useMasterData();
    return <>
      <span data-testid="master-state">{loading ? 'loading' : companies.map((company: { name: string }) => company.name).join(',')}</span>
      <button onClick={() => navigate('/database/sites')}>현장 관리 이동</button>
      <button onClick={() => void refreshAll()}>마스터 새로고침</button>
    </>;
  };
});

const reads = [companyService.getCompanies, teamService.getTeams, siteService.getSites, positionService.getPositions];

beforeEach(() => {
  jest.clearAllMocks();
  (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'fixture-company', name: '검증용 회사' }]);
  (teamService.getTeams as jest.Mock).mockResolvedValue([]);
  (siteService.getSites as jest.Mock).mockResolvedValue([]);
  (positionService.getPositions as jest.Mock).mockResolvedValue([]);
});

test.each(['/manpower/team-worker-requests', '/support/team-expense-requests/'])(
  '%s 진입은 전체 마스터를 조회하지 않고 다른 업무 화면 이동 시 조회한다', async path => {
    render(<MemoryRouter initialEntries={[path]}><ProtectedRouteShell /></MemoryRouter>);
    await screen.findByRole('button', { name: '현장 관리 이동' });
    reads.forEach(read => expect(read).not.toHaveBeenCalled());
    expect(screen.getByTestId('master-state')).not.toHaveTextContent('loading');

    fireEvent.click(screen.getByRole('button', { name: '현장 관리 이동' }));
    await waitFor(() => expect(screen.getByTestId('master-state')).toHaveTextContent('검증용 회사'));
    reads.forEach(read => expect(read).toHaveBeenCalledTimes(1));
  },
);

test('기존 업무 화면은 진입 즉시 전체 마스터를 조회한다', async () => {
  render(<MemoryRouter initialEntries={['/database/sites']}><ProtectedRouteShell /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('master-state')).toHaveTextContent('검증용 회사'));
  reads.forEach(read => expect(read).toHaveBeenCalledTimes(1));
});

test('자동 조회를 미룬 상태에서도 명시적 새로고침은 동작한다', async () => {
  render(<MemoryRouter initialEntries={['/support/team-expense-requests']}><ProtectedRouteShell /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: '마스터 새로고침' }));
  await waitFor(() => expect(screen.getByTestId('master-state')).toHaveTextContent('검증용 회사'));
  reads.forEach(read => expect(read).toHaveBeenCalledTimes(1));
});
