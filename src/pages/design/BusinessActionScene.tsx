import React, { useId } from 'react';
import type { BusinessModule } from './businessContent';
import { MotionSprite } from './BusinessMotionArtwork';
import WorkforceMotionScene from './WorkforceMotionScene';
import PartnerNetworkScene from './PartnerNetworkScene';
import ErpManagementScene from './ErpManagementScene';
import BusinessConstructionFilm from './BusinessConstructionFilm';
import './BusinessCinematic.css';

type SceneProps = { step: number; id: string; documentIndex?: number };
type Props = { module: BusinessModule; step: number; replay: number; documentIndex?: number; paused?: boolean; reducedMotion?: boolean };
type GroupProps = { children: React.ReactNode; motion?: string; active?: boolean; order?: number };
const Motion = ({ children, motion = 'arrive', active = true, order = 0 }: GroupProps) => <g className={active ? `cy-film-motion cy-film-${motion}` : undefined} style={{ '--piece-order': order } as React.CSSProperties}>{children}</g>;
const Stamp = ({ x, y, order = 0 }: { x: number; y: number; order?: number }) => <g transform={`translate(${x} ${y})`}><Motion motion="confirm" order={order}><circle r="20" fill="#0a3539" stroke="#8ee9d4" strokeWidth="1.5" /><path d="m-9 0 6 6 12-13" stroke="#b2ffe9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></Motion></g>;
const Callout = ({ x, y, title, detail }: { x: number; y: number; title: string; detail: string }) => <g transform={`translate(${x} ${y})`}><Motion motion="annotation"><rect width="184" height="61" rx="8" fill="#081d2fee" stroke="#477b95" strokeOpacity=".6" /><rect y="15" width="2" height="31" fill="#87e2f6" /><text x="15" y="25" fill="#dcf5ff" fontSize="13" fontWeight="600">{title}</text><text x="15" y="44" fill="#86aac5" fontSize="10">{detail}</text></Motion></g>;
const Paper = ({ x, y, title }: { x: number; y: number; title: string }) => <g transform={`translate(${x} ${y})`}><rect width="176" height="132" rx="9" fill="#0d2a40f2" stroke="#8bc4d9" /><text x="18" y="28" fill="#cfeef9" fontSize="13" fontWeight="600">{title}</text><path d="M18 43h140" stroke="#426881" />{[0, 1, 2].map(i => <Motion key={i} motion="row" order={i}><rect x="18" y={57 + i * 22} width="8" height="8" rx="2" fill="#7bdcc6" /><path d={`M38 ${61 + i * 22}h${102 - i * 17}`} stroke="#8eaec2" strokeWidth="3" strokeLinecap="round" /></Motion>)}</g>;

