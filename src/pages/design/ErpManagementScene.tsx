import React from 'react';
import { MotionSprite } from './BusinessMotionArtwork';
import { ErpCheck, ErpPanel, ErpPhone, ErpResult, ErpRoute, ErpSheet } from './ErpMotionPrimitives';
import { ERP_DETAIL_ITEMS, ERP_DOCUMENTS } from './erpMotionContent';
import './ErpManagementScene.css';

const ConnectedSites = () => <>
    {['A 현장 · 골조', 'B 현장 · 비계', 'C 현장 · 마감'].map((site, i) => <g key={site}>
        <ErpPanel x={52} y={76 + i * 125} width={256} height={107}><MotionSprite moduleId="manpower-supply" tile={0} x={8} y={9} width={93} height={88} /><text x="113" y="39" fill="#cce9f7" fontSize="18" fontWeight="650">{site}</text><text x="113" y="66" fill="#83adc4" fontSize="13">일보 · 사진 · 출역</text><g className={`cy-erp-phase-${i + 1}`}><circle cx="120" cy="87" r="3" fill="#96e2cb" /><text x="133" y="91" fill="#96d4c6" fontSize="11">현장 기록 연결</text></g></ErpPanel>
        <ErpRoute d={`M308 ${130 + i * 125}H347Q377 ${130 + i * 125} 403 272`} />
    </g>)}
    <MotionSprite moduleId="erp-site-management" tile={2} x={362} y={183} width={153} height={197} />
    <g className="cy-erp-sync-ring"><ellipse cx="439" cy="356" rx="83" ry="25" stroke="#86d4ef" strokeWidth="2" strokeDasharray="7 6" /></g>
    <ErpRoute d="M509 275H601" />
    <ErpPanel x={600} y={88} width={311} height={345} title="사무실 통합 상황판">
        <text x="22" y="80" fill="#7faecb" fontSize="12">현장 · 모바일 · 사무실 동기화</text>
        {['A 현장  작업일보', 'B 현장  출역 집계', 'C 현장  사진 기록'].map((row, i) => <g className={`cy-erp-phase-${i + 1}`} key={row}><rect x="18" y={104 + i * 65} width="276" height="49" rx="7" fill="#15374f" /><text x="32" y={134 + i * 65} fill="#c4e3f4" fontSize="16">{row}</text><ErpCheck x={267} y={128 + i * 65} /></g>)}
        <text x="22" y="324" fill="#8fb8d0" fontSize="13">필요한 현장의 상태를 한눈에</text>
    </ErpPanel><ErpResult text="현장의 기록이 사무실의 판단으로" y={474} />
</>;

const MobileReport = () => <>
    <g transform="translate(83 81)"><ErpPhone><text x="24" y="64" fill="#d9effa" fontSize="18" fontWeight="700">현장 작업일보</text><rect x="22" y="83" width="169" height="129" rx="9" fill="#15374d" /><MotionSprite moduleId="system-dongbari-scaffolding" tile={1} x={39} y={89} width={136} height={113} /><rect className="cy-erp-camera-flash" x="22" y="83" width="169" height="129" rx="9" fill="#d1f6ff" /><text x="27" y="238" fill="#8fb6cc" fontSize="14">A팀 · 비계 작업</text><text x="27" y="266" fill="#8fb6cc" fontSize="14">사진 · 인원 · 진행 기록</text><g className="cy-erp-phase-1"><rect x="23" y="282" width="167" height="30" rx="7" fill="#276586" /><text x="107" y="303" textAnchor="middle" fill="#d8f6ff" fontSize="14">작업일보 전송</text></g></ErpPhone></g>
    <ErpRoute d="M296 258H576" /><g className="cy-erp-report-packet"><rect x="324" y="231" width="67" height="54" rx="8" fill="#8bcce7" /><path d="M339 246h36m-36 10h27m-27 10h34" stroke="#235b77" strokeWidth="3" /></g><text x="436" y="312" fill="#8bbdd2" textAnchor="middle" fontSize="15">모바일 기록 전송</text>
    <ErpPanel x={576} y={83} width={335} height={353} title="사무실 작업일보">
        {['작업 사진 첨부', '투입 팀 · 인원 연결', '작업 내용 · 진행 상태'].map((row, i) => <g key={row} className={`cy-erp-phase-${i + 1}`}><rect x="22" y={80 + i * 67} width="291" height="50" rx="7" fill="#15384f" /><text x="38" y={110 + i * 67} fill="#bfe2ef" fontSize="17">{row}</text><ErpCheck x={284} y={105 + i * 67} /></g>)}
        <g className="cy-erp-phase-3"><text x="29" y="316" fill="#a5e7cf" fontSize="17" fontWeight="700">접수 완료 · 검토 흐름으로</text></g>
    </ErpPanel><ErpResult text="현장 입력부터 사무실 접수까지" y={477} />
