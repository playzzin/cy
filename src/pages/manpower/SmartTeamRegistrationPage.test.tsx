import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SmartTeamRegistrationPage from './SmartTeamRegistrationPage';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';
import { companyService } from '../../services/companyService';

jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn(), addTeam: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('sweetalert2', () => ({ fire: jest.fn().mockResolvedValue({}) }));
beforeEach(() => {
    jest.clearAllMocks();
    (teamService.getTeams as jest.Mock).mockResolvedValue([]);
    (teamService.addTeam as jest.Mock).mockResolvedValue('new');
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'leader', name: '테스트팀장' }]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
});
const paste = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: '팀 등록 데이터' }), { target: { value: text } });
test('열 매핑과 팀장 ID를 보존하여 저장한다', async () => {
    render(<SmartTeamRegistrationPage />);
    paste('팀명\t팀구분\t팀장명\n테스트팀\t지원팀\t테스트팀장');
    fireEvent.click(screen.getByRole('button', { name: '일괄 등록하기' }));
    await waitFor(() => expect(teamService.addTeam).toHaveBeenCalledWith(expect.objectContaining({ name: '테스트팀', type: '지원팀', leaderId: 'leader' })));
});
test('관계 조회 실패와 중복 열에서 쓰기를 차단한다', async () => {
    render(<SmartTeamRegistrationPage />);
    paste('팀명\t팀이름\nA\tB');
    expect(screen.getByRole('button', { name: '일괄 등록하기' })).toBeDisabled();
    paste('팀명\nA');
    (teamService.getTeams as jest.Mock).mockRejectedValue(new Error('unavailable'));
    fireEvent.click(screen.getByRole('button', { name: '일괄 등록하기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '일괄 등록하기' })).toBeEnabled());
    expect(teamService.addTeam).not.toHaveBeenCalled();
});
test('성공한 행은 재전송하지 않고 실패한 행만 남긴다', async () => {
    (teamService.addTeam as jest.Mock).mockResolvedValueOnce('a').mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce('b');
    render(<SmartTeamRegistrationPage />);
    paste('팀명\nA\nB');
    fireEvent.click(screen.getByRole('button', { name: '일괄 등록하기' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('팀명\nB'));
    await waitFor(() => expect(screen.getByRole('button', { name: '일괄 등록하기' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '일괄 등록하기' }));
    await waitFor(() => expect(teamService.addTeam).toHaveBeenCalledTimes(3));
    expect((teamService.addTeam as jest.Mock).mock.calls.map(([row]) => row.name)).toEqual(['A', 'B', 'B']);
});
