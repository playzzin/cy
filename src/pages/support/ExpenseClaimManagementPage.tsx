import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { toast } from '../../utils/swal';
import {
  CATEGORY_OPTIONS,
  OTHER_CLAIM_CATEGORY_OPTIONS,
  buildDefaultDate,
  buildDefaultYearMonth,
  formatCurrency,
  getCategoryLabel,
  hexToRgba,
  normalizeColor,
  useExpenseLedgerData
} from './hooks/useExpenseLedgerData';
import type { ExpensePaymentOption } from './hooks/useExpenseLedgerData';
import type { Site } from '../../services/siteService';
import type { Team } from '../../services/teamService';
import type {
  TeamExpenseClaim,
  TeamExpenseClaimCategory,
  TeamExpenseClaimStatus,
  TeamExpenseClaimType
} from '../../types/teamExpenseLedger';

type ClaimFormState = {
  id?: string;
  yearMonth: string;
  date: string;
  claimType: TeamExpenseClaimType;
  payerTeamId: string;
  payerTeamName: string;
  chargeToTeamId: string;
  chargeToTeamName: string;
  siteId: string;
  siteName: string;
  cardLabel: string;
  category: TeamExpenseClaimCategory;
  description: string;
  amount: number;
  status: TeamExpenseClaimStatus;
  memo: string;
};

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400';
const labelClass = 'mb-1.5 block text-xs font-black text-slate-600';

const claimTypeOptions: Array<{ value: TeamExpenseClaimType; label: string; description: string }> = [
  { value: 'teamCharge', label: '후청구', description: '사용팀과 청구대상팀을 함께 기록' },
  { value: 'otherExpense', label: '기타청구', description: '해당 팀에게만 청구, 현장/결제수단 없음' }
];

const defaultCategoryByClaimType: Record<TeamExpenseClaimType, TeamExpenseClaimCategory> = {
  teamCharge: 'meal',
  otherExpense: 'deposit'
};

const categoryValuesByClaimType: Record<TeamExpenseClaimType, TeamExpenseClaimCategory[]> = {
  teamCharge: CATEGORY_OPTIONS.map((option) => option.value),
  otherExpense: OTHER_CLAIM_CATEGORY_OPTIONS.map((option) => option.value)
};

const normalizeCategoryForType = (
  category: TeamExpenseClaimCategory | undefined,
  claimType: TeamExpenseClaimType
): TeamExpenseClaimCategory => {
  const allowedValues = categoryValuesByClaimType[claimType];
  return category && allowedValues.includes(category) ? category : defaultCategoryByClaimType[claimType];
};

const normalizeKey = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

const getTeamId = (team: Team | undefined | null) => String(team?.id ?? (team as any)?.legacyId ?? '').trim();
const getTeamName = (team: Team | undefined | null) => String(team?.name ?? '').trim();
const getTeamColor = (team: Team | undefined | null) => normalizeColor((team as any)?.color);

const getTeamKeys = (team: Team | undefined | null) =>
  [team?.id, (team as any)?.legacyId, team?.name].map((value) => normalizeKey(value)).filter(Boolean);

const TeamColorBadge: React.FC<{ name?: string; color?: string }> = ({ name, color }) => {
  if (!String(name ?? '').trim()) return <span className="font-bold text-slate-400">-</span>;

  const teamColor = normalizeColor(color);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-black"
      style={{
        backgroundColor: hexToRgba(teamColor, 0.14),
        borderColor: hexToRgba(teamColor, 0.26),
        color: teamColor
      }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: teamColor }} />
      {name}
    </span>
  );
};

const createDefaultForm = (yearMonth: string): ClaimFormState => ({
  yearMonth,
  date: buildDefaultDate(yearMonth),
  claimType: 'teamCharge',
  payerTeamId: '',
  payerTeamName: '',
  chargeToTeamId: '',
  chargeToTeamName: '',
  siteId: '',
  siteName: '',
  cardLabel: '현찰',
  category: 'meal',
  description: '',
  amount: 0,
  status: 'charged',
  memo: ''
});

const matchesTeam = (claim: TeamExpenseClaim, team: Team | undefined) => {
  if (!team) return true;
  const keys = new Set(getTeamKeys(team));
  return [
    claim.payerTeamId,
    claim.payerTeamName,
    claim.chargeToTeamId,
    claim.chargeToTeamName
  ].some((value) => keys.has(normalizeKey(value)));
};

