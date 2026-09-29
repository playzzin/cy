import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import { saveAs } from 'file-saver';
import ChatConversionWorkspace from './ChatConversionWorkspace';
import { conversationPrompt, DEFAULT_CONVERSION_MESSAGE } from './conversation';
import { ConversionPlan, DataTable } from './types';
import { PlannerResult } from './plannerRequest';
import { readWorkbook } from './workbook';
import * as chatStorage from './chatStorage';
import { EditDecision } from './editingTypes';
import { CONVERSION_TIMEOUT_MS } from './requestScope';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const sourceName = '20_현재노임명세서_2026-09_가상원본.xlsx';
const targetName = '30_병합셀_타회사노임양식.xlsx';
const file = (name: string) => {
  const buffer = fs.readFileSync(path.join(process.cwd(), 'public/excel-converter/examples', name));
  const bytes = new ArrayBuffer(buffer.length); new Uint8Array(bytes).set(buffer);
  const value = new File([bytes], name);
  Object.defineProperty(value, 'arrayBuffer', { value: async () => bytes }); return value;
};
const response = (plan: ConversionPlan): PlannerResult => ({ plan: { ...plan, questions: [], mappings: plan.mappings.map(m => ({ ...m, confirmed: true })) }, model: 'gemini-test', elapsedMs: 5, inputTokens: 1, outputTokens: 1 });
const upload = async () => {
  fireEvent.change(screen.getByLabelText('엑셀 파일 두 개 선택'), { target: { files: [file(sourceName), file(targetName)] } });
  await waitFor(() => expect(screen.getByRole('button', { name: '변환 요청' })).toBeEnabled());
};
const readBlob = (blob: Blob) => new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test('선택한 제목의 자유로운 서식 요청은 AI 편집으로 처리하고 데이터 변환을 반복하지 않는다',async()=>{
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan)=>response(plan));
 const empty:EditDecision={formulas:[],macros:[],dataRequest:'',edits:[],values:[],questions:[],summary:[],resetAppearance:false};
 const edit=jest.fn().mockResolvedValueOnce({...empty,edits:[{kind:'style',range:'A2',style:{fontSize:24,background:'#DDEEFF'}}],summary:['제목을 크게 하고 배경을 바꿨습니다.']});
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze} edit={edit}/>);await upload();
 fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));await screen.findByRole('heading',{name:'결과 1 미리보기'});
 await waitFor(()=>expect(screen.getByRole('tab',{name:'완성 결과'})).toHaveAttribute('aria-selected','true'));
 fireEvent.click(screen.getByRole('cell',{name:'가온건설 노임명세서 · 병합 셀 예시'}));
 fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'여기를 더 크고 산뜻하게 보여줘'}});fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));
 await screen.findByRole('heading',{name:'결과 2 미리보기'});
 expect(analyze).toHaveBeenCalledTimes(1);expect(edit).toHaveBeenCalledTimes(1);
 expect(edit.mock.calls[0][0].selection).toMatchObject({address:'A2'});
 await waitFor(()=>expect(screen.getByRole('cell',{name:'가온건설 노임명세서 · 병합 셀 예시'})).toHaveStyle({fontSize:'24pt',background:'#DDEEFF'}));
 expect(screen.getByText('서식 편집 1개')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'이전 결과와 무엇이 달라졌어?'}});fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));
 expect(await screen.findByText(/서식 변경 1개 시트/)).toBeInTheDocument();expect(edit).toHaveBeenCalledTimes(1);
});

test('데이터 정렬과 서식 변경을 같은 요청에서 함께 적용한다',async()=>{
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan)=>response({...plan,rules:{...plan.rules,sort:[{key:'worker_name',direction:'desc'}]}}));
 const edit=jest.fn().mockResolvedValue({dataRequest:'이름 역순으로 정렬해줘',edits:[{kind:'style',range:'A5:G6',style:{background:'#DDEEFF'}}],values:[],questions:[],summary:['이름 역순과 머리글 색상을 적용했습니다.'],resetAppearance:false});
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze} edit={edit}/>);await upload();
 fireEvent.change(screen.getByLabelText('어떻게 바꿔드릴까요?'),{target:{value:'이름은 뒤에서부터, 머리글은 파란색'}});fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));
 await screen.findByRole('heading',{name:'결과 1 미리보기'});
 expect(analyze.mock.calls[0][0]).toContain('이름 역순으로 정렬해줘');
 await waitFor(()=>expect(screen.getByRole('cell',{name:'성명'})).toHaveStyle({background:'#DDEEFF'}));
 expect(within(screen.getByRole('table',{name:'병합노임명세서 문서 내용'})).getAllByRole('row')[6]).toHaveTextContent('가상작업자 다');
});