const ConstructionScene = ({ step, id }: SceneProps) => {
    const moduleId = 'system-dongbari-scaffolding';
    const frame = <MotionSprite moduleId={moduleId} tile={1} x={265} y={70} width={400} height={395} object="scaffold" />;
    return <>
        <defs>{[[310, 190], [188, 122], [60, 128]].map(([y, height], i) => <clipPath id={`${id}-tier-${i}`} key={i}><rect x="245" y={y} width="440" height={height} /></clipPath>)}<clipPath id={`${id}-structure-scan`}><rect x="265" y="70" width="400" height="395" /></clipPath></defs>
        <Motion active={step === 1} motion="foundation"><MotionSprite moduleId={moduleId} tile={0} x={213} y={328} width={480} height={186} object="foundation" /></Motion>
        <g opacity={step < 2 ? '.1' : '1'}>{step === 2 ? [0, 1, 2].map(i => <Motion key={i} motion={`tier-${i}`}><g clipPath={`url(#${id}-tier-${i})`}>{frame}</g></Motion>) : frame}</g>
        {step === 0 && <><Motion motion="survey"><path d="m250 415 233-94 189 94-232 89Z" stroke="#82eaff" strokeWidth="2" strokeDasharray="7 6" fill="#45cbff08" /></Motion>{[[250, 415], [483, 321], [672, 415], [440, 504]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}><Motion motion="target" order={i}><circle r="13" stroke="#90e9fc" /><path d="M-21 0h42M0-21v42" stroke="#90e9fc" /><circle r="3" fill="#e3ffff" /></Motion></g>)}<Callout x={80} y={126} title="기준점 측량" detail="도면 · 하중 · 바닥 조건 확인" /></>}
        {step === 1 && <><Motion motion="level-line"><path d="M230 415h470" stroke="#91efd5" strokeWidth="2" strokeDasharray="7 5" /><path d="M230 403v24M700 403v24" stroke="#91efd5" /></Motion><Callout x={66} y={160} title="수평 기준 정렬" detail="잭베이스 높이 → 받침면 조정" /><Stamp x={700} y={415} /></>}
        {step === 2 && <><Motion motion="hoist"><MotionSprite moduleId={moduleId} tile={2} x={639} y={28} width={165} height={224} object="crane-hook" /></Motion><Callout x={58} y={161} title="하부에서 상부로" detail="수직재 → 수평재 → 가새 체결" />{[0, 1, 2].map(i => <Stamp key={i} x={642} y={410 - i * 119} order={i} />)}</>}
        {step >= 3 && <Motion active={step === 3} motion="engineer"><MotionSprite moduleId={moduleId} tile={3} x={711} y={293} width={78} height={194} object="engineer" /></Motion>}
        {step === 3 && <><Motion motion="rail-trace"><path d="m294 185 181-82 163 57v72l-163-61-181 82Z" pathLength="1" stroke="#f6cd8b" strokeWidth="3" /></Motion><Callout x={60} y={164} title="안전 동선 완성" detail="작업 발판 · 난간 · 벽이음" /><Stamp x={702} y={252} /></>}
        {step === 4 && <><g clipPath={`url(#${id}-structure-scan)`}><Motion motion="inspection-sweep"><rect x="245" y="80" width="430" height="28" fill="#8eeeff30" /><path d="M245 108h430" stroke="#a4fff3" strokeWidth="2" /></Motion></g><Callout x={60} y={163} title="최종 품질 검측" detail="체결 · 수평 · 변형 여부 기록" /><Stamp x={677} y={130} /><Stamp x={676} y={305} order={1} /><Stamp x={676} y={442} order={2} /></>}
    </>;
};

const RentalScene = ({ step }: SceneProps) => {
    const moduleId = 'material-rental';
    return <>
        <path d="M80 459H901M395 484h506" stroke="#406378" strokeOpacity=".6" strokeDasharray="22 15" />
        <MotionSprite moduleId={moduleId} tile={0} x={75} y={110} width={244} height={295} object="material-rack" />
        <Motion active={step === 2 || step === 3} motion={step === 2 ? 'truck-depart' : 'truck-return'}><MotionSprite moduleId={moduleId} tile={1} x={450} y={242} width={389} height={240} object="truck" />{step >= 2 && <Motion active={step === 2 || step === 3} motion={step === 2 ? 'cargo-load' : 'cargo-unload'}><MotionSprite moduleId={moduleId} tile={2} x={452} y={233} width={192} height={126} object="cargo" /></Motion>}</Motion>
        {step < 2 && <MotionSprite moduleId={moduleId} tile={2} x={340} y={347} width={155} height={103} object="cargo" />}
        <Motion active={step === 2 || step === 3} motion={step === 2 ? 'forklift-load' : 'forklift-return'}><MotionSprite moduleId={moduleId} tile={3} x={286} y={307} width={183} height={153} object="forklift" /></Motion>
        {step === 0 && <><Motion motion="rack-scan"><rect x="69" y="121" width="251" height="34" rx="5" fill="#73dafa19" stroke="#a0e8fc" /></Motion><Callout x={543} y={99} title="규격별 재고 분류" detail="수량 · 등급 · 가용 상태 확인" /></>}
        {step === 1 && <><Motion motion="request"><Paper x={368} y={91} title="현장 자재 요청" /></Motion><Motion motion="route-draw"><path d="M308 227H357V160" pathLength="1" stroke="#9adcf4" strokeWidth="2" /></Motion><Stamp x={555} y={115} /></>}
        {step === 2 && <><Callout x={578} y={94} title="상차에서 출발까지" detail="부재 인양 → 적재 → 현장 반입" /><Motion motion="departure-light"><path d="M820 397h62" stroke="#ffe3a0" strokeWidth="5" strokeLinecap="round" /></Motion></>}
        {step === 3 && <><Callout x={572} y={92} title="회수와 반납 검수" detail="차량 도착 → 하차 → 상태 확인" /><Stamp x={365} y={278} order={2} /></>}
        {step === 4 && <><Motion motion="route-draw"><path d="M211 99C490-12 842 84 834 221M834 221l-13-18m13 18 15-18" pathLength="1" stroke="#8ee3c9" strokeWidth="3" /></Motion><Motion motion="circulation"><circle cx="211" cy="99" r="6" fill="#bcffec" /></Motion><Callout x={411} y={94} title="자재의 다음 사이클" detail="회수 → 정비 → 다음 현장 재투입" /><Stamp x={296} y={190} /></>}
    </>;
};

