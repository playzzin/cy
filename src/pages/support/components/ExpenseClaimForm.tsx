import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Save, RotateCcw } from 'lucide-react';
import { CurrencyInput } from '../../../components/common/CurrencyInput';
import { CATEGORY_OPTIONS, buildDefaultDate } from '../hooks/useExpenseLedgerData';
import { teamExpenseLedgerService } from '../../../services/teamExpenseLedgerService';
import { toast } from '../../../utils/swal';
import type { Team } from '../../../services/teamService';
import type { Site } from '../../../services/siteService';
import type { ExpensePaymentOption } from '../hooks/useExpenseLedgerData';
import type { TeamExpenseClaimInput } from '../../../types/teamExpenseLedger';

const claimSchema = z.object({
  yearMonth: z.string(),
  date: z.string(),
  claimType: z.enum(['teamCharge', 'otherExpense']).default('teamCharge'),
  payerTeamId: z.string().min(1, '사용한 팀을 선택해주세요.'),
  payerTeamName: z.string(),
  chargeToTeamId: z.string().optional(),
  chargeToTeamName: z.string().optional(),
  siteId: z.string().optional(),
  siteName: z.string().optional(),
  cardLabel: z.string().min(1, '사용카드/현찰을 선택해주세요.'),
  category: z.enum(['meal', 'parking', 'fuel', 'toll', 'material', 'tool', 'etc']),
  description: z.string().min(1, '내용을 입력해주세요.'),
  amount: z.number().min(1, '금액을 1원 이상 입력해주세요.'),
  status: z.enum(['draft', 'charged', 'settled']).default('draft'),
  memo: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.claimType === 'otherExpense') return;

  if (!String(data.chargeToTeamId ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chargeToTeamId'],
      message: '청구할 상대팀을 선택해주세요.'
    });
  }

  if (!String(data.siteName ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['siteName'],
      message: '현장명을 입력하거나 선택해주세요.'
    });
  }
});

type ClaimFormValues = z.infer<typeof claimSchema>;

const normalizeKey = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

interface Props {
  yearMonth: string;
  teamOptions: Team[];
  siteOptions: Site[];
  cardLabelOptions: ExpensePaymentOption[];
  defaultPayerTeamId?: string;
  onSuccess: () => void;
}

