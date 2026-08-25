import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileWarning,
  Filter,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cardExpenseAuditService } from '../../services/cardExpenseAuditService';
import { userService, type UserData } from '../../services/userService';
import type {
  CardExpenseAuditDashboard,
  CardExpenseAuditFinding,
  CardExpenseAuditPolicy,
  CardExpenseAuditReviewStatus,
  CardExpenseAuditSeverity,
} from '../../types/cardExpenseAudit';
import { canAccessCardExpenseAudit } from '../../utils/cardExpenseAuditAccess';

const CATEGORY_LABELS: Record<string, string> = {
  FUEL: '주유·충전',
  TOLL: '통행료',
  MEAL: '식비',
  MATERIAL: '자재·공구',
  OTHER: '기타',
};

const SEVERITY_META: Record<CardExpenseAuditSeverity, {
  label: string;
  badge: string;
  dot: string;
}> = {
  LOW: { label: '관찰', badge: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' },
  MEDIUM: { label: '확인', badge: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  HIGH: { label: '고위험', badge: 'border-orange-200 bg-orange-50 text-orange-800', dot: 'bg-orange-500' },
  CRITICAL: { label: '긴급', badge: 'border-rose-200 bg-rose-50 text-rose-800', dot: 'bg-rose-600' },
};

const REVIEW_META: Record<CardExpenseAuditReviewStatus, { label: string; badge: string }> = {
  OPEN: { label: '미검토', badge: 'bg-slate-100 text-slate-700' },
  NORMAL: { label: '정상', badge: 'bg-emerald-100 text-emerald-800' },
  NEEDS_EVIDENCE: { label: '증빙 필요', badge: 'bg-amber-100 text-amber-800' },
  EXCEPTION: { label: '정책 예외', badge: 'bg-violet-100 text-violet-800' },
  ACKNOWLEDGED: { label: '확인 완료', badge: 'bg-blue-100 text-blue-800' },
};

const currentYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatAmount = (value: number): string => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;

const errorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error || '');
  return raw.replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[^:]+:\s*/i, '') || '요청 처리 중 오류가 발생했습니다.';
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  tone: string;
}> = ({ label, value, description, icon, tone }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
        <div className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</div>
        <div className="mt-1 text-xs font-semibold text-slate-500">{description}</div>
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
    </div>
  </div>
);

const AccessDenied: React.FC = () => (
  <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6">
    <div className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xl shadow-rose-100/40">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <ShieldX size={34} />
      </div>
      <h1 className="mt-5 text-2xl font-black text-slate-950">카드 AI 감사 접근 제한</h1>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
        이 화면과 감사 API는 CEO 또는 DEV 직책만 이용할 수 있습니다.
      </p>
      <Link to="/support/cards" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800">
        <ArrowLeft size={16} /> 카드 관리로 돌아가기
      </Link>
    </div>
  </div>
);

