import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faLocationDot, faTrainSubway, faCarSide, faRoute, faCopy } from '@fortawesome/free-solid-svg-icons';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { companyService } from '../../services/companyService';

const OFFICE_ADDRESS = '경기도 안산시 단원구 초지로 116, 미강프라자 306호';
const DEST_NAME = '미강프라자 306호';
const DEST_LAT = 37.3090255;
const DEST_LNG = 126.8152519;
const GOOGLE_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(OFFICE_ADDRESS)}&output=embed`;
const NAVER_WEB_URL = `https://map.naver.com/p/search/${encodeURIComponent(OFFICE_ADDRESS)}`;
const KAKAO_WEB_URL = `https://map.kakao.com/link/search/${encodeURIComponent(OFFICE_ADDRESS)}`;
const TMAP_WEB_URL = 'https://www.tmap.co.kr/';

const KAKAO_NAVI_DEEPLINK = `kakaonavi://navigate?name=${encodeURIComponent(DEST_NAME)}&x=${DEST_LNG}&y=${DEST_LAT}&coord_type=wgs84`;
const TMAP_DEEPLINK = `tmap://route?goalx=${DEST_LNG}&goaly=${DEST_LAT}&goalname=${encodeURIComponent(DEST_NAME)}&coordType=WGS84GEO`;
const NAVER_NAVI_DEEPLINK = `nmap://route/car?dlat=${DEST_LAT}&dlng=${DEST_LNG}&dname=${encodeURIComponent(DEST_NAME)}&appname=cy.erp`;

const GoogleMapEmbed: React.FC = () => (
    <div className="relative h-80 md:h-[460px] rounded-2xl overflow-hidden border border-slate-700 bg-slate-900/85">
        <iframe
            title="청연ENG 오시는길 구글지도"
            src={GOOGLE_EMBED_URL}
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
        />
    </div>
);

