import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, loading: authLoading, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard', { replace: true });
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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Google 로그인에 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Pretendard'] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-5xl rounded-3xl border border-slate-800/90 bg-slate-900/90 backdrop-blur shadow-2xl shadow-black/30 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <section className="hidden lg:flex flex-col justify-between p-10 border-r border-slate-800">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300/80">CHEONGYEON ENG</p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-slate-100">
                  ERP<br />
                  LOGIN
                </h1>
                <p className="mt-5 text-sm text-slate-400 leading-relaxed">
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

            <section className="p-6 sm:p-10">
              <div className="lg:hidden mb-7">
                <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">CHEONGYEON ENG ERP</p>
                <h1 className="mt-2 text-2xl font-black text-slate-100">로그인</h1>
              </div>

              <h2 className="hidden lg:block text-2xl font-bold text-slate-100 mb-2">계정 로그인</h2>
              <p className="text-sm text-slate-400 mb-6">이메일과 비밀번호를 입력해 시스템에 접속하세요.</p>

              {error && (
                <div className="mb-4 rounded-lg border border-rose-700/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">비밀번호</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-cyan-500 text-slate-950 font-bold py-3 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 font-semibold py-3 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
