import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import DesignManagementCodeitPage from './DesignManagementCodeitPage';
import { ACTION_DURATION, WORKFORCE_ACTION_DURATION, PARTNER_ACTION_DURATION } from './BusinessMotionStory';
import { MODULES } from './businessContent';
import { ERP_ACTION_DURATION, ERP_DOCUMENTS } from './erpMotionContent';
import { PARTNER_CHAT_DURATION } from './partnerNetworkContent';

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
afterEach(() => { jest.useRealTimers(); });
const action = (title: string) => screen.getByRole('button', { name: title });

it('현장관리의 열 가지 액션을 키보드로 탐색하고 마지막 번호를 올바르게 표시한다', () => {
    open('?module=erp-site-management');
    const timeline = screen.getByRole('list', { name: '운영 과정 액션' });
    expect(within(timeline).getAllByRole('button')).toHaveLength(10);
    fireEvent.keyDown(action('1단계 스마트 현장 연결'), { key: 'End' });
    expect(action('10단계 증빙·이력 조회')).toHaveFocus();
    expect(screen.getByText('10 / 10')).toBeInTheDocument();
    expect(action('다음 액션')).toBeDisabled();
    fireEvent.keyDown(action('10단계 증빙·이력 조회'), { key: 'Home' });
    expect(action('1단계 스마트 현장 연결')).toHaveFocus();
    expect(screen.getByText('01 / 10')).toBeInTheDocument();
});

it('여섯 노임서류를 선택하면 해당 초안과 설명을 표시하고 자동 진행을 멈춘다', () => {
    jest.useFakeTimers('modern');
    open('?module=erp-site-management');
    fireEvent.click(action('5단계 노임서류 작성'));
    fireEvent.click(action('순서대로 재생'));
    const picker = screen.getByRole('group', { name: '노임서류 선택' });
    expect(within(picker).getAllByRole('button')).toHaveLength(6);
    ERP_DOCUMENTS.forEach(doc => {
        const before = screen.getByRole('img', { name: /노임서류 작성 모션 그래픽/ });
        fireEvent.click(within(picker).getByRole('button', { name: doc.title }));
        const scene = screen.getByRole('img', { name: /노임서류 작성 모션 그래픽/ });
        expect(scene).not.toBe(before);
        expect(within(picker).getByRole('button', { name: doc.title })).toHaveAttribute('aria-pressed', 'true');
        doc.fields.forEach(field => expect(within(scene).getAllByText(field).length).toBeGreaterThan(0));
        expect(screen.getByText(doc.note)).toBeInTheDocument();
    });
    act(() => { jest.advanceTimersByTime(ERP_ACTION_DURATION * 2); });
    expect(action('5단계 노임서류 작성')).toHaveAttribute('aria-pressed', 'true');
    expect(action('순서대로 재생')).toBeInTheDocument();
    fireEvent.click(action('다음 액션'));
    fireEvent.click(action('이전 액션'));
    expect(action('노무비 청구서')).toHaveAttribute('aria-pressed', 'true');
});

it('현장관리 자동 재생은 열 번째 액션까지 이어지고 마지막에서 종료한다', () => {
    jest.useFakeTimers('modern');
    open('?module=erp-site-management');
    fireEvent.click(action('순서대로 재생'));
    for (let i = 0; i < 9; i += 1) act(() => { jest.advanceTimersByTime(ERP_ACTION_DURATION); });
    expect(action('10단계 증빙·이력 조회')).toHaveAttribute('aria-pressed', 'true');
    expect(action('자동 재생 일시정지')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(ERP_ACTION_DURATION); });
    expect(action('처음부터 재생')).toBeInTheDocument();
    expect(screen.getByText('10 / 10')).toBeInTheDocument();
});

it('모션 감소 모드에서도 노임서류 종류를 바꾸고 스마트 알림 내용을 살펴본다', () => {
    const previous = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    try {
        open('?module=erp-site-management');
        fireEvent.click(action('5단계 노임서류 작성'));
        fireEvent.click(action('급여명세서'));
        expect(action('급여명세서')).toHaveAttribute('aria-pressed', 'true');
        expect(action('순서대로 재생')).toBeDisabled();
        fireEvent.click(action('9단계 스마트 알림·협업'));
        const scene = screen.getByRole('img', { name: /스마트 알림·협업 모션 그래픽/ });
        expect(within(scene).getByText('현장과 사무실 동기화')).toBeInTheDocument();
    } finally { window.matchMedia = previous; }
});

