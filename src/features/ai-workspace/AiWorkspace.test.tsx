import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AiWorkspace } from './AiWorkspace';
import { AI_WORKSPACE_VERSION, AiPlan, AiResult, AiResponse, AiSavedAnalysis } from './contract';
import type { WorkspaceClient } from './service';

const plan = (): AiPlan => ({ operation: 'aggregate', entity: 'worker', range: { startDate: '2026-08-01', endDate: '2026-08-31' }, comparison: null,
  groupBy: 'site', filters: [], missingAccount: false, status: '', sortBy: 'manDay', direction: 'desc',
  report: { format: 'none', title: '시험 보고서', includeDetails: true, includeAmount: true, splitByGroup: false }, clarification: '' });
const result = (): AiResult => ({ id: 'synthetic-result', version: AI_WORKSPACE_VERSION, createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-09-01T01:00:00Z',
  plan: plan(), totals: { manDay: 1.5, workers: 2, reports: 1, amount: 320000 }, previousTotals: null, rows: [{ id: 's1', name: 'A현장', manDay: 1.5, workers: 2, reports: 1, amount: 320000, previous: null, manDayChangePercent: null, amountChangePercent: null }],
  records: [], details: [], warnings: [], completeness: 'complete', summary: '1.5공수 집계 완료' });
const createClient = (): jest.Mocked<WorkspaceClient> => ({ analyze: jest.fn().mockResolvedValue({ status: 'complete', plan: plan(), result: result() }),
  reports: { list: jest.fn(), save: jest.fn(), pause: jest.fn(), delete: jest.fn(), retry: jest.fn(), exportFile: jest.fn() },
  listSaved: jest.fn().mockResolvedValue({ items: [] }), saveAnalysis: jest.fn().mockResolvedValue({ items: [] }),
  deleteSaved: jest.fn().mockResolvedValue({ items: [] }), runSaved: jest.fn().mockResolvedValue({ status: 'complete', plan: plan(), result: result() }),
  exportFile: jest.fn().mockResolvedValue({ fileName: 'test.pdf', contentType: 'application/pdf', base64: 'cGRm' }) });
