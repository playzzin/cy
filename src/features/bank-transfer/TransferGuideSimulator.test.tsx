import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as XLSX from 'xlsx-js-style';
import TransferGuideSimulator from './TransferGuideSimulator';
import { DEMO_SCRIPTS } from './transferGuideSimulation';
import { guideResultTarget } from './useTransferGuidePlayback';

jest.mock('xlsx-js-style', () => ({ ...jest.requireActual('xlsx-js-style'), writeFile: jest.fn() }));
const practice = (chapter: number) => { render(<TransferGuideSimulator chapter={chapter} />); fireEvent.click(screen.getByRole('button', { name: '직접 해보기' })); };
const amount = () => screen.getByRole('spinbutton', { name: '연습 가상 작업자 A 이체금액' });

it('실제와 같은 검색·선택·담기·금액 입력을 연습하며 시연 전환으로 편집을 잃지 않는다', () => {
    practice(0);
    fireEvent.change(screen.getByLabelText('연습 소속 팀'), { target: { value: '연습 A팀' } });
    fireEvent.change(screen.getByLabelText('연습 대상 검색'), { target: { value: '작업자 A' } });
    fireEvent.click(screen.getByLabelText('연습 가상 작업자 A 대상 선택'));
    fireEvent.click(screen.getByRole('button', { name: '선택 1건 담기' }));
    expect(screen.getByText('이체금액은 1원 이상의 정수로 입력해 주세요.')).toBeVisible();
    fireEvent.change(amount(), { target: { value: '100000' } });
    expect(screen.getByText('미션 완료')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '시연 보기' }));
    expect(screen.getByLabelText('연습 대상 검색')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '직접 해보기' }));
    expect(amount()).toHaveValue(100000);
    fireEvent.click(screen.getByRole('button', { name: '연습 처음부터' }));
    expect(screen.queryByLabelText('연습 가상 작업자 A 이체금액')).not.toBeInTheDocument();
});

it('연습 저장·백업·생성은 실제 저장소와 파일을 건드리지 않고 검토 후 수정 시 생성을 막는다', () => {
    const store = jest.spyOn(Storage.prototype, 'setItem');
    practice(5);
    const download = () => screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' });
    expect(download()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '내용 확인 후 검토 완료' }));
    fireEvent.click(download());
    expect(screen.getByText(/연습 파일 생성 완료/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '② 금액·계좌 검토' }));
    fireEvent.change(amount(), { target: { value: '95000' } });
    fireEvent.click(screen.getByRole('button', { name: '③ 엑셀 미리보기' }));
    expect(download()).toBeDisabled();
    expect(screen.getByText(/생성 #1 · 2건 · 190,000원/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '내용 확인 후 검토 완료' }));
    fireEvent.click(download());
    expect(screen.getByText(/생성 #2 · 2건 · 185,000원/)).toBeVisible();
    expect(store).not.toHaveBeenCalled();
    expect(XLSX.writeFile).not.toHaveBeenCalled();
    store.mockRestore();
});

it('저장본 불러오기 전에 변경 취소를 확인하고 백업도 연습 안에서만 보관한다', () => {
    const store = jest.spyOn(Storage.prototype, 'setItem');
    practice(4);
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    fireEvent.change(amount(), { target: { value: '85000' } });
    fireEvent.click(screen.getByRole('button', { name: '현재 목록 백업' }));
    fireEvent.click(screen.getByRole('button', { name: '저장한 목록 불러오기' }));
    const confirm = within(screen.getByRole('group', { name: '연습 저장본 불러오기 확인' }));
    fireEvent.click(confirm.getByRole('button', { name: '계속 편집' }));
    expect(amount()).toHaveValue(85000);
    fireEvent.click(screen.getByRole('button', { name: '저장한 목록 불러오기' }));
    fireEvent.click(screen.getByRole('button', { name: '저장본 불러오기' }));
    expect(amount()).toHaveValue(100000);
    fireEvent.click(screen.getByRole('button', { name: '연습 백업 복원' }));
    expect(amount()).toHaveValue(85000);
    expect(store).not.toHaveBeenCalled();
    store.mockRestore();
});

it('결과 열을 잘못 고른 경우 안내하고 확인한 실패 건만 다시 담는다', () => {
    practice(6);
    fireEvent.click(screen.getByRole('button', { name: '예시 은행 결과 파일 불러오기' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 결과 미리보기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('열을 맞춰');
    for (const [label, value] of [['은행코드', 'bank'], ['계좌번호', 'account'], ['이체금액', 'amount'], ['처리결과', 'status']]) {
        fireEvent.change(screen.getByLabelText(`연습 ${label} 결과 열`), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: '연결 결과 미리보기' }));
    fireEvent.click(screen.getByLabelText('연습 연결 가능한 결과 전체 선택'));
    fireEvent.click(screen.getByRole('button', { name: '선택 2건 결과 반영' }));
    fireEvent.click(screen.getByRole('button', { name: '실패 1건으로 새 송금 목록 만들기' }));
    const basket = within(screen.getByRole('region', { name: '연습 송금 목록' }));
    expect(basket.getByLabelText('연습 가상 작업자 B 이체금액')).toHaveValue(90000);
    expect(basket.queryByLabelText('연습 가상 작업자 A 이체금액')).not.toBeInTheDocument();
});

it('클릭 모션이 끝난 뒤에 저장 결과가 반영되고 해당 장면부터 안전하게 연습한다', () => {
    jest.useFakeTimers();
    render(<TransferGuideSimulator chapter={4} />);
    fireEvent.click(screen.getByRole('button', { name: '시연 재생' }));
    act(() => { jest.advanceTimersByTime(1050); });
    expect(screen.getByText('저장하지 않은 변경')).toBeVisible();
    act(() => { jest.advanceTimersByTime(420); });
    expect(screen.getByText('저장 완료')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '이 장면부터 연습' }));
    expect(screen.getByText('저장하지 않은 변경')).toBeVisible();
    expect(screen.getByRole('button', { name: '목록 저장' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(screen.getByText('저장 완료')).toBeVisible();
    jest.useRealTimers();
});

it('사용자가 직접 스크롤하면 재생을 멈추고 입력 중에는 방향키를 가로채지 않는다', () => {
    render(<div className="bt-guide-reading" data-testid="reader"><TransferGuideSimulator chapter={0} /></div>);
    fireEvent.click(screen.getByRole('button', { name: '시연 재생' }));
    fireEvent.wheel(screen.getByTestId('reader'));
    expect(screen.getByRole('button', { name: '시연 재생' })).toBeVisible();
    expect(screen.getByText(/직접 스크롤하여 잠시 멈췄어요/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '직접 해보기' }));
    const search = screen.getByLabelText('연습 대상 검색');
    fireEvent.change(search, { target: { value: 'A' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(search).toHaveValue('A');
});

it.each(DEMO_SCRIPTS.map((_, chapter) => chapter))('%i단계의 모든 장면은 조작 전 위치와 결과를 가리킬 수 있다', chapter => {
    const { container } = render(<TransferGuideSimulator chapter={chapter} />);
    const anchor = (id: string) => {
        // The camera positions itself using these anchors; accessible names cannot verify that contract.
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        return container.querySelector(`[data-demo-target="${id}"]`);
    };
    DEMO_SCRIPTS[chapter].forEach((scene, index) => {
        fireEvent.change(screen.getByLabelText('시연 장면 선택'), { target: { value: String(index) } });
        expect(anchor(guideResultTarget(scene))).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '이 장면 다시 보기' }));
        expect(anchor(scene.target)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '시연 일시정지' }));
    });
});