it('현장 전화 접수 후 사무실에서 요청 조건에 맞는 팀을 매칭한다', () => {
    jest.useFakeTimers('modern');
    open('?module=manpower-supply');
    expect(screen.getByRole('group', { name: '현장 전화 요청 흐름' })).toHaveTextContent('현장 담당자 전화 → 청연 사무실 수신');
    expect(within(screen.getByRole('img', { name: /현장 전화 요청 모션 그래픽/ })).getByText('인력 요청 접수 완료')).toBeInTheDocument();
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(WORKFORCE_ACTION_DURATION - 1); });
    expect(action('1단계 현장 전화 요청')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('2단계 사무실 팀 매칭')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: '사무실 팀 매칭 흐름' })).toHaveTextContent('비계 B팀 매칭 확정');
    expect(within(screen.getByRole('img', { name: /사무실 팀 매칭 모션 그래픽/ })).getByText('B팀 매칭 확정')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(WORKFORCE_ACTION_DURATION); });
    expect(action('3단계 안전 조회')).toHaveAttribute('aria-pressed', 'true');
});

it('카카오톡방·협회·노조가 함께 연결되고 팀 규모 없이 양방향 지원을 소개한다', () => {
    open('?module=partner-network');
    const network = screen.getByRole('group', { name: '협력 네트워크와 상호 지원 방향' });
    expect(within(network).getByText('단체 카카오톡방')).toBeInTheDocument();
    expect(within(network).getByText('협회')).toBeInTheDocument();
    expect(within(network).getByText('노조')).toBeInTheDocument();
    expect(screen.queryByText(/100\s*여\s*팀/)).not.toBeInTheDocument();
    fireEvent.click(action('2단계 지원 요청 공유'));
    const chats = screen.getByRole('img', { name: /지원 요청 공유 모션 그래픽/ });
    ['단체 카카오톡방', '협회', '노조'].forEach(title => expect(within(chats).getByText(title)).toBeInTheDocument());
    expect(within(chats).getByText('저희 팀 내일 지원 가능합니다!')).toBeInTheDocument();
    expect(within(chats).getByText('동바리 작업 함께하실 팀 모집!')).toBeInTheDocument();
    expect(within(chats).getByText('저희 팀도 함께 지원하겠습니다!')).toBeInTheDocument();
    fireEvent.click(action('3단계 지원 보내기'));
    const outgoing = screen.getByRole('img', { name: /지원 보내기 모션 그래픽/ });
    expect(within(outgoing).getByText('협력사 현장 지원 도착')).toBeInTheDocument();
    expect(within(outgoing).queryByText('청연 현장 지원 도착')).not.toBeInTheDocument();
    fireEvent.click(action('4단계 지원 받기'));
    const incoming = screen.getByRole('img', { name: /지원 받기 모션 그래픽/ });
    expect(within(incoming).getByText('청연 현장 지원 도착')).toBeInTheDocument();
    expect(within(incoming).queryByText('협력사 현장 지원 도착')).not.toBeInTheDocument();
    fireEvent.click(action('5단계 상호 지원'));
    const mutual = screen.getByRole('img', { name: /상호 지원 모션 그래픽/ });
    expect(within(mutual).getByText('협력사 현장 지원 도착')).toBeInTheDocument();
    expect(within(mutual).getByText('청연 현장 지원 도착')).toBeInTheDocument();
    ['단체 카카오톡방', '협회', '노조'].forEach(title => expect(within(mutual).getByText(title)).toBeInTheDocument());
});

it('지원 채팅을 읽는 12초 동안 현재 장면을 유지하고 일시정지 후 남은 시간부터 이어진다', () => {
    jest.useFakeTimers('modern');
    open('?module=partner-network');
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(PARTNER_ACTION_DURATION); });
    expect(action('2단계 지원 요청 공유')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(5000); });
    fireEvent.click(action('자동 재생 일시정지'));
    const chatScene = screen.getByRole('img', { name: /지원 요청 공유 모션 그래픽/ });
    act(() => { jest.advanceTimersByTime(PARTNER_CHAT_DURATION); });
    fireEvent.click(action('순서대로 재생'));
    expect(screen.getByRole('img', { name: /지원 요청 공유 모션 그래픽/ })).toBe(chatScene);
    act(() => { jest.advanceTimersByTime(PARTNER_CHAT_DURATION - 5001); });
    expect(action('2단계 지원 요청 공유')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('3단계 지원 보내기')).toHaveAttribute('aria-pressed', 'true');
});

