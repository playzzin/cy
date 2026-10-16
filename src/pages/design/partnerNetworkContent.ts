export const PARTNER_CHAT_DURATION = 12000;

export const PARTNER_NETWORKS = [
    { id: 'kakao', title: '단체 카카오톡방', subtitle: '빠른 현장 소식', color: '#f5dc73', activity: '지원 요청 · 가용팀 공유' },
    { id: 'association', title: '협회', subtitle: '전문 팀 연결', color: '#9bc9fa', activity: '공종 · 일정 조율' },
    { id: 'union', title: '노조', subtitle: '현장 협력', color: '#bcb0f5', activity: '지원팀 모집 · 상호 지원' },
] as const;

export const CHAT_TYPES = {
    request: { label: '지원 요청', color: '#f2cf84', background: '#3b3425' },
    available: { label: '지원 가능', color: '#9be1c6', background: '#173c3b' },
    recruit: { label: '팀 모집', color: '#a7ccfa', background: '#203b59' },
    matched: { label: '일정 조율', color: '#d2c2ff', background: '#34324d' },
} as const;

type ChatMessage = { sender: string; text: string; kind: keyof typeof CHAT_TYPES };

// Fictional, deterministic examples: no external chats or personal information.
export const PARTNER_CHATS: Record<typeof PARTNER_NETWORKS[number]['id'], readonly ChatMessage[]> = {
    kakao: [
        { sender: '현장 A', kind: 'request', text: '내일 비계 지원 부탁드립니다.' },
        { sender: '비계 B팀', kind: 'available', text: '저희 팀 내일 지원 가능합니다!' },
        { sender: '현장 C', kind: 'recruit', text: '금요일 함께하실 팀 구합니다.' },
        { sender: '동바리 D팀', kind: 'available', text: '오전부터 합류할 수 있습니다.' },
        { sender: '현장 E', kind: 'request', text: '마감 작업 지원 부탁드립니다.' },
        { sender: '마감 F팀', kind: 'available', text: '일정 맞춰 지원 가겠습니다.' },
        { sender: '현장 G', kind: 'recruit', text: '다음 주 지원 오실 팀 모집해요.' },
        { sender: '청연 지원센터', kind: 'matched', text: '회신한 팀과 일정을 맞춥니다.' },
    ],
    association: [
        { sender: '협회 현장 A', kind: 'recruit', text: '동바리 작업 함께하실 팀 모집!' },
        { sender: '동바리 B팀', kind: 'available', text: '저희 팀 다음 주 가능합니다.' },
        { sender: '협회 현장 C', kind: 'request', text: '비계 해체 지원팀 요청합니다.' },
        { sender: '비계 D팀', kind: 'available', text: '작업 조건 보내주시면 갈게요.' },
        { sender: '협회 현장 E', kind: 'recruit', text: '추가로 지원 오실 팀 계실까요?' },
        { sender: '협력 F팀', kind: 'available', text: '저희도 지원 가능합니다!' },
        { sender: '협회 현장 G', kind: 'request', text: '새 현장 지원 요청 공유합니다.' },
        { sender: '협회 담당자', kind: 'matched', text: '공종과 일정을 함께 조율해요.' },
    ],
    union: [
        { sender: '노조 현장 A', kind: 'request', text: '내일 현장 지원이 필요합니다.' },
        { sender: '협력 B팀', kind: 'available', text: '저희 팀 현장 지원 가겠습니다.' },
        { sender: '노조 현장 C', kind: 'recruit', text: '함께 지원 오실 팀 모집합니다.' },
        { sender: '협력 D팀', kind: 'available', text: '오전 일정 지원 가능합니다.' },
        { sender: '노조 현장 E', kind: 'request', text: '추가 지원 요청 전달드립니다.' },
        { sender: '협력 F팀', kind: 'available', text: '저희 팀도 함께 지원하겠습니다!' },
        { sender: '노조 현장 G', kind: 'recruit', text: '다음 주 함께할 팀 찾습니다.' },
        { sender: '노조 담당자', kind: 'matched', text: '가능한 팀과 현장을 연결해요.' },
    ],
};