</>;

const Attendance = () => <>
    <ErpPanel x={51} y={83} width={487} height={347} title="현장별 출역 · 공수 집계">
        <text x="22" y="82" fill="#799fb9" fontSize="12">집계 흐름 예시 · 실제 현장 수치가 아닙니다</text>
        {['팀 / 작업일', '월', '화', '수', '합계'].map((text, i) => <text key={text} x={[24, 165, 240, 315, 402][i]} y="119" fill="#87bdd4" fontSize="15">{text}</text>)}
        {['A팀 · 골조', 'B팀 · 비계', 'C팀 · 마감'].map((team, i) => <g key={team} className={`cy-erp-phase-${i + 1}`}><rect x="18" y={137 + i * 57} width="451" height="47" rx="6" fill={i === 1 ? '#184353' : '#13354c'} /><text x="30" y={167 + i * 57} fill="#c5e4f3" fontSize="16">{team}</text>{['1.0', '1.0', '1.0', '3.0'].map((value, j) => <text key={j} x={[165, 240, 315, 402][j]} y={167 + i * 57} fill={j === 3 ? '#ade9d3' : '#9dbfd1'} fontSize="17" fontWeight={j === 3 ? 700 : 400}>{value}</text>)}</g>)}
        <path d="M20 318h448" stroke="#365d74" />
    </ErpPanel>
    <MotionSprite moduleId="manpower-supply" tile={1} x={601} y={107} width={75} height={163} /><MotionSprite moduleId="manpower-supply" tile={2} x={681} y={123} width={68} height={147} />
    <ErpPanel x={590} y={286} width={319} height={145} title="기록을 모아 집계">
        <text x="23" y="81" fill="#a4c9da" fontSize="16">작업자 → 팀 → 현장</text><g className="cy-erp-phase-3"><text x="23" y="117" fill="#b0e9d5" fontSize="17" fontWeight="700">출역과 공수 연결 완료</text><ErpCheck x={284} y={111} /></g>
    </ErpPanel><ErpResult text="누락을 확인하고 정산의 기준을 만듭니다" y={476} />
</>;

const Costs = () => <>
    {['자재 반입', '장비 사용', '경비 영수증'].map((label, i) => <g key={label}>
        <ErpPanel x={53} y={76 + i * 125} width={292} height={105}><text x="109" y="40" fill="#d0e9f6" fontSize="19" fontWeight="650">{label}</text><text x="109" y="69" fill="#83acc4" fontSize="13">현장 · 일자 · 증빙 연결</text>{i < 2 ? <MotionSprite moduleId="material-rental" tile={i === 0 ? 0 : 3} x={12} y={8} width={80} height={88} /> : <g transform="translate(25 13)"><rect width="58" height="77" rx="4" fill="#d5e5eb" /><path d="M10 17h37m-37 12h25m-25 12h37m-37 12h30" stroke="#7396a8" strokeWidth="3" /><path className="cy-erp-receipt-scan" d="M-5 16h68" stroke="#8af0d7" strokeWidth="4" /></g>}</ErpPanel>
        <ErpRoute d={`M345 ${129 + i * 125}H410L540 257H588`} />
        <g className={`cy-erp-cost-token cy-erp-phase-${i + 1}`}><circle cx={392 + i * 31} cy={129 + i * 93} r="10" fill={['#93d8ed', '#bba9ef', '#9be2c8'][i]} /></g>
    </g>)}
    <ErpPanel x={588} y={92} width={322} height={336} title="현장 원가 · 증빙">
        {['자재비', '장비비', '경비'].map((text, i) => <g key={text} className={`cy-erp-phase-${i + 1}`}><text x="25" y={102 + i * 72} fill="#c9e6f5" fontSize="18">{text}</text><rect x="25" y={118 + i * 72} width={210 - i * 39} height="10" rx="5" fill={['#66b9d8', '#ab9ad7', '#7bcfb9'][i]} /><ErpCheck x={285} y={100 + i * 72} /></g>)}
        <text x="25" y="315" fill="#86aec5" fontSize="13">원본 영수증과 항목별 기록을 함께</text>
    </ErpPanel><ErpResult text="비용 항목과 증빙이 같은 현장에 연결" y={477} />
</>;

