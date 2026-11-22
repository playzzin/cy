import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useMobileSidebarHistory } from './useMobileSidebarHistory';

function Harness({ mobile = true }: { mobile?: boolean }) {
    const menu = useMobileSidebarHistory(mobile);
    const location = useLocation();
    const navigate = useNavigate();
    return <>
        <output data-testid="state">{location.pathname}|{location.search}|{location.hash}|{menu.isOpen ? 'open' : 'closed'}|{location.state?.retained ? 'retained' : ''}</output>
        <button onClick={() => { menu.setOpen(true); menu.setOpen(true); }}>open</button>
        <button onClick={() => { menu.setOpen(false); menu.setOpen(false); }}>close</button>
        <button onClick={() => navigate(-1)}>back</button>
        <button onClick={() => navigate(1)}>forward</button>
        <button onClick={() => { menu.navigateFromMenu('/next'); menu.setOpen(false); }}>destination</button>
    </>;
}

function setup(mobile = true) {
    return render(<MemoryRouter initialEntries={['/previous', { pathname: '/current', search: '?month=11', hash: '#list', state: { retained: true } }]} initialIndex={1}>
        <Harness mobile={mobile} />
    </MemoryRouter>);
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

test('뒤로 가기는 메뉴만 닫고 다음 뒤로 가기가 이전 페이지로 이동한다', () => {
    setup();
    click('open');
    expect(screen.getByTestId('state')).toHaveTextContent('/current|?month=11|#list|open|retained');
    click('back');
    expect(screen.getByTestId('state')).toHaveTextContent('/current|?month=11|#list|closed|retained');
    click('forward');
    expect(screen.getByTestId('state')).toHaveTextContent('|open|');
    click('close');
    click('back');
    expect(screen.getByTestId('state')).toHaveTextContent('/previous|||closed|');
});

test('메뉴에서 목적지를 선택하면 이전 메뉴 기록을 남기거나 새 페이지를 되돌리지 않는다', () => {
    setup();
    click('open');
    click('destination');
    expect(screen.getByTestId('state')).toHaveTextContent('/next|||closed|');
    click('back');
    expect(screen.getByTestId('state')).toHaveTextContent('/current|?month=11|#list|closed|retained');
    click('back');
    expect(screen.getByTestId('state')).toHaveTextContent('/previous|||closed|');
});

test('PC에서는 모바일 메뉴 기록을 추가하지 않는다', () => {
    setup(false);
    click('open');
    click('back');
    expect(screen.getByTestId('state')).toHaveTextContent('/previous|||closed|');
});
