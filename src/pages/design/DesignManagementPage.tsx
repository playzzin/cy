import React, { useEffect, useState } from 'react';
import { motion, useAnimation, Variants, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logoConstruction from '../../assets/logo_construction.jpg';
import logoFinished from '../../assets/logo_finished.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSitemap,
    faLayerGroup,
    faProjectDiagram,
    faBuilding,
    faUsers,
    faBoxes,
    faDatabase,
    faNetworkWired,
    faArrowRight,
    faXmark,
    faCheckCircle
} from '@fortawesome/free-solid-svg-icons';

// --- Types & Data ---

interface MenuItem {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
}

const MENUS: MenuItem[] = [
    {
        id: 'system-dongbari',
        title: '시스템 동바리시공',
        description: '안전한 하중 지지를 위한 시스템 동바리 자동화 모델링 및 물량 산출.',
        icon: faSitemap,
        color: 'blue'
    },
    {
        id: 'system-scaffolding',
        title: '시스템비계시공',
        description: '외벽 작업자의 안전을 책임지는 3D 시스템비계 레이아웃 배치 시뮬레이션.',
        icon: faLayerGroup,
        color: 'indigo'
    },
    {
        id: 'peri-dongbari',
        title: '페리 동바리시공',
        description: '페리(Peri)사의 규격을 반영한 특수 동바리 폼 배치 및 도면 생성 지원.',
        icon: faProjectDiagram,
        color: 'violet'
    },
    {
        id: 'peri-scaffolding',
        title: '페리 비계시공',
        description: '구조 검토가 완료된 페리 시스템 비계 설계 모듈 및 공수 계산.',
        icon: faBuilding,
        color: 'cyan'
    },
    {
        id: 'erp-hr',
        title: 'erp실시간인력관리',
        description: '각 현장별 투입 인원 실시간 모니터링, 공수 집계, 노무비 정산 시스템.',
        icon: faUsers,
        color: 'emerald'
    },
    {
        id: 'erp-material',
        title: 'erp실시간자재관리',
        description: '가설 자재의 현장 입출고, 재고 파악, 손망실 처리 및 자재 이동 경로 트래킹.',
        icon: faBoxes,
        color: 'amber'
    },
    {
        id: 'erp-database',
        title: 'erp현장관리데이터베이스',
        description: '전국 설계 및 시공 현장의 도면, 사진, 작업 일보 등 중앙 DB 통합 관리.',
        icon: faDatabase,
        color: 'rose'
    },
    {
        id: 'partner-network',
        title: '협력사네트워크',
        description: '우수 시공 협력사 정보 조회, 발주 연계, 시공 평가 내역 및 파트너 매칭.',
        icon: faNetworkWired,
        color: 'teal'
    }
];

// --- Animation Variants ---

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    }
};

const detailVariants: Variants = {
    hidden: { opacity: 0, height: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        height: 'auto',
        scale: 1,
        transition: { type: "spring", bounce: 0, duration: 0.5 }
    },
    exit: {
        opacity: 0,
        height: 0,
        scale: 0.95,
        transition: { type: "spring", bounce: 0, duration: 0.4 }
    }
};

// --- Helper Components ---

interface ToolCardProps extends MenuItem {
    delay: number;
    onClick: () => void;
    isSelected: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon, color, onClick, isSelected }) => {
    return (
        <motion.div
            layout
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative p-6 bg-slate-800/80 backdrop-blur-md rounded-2xl border ${isSelected ? `border-${color}-500 ring-1 ring-${color}-500/50 shadow-lg shadow-${color}-500/20` : 'border-slate-700/50 hover:border-slate-500/50 hover:shadow-cyan-500/10'} cursor-pointer overflow-hidden transition-all`}
            onClick={onClick}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />

            <div className="relative z-10 flex flex-col h-full">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${color}-500/20 to-${color}-600/10 flex items-center justify-center mb-4 text-${color}-400 transition-colors ${isSelected ? `ring-2 ring-${color}-500/50` : `group-hover:text-${color}-300`}`}>
                    <FontAwesomeIcon icon={icon} className="text-xl" />
                </div>

                <h3 className={`text-xl font-bold mb-2 transition-colors ${isSelected ? `text-${color}-400` : 'text-white group-hover:text-slate-200'}`}>
                    {title}
                </h3>

                <p className="text-slate-400 text-sm mb-4 leading-relaxed flex-grow">
                    {description}
                </p>

                <div className={`flex items-center text-xs font-semibold uppercase tracking-wider transition-colors ${isSelected ? `text-${color}-400` : 'text-slate-500 group-hover:text-white'}`}>
                    <span>{isSelected ? '선택됨' : '상세 보기'}</span>
                    {!isSelected && <FontAwesomeIcon icon={faArrowRight} className="ml-2 transform group-hover:translate-x-1 transition-transform" />}
                </div>
            </div>
        </motion.div>
    );
};