test('예시를 불러와도 먼저 작성한 요청을 유지한다',async()=>{
 const originalFetch=global.fetch;
 global.fetch=jest.fn(async(url)=>({ok:true,arrayBuffer:()=>file(decodeURIComponent(String(url).split('/').pop()!)).arrayBuffer()} as Response));
 try {
  render(<ChatConversionWorkspace ownerId="test" analyze={jest.fn()}/>);
  fireEvent.change(screen.getByLabelText('어떻게 바꿔드릴까요?'),{target:{value:'미리 작성한 요청'}});
  fireEvent.click(screen.getByRole('button',{name:'노임명세서 예시 불러오기'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'변환 요청'})).toBeEnabled());
  expect(screen.getByLabelText('어떻게 바꿔드릴까요?')).toHaveValue('미리 작성한 요청');
 } finally {global.fetch=originalFetch;}
});

test('첫 변환 전에도 첨부와 초안을 보호하고 저장 성공 후에만 이동한다',async()=>{
 jest.spyOn(chatStorage,'listChatSessions').mockResolvedValue([]);
 const save=jest.spyOn(chatStorage,'saveChatSession').mockRejectedValueOnce(new Error('보관할 공간이 부족합니다')).mockResolvedValue(undefined);
 render(<ChatConversionWorkspace ownerId="test" analyze={jest.fn()}/>);
 fireEvent.change(screen.getByLabelText('어떻게 바꿔드릴까요?'),{target:{value:'초안 보존 요청'}});await upload();
 fireEvent.click(screen.getByRole('button',{name:'새 대화'}));
 fireEvent.click(screen.getByRole('button',{name:'보관하고 계속'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('보관할 공간이 부족합니다');
 expect(screen.getByRole('dialog',{name:'작업 변경 확인'})).toBeInTheDocument();
 expect(screen.getByLabelText('어떻게 바꿔드릴까요?')).toHaveValue('초안 보존 요청');
 fireEvent.click(screen.getByRole('button',{name:'보관하고 계속'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 expect(save.mock.calls[1][0].draft).toBe('초안 보존 요청');expect(save.mock.calls[1][0].files.filter(Boolean)).toHaveLength(2);
 expect(screen.getByLabelText('어떻게 바꿔드릴까요?')).toHaveValue('');expect(screen.getByRole('button',{name:'변환 요청'})).toBeDisabled();
});

test('자동 저장 실패는 요청이나 결과를 바꾸지 않고 다시 시도할 수 있다',async()=>{
 jest.spyOn(chatStorage,'listChatSessions').mockResolvedValue([]);
 const save=jest.spyOn(chatStorage,'saveChatSession').mockRejectedValueOnce(new Error('일시적인 보관 실패')).mockResolvedValue(undefined);
 render(<ChatConversionWorkspace ownerId="test" analyze={jest.fn()}/>);await upload();
 fireEvent.click(screen.getByLabelText('이 기기에 작업 보관'));await screen.findByText('일시적인 보관 실패');
 fireEvent.click(screen.getByRole('button',{name:'저장 다시 시도'}));await screen.findByText('이 기기에 저장됨');
 expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[0][0]).toBe(save.mock.calls[1][0]);
});

test('수식 재계산 경고를 열어 확인한 뒤 현재 결과를 내려받는다',async()=>{
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan)=>response(plan));
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);await upload();fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));
 await waitFor(()=>expect(screen.getByRole('tab',{name:'완성 결과'})).toHaveAttribute('aria-selected','true'));
 fireEvent.click(screen.getByRole('cell',{name:'180,000'}));
 expect(screen.getByRole('button',{name:'이 셀 수정 적용'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('선택한 셀의 새 값'),{target:{value:'190000'}});fireEvent.click(screen.getByRole('button',{name:'이 셀 수정 적용'}));
 await screen.findByRole('heading',{name:'결과 2 미리보기'});
 expect(screen.getByRole('button',{name:'보고 있는 결과 다운로드'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:/다운로드 전 확인 · .*개 내용 살펴보기/}));
 expect(await screen.findByRole('button',{name:/확인할 문제/})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByText(/직접 수정한 입력값에 따라 다시 계산되어/)).toBeInTheDocument();
 fireEvent.click(screen.getByLabelText('위 내용을 확인했습니다. 결과를 다운로드할 수 있습니다.'));
 fireEvent.click(screen.getByRole('button',{name:'보고 있는 결과 다운로드'}));expect(saveAs).toHaveBeenCalledTimes(1);
 expect(analyze).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByLabelText('미리볼 결과 버전'),{target:{value:(screen.getByRole('option',{name:'결과 1'}) as HTMLOptionElement).value}});
 expect(screen.getByText('수정 요청은 최신 결과 2에 적용됩니다.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('cell',{name:'180,000'}));
 expect(screen.getByText('선택한 부분은 이 결과를 기준으로 수정합니다')).toBeInTheDocument();
 expect(screen.getByText('수정 기준: 결과 1 · 선택한 D7 셀. 이전 결과도 유지됩니다.')).toBeInTheDocument();
 expect(screen.queryByText('수정 요청은 최신 결과 2에 적용됩니다.')).not.toBeInTheDocument();
});

test('설명은 버전을 만들지 않고 근거의 실제 값도 다음 AI 요청에 보내지 않는다', async()=>{
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan)=>response(plan));
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);await upload();
 fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));await screen.findByRole('heading',{name:'결과 1 미리보기'});
 await waitFor(()=>expect(screen.getByRole('tab',{name:'완성 결과'})).toHaveAttribute('aria-selected','true'));
 fireEvent.click(screen.getByRole('cell',{name:'예시시 가상로 1'}));
 expect(screen.getByRole('button',{name:'전체에 요청'})).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'이 값은 어디서 왔어?'}});fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));
 expect(analyze).toHaveBeenCalledTimes(1);expect(screen.getAllByRole('button',{name:'엑셀 다운로드'})).toHaveLength(1);
 expect(screen.getByRole('region',{name:'변환 대화'})).toHaveTextContent('원본 위치');
 fireEvent.click(screen.getByRole('button',{name:'전체에 요청'}));
 fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'이름순으로 정렬해줘'}});fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));
 await screen.findByRole('heading',{name:'결과 2 미리보기'});
 expect(analyze.mock.calls[1][0]).not.toContain('예시시 가상로 1');expect(analyze.mock.calls[1][0]).not.toContain('이 값은 어디서 왔어');
});

