import React from 'react';
import { MotionSprite } from './BusinessMotionArtwork';
import WorkforceRequestScene, { WorkforceRequestDetails } from './WorkforceRequestScene';
import './WorkforceMotionScene.css';

const TEAMS = [
    { id: 'A', site: 'A 현장', trade: '골조 작업', color: '#87dcff', x: 176, startX: 350, y: 124 },
    { id: 'B', site: 'B 현장', trade: '비계 작업', color: '#f2c481', x: 480, startX: 480, y: 274 },
    { id: 'C', site: 'C 현장', trade: '마감 작업', color: '#91e4c6', x: 784, startX: 610, y: 424 },
] as const;
type Team = typeof TEAMS[number];
const Check = ({ x, y, color = '#a5f3d7' }: { x: number; y: number; color?: string }) => <g transform={`translate(${x} ${y})`}><circle r="12" fill="#123c3f" stroke={color} /><path d="m-5 0 4 4 7-8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>;

const TeamPeople = ({ team, small = false }: { team: Team; small?: boolean }) => <g aria-hidden="true">
    <ellipse cx="0" cy="76" rx={small ? 38 : 57} ry="13" fill={team.color} opacity=".1" stroke={team.color} />
    <MotionSprite moduleId="manpower-supply" tile={2} x={small ? -35 : -50} y={small ? 13 : -9} width={small ? 31 : 42} height={small ? 63 : 85} />
    <MotionSprite moduleId="manpower-supply" tile={1} x={small ? -9 : -18} y={small ? 5 : -23} width={small ? 34 : 47} height={small ? 72 : 103} />
    {!small && <MotionSprite moduleId="manpower-supply" tile={2} x={18} y={-6} width={39} height={83} />}
    {!small && <><rect x={-33} y="83" width="66" height="25" rx="12" fill="#0b2639" stroke={team.color} />
    <text x="0" y="100" textAnchor="middle" fill={team.color} fontSize="15" fontWeight="700">{team.id}팀</text></>}
</g>;

const Site = ({ team, step }: { team: Team; step: number }) => <g transform={`translate(${team.x} 0)`}>
    <rect x="-130" y="55" width="260" height="254" rx="15" fill="#091e31ad" stroke={team.color} strokeOpacity=".24" />
    <circle cx="-103" cy="82" r="4" fill={team.color} />
    <text x="-90" y="88" fill="#e3f3ff" fontSize="20" fontWeight="700">{team.site}</text>
    <text x="110" y="87" textAnchor="end" fill={team.color} fontSize="12">{team.trade}</text>
    <MotionSprite moduleId={team.id === 'B' ? 'system-dongbari-scaffolding' : 'manpower-supply'} tile={team.id === 'B' ? 1 : 0} x={-87} y={109} width={174} height={159} object={`site-${team.id}`} />
    {step === 0 && <g className="cy-wf-request" style={{ '--team-index': TEAMS.indexOf(team) } as React.CSSProperties}><rect x="-89" y="273" width="178" height="23" rx="11" fill="#193b50" /><text x="0" y="289" textAnchor="middle" fill={team.color} fontSize="12">{team.trade} 인력 요청</text></g>}
    {step === 1 && <g className="cy-wf-match" style={{ '--team-index': TEAMS.indexOf(team) } as React.CSSProperties}><rect x="-91" y="271" width="182" height="25" rx="12" fill="#173a4c" /><text x="0" y="288" textAnchor="middle" fill={team.color} fontSize="13">{team.id}팀 · 투입 조건 일치</text></g>}
    {step === 3 && <g className={`cy-wf-arrival cy-wf-arrival-${team.id}`}><rect x="-105" y="272" width="210" height="26" rx="13" fill="#103a3d" /><Check x={-82} y={285} color={team.color} /><text x="8" y="290" textAnchor="middle" fill={team.color} fontSize="13">{team.id}팀 배치 · 출역 기록</text></g>}
</g>;

