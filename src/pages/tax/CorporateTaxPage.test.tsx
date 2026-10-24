import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CorporateTaxPage from './CorporateTaxPage';
import { corporateTaxService } from '../../services/corporateTaxService';
import { emptyManual, freelancerEvidence } from './corporateTaxModel';

jest.mock('../../services/corporateTaxService', () => ({ corporateTaxService: { loadManual: jest.fn(), loadSources: jest.fn(), saveManual: jest.fn() } }));
const renderPage = () => render(<MemoryRouter><CorporateTaxPage /></MemoryRouter>);
beforeEach(() => {
    jest.clearAllMocks();
    (corporateTaxService.loadManual as jest.Mock).mockResolvedValue({ manual: emptyManual(), revision: 0 });
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [{ id: 's', month: 1, field: 'sales', label: '검증 거래처', description: '공급가액', amount: 1000000 }], errors: {}, warnings: [], missingSalaryMonths: [] });
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
    await waitFor(() => expect(corporateTaxService.saveManual).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ months: { 1: { amounts: { invoice: 100000 }, notes: { invoice: '검증용 계산서 1건' } } } }), 0));
    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다');
});
it('자료 조회 실패는 0원이 아닌 실패로 표시하고 이익 계산을 중지한다', async () => {
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [], errors: { ledger: '장부 실패' }, warnings: [], missingSalaryMonths: [] });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('장부 실패');
    expect(screen.getByLabelText('1월 매출액 근거')).toHaveTextContent('조회 실패');
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('—');
    fireEvent.click(screen.getByLabelText('1월 매출액 근거'));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('장부 실패');
});

it('소수점 자동금액을 표시하고 오류 없이 이익을 계산한다', async () => {
    const evidence = freelancerEvidence([{ teamId: 'a', teamName: '검증팀', m06: 1000.25 }], [], []);
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence, errors: {}, warnings: [], missingSalaryMonths: [] });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('6월 노무비신고 근거')).toHaveTextContent('1,000.25'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('6월 이익 계산 근거')).toHaveTextContent('-1,000.25');
});
it('노무비는 모든 팀의 월 합계로 표시하고 팀별 근거와 원본 프리랜서 링크를 제공한다', async () => {
    const evidence = freelancerEvidence([
        { teamId: 'a', teamName: '검증A팀', m01: 1000 }, { teamId: 'a', teamName: '검증A팀', m01: 2000 },
        { teamId: 'b', teamName: '검증B팀', m01: 4000 },
    ], [], []);
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence, errors: {}, warnings: [], missingSalaryMonths: [] });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 노무비신고 근거')).toHaveTextContent('7,000'));
    fireEvent.click(screen.getByLabelText('1월 노무비신고 근거'));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('row', { name: /검증A팀/ })).toHaveTextContent('3,000');
    expect(dialog.getByRole('row', { name: /검증B팀/ })).toHaveTextContent('4,000');
    expect(dialog.getByRole('row', { name: /2개 팀 합계/ })).toHaveTextContent('7,000원');
    expect(dialog.getByRole('link', { name: '원본 화면 열기' })).toHaveAttribute('href', '/manpower/freelancer');
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

it('카드의 특정 월 오류는 해당 월에만 표시하고 정상 월의 금액과 이익을 유지한다', async () => {
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [{ id: 'card', field: 'card', month: 2, amount: 300, label: '검증 카드', description: '' }], errors: { card: '1월 연결 오류' }, failedMonths: { card: [1] }, warnings: [], missingSalaryMonths: [] });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('2월 카드사용금액 근거')).toHaveTextContent('300'));
    expect(screen.getByLabelText('1월 카드사용금액 근거')).toHaveTextContent('조회 실패');
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
    await waitFor(() => expect(corporateTaxService.saveManual).toHaveBeenLastCalledWith(expect.any(Number), expect.anything(), 4));
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

it('급여가 미확인인 월은 이익을 잠정으로 표시하고 계산 근거에 급여 0원을 확정 표시하지 않는다', async () => {
    (corporateTaxService.loadSources as jest.Mock).mockResolvedValue({ evidence: [], errors: {}, warnings: [], missingSalaryMonths: [1] });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('1월 급여 근거')).toHaveTextContent('미확인'));
    expect(screen.getByLabelText('1월 이익 계산 근거')).toHaveTextContent('잠정');
    fireEvent.click(screen.getByLabelText('1월 이익 계산 근거'));
    expect(within(screen.getByRole('dialog')).getByText('미확인')).toBeInTheDocument();
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
