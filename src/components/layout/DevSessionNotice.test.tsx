import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DevSessionNotice } from './DevSessionNotice';

it('샘플 계정과 실제 DEV 직책을 구분하고 현재 화면을 유지한 종료 링크를 제공한다', () => {
    render(<MemoryRouter initialEntries={['/design/management?module=material-rental&devAdmin=1#detail']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DevSessionNotice /></MemoryRouter>);
    expect(screen.getByRole('complementary', { name: '개발용 샘플 세션' })).toHaveTextContent('샘플 데이터');
    expect(screen.getByRole('link', { name: '실제 계정으로 돌아가기' })).toHaveAttribute('href', '/design/management?module=material-rental&devAdmin=0#detail');
});