test('이전 버전에서 분기하면 그 계획과 대화를 사용하고 이후 결과도 유지한다',async()=>{
 const analyze=jest.fn(async(prompt:string,plan:ConversionPlan)=>{const next=response(plan);if(prompt.includes('현재 사용자 요청: 이름 역순'))next.plan.rules.sort=[{key:'worker_name',direction:'desc'}];return next;});
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);await upload();fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));await screen.findByRole('heading',{name:'결과 1 미리보기'});
 fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'이름 역순으로 정렬해줘'}});fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));await screen.findByRole('heading',{name:'결과 2 미리보기'});
 fireEvent.change(screen.getByLabelText('미리볼 결과 버전'),{target:{value:(screen.getByRole('option',{name:'결과 1'}) as HTMLOptionElement).value}});fireEvent.click(screen.getByRole('button',{name:'이 결과부터 수정'}));
 fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'서명란을 비워줘'}});fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));await screen.findByRole('heading',{name:'결과 3 미리보기'});
 expect(analyze.mock.calls[2][1].rules.sort).toEqual([]);expect(analyze.mock.calls[2][0]).not.toContain('사용자: 이름 역순');expect(screen.getAllByRole('button',{name:'엑셀 다운로드'})).toHaveLength(3);
 fireEvent.change(screen.getByLabelText('미리볼 결과 버전'),{target:{value:(screen.getByRole('option',{name:'결과 2'}) as HTMLOptionElement).value}});
 expect(within(screen.getByRole('complementary',{name:'엑셀 실시간 미리보기'})).getAllByRole('cell',{name:/^가상작업자/}).map(c=>c.textContent)).toEqual(['가상작업자 다','가상작업자 나','가상작업자 가']);
});

