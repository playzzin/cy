import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faGlobe, faArrowLeft,
    faNetworkWired, faShieldHalved,
    faCode
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

const NationwideDashboardHome: React.FC = () => {
    const navigate = useNavigate();
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    // 시스템 설정에서 전국 로고 불러오기
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const { db } = await import('../../config/firebase');
                const { doc, getDoc } = await import('firebase/firestore');
                const docSnap = await getDoc(doc(db, 'settings', 'system_config'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setLogoUrl(data.nationLogoUrl || data.siteLogoUrl || null);
                }
            } catch (error) {
                console.error("Failed to load logo config:", error);
            }
        };
        loadConfig();
    }, []);

    return (
        <div className="relative min-h-[90vh] w-full flex flex-col items-center justify-center overflow-hidden bg-[#1e293b]">
            {/* 배경 조명 효과 */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(51,65,85,0)_0%,rgba(15,23,42,0.8)_100%)]" />
            </div>

            <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center">
                
                {/* 중앙 대형 로고 영역 */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, type: "spring" }}
                    className="mb-12 flex flex-col items-center"
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-32 md:h-48 w-auto object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" />
                    ) : (
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-900 rounded-3xl flex items-center justify-center border border-slate-600 shadow-2xl">
                                <FontAwesomeIcon icon={faGlobe} className="text-5xl text-blue-400" />
                            </div>
                            <span className="text-4xl font-black tracking-tighter text-white uppercase">Nationwide</span>
                        </div>
                    )}
                </motion.div>

                {/* 텍스트 정보 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-8 tracking-widest uppercase">
                        <FontAwesomeIcon icon={faCode} className="animate-pulse" />
                        Private Project in Progress
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-none">
                        최실장 부업용<br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-slate-100 to-indigo-400">
                            사이트 구축중
                        </span>
                    </h1>
                    
                    <p className="text-slate-400 text-lg mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                        전국시스템인력 소개소 자동화 생각중...<br/>
                        용돈벌이 할려고 하는데 모르겠슴아직... 이사장이 지원좀 해주면 하고 아니면 말구...
                    </p>
                </motion.div>

                {/* 프로그레스 영역 */}
                <div className="w-full max-w-md bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm mb-12">
                    <div className="flex justify-between items-end mb-3">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Build Status</span>
                        <span className="text-2xl font-black text-white tabular-nums">5<span className="text-sm text-blue-400">%</span></span>
                    </div>
                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "5%" }}
                            transition={{ duration: 2, delay: 0.8, ease: "circOut" }}
                            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 rounded-full relative"
                        >
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] w-20 animate-[shimmer_1.5s_infinite]" />
                        </motion.div>
                    </div>
                </div>

                {/* 액션 버튼 */}
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/dashboard')}
                    className="group relative px-10 py-5 bg-white text-slate-900 rounded-[24px] font-black text-lg transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:shadow-[0_25px_50px_rgba(255,255,255,0.15)] flex items-center gap-4"
                >
                    <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </div>
                    메인으로 돌아가기
                </motion.button>
            </div>

            {/* 하단 정보 데코레이션 */}
            <div className="absolute bottom-10 left-10 flex gap-10 text-slate-600 z-10 hidden lg:flex">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faShieldHalved} />
                    <span className="text-[10px] font-bold tracking-widest uppercase">Secure Build</span>
                </div>
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faNetworkWired} />
                    <span className="text-[10px] font-bold tracking-widest uppercase">V2 Architecture</span>
                </div>
            </div>

            <style>{`
                @keyframes shimmer { 
                    0% { transform: translateX(-100%); } 
                    100% { transform: translateX(400%); } 
                }
            `}</style>
        </div>
    );
};

export default NationwideDashboardHome;
