import React from 'react';
import AllianceOrbit, { type Flow, type Stations } from './AllianceOrbit';
import AllianceCooperationRing from './AllianceCooperationRing';
import { developmentBase } from './allianceRepresentatives';
import { MotionBeam } from './AllianceMotionEffects';
import { crewCompanies, edges, roles, scenes, type EdgeId, type NetworkNode, type Role, type Scene } from './allianceNetwork';

const roleOf = (node: NetworkNode): Role => {
    if (node in roles) return node as Role;
    return (crewCompanies as readonly string[]).includes(node) ? 'crew' : 'rental';
};
const notes: Record<Role, string>[] = [
    { builder: '견적 요청', crew: '시공비 확인', rental: '임대료 확인', developer: developmentBase.name },
    { builder: '비교·선정', crew: '가격 제안', rental: '가격 제안', developer: developmentBase.name },
    { builder: '현장 발주', crew: '인력 상호지원', rental: '자재 공급', developer: developmentBase.name },
    { builder: '현장 발주', crew: '현장 시공', rental: '재고 공동공급', developer: developmentBase.name },
    { builder: '현장 발주', crew: '투입 일정', rental: '납품 일정', developer: developmentBase.name },
    { builder: '발주 기준', crew: '인력 기준', rental: '재고 기준', developer: 'ERP 개발' },
];
function currentFlows(scene: Scene) {
    const signals: Record<Role, Set<Flow>> = { builder: new Set(), crew: new Set(), rental: new Set(), developer: new Set() };
    for (const [id, dir] of Object.entries(scene.flows)) {
        const { from, to } = edges[id as EdgeId];
        if (dir !== 'back') { signals[roleOf(from)].add('in'); signals[roleOf(to)].add('out'); }
        if (dir !== 'out') { signals[roleOf(to)].add('in'); signals[roleOf(from)].add('out'); }
    }
    const direction = (set: Set<Flow>): Flow => set.size === 2 ? 'both' : set.has('in') ? 'in' : set.has('out') ? 'out' : 'idle';
    return { direction: (role: Role) => direction(signals[role]) };
}

export default function AllianceNetworkMap({ scene }: { scene: Scene }) {
    const index = scenes.indexOf(scene), flows = currentFlows(scene);
    const station = (role: Role) => ({ flow: flows.direction(role), note: notes[index][role] });
    const stations: Stations = { builder: station('builder'), crew: station('crew'), rental: station('rental'), developer: station('developer') };
    return <div className="ai-field-orbits">
        <div className="ai-field-main">
            <div className="ai-orbit-heading" aria-hidden="true"><span>참여사 간 업무 연계</span><span>0{index + 1} / 06</span></div>
            <AllianceOrbit title={scene.label} caption={'현장 단계 0' + (index + 1)} description={scene.label + ': ' + scene.headline + '. ' + scene.detail} stations={stations} />
        </div>
        <div className="ai-coop-bridge">
            <svg viewBox="0 0 1000 72" preserveAspectRatio="none" aria-hidden="true">
                {['M500 0 V20 Q500 36 480 36 H270 Q250 36 250 56 V72', 'M500 0 V20 Q500 36 520 36 H730 Q750 36 750 56 V72'].map((d, i) => <g key={d}>
                    <path d={d} /><MotionBeam d={d} color={i ? '#95dab0' : '#ffc785'} duration={3.6} crisp /><MotionBeam d={d} color={i ? '#95dab0' : '#ffc785'} duration={3.6} reverse delay={-1.8} crisp />
                </g>)}
            </svg><span>현장 · 공정 · ERP 연동</span>
        </div>
        <div className="ai-branch-wheels">
            {(['crew', 'rental'] as const).map(group => <AllianceCooperationRing key={group} group={group} focused={scene.tone === (group === 'crew' ? 'crew' : 'stock') || scene.tone === 'joint'} />)}
        </div>
    </div>;
}
