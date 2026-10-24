// Hide only known generated import lines; keep human notes and the source intact.
export function editableSupportMemo(value: unknown): string {
  return String(value ?? '').split(/\r?\n/).filter(line => !/^\s*(?:조회\s*기간\s*[:：]?\s*\d{4}[-./]|(?:카드\s*)?PDF\s*(?:import|가져오기|일괄|분석)|Gemini\s*(?:카드|차량|세금계산서).*검수)/i.test(line)).join('\n').trim();
}
