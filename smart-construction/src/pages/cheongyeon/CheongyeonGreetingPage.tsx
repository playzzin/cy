import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faQuoteLeft,
    faHandshake,
    faShieldHalved,
    faHardHat,
    faBuilding,
    faAward,
    faUsers,
    faCheck,
    faPhone,
    faEnvelope,
    faMapMarkerAlt,
    faStar,
    faRocket
} from '@fortawesome/free-solid-svg-icons';
import { motion } from 'framer-motion';
import ceoCharacter from '../../assets/ceo_character.png';

const CheongyeonGreetingPage: React.FC = () => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: 'spring' as const, stiffness: 100, damping: 12 }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
            {/* Unicorn Studio Background */}
            <div className="fixed inset-0 z-0">
                <iframe
                    src="https://www.unicorn.studio/embed/KmzUSKuMzQYJD0VFBPSC?scale=1&dpi=1.5"
                    title="Unicorn Studio Background"
                    className="w-full h-full border-0"
                    style={{ pointerEvents: 'none' }}
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/60 to-slate-950/90" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {/* Hero Section */}
                <div className="min-h-screen flex items-center justify-center px-6 py-20">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        className="max-w-6xl mx-auto"
                    >
                        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-center">
                            {/* CEO Character */}
                            <motion.div
                                initial={{ opacity: 0, x: -50, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                transition={{ duration: 0.8, delay: 0.3 }}
                                className="lg:col-span-2 flex justify-center"
                            >
                                <div className="relative">
                                    {/* Glow Effect */}
                                    <div className="absolute inset-0 blur-3xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 rounded-full scale-110" />
                                    <div className="relative">
                                        <img
                                            src={ceoCharacter}
                                            alt="이재욱 대표"
                                            className="w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 object-contain drop-shadow-2xl"
                                        />
                                        {/* Name Badge */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.8 }}
                                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-emerald-500/30 shadow-xl"
                                        >
                                            <div className="text-center">
                                                <div className="text-xs text-emerald-400 font-medium tracking-wider">CEO</div>
                                                <div className="text-xl font-bold tracking-widest">이 재 욱</div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Greeting Message */}
                            <motion.div
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.8, delay: 0.5 }}
                                className="lg:col-span-3 space-y-6"
                            >
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    청연이엔지 대표 인사말
                                </div>

                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400">
                                        신뢰
                                    </span>와{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                                        기술
                                    </span>로
                                    <br />
                                    건설의 미래를 열다
                                </h1>

                                <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">
                                    안녕하십니까. 청연이엔지 대표 이재욱입니다.
                                    저희는 <span className="text-emerald-400 font-medium">"정직한 시공, 신뢰의 품질"</span>이라는
                                    철학을 바탕으로 고객과 함께 성장하는 기업이 되고자 합니다.
                                </p>

                                <div className="flex flex-wrap gap-4 pt-4">
                                    <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <div className="text-2xl font-bold text-emerald-400">10+</div>
                                        <div className="text-xs text-slate-400">Years Experience</div>
                                    </div>
                                    <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <div className="text-2xl font-bold text-cyan-400">100+</div>
                                        <div className="text-xs text-slate-400">Projects Done</div>
                                    </div>
                                    <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <div className="text-2xl font-bold text-blue-400">99%</div>
                                        <div className="text-xs text-slate-400">Satisfaction</div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>

                {/* Bento Grid Section */}
                <div className="px-6 py-16 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950">
                    <div className="max-w-6xl mx-auto">
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.2 }}
                            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
                        >
                            {/* Main Message Card - Wide */}
                            <motion.div
                                variants={itemVariants}
                                className="col-span-2 md:col-span-4 lg:col-span-4 row-span-2 rounded-3xl p-8 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl"
                            >
                                <FontAwesomeIcon icon={faQuoteLeft} className="text-3xl text-emerald-500/40 mb-6" />
                                <div className="space-y-4 text-slate-300 leading-relaxed">
                                    <p className="text-lg">
                                        저희 청연이엔지에 보내주시는 <span className="text-white font-semibold">관심과 성원</span>에
                                        깊은 감사를 드립니다.
                                    </p>
                                    <p>
                                        청연이엔지는 단순히 건물을 짓는 것에 그치지 않고, 고객의 꿈과 비전을 실현하는 파트너가 되고자 합니다.
                                        현장의 안전을 최우선으로 생각하며, 모든 프로젝트에서 정확한 공정 관리와 투명한 운영을 실천합니다.
                                    </p>
                                    <p>
                                        앞으로도 <span className="text-emerald-400 font-medium">혁신적인 기술</span>과
                                        축적된 노하우를 바탕으로 건설업계의 모범이 되는 기업으로 성장해 나가겠습니다.
                                    </p>
                                </div>
                                <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                                    <div className="text-right">
                                        <div className="text-sm text-slate-500">청연이엔지 대표이사</div>
                                        <div className="text-2xl font-bold text-white tracking-wider">이 재 욱</div>
                                    </div>
                                    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                                        <span className="text-xs text-emerald-400">SIGN</span>
                                        <div className="text-lg italic text-emerald-300">이재욱</div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Vision */}
                            <motion.div
                                variants={itemVariants}
                                className="col-span-1 md:col-span-2 lg:col-span-2 rounded-3xl p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-xl shadow-emerald-500/20"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                                    <FontAwesomeIcon icon={faRocket} className="text-2xl text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">비전</h3>
                                <p className="text-emerald-100 text-sm">대한민국 대표 시공 전문기업</p>
                            </motion.div>

                            {/* Mission */}
                            <motion.div
                                variants={itemVariants}
                                className="col-span-1 md:col-span-2 lg:col-span-2 rounded-3xl p-6 bg-gradient-to-br from-cyan-600 to-blue-600 shadow-xl shadow-cyan-500/20"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                                    <FontAwesomeIcon icon={faStar} className="text-2xl text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">미션</h3>
                                <p className="text-cyan-100 text-sm">안전과 품질을 최우선 가치로</p>
                            </motion.div>

                            {/* Core Values Grid */}
                            <motion.div
                                variants={itemVariants}
                                className="col-span-2 md:col-span-4 lg:col-span-3 rounded-3xl p-6 bg-slate-800/60 backdrop-blur-xl border border-white/10"
                            >
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <FontAwesomeIcon icon={faShieldHalved} />
                                    </span>
                                    경영 철학
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { icon: faShieldHalved, title: '안전제일', color: 'emerald' },
                                        { icon: faAward, title: '품질보증', color: 'cyan' },
                                        { icon: faHandshake, title: '신뢰경영', color: 'blue' },
                                        { icon: faHardHat, title: '현장중심', color: 'purple' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg bg-${item.color}-500/20 flex items-center justify-center`}>
                                                <FontAwesomeIcon icon={item.icon} className={`text-${item.color}-400`} />
                                            </div>
                                            <span className="font-medium text-sm">{item.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Promise */}
                            <motion.div
                                variants={itemVariants}
                                className="col-span-2 md:col-span-2 lg:col-span-3 rounded-3xl p-6 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10"
                            >
                                <FontAwesomeIcon icon={faQuoteLeft} className="text-xl text-emerald-500/40 mb-3" />
                                <blockquote className="text-lg font-medium text-white leading-relaxed mb-3">
                                    "한 번의 거래가 아닌,<br />
                                    평생의 파트너가 되겠습니다."
                                </blockquote>
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <FontAwesomeIcon icon={faCheck} className="text-emerald-500" />
                                    청연이엔지의 약속
                                </div>
                            </motion.div>

                            {/* Contact Card */}
                            <motion.div
                                variants={itemVariants}
                                className="col-span-2 md:col-span-4 lg:col-span-6 rounded-3xl p-6 bg-gradient-to-r from-slate-800/80 via-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/10"
                            >
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <FontAwesomeIcon icon={faBuilding} />
                                    </span>
                                    청연이엔지
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faPhone} className="text-emerald-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400">대표전화</div>
                                            <div className="font-medium">010-XXXX-XXXX</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faEnvelope} className="text-cyan-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400">이메일</div>
                                            <div className="font-medium">info@cheongyeon.co.kr</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400">주소</div>
                                            <div className="font-medium">서울특별시 강남구</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 bg-slate-950/80 backdrop-blur-sm">
                    <div className="max-w-6xl mx-auto px-6 py-8 text-center">
                        <p className="text-slate-500 text-sm">
                            © 2024 청연이엔지. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheongyeonGreetingPage;