it('모션 감소 모드에서도 세 채널의 지원 요청과 팀 모집 대화를 읽을 수 있다', () => {
    const previous = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    try {
        open('?module=partner-network');
        fireEvent.click(action('2단계 지원 요청 공유'));
        expect(action('순서대로 재생')).toBeDisabled();
        expect(screen.getByText('채팅 예시 펼쳐보기')).toBeInTheDocument();
        const scene = screen.getByRole('img', { name: /지원 요청 공유 모션 그래픽/ });
        expect(within(scene).getByText('다음 주 지원 오실 팀 모집해요.')).toBeInTheDocument();
        expect(within(scene).getByText('공종과 일정을 함께 조율해요.')).toBeInTheDocument();
        expect(within(scene).getByText('가능한 팀과 현장을 연결해요.')).toBeInTheDocument();
    } finally { window.matchMedia = previous; }
});

it('협력사 지원 액션은 9초 타임라인으로 이어지고 상호 지원 장면에서 종료한다', () => {
    jest.useFakeTimers('modern');
    open('?module=partner-network');
    fireEvent.click(action('3단계 지원 보내기'));
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(PARTNER_ACTION_DURATION - 1); });
    expect(action('3단계 지원 보내기')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('4단계 지원 받기')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(PARTNER_ACTION_DURATION); });
    expect(action('5단계 상호 지원')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(PARTNER_ACTION_DURATION); });
    expect(action('처음부터 재생')).toBeInTheDocument();
});

it('세 팀이 서로 다른 현장으로 배치되고 근로자 지급 대상까지 연결된다', () => {
    open('?module=manpower-supply');
    fireEvent.click(action('4단계 현장별 팀 배치'));
    const dispatch = screen.getByRole('group', { name: '팀별 현장 배치 흐름' });
    expect(within(dispatch).getAllByRole('listitem').map(item => item.textContent)).toEqual([
        'A팀A 현장 · 골조 작업팀 단위 배치 · 출역 기록',
        'B팀B 현장 · 비계 작업팀 단위 배치 · 출역 기록',
        'C팀C 현장 · 마감 작업팀 단위 배치 · 출역 기록',
    ]);
    fireEvent.click(action('다음 액션'));
    const payroll = screen.getByRole('group', { name: '팀별 노무비 지급 흐름' });
    expect(within(payroll).getAllByText('근로자 노무비 지급')).toHaveLength(3);
    const scene = screen.getByRole('img', { name: /노무비 지급 모션 그래픽/ });
    ['A', 'B', 'C'].forEach(team => expect(within(scene).getByText(`${team}팀 근로자`)).toBeInTheDocument());
    expect(within(screen.getByRole('list', { name: '선택한 액션의 동작 순서' })).getAllByRole('listitem').map(item => item.textContent)).toEqual(['공수 확인·승인', '팀별 노무비 지급', '지급 완료']);
});

it('배치와 지급은 9초씩 재생하고 지급 중 일시정지 후에도 같은 장면에서 이어진다', () => {
    jest.useFakeTimers('modern');
    open('?module=manpower-supply');
    fireEvent.click(action('3단계 안전 조회'));
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION); });
    expect(action('4단계 현장별 팀 배치')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(WORKFORCE_ACTION_DURATION - 1); });
    expect(action('4단계 현장별 팀 배치')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('5단계 노무비 지급')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(4000); });
    fireEvent.click(action('자동 재생 일시정지'));
    const pausedScene = screen.getByRole('img', { name: /노무비 지급 모션 그래픽/ });
    act(() => { jest.advanceTimersByTime(WORKFORCE_ACTION_DURATION * 2); });
    fireEvent.click(action('순서대로 재생'));
    expect(screen.getByRole('img', { name: /노무비 지급 모션 그래픽/ })).toBe(pausedScene);
    act(() => { jest.advanceTimersByTime(WORKFORCE_ACTION_DURATION - 4001); });
    expect(action('자동 재생 일시정지')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('처음부터 재생')).toBeInTheDocument();
    expect(action('5단계 노무비 지급')).toHaveAttribute('aria-pressed', 'true');
});

it('직접 링크를 복원하고 사업 내용 전체를 모션 소개 영역 안에 제공한다', () => {
    const view = open('?module=material-rental');
    const detail = screen.getByRole('region', { name: '시스템 자재임대' });
    expect(within(screen.getByRole('region', { name: /^현장의 시작부터/ })).getByRole('region', { name: '시스템 자재임대' })).toBe(detail);
    expect(screen.getByRole('link', { name: '자재 재고 보기' })).toHaveAttribute('href', '/materials/inventory');
    view.unmount();
    open('?module=unknown');
    expect(screen.getByRole('region', { name: '시스템 동바리비계 시공' })).toBeInTheDocument();
});

