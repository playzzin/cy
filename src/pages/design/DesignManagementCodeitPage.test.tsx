import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import DesignManagementCodeitPage from './DesignManagementCodeitPage';

const NavigationProbe = () => {
    const location = useLocation();
    const navigate = useNavigate();
    return <><output data-testid="location">{location.search}</output><button onClick={() => navigate(-1)}>뒤로</button></>;
};
const open = (search = '') => render(
    <MemoryRouter initialEntries={['/design/management' + search]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DesignManagementCodeitPage /><NavigationProbe />
    </MemoryRouter>
);
beforeEach(() => { Element.prototype.scrollIntoView = jest.fn(); });

it('직접 링크의 사업을 복원하고 잘못된 ID는 기본 사업으로 표시한다', () => {
    const view = open('?module=material-rental');
    expect(screen.getByRole('region', { name: '시스템 자재임대' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '자재 재고 보기' })).toHaveAttribute('href', '/materials/inventory');
    view.unmount();
    open('?module=unknown');
    expect(screen.getByRole('region', { name: '시스템 동바리비계 시공' })).toBeInTheDocument();
});

it('사업 전환 시 주소와 포커스를 변경하고 뒤로 가기로 이전 사업을 복원한다', () => {
    open('?source=overview');
    fireEvent.click(within(screen.getByRole('navigation', { name: '사업영역 빠른 탐색' })).getByRole('button', { name: /자재임대/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('source=overview&module=material-rental');
    expect(screen.getByRole('region', { name: '시스템 자재임대' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(screen.getByRole('region', { name: '시스템 동바리비계 시공' })).toBeInTheDocument();
});

it('공백을 무시한 검색, 빈 결과 안내, 전체 목록 복원이 동작한다', () => {
    open();
    const list = screen.getByRole('region', { name: '다섯 가지 전문성, 하나의 현장' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '자 재 임 대' } });
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(within(list).getByRole('heading', { name: '시스템 자재임대' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없는 사업' } });
    expect(screen.getByText('일치하는 사업영역이 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 사업 보기' }));
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(5);
});

it('갤러리 펼침 상태를 알리고 다른 사업에서는 갤러리를 접는다', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: '이미지 보기' }));
    expect(screen.getByRole('button', { name: '이미지 접기' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('img', { name: '기준점과 하중 조건 정리' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /다음 사업 · 자재임대/ }));
    expect(screen.getByRole('button', { name: '이미지 보기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('img', { name: '기준점과 하중 조건 정리' })).not.toBeInTheDocument();
});

it('이미지 로드 실패 시 대체 내용을 제공한다', () => {
    open();
    fireEvent.error(screen.getByRole('img', { name: '건설 현장의 구조 프레임' }));
    expect(screen.getByRole('img', { name: '건설 현장의 구조 프레임' }).tagName).toBe('DIV');
    expect(screen.getByText('청연ENG · 건설 현장의 구조 프레임')).toBeInTheDocument();
});
