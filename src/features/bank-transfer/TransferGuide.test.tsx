import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransferGuide from './TransferGuide';
import { guidePhaseDuration } from './useTransferGuidePlayback';
import { DEMO_SCRIPTS } from './transferGuideSimulation';

const originalMatchMedia = window.matchMedia;
const mockMotionPreference = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: jest.fn(() => ({ matches, addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
};
const openGuide = () => fireEvent.click(screen.getByRole('button', { name: /사용설명서/ }));

beforeEach(() => { mockMotionPreference(false); });
afterEach(() => { jest.useRealTimers(); Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia }); });

it('목차와 이전·다음으로 읽고 Escape로 닫으면 실행 버튼으로 돌아온다', async () => {
    render(<TransferGuide />);
    const trigger = screen.getByRole('button', { name: /사용설명서/ });
    trigger.focus(); openGuide();
    expect(screen.getByRole('dialog', { name: '처음부터, 차근차근.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '처음부터, 차근차근.' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    expect(screen.getByRole('heading', { name: '급여·월세·지원비' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: /07 결과 기록·재처리/ }));
    expect(screen.getByText(/원본의 지급 상태를 자동 변경하지 않습니다/)).toBeVisible();
    expect(screen.getByRole('button', { name: '설명서 닫고 작업하기' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
});

it('시연을 멈추고 장면을 고를 수 있고 마지막 장면에서 자동 재생을 멈춘다', () => {
    jest.useFakeTimers(); render(<TransferGuide />); openGuide();
    const scenes = screen.getByRole('combobox', { name: '시연 장면 선택' });
    expect(scenes).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: '시연 재생' }));
    act(() => { jest.advanceTimersByTime(1050); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { jest.advanceTimersByTime(guidePhaseDuration(DEMO_SCRIPTS[0][0], 'result')); });
    expect(scenes).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: '시연 일시정지' }));
    act(() => { jest.advanceTimersByTime(20000); });
    expect(scenes).toHaveValue('1');
    fireEvent.change(scenes, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '시연 재생' }));
    act(() => { jest.advanceTimersByTime(guidePhaseDuration(DEMO_SCRIPTS[0][5], 'result')); });
    expect(scenes).toHaveValue('5');
    expect(screen.getByRole('button', { name: '시연 재생' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '대상 찾고 담기' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '연습 처음부터' }));
    expect(scenes).toHaveValue('0');
});

it('모션 줄이기 설정에서는 자동 진행하지 않고 장면을 직접 고를 수 있다', () => {
    jest.useFakeTimers(); mockMotionPreference(true); render(<TransferGuide />); openGuide();
    expect(screen.getByText(/모션 줄이기 설정을 적용/)).toBeVisible();
    act(() => { jest.advanceTimersByTime(20000); });
    const scenes = screen.getByRole('combobox', { name: '시연 장면 선택' });
    expect(scenes).toHaveValue('0');
    fireEvent.change(scenes, { target: { value: '5' } });
    expect(screen.getByLabelText('연습 가상 작업자 A 이체금액')).toHaveValue(100000);
    expect(screen.getByRole('button', { name: '시연 재생' })).toBeVisible();
});

it('질문을 검색하고 연결된 단계로 이동하며 검색 결과가 없을 때 복구한다', () => {
    render(<TransferGuide />); openGuide();
    fireEvent.click(screen.getByRole('button', { name: /막혔을 때/ }));
    const search = screen.getByRole('textbox', { name: '설명서 질문 검색' });
    fireEvent.change(search, { target: { value: '다른 PC' } });
    expect(screen.getByRole('status')).toHaveTextContent('1개의 도움말');
    expect(screen.getByText(/localhost와 운영 주소도 저장 공간이 다릅니다/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '초안 저장·이어하기 안내 보기' }));
    expect(screen.getByRole('heading', { name: '초안 저장·이어하기' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /막혔을 때/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '설명서 질문 검색' }), { target: { value: '존재하지않는질문' } });
    expect(screen.getByText('일치하는 도움말이 없습니다.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '전체 질문 보기' }));
    expect(screen.getByRole('status')).toHaveTextContent('11개의 도움말');
});

it('미리보기에서는 파일 생성 안내로 열고 닫았다 열면 읽기 상태를 초기화한다', () => {
    render(<TransferGuide initialChapter={5} />); openGuide();
    expect(screen.getByRole('heading', { name: '엑셀 확인·생성' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /01 대상 찾고 담기/ }));
    fireEvent.click(screen.getByRole('button', { name: '사용설명서 닫기' }));
    openGuide();
    expect(screen.getByRole('heading', { name: '엑셀 확인·생성' })).toBeVisible();
});
