import React from 'react';
import AllianceOrbit, { type Flow, type Stations } from './AllianceOrbit';
import { businessStages, type BusinessStageId } from './allianceBusinessPlan';
import { developmentBase } from './allianceRepresentatives';

const stop = (note: string, flow: Flow = 'idle') => ({ note, flow });
const scenes: Record<BusinessStageId, { title: string; description: string; stations: Stations }> = {
    selection: {
        title: '대표사 선정', description: '대표 건설사 1개사와 대표 임대사 1개사를 선정합니다. 청연ENG는 시공 운영을, 선정된 개발사 그뚠엔터는 플랫폼·ERP 개발을 담당합니다.',
        stations: { builder: stop('1개사 모집', 'in'), rental: stop('1개사 모집', 'in'), crew: stop('청연ENG'), developer: stop(developmentBase.name) },
    },
    pilot: {
        title: '현장 실증', description: '시범 현장에서 발주·시공·자재 공급 데이터를 연동하고 공통 업무 기준을 검증합니다.',
        stations: { builder: stop('발주·공정', 'both'), rental: stop('재고·납기', 'both'), crew: stop('시공·인력', 'both'), developer: stop('ERP 구축', 'both') },
    },
    release: {
        title: '무료 보급', description: '실증을 거친 기본 ERP가 건설사·시공사·임대사에 무료 배포됩니다.',
        stations: { builder: stop('발주 관리', 'out'), rental: stop('재고 관리', 'out'), crew: stop('인력 배치', 'out'), developer: stop('기본 ERP', 'in') },
    },
    revenue: {
        title: '수익 모델', description: '구독료·거래 수수료·광고료·기타 수입으로 수익원을 구성합니다. 운영 비용을 반영한 배분 가능 이익을 지분율에 따라 배분합니다.',
        stations: { builder: stop('현장 관리'), rental: stop('자재 공급'), crew: stop('인력 지원'), developer: stop('기능 운영') },
    },
    distribution: {
        title: '이익 배분', description: '공동 투자안은 대표 시공사·임대사·건설사·개발사 각각 지분 25%, 총 100%입니다. 운영 비용을 반영한 배분 가능 이익을 지분율에 따라 배분합니다.',
        stations: { builder: stop('25%', 'out'), rental: stop('25%', 'out'), crew: stop('25%', 'out'), developer: stop('25%', 'out') },
    },
};

export default function BusinessFlowGraphic({ step }: { step: number }) {
    const stage = businessStages[step], scene = scenes[stage.id];
    return <AllianceOrbit {...scene} caption={stage.id === 'revenue' ? '수입원 구성' : '사업 단계 0' + (step + 1)} split={stage.id === 'distribution'} income={stage.id === 'revenue'} />;
}