const SCENES: Record<BusinessModule['id'], React.FC<SceneProps>> = { 'system-dongbari-scaffolding': ConstructionScene, 'material-rental': RentalScene, 'manpower-supply': WorkforceMotionScene, 'erp-site-management': ErpManagementScene, 'partner-network': PartnerNetworkScene };
const BusinessActionScene: React.FC<Props> = ({ module, step, replay, documentIndex, paused = false, reducedMotion = false }) => {
    const id = useId().replace(/:/g, '');
    const Scene = SCENES[module.id];
    const scene = <svg key={`${module.id}-${step}-${replay}`} className="cy-action-scene cy-cinematic-scene" viewBox="0 0 960 540" role="img" aria-label={`${module.title} · ${module.workflow[step].title} 모션 그래픽`} data-scene={module.id} data-step={step} fill="none">
        <defs><radialGradient id={`${id}-aura`}><stop stopColor="#176283" stopOpacity=".4" /><stop offset="1" stopColor="#061322" stopOpacity="0" /></radialGradient><linearGradient id={`${id}-floor`} x2="0" y2="1"><stop stopColor="#1f5779" stopOpacity=".15" /><stop offset="1" stopColor="#05101f" stopOpacity=".8" /></linearGradient></defs>
        <rect width="960" height="540" fill="#061221" /><ellipse cx="490" cy="285" rx="465" ry="280" fill={`url(#${id}-aura)`} /><path d="M0 345 480 160 960 345V540H0Z" fill={`url(#${id}-floor)`} />
        <g stroke="#69b8d8" strokeOpacity=".075">{[0, 1, 2, 3, 4, 5, 6].map(i => <React.Fragment key={i}><path d={`M${-190 + i * 150} 540 960 ${190 + i * 49}`} /><path d={`M${1150 - i * 150} 540 0 ${190 + i * 49}`} /></React.Fragment>)}</g><ellipse cx="488" cy="461" rx="345" ry="45" fill="#000" opacity=".18" />
        <g className="cy-film-camera"><Scene step={step} id={id} documentIndex={documentIndex} /></g><g stroke="#8ccce2" strokeOpacity=".4"><path d="M23 53V23h30M907 23h30v30M23 487v30h30M907 517h30v-30" /></g><text x="39" y="510" fill="#638ba8" fontSize="9" letterSpacing="2">CHEONG YEON / {module.level.toUpperCase()}</text><text x="922" y="510" textAnchor="end" fill="#719ab4" fontSize="9" letterSpacing="1">ACTION {String(step + 1).padStart(2, '0')}</text>
    </svg>;
    return module.id === 'system-dongbari-scaffolding' && step === 2
        ? <BusinessConstructionFilm key={`${module.id}-${step}-${replay}`} paused={paused} reducedMotion={reducedMotion} fallback={scene} />
        : scene;
};
export default BusinessActionScene;