const PolicyModal: React.FC<{
  policy: CardExpenseAuditPolicy;
  saving: boolean;
  onClose: () => void;
  onSave: (policy: CardExpenseAuditPolicy) => Promise<void>;
}> = ({ policy, saving, onClose, onSave }) => {
  const [draft, setDraft] = useState<CardExpenseAuditPolicy>(policy);
  const setNumber = (field: keyof CardExpenseAuditPolicy, value: string) => {
    setDraft((current) => ({ ...current, [field]: Number(value.replace(/[^0-9.]/g, '')) || 0 }));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-indigo-600">
              <Settings2 size={15} /> Audit policy
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-950">카드감사 정책 설정</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">규칙 엔진의 기준과 Gemini 심층분석 범위를 설정합니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['highAmountThreshold', '고액 결제 기준', '이 금액 이상이면 고액 거래로 탐지합니다.'],
              ['receiptRequiredAmount', '영수증 필수 기준', '이 금액 이상이면 별도 영수증을 확인합니다.'],
              ['splitPaymentTotalThreshold', '분할결제 합계 기준', '동일 일자·가맹점 반복결제 합계 기준입니다.'],
              ['unusualAmountMinimum', '이상금액 최소 기준', '평소 대비 이상치 비교를 시작할 최소 금액입니다.'],
              ['newMerchantMinimum', '신규 가맹점 기준', '과거 이용 없는 가맹점을 검사할 최소 금액입니다.'],
            ].map(([field, label, description]) => (
              <label key={field} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <span className="block text-sm font-black text-slate-800">{label}</span>
                <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{description}</span>
                <div className="mt-3 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-indigo-400">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={Number(draft[field as keyof CardExpenseAuditPolicy] || 0).toLocaleString('ko-KR')}
                    onChange={(event) => setNumber(field as keyof CardExpenseAuditPolicy, event.target.value)}
                    className="h-11 min-w-0 flex-1 bg-transparent text-right text-sm font-black text-slate-900 outline-none"
                  />
                  <span className="ml-2 text-xs font-bold text-slate-400">원</span>
                </div>
              </label>
            ))}

            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="block text-sm font-black text-slate-800">과거 중앙값 배수</span>
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">동일 카드·분류의 과거 중앙값보다 설정 배수 이상이면 탐지합니다.</span>
              <div className="mt-3 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-indigo-400">
                <input type="number" min={1.1} max={20} step={0.1} value={draft.unusualAmountRatio} onChange={(event) => setNumber('unusualAmountRatio', event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-right text-sm font-black text-slate-900 outline-none" />
                <span className="ml-2 text-xs font-bold text-slate-400">배</span>
              </div>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 p-4">
            <div className="font-black text-slate-900">분류별 1건 한도</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(draft.categoryLimits).map(([category, amount]) => (
                <label key={category} className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs font-black text-slate-600">{CATEGORY_LABELS[category] || category}</span>
                  <div className="mt-2 flex items-center rounded-lg border border-slate-200 bg-white px-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={Number(amount || 0).toLocaleString('ko-KR')}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        categoryLimits: {
                          ...current.categoryLimits,
                          [category]: Number(event.target.value.replace(/[^0-9]/g, '')) || 0,
                        },
                      }))}
                      className="h-9 min-w-0 flex-1 bg-transparent text-right text-xs font-black outline-none"
                    />
                    <span className="ml-1 text-[11px] font-bold text-slate-400">원</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="flex items-center gap-2 text-sm font-black text-indigo-950"><Sparkles size={16} /> Gemini 심층분석</span>
                <span className="mt-1 block text-xs font-medium leading-5 text-indigo-700">규칙 엔진이 선별한 거래만 Gemini가 재검토하고 CEO 요약을 작성합니다.</span>
              </span>
              <input type="checkbox" checked={draft.geminiEnabled} onChange={(event) => setDraft((current) => ({ ...current, geminiEnabled: event.target.checked }))} className="mt-1 h-5 w-5 rounded border-indigo-300 text-indigo-600" />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black text-indigo-900">
                분석 시작 점수
                <input type="number" min={0} max={100} value={draft.geminiMinimumScore} onChange={(event) => setNumber('geminiMinimumScore', event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-right text-sm font-black outline-none" />
              </label>
              <label className="text-xs font-black text-indigo-900">
                월 최대 분석 거래
                <input type="number" min={1} max={100} value={draft.geminiMaximumTransactions} onChange={(event) => setNumber('geminiMaximumTransactions', event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-right text-sm font-black outline-none" />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">취소</button>
          <button type="button" onClick={() => void onSave(draft)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:bg-indigo-300">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            정책 저장
          </button>
        </div>
      </div>
    </div>
  );
};

const FindingDrawer: React.FC<{
  finding: CardExpenseAuditFinding;
  saving: boolean;
  onClose: () => void;
  onReview: (status: CardExpenseAuditReviewStatus, note: string) => Promise<void>;
}> = ({ finding, saving, onClose, onReview }) => {
  const [note, setNote] = useState(finding.reviewNote || '');
  const severity = SEVERITY_META[finding.severity];

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-slate-950/45 backdrop-blur-sm">
      <button type="button" aria-label="상세 닫기" className="h-full flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${severity.badge}`}>
                <span className={`h-2 w-2 rounded-full ${severity.dot}`} /> {severity.label} {finding.riskScore}점
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${REVIEW_META[finding.reviewStatus].badge}`}>{REVIEW_META[finding.reviewStatus].label}</span>
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-950">{finding.merchant}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{finding.date} · {finding.cardLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={19} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="text-xs font-bold text-slate-400">거래금액</div>
              <div className="mt-1 text-xl font-black">{formatAmount(finding.amount)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-400">거래일 배정</div>
              <div className="mt-1 truncate text-sm font-black text-slate-900">{finding.assignedTo}</div>
            </div>
          </div>

          <section className="mt-5">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldAlert size={17} className="text-rose-600" /> 규칙 엔진 탐지 근거</h3>
            <div className="mt-3 space-y-2">
              {finding.ruleHits.map((hit) => (
                <div key={hit.code} className="rounded-2xl border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-800">{hit.label}</span>
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700">+{hit.score}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{hit.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {finding.gemini && (
            <section className="mt-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-indigo-950"><Bot size={17} /> Gemini 재검토</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-indigo-900">{finding.gemini.summary}</p>
              {finding.gemini.reasons.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-xs font-semibold text-indigo-700">
                  {finding.gemini.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-indigo-700">
                <span className="rounded-full bg-white/80 px-2 py-1">신뢰도 {Math.round(finding.gemini.confidence * 100)}%</span>
                <span className="rounded-full bg-white/80 px-2 py-1">AI 보정 {finding.gemini.scoreAdjustment >= 0 ? '+' : ''}{finding.gemini.scoreAdjustment}</span>
                <span className="rounded-full bg-white/80 px-2 py-1">제안 {finding.gemini.suggestedAction}</span>
              </div>
            </section>
          )}

          <section className="mt-5 rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-black text-slate-900">비교 기준</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="font-bold text-slate-400">과거 비교 건수</dt><dd className="mt-1 font-black text-slate-800">{finding.baseline.historicalCount}건</dd></div>
              <div><dt className="font-bold text-slate-400">과거 중앙값</dt><dd className="mt-1 font-black text-slate-800">{formatAmount(finding.baseline.historicalMedian)}</dd></div>
              <div><dt className="font-bold text-slate-400">금액 배수</dt><dd className="mt-1 font-black text-slate-800">{finding.baseline.amountRatio ? `${finding.baseline.amountRatio.toFixed(1)}배` : '-'}</dd></div>
              <div><dt className="font-bold text-slate-400">가맹점 이용 이력</dt><dd className="mt-1 font-black text-slate-800">{finding.baseline.merchantSeenCount}건</dd></div>
            </dl>
          </section>

          <section className="mt-5">
            <label className="text-sm font-black text-slate-900" htmlFor="audit-review-note">검토 메모</label>
            <textarea id="audit-review-note" value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1000} placeholder="정상 사유, 증빙 요청사항, 정책 예외 근거를 남겨 주세요." className="mt-2 w-full resize-none rounded-2xl border border-slate-200 p-3 text-sm font-medium leading-6 text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </section>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" disabled={saving} onClick={() => void onReview('NORMAL', note)} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">정상</button>
            <button type="button" disabled={saving} onClick={() => void onReview('NEEDS_EVIDENCE', note)} className="rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-50">증빙 필요</button>
            <button type="button" disabled={saving} onClick={() => void onReview('EXCEPTION', note)} className="rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">정책 예외</button>
            <button type="button" disabled={saving} onClick={() => void onReview('ACKNOWLEDGED', note)} className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50">확인 완료</button>
          </div>
          {saving && <div className="mt-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-500"><Loader2 size={14} className="animate-spin" /> 검토결과 저장 중</div>}
        </div>
      </aside>
    </div>
  );
};

const CardExpenseAuditPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<UserData | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [dashboard, setDashboard] = useState<CardExpenseAuditDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<CardExpenseAuditFinding | null>(null);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | CardExpenseAuditSeverity>('ALL');
  const [reviewFilter, setReviewFilter] = useState<'ALL' | CardExpenseAuditReviewStatus>('OPEN');

  useEffect(() => {
    let alive = true;
    const loadProfile = async () => {
      if (!currentUser?.uid) {
        if (alive) {
          setProfile(null);
          setAccessLoading(false);
        }
        return;
      }
      setAccessLoading(true);
      try {
        const loaded = await userService.getUser(currentUser.uid);
        if (alive) setProfile(loaded);
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setAccessLoading(false);
      }
    };
    void loadProfile();
    return () => { alive = false; };
  }, [currentUser?.uid]);

  const authorized = canAccessCardExpenseAudit(profile);

  const loadDashboard = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setError('');
    try {
      setDashboard(await cardExpenseAuditService.getDashboard(yearMonth));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [authorized, yearMonth]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleRunAudit = async () => {
    setRunning(true);
    setError('');
    try {
      await cardExpenseAuditService.runAudit(yearMonth, dashboard?.policy.geminiEnabled !== false);
      await loadDashboard();
    } catch (runError) {
      setError(errorMessage(runError));
    } finally {
      setRunning(false);
    }
  };

  const handleSavePolicy = async (policy: CardExpenseAuditPolicy) => {
    setSavingPolicy(true);
    setError('');
    try {
      const savedPolicy = await cardExpenseAuditService.savePolicy(policy);
      setDashboard((current) => current ? { ...current, policy: savedPolicy } : current);
      setPolicyOpen(false);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleReview = async (status: CardExpenseAuditReviewStatus, note: string) => {
    if (!selectedFinding) return;
    setSavingReview(true);
    setError('');
    try {
      await cardExpenseAuditService.reviewFinding({
        findingId: selectedFinding.id,
        reviewStatus: status,
        reviewNote: note,
      });
      setDashboard((current) => current ? {
        ...current,
        findings: current.findings.map((finding) => finding.id === selectedFinding.id
          ? { ...finding, reviewStatus: status, reviewNote: note }
          : finding),
      } : current);
      setSelectedFinding(null);
    } catch (reviewError) {
      setError(errorMessage(reviewError));
    } finally {
      setSavingReview(false);
    }
  };

  const filteredFindings = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return (dashboard?.findings || []).filter((finding) => {
      if (severityFilter !== 'ALL' && finding.severity !== severityFilter) return false;
      if (reviewFilter !== 'ALL' && finding.reviewStatus !== reviewFilter) return false;
      if (!search) return true;
      return [finding.merchant, finding.cardLabel, finding.assignedTo, finding.category, ...finding.ruleHits.map((hit) => hit.label)]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [dashboard?.findings, keyword, reviewFilter, severityFilter]);

  if (accessLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={34} /></div>;
  }
  if (!authorized) return <AccessDenied />;

  const summary = dashboard?.latestRun?.summary;
  const unresolvedCount = dashboard?.findings.filter((finding) => finding.reviewStatus === 'OPEN').length || 0;
  const criticalCount = (summary?.severityCounts.CRITICAL || 0) + (summary?.severityCounts.HIGH || 0);

  return (
    <div className="min-h-full bg-[#f6f7fb]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200">
                <ShieldCheck size={25} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">카드 AI 감사센터</h1>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">CEO · DEV only</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-500">규칙 기반 전수검사와 Gemini 심층분석을 결합한 법인카드 감사 워크플로</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link to="/support/cards" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
                <ArrowLeft size={16} /> 카드 관리
              </Link>
              <input type="month" value={yearMonth} onChange={(event) => setYearMonth(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400" />
              <button type="button" onClick={() => setPolicyOpen(true)} disabled={!dashboard?.policy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                <Settings2 size={16} /> 정책
              </button>
              <button type="button" onClick={() => void loadDashboard()} disabled={loading || running} aria-label="새로고침" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
              <button type="button" onClick={() => void handleRunAudit()} disabled={running || loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-200 hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400">
                {running ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {running ? '감사 실행 중' : 'AI 감사 실행'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1700px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="오류 닫기"><X size={16} /></button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="감사 거래" value={(summary?.totalTransactions || 0).toLocaleString('ko-KR')} description={`${yearMonth} 전체 거래`} icon={<CreditCard size={21} />} tone="bg-indigo-50 text-indigo-700" />
          <StatCard label="확인 필요" value={unresolvedCount.toLocaleString('ko-KR')} description="아직 검토하지 않은 건" icon={<ClipboardCheck size={21} />} tone="bg-blue-50 text-blue-700" />
          <StatCard label="고위험" value={criticalCount.toLocaleString('ko-KR')} description="고위험·긴급 합계" icon={<ShieldAlert size={21} />} tone="bg-rose-50 text-rose-700" />
          <StatCard label="증빙 누락" value={(summary?.missingReceiptCount || 0).toLocaleString('ko-KR')} description="영수증 확인 대상" icon={<FileWarning size={21} />} tone="bg-amber-50 text-amber-700" />
          <StatCard label="감사 대상금액" value={formatAmount(summary?.openAmount || 0)} description={`${summary?.findingCount || 0}건 합계`} icon={<CircleDollarSign size={21} />} tone="bg-emerald-50 text-emerald-700" />
        </div>

        {dashboard?.latestRun?.geminiExecutiveSummary && (
          <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-xl shadow-indigo-100">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-300"><Bot size={17} /> Gemini CEO brief</div>
                <h2 className="mt-3 text-xl font-black">{yearMonth} 카드감사 핵심 요약</h2>
                <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-slate-200">{dashboard.latestRun.geminiExecutiveSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black text-indigo-200">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">모델 {dashboard.latestRun.geminiModel || 'Gemini'}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">규칙+AI 하이브리드</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">사람 최종검수</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase tracking-wider text-indigo-300">우선 확인 조치</div>
                <ol className="mt-3 space-y-2">
                  {(dashboard.latestRun.geminiPriorityActions || []).map((action, index) => (
                    <li key={action} className="flex gap-2 text-xs font-semibold leading-5 text-slate-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-[10px] font-black text-indigo-200">{index + 1}</span>{action}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}

        {dashboard?.latestRun?.geminiStatus === 'FAILED' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            규칙 기반 감사는 완료됐지만 Gemini 보강에 실패했습니다: {dashboard.latestRun.geminiError || 'AI 설정을 확인해 주세요.'}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><ShieldAlert size={20} className="text-indigo-600" /> 감사 확인함</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">{filteredFindings.length.toLocaleString('ko-KR')}건 표시 · 거래를 선택해 근거와 AI 재검토 결과를 확인하세요.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-[220px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="가맹점·카드·배정자 검색" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white" />
              </label>
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-slate-400" />
                <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none">
                  <option value="ALL">전체 위험도</option>
                  {Object.entries(SEVERITY_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </select>
                <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none">
                  <option value="ALL">전체 처리상태</option>
                  {Object.entries(REVIEW_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">위험도</th>
                  <th className="px-5 py-3">거래일</th>
                  <th className="px-5 py-3">카드·배정</th>
                  <th className="px-5 py-3">가맹점·분류</th>
                  <th className="px-5 py-3 text-right">금액</th>
                  <th className="px-5 py-3">핵심 탐지</th>
                  <th className="px-5 py-3">검토상태</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-16 text-center"><Loader2 size={28} className="mx-auto animate-spin text-indigo-600" /><div className="mt-3 text-sm font-bold text-slate-500">감사 결과를 불러오는 중입니다.</div></td></tr>
                ) : filteredFindings.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-16 text-center"><BadgeCheck size={40} className="mx-auto text-emerald-300" /><div className="mt-3 text-base font-black text-slate-700">조건에 맞는 감사 항목이 없습니다.</div><div className="mt-1 text-xs font-semibold text-slate-400">감사를 실행하거나 필터를 변경해 주세요.</div></td></tr>
                ) : filteredFindings.map((finding) => {
                  const severity = SEVERITY_META[finding.severity];
                  const review = REVIEW_META[finding.reviewStatus];
                  return (
                    <tr key={finding.id} onClick={() => setSelectedFinding(finding)} className="cursor-pointer bg-white transition hover:bg-indigo-50/40">
                      <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${severity.badge}`}><span className={`h-2 w-2 rounded-full ${severity.dot}`} />{severity.label} {finding.riskScore}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-bold text-slate-600">{finding.date}</td>
                      <td className="px-5 py-4"><div className="max-w-[220px] truncate font-black text-slate-900">{finding.cardLabel}</div><div className="mt-1 max-w-[220px] truncate text-xs font-semibold text-slate-500">{finding.assignedTo}</div></td>
                      <td className="px-5 py-4"><div className="max-w-[220px] truncate font-black text-slate-900">{finding.merchant}</div><div className="mt-1 text-xs font-semibold text-indigo-600">{CATEGORY_LABELS[finding.category] || finding.category}</div></td>
                      <td className={`whitespace-nowrap px-5 py-4 text-right font-mono font-black ${finding.amount < 0 ? 'text-blue-700' : 'text-slate-950'}`}>{formatAmount(finding.amount)}</td>
                      <td className="px-5 py-4"><div className="flex max-w-[330px] flex-wrap gap-1.5">{finding.ruleHits.slice(0, 3).map((hit) => <span key={hit.code} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{hit.label}</span>)}{finding.ruleHits.length > 3 && <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">+{finding.ruleHits.length - 3}</span>}</div>{finding.gemini?.summary && <div className="mt-2 max-w-[330px] truncate text-[11px] font-semibold text-indigo-600"><Sparkles size={11} className="mr-1 inline" />{finding.gemini.summary}</div>}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${review.badge}`}>{review.label}</span></td>
                      <td className="px-3 py-4 text-slate-400"><ChevronRight size={18} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600" /> AI는 의심 정황을 제시하며 부정 사용을 확정하거나 비용을 자동 제외하지 않습니다.</span>
          <span>최근 실행: {dashboard?.latestRun ? `${dashboard.latestRun.status} · ${dashboard.latestRun.geminiStatus || '규칙 검사'}` : '아직 실행되지 않음'}</span>
        </div>
      </main>

      {policyOpen && dashboard?.policy && <PolicyModal policy={dashboard.policy} saving={savingPolicy} onClose={() => setPolicyOpen(false)} onSave={handleSavePolicy} />}
      {selectedFinding && <FindingDrawer finding={selectedFinding} saving={savingReview} onClose={() => setSelectedFinding(null)} onReview={handleReview} />}
    </div>
  );
};

export default CardExpenseAuditPage;