test('저장 실패를 알리고 계정이 바뀌면 이전 계정의 작업을 새 계정에 저장하지 않는다',async()=>{
 jest.spyOn(chatStorage,'listChatSessions').mockResolvedValue([]);
 const save=jest.spyOn(chatStorage,'saveChatSession').mockRejectedValue(new Error('저장 공간 부족 · 다운로드해 주세요'));
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan)=>response(plan));
 const view=render(<ChatConversionWorkspace ownerId="first" analyze={analyze}/>);await upload();fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));await screen.findByRole('heading',{name:'결과 1 미리보기'});
 fireEvent.click(screen.getByLabelText('이 기기에 작업 보관'));await screen.findByText('저장 공간 부족 · 다운로드해 주세요');
 expect(screen.queryByText('이 기기에 저장됨')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'엑셀 다운로드'})).toBeEnabled();
 view.rerender(<ChatConversionWorkspace ownerId="second" analyze={analyze}/>);
 await act(async()=>{await Promise.resolve();});
 expect(screen.queryByRole('heading',{name:'결과 1 미리보기'})).not.toBeInTheDocument();expect(screen.getByLabelText('이 기기에 작업 보관')).not.toBeChecked();
 expect(save.mock.calls.every(([snapshot])=>snapshot.ownerId==='first')).toBe(true);
});

test('잘못된 항목 연결은 자동 보정한 뒤 검증된 파일만 제공한다',async()=>{
 let calls=0;
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan,table:DataTable)=>{
  const next=response(plan);calls++;
  const account=table.fields.find(f=>f.label==='계좌번호')!;
  if(calls===1)next.plan.mappings=next.plan.mappings.map(m=>m.label==='성명'?{...m,sourceKeys:[account.key]}:m);
  else next.plan.mappings=next.plan.mappings.map(m=>m.label==='성명'?{...m,sourceKeys:[table.fields.find(f=>f.label==='성명')!.key]}:m);
  return next;
 });
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);await upload();fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));
 await screen.findByRole('button',{name:'엑셀 다운로드'});expect(analyze).toHaveBeenCalledTimes(2);expect(screen.getByText('자동 보정 1회')).toBeInTheDocument();expect(screen.getByText('인원 3건 개별 대조')).toBeInTheDocument();
});

test('자동 보정 두 번 이후에도 오류가 있으면 다운로드를 만들지 않는다',async()=>{
 const analyze=jest.fn(async(_prompt:string,plan:ConversionPlan,table:DataTable)=>{const next=response(plan);next.plan.mappings=next.plan.mappings.map(m=>m.label==='성명'?{...m,sourceKeys:[table.fields.find(f=>f.label==='계좌번호')!.key]}:m);return next;});
 render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);await upload();fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('의미가 다릅니다');expect(analyze).toHaveBeenCalledTimes(3);expect(screen.queryByRole('button',{name:'엑셀 다운로드'})).not.toBeInTheDocument();
});

test('파일 두 개와 자연어 요청으로 Gemini를 호출하고 실제 엑셀을 다운로드한다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);
  expect(screen.queryByText('상세 화면')).not.toBeInTheDocument();
  await upload(); expect(analyze).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' }));
  const download = await screen.findByRole('button', { name: '엑셀 다운로드' });
  expect(screen.getByText(/^수식 [\d,]+개 계산$/)).toBeInTheDocument();
  expect(analyze.mock.calls[0][0]).toContain(DEFAULT_CONVERSION_MESSAGE);
  fireEvent.click(download);
  expect(saveAs).toHaveBeenCalledTimes(1);
  const workbook = await readWorkbook(await readBlob((saveAs as unknown as jest.Mock).mock.calls[0][0]), '결과.xlsx');
  expect(workbook.sheets[0].merges.length).toBeGreaterThan(0);
  expect(workbook.sheets[0].cells.some(cell => cell.value === 1270000)).toBe(true);
  expect(screen.getByRole('tab', { name: '완성 결과' })).toHaveAttribute('aria-selected', 'true');
});

