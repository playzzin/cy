import React, { useState } from 'react';
import {
    Building2,
    Users,
    CreditCard,
    FileSpreadsheet,
    HandHeart,
    Receipt,
    Truck,
    TrendingUp,
    TrendingDown,
    Zap,
    Crown,
    CheckCircle2,
    Lightbulb,
    Search,
    ArrowUpCircle,
    MonitorSmartphone,
    Keyboard,
    Server
} from 'lucide-react';

// --- Inline Utility ---
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

// --- Layout Components ---
const Section = ({ title, icon: Icon, children, className, gradient }: any) => (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-white/90 shadow-sm backdrop-blur-xl flex flex-col", className)}>
        {gradient && <div className={cn("absolute top-0 left-0 w-full h-1 bg-gradient-to-r", gradient)} />}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <Icon className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-700 text-sm tracking-wide uppercase">{title}</h3>
        </div>
        <div className="p-4 flex-1 overflow-hidden custom-scrollbar relative">
            {children}
        </div>
    </div>
);

// --- Tree Node Component (Compact) ---
const Node = ({ title, subtitle, icon: Icon, type, children, active = true, detail }: any) => {
    const colors = {
        root: "bg-slate-900 text-white border-slate-700 ring-4 ring-slate-100",
        system: "bg-indigo-50 text-indigo-900 border-indigo-200 shadow-inner",
        team: "bg-white text-slate-800 border-blue-200 shadow-lg shadow-blue-500/10",
        income: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
        expense: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
    };

    return (
        <div className="flex flex-col items-center relative z-10 group">
            <div className={cn(
                "flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border transition-all duration-300",
                "min-w-[160px] cursor-default text-center relative overflow-hidden",
                active ? "opacity-100 scale-100" : "opacity-40 scale-95 grayscale",
                colors[type as keyof typeof colors] || "bg-white border-slate-200"
            )}>
                {/* Connector pulse for system nodes */}
                {type === 'system' && <div className="absolute inset-0 bg-indigo-200/20 animate-pulse" />}

                <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", type === 'root' ? "text-blue-300" : "opacity-70")} />
                    <span className="font-bold text-sm">{title}</span>
                </div>
                {subtitle && <span className="text-[10px] opacity-70 font-medium">{subtitle}</span>}

                {type === 'root' && <Crown className="absolute -top-3 -right-2 w-6 h-6 text-amber-400 drop-shadow-sm rotate-12" />}

                {/* Hover Detail Tooltip */}
                {detail && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 bg-slate-800/95 backdrop-blur text-white text-[11px] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 leading-relaxed text-center font-normal shadow-2xl border border-slate-600/50">
                        {detail}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-t border-l border-slate-600/50 rotate-45" />
                    </div>
                )}
            </div>

            {/* Connectors */}
            {children && (
                <div className="flex flex-col items-center">
                    <div className={cn("h-6 w-0.5", type === 'root' ? "bg-indigo-300" : "bg-slate-300")} />
                    <div className="relative flex justify-center gap-4 pt-4 px-2">
                        {/* Horizontal Line Connector */}
                        <div className="absolute top-0 left-10 right-10 h-px bg-slate-300" />
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const SettlementArchitecturePage = () => {
    return (
        <div className="h-[calc(100vh-64px)] bg-slate-50 p-4 font-sans overflow-hidden flex flex-col lg:flex-row gap-4">

            {/* Left Panel: Visual Tree (65%) */}
            <Section
                title="정산 시스템 구조도 (Data Flow)"
                icon={Zap}
                className="lg:w-[65%] h-full border-slate-200"
                gradient="from-blue-500 to-indigo-500"
            >
                <div className="h-full flex items-center justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] overflow-auto relative">

                    {/* Background Flow Animation */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                        <div className="absolute bottom-10 left-[20%] w-px h-full bg-gradient-to-t from-transparent via-blue-400 to-transparent animate-pulse" />
                        <div className="absolute bottom-10 right-[20%] w-px h-full bg-gradient-to-t from-transparent via-emerald-400 to-transparent animate-pulse delay-700" />
                    </div>

                    <div className="scale-[0.8] origin-center transform transition-transform duration-500">
                        {/* Level 1: CEO View */}
                        <Node
                            title="CEO / 관리자"
                            subtitle="최종 정산 승인 및 모니터링"
                            icon={MonitorSmartphone}
                            type="root"
                            detail="현장에서 올라온 데이터를 실시간 대시보드로 확인하고, 최종 급여 및 비용 집행을 승인합니다."
                        >
                            {/* Level 2: System Processing */}
                            <Node
                                title="정산 자동화 엔진"
                                subtitle="Automation System"
                                icon={Server}
                                type="system"
                                detail="현장의 입력 데이터를 자동으로 분류하고, 수익률(BEP)을 실시간으로 계산하여 관리자에게 전달합니다."
                            >
                                {/* Level 3: Employee Input */}
                                <Node
                                    title="현장 직원 / 소장"
                                    subtitle="데이터 직접 입력 (Source Data)"
                                    icon={Users}
                                    type="team"
                                    detail="실제 현장에서 발생하는 영수증, 작업 일보를 모바일/PC로 즉시 입력합니다."
                                >
                                    <div className="flex gap-12 mt-6">
                                        {/* Income Branch */}
                                        <div className="flex flex-col items-center">
                                            <div className="mb-3 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm flex items-center gap-1">
                                                <ArrowUpCircle className="w-3 h-3" /> 매출/수입 입력
                                            </div>
                                            <div className="flex gap-3">
                                                <Node title="작업 일보" icon={FileSpreadsheet} type="income" detail="매일 수행한 작업 공수(M/H) 입력 → 노무비 매출로 자동 환산" />
                                                <Node title="인력 지원" icon={HandHeart} type="income" detail="타 현장으로 지원 나간 내역 입력 → 청구서 자동 생성" />
                                                <Node title="세금계산서" icon={Receipt} type="income" detail="기성금 및 기타 매출 세금계산서 발행 내역 등록" />
                                            </div>
                                        </div>

                                        {/* Expense Branch */}
                                        <div className="flex flex-col items-center">
                                            <div className="mb-3 text-[10px] font-bold text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-100 shadow-sm flex items-center gap-1">
                                                <ArrowUpCircle className="w-3 h-3" /> 비용/지출 입력
                                            </div>
                                            <div className="flex gap-3">
                                                <Node title="숙소비" icon={Building2} type="expense" detail="숙소 임대료 및 관리비 영수증 첨부 및 등록" />
                                                <Node title="차량비" icon={Truck} type="expense" detail="주유비, 수리비 등 차량 관련 지출 내역 입력" />
                                                <Node title="법인카드" icon={CreditCard} type="expense" detail="식대, 자재비 등 카드 사용 내역(자동 연동) 확인 및 목적 분류" />
                                            </div>
                                        </div>
                                    </div>
                                </Node>
                            </Node>
                        </Node>

                        {/* Flow Legend */}
                        <div className="mt-16 flex justify-center gap-12 text-[11px] text-slate-500 font-bold bg-white/50 backdrop-blur px-6 py-3 rounded-full border border-slate-200 shadow-sm mx-auto w-fit">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                    <Keyboard className="w-3 h-3 text-slate-500" />
                                </div>
                                <span className="opacity-70">1. 직원 입력</span>
                            </div>
                            <div className="text-slate-300">→</div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                    <Server className="w-3 h-3 text-indigo-500" />
                                </div>
                                <span className="text-indigo-700">2. 자동 집계</span>
                            </div>
                            <div className="text-slate-300">→</div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shadow-md">
                                    <MonitorSmartphone className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-slate-900">3. CEO 확인</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Right Panel: Architect's Vision & Logic (35%) */}
            <div className="lg:w-[35%] h-full flex flex-col gap-4 overflow-hidden">

                {/* Logic Card */}
                <Section
                    title="핵심 정산 로직 (Profit Logic)"
                    icon={TrendingUp}
                    className="shrink-0 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30"
                    gradient="from-emerald-400 to-teal-400"
                >
                    <div className="flex flex-col justify-center gap-4">
                        <div className="p-5 bg-slate-900 rounded-xl text-center shadow-lg relative overflow-hidden group">
                            {/* Glow Effect */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-all duration-700" />

                            <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Team Net Profit Formula</div>
                            <div className="text-xl md:text-2xl font-mono font-bold text-white flex items-center justify-center gap-3">
                                <span className="text-emerald-400">Total Income</span>
                                <span className="text-slate-600">-</span>
                                <span className="text-rose-400">Total Expense</span>
                            </div>
                            <div className="mt-3 text-[11px] text-slate-300">
                                = <span className="text-white font-bold underline decoration-emerald-500 decoration-2 underline-offset-4">최종 순이익 (Net Profit)</span>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Architect's Vision (Detailed) */}
                <Section
                    title="시스템 설계 철학 (Architect's Vision)"
                    icon={Lightbulb}
                    className="flex-1 border-indigo-100 shadow-md min-h-0"
                    gradient="from-indigo-500 to-violet-500"
                >
                    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar">
                        <div className="p-4 bg-white/60 rounded-xl border-l-4 border-indigo-500 italic text-indigo-900 text-xs md:text-sm leading-relaxed shadow-sm">
                            "이 시스템의 핵심은 **'Bottom-up Data Flow(상향식 데이터 흐름)'**에 있습니다.<br />
                            직원들이 현장에서 입력한 작은 데이터 조각들이 모여, CEO에게는 **회사의 거대 지표를 한눈에 볼 수 있는 망원경**이 됩니다."
                        </div>

                        <div className="space-y-5">
                            {/* Feature 1 */}
                            <div className="group">
                                <div className="flex gap-3 items-center mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">01</div>
                                    <h4 className="font-bold text-slate-800 text-sm">입력은 간편하게 (Smart Input)</h4>
                                </div>
                                <p className="text-xs text-slate-500 pl-9 leading-relaxed">
                                    현장 직원들은 복잡한 회계 지식이 없어도 됩니다.
                                    스마트폰으로 영수증을 찍고, 출근부만 체크하면 나머지는 시스템이 알아서 처리합니다.
                                    <strong>"입력의 최소화, 활용의 극대화"</strong>가 설계의 제1원칙입니다.
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="group">
                                <div className="flex gap-3 items-center mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold shrink-0">02</div>
                                    <h4 className="font-bold text-slate-800 text-sm">보고는 투명하게 (Crystal Clear View)</h4>
                                </div>
                                <p className="text-xs text-slate-500 pl-9 leading-relaxed">
                                    CEO는 더 이상 월말 보고를 기다릴 필요가 없습니다.
                                    직원이 입력을 마치는 순간, <strong>사장님의 대시보드 그래프가 실시간으로 움직입니다.</strong>
                                    어디서 돈이 새는지, 어디서 이익이 나는지 즉시 파악 가능합니다.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="group">
                                <div className="flex gap-3 items-center mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">03</div>
                                    <h4 className="font-bold text-slate-800 text-sm">기록은 영구적으로 (Audit Trail)</h4>
                                </div>
                                <p className="text-xs text-slate-500 pl-9 leading-relaxed">
                                    누가 언제 어떤 데이터를 입력했고 수정했는지 모든 이력이 남습니다.
                                    이는 단순한 감시가 아니라, <strong>상호 신뢰를 시스템으로 보증</strong>하기 위함입니다.
                                </p>
                            </div>
                        </div>

                        <div className="pt-6 mt-4 border-t border-slate-100 text-center pb-2">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest cursor-default shadow-lg hover:bg-slate-800 transition-colors">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                CEO 승인 완료 (Architecture Approved)
                            </div>
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
};

export default SettlementArchitecturePage;