const ask = (text: string) => { fireEvent.change(screen.getByLabelText('업무 요청'), { target: { value: text } }); fireEvent.click(screen.getByRole('button', { name: '요청하기' })); };
const savedItem = (): AiSavedAnalysis => ({ id: 'saved-one', revision: 1, name: '월간 조회', period: 'fixed', plan: plan(), createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' });
beforeEach(() => { URL.createObjectURL = jest.fn().mockReturnValue('blob:synthetic'); URL.revokeObjectURL = jest.fn(); });

test('analysis, follow-up context and exports use the authoritative result ID', async () => {
  const client = createClient(); render(<AiWorkspace client={client} />);
  ask('지난달 현장별 공수');
  await screen.findByRole('heading', { name: '현장별 분석' });
  expect(within(screen.getByRole('table')).getByText('320,000원')).toBeInTheDocument();
  ask('팀별로 나눠줘');
  await waitFor(() => expect(client.analyze).toHaveBeenLastCalledWith(expect.objectContaining({ previousId: 'synthetic-result', question: '팀별로 나눠줘' })));
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '보고서' }));
  fireEvent.click(screen.getByRole('button', { name: 'PDF 만들기' }));
  expect(await screen.findByRole('link', { name: 'PDF 다운로드' })).toHaveAttribute('download', 'test.pdf');
  expect(client.exportFile).toHaveBeenCalledWith('synthetic-result', 'pdf');
  fireEvent.click(screen.getByRole('button', { name: '새 대화' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
});

test('ambiguous target stays pending until the user selects an ID', async () => {
  const client = createClient(), pendingPlan = plan(); pendingPlan.filters = [{ entity: 'worker', name: '동명', id: '' }];
  client.analyze.mockResolvedValueOnce({ status: 'clarification', plan: pendingPlan, message: '대상을 선택해 주세요.', choices: [{ filterIndex: 0, id: 'w2', name: '동명', label: '동명 · 2팀' }] });
  render(<AiWorkspace client={client} />); ask('동명 작업자 조회');
  fireEvent.click(await screen.findByRole('button', { name: '동명 · 2팀' }));
  await waitFor(() => expect(client.analyze).toHaveBeenLastCalledWith(expect.objectContaining({ plan: expect.objectContaining({ filters: [{ entity: 'worker', name: '동명', id: 'w2' }] }), contextPlan: pendingPlan })));
});

test('reset discards a late response and cannot restore old results', async () => {
  const client = createClient(); let finish!: (response: AiResponse) => void;
  client.analyze.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AiWorkspace client={client} />); ask('지난달 공수');
  fireEvent.click(screen.getByRole('button', { name: '새 대화' }));
  await act(async () => { finish({ status: 'complete', plan: plan(), result: result() }); });
  expect(screen.queryByRole('heading', { name: '현장별 분석' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '이렇게 질문해 보세요' })).toBeInTheDocument();
});

test('natural report request prepares both formats and exposes export failure without losing analysis', async () => {
  const client = createClient(), value = result(); value.plan.report.format = 'both';
  client.analyze.mockResolvedValue({ status: 'complete', plan: value.plan, result: value });
  client.exportFile.mockResolvedValueOnce({ fileName: 'test.pdf', contentType: 'application/pdf', base64: 'cGRm' }).mockRejectedValueOnce(new Error('출력 권한이 변경되었습니다.'));
  render(<AiWorkspace client={client} />); ask('PDF와 엑셀로');
  expect(await screen.findByRole('alert')).toHaveTextContent('출력 권한이 변경되었습니다.');
  expect(screen.getByRole('link', { name: 'PDF 다운로드' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '현장별 분석' })).toBeInTheDocument();
  expect(client.exportFile.mock.calls).toEqual([['synthetic-result', 'pdf'], ['synthetic-result', 'xlsx']]);
});

test('unknown account visibility is not presented as an unregistered account', async () => {
  const client = createClient(), value = result(); value.plan.operation = 'search'; value.rows = [];
  value.records = [{ id: 's1', entity: 'site', name: 'A현장', teamName: '', status: '', accountRegistered: null }];
  client.analyze.mockResolvedValue({ status: 'complete', plan: value.plan, result: value });
  render(<AiWorkspace client={client} />); ask('현장 검색');
  expect(await screen.findByText('확인 대상 아님')).toBeInTheDocument();
  expect(screen.queryByText('미등록')).not.toBeInTheDocument();
});

test('saving submits only current result identity, name and selected period', async () => {
  const client = createClient(), saved = savedItem(); client.saveAnalysis.mockResolvedValue({ items: [saved] });
  render(<AiWorkspace client={client} />); ask('지난달 분석');
  fireEvent.click(await screen.findByText('현재 조건·보고서 저장'));
  fireEvent.change(screen.getByLabelText('저장 이름'), { target: { value: '월간 조회' } });
  fireEvent.change(screen.getByLabelText('다시 실행할 기간'), { target: { value: 'lastMonth' } });
  fireEvent.click(screen.getByRole('button', { name: '조건 저장' }));
  expect(await screen.findByRole('button', { name: '월간 조회 다시 실행' })).toBeInTheDocument();
  expect(client.saveAnalysis).toHaveBeenCalledWith({ resultId: 'synthetic-result', name: '월간 조회', period: 'lastMonth' });
});

test('saved rerun uses a fresh result ID and preserved report choices without passing old context', async () => {
  const client = createClient(), fresh = result(); fresh.id = 'fresh-result'; fresh.plan.report.format = 'both'; fresh.plan.report.includeAmount = false;
  client.listSaved.mockResolvedValue({ items: [savedItem()] });
  client.runSaved.mockResolvedValue({ status: 'complete', plan: fresh.plan, result: fresh });
  render(<AiWorkspace client={client} />); ask('이전 분석');
  await screen.findByRole('heading', { name: '현장별 분석' });
  fireEvent.click(await screen.findByRole('button', { name: '월간 조회 다시 실행' }));
  await screen.findByRole('link', { name: 'XLSX 다운로드' });
  expect(client.runSaved).toHaveBeenCalledWith('saved-one', 1); expect(client.analyze).toHaveBeenCalledTimes(1);
  expect(client.exportFile.mock.calls).toEqual([['fresh-result', 'pdf'], ['fresh-result', 'xlsx']]);
  expect(screen.queryByText('320,000원')).not.toBeInTheDocument();
});

test('replacing saved conditions carries revision and deletion requires its explicit confirmation', async () => {
  const client = createClient(); client.listSaved.mockResolvedValue({ items: [savedItem()] });
  client.saveAnalysis.mockResolvedValue({ items: [{ ...savedItem(), revision: 2 }] });
  render(<AiWorkspace client={client} />); ask('최근 조건');
  fireEvent.click(await screen.findByText('현재 조건·보고서 저장'));
  fireEvent.change(screen.getByLabelText('저장할 항목'), { target: { value: 'saved-one' } });
  fireEvent.click(screen.getByRole('button', { name: '현재 결과로 덮어쓰기' }));
  await screen.findByText('현재 조건과 보고서 구성으로 변경했습니다.');
  expect(client.saveAnalysis).toHaveBeenCalledWith({ id: 'saved-one', revision: 1, resultId: 'synthetic-result', name: '월간 조회', period: 'fixed' });
  fireEvent.click(screen.getByRole('button', { name: '월간 조회 삭제' })); expect(client.deleteSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(client.deleteSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '월간 조회 삭제' })); fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));
  await screen.findByText('저장 목록에서 삭제했습니다.'); expect(client.deleteSaved).toHaveBeenCalledWith('saved-one', 2);
});