test('추가 요청은 이전 규칙과 대화를 이어받고 이전 결과도 다운로드할 수 있다', async () => {
  const analyze = jest.fn(async (prompt: string, plan: ConversionPlan) => {
    const next = response(plan);
    if (prompt.includes('현재 사용자 요청: 이름 역순')) next.plan.rules = { ...plan.rules, sort: [{ key: 'worker_name', direction: 'desc' }] };
    return next;
  });
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>); await upload();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' })); await screen.findByRole('button', { name: '엑셀 다운로드' });
  fireEvent.change(screen.getByLabelText('이어서 요청하기'), { target: { value: '이름 역순으로 정렬해줘' } });
  fireEvent.click(screen.getByRole('button', { name: '수정 요청' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: '엑셀 다운로드' })).toHaveLength(2));
  expect(analyze.mock.calls[1][0]).toContain('이전 대화:');
  expect(analyze.mock.calls[1][1].targetId).toBe(analyze.mock.calls[0][1].targetId);
  fireEvent.click(screen.getAllByRole('button', { name: '엑셀 다운로드' })[1]);
  const workbook = await readWorkbook(await readBlob((saveAs as unknown as jest.Mock).mock.calls[0][0]), '수정.xlsx');
  const names = workbook.sheets[0].cells.filter(cell => typeof cell.value === 'string' && /^가상작업자/.test(cell.value));
  expect(names.map(cell => cell.value)).toEqual(['가상작업자 다', '가상작업자 나', '가상작업자 가']);
  const preview = within(screen.getByRole('complementary', { name: '엑셀 실시간 미리보기' }));
  expect(preview.getByRole('heading', { name: '결과 2 미리보기' })).toBeInTheDocument();
  expect(preview.getAllByRole('cell', { name: /^가상작업자/ }).map(cell => cell.textContent)).toEqual(names.map(cell => cell.value));
  expect(screen.getByRole('button', { name: '수정 요청' })).toBeDisabled();
  fireEvent.keyDown(screen.getByLabelText('이어서 요청하기'), { key: 'Enter', ctrlKey: true });
  expect(analyze).toHaveBeenCalledTimes(2);
  fireEvent.change(preview.getByLabelText('미리보기 배율'), { target: { value: '125' } });
  fireEvent.change(preview.getByLabelText('미리볼 결과 버전'), { target: { value: (preview.getByRole('option', { name: '결과 1' }) as HTMLOptionElement).value } });
  expect(preview.getAllByRole('cell', { name: /^가상작업자/ }).map(cell => cell.textContent)).toEqual(['가상작업자 가', '가상작업자 나', '가상작업자 다']);
  expect(preview.getByText(/수정 요청은 최신 결과 2에 적용됩니다/)).toBeInTheDocument();
  fireEvent.click(preview.getByRole('tab', { name: '원본' }));
  fireEvent.change(screen.getByLabelText('이어서 요청하기'), { target: { value: '정렬을 유지해서 다시 만들어줘' } });
  fireEvent.click(screen.getByRole('button', { name: '수정 요청' }));
  await preview.findByRole('heading', { name: '결과 3 미리보기' });
  expect(analyze.mock.calls[2][1].rules.sort).toEqual([{ key: 'worker_name', direction: 'desc' }]);
  expect(preview.getByRole('tab', { name: '완성 결과' })).toHaveAttribute('aria-selected', 'true');
  expect(preview.getByLabelText('미리보기 배율')).toHaveValue('125');
  expect(screen.getAllByRole('button', { name: '엑셀 다운로드' })).toHaveLength(3);
});

test('첨부 즉시 양식을 미리 보며 수정 처리와 실패 중에도 마지막 완성 결과를 유지한다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);
  await upload();
  const preview = within(screen.getByRole('complementary', { name: '엑셀 실시간 미리보기' }));
  expect(preview.getByRole('tab', { name: '받을 양식' })).toHaveAttribute('aria-selected', 'true');
  expect(preview.getByLabelText('미리보기 배율')).toHaveValue('fit');
  expect(analyze).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' }));
  await preview.findByRole('heading', { name: '결과 1 미리보기' });
  let rejectRequest: (error: Error) => void = () => {};
  analyze.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
  fireEvent.change(screen.getByLabelText('이어서 요청하기'), { target: { value: '이름순으로 정렬해줘' } });
  fireEvent.click(screen.getByRole('button', { name: '수정 요청' }));
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
  expect(preview.getByText(/완성될 때까지 이전 결과/)).toBeInTheDocument();
  expect(preview.getByRole('table')).toHaveTextContent('가상작업자 가');
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled();
  await act(async () => rejectRequest(new Error('연결이 끊겼어요')));
  expect(await screen.findByRole('alert')).toHaveTextContent('연결이 끊겼어요');
  expect(preview.getByRole('heading', { name: '결과 1 미리보기' })).toBeInTheDocument();
  expect(preview.getByRole('table')).toHaveTextContent('가상작업자 가');
  expect(screen.getByLabelText('이어서 요청하기')).toHaveValue('이름순으로 정렬해줘');
  fireEvent.click(screen.getByRole('button', { name: '새 대화' }));
  fireEvent.click(screen.getByRole('button', { name: '보관하지 않고 계속' }));
  expect(preview.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '엑셀 다운로드' })).not.toBeInTheDocument();
});

