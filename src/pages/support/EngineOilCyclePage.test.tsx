import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EngineOilCyclePage from './EngineOilCyclePage';
import { useRestrictedTeamWorkflow } from '../../routes/TeamWorkflowGate';
import { getTeamScopedRows } from '../../services/teamScopedReadService';
import { vehicleService } from '../../services/vehicleService';
import { supportSharedDataService } from '../../services/supportSharedDataService';
import { saveTeamVehicleOil } from '../../services/teamVehicleOilService';

jest.mock('../../routes/TeamWorkflowGate', () => ({ useRestrictedTeamWorkflow: jest.fn() }));
jest.mock('../../services/teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { getVehicles: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/supportSharedDataService', () => ({ supportSharedDataService: { load: jest.fn(), save: jest.fn() } }));
jest.mock('../../services/teamVehicleOilService', () => ({ saveTeamVehicleOil: jest.fn() }));

const record = { id: 'own', plate: '가상 11가1111', team: '가상 A팀', teamColor: '#123456', currentKm: 19000, lastOilKm: 10000, cycleKm: 10000 };
const openPage = () => render(<MemoryRouter><EngineOilCyclePage /></MemoryRouter>);
beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (getTeamScopedRows as jest.Mock).mockResolvedValue([record]);
    (saveTeamVehicleOil as jest.Mock).mockResolvedValue(undefined);
});

test('팀장은 서버의 현재 팀 차량만 집계하고 공용 DB와 브라우저 사본을 읽거나 저장하지 않는다', async () => {
    localStorage.setItem('engine_oil_vehicle_metrics_v2', JSON.stringify({ other: { currentKm: 999 } }));
    openPage();
    await screen.findByText('조회 1 / 1대');
    expect(getTeamScopedRows).toHaveBeenCalledWith('vehicle_oil_summary');
    expect(vehicleService.getVehicles).not.toHaveBeenCalled();
    expect(supportSharedDataService.load).not.toHaveBeenCalled();
    expect(supportSharedDataService.save).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton', { name: `${record.plate} 현재거리` })).toBeInTheDocument();
    for (const name of ['전체 적용', '오일기록 초기화', '차량 관리']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    fireEvent.change(screen.getByPlaceholderText('차량번호 또는 팀 검색'), { target: { value: '다른 팀' } });
    expect(screen.getByText('조회 0 / 1대')).toBeInTheDocument();
    expect(localStorage.getItem('engine_oil_vehicle_metrics_v2')).toContain('other');
});

test('팀장 개별 저장은 수정한 차량만 전송하며 공용 데이터 직접 저장은 하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue([record, { ...record, id: 'second', plate: '가상 22가2222' }]);
    openPage();
    await screen.findByText('조회 2 / 2대');
    fireEvent.change(screen.getByRole('spinbutton', { name: `${record.plate} 현재거리` }), { target: { value: '19500' } });
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: `${record.plate} 현재거리` }), { key: 'Enter' });
    await waitFor(() => expect(saveTeamVehicleOil).toHaveBeenCalledWith([{ id: 'own', currentKm: 19500, lastOilKm: 10000, cycleKm: 10000 }]));
    expect(supportSharedDataService.save).not.toHaveBeenCalled();
    expect(localStorage.getItem('engine_oil_vehicle_metrics_v2')).toBeNull();
});

test('차량 저장 권한이 거절되면 성공으로 표시하지 않고 전체 저장으로 대체하지 않는다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (saveTeamVehicleOil as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
    openPage();
    await screen.findByText('조회 1 / 1대');
    fireEvent.change(screen.getByRole('spinbutton', { name: `${record.plate} 현재거리` }), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: '변경 1건 저장' }));
    await screen.findByText(/저장하지 못했습니다/);
    expect(screen.queryByText('1건 저장되었습니다.')).not.toBeInTheDocument();
    expect(supportSharedDataService.save).not.toHaveBeenCalled();
    log.mockRestore();
});

test('팀 조회 실패 후 이전 차량과 로컬 사본을 표시하지 않는다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    openPage();
    await screen.findByText('조회 1 / 1대');
    (getTeamScopedRows as jest.Mock).mockRejectedValueOnce(new Error('팀 연결이 해제되었습니다.'));
    fireEvent.click(screen.getByRole('button', { name: '차량정보 새로고침' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('팀 연결이 해제');
    expect(screen.getByText('조회 0 / 0대')).toBeInTheDocument();
    expect(screen.queryByText(record.plate)).not.toBeInTheDocument();
    expect(supportSharedDataService.load).not.toHaveBeenCalled();
    log.mockRestore();
});

test('사무실 계정의 공용 DB 조회와 기존 저장 동작을 유지한다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(false);
    (vehicleService.getVehicles as jest.Mock).mockResolvedValue([{ id: 'own', licensePlate: record.plate }]);
    (supportSharedDataService.load as jest.Mock).mockResolvedValue({ own: record });
    openPage();
    await screen.findByText('조회 1 / 1대');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(supportSharedDataService.save).toHaveBeenCalledWith('engine_oil_cycle', {
        own: { id: 'own', currentKm: 19000, lastOilKm: 10000, cycleKm: 10000 },
    }));
    expect(getTeamScopedRows).not.toHaveBeenCalled();
});
