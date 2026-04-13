import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCoins,
    faFileCircleCheck,
    faHandshake,
    faHeartPulse,
    faHelmetSafety,
    faMicrochip,
    faShieldHalved,
    faScrewdriverWrench,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { useSiteMode } from '../../contexts/SiteModeContext';

const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7 } }
};

const stagger = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.06 }
    }
};

const CheongyeonPhilosophyPage: React.FC = () => {
    const { isDarkMode } = useSiteMode();

    const corePillars = useMemo(() => ([
        {
            title: '신용',
            headline: '임금사고 없는 운영',
            description: '정산 일정, 지급 근거, 실시간 정산, 마감 책임을 끝까지 붙들고 현장의 신뢰를 지킵니다.',
            icon: faShieldHalved,
            iconClass: 'bg-amber-400/15 text-amber-300',
            borderClass: 'border-amber-400/25',
            glowClass: 'from-amber-400/20 via-amber-300/5 to-transparent',
            bullets: ['단 한 번의 임금사고도 남기지 않는 기준', '마감까지 흔들리지 않는 정산 체계', '지급 내역과 책임 범위를 분명하게 관리', '실시간 정산으로 흐름을 바로 확인하는 운영']
        },
        {
            title: '안전',
            headline: '현장이 안심하는 시공',
            description: '작업 전 준비부터 마감 후 정리까지, 실시간 현장관리와 무리 없는 공정 운영으로 안전 기준을 먼저 세웁니다.',
            icon: faHelmetSafety,
            iconClass: 'bg-emerald-400/15 text-emerald-300',
            borderClass: 'border-emerald-400/25',
            glowClass: 'from-emerald-400/20 via-emerald-300/5 to-transparent',
            bullets: ['일정에 쫓겨도 안전 기준은 낮추지 않음', '현장 흐름을 끊지 않는 준비 중심 운영', '작업자와 관리자 모두가 납득하는 공정 운영', '실시간 현장관리로 위험과 변수에 빠르게 대응']
        },
        {
            title: '기술',
            headline: '마감이 확실한 기술력',
            description: '오랜 경험과 기술력을 바탕으로 견적, 공정, 정산을 한 흐름으로 묶어 100% 마감 기준을 흔들림 없이 지향합니다.',
            icon: faMicrochip,
            iconClass: 'bg-cyan-400/15 text-cyan-300',
            borderClass: 'border-cyan-400/25',
            glowClass: 'from-cyan-400/20 via-cyan-300/5 to-transparent',
            bullets: ['오랜 경험을 바탕으로 현장 변수에 빠르게 대응하는 실행력', '시공 품질과 마감 완성도를 함께 관리', '기술 검토와 운영 관리가 분리되지 않는 구조']
        }
    ]), []);

    const promiseCards = useMemo(() => ([
        {
            title: '100% 마감 기준',
            description: '시작만 하는 공사가 아니라 끝까지 책임지는 시공으로 결과를 남깁니다.',
            icon: faFileCircleCheck
        },
        {
            title: '합리적인 견적',
            description: '과장 없이 필요한 항목을 선명하게 제시하고, 현장에 맞는 견적으로 접근합니다.',
            icon: faCoins
        },
        {
            title: '협력사와 공생',
            description: '한 번의 거래보다 오래 가는 관계를 기준으로 역할과 수익 구조를 함께 봅니다.',
            icon: faHandshake
        },
        {
            title: '근로자 복지 우선',
            description: '복지와 처우를 비용으로만 보지 않고, 현장의 집중력과 품질을 만드는 기반으로 봅니다.',
            icon: faHeartPulse
        },
        {
            title: '현장 친화 운영',
            description: '서류보다 현장 흐름이 먼저 막히지 않도록 보고, 정리, 대응 속도를 맞춥니다.',
            icon: faUsers
        }
    ]), []);

    const operationSteps = useMemo(() => ([
        '현장 조건을 먼저 듣고 무리한 약속은 하지 않습니다.',
        '견적과 공정 기준을 맞춘 뒤 바로 실행 가능한 계획으로 정리합니다.',
        '시공 중에는 안전과 품질, 인력 흐름을 함께 봅니다.',
        '마감 단계에서는 누락 없이 정리하고 책임 범위를 끝까지 확인합니다.',
        '정산과 지급은 근거를 남기고 일정대로 마무리합니다.'
    ]), []);

    const welfarePoints = useMemo(() => ([
        '작업자가 현장에서 체감할 수 있는 운영',
        '협력사와 반복해서 일할 수 있는 신뢰 구조',
        '공정과 정산이 따로 놀지 않는 일관된 관리',
        '안전, 품질, 지급을 한 번에 보는 실행 기준'
    ]), []);

    return (
        <div className={`min-h-screen overflow-x-hidden ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
            <div className={`fixed inset-0 pointer-events-none ${isDarkMode ? 'bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.16),_transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)' : 'bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#ecfeff_100%)]'}`} />

            <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 md:px-8">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={stagger}
                >
                    <motion.div variants={fadeUp} className="max-w-3xl">
                        <div className="text-sm font-bold uppercase tracking-[0.24em] text-amber-400">Core Value</div>
                        <h2 className={`mt-4 text-3xl font-black md:text-5xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            신용, 안전, 기술이
                            <br />
                            같은 방향으로 움직여야 합니다.
                        </h2>
                    </motion.div>

                    <div className="mt-10 grid gap-6 lg:grid-cols-3">
                        {corePillars.map((pillar) => (
                            <motion.div
                                key={pillar.title}
                                variants={fadeUp}
                                whileHover={{ y: -6 }}
                                className={`relative overflow-hidden rounded-[28px] border p-7 ${pillar.borderClass} ${isDarkMode ? 'bg-slate-900/70' : 'bg-white shadow-[0_18px_46px_rgba(15,23,42,0.08)]'}`}
                            >
                                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${pillar.glowClass}`} />
                                <div className="relative">
                                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl ${pillar.iconClass}`}>
                                        <FontAwesomeIcon icon={pillar.icon} />
                                    </div>
                                    <div className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">{pillar.title}</div>
                                    <h3 className={`mt-3 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{pillar.headline}</h3>
                                    <p className={`mt-4 text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pillar.description}</p>
                                    <div className="mt-6 space-y-3">
                                        {pillar.bullets.map((bullet) => (
                                            <div key={bullet} className="flex items-start gap-3">
                                                <span className="mt-2 h-2.5 w-2.5 rounded-full bg-amber-400" />
                                                <span className={`text-sm leading-6 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{bullet}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </section>

            <section className={`relative py-20 ${isDarkMode ? 'bg-slate-900/80' : 'bg-white/80'}`}>
                <div className="mx-auto max-w-7xl px-4 md:px-8">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                        variants={stagger}
                    >
                        <motion.div variants={fadeUp} className="max-w-3xl">
                            <div className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-400">Field Standard</div>
                            <h2 className={`mt-4 text-3xl font-black md:text-5xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                현장이 체감하는 기준은
                                <br />
                                말보다 순서에서 드러납니다.
                            </h2>
                        </motion.div>

                        <div className="mt-10 grid gap-4 lg:grid-cols-5">
                            {operationSteps.map((step, index) => (
                                <motion.div
                                    key={step}
                                    variants={fadeUp}
                                    className={`rounded-[24px] border p-5 ${isDarkMode ? 'border-white/10 bg-slate-950/55' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="text-3xl font-black text-amber-400">0{index + 1}</div>
                                        <FontAwesomeIcon icon={index % 2 === 0 ? faScrewdriverWrench : faFileCircleCheck} className="text-slate-400" />
                                    </div>
                                    <p className={`mt-5 text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{step}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="relative mx-auto max-w-7xl px-4 py-20 md:px-8">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={stagger}
                >
                    <motion.div variants={fadeUp} className="max-w-3xl">
                        <div className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-400">Promise</div>
                        <h2 className={`mt-4 text-3xl font-black md:text-5xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            현장과 함께 오래 가기 위한
                            <br />
                            다섯 가지 약속
                        </h2>
                    </motion.div>

                    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                        {promiseCards.map((item) => (
                            <motion.div
                                key={item.title}
                                variants={fadeUp}
                                whileHover={{ y: -5, scale: 1.01 }}
                                className={`rounded-[24px] border p-5 ${isDarkMode ? 'border-white/10 bg-slate-900/65' : 'border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]'}`}
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                                    <FontAwesomeIcon icon={item.icon} />
                                </div>
                                <h3 className={`mt-5 text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                                <p className={`mt-3 text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </section>

            <section className="relative mx-auto max-w-7xl px-4 pb-24 md:px-8">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={stagger}
                    className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
                >
                    <motion.div
                        variants={fadeUp}
                        className={`rounded-[30px] border p-8 ${isDarkMode ? 'border-white/10 bg-[linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.82))]' : 'border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]'}`}
                    >
                        <div className="flex items-center gap-3 text-amber-400">
                            <FontAwesomeIcon icon={faHandshake} />
                            <span className="text-sm font-bold uppercase tracking-[0.22em]">Partnership</span>
                        </div>
                        <h2 className={`mt-5 text-3xl font-black md:text-4xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            협력사와 함께 남는 구조를 만듭니다.
                        </h2>
                        <p className={`mt-5 max-w-2xl text-sm leading-8 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            일회성 단가 경쟁보다 반복해서 함께 갈 수 있는 관계를 우선합니다.
                            역할은 선명하게, 정산은 명확하게, 마감 책임은 끝까지.
                            서로가 다음 현장도 함께 선택할 수 있는 구조를 만드는 것이 청연이엔지의 방식입니다.
                        </p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                ['합리적 견적', '현장 상황에 맞는 범위와 단가'],
                                ['명확한 역할', '책임과 실행 범위를 분명하게 정리'],
                                ['반복 가능한 관계', '다음 공정까지 이어지는 신뢰']
                            ].map(([title, desc]) => (
                                <div key={title} className={`rounded-2xl border p-4 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50/90'}`}>
                                    <div className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</div>
                                    <div className={`mt-2 text-xs leading-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{desc}</div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        variants={fadeUp}
                        className={`rounded-[30px] border p-8 ${isDarkMode ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]'}`}
                    >
                        <div className="flex items-center gap-3 text-emerald-400">
                            <FontAwesomeIcon icon={faHeartPulse} />
                            <span className="text-sm font-bold uppercase tracking-[0.22em]">Welfare</span>
                        </div>
                        <h2 className={`mt-5 text-3xl font-black md:text-4xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            근로자 복지는
                            <br />
                            현장의 품질과 연결됩니다.
                        </h2>
                        <div className="mt-7 space-y-4">
                            {welfarePoints.map((item, index) => (
                                <motion.div
                                    key={item}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.45, delay: index * 0.08 }}
                                    className={`flex items-start gap-4 rounded-2xl border p-4 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50/90'}`}
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                                        {index + 1}
                                    </div>
                                    <div className={`text-sm leading-7 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            </section>
        </div>
    );
};

export default CheongyeonPhilosophyPage;