const DeploymentScene = ({ step }: { step: number }) => <g className={`cy-workforce-deployment cy-workforce-step-${step}`}>
    <text x="49" y="34" fill="#93bad2" fontSize="12" letterSpacing="2">TEAM DISPATCH / MULTIPLE SITES</text>
    <text x="910" y="34" textAnchor="end" fill="#7193ad" fontSize="11">팀별 배치 흐름 예시</text>
    {TEAMS.map(team => <Site key={team.id} team={team} step={step} />)}
    {TEAMS.map((team, i) => <g key={team.id} style={{ '--team-index': i } as React.CSSProperties}>
        <path d={`M${team.startX} 429Q${team.startX} 343 ${team.x} 334V312`} stroke={team.color} strokeOpacity=".17" strokeWidth="2" />
        {step !== 2 && <path className={step === 3 ? 'cy-wf-dispatch-route' : 'cy-wf-match-route'} d={`M${team.startX} 429Q${team.startX} 343 ${team.x} 334V312`} pathLength="1" stroke={team.color} strokeWidth="2" strokeDasharray="1" />}
    </g>)}
    <g className={step === 3 ? 'cy-wf-staging' : undefined}>
        <rect x="269" y="351" width="422" height="158" rx="18" fill="#10283bd9" stroke="#315971" />
        <text x="480" y="373" textAnchor="middle" fill="#8eb2c9" fontSize="12">{step === 0 ? '현장 요청을 모으고, 팀 단위로 준비합니다' : step === 1 ? '공종 · 숙련도 · 일정으로 팀별 매칭' : step === 2 ? '모든 팀의 작업 전 안전 브리핑' : '청연 인력 운영 · 팀별 배치 출발'}</text>
    </g>
    {TEAMS.map((team, i) => <g key={team.id} transform={`translate(${step === 3 ? team.x : team.startX} ${step === 3 ? 311 : 398})`}>
        <g className={step === 3 ? `cy-wf-team-travel cy-wf-team-${team.id}` : step === 1 ? 'cy-wf-team-ready' : undefined} style={{ '--team-index': i } as React.CSSProperties} data-workforce-team={team.id} data-destination={team.site}>
            <title>{team.id}팀 → {team.site} · {team.trade}</title><TeamPeople team={team} />
        </g>
        {step === 2 && <g className="cy-wf-safety" style={{ '--team-index': i } as React.CSSProperties}><path d="m-30-29 30-9 30 9v23q0 20-30 30-30-10-30-30Z" fill="#103f43" stroke={team.color} /><text y="-4" fill={team.color} fontSize="15" fontWeight="700" textAnchor="middle">TBM</text></g>}
    </g>)}
    {step === 3 && <g className="cy-wf-dispatch-finished"><rect x="323" y="437" width="314" height="35" rx="17" fill="#123b40" stroke="#72c8c1" /><text x="480" y="459" textAnchor="middle" fill="#b5f3df" fontSize="15" fontWeight="600">각 현장 배치 완료 → 팀별 공수 기록</text></g>}
</g>;

const Money = ({ team, index }: { team: Team; index: number }) => <g className={`cy-wf-money cy-wf-money-${team.id}`} data-money-for={team.id}>
    <g transform={`translate(${index * -23} ${index * 6})`} opacity={1 - index * .2}>
        <rect x="-29" y="-17" width="58" height="34" rx="5" fill="#a5e2c6" stroke="#e4fff0" strokeWidth="1.5" />
        <rect x="-24" y="-12" width="48" height="24" rx="3" stroke="#387d63" />
        <circle r="10" fill="#2d795d" /><text y="6" textAnchor="middle" fill="#e4fff0" fontSize="17" fontWeight="800">₩</text>
    </g>
</g>;

