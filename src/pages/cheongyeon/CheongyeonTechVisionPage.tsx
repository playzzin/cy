import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faNetworkWired,
    faChartPie,
    faHandshake,
    faCommentsDollar,
    faArrowRight,
    faHelmetSafety,
    faTruckFast,
    faBuilding
} from '@fortawesome/free-solid-svg-icons';

const CheongyeonTechVisionPage: React.FC = () => {
    const targetRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);

    const fadeInUp = {
        hidden: { opacity: 0, y: 60 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.8 }
        }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 overflow-x-hidden text-white font-sans selection:bg-amber-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-[500px] bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
            </div>

            {/* 1. Hero Section */}
            <div className="relative min-h-[90vh] flex flex-col justify-center items-center text-center px-4">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                    className="z-10"
                >
                    <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm">
                        <span className="text-amber-400 text-sm font-semibold tracking-wider uppercase">Technology Vision</span>
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="z-10 text-5xl md:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500 mb-8 leading-tight tracking-tight"
                >
                    건설의 미래를<br />
                    보여드립니다
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="z-10 text-lg md:text-2xl text-slate-400 max-w-2xl leading-relaxed break-keep"
                >
                    첨단 ERP 시스템과 투명한 데이터 관리로<br className="hidden md:block" />
                    가장 진보된 건설 경험을 제공합니다.
                </motion.p>

                {/* Abstract Background Element */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ duration: 2 }}
                    className="absolute inset-0 flex items-center justify-center -z-10"
                >
                    <div className="w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
                </motion.div>
            </div>

            {/* 2. ERP Transparency Section */}
            <div className="relative py-32 px-4 md:px-8 max-w-7xl mx-auto">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeInUp}
                    className="mb-20 text-center"
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">Total Construction <span className="text-amber-500">ERP</span></h2>
                    <p className="text-xl text-slate-400 max-w-3xl mx-auto break-keep">
                        팀, 현장, 급여, 계약 관리의 모든 프로세스를 하나의 시스템으로 통합했습니다.<br />
                        투명하게 공개되는 데이터로 신뢰를 만듭니다.
                    </p>
                </motion.div>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                    {[
                        { title: '인원 & 팀 관리', desc: '실시간 인력 현황 및 팀 배정 자동화', icon: faHelmetSafety, color: 'text-blue-400', bg: 'bg-blue-900/20' },
                        { title: '현장 모니터링', desc: '공정률 및 현장 이슈 실시간 트래킹', icon: faBuilding, color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
                        { title: '급여 & 정산', desc: '100% 투명한 급여 내역 공개 및 자동 정산', icon: faCommentsDollar, color: 'text-amber-400', bg: 'bg-amber-900/20' },
                        { title: '계약 & 문서', desc: '모든 계약 서류의 디지털화 및 안전한 보관', icon: faHandshake, color: 'text-purple-400', bg: 'bg-purple-900/20' },
                    ].map((item, idx) => (
                        <motion.div
                            key={idx}
                            variants={fadeInUp}
                            className="group p-8 rounded-3xl bg-slate-900/50 border border-slate-700/50 hover:border-amber-500/30 transition-all duration-300 hover:bg-slate-800/50"
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 ${item.color} ${item.bg}`}>
                                <FontAwesomeIcon icon={item.icon} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* 3. Material Management Section */}
            <div className="relative py-32 bg-slate-900">
                <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInUp}
                        >
                            <div className="inline-block mb-4 px-3 py-1 rounded bg-blue-500/10 text-blue-400 font-semibold text-sm">
                                SMART MATERIAL SYSTEM
                            </div>
                            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                                망실율 Zero에<br />
                                도전합니다
                            </h2>
                            <p className="text-lg text-slate-400 leading-relaxed mb-8 break-keep">
                                자재 입출고 프로세스의 전산화를 통해 현장의 모든 자재 흐름을
                                실시간으로 추적합니다. 불필요한 자재 낭비를 막고,
                                효율적인 자재 운영으로 상생의 가치를 실현합니다.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    '실시간 자재 입출고 확인',
                                    '현장별 재고 현황 대시보드',
                                    'QR코드 기반 자재 이력 추적'
                                ].map((txt, i) => (
                                    <li key={i} className="flex items-center gap-3 text-slate-300 transform translate-x-0 transition-transform duration-300 hover:translate-x-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        {txt}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>

                    <div className="flex-1 relative">
                        {/* Abstract Representation of Dashboard */}
                        <motion.div
                            style={{ opacity, scale }}
                            ref={targetRef}
                            className="relative z-10 p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4">
                                <div className="space-y-1">
                                    <div className="h-2 w-24 bg-slate-600 rounded"></div>
                                    <div className="h-2 w-16 bg-slate-600 rounded"></div>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-amber-500/20"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                    <div className="text-2xl font-mono text-emerald-400 font-bold mb-1">98.5%</div>
                                    <div className="text-xs text-slate-500">자재 회수율</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                    <div className="text-2xl font-mono text-blue-400 font-bold mb-1">-12%</div>
                                    <div className="text-xs text-slate-500">예산 절감</div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: "80%" }}
                                        transition={{ duration: 1.5 }}
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                    />
                                </div>
                                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: "65%" }}
                                        transition={{ duration: 1.5, delay: 0.2 }}
                                        className="h-full bg-gradient-to-r from-amber-500 to-orange-400"
                                    />
                                </div>
                            </div>
                        </motion.div>
                        {/* Decorative Blur */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/10 blur-3xl rounded-full -z-0" />
                    </div>
                </div>
            </div>

            {/* 4. Trust & Network */}
            <div className="py-32 max-w-7xl mx-auto px-4 text-center">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeInUp}
                    className="mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">Unrivaled <span className="text-indigo-400">Network</span></h2>
                    <p className="text-xl text-slate-400 max-w-3xl mx-auto break-keep">
                        작은 현장부터 대규모 프로젝트까지.<br />
                        다년간 축적된 협력사 네트워크로 어떤 상황에서도 완벽하게 대응합니다.
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {[
                        { num: '50+', label: '전문 협력 파트너' },
                        { num: '120+', label: '진행 중인 프로젝트' },
                        { num: '100%', label: '책임 준공' },
                        { num: '24/7', label: '실시간 대응 포털' },
                    ].map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.5 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            className="p-8 rounded-2xl bg-slate-900 border border-slate-800"
                        >
                            <div className="text-4xl md:text-5xl font-bold text-white mb-2 font-display">{stat.num}</div>
                            <div className="text-sm text-slate-500 font-medium tracking-wide uppercase">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* 5. Pricing & CTA */}
            <div className="relative py-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-700 opacity-90" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />

                <div className="relative z-10 max-w-5xl mx-auto px-4 text-center text-white">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <FontAwesomeIcon icon={faHandshake} className="text-6xl mb-8 text-white/80" />
                        <h2 className="text-4xl md:text-6xl font-bold mb-8">
                            합리적인 단가, <br />
                            정직한 견적
                        </h2>
                        <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed break-keep">
                            데이터에 기반한 정확한 산출로 거품 없는 견적을 제시합니다.<br />
                            성공적인 프로젝트를 위한 최고의 파트너가 되어드리겠습니다.
                        </p>
                        <button className="px-10 py-5 bg-white text-amber-700 rounded-full font-bold text-lg hover:bg-slate-100 transition-colors shadow-2xl hover:shadow-orange-900/50 hover:-translate-y-1 transform duration-200">
                            견적 문의하기 <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default CheongyeonTechVisionPage;