const Documents = ({ documentIndex }: { documentIndex: number }) => {
    const doc = ERP_DOCUMENTS[documentIndex];
    return <>
        <ErpPanel x={50} y={123} width={243} height={284} title="연결된 원본 기록">
            {['출역 · 공수', '노임 · 지급 항목', '현장 · 대상 기간'].map((row, i) => <g key={row} className="cy-erp-phase-1"><text x="23" y={100 + i * 59} fill="#adcedf" fontSize="16">{row}</text><ErpCheck x={214} y={94 + i * 59} /></g>)}
            <text x="23" y="260" fill="#739db8" fontSize="12">필요한 항목을 서류별로 구성</text>
        </ErpPanel><ErpRoute d="M293 262H355" />
        <g transform="translate(355 78)"><g className="cy-erp-document-assemble"><ErpSheet title={doc.title} fields={doc.fields} /></g></g>
        <text x="715" y="96" fill="#82b5cd" fontSize="13">노임서류 라이브러리</text>
        {ERP_DOCUMENTS.map((item, i) => <g key={item.title} transform={`translate(711 ${114 + i * 51})`} opacity={documentIndex === i ? 1 : .52}><rect width="200" height="39" rx="7" fill={documentIndex === i ? '#1c5266' : '#102d43'} stroke={documentIndex === i ? '#93ddde' : '#315772'} /><text x="13" y="25" fill="#d6eef9" fontSize="14" fontWeight={documentIndex === i ? 700 : 400}>{item.title}</text></g>)}
        <ErpResult text={`${doc.title} · 검토 전 초안 완성`} y={479} />
    </>;
};

const Review = () => <>
    <g transform="translate(67 112)"><ErpSheet title="노무비 지급명세서" fields={['출역 기록 대조', '노임 내역 확인', '현장 · 대상 기간']} /></g>
    <g className="cy-erp-review-warning"><rect x="83" y="210" width="277" height="51" rx="5" fill="#f8cc8950" stroke="#eab777" strokeWidth="2" /><rect x="392" y="128" width="177" height="78" rx="12" fill="#44382b" stroke="#cd9e5c" /><text x="480" y="159" textAnchor="middle" fill="#f1cb8f" fontSize="16" fontWeight="700">출역 기록 확인 필요</text><text x="480" y="183" textAnchor="middle" fill="#c3a785" fontSize="12">담당자에게 보완 요청</text></g>
    <ErpRoute d="M377 281H598" /><g className="cy-erp-phase-2"><rect x="400" y="316" width="163" height="37" rx="18" fill="#163d42" /><text x="481" y="340" textAnchor="middle" fill="#a5e4ce" fontSize="14">보완 기록 반영</text></g>
    <ErpPanel x={598} y={106} width={311} height={340} title="담당자 검토">
        {['필수 항목 대조', '누락 기록 보완', '서류 검토 승인'].map((text, i) => <g key={text} className={`cy-erp-phase-${i + 1}`}><text x="26" y={103 + i * 68} fill="#bbdbea" fontSize="18">{text}</text><ErpCheck x={275} y={97 + i * 68} /></g>)}
        <g className="cy-erp-approval-stamp"><rect x="79" y="268" width="155" height="46" rx="8" stroke="#8de0c6" strokeWidth="3" fill="#173f43" /><text x="156" y="298" textAnchor="middle" fill="#b6f5dc" fontSize="21" fontWeight="750">검토 승인</text></g>
    </ErpPanel>
</>;

const Payment = () => <>
    <ErpPanel x={53} y={116} width={292} height={307} title="정산 · 지급 관리">
        <g transform="translate(54 75) scale(.7)"><ErpSheet compact title="검토한 명세서" fields={['출역 · 공수 확인', '노임 · 지급 항목', '검토 승인']} /></g><text x="23" y="275" fill="#a8d8e4" fontSize="15">명세서와 지급 기록을 연결합니다</text>
    </ErpPanel>
    {['A팀', 'B팀', 'C팀'].map((team, i) => <g key={team}>
        <ErpRoute d={`M345 270H429L605 ${132 + i * 137}H656`} />
        <ErpPanel x={656} y={78 + i * 137} width={253} height={110}><text x="20" y="32" fill="#cae8f5" fontSize="19" fontWeight="700">{team} 지급 내역</text><text x="20" y="58" fill="#80aac3" fontSize="13">근로자 · 명세서 · 지급 기록</text><g className="cy-erp-phase-3"><text x="20" y="88" fill="#a1e1cb" fontSize="15">지급 기록 연결 완료</text><ErpCheck x={223} y={82} /></g></ErpPanel>
        <g transform={`translate(754 ${132 + i * 137})`}><g className="cy-erp-payment-token" style={{ '--payment-y': `${270 - (132 + i * 137)}px`, '--token-order': i } as React.CSSProperties}><circle r="21" fill="#91d5be" stroke="#d0f9e7" strokeWidth="2" /><text y="8" textAnchor="middle" fill="#215543" fontSize="25" fontWeight="800">₩</text></g></g>
    </g>)}<ErpResult text="정산 자료와 지급 결과를 함께 관리" y={478} />
