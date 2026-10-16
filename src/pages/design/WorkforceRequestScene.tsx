import React from 'react';
import { MotionSprite } from './BusinessMotionArtwork';
import './WorkforceRequestScene.css';

const Handset = () => <path d="M-14-21q-8 10 1 27t23 19l8-9-13-10-7 5q-9-4-12-14l7-5-5-15Z" fill="#9ce6ed" stroke="#dcffff" strokeWidth="2" strokeLinejoin="round" />;

// The handset and forearm move together so the office visibly answers the call.
const OfficeOperator = ({ answering = false }: { answering?: boolean }) => <g aria-hidden="true">
    <ellipse cx="123" cy="209" rx="127" ry="19" fill="#5bacc8" opacity=".09" />
    <rect x="94" y="51" width="66" height="108" rx="26" fill="#244d65" stroke="#53809c" />
    <path d="M94 146v45m55-45v45" stroke="#315d75" strokeWidth="9" />
    <path d="M81 106q7-38 46-38t43 38v47H82Z" fill="#78a9c3" stroke="#a6cbdc" />
    <path d="m116 79 12 14 12-14m-12 14v43" stroke="#315b77" strokeWidth="3" />
    <circle cx="128" cy="44" r="25" fill="#dfba9e" />
    <path d="M103 44q-5-34 25-32 30 0 25 34l-12-19q-15 12-38 17" fill="#26384b" />
    <path d="M142 48h2m-23 0h2m3 15q5 4 11-1" stroke="#725a50" strokeWidth="2" strokeLinecap="round" />
    {answering ? <g transform="translate(96 99)"><g className="cy-call-answer-arm"><path d="m0 0 3-25 2-28" stroke="#78a9c3" strokeWidth="14" strokeLinecap="round" /><circle cx="5" cy="-53" r="7" fill="#dfba9e" /><g transform="translate(5 -57) scale(.57)"><Handset /></g></g></g> : <><path d="m97 108-20 29 43 7" stroke="#78a9c3" strokeWidth="14" strokeLinecap="round" /><circle cx="123" cy="144" r="7" fill="#dfba9e" /></>}
    <path d="m158 108 27 31h28" stroke="#78a9c3" strokeWidth="13" strokeLinecap="round" />
    <rect x="5" y="150" width="250" height="14" rx="4" fill="#54829c" /><path d="M25 164v43m211-43v43" stroke="#315971" strokeWidth="8" />
    <rect x="133" y="91" width="97" height="62" rx="5" fill="#12364a" stroke="#8ec7dc" strokeWidth="2" /><path d="M147 108h61m-61 13h43m-43 13h52" stroke="#467f99" strokeWidth="3" />
    <rect x="21" y="132" width="59" height="18" rx="6" fill="#1b4257" stroke="#79b9d0" /><path d="M32 139h11m9 0h15" stroke="#8bc5d7" />
</g>;

const FieldCallScene = () => <g className="cy-request-scene">
    <text x="49" y="35" fill="#93bad2" fontSize="12" letterSpacing="2">FROM THE SITE / A CALL TO THE OFFICE</text>
    <text x="910" y="35" textAnchor="end" fill="#7193ad" fontSize="11">인력 요청 흐름 예시</text>
    <rect x="48" y="67" width="337" height="406" rx="18" fill="#0a2236bc" stroke="#37677e" />
    <text x="72" y="102" fill="#e2f4ff" fontSize="23" fontWeight="700">인력이 필요한 현장</text><text x="72" y="126" fill="#89b6cd" fontSize="13">현장 담당자가 사무실로 전화합니다</text>
    <MotionSprite moduleId="manpower-supply" tile={0} x={164} y={152} width={193} height={198} />
    <MotionSprite moduleId="manpower-supply" tile={1} x={76} y={228} width={81} height={177} />
    <g transform="translate(130 257) scale(.4)"><Handset /></g>
    <g className="cy-call-request"><rect x="69" y="413" width="295" height="39" rx="9" fill="#1d4b60" stroke="#75c7df" /><text x="217" y="438" textAnchor="middle" fill="#d2f6ff" fontSize="16">“내일 비계팀 지원 가능할까요?”</text></g>
    <path d="M385 246H576" stroke="#33586b" strokeWidth="2" strokeDasharray="5 7" />
    <path className="cy-call-connection" d="M385 246H576" pathLength="1" stroke="#9de5ee" strokeWidth="3" strokeDasharray="1" />
    <g className="cy-call-signal"><circle cx="481" cy="246" r="25" fill="#103a4c" stroke="#8adae7" /><g transform="translate(478 244) scale(.47)"><Handset /></g><path d="M514 232q13 14 0 28m7-35q19 21 0 42" stroke="#a6eff5" strokeWidth="2" strokeLinecap="round" /></g>
    <text x="480" y="303" fill="#91cfde" textAnchor="middle" fontSize="14">전화 연결</text>
    <rect x="576" y="67" width="336" height="406" rx="18" fill="#0a2236bc" stroke="#37677e" />
    <text x="602" y="102" fill="#e2f4ff" fontSize="23" fontWeight="700">청연 사무실</text><text x="602" y="126" fill="#89b6cd" fontSize="13">전화 수신 → 요청 조건 접수</text>
    <g transform="translate(610 153)"><OfficeOperator answering /></g>
    <g className="cy-call-received"><rect x="597" y="383" width="294" height="69" rx="10" fill="#123d43" stroke="#75d8be" /><text x="614" y="409" fill="#b5f3de" fontSize="16" fontWeight="700">인력 요청 접수 완료</text><text x="614" y="432" fill="#9ac9ce" fontSize="14">공종 비계  ·  투입 내일  ·  팀 단위</text></g>
