import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { Boxes, ClipboardList, HardHat, RotateCcw, UsersRound } from 'lucide-react';
import { MotionBeam } from './AllianceMotionEffects';
import { companies, crewCompanies, rentalCompanies } from './allianceNetwork';
import './AllianceCooperationRing.css';

const circlePath = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r}`;

export default function AllianceCooperationRing({ group, focused }: { group: 'crew' | 'rental'; focused: boolean }) {
    const crew = group === 'crew', members = crew ? crewCompanies : rentalCompanies;
    const Icon = crew ? HardHat : Boxes, Payload = crew ? UsersRound : Boxes, Reply = crew ? ClipboardList : RotateCcw;
    const uid = useId().replace(/:/g, '');
    const ref = useRef<SVGSVGElement>(null);
    const [portrait, setPortrait] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const fit = () => { const width = el.getBoundingClientRect().width; if (width > 0) setPortrait(width < 360); };
        fit();
        if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
        const observer = new ResizeObserver(fit); observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const cx = portrait ? 150 : 200, cy = portrait ? 167 : 162, outer = portrait ? 92 : 122, inner = outer - 14;
    const points = portrait ? [[150, 50], [235, 263], [65, 263]] : [[200, 40], [305.66, 223], [94.34, 223]];
    const title = crew ? '시공사 현장 지원망' : '임대사 자재 공유망';
    const outgoing = crew ? '작업조 지원' : '자재 공동 공급';
    const incoming = crew ? '지원 요청·가용팀 회신' : '재고 공유·자재 반납';
    const steps = crew ? ['지원 요청', '작업조 배정', '출역 이력'] : ['가용 재고 공유', '공동 출고', '반납·회수'];
    return <section className={'ai-coop-ring coop-' + group} data-focused={focused} aria-labelledby={uid + '-heading'}>
        <header className="ai-coop-head"><div><span>COOPERATION / {crew ? 'WORKFORCE' : 'MATERIALS'}</span><h3 id={uid + '-heading'}>{title}</h3></div><Icon size={25} aria-hidden="true" /></header>
        <p className="ai-coop-intro">{crew ? '협력 시공사 간 현장 인력의 상호 지원' : '협력 임대사 간 재고 연계와 공동 공급'}</p>
        <svg ref={ref} className="ai-coop-orbit" data-portrait={portrait} viewBox={portrait ? '0 0 300 310' : '0 0 400 310'} role="img" aria-labelledby={uid + '-description'} style={{ '--orbit-center': `${cx}px ${cy}px` } as React.CSSProperties}>
            <title id={uid + '-description'}>{crew
                ? '청연ENG·동바리 시공사·비계 시공사가 원형 협력망에서 지원 요청과 가용 작업조를 주고받습니다. 지원 요청, 작업조 배정, 출역 이력을 현장 ERP에 연계합니다.'
                : '동바리·비계·권역 임대사가 원형 협력망에서 가용 재고를 공유하고 자재를 공동 공급합니다. 공급 물량은 업체별 출고·반납 이력으로 관리합니다.'}</title>
            <circle className="ai-coop-aura" cx={cx} cy={cy} r={outer - 22} />
            <circle className="ai-coop-guide" cx={cx} cy={cy} r={outer + 16} />
            <path className="ai-coop-track" d={circlePath(cx, cy, outer)} />
            <path className="ai-coop-track track-return" d={circlePath(cx, cy, inner)} />
            <MotionBeam d={circlePath(cx, cy, outer)} duration={12} crisp />
            <MotionBeam d={circlePath(cx, cy, inner)} duration={12} delay={-4} reverse crisp />
            <g className="ai-coop-spokes">{points.map(([x, y], i) => <path key={i} d={`M${cx} ${cy} L${x} ${y}`} />)}</g>
            <g className="ai-coop-carrier carrier-out" aria-hidden="true"><g transform={`translate(${cx} ${cy - outer})`}><g className="ai-coop-payload"><circle r="13" /><Payload x="-8" y="-8" width="16" height="16" /></g></g></g>
            <g className="ai-coop-carrier carrier-return" aria-hidden="true"><g transform={`translate(${cx} ${cy - inner})`}><g className="ai-coop-payload"><circle r="11" /><Reply x="-7" y="-7" width="14" height="14" /></g></g></g>
            <g className="ai-coop-center">
                <circle cx={cx} cy={cy} r="53" /><circle className="ai-coop-center-rim" cx={cx} cy={cy} r="58" pathLength="100" />
                <Icon x={cx - 13} y={cy - (portrait ? 41 : 34)} width="26" height="26" aria-hidden="true" />
                <text x={cx} y={cy + (portrait ? 1 : 16)}>{portrait ? <><tspan x={cx}>{crew ? '인력' : '자재'}</tspan><tspan x={cx} dy="18">{crew ? '상호 지원' : '공동 공급'}</tspan></> : crew ? '인력 상호 지원' : '자재 공동 공급'}</text>
                <text className="ai-coop-center-note" x={cx} y={cy + 36}>{crew ? '현장 · 공정 연계' : '재고 · 납기 연계'}</text>
            </g>
            {members.map((member, i) => {
                const [x, y] = points[i];
                return <g key={member} className="ai-coop-company" style={{ '--arrival-delay': -i * 4 + 's' } as React.CSSProperties}>
                    <rect className="ai-coop-node-halo" x={x - 58} y={y - 27} width="116" height="54" rx="13" />
                    <rect className="ai-coop-node" x={x - 55} y={y - 24} width="110" height="48" rx="10" />
                    <text x={x} y={y - 2}>{companies[member].name}</text><text className="ai-coop-company-note" x={x} y={y + 15}>{companies[member].work}</text>
                </g>;
            })}
            <path className="ai-coop-direction" d={`M${cx + outer + 6} ${cy - 11} l-5 9 -6-8 M${cx - outer + 1} ${cy + 2} l6-9 5 9`} />
        </svg>
        <div className="ai-coop-legend"><span><i />{outgoing}</span><span><i />{incoming}</span></div>
        <ol className="ai-coop-steps">{steps.map((text, i) => <li key={text}><small>0{i + 1}</small>{text}</li>)}</ol>
        <p className="ai-coop-note">{crew ? '현장별 수요와 가용 인력을 연계해 지원을 주고받습니다.' : '자사 재고와 협력사 물량을 연계하고 업체별 회수 책임을 기록합니다.'}<span>협력업체 구성 및 운영 예시</span></p>
    </section>;
}
