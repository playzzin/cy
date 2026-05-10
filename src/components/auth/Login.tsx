import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storageService';

const INTRO_VIDEO_PATH_CANDIDATES = ['INTRO_1.MP4', 'intro_1.mp4'];
const INTRO_VIDEO_DIRECT_URL =
  'https://firebasestorage.googleapis.com/v0/b/cyee-9c1e4.firebasestorage.app/o/intro_1.mp4?alt=media&token=33ce5743-97de-46f2-b21c-0d8569c291e6';
const INTRO_FADE_DURATION_MS = 1400;
const INTRO_MAX_WAIT_MS = 9000;

type LoginIntroPhase = 'splash' | 'intro' | 'login';
type LoginLocationState = {
  from?: string | {
    pathname?: string;
    search?: string;
    hash?: string;
  };
  skipIntro?: boolean;
};

const normalizeReturnPath = (path: string) => (
  path.startsWith('/') && !path.startsWith('//') ? path : '/dashboard'
);

const Login: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LoginLocationState | null;
  const returnPath = useMemo(() => {
    const from = locationState?.from;
    if (typeof from === 'string') return normalizeReturnPath(from);
    if (from && typeof from === 'object') {
      return normalizeReturnPath(`${from.pathname || '/dashboard'}${from.search || ''}${from.hash || ''}`);
    }
    return '/dashboard';
  }, [locationState]);
  const shouldSkipIntro = Boolean(locationState?.skipIntro);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [introLoading, setIntroLoading] = useState(false);
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [introPhase, setIntroPhase] = useState<LoginIntroPhase>(() => shouldSkipIntro ? 'login' : 'splash');
  const [isIntroFading, setIsIntroFading] = useState(false);
  const [showAudioRetry, setShowAudioRetry] = useState(false);
  const [isIntroEntering, setIsIntroEntering] = useState(false);
  const introDismissedRef = useRef(false);
  const introFadeTimerRef = useRef<number | null>(null);
  const introMaxWaitTimerRef = useRef<number | null>(null);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const { currentUser, loading: authLoading, login, loginWithGoogle } = useAuth();

  useEffect(() => {
    if (shouldSkipIntro) {
      setIntroPhase('login');
    }
  }, [shouldSkipIntro]);

  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate(returnPath, { replace: true });
    }
  }, [authLoading, currentUser, navigate, returnPath]);

  useEffect(() => {
    return () => {
      if (introFadeTimerRef.current !== null) {
        window.clearTimeout(introFadeTimerRef.current);
      }
      if (introMaxWaitTimerRef.current !== null) {
        window.clearTimeout(introMaxWaitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (introPhase !== 'intro' || !introVideoRef.current) return;

    const video = introVideoRef.current;
    video.muted = false;
    video.volume = 1;
    const playPromise = video.play();
    if (playPromise) {
      void playPromise
        .then(() => setShowAudioRetry(false))
        .catch(() => setShowAudioRetry(true));
    }
  }, [introPhase, introVideoUrl]);

  const dismissIntro = () => {
    if (introDismissedRef.current) return;

    introDismissedRef.current = true;
    setIsIntroFading(true);

    if (introMaxWaitTimerRef.current !== null) {
      window.clearTimeout(introMaxWaitTimerRef.current);
      introMaxWaitTimerRef.current = null;
    }

    introFadeTimerRef.current = window.setTimeout(() => {
      setIntroPhase('login');
      setIsIntroFading(false);
      setShowAudioRetry(false);
    }, INTRO_FADE_DURATION_MS);
  };

  const loadIntroVideo = async () => {
    if (INTRO_VIDEO_DIRECT_URL) {
      return INTRO_VIDEO_DIRECT_URL;
    }

    for (const candidate of INTRO_VIDEO_PATH_CANDIDATES) {
      try {
        return await storageService.getDownloadUrl(candidate);
      } catch {
        continue;
      }
    }

    throw new Error('인트로 비디오를 찾을 수 없습니다.');
  };

  const handleIntroStart = async () => {
    if (introLoading || introPhase !== 'splash') return;

    try {
      setError('');
      setIntroLoading(true);
      setIsIntroFading(false);
      introDismissedRef.current = false;

      const url = await loadIntroVideo();
      setIntroVideoUrl(url);
      setIsIntroEntering(true);
      setIntroPhase('intro');
      window.setTimeout(() => setIsIntroEntering(false), 30);
      introMaxWaitTimerRef.current = window.setTimeout(dismissIntro, INTRO_MAX_WAIT_MS);
    } catch (videoError) {
      console.error('인트로 비디오 로드 실패:', videoError);
      setIntroPhase('login');
    } finally {
      setIntroLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate(returnPath, { replace: true });
    } catch (err) {
      setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate(returnPath, { replace: true });
    } catch (err) {
      setError('Google 로그인에 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-['Pretendard'] text-slate-100">
      {introPhase !== 'login' && (
        <div
          className={[
            'absolute inset-0 z-40 flex items-center justify-center px-4 transition-opacity duration-700 ease-out sm:px-6',
            introPhase === 'splash' ? 'opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_rgba(2,6,23,0.94)_58%,_rgba(2,6,23,1)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.04)_0%,_rgba(148,163,184,0.02)_38%,_rgba(15,23,42,0.22)_100%)]" />

          <button
            type="button"
            onClick={handleIntroStart}
            disabled={introLoading}
            className="relative z-10 flex w-full max-w-xl flex-col items-center gap-5 rounded-[28px] border border-slate-700/70 bg-slate-950/45 px-6 py-9 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-500 hover:scale-[1.02] disabled:cursor-wait disabled:opacity-80 sm:gap-6 sm:rounded-[36px] sm:px-10 sm:py-12"
            style={{ maxWidth: 'min(36rem, calc(100vw - 2rem))' }}
          >
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_30%_25%,_rgba(255,255,255,0.92),_rgba(203,213,225,0.8)_18%,_rgba(71,85,105,0.92)_42%,_rgba(15,23,42,0.98)_76%)] shadow-[inset_0_2px_12px_rgba(255,255,255,0.3),0_20px_45px_rgba(56,189,248,0.18)] sm:h-44 sm:w-44">
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute inset-5 rounded-full bg-[conic-gradient(from_210deg,_rgba(255,255,255,0.8),_rgba(100,116,139,0.08),_rgba(255,255,255,0.75),_rgba(15,23,42,0.5),_rgba(255,255,255,0.8))] opacity-90" />
              <div className="relative bg-[linear-gradient(180deg,_#ffffff_0%,_#d5dee9_20%,_#6b7280_48%,_#f8fafc_72%,_#4b5563_100%)] bg-clip-text text-[3.4rem] font-black tracking-[-0.14em] text-transparent [text-shadow:0_2px_18px_rgba(255,255,255,0.25)] sm:text-[4.7rem]">
                CY
              </div>
            </div>

            <div className="max-w-md text-center">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-slate-300/70 sm:text-xs sm:tracking-[0.38em]">CHEONGYEON ENG INTRO</p>
              <h1 className="mt-3 break-words text-2xl font-black tracking-[0.12em] text-slate-100 sm:text-3xl sm:tracking-[0.18em]">CLICK THE CY LOGO</h1>
              <p className="mt-4 text-xs leading-relaxed text-slate-400 sm:text-sm">
                메탈릭 CY 로고를 클릭하면 스토리지의 INTRO_1.MP4가 재생된 뒤 로그인 화면이 나타납니다.
              </p>
            </div>

            <div className="inline-flex items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 px-5 py-2 text-xs font-semibold tracking-[0.24em] text-cyan-100/85">
              {introLoading ? 'INTRO LOADING' : 'START INTRO'}
            </div>
          </button>
        </div>
      )}

      {introPhase === 'intro' && (
        <div
          className={[
            'absolute inset-0 z-30 overflow-hidden transition-opacity duration-[1400ms] ease-out',
            isIntroEntering ? 'opacity-0' : 'opacity-100',
            isIntroFading ? 'pointer-events-none opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {introVideoUrl ? (
            <video
              ref={introVideoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              preload="auto"
              onEnded={dismissIntro}
            >
              <source src={introVideoUrl} type="video/mp4" />
            </video>
          ) : (
            <div className="h-full w-full bg-slate-950" />
          )}
          <div className="absolute inset-0 bg-slate-950/30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.08),_rgba(2,6,23,0.72)_70%,_rgba(2,6,23,0.95)_100%)]" />

          {showAudioRetry && (
            <button
              type="button"
              onClick={() => {
                const video = introVideoRef.current;
                if (!video) return;
                video.muted = false;
                video.volume = 1;
                const retryPromise = video.play();
                if (retryPromise) {
                  void retryPromise
                    .then(() => setShowAudioRetry(false))
                    .catch(() => setShowAudioRetry(true));
                }
              }}
              className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-full border border-cyan-300/35 bg-slate-950/70 px-5 py-2 text-xs font-semibold tracking-[0.18em] text-cyan-100 backdrop-blur hover:bg-slate-900/80"
            >
              사운드 재생
            </button>
          )}
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      <div
        className={[
          'relative z-10 flex min-h-screen items-center justify-center px-5 py-10 transition-all duration-[1400ms] ease-out',
          introPhase === 'login' ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-6 scale-[0.985] opacity-0',
        ].join(' ')}
      >
        <div
          className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/90 shadow-2xl shadow-black/30 backdrop-blur"
          style={{ maxWidth: 'min(64rem, calc(100vw - 2rem))' }}
        >
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2">
            <section className="hidden min-w-0 flex-col justify-between border-r border-slate-800 p-10 lg:flex">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300/80">CHEONGYEON ENG</p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-slate-100">
                  ERP
                  <br />
                  LOGIN
                </h1>
                <p className="mt-5 text-sm leading-relaxed text-slate-400">
                  청연ENG ERP 접속 화면입니다. 인력, 일보, 급여, 세금계산서 운영을 하나의 계정으로 관리합니다.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-500">운영 핵심 모듈</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">일보/현황</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">급여/정산</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">인력/DB</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">세금계산서</div>
                </div>
              </div>
            </section>

            <section className="min-w-0 p-6 sm:p-10">
              <div className="mb-7 lg:hidden">
                <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">CHEONGYEON ENG ERP</p>
                <h1 className="mt-2 text-2xl font-black text-slate-100">로그인</h1>
              </div>

              <h2 className="mb-2 hidden text-2xl font-bold text-slate-100 lg:block">계정 로그인</h2>
              <p className="mb-6 text-sm text-slate-400">이메일과 비밀번호를 입력해 시스템에 접속하세요.</p>

              {error && (
                <div className="mb-4 rounded-lg border border-rose-700/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition-colors focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">비밀번호</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition-colors focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-cyan-500 py-3 font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '로그인 중...' : '로그인'}
                </button>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs text-slate-500">또는</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-3 font-semibold text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Google로 로그인
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