it('사업을 변경하면 주소와 포커스를 갱신하고 이전 사업을 복원한다', () => {
    open('?source=overview');
    fireEvent.click(action('02 자재임대 상세 보기'));
    expect(screen.getByTestId('location')).toHaveTextContent('source=overview&module=material-rental');
    expect(screen.getByRole('region', { name: '시스템 자재임대' })).toHaveFocus();
    fireEvent.click(action('뒤로'));
    expect(screen.getByRole('region', { name: '시스템 동바리비계 시공' })).toBeInTheDocument();
});

it('사업 메뉴는 한 곳에서만 제공하고 상세 탭을 같은 패널 안에서 탐색한다', () => {
    open();
    const navigation = screen.getByRole('navigation', { name: '사업 소개 장면 선택' });
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(within(navigation).getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByRole('navigation', { name: '사업영역 빠른 탐색' })).not.toBeInTheDocument();
    expect(action('모션 크게 보기')).toHaveAttribute('aria-pressed', 'false');
    const details = screen.getByRole('region', { name: '선택한 사업 상세내용' });
    expect(within(details).getByText(MODULES[0].workflow[0].desc)).toBeInTheDocument();
    fireEvent.click(within(details).getByRole('tab', { name: /기대 효과/ }));
    expect(within(details).getByText(MODULES[0].outcomes[0])).toBeInTheDocument();
    expect(action('1단계 기준점 확인')).toHaveAttribute('aria-pressed', 'true');
});

it.each(MODULES)('$title의 모든 액션을 선택하면 해당 그래픽과 설명이 함께 전환된다', module => {
    open('?module=' + module.id);
    module.workflow.forEach((step, i) => {
        const button = action(`${i + 1}단계 ${step.title}`);
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('img', { name: `${module.title} · ${step.title} 모션 그래픽` })).toHaveAttribute('data-step', String(i));
        expect(screen.getByText(step.desc)).toBeInTheDocument();
    });
    expect(action('다음 액션')).toBeDisabled();
});

it('키보드로 액션을 선택하고 마지막 장면을 다시 볼 수 있다', () => {
    open();
    fireEvent.keyDown(action('1단계 기준점 확인'), { key: 'ArrowRight' });
    expect(action('2단계 하부 레벨링')).toHaveFocus();
    fireEvent.keyDown(action('2단계 하부 레벨링'), { key: 'End' });
    expect(action('5단계 최종 검측')).toHaveFocus();
    const before = screen.getByRole('img', { name: /최종 검측 모션 그래픽/ });
    fireEvent.click(action('선택한 액션 다시보기'));
    expect(screen.getByRole('img', { name: /최종 검측 모션 그래픽/ })).not.toBe(before);
    expect(action('5단계 최종 검측')).toHaveAttribute('aria-pressed', 'true');
});

it('명시적으로 시작한 자동 재생은 전체 모션 정지 후 남은 시간부터 이어진다', () => {
    jest.useFakeTimers('modern');
    open();
    act(() => { jest.advanceTimersByTime(ACTION_DURATION * 2); });
    expect(action('1단계 기준점 확인')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(2000); });
    fireEvent.click(action('전체 모션 일시정지'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION * 2); });
    expect(action('1단계 기준점 확인')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(action('전체 모션 재생'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION - 2000); });
    expect(action('2단계 하부 레벨링')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(action('4단계 안전 설비'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION * 2); });
    expect(action('4단계 안전 설비')).toHaveAttribute('aria-pressed', 'true');
});

it('자동 재생은 숨겨진 페이지에서 대기하고 마지막 액션에서 종료한다', () => {
    jest.useFakeTimers('modern');
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    try {
        open();
        fireEvent.click(action('순서대로 재생'));
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        fireEvent(document, new Event('visibilitychange'));
        act(() => { jest.advanceTimersByTime(ACTION_DURATION * 3); });
        expect(action('1단계 기준점 확인')).toHaveAttribute('aria-pressed', 'true');
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        fireEvent(document, new Event('visibilitychange'));
        for (let i = 0; i < 5; i += 1) act(() => { jest.advanceTimersByTime(ACTION_DURATION); });
        expect(action('처음부터 재생')).toBeInTheDocument();
        expect(action('5단계 최종 검측')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('location').textContent).toBe('');
    } finally {
        if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor);
        else Reflect.deleteProperty(document, 'hidden');
    }
});

