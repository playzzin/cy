import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AllianceInvestmentPage from './AllianceInvestmentPage';

it.each([
    { area: '현장 협력', role: 'figure', name: '현장 협력 네트워크',
        buttons: ['1단계 견적 의뢰', '2단계 공개 입찰', '3단계 시공 지원', '4단계 자재 공유'],
        last: '6단계 공동 설계', pause: '협력 흐름 일시정지', play: '협력 흐름 자동재생' },
    { area: '사업화', role: 'figure', name: '사업화 흐름과 투자 지분안',
        buttons: ['사업화 1단계 대표사 선정', '사업화 2단계 현장 실증', '사업화 3단계 무료 보급', '사업화 4단계 수익화'],
        last: '사업화 5단계 지분·배분', pause: '사업화 흐름 일시정지', play: '사업화 흐름 자동재생' },
    { area: '참여사 카드', role: 'region', name: '공동 사업 추진 체계',
        buttons: ['시공 인프라 카드 보기', '개발사 선정 카드 보기', '건설사 모집 카드 보기', '임대사 모집 카드 보기'],
        last: '임대사 모집 카드 보기', pause: '참여사 카드 모션 일시정지', play: '참여사 카드 모션 자동재생' },
])('$area 메뉴를 선택한 시점부터 자동재생을 이어가고 명시적인 일시정지는 유지한다', ({ role, name, buttons, last, pause, play }) => {
    jest.useFakeTimers();
    try {
        render(<AllianceInvestmentPage />);
        const graphic = within(screen.getByRole(role, { name }));
        const active = (label: string) => expect(graphic.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
        const click = (label: string) => fireEvent.click(graphic.getByRole('button', { name: label }));
        active(buttons[0]);
        act(() => { jest.advanceTimersByTime(6500); });
        active(buttons[1]);
        act(() => { jest.advanceTimersByTime(6000); });
        click(buttons[2]);
        expect(graphic.getByRole('button', { name: pause })).toBeVisible();
        act(() => { jest.advanceTimersByTime(6499); });
        active(buttons[2]);
        act(() => { jest.advanceTimersByTime(1); });
        active(buttons[3]);

        click(pause);
        click(buttons[0]);
        act(() => { jest.advanceTimersByTime(13000); });
        active(buttons[0]);
        click(play);
        act(() => { jest.advanceTimersByTime(6500); });
        active(buttons[1]);

        act(() => { jest.advanceTimersByTime(6000); });
        click(buttons[1]);
        act(() => { jest.advanceTimersByTime(6499); });
        active(buttons[1]);
        act(() => { jest.advanceTimersByTime(1); });
        active(buttons[2]);
        click(last);
        act(() => { jest.advanceTimersByTime(6500); });
        active(buttons[0]);
    } finally {
        jest.useRealTimers();
    }
});

it('움직임 줄이기를 설정해도 수동으로 모든 단계와 두 공종의 현장 예시를 읽을 수 있다', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
    try {
        render(<AllianceInvestmentPage />);
        expect(screen.queryByRole('button', { name: '협력 흐름 일시정지' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '참여사 카드 모션 일시정지' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '6단계 공동 설계' }));
        expect(screen.getByText(/자재 대차·반납 기준을 함께/, { selector: 'p' })).toBeVisible();
        fireEvent.click(screen.getByText(/공정 변경 및 ERP 연동 시나리오/, { selector: 'summary' }));
        expect(screen.getByRole('heading', { name: '동바리 공정 변경 및 투입 일정 조정' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '시스템비계' }));
        const example = screen.getByRole('region', { name: '비계 공정 분할 및 차수별 공급' });
        expect(within(example).getByRole('heading', { name: '분할 출고' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '시스템동바리' }));
        expect(screen.getByRole('heading', { name: '자재 재배정' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '공동 구축' }));
        expect(screen.getByRole('heading', { name: '연동과 시범 검증' })).toBeVisible();
    } finally {
        if (original) Object.defineProperty(window, 'matchMedia', original);
        else Reflect.deleteProperty(window, 'matchMedia');
    }
});

