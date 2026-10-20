import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerSummaryPage from './WorkerSummaryPage';
import { manpowerService } from '../../services/manpowerService';
import html2canvas from 'html2canvas';

jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({
    teamService: { getTeams: async () => [
        { id: 'a', name: '가상 A팀', companyName: '청연', color: '#228be6' },
        { id: 'b', name: '가상 B팀', companyName: '청연', color: '#12b886' }
    ] }
}));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), warning: jest.fn(), info: jest.fn(), success: jest.fn() } }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        { id: 'one', name: '가상가', teamId: 'a', teamName: '가상 A팀', status: '재직' },
        { id: 'two', name: '가상나', teamId: 'a', teamName: '가상 A팀', status: '재직' },
        { id: 'three', name: '가상다', teamId: 'b', teamName: '가상 B팀', status: '재직' },
        { id: 'inactive', name: '가상퇴사', teamId: 'a', status: '퇴사' }
    ]);
});

async function openPage() {
    render(<WorkerSummaryPage />);
    await screen.findByRole('checkbox', { name: '가상가 선택' });
}

test('팀과 검색어를 바꿔도 선택을 유지하고 전체 선택은 현재 목록에만 적용한다', async () => {
    await openPage();
    expect(screen.queryByRole('checkbox', { name: '가상퇴사 선택' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상다 선택' }));
    fireEvent.change(screen.getByRole('combobox', { name: '소속 팀' }), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /목록 전체 선택/ }));
    expect(screen.getByRole('status')).toHaveTextContent('3명 선택');
    fireEvent.click(screen.getByRole('checkbox', { name: /목록 전체 선택/ }));
    expect(screen.getByRole('status')).toHaveTextContent('1명 선택');
    expect(screen.getByRole('status')).toHaveTextContent('현재 목록 밖 1명 포함');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  가상다  ' } });
    expect(screen.getByRole('checkbox', { name: '가상다 선택' })).toBeChecked();
});

test('부분 선택을 표시하고 선택만 보기에서 개별 해제와 빈 목록 복구가 가능하다', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    expect((screen.getByRole('checkbox', { name: /목록 전체 선택/ }) as HTMLInputElement).indeterminate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '선택만 1' }));
    expect(screen.queryByRole('checkbox', { name: '가상나 선택' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    expect(screen.getByRole('checkbox', { name: /목록 전체 선택/ })).toBeDisabled();
    expect(screen.getByText('선택한 작업자가 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 작업자 보기' }));
    expect(screen.getByRole('checkbox', { name: '가상나 선택' })).toBeInTheDocument();
});

test('화면 전환 후 요약에 초점을 옮기고 카드에서 선택을 해제한다', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: '요약 보기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '요약 보기' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '작업자 요약 1명 선택됨' })).toHaveFocus());
    expect(screen.getByRole('button', { name: '요약 확인 1' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '가상가 선택 해제' }));
    expect(screen.getByRole('status')).toHaveTextContent('0명 선택');
    expect(screen.getByRole('button', { name: '이미지 복사' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '공유하기' })).toBeDisabled();
});

test('검색 결과가 없어도 선택은 보존되며 검색어만 지울 수 있다', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없는 이름' } });
    expect(screen.getByText('조건에 맞는 작업자가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1명 선택');
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByRole('checkbox', { name: '가상가 선택' })).toBeChecked();
});

test('모바일 카드와 분리된 표 형식으로 이미지를 만들고 신분증 숨김도 반영한다', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: jest.fn() });
    (html2canvas as jest.Mock).mockImplementation(async (table, options) => {
        const clone = table.cloneNode(true) as HTMLTableElement;
        options.onclone(document, clone);
        expect(clone).toHaveAttribute('data-export', 'true');
        expect(clone.style.width).toBe('1080px');
        expect(clone.textContent).not.toContain('신분증');
        expect(options.windowWidth).toBe(1280);
        expect(table).not.toHaveAttribute('data-export');
        return { toBlob: (callback: BlobCallback) => callback(new Blob(['synthetic'], { type: 'image/png' })) };
    });
    await openPage();
    fireEvent.click(screen.getByRole('checkbox', { name: '가상가 선택' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '신분증 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '이미지 복사' }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
});