</g>;

const CANDIDATES = [{ id: 'A', trade: '골조팀', fit: '다른 공종', selected: false }, { id: 'B', trade: '비계팀', fit: '공종 · 일정 일치', selected: true }, { id: 'C', trade: '마감팀', fit: '다른 공종', selected: false }];
const OfficeMatchingScene = () => <g className="cy-request-scene">
    <text x="49" y="35" fill="#93bad2" fontSize="12" letterSpacing="2">OFFICE MATCHING / THE RIGHT TEAM</text><text x="910" y="35" textAnchor="end" fill="#7193ad" fontSize="11">현장 요청에 맞춘 팀 매칭 예시</text>
    <rect x="49" y="67" width="348" height="406" rx="18" fill="#0a2236bc" stroke="#37677e" />
    <text x="74" y="102" fill="#e2f4ff" fontSize="23" fontWeight="700">사무실에서 팀 매칭</text><text x="74" y="129" fill="#8cb5cc" fontSize="14">담당자가 공종과 가용 일정을 확인합니다</text>
    <g transform="translate(94 163)"><OfficeOperator /></g>
    <rect x="73" y="392" width="299" height="58" rx="10" fill="#173d51" /><text x="91" y="417" fill="#b7e5ef" fontSize="16" fontWeight="700">접수한 현장 요청</text><text x="91" y="438" fill="#9bbecf" fontSize="13">비계 작업 · 내일 투입 · 팀 단위 배치</text>
    <path d="M397 277H552" stroke="#35596d" strokeWidth="2" /><path className="cy-match-route" d="M397 277H552" pathLength="1" stroke="#8ce9ca" strokeWidth="3" strokeDasharray="1" /><path d="m541 270 11 7-11 7" stroke="#8ce9ca" strokeWidth="2" />
    <text x="476" y="251" textAnchor="middle" fill="#9cc7d9" fontSize="14">조건 비교</text>
    {CANDIDATES.map((team, i) => <g key={team.id} transform={`translate(552 ${72 + i * 124})`} className={`cy-match-candidate ${team.selected ? 'is-selected' : 'is-other'}`} style={{ '--candidate-order': i } as React.CSSProperties} data-match-candidate={team.id}>
        <rect className="cy-match-card" width="360" height="105" rx="14" fill="#102c41" stroke={team.selected ? '#91e5c6' : '#3c6178'} />
        <MotionSprite moduleId="manpower-supply" tile={i === 1 ? 1 : 2} x={20} y={16} width={34} height={71} />
        <text x="76" y="37" fill="#d2e9f5" fontSize="19" fontWeight="700">{team.id}팀 · {team.trade}</text><text x="76" y="65" fill={team.selected ? '#9ee4cd' : '#789bb4'} fontSize="14">{team.fit}</text>
        {team.selected && <g className="cy-match-confirmed"><circle cx="320" cy="51" r="20" fill="#1d4e4a" stroke="#a0edcf" /><path d="m310 51 7 7 14-15" stroke="#b7ffe0" strokeWidth="3" /><text x="76" y="88" fill="#b7ffe0" fontSize="13">B팀 매칭 확정</text></g>}
    </g>)}
    <g className="cy-match-result"><rect x="552" y="454" width="360" height="32" rx="16" fill="#123c3c" /><text x="732" y="475" textAnchor="middle" fill="#b1eed8" fontSize="14">요청 접수 → 팀 매칭 → 안전 확인 후 배치</text></g>
</g>;

export const WorkforceRequestDetails = ({ step }: { step: number }) => <div className="cy-request-summary" role="group" aria-label={step === 0 ? '현장 전화 요청 흐름' : '사무실 팀 매칭 흐름'}>
    <span>현장 요청 예시 · 비계 작업 / 내일 투입</span>
    <p>{step === 0 ? '현장 담당자 전화 → 청연 사무실 수신 → 공종·투입일·필요 팀 접수' : '사무실 담당자 검토 → 공종·가용 일정 비교 → 비계 B팀 매칭 확정'}</p>
</div>;

export default function WorkforceRequestScene({ step }: { step: number }) { return step === 0 ? <FieldCallScene /> : <OfficeMatchingScene />; }
