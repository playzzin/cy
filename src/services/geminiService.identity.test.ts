import { aiSettingsService } from './aiSettingsService';
import { geminiService } from './geminiService';
import { requestGeminiContent } from './geminiGatewayClient';
import { prepareIdCardAnalysisImage } from '../utils/idCardAnalysisImage';

jest.mock('./geminiGatewayClient', () => ({ requestGeminiContent: jest.fn() }));
jest.mock('../utils/idCardAnalysisImage', () => ({ prepareIdCardAnalysisImage: jest.fn() }));
const request = requestGeminiContent as jest.Mock;
const prepare = prepareIdCardAnalysisImage as jest.Mock;
const file = new File(['fixture'], 'fixture.png', { type: 'image/png' });
const reply = (value: unknown) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(aiSettingsService, 'assertCurrentPageEnabled').mockImplementation(() => undefined);
  prepare.mockResolvedValue(file);
});
afterEach(() => jest.restoreAllMocks());

it('sends the prepared photo through the authenticated gateway and normalizes fields', async () => {
  const prepared = new File(['small fixture'], 'fixture.jpg', { type: 'image/jpeg' });
  prepare.mockResolvedValue(prepared);
  request.mockResolvedValue(reply({ name: ' 검증작업자 ', idNumber: '000000 0000000', address: ' 검증용 주소 ' }));
  await expect(geminiService.analyzeImage(file)).resolves.toEqual({ name: '검증작업자', idNumber: '000000-0000000', address: '검증용 주소' });
  expect(prepare).toHaveBeenCalledWith(file);
  const [feature, body] = request.mock.calls[0];
  expect(feature).toBe('document-analysis');
  expect(body.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: btoa('small fixture') });
});

it.each([{}, { name: ' ', idNumber: '', address: '' }, { name: null, idNumber: 123, address: {} }, [], null])(
  'rejects empty or malformed recognition results (%j)', async value => {
    request.mockResolvedValue(reply(value));
    await expect(geminiService.analyzeImage(file)).rejects.toThrow();
  },
);

it('keeps a readable partial result without inventing missing ID digits', async () => {
  request.mockResolvedValue(reply({ name: '검증작업자', idNumber: '000000-0******', address: '' }));
  await expect(geminiService.analyzeImage(file)).resolves.toEqual({ name: '검증작업자', idNumber: '', address: '' });
});

it('keeps bracketed address text inside a JSON object', async () => {
  request.mockResolvedValue(reply({ name: '검증작업자', idNumber: '', address: '검증용 주소 [별관]' }));
  await expect(geminiService.analyzeImage(file)).resolves.toMatchObject({ address: '검증용 주소 [별관]' });
});

it('does not send an invalid image to the gateway', async () => {
  prepare.mockRejectedValue(new Error('지원하지 않는 사진 형식입니다.'));
  await expect(geminiService.analyzeImage(file)).rejects.toThrow('지원하지 않는');
  expect(request).not.toHaveBeenCalled();
});

it('reports a gateway failure without declaring success', async () => {
  request.mockRejectedValue(new Error('AI 서버 연결을 확인해 주세요.'));
  await expect(geminiService.analyzeImage(file)).rejects.toThrow('AI 서버 연결');
});
