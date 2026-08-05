import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { enableDevAdminSession, isDevAdminAllowed } from '../../utils/devAdminSession';

type LoginLocationState = {
  from?: string | {
    pathname?: string;
    search?: string;
    hash?: string;
  };
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, loading: authLoading, login, loginWithGoogle } = useAuth();
  const canUseDevAdmin = isDevAdminAllowed();

  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate(returnPath, { replace: true });
    }
  }, [authLoading, currentUser, navigate, returnPath]);

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

  const handleDevAdminLogin = () => {
    enableDevAdminSession();
    window.location.assign(returnPath);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div
          className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/90 shadow-2xl shadow-black/30 backdrop-blur"
          style={{ maxWidth: 'min(64rem, calc(100vw - 2rem))' }}
        >
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2">
            <section className="hidden min-w-0 flex-col justify-between border-r border-slate-800 p-10 lg:flex">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200">CHEONGYEON ENG</p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-slate-100">
                  ERP
                  <br />
                  LOGIN
                </h1>
                <p className="mt-5 text-sm leading-relaxed text-slate-300">
                  청연ENG ERP 접속 화면입니다. 인력, 일보, 급여, 세금계산서 운영을 하나의 계정으로 관리합니다.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-400">운영 핵심 모듈</p>
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
                <p className="text-xs font-semibold tracking-[0.2em] text-cyan-200">CHEONGYEON ENG ERP</p>
                <h1 className="mt-2 text-2xl font-black text-slate-100">로그인</h1>
              </div>

              <h2 className="mb-2 hidden text-2xl font-bold text-slate-100 lg:block">계정 로그인</h2>
              <p className="mb-6 text-sm text-slate-300">이메일과 비밀번호를 입력해 시스템에 접속하세요.</p>

              {error && (
                <div className="mb-4 rounded-lg border border-rose-700/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">이메일</label>
                  <input
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-400 transition-colors focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-400 transition-colors focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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
                  <span className="text-xs text-slate-400">또는</span>
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

                {canUseDevAdmin && (
                  <button
                    type="button"
                    onClick={handleDevAdminLogin}
                    disabled={loading}
                    className="w-full rounded-lg border border-amber-500/40 bg-amber-400/10 py-3 font-semibold text-amber-100 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    개발자 관리자 모드로 열기
                  </button>
                )}
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
