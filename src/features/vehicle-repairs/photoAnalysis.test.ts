import { webcrypto } from 'crypto';
import { requestGeminiContent } from '../../services/geminiGatewayClient';
import { analyzeRepairPhoto, identifyRepairPhoto } from './photoAnalysis';

jest.mock('../../services/geminiGatewayClient', () => ({ requestGeminiContent: jest.fn() }));
const request = requestGeminiContent as jest.Mock;
const file = new File(['fixture'], 'sample.jpg', { type: 'image/jpeg' });
Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
const fields = { validDocument: true, date: '2026-10-31', vehiclePlate: '123 하 4567', vendor: '테스트 정비소',
  workItems: ['오일·필터 교환', '에어컨 필터 교환', '후면 필터 교환', '뒤라이닝 교환', '타이어 교환'], total: 360000, category: 'personal' };
const respond = (data: unknown, finishReason = 'STOP') => request.mockResolvedValue({ candidates: [{ finishReason, content: { parts: [
  { thought: true, text: 'internal' }, { text: JSON.stringify(data) },
] } }] });
const analyze = () => analyzeRepairPhoto(file, new AbortController().signal);
beforeAll(() => Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto }));
beforeEach(() => request.mockReset());

test('기존 문서 분석 게이트웨이에 사진만 보내고, 최종 합계와 모든 작업을 순서대로 읽는다', async () => {
  respond(fields);
  const result = await analyze();
  expect(result).toEqual({ date: fields.date,
    vehiclePlate: '123하4567', description: fields.workItems.join('\n'), vendor: fields.vendor, total: 360000, category: 'personal' });
  expect(request).toHaveBeenCalledWith('document-analysis', expect.objectContaining({
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: btoa('fixture') } }] }],
    generationConfig: expect.objectContaining({ responseMimeType: 'application/json' }),
  }), expect.any(AbortSignal));
});

test('동일 사진의 원본 바이트로 반복 가능한 문서 ID를 정한다', async () => {
  expect(await identifyRepairPhoto(file)).toMatch(/^vehicle_repair_photo_[a-f0-9]{64}$/);
  expect(await identifyRepairPhoto(file)).toBe(await identifyRepairPhoto(file));
});

test.each([null, -1, '360,000'])('불확실한 금액 %p, 날짜, 구분을 임의로 채우지 않는다', async total => {
  respond({ ...fields, total, category: '모름', date: '2026-02-30' });
  expect(await analyze()).toMatchObject({ total: null, category: '', date: '' });
});

test('명시적인 무상 정비 0원을 보존한다', async () => {
  respond({ ...fields, total: 0, category: 'corporate' });
  expect(await analyze()).toMatchObject({ total: 0, category: 'corporate' });
});

test('관련 없는 문서와 잘린 응답을 거절하고 서버 오류를 전달한다', async () => {
  respond({ ...fields, validDocument: false });
  await expect(analyze()).rejects.toThrow('정비명세서 사진');
  respond(fields, 'MAX_TOKENS');
  await expect(analyze()).rejects.toThrow('판독 결과');
  request.mockRejectedValueOnce(new Error('AI 사용 한도'));
  await expect(analyze()).rejects.toThrow('AI 사용 한도');
});

test('지원하지 않는 파일은 Gemini에 보내기 전에 거절한다', async () => {
  await expect(analyzeRepairPhoto(new File(['data'], 'sample.pdf', { type: 'application/pdf' }), new AbortController().signal)).rejects.toThrow('사진 형식');
  expect(request).not.toHaveBeenCalled();
});
