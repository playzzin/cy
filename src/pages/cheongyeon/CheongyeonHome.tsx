import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faPlay, faHelmetSafety, faChartLine, faNetworkWired, faRobot, faHandshake, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

// Firebase Storage URL for the logo video
// Note: If this URL doesn't work, please verify the exact path and token in your Firebase Console.
const logoVideo = 'https://firebasestorage.googleapis.com/v0/b/cyee-9c1e4.firebasestorage.app/o/logo_cy.mp4?alt=media';

const CheongyeonHome: React.FC = () => {
    // Removed isVideoOpen state as modal is no longer needed
    const [playCount, setPlayCount] = useState(0);
    const [isIntro, setIsIntro] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();

    const handleVideoEnded = () => {
        const nextCount = playCount + 1;
        setPlayCount(nextCount);

        if (nextCount === 1) {
            // End of 1st loop: Transition to main view (darken + show content)
            setIsIntro(false);
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
            }
        } else if (nextCount < 3) {
            // 2nd loop: Just replay
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
            }
        }
        // If nextCount === 3, do nothing (stops naturally at end)
    };

    const handleReplayIntro = () => {
        setIsIntro(true);
        setPlayCount(0);
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-900 overflow-x-hidden">
            {/* Modal functionality removed per user request */}

            {/* Video Background (Fixed) */}
            <div className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onEnded={handleVideoEnded}
                    className={`w-full h-full object-cover transition-opacity duration-1000 ${isIntro ? 'opacity-100' : 'opacity-50'}`}
                >
                    <source src={logoVideo} type="video/mp4" />
                    <img
                        src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop"
                        alt="Construction Site"
                        className="w-full h-full object-cover"
                    />
                </video>
                <div className={`absolute inset-0 bg-slate-900 transition-opacity duration-1000 ${isIntro ? 'opacity-0' : 'opacity-60'}`} />
                <div className={`absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/80 transition-opacity duration-1000 ${isIntro ? 'opacity-0' : 'opacity-100'}`} />
            </div>

            {/* 1. Hero Section (Full Screen) */}
            <div className={`relative z-10 flex flex-col justify-center min-h-screen px-8 max-w-[1800px] mx-auto pb-20 transition-all duration-1000 ${isIntro ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                <div className="max-w-4xl space-y-8 animate-slideUp">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 w-fit">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-400 text-sm font-medium tracking-wide uppercase">Total Construction ERP</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight font-display tracking-tight drop-shadow-2xl">
                        신뢰를 짓는 기술,<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600">
                            청연ENG
                        </span>
                    </h1>

                    <p className="text-xl text-slate-300 max-w-3xl leading-relaxed font-light break-keep">
                        동바리·비계 시공 전문업체로서 체계적인 ERP 시스템을 구축하여<br className="hidden md:block" />
                        건설사에는 <strong>실시간 공사 현황</strong>을, 근로자에게는 <strong>정직과 투명</strong>을 약속합니다.
                    </p>

                    <div className="flex flex-wrap items-center gap-6 pt-4">
                        <button className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold text-lg transition-all shadow-lg shadow-amber-500/30 flex items-center gap-3 group">
                            Get Started
                            <FontAwesomeIcon icon={faArrowRight} className="transition-transform group-hover:translate-x-1" />
                        </button>

                        <button
                            className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-full font-medium text-lg transition-all flex items-center gap-3 group"
                            onClick={handleReplayIntro}
                        >
                            <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-slate-900 transition-colors">
                                <FontAwesomeIcon icon={faPlay} className="text-sm pl-0.5" />
                            </span>
                            Watch Brand Video
                        </button>
                        <button
                            className="px-8 py-4 bg-transparent border border-amber-400/60 text-amber-200 rounded-full font-medium text-lg transition-all flex items-center gap-3 group hover:bg-amber-500/10 hover:text-amber-300"
                            onClick={() => navigate('/cheongyeon/organization')}
                        >
                            조직도 보기
                            <FontAwesomeIcon icon={faArrowRight} className="transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 animate-bounce">
                    <span className="text-xs text-white/50 tracking-widest uppercase">Scroll Down</span>
                    <div className="w-[1px] h-12 bg-gradient-to-b from-amber-500 to-transparent" />
                </div>
            </div>

            {/* 2. Feature Cards Section */}
            <div className="relative z-10 px-8 py-32 max-w-[1800px] mx-auto">
                <div className="mb-20">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Innovative <span className="text-amber-500">System</span></h2>
                    <div className="w-20 h-1 bg-amber-500 rounded-full mb-6"></div>
                    <p className="text-xl text-slate-400 max-w-2xl break-keep">
                        체계적인 관리 시스템과 투명한 운영으로 건설 문화를 선도합니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            icon: faNetworkWired,
                            title: '체계적인 ERP 구축',
                            desc: '자체 개발된 전사적 자원 관리(ERP) 시스템을 통해 인력, 자재, 비용 등 현장의 모든 요소를 데이터화하여 통합 관리합니다. 불필요한 누수를 막고 공정 효율을 극대화하여 스마트한 건설 환경을 조성합니다.',
                            color: 'from-amber-400 to-orange-500'
                        },
                        {
                            icon: faChartLine,
                            title: '실시간 현황 제공',
                            desc: '클라이언트에게 전용 대시보드를 통해 공정률, 투입 인력, 자재 현황을 실시간으로 투명하게 공유합니다. 데이터에 기반한 정확한 의사결정을 돕고, 현장 상황을 언제 어디서나 모니터링할 수 있는 신뢰 서비스를 제공합니다.',
                            color: 'from-blue-400 to-cyan-500'
                        },
                        {
                            icon: faHelmetSafety,
                            title: '투명한 상생 경영',
                            desc: '근로자의 노무비 지급 내역과 근태를 투명하게 공개하고 정직하게 정산하여, 현장 근로자와의 깊은 신뢰를 구축합니다. 모두가 만족하는 공정한 근로 문화를 정착시켜 장기적인 상생 파트너십을 실현합니다.',
                            color: 'from-emerald-400 to-green-500'
                        },
                        {
                            icon: faHandshake,
                            title: '광범위한 협력 네트워크',
                            desc: '다수의 전문 협력사 및 시공팀과 강력한 네트워크를 형성하여, 현장 규모와 특성에 맞는 최적의 숙련공을 즉시 배치합니다. 긴급한 공정 변경에도 유연하게 대처하며, 압도적인 기동력으로 빠르고 완벽한 시공을 약속합니다.',
                            color: 'from-purple-400 to-pink-500'
                        }
                    ].map((card, idx) => (
                        <div key={idx} className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                            {/* Graphic Blob */}
                            <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${card.color} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-2xl mb-6 shadow-lg`}>
                                <FontAwesomeIcon icon={card.icon} />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-3">{card.title}</h3>
                            <p className="text-slate-400 leading-relaxed mb-6 group-hover:text-slate-300 transition-colors">
                                {card.desc}
                            </p>

                            <div className="flex items-center gap-2 text-sm font-bold text-white/40 group-hover:text-amber-500 transition-colors cursor-pointer uppercase tracking-wider">
                                Learn More <FontAwesomeIcon icon={faArrowRight} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Stats (Moved to Footer area for continuity) */}
            <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-xl">
                <div className="max-w-[1800px] mx-auto px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        { label: 'Active Sites', value: '124' },
                        { label: 'Workers Today', value: '3,402' },
                        { label: 'Safety Index', value: '99.9%' },
                        { label: 'AI Detections', value: '24/7' },
                    ].map((stat, idx) => (
                        <div key={idx} className="flex flex-col items-center justify-center text-center p-4">
                            <span className="text-4xl font-bold text-white font-display mb-2">{stat.value}</span>
                            <span className="text-sm text-slate-400 uppercase tracking-widest">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CheongyeonHome;
