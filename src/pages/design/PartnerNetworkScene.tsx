import React from 'react';
import { MotionSprite } from './BusinessMotionArtwork';
import { CHAT_TYPES, PARTNER_CHATS, PARTNER_NETWORKS as NETWORKS } from './partnerNetworkContent';
import './PartnerNetworkScene.css';

const ChatIcon = () => <g aria-hidden="true"><path d="M-22-16h44q6 0 6 6v20q0 6-6 6H-7l-12 9 2-9h-5q-6 0-6-6v-20q0-6 6-6Z" fill="#f5dc73" /><path d="M-14-3h28m-28 9h20" stroke="#4b432b" strokeWidth="3" strokeLinecap="round" /></g>;
const AssociationIcon = () => <g aria-hidden="true" fill="#9bc9fa"><circle cy="-8" r="9" /><circle cx="-20" cy="-3" r="7" /><circle cx="20" cy="-3" r="7" /><path d="M-13 24V13q0-15 13-15t13 15v11Zm-22 0V14q0-11 11-11h4v21Zm55 0V3h4q11 0 11 11v10Z" /></g>;
const UnionIcon = () => <g aria-hidden="true" stroke="#bcb0f5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><circle cx="-15" cy="-10" r="7" fill="#bcb0f5" /><circle cx="15" cy="-10" r="7" fill="#bcb0f5" /><path d="M-30 22V10q0-11 10-11l20 16L20-1q10 0 10 11v12M-14 23 0 12l14 11" /></g>;
const NetworkIcon = ({ index }: { index: number }) => index === 0 ? <ChatIcon /> : index === 1 ? <AssociationIcon /> : <UnionIcon />;
const MiniTeam = ({ incoming }: { incoming: boolean }) => <g aria-hidden="true">
    <ellipse cx="0" cy="55" rx="48" ry="10" fill={incoming ? '#8edac6' : '#f5cf86'} opacity=".16" />
    <MotionSprite moduleId="manpower-supply" tile={incoming ? 1 : 2} x={-37} y={1} width={27} height={54} />
    <MotionSprite moduleId="manpower-supply" tile={incoming ? 2 : 1} x={-13} y={-8} width={30} height={64} />
    <MotionSprite moduleId="manpower-supply" tile={incoming ? 1 : 2} x={14} y={1} width={27} height={54} />
    <rect x="-43" y="61" width="86" height="22" rx="11" fill="#123448" stroke={incoming ? '#91e4c6' : '#f1cb84'} /><text y="76" textAnchor="middle" fill={incoming ? '#b6efdc' : '#f1d49f'} fontSize="12" fontWeight="700">{incoming ? '협력 지원팀' : '청연 지원팀'}</text>
</g>;

const ConnectionScene = () => <g className="cy-partner-scene">
    <text x="49" y="35" fill="#93bad2" fontSize="12" letterSpacing="2">PARTNER NETWORK / CONNECTED TEAMS</text><text x="910" y="35" textAnchor="end" fill="#7193ad" fontSize="11">협력망 연결 흐름 예시</text>
    {NETWORKS.map((network, i) => <g key={network.id} transform={`translate(${50 + i * 294} 68)`}>
        <rect width="272" height="253" rx="18" fill="#0b2539dc" stroke={network.color} strokeOpacity=".5" />
        <g transform="translate(36 37) scale(.65)"><NetworkIcon index={i} /></g><text x="67" y="43" fill={network.color} fontSize="20" fontWeight="700">{network.title}</text>
        <text x="23" y="91" fill="#e4f3fa" fontSize="25" fontWeight="700">{network.subtitle}</text><text x="23" y="119" fill="#8eb0c5" fontSize="14">{network.activity}</text>
        {Array.from({ length: 6 }, (_, member) => <g key={member} transform={`translate(${40 + member * 38} 163)`}><g style={{ '--member-index': member + i * 3 } as React.CSSProperties} className="cy-network-member"><circle r="15" fill="#183a50" stroke={network.color} strokeOpacity=".45" /><circle cy="-4" r="5" fill={network.color} /><path d="M-8 8q0-8 8-8t8 8" fill={network.color} /></g></g>)}
        <rect x="20" y="199" width="232" height="32" rx="16" fill="#163847" /><text x="136" y="220" textAnchor="middle" fill={network.color} fontSize="14">요청하고 · 응답하고 · 함께 지원</text>
    </g>)}
    {[186, 480, 774].map(x => <path key={x} className="cy-network-connection" d={`M${x} 322V341Q${x} 355 480 355V376`} pathLength="1" stroke="#79b7c6" strokeWidth="2" strokeDasharray="1" />)}
    <rect x="268" y="375" width="424" height="104" rx="18" fill="#0c2d3e" stroke="#548b9d" />
    <MotionSprite moduleId="partner-network" tile={0} x={279} y={380} width={110} height={89} />
    <text x="400" y="414" fill="#d5effa" fontSize="23" fontWeight="700">청연 지원센터</text><text x="400" y="443" fill="#9ec5d4" fontSize="15">공종 · 일정 · 가용팀을 함께 조율</text>
    <g className="cy-network-response"><circle cx="663" cy="396" r="5" fill="#9be1c6" /></g>