const PayrollScene = () => <g className="cy-workforce-payroll">
    <text x="49" y="34" fill="#93bad2" fontSize="12" letterSpacing="2">PAYROLL / FROM WORK TO PAYMENT</text>
    <text x="910" y="34" textAnchor="end" fill="#7193ad" fontSize="11">노무비 지급 흐름 예시</text>
    <rect x="55" y="124" width="285" height="301" rx="19" fill="#0c263cf2" stroke="#5386a0" />
    <circle cx="111" cy="184" r="30" fill="#163f4f" stroke="#8be0d2" /><text x="111" y="197" textAnchor="middle" fill="#b1f6da" fontSize="37" fontWeight="700">₩</text>
    <text x="160" y="179" fill="#e0f3ff" fontSize="21" fontWeight="700">청연 노무비 정산</text><text x="160" y="203" fill="#91b2c8" fontSize="13">현장 기록을 팀별 지급으로</text>
    {['현장별 출역 확인', '팀별 공수 합산', '노무비 지급 승인'].map((text, i) => <g key={text} className="cy-wf-ledger-row" style={{ '--ledger-index': i } as React.CSSProperties}><path d={`M80 ${239 + i * 42}h234`} stroke="#2b526c" /><text x="88" y={264 + i * 42} fill="#b1cedf" fontSize="16">{text}</text><g className={`cy-wf-ledger-check cy-wf-ledger-check-${i}`}><Check x={293} y={259 + i * 42} /></g></g>)}
    <g className="cy-wf-approved"><rect x="81" y="371" width="234" height="33" rx="16" fill="#143e3d" /><text x="198" y="393" textAnchor="middle" fill="#a7efcf" fontSize="15" fontWeight="700">확인된 노무비 · 지급 시작</text></g>
    {TEAMS.map(team => <g key={team.id}>
        <path d={`M340 274H447Q487 274 487 ${team.y}H624`} stroke={team.color} strokeOpacity=".18" strokeWidth="3" />
        <path className={`cy-wf-payment-route cy-wf-payment-route-${team.id}`} d={`M340 274H447Q487 274 487 ${team.y}H624`} pathLength="1" stroke={team.color} strokeWidth="3" strokeDasharray="1" />
        <g transform={`translate(624 ${team.y - 62})`} data-payment-recipient={team.id}>
            <title>{team.id}팀 근로자에게 노무비 지급</title>
            <rect width="288" height="125" rx="15" fill="#0b253af2" stroke={team.color} strokeOpacity=".55" />
            <text x="19" y="27" fill={team.color} fontSize="18" fontWeight="700">{team.id}팀 근로자</text><text x="267" y="26" fill="#8aaac3" fontSize="12" textAnchor="end">{team.site}</text>
            <g transform="translate(50 27)"><TeamPeople team={team} small /></g>
            <g className={`cy-wf-wallet cy-wf-wallet-${team.id}`} transform="translate(203 51)">
                <rect x="-30" y="-5" width="70" height="46" rx="7" fill="#1a4858" stroke={team.color} />
                <path d="M-30 5h70M-17-5v-9h43v9" stroke={team.color} strokeWidth="2" /><rect x="12" y="10" width="32" height="20" rx="4" fill="#2e6473" stroke={team.color} /><circle cx="22" cy="20" r="3" fill={team.color} />
                <text x="-6" y="29" textAnchor="middle" fill="#e0fff0" fontSize="25" fontWeight="700">₩</text>
            </g>
            <g className={`cy-wf-payment-wait cy-wf-payment-wait-${team.id}`}><text x="180" y="108" textAnchor="middle" fill="#8ca9be" fontSize="14">지급 대기</text></g>
            <g className={`cy-wf-payment-done cy-wf-payment-done-${team.id}`}><Check x={113} y={103} color={team.color} /><text x="192" y="108" textAnchor="middle" fill={team.color} fontSize="15" fontWeight="700">노무비 지급 완료</text></g>
        </g>
        {[1, 0].map(index => <Money key={index} team={team} index={index} />)}
    </g>)}
    <text x="61" y="462" fill="#7fa4bd" fontSize="13">출역과 공수를 확인한 뒤, 각 팀 근로자에게 지급합니다.</text>
</g>;

export const WorkforceMotionDetails = ({ step }: { step: number }) => step < 2 ? <WorkforceRequestDetails step={step} /> : step === 2 ? null : <div className="cy-workforce-summary" role="group" aria-label={step === 4 ? '팀별 노무비 지급 흐름' : '팀별 현장 배치 흐름'}>
    <span>배치·지급 흐름 예시</span>
    <ul>{TEAMS.map(team => <li key={team.id} style={{ '--team-color': team.color } as React.CSSProperties}><strong>{team.id}팀</strong><span>{team.site} · {team.trade}</span><span>{step === 4 ? '근로자 노무비 지급' : '팀 단위 배치 · 출역 기록'}</span></li>)}</ul>
</div>;

const WorkforceMotionScene = ({ step }: { step: number }) => step < 2 ? <WorkforceRequestScene step={step} /> : step === 4 ? <PayrollScene /> : <DeploymentScene step={step} />;
export default WorkforceMotionScene;