const ExpenseClaimManagementPage: React.FC = () => {
  const [yearMonth, setYearMonth] = useState(buildDefaultYearMonth());
  const [form, setForm] = useState<ClaimFormState>(() => createDefaultForm(buildDefaultYearMonth()));
  const [saving, setSaving] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TeamExpenseClaimType | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const {
    loading,
    teamOptions,
    siteOptions,
    cardLabelOptions,
    rawDocs,
    loadData
  } = useExpenseLedgerData(yearMonth, 'all', 'all');

  const selectedFilterTeam = useMemo(
    () => teamOptions.find((team) => getTeamId(team) === selectedTeamId),
    [selectedTeamId, teamOptions]
  );

  const payerTeam = useMemo(
    () => teamOptions.find((team) => getTeamId(team) === form.payerTeamId),
    [form.payerTeamId, teamOptions]
  );
  const chargeToTeam = useMemo(
    () => teamOptions.find((team) => getTeamId(team) === form.chargeToTeamId),
    [form.chargeToTeamId, teamOptions]
  );
  const isOtherClaim = form.claimType === 'otherExpense';
  const payerTeamColor = getTeamColor(payerTeam);
  const chargeToTeamColor = getTeamColor(chargeToTeam);
  const categoryOptions = useMemo(
    () => (isOtherClaim ? OTHER_CLAIM_CATEGORY_OPTIONS : CATEGORY_OPTIONS),
    [isOtherClaim]
  );

  const visiblePaymentOptions = useMemo(() => {
    if (form.claimType === 'otherExpense') return [];
    if (!form.payerTeamId) return cardLabelOptions;
    const teamKeys = new Set([form.payerTeamId, ...getTeamKeys(payerTeam)].map((value) => String(value).trim()).filter(Boolean));

    return cardLabelOptions.filter((option) => {
      if (option.kind !== 'card') return true;
      if (option.teamIds.length === 0) return true;
      return option.teamIds.some((id) => teamKeys.has(String(id).trim()) || teamKeys.has(normalizeKey(id)));
    });
  }, [cardLabelOptions, form.claimType, form.payerTeamId, payerTeam]);

  useEffect(() => {
    setForm((current) => {
      const nextDate = current.date.startsWith(yearMonth) ? current.date : buildDefaultDate(yearMonth);
      return { ...current, yearMonth, date: nextDate };
    });
  }, [yearMonth]);

  useEffect(() => {
    if (!form.cardLabel || visiblePaymentOptions.length === 0) return;
    const stillVisible = visiblePaymentOptions.some((option) => option.value === form.cardLabel);
    if (!stillVisible) setForm((current) => ({ ...current, cardLabel: '현찰' }));
  }, [form.cardLabel, visiblePaymentOptions]);

  const updateForm = <K extends keyof ClaimFormState>(key: K, value: ClaimFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const findTeam = (teamId: string) => teamOptions.find((team) => getTeamId(team) === teamId);
  const findTeamByReference = (teamId?: unknown, teamName?: unknown) =>
    teamOptions.find((team) => {
      const keys = getTeamKeys(team);
      return keys.includes(normalizeKey(teamId)) || keys.includes(normalizeKey(teamName));
    });

  const applyResponsibleTeam = (site: Site | undefined) => {
    if (!site || form.claimType === 'otherExpense') return;

    const responsibleTeamId = String((site as any)?.responsibleTeamId ?? '').trim();
    const responsibleTeamName = String((site as any)?.responsibleTeamName ?? '').trim();
    if (!responsibleTeamId && !responsibleTeamName) return;

    const responsibleTeam = teamOptions.find((team) => {
      const ids = getTeamKeys(team);
      return ids.includes(normalizeKey(responsibleTeamId)) || ids.includes(normalizeKey(responsibleTeamName));
    });

    setForm((current) => ({
      ...current,
      chargeToTeamId: getTeamId(responsibleTeam) || responsibleTeamId,
      chargeToTeamName: getTeamName(responsibleTeam) || responsibleTeamName
    }));
  };

  const handlePayerTeamChange = (teamId: string) => {
    const team = findTeam(teamId);
    setForm((current) => ({
      ...current,
      payerTeamId: teamId,
      payerTeamName: getTeamName(team),
      cardLabel: current.claimType === 'otherExpense' ? '' : current.cardLabel || '현찰'
    }));
  };

  const handleChargeTeamChange = (teamId: string) => {
    const team = findTeam(teamId);
    setForm((current) => ({
      ...current,
      chargeToTeamId: teamId,
      chargeToTeamName: getTeamName(team)
    }));
  };

  const handleClaimTypeChange = (claimType: TeamExpenseClaimType) => {
    setForm((current) => ({
      ...current,
      claimType,
      chargeToTeamId: claimType === 'otherExpense' ? '' : current.chargeToTeamId,
      chargeToTeamName: claimType === 'otherExpense' ? '' : current.chargeToTeamName,
      siteId: claimType === 'otherExpense' ? '' : current.siteId,
      siteName: claimType === 'otherExpense' ? '' : current.siteName,
      cardLabel: claimType === 'otherExpense' ? '' : current.cardLabel || '현찰',
      category: normalizeCategoryForType(current.category, claimType)
    }));
  };

  const handleSiteSelect = (siteId: string) => {
    const site = siteOptions.find((item) => String(item.id ?? '') === siteId);
    setForm((current) => ({
      ...current,
      siteId,
      siteName: String(site?.name ?? '')
    }));
    applyResponsibleTeam(site);
  };

  const handleSiteNameBlur = () => {
    const site = siteOptions.find((item) => normalizeKey(item.name) === normalizeKey(form.siteName));
    if (!site) return;

    setForm((current) => ({
      ...current,
      siteId: String(site.id ?? ''),
      siteName: String(site.name ?? '')
    }));
    applyResponsibleTeam(site);
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!form.date) errors.push('사용일자를 입력해주세요.');
    if (!form.payerTeamId) errors.push(form.claimType === 'otherExpense' ? '청구팀을 선택해주세요.' : '사용팀을 선택해주세요.');
    if (form.claimType !== 'otherExpense' && !form.cardLabel) errors.push('결제수단을 선택해주세요.');
    if (!categoryValuesByClaimType[form.claimType].includes(form.category)) errors.push('구분을 선택해주세요.');
    if (!form.description.trim()) errors.push('내용을 입력해주세요.');
    if (form.amount <= 0) errors.push('금액을 입력해주세요.');

    if (form.claimType === 'teamCharge') {
      if (!form.chargeToTeamId && !form.chargeToTeamName.trim()) errors.push('청구대상팀을 선택해주세요.');
      if (!form.siteName.trim()) errors.push('현장명을 입력하거나 선택해주세요.');
    }

    return errors;
  };

  const resetForm = (preserveContext = false) => {
    setForm((current) => {
      const next = createDefaultForm(yearMonth);
      if (!preserveContext) return next;

      return {
        ...next,
        claimType: current.claimType,
        payerTeamId: current.payerTeamId,
        payerTeamName: current.payerTeamName,
        cardLabel: current.claimType === 'otherExpense' ? '' : current.cardLabel || '현찰',
        category: normalizeCategoryForType(current.category, current.claimType),
        status: current.status
      };
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSaving(true);
    try {
      const isOther = form.claimType === 'otherExpense';
      const payer = findTeam(form.payerTeamId);
      const chargeTo = isOther ? undefined : findTeam(form.chargeToTeamId);

      await teamExpenseLedgerService.saveClaim({
        id: form.id,
        yearMonth,
        date: form.date,
        claimType: form.claimType,
        payerTeamId: form.payerTeamId,
        payerTeamName: getTeamName(payer) || form.payerTeamName,
        chargeToTeamId: isOther ? '' : form.chargeToTeamId,
        chargeToTeamName: isOther ? '' : getTeamName(chargeTo) || form.chargeToTeamName,
        siteId: isOther ? '' : form.siteId,
        siteName: isOther ? '' : form.siteName.trim(),
        cardLabel: isOther ? '' : form.cardLabel,
        category: normalizeCategoryForType(form.category, form.claimType),
        description: form.description.trim(),
        amount: form.amount,
        status: form.status,
        memo: form.memo.trim()
      });

      toast.success(form.id ? '후청구 내역을 수정했습니다.' : '후청구 내역을 등록했습니다.');
      resetForm(true);
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] save failed', error);
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (claim: TeamExpenseClaim) => {
    const claimType = claim.claimType || 'teamCharge';
    const isOther = claimType === 'otherExpense';

    setForm({
      id: claim.id,
      yearMonth: claim.yearMonth || yearMonth,
      date: claim.date || buildDefaultDate(yearMonth),
      claimType,
      payerTeamId: claim.payerTeamId || '',
      payerTeamName: claim.payerTeamName || '',
      chargeToTeamId: isOther ? '' : claim.chargeToTeamId || '',
      chargeToTeamName: isOther ? '' : claim.chargeToTeamName || '',
      siteId: isOther ? '' : claim.siteId || '',
      siteName: isOther ? '' : claim.siteName || '',
      cardLabel: isOther ? '' : claim.cardLabel || '현찰',
      category: normalizeCategoryForType(claim.category, claimType),
      description: claim.description || '',
      amount: Number(claim.amount || 0),
      status: claim.status || 'charged',
      memo: claim.memo || ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (claim: TeamExpenseClaim) => {
    const ok = window.confirm(`${claim.description} ${formatCurrency(claim.amount)}원을 삭제할까요?`);
    if (!ok) return;

    try {
      await teamExpenseLedgerService.deleteClaim(claim.id);
      toast.success('후청구 내역을 삭제했습니다.');
      if (form.id === claim.id) resetForm(false);
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] delete failed', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const filteredClaims = useMemo(() => {
    const query = normalizeKey(searchText);

    return rawDocs.claims
      .filter((claim) => {
        if (selectedTeamId !== 'all' && !matchesTeam(claim, selectedFilterTeam)) return false;
        if (typeFilter !== 'all' && claim.claimType !== typeFilter) return false;
        if (!query) return true;

        return [
          claim.date,
          claim.payerTeamName,
          claim.chargeToTeamName,
          claim.siteName,
          claim.cardLabel,
          getCategoryLabel(claim.category),
          claim.description,
          claim.memo
        ].some((value) => normalizeKey(value).includes(query));
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date), 'ko-KR'));
  }, [rawDocs.claims, searchText, selectedFilterTeam, selectedTeamId, typeFilter]);

  const quickTotals = useMemo(() => {
    const scoped = rawDocs.claims.filter((claim) => selectedTeamId === 'all' || matchesTeam(claim, selectedFilterTeam));
    const teamChargeRows = scoped.filter((claim) => claim.claimType !== 'otherExpense' && String(claim.chargeToTeamId ?? '').trim());

    return {
      total: scoped.reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      receivable: teamChargeRows
        .filter((claim) => selectedTeamId === 'all' || matchesTeam({ ...claim, chargeToTeamId: '', chargeToTeamName: '' }, selectedFilterTeam))
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      payable: teamChargeRows
        .filter((claim) => selectedTeamId === 'all' || matchesTeam({ ...claim, payerTeamId: '', payerTeamName: '' }, selectedFilterTeam))
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      other: scoped
        .filter((claim) => claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim())
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0)
    };
  }, [rawDocs.claims, selectedFilterTeam, selectedTeamId]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 xl:p-6">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <div className="flex flex-col gap-3 border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-950">후청구 입력 관리</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              경비내역 원장과 분리된 후청구 등록, 수정, 목록, 삭제 화면입니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <YearMonthPicker
              value={yearMonth}
              onChange={setYearMonth}
              inputClassName="h-10 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['전체 후청구', quickTotals.total, 'bg-slate-900 text-white'],
            ['받을 후청구', quickTotals.receivable, 'bg-emerald-600 text-white'],
            ['내야 할 후청구', quickTotals.payable, 'bg-rose-600 text-white'],
            ['기타청구', quickTotals.other, 'bg-amber-500 text-white']
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`border border-slate-200 px-4 py-3 shadow-sm ${tone}`}>
              <div className="text-xs font-black opacity-80">{label}</div>
              <div className="mt-1 text-xl font-black tabular-nums">
                {typeof value === 'number' ? formatCurrency(value) : value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[520px_minmax(0,1fr)]">
          <section ref={formRef} className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                </span>
                {form.id ? '후청구 수정' : '새 후청구 입력'}
              </div>
              {form.id && (
                <button
                  type="button"
                  onClick={() => resetForm(false)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  <X size={14} />
                  수정 취소
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-2">
                {claimTypeOptions.map((option) => {
                  const active = form.claimType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleClaimTypeChange(option.value)}
                      className={`min-h-[72px] rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-sm font-black">{option.label}</div>
                      <div className={`mt-1 text-[11px] font-bold ${active ? 'text-slate-200' : 'text-slate-500'}`}>{option.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>사용일자</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => updateForm('date', event.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="relative">
                  <span className={labelClass}>{isOtherClaim ? '청구팀' : '사용팀'}</span>
                  {payerTeam && (
                    <span
                      className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: payerTeamColor }}
                    />
                  )}
                  <select
                    value={form.payerTeamId}
                    onChange={(event) => handlePayerTeamChange(event.target.value)}
                    className={inputClass}
                    style={payerTeam ? {
                      borderColor: hexToRgba(payerTeamColor, 0.35),
                      backgroundColor: hexToRgba(payerTeamColor, 0.05),
                      color: payerTeamColor,
                      paddingLeft: '2rem'
                    } : undefined}
                  >
                    <option value="">팀 선택</option>
                    {teamOptions.map((team) => (
                      <option key={`payer-${getTeamId(team) || getTeamName(team)}`} value={getTeamId(team)} style={{ color: getTeamColor(team) }}>
                        {getTeamName(team)}
                      </option>
                    ))}
                  </select>
                </label>

                {!isOtherClaim && (
                  <>
                    <label>
                      <span className={labelClass}>현장 선택</span>
                      <select value={form.siteId} onChange={(event) => handleSiteSelect(event.target.value)} className={inputClass}>
                        <option value="">현장 선택</option>
                        {siteOptions.map((site) => (
                          <option key={site.id || site.name} value={site.id || ''}>
                            {site.name}{(site as any).responsibleTeamName ? ` - 담당 ${(site as any).responsibleTeamName}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className={labelClass}>현장명</span>
                      <input
                        value={form.siteName}
                        onChange={(event) => updateForm('siteName', event.target.value)}
                        onBlur={handleSiteNameBlur}
                        className={inputClass}
                        placeholder="직접 입력 가능"
                      />
                    </label>

                    <label className="relative">
                      <span className={labelClass}>청구대상팀</span>
                      {chargeToTeam && (
                        <span
                          className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: chargeToTeamColor }}
                        />
                      )}
                      <select
                        value={form.chargeToTeamId}
                        onChange={(event) => handleChargeTeamChange(event.target.value)}
                        className={inputClass}
                        style={chargeToTeam ? {
                          borderColor: hexToRgba(chargeToTeamColor, 0.35),
                          backgroundColor: hexToRgba(chargeToTeamColor, 0.05),
                          color: chargeToTeamColor,
                          paddingLeft: '2rem'
                        } : undefined}
                      >
                        <option value="">팀 선택</option>
                        {teamOptions.map((team) => (
                          <option key={`charge-${getTeamId(team) || getTeamName(team)}`} value={getTeamId(team)} style={{ color: getTeamColor(team) }}>
                            {getTeamName(team)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className={labelClass}>결제수단</span>
                      <select value={form.cardLabel} onChange={(event) => updateForm('cardLabel', event.target.value)} className={inputClass}>
                        <option value="">결제수단 선택</option>
                        {visiblePaymentOptions.map((option: ExpensePaymentOption) => (
                          <option key={`${option.kind}-${option.value}-${option.label}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <div className="sm:col-span-2">
                  <span className={labelClass}>{isOtherClaim ? '기타청구 구분' : '경비 구분'}</span>
                  <div className={isOtherClaim ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
                    {categoryOptions.map((option) => {
                      const active = form.category === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateForm('category', option.value)}
                          className={`h-10 rounded-lg border text-xs font-black transition ${
                            active
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="sm:col-span-2">
                  <span className={labelClass}>내용</span>
                  <input
                    value={form.description}
                    onChange={(event) => updateForm('description', event.target.value)}
                    className={inputClass}
                    placeholder="예: 야간 식대 4명"
                  />
                </label>

                <label>
                  <span className={labelClass}>금액</span>
                  <CurrencyInput
                    value={form.amount}
                    onChange={(value: number) => updateForm('amount', value)}
                    className={`${inputClass} text-right tabular-nums`}
                    placeholder="0"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>메모</span>
                  <input
                    value={form.memo}
                    onChange={(event) => updateForm('memo', event.target.value)}
                    className={inputClass}
                    placeholder="선택 입력"
                  />
                </label>
              </div>

              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                  form.claimType === 'otherExpense'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}
              >
                {form.claimType === 'otherExpense' ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                <span>
                  {form.claimType === 'otherExpense'
                    ? '기타청구는 선택한 청구팀에게만 반영되며 현장과 결제수단은 저장하지 않습니다.'
                    : form.chargeToTeamName
                      ? `현재 청구대상: ${form.chargeToTeamName}`
                      : '현장을 선택하면 담당팀이 청구대상으로 자동 반영됩니다.'}
                </span>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => resetForm(false)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw size={16} />
                  새 입력
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save size={16} />
                  {form.id ? '수정 저장' : '등록'}
                </button>
              </div>
            </form>
          </section>

          <section className="min-w-0 border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <ClipboardList size={16} />
                  </span>
                  <div>
                    <div className="text-sm font-black text-slate-900">후청구 목록</div>
                    <div className="text-xs font-bold text-slate-500">{filteredClaims.length.toLocaleString('ko-KR')}건 표시</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500">
                    <option value="all">전체 팀</option>
                    {teamOptions.map((team) => (
                      <option key={`filter-${getTeamId(team) || getTeamName(team)}`} value={getTeamId(team)}>
                        {getTeamName(team)}
                      </option>
                    ))}
                  </select>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TeamExpenseClaimType | 'all')} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500">
                    <option value="all">전체 구분</option>
                    <option value="teamCharge">후청구</option>
                    <option value="otherExpense">기타청구</option>
                  </select>
                </div>
              </div>
              <div className="relative mt-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  placeholder="팀, 현장, 내용, 구분 검색"
                />
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="border border-slate-200 px-2 py-2 text-center">일자</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">구분</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">사용/청구팀</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">청구대상</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">현장</th>
                    <th className="border border-slate-200 px-2 py-2 text-left">내용</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">결제</th>
                    <th className="border border-slate-200 px-2 py-2 text-right">금액</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.length > 0 ? filteredClaims.map((claim) => {
                    const payer = findTeamByReference(claim.payerTeamId, claim.payerTeamName);
                    const chargeTo = findTeamByReference(claim.chargeToTeamId, claim.chargeToTeamName);
                    const payerColor = getTeamColor(payer);
                    const chargeToColor = getTeamColor(chargeTo);
                    const isOther = claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim();

                    return (
                      <tr key={claim.id} className={`hover:bg-slate-50 ${form.id === claim.id ? 'bg-blue-50/60' : ''}`}>
                        <td className="border border-slate-200 px-2 py-2 text-center font-bold tabular-nums">{claim.date?.slice(5) || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${isOther ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                            {isOther ? '기타청구' : '후청구'}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <TeamColorBadge name={claim.payerTeamName} color={payerColor} />
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {isOther ? <span className="font-bold text-slate-400">-</span> : <TeamColorBadge name={claim.chargeToTeamName} color={chargeToColor} />}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">{isOther ? '-' : claim.siteName || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2">
                          <div className="font-black text-slate-900">{claim.description}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <WalletCards size={12} />
                            <span>{getCategoryLabel(claim.category)}</span>
                            {claim.memo ? <span className="truncate">· {claim.memo}</span> : null}
                          </div>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-500">{isOther ? '-' : claim.cardLabel || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2 text-right font-black tabular-nums text-slate-900">{formatCurrency(claim.amount)}</td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleEdit(claim)}
                              className="inline-flex h-8 w-8 items-center justify-center bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                              title="수정"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(claim)}
                              className="inline-flex h-8 w-8 items-center justify-center border-l border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={9} className="border border-slate-200 px-4 py-12 text-center font-bold text-slate-500">
                        조건에 맞는 후청구 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ExpenseClaimManagementPage;
