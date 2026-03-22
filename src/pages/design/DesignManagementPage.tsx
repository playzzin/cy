import React, { useEffect, useState } from 'react';
import { motion, useAnimation, Variants, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logoConstruction from '../../assets/logo_construction.jpg';
import logoFinished from '../../assets/logo_finished.png';
// Using FontAwesome for high-quality icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRobot,
    faPalette,
    faSitemap,
    faWandMagicSparkles,
    faArrowRight,
    faCheck,
    faCopy,
    faLayerGroup,
    faCode
} from '@fortawesome/free-solid-svg-icons';

// --- Types & Interfaces ---

interface ToolCardProps {
    title: string;
    description: string;
    icon: any;
    color: string;
    path?: string;
    onClick?: () => void;
    delay: number;
}

// --- Animation Variants ---

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
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

// --- Helper Components ---

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon, color, path, onClick, delay }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (onClick) onClick();
        else if (path) navigate(path);
    };

    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative p-6 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/50 hover:border-slate-500/50 shadow-lg hover:shadow-cyan-500/10 cursor-pointer overflow-hidden transition-all"
            onClick={handleClick}
        >
            {/* Background Glow Effect */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity opacity-50 group-hover:opacity-100`} />

            <div className="relative z-10 flex flex-col h-full">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${color}-500/20 to-${color}-600/10 flex items-center justify-center mb-4 text-${color}-400 group-hover:text-${color}-300 transition-colors`}>
                    <FontAwesomeIcon icon={icon} className="text-xl" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-${color}-200 transition-colors">
                    {title}
                </h3>

                <p className="text-slate-400 text-sm mb-4 leading-relaxed flex-grow">
                    {description}
                </p>

                <div className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-white transition-colors">
                    <span>도구 열기</span>
                    <FontAwesomeIcon icon={faArrowRight} className="ml-2 transform group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </motion.div>
    );
};

// --- Main Page Component ---

