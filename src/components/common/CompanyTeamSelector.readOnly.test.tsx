import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CompanyTeamSelector from './CompanyTeamSelector';
import { teamSettlementService } from '../../services/teamSettlementService';

jest.mock('../../services/teamSettlementService', () => ({
    teamSettlementService: { getTeamDisplayOrder: jest.fn().mockResolvedValue([]), saveTeamDisplayOrder: jest.fn() },
}));

test('조회 전용은 팀 선택을 유지하면서 공통 순서 편집을 제공하지 않는다', async () => {
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockResolvedValue([]);
    const onChange = jest.fn();
    render(<CompanyTeamSelector internalTeams={[{ id: 'a', name: '검증 A팀' }, { id: 'b', name: '검증 B팀' }]}
        selectedTeamId="a" onChange={onChange} allowOrderEditing={false} appearance="advance" />);
    fireEvent.click(await screen.findByRole('button', { name: '검증 B팀 선택' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('button', { name: /순서 변경|기본 순서/ })).not.toBeInTheDocument();
});
