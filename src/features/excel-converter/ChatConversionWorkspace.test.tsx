import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import { saveAs } from 'file-saver';
import ChatConversionWorkspace from './ChatConversionWorkspace';
import { conversationPrompt, DEFAULT_CONVERSION_MESSAGE } from './conversation';
import { ConversionPlan } from './types';
import { PlannerResult } from './plannerRequest';
import { readWorkbook } from './workbook';

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

test('파일 두 개와 자연어 요청으로 Gemini를 호출하고 실제 엑셀을 다운로드한다', async () => {
  const analyze = jest.fn(async (_prompt: string, plan: ConversionPlan) => response(plan));
  render(<ChatConversionWorkspace ownerId="test" analyze={analyze}/>);
  expect(screen.queryByText('상세 화면')).not.toBeInTheDocument();
  await upload(); expect(analyze).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '변환 요청' }));
  const download = await screen.findByRole('button', { name: '엑셀 다운로드' });
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
  fireEvent.click(screen.getByRole('button', { name: '중단' })); fireEvent.click(screen.getByRole('button', { name: '새 대화' }));
  await act(async () => finish(response(captured)));
  expect(screen.queryByRole('button', { name: '엑셀 다운로드' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '변환 요청' })).toBeDisabled();
});

test('세 파일 첨부는 조용히 버리지 않고 안내하며 대화 요청은 서버 크기 이내다', async () => {
  render(<ChatConversionWorkspace ownerId="test" analyze={jest.fn()}/>);
  fireEvent.change(screen.getByLabelText('엑셀 파일 두 개 선택'), { target: { files: [file(sourceName), file(targetName), file(targetName)] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('두 개의 엑셀 파일');
  const prompt = conversationPrompt('가'.repeat(2000), Array.from({ length: 20 }, (_, i) => ({ id: String(i), role: 'user' as const, text: '나'.repeat(1000) })));
  expect(prompt.length).toBeLessThan(6000);
});