export const ExpenseClaimForm: React.FC<Props> = ({
  yearMonth,
  teamOptions,
  siteOptions,
  cardLabelOptions,
  defaultPayerTeamId,
  onSuccess
}) => {
  const { register, control, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } = useForm<ClaimFormValues>({
    resolver: zodResolver(claimSchema) as any,
    defaultValues: {
      yearMonth,
      date: buildDefaultDate(yearMonth),
      claimType: 'teamCharge',
      payerTeamId: '',
      payerTeamName: '',
      chargeToTeamId: '',
      chargeToTeamName: '',
      siteId: '',
      siteName: '',
      cardLabel: '',
      category: 'meal',
      description: '',
      amount: 0,
      status: 'draft',
      memo: ''
    }
  });

  const watchDate = watch('date');
  const watchClaimType = watch('claimType');
  const watchPayerTeamId = watch('payerTeamId');
  const watchChargeToTeamName = watch('chargeToTeamName');
  const watchSiteName = watch('siteName');
  const watchCardLabel = watch('cardLabel');
  const isOtherExpense = watchClaimType === 'otherExpense';

  const visibleCardLabelOptions = React.useMemo(() => {
    const team = teamOptions.find((item) => String(item.id ?? item.legacyId ?? '') === watchPayerTeamId);
    const teamIds = new Set(
      [team?.id, team?.legacyId, team?.name, watchPayerTeamId]
        .flatMap((value) => {
          const raw = String(value ?? '').trim();
          return raw ? [raw, normalizeKey(raw)] : [];
        })
    );
    if (!watchPayerTeamId) return cardLabelOptions;

    return cardLabelOptions.filter((option) => {
      if (option.kind !== 'card') return true;
      if (option.teamIds.length === 0) return true;
      return option.teamIds.some((id) => teamIds.has(String(id).trim()) || teamIds.has(normalizeKey(id)));
    });
  }, [cardLabelOptions, teamOptions, watchPayerTeamId]);

  useEffect(() => {
    if (!watchCardLabel) return;
    const stillVisible = visibleCardLabelOptions.some((option) => option.value === watchCardLabel);
    if (!stillVisible) setValue('cardLabel', '');
  }, [setValue, visibleCardLabelOptions, watchCardLabel]);

  useEffect(() => {
    setValue('yearMonth', yearMonth);
    if (!watchDate.startsWith(yearMonth)) {
      setValue('date', buildDefaultDate(yearMonth));
    }
  }, [yearMonth, setValue, watchDate]);

  useEffect(() => {
    if (!defaultPayerTeamId || watchPayerTeamId) return;
    const team = teamOptions.find((item) => String(item.id ?? item.legacyId ?? '') === defaultPayerTeamId);
    if (!team) return;
    setValue('payerTeamId', defaultPayerTeamId);
    setValue('payerTeamName', String(team.name ?? ''));
  }, [defaultPayerTeamId, setValue, teamOptions, watchPayerTeamId]);

  const onSubmit = async (data: ClaimFormValues) => {
    try {
      const payload: TeamExpenseClaimInput = {
        yearMonth: data.yearMonth,
        date: data.date,
        claimType: data.claimType,
        payerTeamId: data.payerTeamId,
        payerTeamName: data.payerTeamName,
        chargeToTeamId: data.claimType === 'otherExpense' ? '' : data.chargeToTeamId ?? '',
        chargeToTeamName: data.claimType === 'otherExpense' ? '' : data.chargeToTeamName ?? '',
        siteId: data.siteId ?? '',
        siteName: data.siteName ?? '',
        cardLabel: data.cardLabel,
        category: data.category,
        description: data.description,
        amount: data.amount,
        status: data.status,
        memo: data.memo
      };

      await teamExpenseLedgerService.saveClaim(payload);
      toast.success('후청구 경비가 성공적으로 등록되었습니다.');
      // Keep repetitive fields but clear specific transaction details
      reset({
        yearMonth: data.yearMonth,
        date: buildDefaultDate(yearMonth),
        claimType: data.claimType,
        payerTeamId: data.payerTeamId,
        payerTeamName: data.payerTeamName,
        chargeToTeamId: data.claimType === 'otherExpense' ? '' : data.chargeToTeamId ?? '',
        chargeToTeamName: data.claimType === 'otherExpense' ? '' : data.chargeToTeamName ?? '',
        siteId: '',
        siteName: '',
        cardLabel: data.cardLabel === '현찰' ? '현찰' : '',
        category: data.category,
        description: '',
        amount: 0,
        status: data.status,
        memo: ''
      });
      onSuccess();
    } catch (error) {
      console.error('[ExpenseClaimForm] save claim failed', error);
      toast.error('등록에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleTeamChange = (field: 'payer' | 'chargeTo', e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    const team = teamOptions.find((item) => String(item.id ?? item.legacyId ?? '') === teamId);
    if (field === 'payer') {
      setValue('payerTeamId', teamId);
      setValue('payerTeamName', String(team?.name ?? ''));
    } else if (!isOtherExpense) {
      setValue('chargeToTeamId', teamId);
      setValue('chargeToTeamName', String(team?.name ?? ''));
    } else {
      setValue('chargeToTeamId', '');
      setValue('chargeToTeamName', '');
    }
  };

  const handleClaimTypeToggle = (checked: boolean) => {
    const nextType = checked ? 'otherExpense' : 'teamCharge';
    setValue('claimType', nextType, { shouldValidate: true });
    if (checked) {
      setValue('chargeToTeamId', '', { shouldValidate: true });
      setValue('chargeToTeamName', '');
    }
  };

  const applyResponsibleTeam = (site: Site | undefined) => {
    if (!site) return;

    const responsibleTeamId = String((site as any)?.responsibleTeamId ?? '').trim();
    const responsibleTeamName = String((site as any)?.responsibleTeamName ?? '').trim();
    if (!responsibleTeamId && !responsibleTeamName) return;

    const responsibleTeam = teamOptions.find((team) => {
      const teamId = String(team.id ?? '').trim();
      const legacyId = String((team as any).legacyId ?? '').trim();
      const teamName = String(team.name ?? '').trim();
      return (
        (responsibleTeamId && (teamId === responsibleTeamId || legacyId === responsibleTeamId)) ||
        (responsibleTeamName && normalizeKey(teamName) === normalizeKey(responsibleTeamName))
      );
    });

    setValue('chargeToTeamId', String(responsibleTeam?.id ?? (responsibleTeam as any)?.legacyId ?? responsibleTeamId));
    setValue('chargeToTeamName', String(responsibleTeam?.name ?? responsibleTeamName));
  };

  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = e.target.value;
    const site = siteOptions.find((item) => String(item.id ?? '') === siteId);
    setValue('siteId', siteId);
    setValue('siteName', String(site?.name ?? ''));
    if (!isOtherExpense) applyResponsibleTeam(site);
  };

  const handleSiteNameBlur = () => {
    const site = siteOptions.find((item) => normalizeKey(item.name) === normalizeKey(watchSiteName));
    if (!site) return;
    setValue('siteId', String(site.id ?? ''));
    setValue('siteName', String(site.name ?? ''));
    if (!isOtherExpense) applyResponsibleTeam(site);
  };

  const handleReset = () => {
    const defaultTeam = defaultPayerTeamId
      ? teamOptions.find((item) => String(item.id ?? item.legacyId ?? '') === defaultPayerTeamId)
      : undefined;
    reset({
      yearMonth,
      date: buildDefaultDate(yearMonth),
      claimType: 'teamCharge',
      payerTeamId: defaultTeam ? defaultPayerTeamId ?? '' : '',
      payerTeamName: String(defaultTeam?.name ?? ''),
      chargeToTeamId: '',
      chargeToTeamName: '',
      siteId: '',
      siteName: '',
      cardLabel: '',
      category: 'meal',
      description: '',
      amount: 0,
      status: 'draft',
      memo: ''
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="p-4 border-b border-slate-200 bg-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
          <div className="bg-blue-100 p-1 rounded">
            <Plus size={16} className="text-blue-700" />
          </div>
          새 후청구 등록
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="text-xs font-bold text-red-500">
            {Object.values(errors)[0]?.message as string}
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="date"
          {...register('date')}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        />

        <select
          {...register('category')}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          {...register('payerTeamId')}
          onChange={(e) => handleTeamChange('payer', e)}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">사용한 팀</option>
          {teamOptions.map((team) => (
            <option key={`payer-${team.id || team.name}`} value={String(team.id ?? team.legacyId ?? '')}>
              {team.name}
            </option>
          ))}
        </select>

        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900 sm:col-span-2">
          <input
            type="checkbox"
            checked={isOtherExpense}
            onChange={(event) => handleClaimTypeToggle(event.target.checked)}
            className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
          />
          청구대상 없음(기타청구)
          <span className="ml-auto hidden text-[11px] font-bold text-amber-700 sm:inline">상대팀 청구 없이 사용팀 비용으로 기록</span>
        </label>

        <select
          {...register('chargeToTeamId')}
          onChange={(e) => handleTeamChange('chargeTo', e)}
          disabled={isOtherExpense}
          className={`h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors ${
            isOtherExpense ? 'bg-slate-100 text-slate-400' : 'text-slate-800'
          }`}
        >
          <option value="">{isOtherExpense ? '청구대상 없음' : '청구할 상대팀/현장 담당팀'}</option>
          {teamOptions.map((team) => (
            <option key={`charge-${team.id || team.name}`} value={String(team.id ?? team.legacyId ?? '')}>
              {team.name}
            </option>
          ))}
        </select>

        <select
          {...register('siteId')}
          onChange={handleSiteChange}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">현장 선택 (옵션)</option>
          {siteOptions.map((site) => (
            <option key={site.id || site.name} value={site.id || ''}>
              {site.name}{(site as any).responsibleTeamName ? ` - 담당 ${(site as any).responsibleTeamName}` : ''}
            </option>
          ))}
        </select>

        <input
          {...register('siteName')}
          onBlur={handleSiteNameBlur}
          placeholder="현장명 (직접입력 가능)"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        />

        <select
          {...register('cardLabel')}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">사용카드/현찰 선택</option>
          {visibleCardLabelOptions.map((option) => (
            <option key={`${option.kind}-${option.value}-${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <CurrencyInput
              value={field.value}
              onChange={(val: number) => field.onChange(val)}
              emptyWhenZero
              placeholder="청구 금액"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
            />
          )}
        />

        <input
          {...register('description')}
          placeholder="상세 내용 (예: 야간 식대 4명)"
          className="sm:col-span-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        />

        <input
          {...register('memo')}
          placeholder="추가 메모 (선택)"
          className="sm:col-span-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        />

        <select
          {...register('status')}
          className="sm:col-span-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="draft">작성중</option>
          <option value="charged">청구완료</option>
          <option value="settled">정산완료</option>
        </select>
      </div>

      <div className="mt-3 border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
        {isOtherExpense
          ? '청구대상 없음(기타청구)은 상대팀 후청구로 잡지 않고 사용팀 경비로만 반영됩니다.'
          : '현장을 선택하거나 기존 현장명을 정확히 입력하면 현장 담당팀이 청구 대상팀으로 자동 입력됩니다.'}
        {!isOtherExpense && watchChargeToTeamName ? ` 현재 청구 대상: ${watchChargeToTeamName}` : ''}
        <span className="block mt-1 text-blue-700">
          사용카드는 카드 관리에서 팀에게 직접 배정된 카드만 선택됩니다. 현찰 지출은 현찰로 입력하세요.
        </span>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={16} />
          초기화
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save size={16} />
          저장
        </button>
      </div>
    </form>
  );
};