const DesignManagementPage: React.FC = () => {
    const controls = useAnimation();
    const [isColorModalOpen, setColorModalOpen] = useState(false);

    // Animation Sequence
    useEffect(() => {
        const sequence = async () => {
            await controls.start('drawing');
            await controls.start('construction');
            await controls.start('finished');
        };
        sequence();
    }, [controls]);

    // Logo Animation Variants
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
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30">
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
                    className="flex flex-col md:flex-row items-center justify-between mb-16"
                >
                    <div className="text-center md:text-left mb-8 md:mb-0">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">
                                V12.0.0 시스템 운영중
                            </span>
                        </div>
                        <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-4">
                            설계 관리 센터
                        </h1>
                        <p className="text-lg text-slate-400 max-w-lg">
                            디자인 시스템, 데이터 구조, AI 보조도구를 한 곳에서 운영하는 통합 설계 관리 허브입니다.
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

                {/* Operations Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    <ToolCard
                        title="디자인 에이전트"
                        description="AI 기반 화면 프로토타이핑 도구입니다. UI 생성 요청과 결과 검증을 한 번에 수행합니다."
                        icon={faRobot}
                        color="cyan"
                        path="/admin/agent-playground"
                        delay={0}
                    />

                    <ToolCard
                        title="컴포넌트 갤러리"
                        description="버튼, 입력폼, 테이블 등 공통 UI를 확인하는 디자인 시스템 기준 저장소입니다."
                        icon={faPalette}
                        color="pink"
                        path="/design-system"
                        delay={0.1}
                    />

                    <ToolCard
                        title="정산 아키텍처"
                        description="정산 로직과 데이터 관계를 시각적으로 파악할 수 있는 구조 설계 도구입니다."
                        icon={faSitemap}
                        color="indigo"
                        path="/design/settlement-architecture"
                        delay={0.2}
                    />

                    <ToolCard
                        title="AI 컬러 제너레이터"
                        description="기준 색상을 바탕으로 조화로운 팔레트를 빠르게 생성해 시안 작업 속도를 높입니다."
                        icon={faWandMagicSparkles}
                        color="violet"
                        onClick={() => setColorModalOpen(true)}
                        delay={0.3}
                    />

                    <ToolCard
                        title="메뉴 관리자"
                        description="메뉴 구조와 역할별 접근 권한을 동적으로 설정하고 운영 상태를 점검합니다."
                        icon={faLayerGroup}
                        color="emerald"
                        path="/admin/menu-manager"
                        delay={0.4}
                    />

                    <ToolCard
                        title="코드 스니펫"
                        description="자주 쓰는 React 패턴과 유틸 함수 예시를 모아둔 레퍼런스 라이브러리입니다."
                        icon={faCode}
                        color="amber"
                        path="/admin/library-guide"
                        delay={0.5}
                    />

                    <ToolCard
                        title="데이터 관계도"
                        description="업무 엔터티 간 연결 구조를 시각화해 설계 누락과 의존성 충돌을 사전에 점검합니다."
                        icon={faSitemap}
                        color="blue"
                        path="/admin/data-relationships"
                        delay={0.6}
                    />

                    <ToolCard
                        title="에이전트 대시보드"
                        description="AI 작업 이력과 처리 상태를 확인하고 설계 자동화 파이프라인을 모니터링합니다."
                        icon={faRobot}
                        color="teal"
                        path="/admin/agent-dashboard"
                        delay={0.7}
                    />

                </motion.div>
            </div>

            {/* AI Color Generator Modal */}
            <AnimatePresence>
                {isColorModalOpen && (
                    <AIColorGeneratorModal onClose={() => setColorModalOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Internal Feature: AI Color Generator ---

const AIColorGeneratorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [baseColor, setBaseColor] = useState("#3b82f6");
    const [palette, setPalette] = useState<string[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Simple HSL Shift Algorithm (Mock AI)
    const generatePalette = (hex: string) => {
        // In a real agent scenario, this could call an LLM or complex lib
        // Here we simulate "Thinking" then responding
        const colors = [
            hex, // Base
            adjustHue(hex, 30), // Analogous 1
            adjustHue(hex, 60), // Analogous 2
            adjustHue(hex, 180), // Complementary
            adjustHue(hex, 210), // Split Comp
            adjustHue(hex, -30), // Analogous 3
        ];
        setPalette(colors);
    };

    useEffect(() => {
        generatePalette(baseColor);
    }, [baseColor]);

    const handleCopy = (color: string, index: number) => {
        navigator.clipboard.writeText(color);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1500);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FontAwesomeIcon icon={faWandMagicSparkles} className="text-violet-500" />
                        AI 컬러 생성기
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">기준 색상 (Hex)</label>
                        <div className="flex gap-4">
                            <input
                                type="color"
                                value={baseColor}
                                onChange={(e) => setBaseColor(e.target.value)}
                                className="h-10 w-20 rounded cursor-pointer bg-transparent border-none"
                            />
                            <input
                                type="text"
                                value={baseColor}
                                onChange={(e) => setBaseColor(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 text-white focus:outline-none focus:border-violet-500 transition"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {palette.map((color, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleCopy(color, idx)}
                                className="group relative h-24 rounded-xl cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-105"
                                style={{ backgroundColor: color }}
                            >
                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${isLight(color) ? 'bg-black/20 text-black' : 'bg-white/20 text-white'}`}>
                                    {color}
                                </span>
                                {copiedIndex === idx && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl animate-fade-in">
                                        <FontAwesomeIcon icon={faCheck} className="text-white text-xl" />
                                    </div>
                                )}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <FontAwesomeIcon icon={faCopy} className={`text-lg ${isLight(color) ? 'text-black/50' : 'text-white/50'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition">닫기</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Utility for color math (Simplified)
// Utility for color math (Simple Hex <-> HSL)
function hexToHSL(H: string) {
    let r = 0, g = 0, b = 0;
    if (H.length === 4) {
        r = parseInt("0x" + H[1] + H[1]);
        g = parseInt("0x" + H[2] + H[2]);
        b = parseInt("0x" + H[3] + H[3]);
    } else if (H.length === 7) {
        r = parseInt("0x" + H[1] + H[2]);
        g = parseInt("0x" + H[3] + H[4]);
        b = parseInt("0x" + H[5] + H[6]);
    }
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return { h, s, l };
}

function hslToHex(h: number, s: number, l: number) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
        m = l - c / 2,
        r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
}

function adjustHue(hex: string, degree: number): string {
    const { h, s, l } = hexToHSL(hex);
    let newH = (h + degree) % 360;
    if (newH < 0) newH += 360;
    return hslToHex(newH, s, l);
}

// Simple brightness check
function isLight(hex: string) {
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
    return luma > 128;
}

export default DesignManagementPage;
