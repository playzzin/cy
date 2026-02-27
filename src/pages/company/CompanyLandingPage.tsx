import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faHandshake,
  faChartLine,
  faArrowRight,
  faCheckCircle,
  faCube,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

import logoFinished from '../../assets/logo_finished.png';

const CompanyLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Workflow Steps
  const steps = [
    { title: "파트너 신청", desc: "기본 정보 입력 및 서류 제출", icon: faBuilding },
    { title: "심사 진행", desc: "담당자 검토 (1-2일 소요)", icon: faChartLine },
    { title: "승인 완료", desc: "시스템 접근 권한 부여", icon: faCheckCircle },
    { title: "협업 시작", desc: "프로젝트 참여 및 정산 관리", icon: faHandshake },
  ];

  // Benefits Data
  const benefits = [
    {
      title: "실시간 현장 관리",
      desc: "모든 현장의 작업 현황과 인력을 실시간으로 모니터링하세요.",
      icon: faCube,
      color: "from-blue-500 to-cyan-400"
    },
    {
      title: "투명한 정산 시스템",
      desc: "복잡한 기성 청구와 노무비 지급을 자동화된 시스템으로 처리합니다.",
      icon: faChartLine,
      color: "from-emerald-500 to-teal-400"
    },
    {
      title: "검증된 안전 프로세스",
      desc: "강력한 안전 관리 규정을 시스템 레벨에서 지원합니다.",
      icon: faShieldAlt,
      color: "from-amber-500 to-orange-400"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-['Pretendard'] overflow-x-hidden selection:bg-amber-500/30">
      {/* Navigation */}
      <nav className={`fixed w-full z-[100] px-6 py-4 flex justify-between items-center transition-all duration-300 ${scrolled
        ? 'bg-slate-900/80 backdrop-blur-md border-b border-white/10 shadow-lg h-[70px]'
        : 'bg-transparent border-transparent h-[90px]'
        }`}>
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate('/')}
        >
          <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center p-1 transition-all duration-300 ${scrolled ? 'shadow-md' : 'opacity-90'}`}>
            <img src={logoFinished} alt="CY Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
              CHEONGYEON
            </span>
            <span className="text-[10px] tracking-widest text-amber-500 font-bold hidden sm:block">
              PARTNER SYSTEM
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors font-medium"
          >
            로그인
          </button>
          <button
            onClick={() => navigate('/company/registration')}
            className="px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-full transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5"
          >
            파트너 등록
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        </div>

        <div className="max-w-7xl w-full mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-amber-400 text-xs font-bold mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              PARTNER SYSTEM V2.0
            </motion.div>
            <h1 className="text-5xl lg:text-7xl font-black leading-tight mb-6 tracking-tight">
              Build <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Better</span>,<br />
              Together.
            </h1>
            <p className="text-lg text-slate-400 mb-8 max-w-xl leading-relaxed">
              청연건설과 함께 더 안전하고 효율적인 건설 현장을 만들어가세요.
              협력사를 위한 통합 파트너 시스템이 여러분의 비즈니스를 지원합니다.
            </p>
            <div className="flex flex-wrap gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/company/registration')}
                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl font-bold text-slate-950 shadow-xl shadow-orange-500/20 flex items-center gap-2 group"
              >
                파트너사 등록하기
                <FontAwesomeIcon icon={faArrowRight} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
              <button className="px-8 py-4 bg-slate-800/50 border border-slate-700 hover:bg-slate-800 rounded-2xl font-bold text-white transition-all">
                입찰 공고 확인
              </button>
            </div>
          </motion.div>

          {/* Animated Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative z-10 bg-slate-900/50 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Projects</div>
                  <div className="text-3xl font-black text-white">128</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl">
                  <FontAwesomeIcon icon={faChartLine} className="text-amber-400 text-xl" />
                </div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-slate-400">
                      {item}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-24 bg-slate-700 rounded-full mb-2" />
                      <div className="h-2 w-16 bg-slate-700/50 rounded-full" />
                    </div>
                    <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold">
                      Active
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl rotate-12 opacity-50 blur-sm -z-10" />
            <div className="absolute -bottom-10 -left-10 w-full h-full border border-slate-700 rounded-3xl -z-20 scale-95 opacity-50" />
          </motion.div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 relative border-t border-slate-800/50 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">등록 절차 안내</h2>
            <p className="text-slate-400">간편하게 파트너 등록을 마치고 바로 업무를 시작하세요.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-8 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-gradient-to-r from-slate-800 via-amber-500/50 to-slate-800" />

            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative flex flex-col items-center text-center group"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl text-slate-400 mb-6 relative z-10 group-hover:border-amber-500 group-hover:text-amber-400 transition-colors shadow-xl">
                  <FontAwesomeIcon icon={step.icon} />
                </div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-white transition-colors">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group relative p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-all overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-xl mb-6 shadow-lg`}>
                  <FontAwesomeIcon icon={item.icon} />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-4xl mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl blur-2xl opacity-20" />
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fbbf24 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <h2 className="text-3xl md:text-4xl font-bold mb-6 relative z-10">지금 바로 파트너가 되어주세요</h2>
            <p className="text-lg text-slate-400 mb-8 max-w-lg mx-auto relative z-10">
              이미 100개 이상의 협력사가 청연건설 시스템을 통해<br />
              업무 효율을 200% 이상 증대시켰습니다.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/company/registration')}
              className="relative z-10 px-10 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:bg-slate-100 transition-colors shadow-xl"
            >
              무료로 등록 시작하기
            </motion.button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800 bg-slate-950/50 text-slate-500 text-sm text-center">
        <p>&copy; 2026 CHEONGYEON CONSTRUCTION ERP. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default CompanyLandingPage;
