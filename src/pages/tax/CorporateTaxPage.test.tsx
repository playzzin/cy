import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CorporateTaxPage from './CorporateTaxPage';
import { corporateTaxService } from '../../services/corporateTaxService';
import { emptyManual } from './corporateTaxModel';

jest.mock('../../services/corporateTaxService', () => ({ corporateTaxService: { loadManual: jest.fn(), loadSources: jest.fn(), saveManual: jest.fn() } }));
const renderPage = () => render(<MemoryRouter><CorporateTaxPage /></MemoryRouter>);
beforeEach(() => {
    jest.clearAllMocks();
    (corporateTaxService.loadManual as jest.Mock).mockResolvedValue({ manual: emptyManual(), revision: 0 });
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [{ id: 's', month: 1, field: 'sales', label: '검증 거래처', description: '공급가액', amount: 1000000 }], errors: {} });
    (corporateTaxService.saveManual as jest.Mock).mockResolvedValue(1);
});
it('수기 입력에 따라 이익을 재계산하고 금액 근거/메모와 함께 저장한다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 계산서발행')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 계산서발행'), { target: { value: '100,000' } });
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('900,000');
    fireEvent.click(screen.getByLabelText('1월 매출액 근거'));
    expect(within(screen.getByRole('dialog')).getByText('검증 거래처')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('근거 닫기'));
    fireEvent.click(screen.getByLabelText('1월 계산서발행 입력 근거'));
    fireEvent.change(screen.getByLabelText('입력 근거'), { target: { value: '검증용 계산서 1건' } });
    fireEvent.click(screen.getByLabelText('근거 닫기'));
    fireEvent.click(screen.getByRole('button', { name: '수기 입력 저장' }));
    await waitFor(() => expect(corporateTaxService.saveManual).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ months: { 1: { amounts: { invoice: 100000 }, notes: { invoice: '검증용 계산서 1건' } } } }), 0, 'cheongyeon'));
    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다');
});
it('자료 조회 실패는 0원이 아닌 실패로 표시하고 이익 계산을 중지한다', async () => {
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [], errors: { ledger: '장부 실패' } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('장부 실패');
    expect(screen.getByLabelText('1월 매출액 근거')).toHaveTextContent('조회 실패');
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('—');
    fireEvent.click(screen.getByLabelText('1월 매출액 근거'));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('장부 실패');
});

it('노무비·급여·카드는 수기로 입력하고 근거와 함께 저장한다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 노무비신고')).toBeEnabled());
    for (const [label, value] of [['노무비신고', '300000'], ['급여', '200000'], ['카드사용금액', '100000']]) {
        fireEvent.change(screen.getByLabelText('1월 ' + label), { target: { value } });
    }
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('400,000');
    fireEvent.click(screen.getByLabelText('1월 노무비신고 입력 근거'));
    fireEvent.change(screen.getByLabelText('입력 근거'), { target: { value: '회사별 신고자료 확인' } });
    fireEvent.click(screen.getByLabelText('근거 닫기'));
    fireEvent.click(screen.getByRole('button', { name: '수기 입력 저장' }));
    await waitFor(() => expect(corporateTaxService.saveManual).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ months: { 1: { amounts: { labor: 300000, salary: 200000, card: 100000 }, notes: { labor: '회사별 신고자료 확인' } } } }), 0, 'cheongyeon'));
});
it('수기 자료 읽기 실패 시 덮어쓰기 입력/저장을 차단한다', async () => {
    (corporateTaxService.loadManual as jest.Mock).mockRejectedValue(new Error('denied'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('수기 저장 자료');
    expect(screen.getByLabelText('1월 계산서발행')).toBeDisabled();
    expect(screen.getByRole('button', { name: '수기 입력 저장' })).toBeDisabled();
});
it('잘못된 금액 저장을 막고 저장 실패시 입력값을 보존한다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 기타비용')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: '수기 입력 저장' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '1500' } });
    (corporateTaxService.saveManual as jest.Mock).mockRejectedValue(new Error('저장 충돌'));
    fireEvent.click(screen.getByRole('button', { name: '수기 입력 저장' }));
    expect(await screen.findByRole('status')).toHaveTextContent('저장 충돌');
    expect(screen.getByLabelText('1월 기타비용')).toHaveValue('1,500');
});
it('미저장 연도 이동을 확인하고 취소하면 입력을 유지한다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 기타비용')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '500' } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const year = (screen.getByLabelText('정산 연도') as HTMLSelectElement).value;
    fireEvent.click(screen.getByLabelText('이전 연도'));
    expect(screen.getByLabelText('정산 연도')).toHaveValue(year);
    expect(screen.getByLabelText('1월 기타비용')).toHaveValue('500');
    confirm.mockRestore();
});

it('잘못된 수기 입력 중에는 이전 값으로 계산한 이익과 세액을 표시하지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 기타비용')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '100.5' } });
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('—');
    expect(within(screen.getByLabelText('연간 정산 요약')).getAllByText('확인 필요')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '200' } });
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('999,800');
});