it('청연ENG와 그뚠엔터의 선정 상태를 구분하고 건설사·임대사 카드에서만 참여를 제안한다', () => {
    render(<AllianceInvestmentPage />);
    expect(screen.getByRole('heading', { level: 1, name: /전국시스템연합.*사업계획서/ })).toBeVisible();
    const base = within(screen.getByRole('region', { name: '청연ENG 시공 인프라' }));
    const seats = within(screen.getByRole('region', { name: '공동 사업 추진 체계' }));
    const developer = within(seats.getByRole('region', { name: '선정된 개발사 그뚠엔터' }));
    expect(developer.getByRole('heading', { name: '그뚠엔터' })).toBeVisible();
    expect(developer.getByText('선정 완료')).toBeVisible();
    expect(developer.getByRole('link', { name: '그뚠엔터' })).toHaveAttribute('href', 'https://propig-63524.web.app/corp/company/introduction');
    expect(base.getByRole('link', { name: '청연ENG' })).toHaveAttribute('href', 'https://cyee-9c1e4.web.app/dashboard2');
    expect(base.getByText('선정 완료')).toBeVisible();
    expect(seats.getAllByRole('link')).toHaveLength(4);
    expect(base.getByText('100여 명')).toBeVisible();
    expect(base.getByText('100여 팀')).toBeVisible();
    expect(screen.getByRole('heading', { name: '청연ENG · 시공사 모집 및 지원망 구축' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '그뚠엔터 · 플랫폼·ERP 개발' })).toBeVisible();
    seats.getAllByRole('link', { name: /선정 참여 제안/ }).forEach(link => expect(link).toHaveAttribute('href', '#alliance-inquiry'));
    const inquiry = within(screen.getByRole('region', { name: '대표 건설사·임대사 전략적 참여 제안' }));
    expect(inquiry.queryByRole('textbox')).not.toBeInTheDocument();
    expect(inquiry.queryByRole('radio')).not.toBeInTheDocument();
    expect(inquiry.getByRole('link', { name: /투자·협력 전화 문의/ })).toHaveAttribute('href', 'tel:01023657692');
    expect(inquiry.getByRole('link', { name: '문자로 문의하기' })).toHaveAttribute('href', 'sms:01023657692');
});

it('사업화 모션에서 무료 이용, 유료화, 지분에 따른 이익 분배를 구분하고 현장 도식은 독립적으로 탐색한다', () => {
    render(<AllianceInvestmentPage />);
    const business = within(screen.getByRole('figure', { name: '사업화 흐름과 투자 지분안' }));
    fireEvent.click(screen.getByRole('button', { name: '5단계 현장 조율' }));
    expect(business.getByRole('button', { name: '사업화 1단계 대표사 선정' })).toHaveAttribute('aria-pressed', 'true');
    expect(business.getByRole('img', { name: /대표 건설사 1개사와 대표 임대사 1개사/ })).toBeVisible();
    fireEvent.click(business.getByRole('button', { name: '사업화 2단계 현장 실증' }));
    expect(business.getByRole('img', { name: /공급 데이터를 연동하고 공통 업무 기준을 검증/ })).toBeVisible();
    fireEvent.click(business.getByRole('button', { name: '사업화 3단계 무료 보급' }));
    expect(business.getByRole('img', { name: /무료 배포됩니다/ })).toBeVisible();
    fireEvent.click(business.getByRole('button', { name: '사업화 4단계 수익화' }));
    expect(business.getByRole('img', { name: /운영 비용을 반영한 배분 가능 이익을 지분율에 따라 배분/ })).toBeVisible();
    const revenue = within(business.getByRole('img', { name: /구독료·거래 수수료·광고료·기타 수입/ }));
    ['구독료', '거래 수수료', '광고료', '기타 수입'].forEach(label => expect(revenue.getByText(label)).toBeVisible());
    expect(revenue.queryByText('25%')).not.toBeInTheDocument();
    fireEvent.click(business.getByRole('button', { name: '사업화 5단계 지분·배분' }));
    expect(business.getByRole('img', { name: /대표 시공사·임대사·건설사·개발사 각각 지분 25%, 총 100%/ })).toBeVisible();
    expect(business.getByText(/배분 가능 이익 × 참여사 지분율 25%/)).toBeVisible();
    expect(screen.getByRole('button', { name: '5단계 현장 조율' })).toHaveAttribute('aria-pressed', 'true');
});