</g>;

const ChatScene = ({ id }: { id: string }) => <g className="cy-partner-scene cy-partner-chat-scene">
    <text x="49" y="35" fill="#93bad2" fontSize="12" letterSpacing="2">SUPPORT EXCHANGE / THREE CONNECTED CHANNELS</text><text x="910" y="35" textAnchor="end" fill="#7193ad" fontSize="11">지원 대화 연출 예시</text>
    {NETWORKS.map((network, channel) => <g key={network.id} data-chat-channel={network.id} transform={`translate(${50 + channel * 294} 61)`}>
        <defs><clipPath id={`${id}-chat-${network.id}`}><rect x="8" y="87" width="256" height="237" rx="6" /></clipPath></defs>
        <rect width="272" height="354" rx="16" fill="#0c2437" stroke={network.color} strokeOpacity=".6" />
        <g transform="translate(30 29) scale(.5)"><NetworkIcon index={channel} /></g><text x="55" y="35" fill={network.color} fontSize="19" fontWeight="700">{network.title}</text>
        <circle cx="248" cy="29" r="4" fill="#9be1c6" className="cy-chat-activity" />
        <rect x="12" y="53" width="248" height="25" rx="5" fill="#18364a" /><text x="136" y="70" textAnchor="middle" fill="#adc7d7" fontSize="12">지원 요청 · 지원 가능 · 팀 모집</text>
        <g clipPath={`url(#${id}-chat-${network.id})`}><g transform="translate(0 88)"><g className="cy-chat-scroll" style={{ '--channel-delay': `${channel * 180}ms` } as React.CSSProperties}>
            {PARTNER_CHATS[network.id].map((message, index) => {
                const type = CHAT_TYPES[message.kind];
                return <g key={message.sender} transform={`translate(12 ${index * 60})`} data-chat-kind={message.kind}>
                    <g className="cy-chat-message" style={{ '--message-delay': `${400 + index * 1220 + channel * 180}ms` } as React.CSSProperties}>
                        <rect width="248" height="53" rx="8" fill={type.background} stroke={type.color} strokeOpacity=".2" />
                        <rect x="9" y="9" width="53" height="15" rx="4" fill={type.color} fillOpacity=".15" /><text x="35" y="20" textAnchor="middle" fill={type.color} fontSize="10" fontWeight="700">{type.label}</text>
                        <text x="70" y="20" fill="#bbcfdd" fontSize="11">{message.sender}</text><text x="11" y="41" fill="#e5f0f7" fontSize="13">{message.text}</text>
                    </g>
                </g>;
            })}
        </g></g></g>
        <g className="cy-chat-typing" fill={network.color}><circle cx="21" cy="338" r="2" /><circle cx="29" cy="338" r="2" /><circle cx="37" cy="338" r="2" /><text x="47" y="342" fontSize="11">새로운 지원 메시지가 이어집니다</text></g>
    </g>)}
    {[186, 480, 774].map((x, i) => <g key={x}><path d={`M${x} 416V431H480V442`} stroke={NETWORKS[i].color} strokeOpacity=".4" strokeWidth="2" /><circle cx={x} cy="426" r="3" fill={NETWORKS[i].color} className="cy-chat-activity" /></g>)}
    <rect x="184" y="443" width="592" height="47" rx="14" fill="#14313f" stroke="#569693" />
    <text x="480" y="473" textAnchor="middle" fill="#c6e7e5" fontSize="19" fontWeight="700">청연 지원센터 · 요청과 회신을 모아 현장에 연결</text>
</g>;

