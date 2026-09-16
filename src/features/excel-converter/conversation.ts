import { ConversionPlan, DataTable } from './types';
import { validatePlanReferences } from './planning';

export const DEFAULT_CONVERSION_MESSAGE = '첫 번째 파일의 데이터를 두 번째 파일의 양식에 맞게 바꿔줘.';
export interface ConversationMessage { id: string; role: 'user' | 'assistant'; text: string; }

export function conversationPrompt(message: string, history: ConversationMessage[]): string {
  const recent: string[] = [];
  let remaining = 2300;
  for (const turn of history.slice(-8).reverse()) {
    const line = `${turn.role === 'user' ? '사용자' : '이전 답변'}: ${turn.text}`;
    if (line.length > remaining) break;
    recent.unshift(line); remaining -= line.length;
  }
  return `첫 번째 첨부파일은 데이터 원본, 두 번째는 완성할 양식이다. 사용자의 현재 요청을 기존 plan에 적용한다.
기본 요청은 원본의 모든 행과 값, 대상의 서식·수식·병합을 유지하여 옮기는 것이다. 명확한 연결은 confirmed=true로 반환하고 불필요한 질문을 만들지 않는다. 서명은 비운다. 원본에만 있는 열을 추가할지 묻지 않는다.
입력 공간이 부족하면 overflow로 시트나 파일을 나눈다. 두 줄 양식은 동일 열에 있는 날짜별 label/sourceKeys/rowOffset을 유지한다. 기존 금액 수식은 blank로 유지하며 프로그램에서 대조한다.
사용자가 정렬, 필터, 합산, 고정 문구, 회사명, 날짜 변경을 요청하면 해당 부분에 반영한다. 관계없는 이전 변경은 유지한다. 요청하지 않은 인원 제외·합산·금액 변경·세금 계산은 하지 않는다. 지원할 수 없는 작업은 완료했다고 말하지 말고 questions로 설명한다.
질문에 대한 답변도 자연어로 주어진다. 해결된 questions는 제거한다. summary에는 실제 변경 내용을 간결하게 적는다. 셀 주소, sourceKeys, worker_name 같은 프로그램 식별자나 매핑 용어 대신 “이름 역순으로 정렬했습니다”처럼 쉬운 말로 설명한다.
${recent.length ? `이전 대화:\n${recent.join('\n')}\n` : ''}현재 사용자 요청: ${message.trim() || DEFAULT_CONVERSION_MESSAGE}`;
}

export function conversationQuestions(plan: ConversionPlan, table: DataTable): string[] {
  return [...new Set(validatePlanReferences(plan, table.fields).map(error => error.endsWith('연결 또는 빈칸 처리를 확인해 주세요.')
    ? `${error.split(':')[0]}에는 어떤 내용을 넣을까요? 원본 항목을 알려주시거나 “비워줘”라고 답해 주세요.` : error))];
}