test('failed saved rerun removes stale results and download links', async () => {
  const client = createClient(); client.listSaved.mockResolvedValue({ items: [savedItem()] });
  client.runSaved.mockRejectedValue(new Error('저장한 조회 대상에 접근할 수 없습니다.'));
  render(<AiWorkspace client={client} />); ask('이전 분석');
  await screen.findByRole('heading', { name: '현장별 분석' });
  fireEvent.click(screen.getByRole('button', { name: '보고서' })); fireEvent.click(screen.getByRole('button', { name: 'PDF 만들기' }));
  await screen.findByRole('link', { name: 'PDF 다운로드' });
  fireEvent.click(screen.getByRole('button', { name: '월간 조회 다시 실행' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('저장한 조회 대상');
  expect(screen.queryByRole('link', { name: 'PDF 다운로드' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '현장별 분석' })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
});

test('saved list errors can be retried and partial month queries disable rolling choices', async () => {
  const client = createClient(), value = result(); value.plan.range.startDate = '2026-08-02';
  client.analyze.mockResolvedValue({ status: 'complete', plan: value.plan, result: value });
  client.listSaved.mockRejectedValueOnce(new Error('목록을 불러오지 못했습니다.')).mockResolvedValue({ items: [] });
  render(<AiWorkspace client={client} />); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '목록 새로고침' }));
  await screen.findByText('저장 목록을 새로고침했습니다.'); ask('일부 기간');
  fireEvent.click(await screen.findByText('현재 조건·보고서 저장'));
  expect(screen.getByRole('option', { name: '실행 시 지난달' })).toBeDisabled();
  expect(screen.getByRole('option', { name: '실행 시 이번 달' })).toBeDisabled();
});

const savedResponse = (items = [savedItem()]): AiResponse => ({ status: 'saved',
  plan: { ...plan(), operation: 'savedFind', saved: { query: '월간', usePrevious: false }, sortBy: 'name', direction: 'asc',
    report: { format: 'none', title: '저장한 분석', includeAmount: true, includeDetails: false, splitByGroup: false } },
  savedMatches: { contextId: 'choice-token', items }, message: '저장한 분석을 찾았습니다.' });

test('natural saved lookup displays conditions without running and selected candidate runs by id and revision', async () => {
  const client = createClient(); client.analyze.mockResolvedValueOnce({ status: 'complete', plan: plan(), result: result() }).mockResolvedValueOnce(savedResponse());
  render(<AiWorkspace client={client} />); ask('이전 결과'); await screen.findByRole('heading', { name: '현장별 분석' });
  ask('저장한 월간 찾아줘'); const found = await screen.findByRole('region', { name: '저장한 분석 검색 결과' });
  expect(within(found).getByText('월간 조회')).toBeInTheDocument(); expect(client.runSaved).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: '현장별 분석' })).not.toBeInTheDocument();
  fireEvent.click(within(found).getByRole('button', { name: '후보 1 월간 조회 실행' }));
  await screen.findByRole('heading', { name: '현장별 분석' }); expect(client.runSaved).toHaveBeenCalledWith('saved-one', 1);
});

