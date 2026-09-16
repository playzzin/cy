import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { httpsCallable } from 'firebase/functions';
import { conversionErrorMessage, excelConversionService, makePlannerRequest } from './excelConversionService';
import { DataTable, planSchema, WorkbookFile } from '../features/excel-converter/types';

jest.mock('../config/firebase', () => ({ functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder });
const plan = planSchema.parse({ version: 1, targetId: 'target', sheetName: '양식', headerRow: 1, startRow: 2, endRow: 10, mappings: [{ label: '품명', targetColumn: 1, sourceKeys: ['c1'], mode: 'copy', confirmed: true }], rules: {}, overrides: [{ originsKey: '원본.xlsx!2', targetColumn: 1, value: '직접 수정한 행 데이터', kind: 'text' }] });
const table: DataTable = { fields: [{ key: 'c1', label: '품명', col: 1, kind: 'text' }], rows: [{ id: 'row', values: { c1: '서버 전송 금지 테스트 값' }, origins: ['원본.xlsx!2'] }], warnings: [], skipped: [] };
const target: WorkbookFile = { id: 'target', name: '양식.xlsx', bytes: new ArrayBuffer(0), fingerprint: 'fixture', warnings: [], sheets: [{ name: '양식', path: 'xl/worksheets/sheet1.xml', rowCount: 10, columnCount: 1, headerRow: 1, cells: [], merges: [], hiddenRows: [], hiddenColumns: [], warnings: [] }] };
const call = jest.fn(async (payload: any) => ({ data: { plan: { ...payload.plan, origin: 'gemini' }, model: 'fixture', inputTokens: 0, outputTokens: 0, elapsedMs: 0 } }));
beforeEach(() => { sessionStorage.clear(); call.mockImplementation(async (payload: any) => ({ data: { plan: { ...payload.plan, origin: 'gemini' }, model: 'fixture', inputTokens: 0, outputTokens: 0, elapsedMs: 0 } })); (httpsCallable as jest.Mock).mockReturnValue(call); });

test('배포 누락·서버 내부 오류를 알아볼 수 있는 안내로 바꾼다', async () => {
  call.mockRejectedValueOnce({ code: 'functions/internal', message: 'internal' });
  await expect(excelConversionService.analyze(makePlannerRequest('연결해 주세요.', plan, table, target))).rejects.toThrow('AI 변환 서버');
  call.mockRejectedValueOnce({ code: 'functions/internal', message: 'INTERNAL' });
  await expect(excelConversionService.status()).rejects.toThrow('AI 변환 서버');
  expect(conversionErrorMessage({ message: 'private provider payload' })).not.toContain('private provider');
});

test.each([
  ['unauthenticated', '다시 로그인'], ['permission-denied', '승인된 계정'],
  ['deadline-exceeded', '시간이 초과'], ['resource-exhausted', '한도'],
  ['already-exists', '분석하고 있습니다'], ['not-found', '서버 연결'],
])('서버 오류 %s의 해결 방법을 안내한다', (code, expected) => {
  expect(conversionErrorMessage({ code: `functions/${code}`, message: code })).toContain(expected);
});

test('원본 행·직접 수정값·원본 추적은 Gemini로 보내지 않고 응답 후 로컬 수정을 보존한다', async () => {
  const request = makePlannerRequest('제품명을 연결해 주세요.', plan, table, target);
  const result = await excelConversionService.analyze(request);
  const sent = JSON.stringify(call.mock.calls[0][0]);
  expect(sent).not.toContain('서버 전송 금지 테스트 값');
  expect(sent).not.toContain('직접 수정한 행 데이터');
  expect(sent).not.toContain('원본.xlsx!2');
  expect(result.plan.overrides).toEqual(plan.overrides);
});

test('같은 분석 재시도는 작업 ID를 재사용하고 지시가 바뀌면 새 요청으로 구분한다', async () => {
  await excelConversionService.analyze(makePlannerRequest('연결해 주세요.', plan, table, target));
  await excelConversionService.analyze(makePlannerRequest('연결해 주세요.', plan, table, target));
  await excelConversionService.analyze(makePlannerRequest('날짜를 바꿔 주세요.', plan, table, target));
  expect(call.mock.calls[0][0].requestId).toBe(call.mock.calls[1][0].requestId);
  expect(call.mock.calls[2][0].requestId).not.toBe(call.mock.calls[0][0].requestId);
  expect(sessionStorage.getItem('excel-converter-ai-request')).not.toContain('날짜를 바꿔');
});
