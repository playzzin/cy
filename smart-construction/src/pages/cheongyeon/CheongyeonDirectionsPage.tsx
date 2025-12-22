import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faLocationDot, faTrainSubway, faBus, faCarSide, faRoute } from '@fortawesome/free-solid-svg-icons';

declare global {
    interface Window {
        kakao?: {
            maps: {
                LatLng: new (lat: number, lng: number) => any;
                Map: new (container: HTMLElement, options: { center: any; level: number }) => any;
                MapTypeId: { ROADMAP: any };
                Marker: new (options: { position: any }) => any;
                Circle: new (options: { center: any; radius: number; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string; fillColor: string; fillOpacity: number }) => any;
                load: (callback: () => void) => void;
            };
        };
    }
}

const CHEONGYEON_LAT = 37.3070126;
const CHEONGYEON_LNG = 126.8479892;

const KakaoMapView: React.FC = () => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const appKey = process.env.REACT_APP_KAKAO_MAP_KEY;
        if (!appKey) {
            setLoadError('Kakao 지도 API 키(REACT_APP_KAKAO_MAP_KEY)가 설정되어 있지 않습니다.');
            return;
        }

        if (!mapRef.current) return;

        const existingScript = document.querySelector<HTMLScriptElement>('script[data-kakao-maps-sdk="true"]');

        const initializeMap = () => {
            if (!window.kakao || !window.kakao.maps || !mapRef.current) return;

            window.kakao.maps.load(() => {
                if (!mapRef.current) return;

                const center = new window.kakao!.maps.LatLng(CHEONGYEON_LAT, CHEONGYEON_LNG);
                const map = new window.kakao!.maps.Map(mapRef.current, {
                    center,
                    level: 4,
                });

                const marker = new window.kakao!.maps.Marker({ position: center });
                marker.setMap(map);

                const circle = new window.kakao!.maps.Circle({
                    center,
                    radius: 120,
                    strokeWeight: 3,
                    strokeColor: '#22c55e',
                    strokeOpacity: 0.8,
                    strokeStyle: 'solid',
                    fillColor: '#22c55e',
                    fillOpacity: 0.12,
                });
                circle.setMap(map);

                setIsLoaded(true);
            });
        };

        if (existingScript) {
            if (window.kakao && window.kakao.maps) {
                initializeMap();
            } else {
                existingScript.addEventListener('load', initializeMap);
            }
            return;
        }

        const script = document.createElement('script');
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
        script.async = true;
        script.defer = true;
        script.dataset.kakaoMapsSdk = 'true';
        script.onload = initializeMap;
        script.onerror = () => {
            setLoadError('Kakao 지도를 불러오는 중 오류가 발생했습니다.');
        };
        document.head.appendChild(script);

        return () => {
            script.onload = null;
            script.onerror = null;
        };
    }, []);

    return (
        <div className="relative h-64 md:h-72 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/80">
            <div ref={mapRef} className="w-full h-full" />
            {!isLoaded && !loadError && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500 bg-slate-950/40 backdrop-blur-sm">
                    카카오 지도를 불러오는 중입니다...
                </div>
            )}
            {loadError && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-rose-300 bg-slate-950/50 backdrop-blur-sm px-4 text-center">
                    {loadError}
                </div>
            )}
        </div>
    );
};