test('모호한 항목은 대화로 묻고 답을 받은 뒤에만 파일을 만든다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  analyze.mockImplementationOnce(async (_prompt, plan) => ({ ...response(plan), plan: { ...response(plan).plan, questions: ['서명란은 비워 둘까요?'] } }));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>); await upload();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' })); await screen.findByText(/서명란은 비워 둘까요/);
  expect(screen.queryByRole('button', { name: '엑셀 다운로드' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('이어서 요청하기'), { target: { value: '서명은 비워줘' } });
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' })); await screen.findByRole('button', { name: '엑셀 다운로드' });
  expect(analyze.mock.calls[1][0]).toContain('서명란은 비워 둘까요?');
  expect(analyze.mock.calls[1][0]).toContain('현재 사용자 요청: 서명은 비워줘');
});

test('AI 실패 시 요청과 첨부를 유지해 다시 실행할 수 있다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  analyze.mockRejectedValueOnce(new Error('AI 연결 실패'));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>); await upload();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' })); await screen.findByRole('alert');
  expect(screen.getByLabelText('이어서 요청하기')).toHaveValue(DEFAULT_CONVERSION_MESSAGE);
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' })); await screen.findByRole('button', { name: '엑셀 다운로드' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('중단 후 늦게 도착한 AI 응답이 새 대화에 결과를 만들지 않는다', async () => {
  let finish: (value: ReturnType<typeof response>) => void = () => {};
  let captured: ConversionPlan;
  const analyze = jest.fn((_prompt: string, plan: ConversionPlan) => { captured = plan; return new Promise<ReturnType<typeof response>>(resolve => { finish = resolve; }); });
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>); await upload();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' })); await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '중단' }));
  expect(screen.getByLabelText('이어서 요청하기')).toHaveValue(DEFAULT_CONVERSION_MESSAGE);
  fireEvent.click(screen.getByRole('button', { name: '새 대화' })); fireEvent.click(screen.getByRole('button', { name: '보관하지 않고 계속' }));
  await act(async () => finish(response(captured)));
  expect(screen.queryByRole('button', { name: '엑셀 다운로드' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '변환 요청' })).toBeDisabled();
});

