export const investmentShares = [
    { key: 'crew', role: '대표 시공사', share: 25, color: '#ffc785' },
    { key: 'rental', role: '대표 임대사', share: 25, color: '#95dab0' },
    { key: 'builder', role: '대표 건설사', share: 25, color: '#a9d7f0' },
    { key: 'developer', role: '개발사', share: 25, color: '#cdb7f4' },
] as const;
export const totalShare = investmentShares.reduce((sum, investor) => sum + investor.share, 0);
export const revenueSources = [
    { id: 'subscription', label: '구독료', note: '고도화 기능 이용' },
    { id: 'commission', label: '거래 수수료', note: '거래 중개·연결' },
    { id: 'advertising', label: '광고료', note: '기업·제품 홍보' },
    { id: 'other', label: '기타 수입', note: '부가 서비스 등' },
] as const;

export const businessStages = [
    { id: 'selection', label: '대표사 선정', title: '4자 공동 사업 체계 구축', tone: '#ffd092',
        text: '대표 시공사 청연ENG와 개발사 그뚠엔터를 기반으로, 업계 영향력과 발주 인프라를 갖춘 건설사 1개사, 자재 공급망을 갖춘 임대사 1개사를 선정합니다.',
        checkpoint: '추진 조건', outcome: '선정된 참여사의 투자 조건, 사업별 역할, 실증 범위와 공동 의사결정 체계를 협의합니다.' },
    { id: 'pilot', label: '현장 실증', title: 'ERP 연동 및 공통 업무 기준 실증', tone: '#b3d7f0',
        text: '그뚠엔터가 건설사·임대사·시공사 ERP를 각각 구축하고 발주·재고·인력 정보를 플랫폼으로 연결합니다. 대표사의 시범 현장에서 반복 입력·승인·알림을 자동화하고 업무 효율과 공통 기준을 검증합니다.',
        checkpoint: '검증 항목', outcome: '견적 비교 기록, 지원 인력 확정, 자재 출고·반납 이력, 공정 변경 반영 여부를 확인합니다.' },
    { id: 'release', label: '무료 보급', title: '기본 ERP 보급 및 참여 기업 확대', tone: '#98dbbb',
        text: '대표 건설사·임대사·시공사가 동일 공정의 협력기업을 각 업종별로 모집해 발주·공급·시공 인프라를 확대합니다. 실증을 거친 기본 ERP를 무료 보급하고, 개발사는 플랫폼의 안정화와 기능 고도화에 집중합니다.',
        checkpoint: '확산 기준', outcome: '기본 기능의 안정성, 협력 기업의 반복 이용과 현장 적용 범위를 검증하며 보급 대상을 확대합니다.' },
    { id: 'revenue', label: '수익화', title: '구독·거래·광고·부가 서비스 수익화', tone: '#f3c081',
        text: '고도화 기능의 구독료, 거래 중개·연결 수수료, 기업·제품 광고료, 부가 서비스 등의 기타 수입으로 수익원을 구성합니다. 서비스별 이용 수요와 운영 원가를 검증해 단계적으로 과금합니다.',
        checkpoint: '과금 설계', outcome: '요금, 수수료율, 광고 상품과 과금 시점은 실증 결과와 참여사 협의를 바탕으로 확정합니다.' },
    { id: 'distribution', label: '지분·배분', title: '4자 균등 지분 및 이익 배분안', tone: '#d3bff2',
        text: '대표 시공사·임대사·건설사·개발사가 각각 25% 지분을 보유하는 공동 투자안을 제안합니다. 총수입에서 운영 비용을 반영한 배분 가능 이익을 각 참여사의 지분율에 따라 배분합니다.',
        checkpoint: '배분 기준(안)', outcome: '배분 가능 이익 × 참여사 지분율 25%. 투자 규모, 비용 처리 범위와 배분 시기는 공동 협의로 확정합니다.' },
] as const;
export type BusinessStageId = typeof businessStages[number]['id'];