it('숙소의 특정 월 오류는 해당 월에만 표시하고 정상 월의 금액과 이익을 유지한다', async () => {
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [{ id: 'lodging', field: 'lodging', month: 2, amount: 300, label: '검증 숙소', description: '' }], errors: { lodging: '1월 연결 오류' }, failedMonths: { lodging: [1] } });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('2월 숙소비 근거')).toHaveTextContent('300'));
    expect(screen.getByLabelText('1월 숙소비 근거')).toHaveTextContent('조회 실패');
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('—');
    expect(screen.getByLabelText('2월 이익 계산 근거')).toHaveTextContent('-300');
    expect(within(screen.getByLabelText('연간 정산 요약')).getAllByText('확인 필요')).toHaveLength(3);
});

it('저장 충돌 후 다시 불러오기를 취소하면 초안을 유지하고 확인하면 최신 revision으로 저장한다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 기타비용')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '500' } });
    (corporateTaxService.saveManual as jest.Mock).mockRejectedValueOnce(new Error('다른 화면에서 변경되었습니다.'));
    fireEvent.click(screen.getByRole('button', { name: '수기 입력 저장' }));
    await screen.findByText('다른 화면에서 변경되었습니다.');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: '저장 자료 다시 불러오기' }));
    expect(screen.getByLabelText('1월 기타비용')).toHaveValue('500');
    expect(corporateTaxService.loadManual).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    (corporateTaxService.loadManual as jest.Mock).mockResolvedValue({ manual: { ...emptyManual(), months: { 1: { amounts: { other: 700 }, notes: {} } } }, revision: 4 });
    fireEvent.click(screen.getByRole('button', { name: '저장 자료 다시 불러오기' }));
    await waitFor(() => expect(screen.getByLabelText('1월 기타비용')).toHaveValue('700'));
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: '수기 입력 저장' }));
    await waitFor(() => expect(corporateTaxService.saveManual).toHaveBeenLastCalledWith(expect.any(Number), expect.anything(), 4, 'cheongyeon'));
    confirm.mockRestore();
});

it('세율 입력 오류도 계산과 저장을 막고 유효한 소수점 세율로 복구한다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('적용 예상 세율')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('적용 예상 세율'), { target: { value: '101' } });
    expect(screen.getByLabelText('적용 예상 세율')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: '수기 입력 저장' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('적용 예상 세율'), { target: { value: '0.57' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수기 입력 저장' })).toBeEnabled();
});

it('다시 불러오기 실패는 작성 중인 수기 값을 지우지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 기타비용')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 기타비용'), { target: { value: '500' } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (corporateTaxService.loadManual as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: '저장 자료 다시 불러오기' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('1월 기타비용')).toHaveValue('500');
    expect(screen.getByRole('button', { name: '수기 입력 저장' })).toBeDisabled();
    confirm.mockRestore();
});

it('회사 전환 취소는 초안을 유지하고 승인하면 회사별 입력과 원본 장부를 불러온다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 급여')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('1월 급여'), { target: { value: '1234' } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: '다원' }));
    expect(screen.getByRole('button', { name: '청연' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('1월 급여')).toHaveValue('1,234');
    confirm.mockReturnValue(true);
    (corporateTaxService.loadManual as jest.Mock).mockResolvedValue({ manual: { ...emptyManual(), months: { 1: { amounts: { salary: 2000 }, notes: {} } } }, revision: 3 });
    fireEvent.click(screen.getByRole('button', { name: '다원' }));
    await waitFor(() => expect(screen.getByLabelText('1월 급여')).toHaveValue('2,000'));
    expect(screen.getByRole('heading', { name: /다원.*정산 내역서/ })).toBeInTheDocument();
    expect(corporateTaxService.loadSources).toHaveBeenLastCalledWith(expect.any(Number), 'dawon');
    expect(screen.getByRole('link', { name: '원본 장부' })).toHaveAttribute('href', '/payroll/workbook-ledger-dawon');
    fireEvent.change(screen.getByLabelText('1월 급여'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: '수기 입력 저장' }));
    await waitFor(() => expect(corporateTaxService.saveManual).toHaveBeenLastCalledWith(expect.any(Number), expect.objectContaining({ months: { 1: { amounts: { salary: 2500 }, notes: {} } } }), 3, 'dawon'));
    confirm.mockRestore();
});

it('늦게 도착한 다른 회사의 조회 결과는 현재 회사를 덮어쓰지 않는다', async () => {
    let resolveManual!: (value: unknown) => void, resolveSources!: (value: unknown) => void;
    (corporateTaxService.loadManual as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveManual = resolve; }));
    (corporateTaxService.loadSources as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveSources = resolve; }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '다원' }));
    await waitFor(() => expect(screen.getByLabelText('1월 급여')).toBeEnabled());
    await act(async () => {
        resolveManual({ manual: { ...emptyManual(), months: { 1: { amounts: { salary: 99999 }, notes: {} } } }, revision: 8 });
        resolveSources({ evidence: [], errors: { ledger: '다른 회사 오류' } });
    });
    expect(screen.getByLabelText('1월 급여')).toHaveValue('');
    expect(screen.getByLabelText('1월 매출액 근거')).toHaveTextContent('1,000,000');
    expect(screen.queryByText('다른 회사 오류')).not.toBeInTheDocument();
});