test('follow-up uses the server selection token and clears saved context after a successful rerun', async () => {
  const client = createClient(); client.analyze.mockResolvedValueOnce(savedResponse());
  render(<AiWorkspace client={client} />); ask('저장 목록'); await screen.findByRole('region', { name: '저장한 분석 검색 결과' });
  ask('그 분석 실행해줘'); await screen.findByRole('heading', { name: '현장별 분석' });
  expect(client.analyze).toHaveBeenLastCalledWith(expect.objectContaining({ savedContextId: 'choice-token', contextPlan: savedResponse().plan }));
  ask('금액 제외'); await waitFor(() => expect(client.analyze).toHaveBeenCalledTimes(3));
  expect(client.analyze.mock.calls[2][0].savedContextId).toBeUndefined(); expect(client.analyze.mock.calls[2][0].contextPlan).toBeUndefined();
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});

test('empty saved search is explicit and duplicate names have distinct selection buttons', async () => {
  const client = createClient(); client.analyze.mockResolvedValueOnce(savedResponse([])).mockResolvedValueOnce(savedResponse([savedItem(), { ...savedItem(), id: 'second-id' }]));
  render(<AiWorkspace client={client} />); ask('없는 저장 분석'); expect(await screen.findByText(/검색 결과가 없습니다/)).toBeInTheDocument();
  expect(client.runSaved).not.toHaveBeenCalled(); ask('월간');
  expect(await screen.findByRole('button', { name: '후보 2 월간 조회 실행' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '후보 2 월간 조회 실행' }));
  await screen.findByRole('heading', { name: '현장별 분석' }); expect(client.runSaved).toHaveBeenCalledWith('second-id', 1);
});

test('reset discards a delayed saved lookup and its selection token', async () => {
  const client = createClient(); let finish!: (value: AiResponse) => void;
  client.analyze.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AiWorkspace client={client} />); ask('저장 목록'); fireEvent.click(screen.getByRole('button', { name: '새 대화' }));
  await act(async () => finish(savedResponse())); expect(screen.queryByRole('region', { name: '저장한 분석 검색 결과' })).not.toBeInTheDocument();
  ask('새 분석'); await screen.findByRole('heading', { name: '현장별 분석' }); expect(client.analyze.mock.calls[1][0].savedContextId).toBeUndefined();
});

test('clarification about saved selection keeps the reviewed candidates and follow-up context available', async () => {
  const client = createClient(); client.analyze.mockResolvedValueOnce(savedResponse()).mockResolvedValueOnce({ status: 'clarification', plan: { ...plan(), operation: 'clarify' }, message: '먼저 실행할 후보를 선택해 주세요.' });
  render(<AiWorkspace client={client} />); ask('저장 목록'); await screen.findByRole('region', { name: '저장한 분석 검색 결과' });
  ask('첫 번째를 PDF로'); await screen.findByText('먼저 실행할 후보를 선택해 주세요.');
  expect(screen.getByRole('button', { name: '후보 1 월간 조회 실행' })).toBeInTheDocument();
  expect(client.runSaved).not.toHaveBeenCalled(); ask('그 분석 그대로 실행해줘');
  await screen.findByRole('heading', { name: '현장별 분석' });
  expect(client.analyze).toHaveBeenLastCalledWith(expect.objectContaining({ savedContextId: 'choice-token', contextPlan: savedResponse().plan }));
});
