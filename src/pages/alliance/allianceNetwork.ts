export const companies = {
    cheongyeon: { name: '청연ENG', work: '현장 시공' },
    shoringCrew: { name: '동바리 시공사', work: '설치·해체 지원' },
    scaffoldCrew: { name: '비계 시공사', work: '작업조 지원' },
    shoringStock: { name: '동바리 임대사', work: '규격별 재고' },
    scaffoldStock: { name: '비계 임대사', work: '품목별 대차' },
    localStock: { name: '권역 임대사', work: '지역 출고·회수' },
} as const;
export const crewCompanies = ['cheongyeon', 'shoringCrew', 'scaffoldCrew'] as const;
export const rentalCompanies = ['shoringStock', 'scaffoldStock', 'localStock'] as const;
export type Member = keyof typeof companies;
export type Role = 'builder' | 'crew' | 'rental' | 'developer';
export type NetworkNode = Role | Member;
export const roles: Record<Role, { name: string; work: string }> = {
    builder: { name: '건설사', work: '공개 발주 · 선정' },
    crew: { name: '시공사', work: '작업조 상호 지원' },
    rental: { name: '임대사', work: '공동 재고 · 공급' },
    developer: { name: '플랫폼 개발사', work: 'ERP·플랫폼 개발' },
};

type EdgeKind = 'line' | 'branch' | 'exchange';
const edge = (from: NetworkNode, to: NetworkNode, kind: EdgeKind = 'line') => ({ from, to, kind });
export const edges = {
    bidCrew: edge('builder', 'crew'), bidStock: edge('builder', 'rental'),
    handoff: edge('crew', 'rental'),
    designCrew: edge('crew', 'developer'), designStock: edge('rental', 'developer'), designBid: edge('builder', 'developer'),
    crew1: edge('crew', 'cheongyeon', 'branch'), crew2: edge('crew', 'shoringCrew', 'branch'), crew3: edge('crew', 'scaffoldCrew', 'branch'),
    stock1: edge('rental', 'shoringStock', 'branch'), stock2: edge('rental', 'scaffoldStock', 'branch'), stock3: edge('rental', 'localStock', 'branch'),
    crewAB: edge('cheongyeon', 'shoringCrew', 'exchange'), crewBC: edge('shoringCrew', 'scaffoldCrew', 'exchange'),
    stockAB: edge('shoringStock', 'scaffoldStock', 'exchange'), stockBC: edge('scaffoldStock', 'localStock', 'exchange'),
} as const;
export type EdgeId = keyof typeof edges;
export type Direction = 'out' | 'back' | 'both';
export type Scene = { label: string; headline: string; detail: string; tone: 'bid' | 'crew' | 'stock' | 'joint' | 'tech'; flows: Partial<Record<EdgeId, Direction>> };
export const scenes: Scene[] = [
    { label: '견적 의뢰', headline: '단일 공고 기반 분야별 견적 의뢰', tone: 'bid',
        detail: '건설사는 같은 도면·물량·공기를 공개하고, 여러 시공사에는 설치·해체 견적을, 여러 임대사에는 자재 견적을 요청합니다.',
        flows: { bidCrew: 'out', bidStock: 'out' } },
    { label: '공개 입찰', headline: '동일 기준 평가 및 선정 이력 관리', tone: 'bid',
        detail: '시공사와 임대사는 각자 가격·일정·공급 여력을 제출합니다. 건설사는 마감 후 분야별로 비교하고 선정 사유를 남깁니다.',
        flows: { bidCrew: 'back', bidStock: 'back' } },
    { label: '시공 지원', headline: '시공사 간 인력 상호 지원', tone: 'crew',
        detail: '청연ENG와 협력 시공사는 지원팀을 통해 필요한 기능·날짜를 요청하고, 가용 작업조로 회신합니다. 양측 확정을 거쳐 인력을 배치하고, 현장별 지원 실적과 출역 이력을 관리합니다.',
        flows: { crew1: 'both', crewAB: 'both', crewBC: 'both' } },
    { label: '자재 공유', headline: '임대사 간 재고 공유 및 공동 공급', tone: 'stock',
        detail: '동바리·비계·권역 임대사는 호환되는 규격의 가용 재고와 부족분을 대조합니다. 업체별 대차 수량, 출고일, 반납 책임을 확정해 공동 공급과 회수를 관리합니다.',
        flows: { stock3: 'both', stockAB: 'both', stockBC: 'both' } },
    { label: '현장 조율', headline: '인력 투입과 자재 납기의 연계', tone: 'joint',
        detail: '시공사는 작업 구간·필요 규격·작업조 투입일을 보내고, 임대사는 공급 가능 물량과 도착 시간을 회신합니다. 양측 확인 후 같은 구간의 일정표를 확정합니다.',
        flows: { handoff: 'both' } },
    { label: '공동 설계', headline: '업종별 ERP 구축과 플랫폼 자동화', tone: 'tech',
        detail: '각 업종은 협력기업을 모집하고 지원 요청서, 자재 대차·반납 기준을 함께 정합니다. 그뚠엔터는 건설·임대·시공 ERP를 각각 구축하고 업무 자동화와 통합 플랫폼 개발에 집중합니다.',
        flows: { designCrew: 'both', designStock: 'both', designBid: 'both' } },
];