const CheongyeonDirectionsPage: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-50">
            <style>{`
                .cheongyeon-route-hero {
                    position: relative;
                    overflow: hidden;
                }
                .cheongyeon-route-hero::before {
                    content: '';
                    position: absolute;
                    inset: -40%;
                    background:
                        radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.2), transparent 55%),
                        radial-gradient(circle at 100% 100%, rgba(52, 211, 153, 0.15), transparent 55%);
                    mix-blend-mode: screen;
                    opacity: 0.7;
                    pointer-events: none;
                }
                .cheongyeon-route-grid {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
                    background-size: 32px 32px;
                    opacity: 0.5;
                    mask-image: radial-gradient(circle at center, black 0%, transparent 70%);
                }
                .cheongyeon-route-grid-inner {
                    position: absolute;
                    inset: 10%;
                    border-radius: 1.5rem;
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    box-shadow: 0 0 40px rgba(15, 23, 42, 0.9);
                    overflow: hidden;
                    background: radial-gradient(circle at top, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.98));
                    transform-origin: center;
                    animation: cheongyeonCamera 18s ease-in-out infinite;
                }
                .cheongyeon-route-svg {
                    width: 100%;
                    height: 100%;
                }
                .route-path-base {
                    stroke: rgba(30, 64, 175, 0.6);
                    stroke-width: 7;
                    fill: none;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }
                .route-secondary {
                    stroke: rgba(30, 64, 175, 0.35);
                    stroke-width: 2;
                    fill: none;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-dasharray: 4 10;
                    opacity: 0.5;
                }
                .route-block {
                    fill: rgba(30, 41, 59, 0.9);
                    stroke: rgba(15, 23, 42, 0.95);
                    stroke-width: 1;
                }
                .route-path-animated {
                    stroke: url(#routeGradient);
                    stroke-width: 4;
                    fill: none;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-dasharray: 520;
                    stroke-dashoffset: 520;
                    animation: cheongyeonDrawRoute 18s ease-in-out infinite;
                }
                .route-marker {
                    position: absolute;
                    inset: 10%;
                    width: auto;
                    height: auto;
                    pointer-events: none;
                    offset-path: path('M40 220 Q80 200 120 180 Q160 160 200 140 Q240 115 280 90 Q310 75 340 60');
                    offset-distance: 0%;
                    animation: cheongyeonMoveMarker 18s ease-in-out infinite;
                }
                .route-marker-dot {
                    width: 16px;
                    height: 16px;
                    border-radius: 999px;
                    background: radial-gradient(circle at 30% 30%, #22c55e, #0f766e);
                    box-shadow: 0 0 16px rgba(34, 197, 94, 0.8);
                    border: 2px solid rgba(15, 23, 42, 0.9);
                }
                .route-destination-pulse {
                    animation: cheongyeonDestinationPulse 2.8s ease-in-out infinite;
                }
                .cheongyeon-step-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 999px;
                    background-color: rgba(148, 163, 184, 0.7);
                    box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.0);
                    animation: cheongyeonStepPulse 18s linear infinite;
                }
                .cheongyeon-step-1 { animation-delay: 0s; }
                .cheongyeon-step-2 { animation-delay: -4.5s; }
                .cheongyeon-step-3 { animation-delay: -9s; }
                .cheongyeon-step-4 { animation-delay: -13.5s; }
                @keyframes cheongyeonDrawRoute {
                    0% { stroke-dashoffset: 520; opacity: 0; }
                    8% { opacity: 1; }
                    22% { stroke-dashoffset: 0; opacity: 1; }
                    78% { stroke-dashoffset: 0; opacity: 1; }
                    100% { stroke-dashoffset: 520; opacity: 0; }
                }
                @keyframes cheongyeonMoveMarker {
                    0% { offset-distance: 0%; opacity: 0; }
                    8% { opacity: 1; }
                    30% { offset-distance: 100%; opacity: 1; }
                    80% { offset-distance: 100%; opacity: 1; }
                    100% { offset-distance: 0%; opacity: 0; }
                }
                @keyframes cheongyeonDestinationPulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.12); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.6; }
                }
                @keyframes cheongyeonCamera {
                    0% { transform: translateY(6px) scale(0.96); }
                    25% { transform: translateY(0px) scale(1); }
                    50% { transform: translate(-6px, -4px) scale(1.04); }
                    75% { transform: translate(2px, 2px) scale(1.02); }
                    100% { transform: translateY(6px) scale(0.96); }
                }
                @keyframes cheongyeonStepPulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.0); background-color: rgba(148, 163, 184, 0.7); }
                    5% { transform: scale(1.25); box-shadow: 0 0 0 6px rgba(45, 212, 191, 0.18); background-color: rgba(45, 212, 191, 0.95); }
                    12% { transform: scale(1.08); box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.0); }
                    30% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.0); background-color: rgba(148, 163, 184, 0.7); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.0); background-color: rgba(148, 163, 184, 0.7); }
                }
            `}</style>

            {/* Header */}
            <div className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Cheongyeon Site
                        </div>
                        <h1 className="text-lg md:text-xl font-semibold text-slate-50 flex items-center gap-2">
                            회사소개 · 오시는 길
                        </h1>
                        <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
                            경기도 안산시 상록구 광덕1로 341, 청연이엔지 5층까지의 여정을 한 번에 그려보았습니다. 지도를 보는 느낌이 아니라, 직접 길을 따라 걸어가는 느낌에 가깝게 표현했습니다.
                        </p>
                    </div>
                    <div className="hidden md:flex flex-col items-end text-[11px] text-slate-400">
                        <span>청연ENG · 찾아오시는 길 안내</span>
                        <span className="text-slate-500">Route · Station · Landmark</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto px-6 py-8 md:py-10 space-y-8 md:space-y-10">
                    <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 md:gap-8">
                        {/* Animated Route Card */}
                        <div className="cheongyeon-route-hero rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 shadow-[0_18px_60px_rgba(15,23,42,0.9)] min-h-[320px] md:min-h-[380px]">
                            <div className="cheongyeon-route-grid" />
                            <div className="cheongyeon-route-grid-inner">
                                <svg
                                    className="cheongyeon-route-svg"
                                    viewBox="0 0 400 260"
                                    preserveAspectRatio="xMidYMid meet"
                                >
                                    <defs>
                                        <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#22c55e" />
                                            <stop offset="60%" stopColor="#22d3ee" />
                                            <stop offset="100%" stopColor="#a855f7" />
                                        </linearGradient>
                                    </defs>

                                    {/* Building blocks / 주변 블록 표현 */}
                                    <g opacity={0.8}>
                                        <rect x={50} y={40} width={44} height={28} className="route-block" rx={4} />
                                        <rect x={110} y={48} width={52} height={32} className="route-block" rx={5} />
                                        <rect x={190} y={52} width={56} height={30} className="route-block" rx={5} />
                                        <rect x={260} y={40} width={46} height={26} className="route-block" rx={4} />
                                        <rect x={70} y={160} width={50} height={32} className="route-block" rx={5} />
                                        <rect x={150} y={170} width={60} height={34} className="route-block" rx={6} />
                                        <rect x={230} y={150} width={52} height={30} className="route-block" rx={5} />
                                    </g>

                                    {/* Secondary roads / 보조 도로 */}
                                    <path
                                        d="M30 210 Q90 190 150 170 Q210 150 270 120"
                                        className="route-secondary"
                                    />
                                    <path
                                        d="M90 230 Q150 210 210 190 Q270 165 320 140"
                                        className="route-secondary"
                                    />

                                    {/* Base route path (메인 이동 경로) */}
                                    <path
                                        d="M40 220 Q80 200 120 180 Q160 160 200 140 Q240 115 280 90 Q310 75 340 60"
                                        className="route-path-base"
                                    />

                                    {/* Animated bright route */}
                                    <path
                                        d="M40 220 Q80 200 120 180 Q160 160 200 140 Q240 115 280 90 Q310 75 340 60"
                                        className="route-path-animated"
                                    />

                                    {/* Start point (수도권/출발지) */}
                                    <g transform="translate(40, 220)">
                                        <circle r={9} fill="rgba(148,163,184,0.2)" />
                                        <circle r={4} fill="#38bdf8" />
                                        <text
                                            x={-2}
                                            y={-16}
                                            textAnchor="start"
                                            fontSize={10}
                                            fill="rgba(148,163,184,0.9)"
                                        >
                                            출발
                                        </text>
                                    </g>

                                    {/* 중간 노드들: 안산 / 상록구 / 광덕1로 */}
                                    <g transform="translate(120, 180)">
                                        <circle r={7} fill="rgba(56,189,248,0.08)" />
                                        <circle r={3} fill="#38bdf8" />
                                        <text
                                            x={4}
                                            y={-12}
                                            textAnchor="start"
                                            fontSize={10}
                                            fill="rgba(148,163,184,0.95)"
                                        >
                                            안산
                                        </text>
                                    </g>

                                    <g transform="translate(200, 140)">
                                        <circle r={7} fill="rgba(52,211,153,0.09)" />
                                        <circle r={3} fill="#22c55e" />
                                        <text
                                            x={4}
                                            y={-12}
                                            textAnchor="start"
                                            fontSize={10}
                                            fill="rgba(148,163,184,0.95)"
                                        >
                                            상록구
                                        </text>
                                    </g>

                                    <g transform="translate(280, 90)">
                                        <circle r={7} fill="rgba(56,189,248,0.08)" />
                                        <circle r={3} fill="#22c55e" />
                                        <text
                                            x={4}
                                            y={-12}
                                            textAnchor="start"
                                            fontSize={10}
                                            fill="rgba(148,163,184,0.95)"
                                        >
                                            광덕1로
                                        </text>
                                    </g>

                                    {/* Destination: 청연이엔지 5층 */}
                                    <g transform="translate(340, 60)" className="route-destination-pulse">
                                        <circle r={14} fill="rgba(34,197,94,0.16)" />
                                        <circle r={9} fill="rgba(5,150,105,0.9)" />
                                        <text
                                            x={-40}
                                            y={-24}
                                            textAnchor="start"
                                            fontSize={10}
                                            fill="rgba(148,163,184,0.95)"
                                        >
                                            청연이엔지 5층
                                        </text>
                                        <text
                                            x={-40}
                                            y={-10}
                                            textAnchor="start"
                                            fontSize={9}
                                            fill="rgba(148,163,184,0.7)"
                                        >
                                            상록구 광덕1로 341
                                        </text>
                                        <foreignObject x={-10} y={-10} width={20} height={20}>
                                            <div className="w-5 h-5 rounded-lg bg-emerald-400/90 flex items-center justify-center text-[10px] text-emerald-950 shadow-md">
                                                <FontAwesomeIcon icon={faBuilding} />
                                            </div>
                                        </foreignObject>
                                    </g>
                                </svg>

                                {/* Moving marker (나의 위치) */}
                                <div className="route-marker">
                                    <div className="route-marker-dot" />
                                </div>
                            </div>
                        </div>

                        {/* Text Directions */}
                        <div className="flex flex-col gap-5">
                            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 md:p-6 shadow-[0_14px_45px_rgba(15,23,42,0.9)] space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                                        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-xs">
                                            <FontAwesomeIcon icon={faLocationDot} />
                                        </span>
                                        회사 주소
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                                        <FontAwesomeIcon icon={faRoute} />
                                        <span>Route Journey · 18s</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <p className="text-slate-100 font-medium">
                                        경기도 안산시 상록구 광덕1로 341, 청연이엔지 5층
                                    </p>
                                    <p className="text-[13px] text-slate-400">
                                        지도 한 번 크게 보는 대신, "어디서부터 어떻게 이동하는지"를 한 번에 그려 볼 수 있도록 경로를 시각화했습니다.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                                    <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-[10px]">
                                        <FontAwesomeIcon icon={faLocationDot} />
                                    </span>
                                    카카오맵으로 보기
                                </div>
                                <KakaoMapView />
                                <p className="text-[11px] text-slate-500">
                                    * 카카오 지도의 실제 타일 위에서 위치를 확인할 수 있습니다. API 키(REACT_APP_KAKAO_MAP_KEY)가 설정되어 있어야 지도가 정상적으로 표시됩니다.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                                    <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-[10px]">
                                        <FontAwesomeIcon icon={faRoute} />
                                    </span>
                                    여정 단계 안내
                                </div>
                                <div className="space-y-2 text-[12px] text-slate-300">
                                    <div className="flex items-start gap-2 cheongyeon-step-item cheongyeon-step-1">
                                        <span className="cheongyeon-step-dot mt-[3px]" />
                                        <div>
                                            <div className="font-medium text-slate-100">수도권 출발 → 안산 진입</div>
                                            <div className="text-[11px] text-slate-400">출발지에서 서해안 방향으로 이동하며, 안산 시내로 진입하는 구간입니다.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 cheongyeon-step-item cheongyeon-step-2">
                                        <span className="cheongyeon-step-dot mt-[3px]" />
                                        <div>
                                            <div className="font-medium text-slate-100">안산 시내 → 상록구</div>
                                            <div className="text-[11px] text-slate-400">시내로 들어오신 뒤 상록구 방면 도로를 따라 북쪽으로 올라오는 구간입니다.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 cheongyeon-step-item cheongyeon-step-3">
                                        <span className="cheongyeon-step-dot mt-[3px]" />
                                        <div>
                                            <div className="font-medium text-slate-100">상록구 중심 → 광덕1로</div>
                                            <div className="text-[11px] text-slate-400">상록구 중심부에서 광덕1로 축을 따라 직선으로 진입하는 주요 구간입니다.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 cheongyeon-step-item cheongyeon-step-4">
                                        <span className="cheongyeon-step-dot mt-[3px]" />
                                        <div>
                                            <div className="font-medium text-slate-100">광덕1로 따라 이동 → 청연이엔지 5층 도착</div>
                                            <div className="text-[11px] text-slate-400">광덕1로를 따라 도로변 건물에 도착한 뒤, 엘리베이터를 이용해 5층 청연이엔지 사무실로 올라오시면 됩니다.</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                                        <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 text-[10px]">
                                            <FontAwesomeIcon icon={faTrainSubway} />
                                        </span>
                                        대중교통 접근
                                    </div>
                                    <p className="text-[12px] text-slate-300 leading-relaxed">
                                        수도권 전철 및 버스를 이용해 안산 방면으로 이동하신 뒤,
                                        상록구 중심 방면 정류장에서 하차하시면 됩니다.
                                        마지막 구간은 도보로 광덕1로를 따라 올라오시면,
                                        도로변에 위치한 건물 5층에서 청연이엔지를 찾으실 수 있습니다.
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        * 실제 노선/정류장은 사용하는 노선에 따라 달라질 수 있으니, 네이버/카카오 지도에서 "청연이엔지"를 검색해 최신 경로를 함께 확인해 주세요.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                                        <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-[10px]">
                                            <FontAwesomeIcon icon={faCarSide} />
                                        </span>
                                        차량 이용 시
                                    </div>
                                    <p className="text-[12px] text-slate-300 leading-relaxed">
                                        내비게이션에서는
                                        <span className="text-emerald-300 font-medium"> "경기도 안산시 상록구 광덕1로 341"</span>
                                        주소를 입력해 주시면 됩니다.
                                        광덕1로를 따라 진행하시다 보면 도로변에 위치한 건물에 도착하게 되며,
                                        건물 5층으로 올라오시면 청연이엔지가 있습니다.
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        * 주차 여건은 방문 목적과 시간대에 따라 상이할 수 있으니, 방문 전 사전에 문의해 주시면 더 정확히 안내해 드리겠습니다.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                                        <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-[10px]">
                                            <FontAwesomeIcon icon={faBuilding} />
                                        </span>
                                        도착 후 안내
                                    </div>
                                    <p className="text-[12px] text-slate-300 leading-relaxed max-w-xl">
                                        건물 1층 출입구로 들어오신 뒤, 엘리베이터를 이용해 5층으로 올라오시면 됩니다.
                                        출입에 어려움이 있으시면, 5층 청연이엔지 사무실로 연락 주시면 직접 안내드리겠습니다.
                                    </p>
                                </div>
                                <div className="text-[11px] text-slate-500 md:text-right">
                                    ㆍ주소 : 경기도 안산시 상록구 광덕1로 341, 청연이엔지 5층
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default CheongyeonDirectionsPage;
