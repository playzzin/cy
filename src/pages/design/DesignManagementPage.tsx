import React, { useEffect } from 'react';
import { motion, useAnimation, Variants } from 'framer-motion';
import logoConstruction from '../../assets/logo_construction.jpg';
import logoFinished from '../../assets/logo_finished.png';

const DesignManagementPage: React.FC = () => {
    const controls = useAnimation();

    useEffect(() => {
        const sequence = async () => {
            // Stage 1: Scaffold / Drawing Lines
            await controls.start('drawing');
            // Stage 2: Fade in Construction Logo
            await controls.start('construction');
            // Stage 3: Transition to Finished Logo
            await controls.start('finished');
        };
        sequence();
    }, [controls]);

    // Animation Variants
    const pathVariants: Variants = {
        hidden: { pathLength: 0, opacity: 0 },
        drawing: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 2, ease: "easeInOut" }
        }
    };

    const logoVariants: Variants = {
        hidden: { opacity: 0, scale: 0.8 },
        construction: {
            opacity: 1,
            scale: 1,
            transition: { duration: 1.5, ease: "easeOut" }
        },
        finished: {
            opacity: 0,
            scale: 1.1
        }
    };

    const finalLogoVariants: Variants = {
        hidden: { opacity: 0, scale: 0.9 },
        finished: {
            opacity: 1,
            scale: 1,
            transition: { duration: 1.5, delay: 0.5, ease: "easeOut" }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white overflow-hidden relative">

            {/* Hero Section Container */}
            <div className="relative w-full max-w-4xl aspect-video flex items-center justify-center">

                {/* Stage 1: SVG Scaffolding Effect (Conceptual Lines) */}
                <svg className="absolute w-full h-full pointer-events-none" viewBox="0 0 800 600">
                    <motion.path
                        d="M200,500 L200,200 L600,200 L600,500" // Simple structure outline
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="4"
                        variants={pathVariants}
                        initial="hidden"
                        animate={controls}
                    />
                    <motion.path
                        d="M200,350 L600,350 M300,500 L300,200 M500,500 L500,200" // Grid/Scaffold lines
                        fill="transparent"
                        stroke="#60a5fa"
                        strokeWidth="2"
                        strokeDasharray="10 5"
                        variants={pathVariants}
                        initial="hidden"
                        animate={controls}
                    />
                </svg>

                {/* Stage 2: Construction Image */}
                <motion.div
                    className="absolute inset-0 flex items-center justify-center z-10"
                    variants={logoVariants}
                    initial="hidden"
                    animate={controls}
                >
                    <img
                        src={logoConstruction}
                        alt="Construction Phase"
                        className="max-w-[80%] max-h-[80%] object-contain drop-shadow-2xl rounded-xl"
                    />
                </motion.div>

                {/* Stage 3: Finished Logo */}
                <motion.div
                    className="absolute inset-0 flex items-center justify-center z-20"
                    variants={finalLogoVariants}
                    initial="hidden"
                    animate={controls}
                >
                    <img
                        src={logoFinished}
                        alt="Finished Building"
                        className="max-w-[85%] max-h-[85%] object-contain drop-shadow-2xl"
                    />
                </motion.div>

                {/* Overlay Text */}
                <div className="absolute bottom-10 z-30 text-center">
                    <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                        청연ENG Design System
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Building the Future, Pixel by Pixel
                    </p>
                </div>

            </div>

            {/* Design Controls / Content Area (Placeholder for actual management tools) */}
            <div className="mt-12 w-full max-w-6xl p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl z-30">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                        디자인 리소스 관리
                    </h2>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition">
                        새 리소스 추가
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Placeholder Cards */}
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-slate-700/50 p-6 rounded-xl hover:bg-slate-700 transition cursor-pointer group">
                            <div className="w-12 h-12 bg-slate-600 rounded-lg mb-4 group-hover:bg-blue-500/20 group-hover:text-blue-400 flex items-center justify-center transition">
                                <span className="text-xl">🎨</span>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Color Palette v{i}.0</h3>
                            <p className="text-slate-400 text-sm">Last updated: 2024-12-1{i}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DesignManagementPage;
