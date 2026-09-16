import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { planSchema } from '../features/excel-converter/types';
import { StructureRequest, StructureResult } from '../features/excel-converter/structure';

import { PlannerRequest, PlannerResult } from '../features/excel-converter/plannerRequest';
export { makePlannerRequest } from '../features/excel-converter/plannerRequest';
export type { PlannerRequest, PlannerResult } from '../features/excel-converter/plannerRequest';

export function conversionErrorMessage(error: unknown): string {
  const { code = '', message = '' } = (error || {}) as { code?: string; message?: string };
  const kind = String(code).replace(/^functions\//, '');
  // Firebase also reports missing endpoints and blocked preflights as "internal".
  // Never show raw transport errors, provider responses, or validation payloads.
  const messages: Record<string, string> = {
    internal: 'AI 변환 서버에 연결하거나 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속되면 관리자에게 서버 연결 확인을 요청해 주세요.',
    unavailable: 'AI 변환 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    'not-found': 'AI 변환 기능을 사용할 수 없습니다. 관리자에게 변환 서버 연결 확인을 요청해 주세요.',
    unauthenticated: '로그인 시간이 만료되었습니다. 다시 로그인한 뒤 변환해 주세요.',
    'permission-denied': '승인된 계정으로 로그인해야 AI 변환을 사용할 수 있습니다.',
    'deadline-exceeded': 'AI 분석 시간이 초과되었습니다. 잠시 후 같은 파일로 다시 시도해 주세요.',
    'resource-exhausted': 'AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도하거나 AI 설정에서 사용량을 확인해 주세요.',
    'already-exists': '같은 파일을 분석하고 있습니다. 잠시 후 다시 확인해 주세요.',
    cancelled: 'AI 분석이 중단되었습니다. 다시 시도해 주세요.',
  };
  // These are deliberate, user-facing messages from our callable handler.
  if (['failed-precondition', 'invalid-argument'].includes(kind) && /[가-힣]/.test(message) && message.length < 500) return message;
  return messages[kind] || 'AI 분석을 완료하지 못했습니다. 파일과 추가 요청을 확인한 뒤 다시 시도해 주세요.';
}

export const excelConversionService = {
  async structure(request:StructureRequest):Promise<StructureResult>{
    try{const {data}=await httpsCallable<StructureRequest,StructureResult>(functions,'analyzeExcelStructure',{timeout:180000})(request);return data;}
    catch(error){throw new Error(conversionErrorMessage(error));}
  },
  async status(): Promise<{ configured: boolean; model: string; thinkingLevel?: string }> {
    try { const response = await httpsCallable<void, { configured: boolean; model: string; thinkingLevel?: string }>(functions, 'getExcelConversionStatus', { timeout: 30000 })(); return response.data; }
    catch (error) { throw new Error(conversionErrorMessage(error)); }
  },
  async analyze(request: PlannerRequest): Promise<PlannerResult> {
    try {
      // Row-level manual edits and lineage stay in the browser.
      const payload = { ...request, plan: { ...request.plan, overrides: [] } };
      const encoded = new TextEncoder().encode(JSON.stringify({ ...payload, requestId: '' }));
      const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))).map(b => b.toString(16).padStart(2, '0')).join('');
      try {
        const previous = JSON.parse(sessionStorage.getItem('excel-converter-ai-request') || 'null');
        if (previous?.fingerprint === fingerprint && Date.now() - previous.createdAt < 1800000) payload.requestId = previous.requestId;
        sessionStorage.setItem('excel-converter-ai-request', JSON.stringify({ fingerprint, requestId: payload.requestId, createdAt: Date.now() }));
      } catch { /* Storage restrictions do not prevent an explicit analysis. */ }
      const callable = httpsCallable<PlannerRequest, PlannerResult>(functions, 'planExcelConversion', { timeout: 180000 });
      const { data } = await callable(payload); return { ...data, plan: planSchema.parse({ ...data.plan, overrides: request.plan.overrides, mappings: data.plan.mappings.map(m => {
        const candidates = request.plan.mappings.filter(previous => previous.targetColumn === m.targetColumn);
        // Older deployed planners do not return rowOffset. Recover it only from
        // an unambiguous known field, never from the first matching column.
        const named = candidates.filter(previous => previous.label === m.label);
        const sourced = candidates.filter(previous => previous.sourceKeys.length && JSON.stringify(previous.sourceKeys) === JSON.stringify(m.sourceKeys));
        const previous = named.length === 1 ? named[0] : sourced.length === 1 ? sourced[0] : candidates.length === 1 ? candidates[0] : undefined;
        if (m.rowOffset === undefined && candidates.some(p => p.rowOffset) && !previous) throw new Error('두 줄 양식의 날짜 항목을 구분할 수 없습니다. 자동 연결된 규칙으로 다시 변환해 주세요.');
        return { ...m, rowOffset: m.rowOffset ?? previous?.rowOffset, verifyKey: m.verifyKey || previous?.verifyKey || '' };
      }), fixedCells: data.plan.fixedCells.map(f => ({ ...f, mapping: { ...f.mapping, verifyKey: f.mapping.verifyKey || request.plan.fixedCells.find(previous => previous.address === f.address)?.mapping.verifyKey || '' } })) }) };
    } catch (error) {
      throw new Error(conversionErrorMessage(error));
    }
  },
};