test('응답이 멈추면 이전 결과와 요청을 유지하며 재시도 뒤 늦은 응답을 무시한다', async () => {
  const analyze=jest.fn(async (_prompt:string,plan:ConversionPlan)=>response(plan));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);await upload();
  fireEvent.click(screen.getByRole('button',{name:'변환 요청'}));await screen.findByRole('heading',{name:'결과 1 미리보기'});
  let finish!: (value:PlannerResult)=>void; let captured!: ConversionPlan;
  analyze.mockImplementationOnce((_prompt,plan)=>{captured=plan;return new Promise(resolve=>{finish=resolve;});});
  jest.useFakeTimers();
  try {
    fireEvent.change(screen.getByLabelText('이어서 요청하기'),{target:{value:'이름순으로 정렬해줘'}});
    fireEvent.click(screen.getByRole('button',{name:'수정 요청'}));
    await act(async()=>{await Promise.resolve();});
    expect(analyze).toHaveBeenCalledTimes(2);
    await act(async()=>{jest.advanceTimersByTime(30000);});
    expect(screen.getByText(/평소보다 오래 걸리고/)).toBeInTheDocument();
    await act(async()=>{jest.advanceTimersByTime(CONVERSION_TIMEOUT_MS-30000);});
    expect(screen.getByRole('alert')).toHaveTextContent('4분');
    expect(screen.getByLabelText('이어서 요청하기')).toHaveValue('이름순으로 정렬해줘');
    expect(screen.getByRole('button',{name:'엑셀 다운로드'})).toBeEnabled();
    expect(screen.getByRole('heading',{name:'결과 1 미리보기'})).toBeInTheDocument();
  } finally {jest.useRealTimers();}
  fireEvent.click(screen.getByRole('button',{name:'요청 다시 시도'}));
  await screen.findByRole('heading',{name:'결과 2 미리보기'});
  await act(async()=>finish(response(captured)));
  expect(screen.queryByRole('heading',{name:'결과 3 미리보기'})).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('세 파일 첨부는 조용히 버리지 않고 안내하며 대화 요청은 서버 크기 이내다', async () => {
  render(<ChatConversionWorkspace ownerId="test" analyze={jest.fn()}/>);
  fireEvent.change(screen.getByLabelText('엑셀 파일 두 개 선택'), { target: { files: [file(sourceName), file(targetName), file(targetName)] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('두 개의 엑셀 파일');
  const prompt = conversationPrompt('가'.repeat(2000), Array.from({ length: 20 }, (_, i) => ({ id: String(i), role: 'user' as const, text: '나'.repeat(1000) })));
  expect(prompt.length).toBeLessThan(6000);
});

test('먼저 작성한 요청은 파일 두 개를 첨부해도 사라지지 않는다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);
  fireEvent.change(screen.getByLabelText('어떻게 바꿔드릴까요?'), { target: { value: '서명란을 비우고 원본대로 옮겨줘' } });
  await upload();
  expect(screen.getByLabelText('어떻게 바꿔드릴까요?')).toHaveValue('서명란을 비우고 원본대로 옮겨줘');
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' }));
  await screen.findByRole('button', { name: '엑셀 다운로드' });
  expect(analyze.mock.calls[0][0]).toContain('현재 사용자 요청: 서명란을 비우고 원본대로 옮겨줘');
});

test('역할별 드롭은 양식을 먼저 올려도 유지하며 원본을 기다린다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);
  fireEvent.drop(screen.getByRole('group', { name: '완성할 양식' }), { dataTransfer: { files: [file(targetName)] } });
  await screen.findByText('데이터 원본을 첨부하면 시작할 수 있어요.');
  expect(screen.getByRole('button', { name: '변환 요청' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '노임명세서 예시 불러오기' })).toBeDisabled();
  fireEvent.drop(screen.getByRole('group', { name: '데이터 원본' }), { dataTransfer: { files: [file(sourceName)] } });
  await waitFor(() => expect(screen.getByRole('button', { name: '변환 요청' })).toBeEnabled());
  expect(screen.getByRole('group', { name: '완성할 양식' })).toHaveTextContent(targetName);
  fireEvent.click(screen.getByRole('button', { name: '이름순으로 정렬하기' }));
  const request = screen.getByLabelText('어떻게 바꿔드릴까요?');
  expect(request).toHaveValue('원본 내용은 그대로 옮기고, 이름순으로 정렬해줘.');
  fireEvent.keyDown(request, { key: 'Enter' });
  expect(analyze).not.toHaveBeenCalled();
  fireEvent.keyDown(request, { key: 'Enter', ctrlKey: true });
  await screen.findByRole('button', { name: '엑셀 다운로드' });
  expect(analyze).toHaveBeenCalledTimes(1);
  expect(analyze.mock.calls[0][0]).toContain('이름순으로 정렬해줘.');
});

test('한 첨부 영역에 두 파일을 놓으면 원래 첨부를 유지하며 방법을 안내한다', async () => {
  render(<ChatConversionWorkspace ownerId="test" analyze={jest.fn()}/>);
  await upload();
  fireEvent.drop(screen.getByRole('group', { name: '데이터 원본' }), { dataTransfer: { files: [file(sourceName), file(targetName)] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('이 영역에는 파일 한 개만 넣어 주세요.');
  expect(screen.getByRole('group', { name: '데이터 원본' })).toHaveTextContent(sourceName);
  expect(screen.getByRole('group', { name: '완성할 양식' })).toHaveTextContent(targetName);
  expect(screen.getByRole('button', { name: '변환 요청' })).toBeEnabled();
});