</>;

const Analytics = () => <>
    <ErpPanel x={52} y={81} width={533} height={352} title="현장별 예산 · 집행 비교">
        <text x="22" y="81" fill="#81a9c0" fontSize="12">비용 구성 예시 · 노무 / 자재 / 경비</text><path d="M45 116v184h440M45 180h440m-440 60h440" stroke="#34576f" strokeWidth="1" />
        {[['노무', 152, 120], ['자재', 113, 84], ['경비', 80, 58]].map(([label, budget, actual], i) => <g key={label}>
            <g className="cy-erp-chart-bar" style={{ '--bar-order': i } as React.CSSProperties}><rect x={90 + i * 140} y={300 - Number(budget)} width="35" height={Number(budget)} rx="4" fill="#448bb6" /><rect x={132 + i * 140} y={300 - Number(actual)} width="35" height={Number(actual)} rx="4" fill="#87d5bf" /></g><text x={129 + i * 140} y="326" textAnchor="middle" fill="#9bbcd2" fontSize="15">{label}</text>
        </g>)}<path className="cy-erp-chart-trend" d="M110 150 250 186 389 219" pathLength="1" stroke="#e9c991" strokeWidth="3" strokeDasharray="1" />
    </ErpPanel>
    {['항목별 투입 원가', '예산 대비 집행', '현장별 손익 흐름'].map((text, i) => <g key={text} className={`cy-erp-phase-${i + 1}`}><ErpPanel x={626} y={94 + i * 115} width={283} height={94}><text x="22" y="35" fill="#85b5d0" fontSize="12">{['COST BREAKDOWN', 'BUDGET CONTROL', 'SITE PERFORMANCE'][i]}</text><text x="22" y="67" fill="#c7e5f2" fontSize="20" fontWeight="650">{text}</text></ErpPanel></g>)}
    <g transform="translate(72 463)"><rect width="10" height="10" fill="#448bb6" /><text x="18" y="10" fill="#91b2c8" fontSize="12">예산</text><rect x="71" width="10" height="10" fill="#87d5bf" /><text x="89" y="10" fill="#91b2c8" fontSize="12">집행</text></g><ErpResult text="숫자를 모아 현장의 판단으로" x={663} y={472} />
</>;

const Collaboration = () => <>
    <g transform="translate(70 80)"><ErpPhone><text x="25" y="65" fill="#d5eef8" fontSize="20" fontWeight="700">현장 담당자</text><g className="cy-erp-phase-1"><rect x="20" y="90" width="174" height="70" rx="9" fill="#3d3940" stroke="#e4bd7d" /><text x="34" y="118" fill="#f2ce91" fontSize="16">작업일보 보완 요청</text><text x="34" y="143" fill="#c0a98b" fontSize="12">작업 사진 확인이 필요합니다</text></g><g className="cy-erp-phase-2"><rect x="21" y="182" width="173" height="90" rx="9" fill="#143d49" /><text x="35" y="210" fill="#aadcca" fontSize="15">사진 · 작업 내용 보완</text><path d="m39 239 10 10 20-24" stroke="#9de0c5" strokeWidth="4" /><text x="80" y="243" fill="#a6d2cd" fontSize="14">현장 처리 완료</text></g><text x="27" y="303" fill="#799eb8" fontSize="12">필요한 담당자에게 알림</text></ErpPhone></g>
    <ErpRoute d="M283 270H602" /><g transform="translate(443 267)"><g className="cy-erp-alert-pulse"><circle r="45" fill="#143c54" stroke="#78b4d1" /><path d="M-17 7v-16q0-20 17-20t17 20V7l8 9h-50Zm9 16q8 12 16 0" stroke="#b7e8ef" strokeWidth="3" strokeLinecap="round" /></g></g><text x="442" y="345" textAnchor="middle" fill="#92bfd1" fontSize="15">알림 → 보완 → 상태 갱신</text>
    <ErpPanel x={602} y={86} width={307} height={348} title="사무실 협업 화면">
        {['담당자별 보완 요청', '모바일 보완 기록 수신', '관리자 확인 · 처리 완료'].map((text, i) => <g key={text} className={`cy-erp-phase-${i + 1}`}><rect x="18" y={81 + i * 64} width="271" height="47" rx="6" fill="#163950" /><text x="31" y={110 + i * 64} fill="#bedce9" fontSize="16">{text}</text></g>)}<g className="cy-erp-phase-3"><ErpCheck x={37} y={310} /><text x="60" y="316" fill="#a9e5ce" fontSize="16">현장과 사무실 동기화</text></g>
    </ErpPanel><ErpResult text="담당자별 확인 · 변경 이력 · 같은 처리 상태" y={478} />