it('사업 변경 시 재생과 액션을 초기화해 이전 타이머가 새 사업을 바꾸지 않는다', () => {
    jest.useFakeTimers('modern');
    open();
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(2000); });
    fireEvent.click(action('02 자재임대 상세 보기'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION * 2); });
    expect(action('1단계 재고 분류')).toHaveAttribute('aria-pressed', 'true');
    expect(action('순서대로 재생')).toBeInTheDocument();
});

it('패널 안에서 모션을 멈추고 다시보기로 현재 액션을 처음부터 재생한다', () => {
    jest.useFakeTimers('modern');
    open();
    fireEvent.click(action('순서대로 재생'));
    act(() => { jest.advanceTimersByTime(2000); });
    fireEvent.click(action('액션 모션 일시정지'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION); });
    expect(action('1단계 기준점 확인')).toHaveAttribute('aria-pressed', 'true');
    expect(action('액션 모션 재생')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(action('선택한 액션 다시보기'));
    act(() => { jest.advanceTimersByTime(ACTION_DURATION - 1); });
    expect(action('1단계 기준점 확인')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('2단계 하부 레벨링')).toHaveAttribute('aria-pressed', 'true');
});

it('핵심 업무, 기대 효과와 사진을 탐색하며 로드 실패 시 대체 내용을 표시한다', () => {
    open();
    expect(screen.getByText(MODULES[0].lessons[0])).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: /핵심 업무/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /기대 효과/ })).toHaveFocus();
    expect(screen.getByText(MODULES[0].outcomes[0])).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /사업 이미지/ }));
    const picture = screen.getByRole('img', { name: '기준점과 하중 조건 정리' });
    fireEvent.error(picture);
    expect(screen.getByRole('img', { name: '기준점과 하중 조건 정리' }).tagName).toBe('DIV');
    fireEvent.click(action('02 자재임대 상세 보기'));
    expect(screen.getByRole('tab', { name: /핵심 업무/ })).toHaveAttribute('aria-selected', 'true');
});

it('모션 감소 상태에서도 모든 액션과 정보에 접근할 수 있다', () => {
    const previous = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    try {
        const view = open();
        expect(action('순서대로 재생')).toBeDisabled();
        expect(action('다시보기')).toBeDisabled();
        fireEvent.click(action('5단계 최종 검측'));
        expect(screen.getByRole('img', { name: /최종 검측 모션 그래픽/ })).toBeInTheDocument();
        fireEvent.click(action('05 협력사 상세 보기'));
        expect(screen.getByRole('region', { name: '협력사 네트워크' })).toHaveFocus();
        view.unmount();
    } finally { window.matchMedia = previous; }
});

it('크게 보기와 설명 함께 보기를 바꿔도 선택한 액션과 정보가 유지된다', () => {
    open('?module=material-rental');
    fireEvent.click(action('3단계 출고 배차'));
    const toggle = action('모션 크게 보기');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const beats = screen.getByRole('list', { name: '선택한 액션의 동작 순서' });
    expect(within(beats).getAllByRole('listitem').map(item => item.textContent)).toEqual(['지게차 접근', '부재 상차', '차량 출발']);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(action('3단계 출고 배차')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(MODULES[1].workflow[2].desc)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(action('3단계 출고 배차')).toHaveAttribute('aria-pressed', 'true');
});

it('수동 장면이 끝난 후 순차 재생하면 액션을 다시 시작하고 일시정지는 남은 시간을 보존한다', () => {
    jest.useFakeTimers('modern');
    open('?module=material-rental');
    fireEvent.click(action('3단계 출고 배차'));
    const previousScene = screen.getByRole('img', { name: /출고 배차 모션 그래픽/ });
    act(() => { jest.advanceTimersByTime(ACTION_DURATION * 2); });
    fireEvent.click(action('순서대로 재생'));
    expect(screen.getByRole('img', { name: /출고 배차 모션 그래픽/ })).not.toBe(previousScene);
    act(() => { jest.advanceTimersByTime(2000); });
    fireEvent.click(action('자동 재생 일시정지'));
    const pausedScene = screen.getByRole('img', { name: /출고 배차 모션 그래픽/ });
    act(() => { jest.advanceTimersByTime(ACTION_DURATION * 2); });
    fireEvent.click(action('순서대로 재생'));
    expect(screen.getByRole('img', { name: /출고 배차 모션 그래픽/ })).toBe(pausedScene);
    act(() => { jest.advanceTimersByTime(ACTION_DURATION - 2001); });
    expect(action('3단계 출고 배차')).toHaveAttribute('aria-pressed', 'true');
    act(() => { jest.advanceTimersByTime(1); });
    expect(action('4단계 반납 검수')).toHaveAttribute('aria-pressed', 'true');
});