// --- Main Page Component ---

const DesignManagementPage: React.FC = () => {
    const controls = useAnimation();
    const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);

    // Initial SVG Animation
    useEffect(() => {
        const sequence = async () => {
            await controls.start('drawing');
            await controls.start('construction');
            await controls.start('finished');
        };
        sequence();
    }, [controls]);

    const pathVariants: Variants = {
        hidden: { pathLength: 0, opacity: 0 },
        drawing: { pathLength: 1, opacity: 1, transition: { duration: 2, ease: "easeInOut" } }
    };

    const logoVariants: Variants = {
        hidden: { opacity: 0, scale: 0.8 },
        construction: { opacity: 1, scale: 1, transition: { duration: 1.5, ease: "easeOut" } },
        finished: { opacity: 0, scale: 1.1 }
    };

    const finalLogoVariants: Variants = {
        hidden: { opacity: 0, scale: 0.9 },
        finished: { opacity: 1, scale: 1, transition: { duration: 1.5, delay: 0.5, ease: "easeOut" } }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
            {/* Background Mesh Gradient */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-6 py-12 max-w-7xl">

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col md:flex-row items-center justify-between mb-10"
                >
                    <div className="text-center md:text-left mb-8 md:mb-0">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">
                                통합 현장 관리 플랫폼 V12
                            </span>
                        </div>
                        <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-4">
                            설계 및 현장 관리 센터
                        </h1>
                        <p className="text-lg text-slate-400 max-w-lg">
                            가설재 설계부터 실시간 ERP, 자재 관리, 협력사 네트워크까지 모든 프로젝트 데이터를 한 곳에서 제어합니다.
                        </p>
                    </div>

                    {/* Animated Stage Visualizer */}
                    <div className="relative w-64 h-48 md:w-80 md:h-60">
                        <svg className="absolute w-full h-full pointer-events-none opacity-50" viewBox="0 0 800 600">
                            <motion.path
                                d="M200,500 L200,200 L600,200 L600,500"
                                fill="transparent" stroke="#3b82f6" strokeWidth="4"
                                variants={pathVariants} initial="hidden" animate={controls}
                            />
                            <motion.path
                                d="M200,350 L600,350 M300,500 L300,200 M500,500 L500,200"
                                fill="transparent" stroke="#60a5fa" strokeWidth="2" strokeDasharray="10 5"
                                variants={pathVariants} initial="hidden" animate={controls}
                            />
                        </svg>
                        <motion.div className="absolute inset-0 flex items-center justify-center" variants={logoVariants} initial="hidden" animate={controls}>
                            <img src={logoConstruction} alt="Construction" className="w-3/4 h-3/4 object-contain opacity-80" />
                        </motion.div>
                        <motion.div className="absolute inset-0 flex items-center justify-center" variants={finalLogoVariants} initial="hidden" animate={controls}>
                            <img src={logoFinished} alt="Finished" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]" />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Expanded Detail Panel Section */}
                <AnimatePresence mode="wait">
                    {selectedMenu && (
                        <motion.div
                            key="detail-panel"
                            variants={detailVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="mb-12 overflow-hidden"
                        >
                            <div className={`p-8 md:p-12 bg-slate-800/90 backdrop-blur-xl border-2 border-${selectedMenu.color}-500/30 rounded-3xl shadow-2xl relative`}>
                                {/* Background glow inside the detail panel */}
                                <div className={`absolute -top-40 -left-40 w-96 h-96 bg-${selectedMenu.color}-500/10 rounded-full blur-[100px] pointer-events-none`} />

                                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-${selectedMenu.color}-500/20 to-${selectedMenu.color}-600/10 flex items-center justify-center text-${selectedMenu.color}-400 text-3xl border border-${selectedMenu.color}-500/20`}>
                                                <FontAwesomeIcon icon={selectedMenu.icon} />
                                            </div>
                                            <h2 className={`text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-${selectedMenu.color}-200`}>
                                                {selectedMenu.title}
                                            </h2>
                                        </div>

                                        <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mb-8">
                                            {selectedMenu.description} 이 화면은 {selectedMenu.title}의 상세 기능과 대시보드 진입점입니다. 다양한 차트, 통계, 관리 도구를 이 공간에서 불러와 사용할 수 있습니다.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex gap-3">
                                                <FontAwesomeIcon icon={faCheckCircle} className={`text-${selectedMenu.color}-400 mt-1`} />
                                                <div>
                                                    <h4 className="font-bold text-white mb-1">핵심 기능 A</h4>
                                                    <p className="text-sm text-slate-400">데이터 실시간 연동 및 동기화 지원 (100ms 지연)으로 정확한 현황 파악.</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex gap-3">
                                                <FontAwesomeIcon icon={faCheckCircle} className={`text-${selectedMenu.color}-400 mt-1`} />
                                                <div>
                                                    <h4 className="font-bold text-white mb-1">핵심 기능 B</h4>
                                                    <p className="text-sm text-slate-400">통합형 리포팅 도구 제공 및 원클릭 엑셀/PDF 산출물 내보내기.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <button className={`px-8 py-4 bg-${selectedMenu.color}-600 hover:bg-${selectedMenu.color}-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-${selectedMenu.color}-600/30 flex items-center gap-3`}>
                                            해당 모듈 실행하기 <FontAwesomeIcon icon={faArrowRight} />
                                        </button>
                                    </div>

                                    {/* Abstract Graphic Area for the detail panel */}
                                    <div className="hidden lg:flex w-[400px] h-[300px] bg-slate-900/60 rounded-2xl border border-slate-700 items-center justify-center p-6 relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-${selectedMenu.color}-500/10 to-transparent`} />
                                        <div className="text-center relative z-10">
                                            <p className="text-slate-500 text-sm tracking-widest uppercase mb-4">Module Visualizer</p>
                                            <div className={`text-9xl text-${selectedMenu.color}-500/20`}>
                                                <FontAwesomeIcon icon={selectedMenu.icon} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <button
                                    onClick={() => setSelectedMenu(null)}
                                    className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-700/50 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-colors border border-slate-600"
                                    aria-label="닫기"
                                >
                                    <FontAwesomeIcon icon={faXmark} className="text-xl" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Operations Grid (Pushing down when detail opens) */}
                <motion.div layout className="relative">
                    {/* Visual Divider if detail is open */}
                    <AnimatePresence>
                        {selectedMenu && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }}
                                className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-12" 
                            />
                        )}
                    </AnimatePresence>
                    
                    <motion.div
                        layout
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                        {MENUS.map((menu, idx) => (
                            <ToolCard
                                key={menu.id}
                                {...menu}
                                delay={idx * 0.1}
                                isSelected={selectedMenu?.id === menu.id}
                                onClick={() => {
                                    if (selectedMenu?.id === menu.id) {
                                        setSelectedMenu(null); // Toggle off if clicked again
                                    } else {
                                        // Scroll to top smoothly so user sees the new expanded area if they clicked from bottom
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                        setSelectedMenu(menu);
                                    }
                                }}
                            />
                        ))}
                    </motion.div>
                </motion.div>

            </div>
        </div>
    );
};

export default DesignManagementPage;
