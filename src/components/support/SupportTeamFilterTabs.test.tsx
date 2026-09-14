import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SupportTeamFilterTabs from './SupportTeamFilterTabs';
import { SUPPORT_TEAM_ORDER_STORAGE_KEY } from '../../utils/supportTeamOrder';
import type { Team } from '../../services/teamService';

const teams: Team[] = [
  { id: 'team-a', name: '가팀', type: '시공팀', color: '#2563eb' },
  { id: 'team-b', name: '나팀', type: '시공팀', color: '#16a34a' },
];

describe('SupportTeamFilterTabs', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('restores the shared support team order and exposes reorder mode', () => {
    window.localStorage.setItem(
      SUPPORT_TEAM_ORDER_STORAGE_KEY,
      JSON.stringify(['team-b', 'team-a'])
    );

    render(
      <SupportTeamFilterTabs
        teams={teams}
        selectedTeamId=""
        onChange={jest.fn()}
      />
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['전체', '나팀', '가팀']);

    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));

    expect(screen.getByRole('tab', { name: '나팀 순서 변경' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '순서 변경 완료' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '기본 순서' })).not.toBeNull();
  });

  it('resets to the incoming team order and clears the saved preference', () => {
    window.localStorage.setItem(
      SUPPORT_TEAM_ORDER_STORAGE_KEY,
      JSON.stringify(['team-b', 'team-a'])
    );

    render(
      <SupportTeamFilterTabs
        teams={teams}
        selectedTeamId=""
        onChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '순서 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '기본 순서' }));

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['전체', '가팀', '나팀']);
    expect(window.localStorage.getItem(SUPPORT_TEAM_ORDER_STORAGE_KEY)).toBeNull();
  });
});
