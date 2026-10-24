import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaterialManagementPage from './MaterialManagementPage';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { useMaterialAdministration } from '../../hooks/useMaterialAdministration';

jest.mock('../../contexts/SiteModeContext', () => ({ useSiteMode: jest.fn() }));
jest.mock('../../hooks/useMaterialAdministration', () => ({ useMaterialAdministration: jest.fn() }));

it.each([
    ['leader', '팀장', false, 3],
    ['office', '사무실', false, 3],
    ['leader', '팀장', true, 3],
    ['office', '사무실', true, 8],
])('%s (%s) 메뉴의 관리 권한 %s 조합에서 허용된 자재 탭만 표시한다', (position, name, canManage, count) => {
    (useSiteMode as jest.Mock).mockReturnValue({ currentPosition: position, currentPositionData: { name } });
    (useMaterialAdministration as jest.Mock).mockReturnValue(canManage);
    render(<MemoryRouter initialEntries={['/materials/inbound']}><MaterialManagementPage /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(count);
    expect(screen.getByRole('link', { name: /입고 등록/ })).toHaveAttribute('href', '/materials/inbound');
    expect(screen.queryAllByRole('link', { name: /입출고 내역|현장·일자|재고 현황|현장별 재고|자재 로그/ })).toHaveLength(Number(count) - 3);
});