const CheongyeonDirectionsPage: React.FC = () => {
    const { isDarkMode } = useSiteMode();
    const [companyPhone, setCompanyPhone] = useState('대표번호 확인중...');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const myCompany = await companyService.getMyCompanyInfo();
                const phone = myCompany?.phone?.trim();
                if (!mounted) return;
                setCompanyPhone(phone && phone.length > 0 ? phone : '대표번호 등록 필요');
            } catch {
                if (mounted) setCompanyPhone('대표번호 등록 필요');
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const openNavigation = (deepLink: string, fallbackUrl: string) => {
        const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

        if (!isMobile) {
            window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        let moved = false;
        const onVisibility = () => {
            if (document.hidden) moved = true;
        };

        document.addEventListener('visibilitychange', onVisibility, { once: true });
        window.location.href = deepLink;

        window.setTimeout(() => {
            if (!moved) {
                window.location.href = fallbackUrl;
            }
        }, 1400);
    };

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(OFFICE_ADDRESS);
            window.alert('주소가 복사되었습니다.');
        } catch {
            window.alert('주소 복사에 실패했습니다.');
        }
    };

    return (
        <div className={`flex flex-col h-full ${isDarkMode ? 'bg-slate-950 text-slate-50' : 'bg-white text-slate-900'}`}>
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
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-50 flex items-center gap-2">
                            회사소개 · 오시는 길
                        </h1>
                        <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                            경기도 안산시 단원구 초지로 116, 미강프라자 306호까지의 동선을 정확한 주소 기준으로 안내합니다. 내비게이션, 대중교통, 도보 연결까지 한 화면에서 바로 확인할 수 있습니다.
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
                <div className="w-full px-6 lg:px-10 py-8 md:py-10 space-y-8 md:space-y-10">
                    <section className="space-y-5">
                        <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 md:p-8 shadow-[0_18px_55px_rgba(15,23,42,0.9)] space-y-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-base font-bold text-slate-50">
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
                                <div className="space-y-2 text-base">
                                    <p className="text-slate-100 font-semibold text-lg">
                                        {OFFICE_ADDRESS}
                                    </p>
                                    <p className="text-sm md:text-base text-slate-300 leading-relaxed">
                                        방문 전 지도앱에서 "경기도 안산시 단원구 초지로 116"을 검색하시면 가장 정확한 현재 교통 상황 기준 안내를 받으실 수 있습니다.
                                    </p>
                                    <p className="text-sm md:text-base text-emerald-300 font-semibold">
                                        대표번호 : {companyPhone}
                                    </p>
                                </div>
                                <div className="pt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCopyAddress}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-500 bg-slate-800 px-3 py-2.5 text-[13px] font-bold text-slate-100 hover:bg-slate-700 transition-colors"
                                        >
                                            <FontAwesomeIcon icon={faCopy} />
                                            주소 복사
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openNavigation(KAKAO_NAVI_DEEPLINK, KAKAO_WEB_URL)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-400 bg-yellow-400 px-3 py-2.5 text-[13px] font-extrabold text-slate-950 hover:bg-yellow-300 transition-colors"
                                        >
                                            카카오내비
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openNavigation(TMAP_DEEPLINK, TMAP_WEB_URL)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400 bg-emerald-500 px-3 py-2.5 text-[13px] font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors"
                                        >
                                            TMAP
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openNavigation(NAVER_NAVI_DEEPLINK, NAVER_WEB_URL)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400 bg-sky-500 px-3 py-2.5 text-[13px] font-extrabold text-slate-950 hover:bg-sky-400 transition-colors"
                                        >
                                            네이버지도/내비
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 md:p-6 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                                    <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 text-[10px]">
                                        <FontAwesomeIcon icon={faLocationDot} />
                                    </span>
                                    구글 지도 약도
                                </div>
                                <GoogleMapEmbed />
                                <p className="text-[11px] text-slate-500">
                                    * 지도 로딩이 늦을 경우 잠시 후 다시 표시됩니다.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-6 md:p-7 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                                        <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 text-[10px]">
                                            <FontAwesomeIcon icon={faTrainSubway} />
                                        </span>
                                        대중교통 접근
                                    </div>
                                    <p className="text-sm md:text-base text-slate-200 leading-relaxed">
                                        주변역은 <span className="text-sky-300 font-medium">초지역(4호선/서해선)</span>,
                                        <span className="text-sky-300 font-medium"> 고잔역(4호선/수인분당선)</span> 이용 후 버스 환승이 편리합니다.
                                        인근 버스 정류장은 초지역/단원구청 권역을 이용하시면 접근이 빠르며,
                                        확인 가능한 정류장 번호 예시는 <span className="text-sky-300 font-medium">메트로단지(18181)</span>입니다.
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        * 정류장 ARS 번호는 개편/이설로 변경될 수 있어, 출발 직전 경기버스정보(GBIS)에서 "초지로 116" 또는 정류장명으로 재확인해 주세요.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-6 md:p-7 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                                        <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-[10px]">
                                            <FontAwesomeIcon icon={faCarSide} />
                                        </span>
                                        차량 이용 시
                                    </div>
                                    <p className="text-sm md:text-base text-slate-200 leading-relaxed">
                                        내비게이션에서는
                                        <span className="text-emerald-300 font-medium"> "{OFFICE_ADDRESS}"</span>
                                        주소를 입력해 주시면 됩니다. 미강프라자 도착 후
                                        <span className="text-amber-300 font-medium"> 지하주차장을 이용</span>하시면 됩니다.
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        * 주차 후 건물 내부 동선으로 306호까지 이동하시면 됩니다.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                        <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-[10px]">
                                            <FontAwesomeIcon icon={faBuilding} />
                                        </span>
                                        도착 후 안내
                                    </div>
                                    <p className="text-sm md:text-base text-slate-200 leading-relaxed max-w-xl">
                                        미강프라자 건물 진입 후 306호로 이동하시면 됩니다.
                                        출입에 어려움이 있으시면 방문 전에 연락 주시면 빠르게 안내드리겠습니다.
                                    </p>
                                </div>
                                <div className="text-sm text-slate-300 md:text-right font-semibold">
                                    ㆍ주소 : {OFFICE_ADDRESS}
                                    <br />
                                    ㆍ대표번호 : {companyPhone}
                                </div>
                            </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default CheongyeonDirectionsPage;