const ExchangeScene = ({ step }: { step: number }) => {
    const outgoing = step === 2 || step === 4;
    const incoming = step === 3 || step === 4;
    return <g className={`cy-partner-scene cy-partner-exchange cy-partner-step-${step}`}>
        <text x="49" y="35" fill="#93bad2" fontSize="12" letterSpacing="2">MUTUAL SUPPORT / TEAMS IN BOTH DIRECTIONS</text><text x="910" y="35" textAnchor="end" fill="#7193ad" fontSize="11">상호 지원 흐름 예시</text>
        {NETWORKS.map((network, i) => <g key={network.id} transform={`translate(${50 + i * 294} 64)`}>
            <rect width="272" height="73" rx="13" fill="#102b3f" stroke={network.color} strokeOpacity=".5" /><g transform="translate(31 35) scale(.6)"><NetworkIcon index={i} /></g><text x="62" y="31" fill={network.color} fontSize="18" fontWeight="700">{network.title}</text><text x="62" y="56" fill="#aac5d6" fontSize="13">{network.activity}</text>
        </g>)}
        <path d="M186 137v18h294m294-18v18H480m0-18v20" stroke="#6b9cad" strokeOpacity=".7" strokeWidth="2" />
        <rect x="340" y="157" width="280" height="31" rx="15" fill="#173a4b" /><text x="480" y="178" textAnchor="middle" fill="#b7dce6" fontSize="15">청연 사무실 · 세 채널의 지원 일정 조율</text>
        <rect x="50" y="202" width="260" height="288" rx="18" fill="#0b2539b3" stroke="#49889f" /><rect x="650" y="202" width="260" height="288" rx="18" fill="#0b2539b3" stroke="#9b8052" />
        <text x="73" y="232" fill="#c9ecfa" fontSize="22" fontWeight="700">청연 현장</text><text x="674" y="232" fill="#f0dcb4" fontSize="22" fontWeight="700">협력사 현장</text>
        <MotionSprite moduleId="manpower-supply" tile={0} x={78} y={243} width={145} height={115} /><MotionSprite moduleId="system-dongbari-scaffolding" tile={1} x={752} y={243} width={129} height={115} />
        {outgoing && <g data-support-direction="outgoing">
            <title>청연 지원팀이 협력사 현장으로 지원 갑니다</title>
            <text x="480" y="302" textAnchor="middle" fill="#f1d49f" fontSize="17" fontWeight="700">지원 보내기 →</text>
            <path d="M213 382H747m-12-8 12 8-12 8" stroke="#8b724a" strokeWidth="2" /><path className="cy-support-route-out" d="M213 382H747" pathLength="1" stroke="#eaca8b" strokeWidth="3" strokeDasharray="1" />
            <g transform="translate(745 328)"><g className="cy-support-team-out"><MiniTeam incoming={false} /></g></g>
            <g className="cy-support-arrival-out"><rect x="382" y="344" width="196" height="28" rx="14" fill="#3b3528" /><text x="480" y="363" textAnchor="middle" fill="#f5dba6" fontSize="13">협력사 현장 지원 도착</text></g>
        </g>}
        {incoming && <g data-support-direction="incoming">
            <title>협력 지원팀이 청연 현장으로 지원 옵니다</title>
            <text x="480" y="407" textAnchor="middle" fill="#aae9d6" fontSize="17" fontWeight="700">← 지원 받기</text>
            <path d="M747 474H213m12-8-12 8 12 8" stroke="#426d67" strokeWidth="2" /><path className="cy-support-route-in" d="M747 474H213" pathLength="1" stroke="#8edfc6" strokeWidth="3" strokeDasharray="1" />
            <g transform="translate(215 418)"><g className="cy-support-team-in"><MiniTeam incoming /></g></g>
            <g className="cy-support-arrival-in"><rect x="382" y="440" width="196" height="28" rx="14" fill="#143d3c" /><text x="480" y="459" textAnchor="middle" fill="#b1f2dc" fontSize="13">청연 현장 지원 도착</text></g>
        </g>}
        {!incoming && <text x="480" y="456" textAnchor="middle" fill="#8caec1" fontSize="15">협력사에 인력이 필요하면, 청연팀이 함께합니다.</text>}
        {!outgoing && <text x="480" y="328" textAnchor="middle" fill="#8caec1" fontSize="15">청연 현장에 인력이 필요하면, 협력팀이 함께합니다.</text>}
    </g>;
};

export const PartnerNetworkDetails = ({ step }: { step: number }) => <div className="cy-partner-summary" role="group" aria-label="협력 네트워크와 상호 지원 방향">
    <div className="cy-partner-channels">{NETWORKS.map(network => <p key={network.id}><strong style={{ color: network.color }}>{network.title}</strong><span>{network.activity}</span></p>)}</div>
    <p><span className="cy-partner-out-label">지원 보내기 →</span> 청연팀이 협력사 현장으로</p><p><span className="cy-partner-in-label">← 지원 받기</span> 협력팀이 청연 현장으로</p>
    {step === 1 && <details className="cy-partner-chat-transcript"><summary>채팅 예시 펼쳐보기</summary><p>지원 흐름을 설명하기 위한 가상의 대화입니다.</p>{NETWORKS.map(network => <section key={network.id} aria-label={`${network.title} 채팅 예시`}><h5 style={{ color: network.color }}>{network.title}</h5><ol>{PARTNER_CHATS[network.id].map(message => <li key={message.sender}><span style={{ color: CHAT_TYPES[message.kind].color }}>{CHAT_TYPES[message.kind].label} · {message.sender}</span><p>{message.text}</p></li>)}</ol></section>)}</details>}
</div>;

export default function PartnerNetworkScene({ step, id }: { step: number; id: string }) { return step === 0 ? <ConnectionScene /> : step === 1 ? <ChatScene id={id} /> : <ExchangeScene step={step} />; }
