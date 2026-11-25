import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import PositionPanel from './PositionPanel';

let mockIsStaging = false;
jest.mock('../../config/deploymentEnvironment', () => ({
    get isStaging() { return mockIsStaging; }
}));

const props = {
    isOpen: true,
    togglePanel: jest.fn(),
    currentPosition: 'office',
    positions: [{ id: 'office', name: '사무실', icon: 'fa-user', color: '' }],
    siteData: { site: { name: '검증 현장', icon: 'fa-globe', menu: [] } }
};

describe('PositionPanel initial tab', () => {
    beforeEach(() => { mockIsStaging = false; });

    it('opens the role menu first on staging and still lets the user select a site', () => {
        mockIsStaging = true;
        const changePosition = jest.fn();
        const changeSite = jest.fn();
        render(<PositionPanel {...props} changePosition={changePosition} changeSite={changeSite} />);

        expect(screen.getByText('직책을 선택하면 해당 직책에 맞는 메뉴가 표시됩니다.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '사무실' }));
        expect(changePosition).toHaveBeenCalledWith('office');

        fireEvent.click(screen.getByRole('button', { name: '사이트 모드' }));
        fireEvent.click(screen.getByRole('button', { name: '검증 현장' }));
        expect(changeSite).toHaveBeenCalledWith('site');
    });

    it('opens site choices first for an ordinary production user', () => {
        render(<PositionPanel {...props} changePosition={jest.fn()} />);
        expect(screen.getByRole('button', { name: '검증 현장' })).toBeInTheDocument();
    });

    it('opens role choices for a production user with account preview access', () => {
        render(<PositionPanel {...props} userPreviewMode changePosition={jest.fn()} />);
        expect(screen.getByText('직책을 선택한 뒤 연결된 계정의 화면을 전체 영역에서 확인하세요.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '사무실' })).toBeInTheDocument();
    });
});