</>;

const Archive = () => <>
    {['현장 사진', '노임서류', '지급 증빙'].map((title, i) => <g key={title} transform={`translate(${67 + i * 24} ${104 + i * 69})`}><g className="cy-erp-archive-source" style={{ '--archive-order': i } as React.CSSProperties}><rect width="171" height="107" rx="10" fill={['#245572', '#316575', '#346f73'][i]} stroke="#8bc6d5" /><text x="18" y="34" fill="#dbf2f7" fontSize="18" fontWeight="650">{title}</text><path d="M19 55h128m-128 16h95m-95 16h114" stroke="#8ab6c9" strokeWidth="3" /></g></g>)}
    <ErpRoute d="M296 296H392m145 0h62" /><MotionSprite moduleId="erp-site-management" tile={3} x={357} y={232} width={193} height={160} /><text x="451" y="425" textAnchor="middle" fill="#99c8dc" fontSize="16">현장 · 월별 문서함</text>
    <ErpPanel x={600} y={83} width={309} height={354} title="증빙 검색 · 이력 조회">
        <rect x="19" y="73" width="270" height="38" rx="7" fill="#183e56" /><circle cx="38" cy="90" r="7" stroke="#90c3d8" strokeWidth="2" /><path d="m43 96 6 6" stroke="#90c3d8" strokeWidth="2" /><text x="61" y="98" fill="#a2c8da" fontSize="15">A 현장 / 대상 월</text>
        {['출역일보.pdf', '노임대장.pdf', '급여명세서.pdf'].map((file, i) => <g key={file} className={`cy-erp-phase-${i + 1}`}><rect x="20" y={133 + i * 57} width="269" height="43" rx="6" fill={i === 1 ? '#1f4b59' : '#13344c'} /><text x="33" y={160 + i * 57} fill="#c2e0ec" fontSize="16">{file}</text><text x="271" y={160 + i * 57} textAnchor="end" fill="#84b8c7" fontSize="11">조회</text></g>)}
        <text x="23" y="331" fill="#8bb8ce" fontSize="13">원본 · 보완 · 승인 이력을 함께</text>
    </ErpPanel><ErpResult text="필요한 자료를 이력과 함께 다시 찾습니다" y={478} />
</>;

const SCENES = [ConnectedSites, MobileReport, Attendance, Costs, Documents, Review, Payment, Analytics, Collaboration, Archive];
export default function ErpManagementScene({ step, documentIndex = 0 }: { step: number; documentIndex?: number }) {
    const Scene = SCENES[step];
    return <g className={`cy-erp-scene cy-erp-step-${step}`}><text x="49" y="35" fill="#9cbed4" fontSize="12" letterSpacing="2">SMART FIELD OPERATIONS / CONNECTED WORKSPACE</text><text x="910" y="35" textAnchor="end" fill="#7e9eb6" fontSize="11">현장관리 업무 흐름 예시</text><Scene documentIndex={documentIndex} /></g>;
}

export const ErpMotionDetails = ({ step, documentIndex, onDocumentSelect }: { step: number; documentIndex: number; onDocumentSelect: (index: number) => void }) => <div className="cy-erp-details" role="group" aria-label="스마트 현장관리 상세 흐름">
    {step === 4 ? <><div className="cy-erp-document-picker" role="group" aria-label="노임서류 선택">{ERP_DOCUMENTS.map((doc, i) => <button type="button" key={doc.title} aria-pressed={i === documentIndex} onClick={() => onDocumentSelect(i)}>{doc.title}</button>)}</div><p className="cy-erp-document-note">{ERP_DOCUMENTS[documentIndex].note}</p><span>서류를 선택하면 해당 초안의 구성 과정을 다시 보여줍니다.</span></> : <ul>{ERP_DETAIL_ITEMS[step].map((item, i) => <li key={item}><span>0{i + 1}</span>{item}</li>)}</ul>}
</div>;
