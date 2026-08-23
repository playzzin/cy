import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  WalletCards,
  X
} from 'lucide-react';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import MonthNavigator from '../../components/common/MonthNavigator';
import SupportTeamFilterTabs from '../../components/support/SupportTeamFilterTabs';
import { geminiService } from '../../services/geminiService';
import { officeFixedExpenseService } from '../../services/officeFixedExpenseService';
import { storageService } from '../../services/storageService';
import { teamExpenseCategoryService } from '../../services/teamExpenseCategoryService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { toast } from '../../utils/swal';
import { OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeAssignmentReference } from '../../utils/supportAssignmentTargets';
import {
  buildDefaultDate,
  formatCurrency,
  getAttendedSiteOptions,
  getCategoryLabel,
  getEffectiveClaimType,
  hexToRgba,
  normalizeColor,
  useExpenseLedgerData
} from './hooks/useExpenseLedgerData';
import type { ExpenseCategoryOption, ExpensePaymentOption } from './hooks/useExpenseLedgerData';
import type { Site } from '../../services/siteService';
import type { Team } from '../../services/teamService';
import type { OfficeFixedExpense } from '../../types/officeFixedExpense';
import type {
  TeamExpenseClaim,
  TeamExpenseClaimAttachment,
  TeamExpenseClaimCategory,
  TeamExpenseCategory,
  TeamExpenseCategoryScope,
  TeamExpenseClaimStatus,
  TeamExpenseClaimType
} from '../../types/teamExpenseLedger';
import {
  getSupportManagementYearMonth,
  rememberSupportManagementYearMonth,
  subscribeSupportManagementYearMonth,
} from '../../utils/supportManagementState';

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
  attachments: TeamExpenseClaimAttachment[];
};

type PendingExpenseAttachment = {
  id: string;
  file: File;
  previewUrl: string;
};

type ReceiptAnalysisSummary = {
  totalAmount: number;
  receiptCount: number;
  analyzedImageCount: number;
  needsReview: boolean;
};

type CategoryFormState = {
  id?: string;
  label: string;
  scope: TeamExpenseCategoryScope;
};

type FixedExpenseFormState = {
  id?: string;
  name: string;
  category: TeamExpenseClaimCategory;
  amount: number;
  dayOfMonth: number;
  startYearMonth: string;
  endYearMonth: string;
  memo: string;
  isActive: boolean;
};

interface ExpenseClaimManagementPageProps {
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400';
const labelClass = 'mb-1.5 block text-xs font-black text-slate-600';
const MAX_EXPENSE_ATTACHMENTS = 10;
const MAX_EXPENSE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const claimTypeOptions: Array<{ value: TeamExpenseClaimType; label: string; description: string }> = [
  { value: 'teamCharge', label: '후청구', description: '사용팀과 청구대상팀을 함께 기록' },
  { value: 'otherExpense', label: '기타청구', description: '해당 팀에게만 청구, 현장/결제수단 없음' },
  { value: 'officeExpense', label: '사무실경비', description: '사무실 비용으로 별도 집계' }
];

const normalizeCategoryForType = (
  category: TeamExpenseClaimCategory | undefined,
  options: ExpenseCategoryOption[],
  fallback: TeamExpenseClaimCategory
): TeamExpenseClaimCategory => {
  return category && options.some((option) => option.value === category) ? category : fallback;
};

const normalizeKey = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

const sanitizeAttachmentName = (value: unknown) =>
  String(value ?? 'photo')
    .trim()
    .replace(/[\\/#?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'photo';

const getFileExtension = (file: File) => {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();
  const fromType = file.type.split('/').pop();
  return fromType ? fromType.toLowerCase() : 'jpg';
};

const buildExpenseClaimId = () => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `team-expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildPendingAttachmentId = () =>
  `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatFileSize = (value?: number) => {
  const size = Number(value ?? 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

const makeAttachmentUploadFile = (file: File, index: number) => {
  const extension = getFileExtension(file);
  const baseName = sanitizeAttachmentName(file.name.replace(/\.[^.]+$/, ''));
  const fileName = `${Date.now()}-${index + 1}-${baseName}.${extension}`;
  return new File([file], fileName, {
    type: file.type || 'image/jpeg',
    lastModified: file.lastModified
  });
};

const getTeamId = (team: Team | undefined | null) => String(team?.id ?? (team as any)?.legacyId ?? '').trim();
const getTeamName = (team: Team | undefined | null) => String(team?.name ?? '').trim();
const getTeamColor = (team: Team | undefined | null) => normalizeColor((team as any)?.color);

const getTeamKeys = (team: Team | undefined | null) =>
  [team?.id, (team as any)?.legacyId, team?.name].map((value) => normalizeKey(value)).filter(Boolean);

const isOfficeTeamReference = (teamId?: unknown, teamName?: unknown) =>
  isOfficeAssignmentReference(teamId, teamName);

const getCategoryScopeLabel = (scope: TeamExpenseCategoryScope) => {
  if (scope === 'teamCharge') return '후청구';
  if (scope === 'otherExpense') return '기타청구';
  if (scope === 'officeExpense') return '사무실경비';
  return '공통';
};

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
  memo: '',
  attachments: []
});

const createDefaultFixedExpenseForm = (yearMonth: string): FixedExpenseFormState => ({
  name: '',
  category: 'officeExpense',
  amount: 0,
  dayOfMonth: 1,
  startYearMonth: yearMonth,
  endYearMonth: '',
  memo: '',
  isActive: true
});

const normalizeDayOfMonth = (value: unknown) => {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(31, Math.max(1, parsed));
};

const getLastDayOfMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 31;
  return new Date(year, month, 0).getDate();
};

const buildFixedExpenseClaimDate = (yearMonth: string, dayOfMonth: number) => {
  const safeDay = Math.min(normalizeDayOfMonth(dayOfMonth), getLastDayOfMonth(yearMonth));
  return `${yearMonth}-${String(safeDay).padStart(2, '0')}`;
};

const isFixedExpenseDueForMonth = (expense: OfficeFixedExpense, yearMonth: string) => {
  if (expense.isActive === false) return false;
  if (expense.startYearMonth && expense.startYearMonth > yearMonth) return false;
  if (expense.endYearMonth && expense.endYearMonth < yearMonth) return false;
  return true;
};

const buildGeneratedFixedClaimId = (expenseId: string, yearMonth: string) => (
  `office-fixed-${yearMonth}-${String(expenseId).replace(/[^a-zA-Z0-9_-]/g, '_')}`
);

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

const ExpenseClaimManagementPage: React.FC<ExpenseClaimManagementPageProps> = ({
  embedded = false,
  onDirtyChange,
}) => {
  const [yearMonth, setYearMonth] = useState(getSupportManagementYearMonth);
  const [form, setForm] = useState<ClaimFormState>(() => createDefaultForm(getSupportManagementYearMonth()));
  const [saving, setSaving] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingExpenseAttachment[]>([]);
  const [removedAttachmentPaths, setRemovedAttachmentPaths] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [analyzingReceipts, setAnalyzingReceipts] = useState(false);
  const [receiptAnalysisProgress, setReceiptAnalysisProgress] = useState({ current: 0, total: 0 });
  const [receiptAnalysisSummary, setReceiptAnalysisSummary] = useState<ReceiptAnalysisSummary | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TeamExpenseClaimType | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({ label: '', scope: 'teamCharge' });
  const [fixedExpenses, setFixedExpenses] = useState<OfficeFixedExpense[]>([]);
  const [fixedExpenseForm, setFixedExpenseForm] = useState<FixedExpenseFormState>(() => createDefaultFixedExpenseForm(getSupportManagementYearMonth()));
  const [fixedExpenseLoading, setFixedExpenseLoading] = useState(false);
  const [fixedExpenseSaving, setFixedExpenseSaving] = useState(false);
  const [fixedExpenseGenerating, setFixedExpenseGenerating] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachmentsRef = useRef<PendingExpenseAttachment[]>([]);

  const hasUnsavedChanges = useMemo(() => {
    const defaultClaim = createDefaultForm(yearMonth);
    const defaultFixedExpense = createDefaultFixedExpenseForm(yearMonth);
    const hasClaimDraft = Boolean(
      form.id
      || form.date !== defaultClaim.date
      || form.description.trim()
      || form.amount > 0
      || form.memo.trim()
      || form.attachments.length > 0
      || pendingAttachments.length > 0
      || removedAttachmentPaths.length > 0
    );
    const hasCategoryDraft = Boolean(
      categoryForm.id
      || categoryForm.label.trim()
      || categoryForm.scope !== 'teamCharge'
    );
    const hasFixedExpenseDraft = Boolean(
      fixedExpenseForm.id
      || fixedExpenseForm.name.trim()
      || fixedExpenseForm.amount > 0
      || fixedExpenseForm.dayOfMonth !== defaultFixedExpense.dayOfMonth
      || fixedExpenseForm.startYearMonth !== defaultFixedExpense.startYearMonth
      || fixedExpenseForm.endYearMonth
      || fixedExpenseForm.memo.trim()
      || fixedExpenseForm.isActive !== defaultFixedExpense.isActive
    );

    return hasClaimDraft || hasCategoryDraft || hasFixedExpenseDraft;
  }, [categoryForm, fixedExpenseForm, form, pendingAttachments.length, removedAttachmentPaths.length, yearMonth]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    rememberSupportManagementYearMonth(yearMonth);
  }, [yearMonth]);

  useEffect(() => subscribeSupportManagementYearMonth(setYearMonth), []);

  const {
    loading,
    teamOptions,
    siteOptions,
    cardLabelOptions,
    expenseCategories,
    activeExpenseCategories,
    allCategoryOptions,
    categoryOptions,
    otherClaimCategoryOptions,
    officeExpenseCategoryOptions,
    rawDocs,
    loadData
  } = useExpenseLedgerData(yearMonth, 'all', 'all', true);

  const loadFixedExpenses = useCallback(async () => {
    setFixedExpenseLoading(true);
    try {
      const rows = await officeFixedExpenseService.getExpenses({ includeInactive: true });
      setFixedExpenses(rows);
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] fixed expenses load failed', error);
      toast.error('사무실 고정경비를 불러오지 못했습니다.');
    } finally {
      setFixedExpenseLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFixedExpenses();
  }, [loadFixedExpenses]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
  }, []);

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
  const officeTeam = useMemo(
    () => teamOptions.find((team) => getTeamId(team) === OFFICE_ASSIGNMENT_TEAM_ID || normalizeKey(getTeamName(team)) === normalizeKey(OFFICE_ASSIGNMENT_TEAM_NAME)),
    [teamOptions]
  );
  const nonOfficeTeamOptions = useMemo(
    () => teamOptions.filter((team) => !isOfficeTeamReference(getTeamId(team), getTeamName(team))),
    [teamOptions]
  );
  const isOtherClaim = form.claimType === 'otherExpense';
  const officeTeamId = getTeamId(officeTeam) || OFFICE_ASSIGNMENT_TEAM_ID;
  const officeTeamName = getTeamName(officeTeam) || OFFICE_ASSIGNMENT_TEAM_NAME;
  const isOfficeExpense = form.claimType === 'officeExpense';
  const isStandaloneClaim = form.claimType !== 'teamCharge';
  const payerTeamOptions = useMemo(
    () => (isOtherClaim ? nonOfficeTeamOptions : teamOptions),
    [isOtherClaim, nonOfficeTeamOptions, teamOptions]
  );
  const payerTeamColor = getTeamColor(payerTeam);
  const chargeToTeamColor = getTeamColor(chargeToTeam);
  const formCategoryOptions = useMemo(
    () => (isOfficeExpense ? officeExpenseCategoryOptions : isOtherClaim ? otherClaimCategoryOptions : categoryOptions),
    [categoryOptions, isOfficeExpense, isOtherClaim, officeExpenseCategoryOptions, otherClaimCategoryOptions]
  );
  const defaultTeamChargeCategory = categoryOptions[0]?.value || 'etc';
  const defaultOtherClaimCategory = otherClaimCategoryOptions[0]?.value || 'etc';
  const defaultOfficeExpenseCategory = officeExpenseCategoryOptions.find((option) => option.value === 'officeExpense')?.value || officeExpenseCategoryOptions[0]?.value || 'officeExpense';
  const fixedExpenseCategoryOptions = useMemo<ExpenseCategoryOption[]>(
    () => officeExpenseCategoryOptions.length > 0
      ? officeExpenseCategoryOptions
      : [{ value: 'officeExpense', label: '사무실경비', scope: 'officeExpense', isDefault: true }],
    [officeExpenseCategoryOptions]
  );
  const defaultCategoryForCurrentType = isOfficeExpense ? defaultOfficeExpenseCategory : isOtherClaim ? defaultOtherClaimCategory : defaultTeamChargeCategory;
  const getCategoryOptionsForType = (claimType: TeamExpenseClaimType) => {
    if (claimType === 'officeExpense') return officeExpenseCategoryOptions;
    if (claimType === 'otherExpense') return otherClaimCategoryOptions;
    return categoryOptions;
  };
  const getDefaultCategoryForType = (claimType: TeamExpenseClaimType) => {
    if (claimType === 'officeExpense') return defaultOfficeExpenseCategory;
    if (claimType === 'otherExpense') return defaultOtherClaimCategory;
    return defaultTeamChargeCategory;
  };
  const normalizeFormCategory = (category: TeamExpenseClaimCategory | undefined, claimType: TeamExpenseClaimType) =>
    normalizeCategoryForType(category, getCategoryOptionsForType(claimType), getDefaultCategoryForType(claimType));
  const generatedFixedExpenseIds = useMemo(() => {
    const ids = new Set<string>();
    rawDocs.claims.forEach((claim) => {
      if (claim.sourceFixedExpenseId) ids.add(String(claim.sourceFixedExpenseId));
    });
    return ids;
  }, [rawDocs.claims]);
  const generatedFixedClaimIds = useMemo(() => new Set(rawDocs.claims.map((claim) => claim.id)), [rawDocs.claims]);
  const isFixedExpenseGenerated = useCallback(
    (expense: OfficeFixedExpense) => (
      generatedFixedExpenseIds.has(expense.id) ||
      generatedFixedClaimIds.has(buildGeneratedFixedClaimId(expense.id, yearMonth))
    ),
    [generatedFixedClaimIds, generatedFixedExpenseIds, yearMonth]
  );
  const dueFixedExpenses = useMemo(
    () => fixedExpenses.filter((expense) => isFixedExpenseDueForMonth(expense, yearMonth)),
    [fixedExpenses, yearMonth]
  );
  const pendingFixedExpenses = useMemo(
    () => dueFixedExpenses.filter((expense) => !isFixedExpenseGenerated(expense)),
    [dueFixedExpenses, isFixedExpenseGenerated]
  );

  const visiblePaymentOptions = useMemo(() => {
    if (isStandaloneClaim) return [];
    if (!form.payerTeamId) return cardLabelOptions;
    const teamKeys = new Set([form.payerTeamId, ...getTeamKeys(payerTeam)].map((value) => String(value).trim()).filter(Boolean));

    return cardLabelOptions.filter((option) => {
      if (option.kind !== 'card') return true;
      if (option.teamIds.length === 0) return true;
      return option.teamIds.some((id) => teamKeys.has(String(id).trim()) || teamKeys.has(normalizeKey(id)));
    });
  }, [cardLabelOptions, form.payerTeamId, isStandaloneClaim, payerTeam]);

  const attendedSiteOptions = useMemo(
    () => getAttendedSiteOptions(siteOptions, rawDocs.dailyReports, form.date || buildDefaultDate(yearMonth)),
    [form.date, rawDocs.dailyReports, siteOptions, yearMonth]
  );

  const findAttendedSite = (siteId?: unknown, siteName?: unknown) =>
    attendedSiteOptions.find((site) => {
      const candidateId = String(site.id ?? '').trim();
      const candidateLegacyId = String((site as any).legacyId ?? '').trim();
      const targetId = String(siteId ?? '').trim();
      const targetName = normalizeKey(siteName);
      return (
        (targetId && (candidateId === targetId || candidateLegacyId === targetId)) ||
        (targetName && normalizeKey(site.name) === targetName)
      );
    });

  useEffect(() => {
    setForm((current) => {
      const nextDate = current.date.startsWith(yearMonth) ? current.date : buildDefaultDate(yearMonth);
      return { ...current, yearMonth, date: nextDate };
    });
    setFixedExpenseForm((current) => (
      current.id ? current : { ...current, startYearMonth: yearMonth }
    ));
  }, [yearMonth]);

  useEffect(() => {
    if (!form.cardLabel || visiblePaymentOptions.length === 0) return;
    const stillVisible = visiblePaymentOptions.some((option) => option.value === form.cardLabel);
    if (!stillVisible) setForm((current) => ({ ...current, cardLabel: '현찰' }));
  }, [form.cardLabel, visiblePaymentOptions]);

  useEffect(() => {
    if (loading || isStandaloneClaim || !form.siteId) return;
    if (findAttendedSite(form.siteId, form.siteName)) return;

    setForm((current) => ({
      ...current,
      siteId: '',
      siteName: ''
    }));
  }, [attendedSiteOptions, form.siteId, form.siteName, isStandaloneClaim, loading]);

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
    if (!site || isStandaloneClaim) return;

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
    const teamName = getTeamName(team);
    setForm((current) => {
      if (current.claimType === 'officeExpense') {
        return {
          ...current,
          payerTeamId: officeTeamId,
          payerTeamName: officeTeamName,
          cardLabel: '',
          category: normalizeFormCategory(current.category, 'officeExpense')
        };
      }

      return {
        ...current,
        payerTeamId: teamId,
        payerTeamName: teamName,
        cardLabel: current.claimType !== 'teamCharge' ? '' : current.cardLabel || '현찰'
      };
    });
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
    const nextIsStandalone = claimType !== 'teamCharge';
    setForm((current) => ({
      ...current,
      claimType,
      payerTeamId: claimType === 'officeExpense'
        ? officeTeamId
        : claimType === 'otherExpense' && isOfficeTeamReference(current.payerTeamId, current.payerTeamName)
          ? ''
          : current.payerTeamId,
      payerTeamName: claimType === 'officeExpense'
        ? officeTeamName
        : claimType === 'otherExpense' && isOfficeTeamReference(current.payerTeamId, current.payerTeamName)
          ? ''
          : current.payerTeamName,
      chargeToTeamId: nextIsStandalone || isOfficeTeamReference(current.chargeToTeamId, current.chargeToTeamName) ? '' : current.chargeToTeamId,
      chargeToTeamName: nextIsStandalone || isOfficeTeamReference(current.chargeToTeamId, current.chargeToTeamName) ? '' : current.chargeToTeamName,
      siteId: nextIsStandalone ? '' : current.siteId,
      siteName: nextIsStandalone ? '' : current.siteName,
      cardLabel: nextIsStandalone ? '' : current.cardLabel || '현찰',
      category: normalizeFormCategory(current.category, claimType)
    }));
  };

  const handleSiteSelect = (siteId: string) => {
    const site = findAttendedSite(siteId);
    setForm((current) => ({
      ...current,
      siteId,
      siteName: String(site?.name ?? '')
    }));
    applyResponsibleTeam(site);
  };

  const handleSiteNameBlur = () => {
    const site = findAttendedSite(undefined, form.siteName);
    if (!site) return;

    setForm((current) => ({
      ...current,
      siteId: String(site.id ?? ''),
      siteName: String(site.name ?? '')
    }));
    applyResponsibleTeam(site);
  };

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
    setReceiptAnalysisSummary(null);
    setReceiptAnalysisProgress({ current: 0, total: 0 });
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  }, []);

  const deleteAttachmentPaths = async (paths: string[]) => {
    const uniquePaths = [...new Set(paths.map((path) => String(path ?? '').trim()).filter(Boolean))];
    await Promise.all(uniquePaths.map(async (path) => {
      try {
        await storageService.deleteFile(path);
      } catch (error) {
        console.warn('[ExpenseClaimManagementPage] attachment cleanup skipped', path, error);
      }
    }));
  };

  const appendAttachmentFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const existingCount = form.attachments.length + pendingAttachments.length;
    const capacity = Math.max(0, MAX_EXPENSE_ATTACHMENTS - existingCount);
    if (capacity <= 0) {
      toast.error(`사진은 최대 ${MAX_EXPENSE_ATTACHMENTS}장까지 첨부할 수 있습니다.`);
      return;
    }

    const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== fileList.length) {
      toast.error('이미지 파일만 첨부할 수 있습니다.');
    }

    const validFiles = imageFiles.filter((file) => file.size <= MAX_EXPENSE_ATTACHMENT_BYTES);
    if (validFiles.length !== imageFiles.length) {
      toast.error('10MB 이하의 사진만 첨부할 수 있습니다.');
    }

    const nextAttachments = validFiles.slice(0, capacity).map((file) => ({
      id: buildPendingAttachmentId(),
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    if (nextAttachments.length === 0) return;
    setReceiptAnalysisSummary(null);
    setPendingAttachments((current) => [...current, ...nextAttachments]);
  };

  const handleAttachmentInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    appendAttachmentFiles(event.target.files);
    event.target.value = '';
  };

  const removePendingAttachment = (attachmentId: string) => {
    setReceiptAnalysisSummary(null);
    setPendingAttachments((current) => {
      const target = current.find((attachment) => attachment.id === attachmentId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const handleAnalyzeReceiptAmounts = async () => {
    const attachmentsToAnalyze = [...pendingAttachments];
    if (attachmentsToAnalyze.length === 0) {
      toast.warning('먼저 인식할 영수증 사진을 선택해주세요.');
      return;
    }

    setAnalyzingReceipts(true);
    setReceiptAnalysisSummary(null);
    setReceiptAnalysisProgress({ current: 0, total: attachmentsToAnalyze.length });

    try {
      const analyses: Awaited<ReturnType<typeof geminiService.analyzeReceiptImage>>[] = [];
      for (let index = 0; index < attachmentsToAnalyze.length; index += 1) {
        const analysis = await geminiService.analyzeReceiptImage(attachmentsToAnalyze[index].file);
        analyses.push(analysis);
        setReceiptAnalysisProgress({ current: index + 1, total: attachmentsToAnalyze.length });
      }

      const recognizedReceipts = analyses.filter((analysis) => analysis.isReceipt && analysis.totalAmount > 0);
      const totalAmount = recognizedReceipts.reduce((sum, analysis) => sum + analysis.totalAmount, 0);

      if (totalAmount <= 0) {
        toast.warning('영수증의 최종 결제금액을 확인하지 못했습니다. 사진 상태를 확인하거나 금액을 직접 입력해주세요.');
        return;
      }

      const needsReview = recognizedReceipts.length !== attachmentsToAnalyze.length
        || recognizedReceipts.some((analysis) => analysis.confidence < 0.75 || Boolean(analysis.warning));

      setForm((current) => ({ ...current, amount: totalAmount }));
      setReceiptAnalysisSummary({
        totalAmount,
        receiptCount: recognizedReceipts.length,
        analyzedImageCount: attachmentsToAnalyze.length,
        needsReview
      });

      const successMessage = `영수증 ${recognizedReceipts.length}건의 총 ${formatCurrency(totalAmount)}원을 금액에 입력했습니다.`;
      if (needsReview) toast.warning(`${successMessage} 저장 전에 원본과 대조해주세요.`);
      else toast.success(successMessage);
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] receipt analysis failed', error);
      toast.error(error instanceof Error ? error.message : '영수증 총금액 인식에 실패했습니다.');
    } finally {
      setAnalyzingReceipts(false);
      setReceiptAnalysisProgress({ current: 0, total: 0 });
    }
  };

  const removeSavedAttachment = (attachment: TeamExpenseClaimAttachment) => {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((item) => item.id !== attachment.id && item.fullPath !== attachment.fullPath)
    }));
    if (attachment.fullPath) {
      setRemovedAttachmentPaths((current) => [...current, attachment.fullPath]);
    }
  };

  const uploadPendingAttachments = async (
    claimYearMonth: string,
    claimId: string
  ): Promise<TeamExpenseClaimAttachment[]> => {
    if (pendingAttachments.length === 0) return [];

    const progressById = new Map(pendingAttachments.map((attachment) => [attachment.id, 0]));
    const updateUploadProgress = (attachmentId: string, progress: number) => {
      progressById.set(attachmentId, progress);
      const total = Array.from(progressById.values()).reduce((sum, value) => sum + value, 0);
      setUploadProgress(Math.round(total / Math.max(progressById.size, 1)));
    };

    const basePath = [
      'team-expense-claims',
      sanitizeAttachmentName(claimYearMonth),
      sanitizeAttachmentName(claimId)
    ].join('/');

    return Promise.all(pendingAttachments.map(async (attachment, index) => {
      const uploadFile = makeAttachmentUploadFile(attachment.file, index);
      const uploadResult = await storageService.uploadFileInfo(
        basePath,
        uploadFile,
        (progress) => updateUploadProgress(attachment.id, progress),
        {
          includeDownloadUrl: true,
          metadata: {
            contentType: uploadFile.type || 'image/jpeg',
            customMetadata: {
              claimId,
              yearMonth: claimYearMonth,
              originalName: attachment.file.name
            }
          }
        }
      );

      return {
        id: attachment.id,
        name: attachment.file.name,
        fullPath: uploadResult.fullPath,
        url: uploadResult.url,
        size: uploadResult.size || uploadFile.size,
        contentType: uploadResult.contentType || uploadFile.type,
        uploadedAt: new Date().toISOString()
      };
    }));
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!form.date) errors.push('사용일자를 입력해주세요.');
    if (!form.payerTeamId) errors.push(isStandaloneClaim ? '청구팀을 선택해주세요.' : '사용팀을 선택해주세요.');
    if (form.claimType === 'officeExpense' && !isOfficeTeamReference(form.payerTeamId, form.payerTeamName)) errors.push('사무실경비는 청구팀을 사무실로 선택해주세요.');
    if (form.claimType === 'otherExpense' && isOfficeTeamReference(form.payerTeamId, form.payerTeamName)) errors.push('사무실은 후청구 또는 사무실경비에서만 선택할 수 있습니다.');
    if (!isStandaloneClaim && !form.cardLabel) errors.push('결제수단을 선택해주세요.');
    if (!String(form.category ?? '').trim()) errors.push('구분을 선택해주세요.');
    if (!form.description.trim()) errors.push('내용을 입력해주세요.');
    if (form.amount <= 0) errors.push('금액을 입력해주세요.');

    if (form.claimType === 'teamCharge') {
      if (!form.chargeToTeamId && !form.chargeToTeamName.trim()) errors.push('청구대상팀을 선택해주세요.');
      if (isOfficeTeamReference(form.chargeToTeamId, form.chargeToTeamName)) errors.push('후청구 청구대상팀에는 사무실을 선택할 수 없습니다.');
      if (!form.siteName.trim()) errors.push('현장명을 입력하거나 선택해주세요.');
      else if (!findAttendedSite(form.siteId, form.siteName)) errors.push('사용일자 기준 월초부터 해당일까지 출역이 입력된 현장만 선택할 수 있습니다.');
    }

    return errors;
  };

  const resetForm = (preserveContext = false) => {
    clearPendingAttachments();
    setRemovedAttachmentPaths([]);
    setUploadProgress(null);
    setForm((current) => {
      const next = createDefaultForm(yearMonth);
      if (!preserveContext) return next;

      return {
        ...next,
        claimType: current.claimType,
        payerTeamId: current.payerTeamId,
        payerTeamName: current.payerTeamName,
        cardLabel: current.claimType !== 'teamCharge' ? '' : current.cardLabel || '현찰',
        category: normalizeFormCategory(current.category, current.claimType),
        status: current.status,
        attachments: []
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
      const isStandalone = form.claimType !== 'teamCharge';
      const payer = findTeam(form.payerTeamId);
      const chargeTo = isStandalone ? undefined : findTeam(form.chargeToTeamId);
      const claimYearMonth = form.yearMonth || yearMonth;
      const claimId = form.id || buildExpenseClaimId();
      const uploadedAttachments = await uploadPendingAttachments(claimYearMonth, claimId);
      const nextAttachments = [...form.attachments, ...uploadedAttachments];

      await teamExpenseLedgerService.saveClaim({
        id: claimId,
        yearMonth: claimYearMonth,
        date: form.date,
        claimType: form.claimType,
        payerTeamId: form.payerTeamId,
        payerTeamName: getTeamName(payer) || form.payerTeamName,
        chargeToTeamId: isStandalone ? '' : form.chargeToTeamId,
        chargeToTeamName: isStandalone ? '' : getTeamName(chargeTo) || form.chargeToTeamName,
        siteId: isStandalone ? '' : form.siteId,
        siteName: isStandalone ? '' : form.siteName.trim(),
        cardLabel: isStandalone ? '' : form.cardLabel,
        category: String(form.category ?? '').trim() || defaultCategoryForCurrentType,
        description: form.description.trim(),
        amount: form.amount,
        status: form.status,
        memo: form.memo.trim(),
        attachments: nextAttachments
      });

      if (removedAttachmentPaths.length > 0) {
        await deleteAttachmentPaths(removedAttachmentPaths);
      }

      toast.success(form.id ? '후청구 내역을 수정했습니다.' : '후청구 내역을 등록했습니다.');
      resetForm(true);
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] save failed', error);
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleEdit = (claim: TeamExpenseClaim) => {
    const claimType = getEffectiveClaimType(claim);
    const isStandalone = claimType !== 'teamCharge';
    clearPendingAttachments();
    setRemovedAttachmentPaths([]);
    setUploadProgress(null);

    setForm({
      id: claim.id,
      yearMonth: claim.yearMonth || yearMonth,
      date: claim.date || buildDefaultDate(yearMonth),
      claimType,
      payerTeamId: claim.payerTeamId || '',
      payerTeamName: claim.payerTeamName || '',
      chargeToTeamId: isStandalone ? '' : claim.chargeToTeamId || '',
      chargeToTeamName: isStandalone ? '' : claim.chargeToTeamName || '',
      siteId: isStandalone ? '' : claim.siteId || '',
      siteName: isStandalone ? '' : claim.siteName || '',
      cardLabel: isStandalone ? '' : claim.cardLabel || '현찰',
      category: claim.category || getDefaultCategoryForType(claimType),
      description: claim.description || '',
      amount: Number(claim.amount || 0),
      status: claim.status || 'charged',
      memo: claim.memo || '',
      attachments: claim.attachments ?? []
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (claim: TeamExpenseClaim) => {
    const ok = window.confirm(`${claim.description} ${formatCurrency(claim.amount)}원을 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteAttachmentPaths((claim.attachments ?? []).map((attachment) => attachment.fullPath));
      await teamExpenseLedgerService.deleteClaim(claim.id);
      toast.success('후청구 내역을 삭제했습니다.');
      if (form.id === claim.id) resetForm(false);
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] delete failed', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ label: '', scope: 'teamCharge' });
  };

  const handleEditCategory = (category: TeamExpenseCategory) => {
    setCategoryForm({
      id: category.id,
      label: category.label,
      scope: category.scope
    });
  };

  const handleSaveCategory = async () => {
    const label = categoryForm.label.trim();
    if (!label) {
      toast.error('구분명을 입력해주세요.');
      return;
    }

    const duplicate = activeExpenseCategories.some(
      (category) => category.id !== categoryForm.id && normalizeKey(category.label) === normalizeKey(label)
    );
    if (duplicate) {
      toast.error('이미 같은 구분명이 있습니다.');
      return;
    }

    setCategorySaving(true);
    try {
      await teamExpenseCategoryService.saveCategory({
        id: categoryForm.id,
        label,
        scope: categoryForm.scope,
        order: categoryForm.id ? expenseCategories.find((category) => category.id === categoryForm.id)?.order : activeExpenseCategories.length * 10 + 100
      });
      toast.success(categoryForm.id ? '경비 구분을 수정했습니다.' : '경비 구분을 추가했습니다.');
      resetCategoryForm();
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] category save failed', error);
      toast.error('구분 저장에 실패했습니다.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (category: TeamExpenseCategory) => {
    const ok = window.confirm(`${category.label} 구분을 삭제할까요? 기존 경비 내역은 삭제되지 않습니다.`);
    if (!ok) return;

    setCategorySaving(true);
    try {
      await teamExpenseCategoryService.deleteCategory(category.id);
      toast.success('경비 구분을 삭제했습니다.');
      if (categoryForm.id === category.id) resetCategoryForm();
      if (form.category === category.id) {
        setForm((current) => ({
          ...current,
          category: getDefaultCategoryForType(current.claimType)
        }));
      }
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] category delete failed', error);
      toast.error('구분 삭제에 실패했습니다.');
    } finally {
      setCategorySaving(false);
    }
  };

  const resetFixedExpenseForm = () => {
    setFixedExpenseForm(createDefaultFixedExpenseForm(yearMonth));
  };

  const updateFixedExpenseForm = <K extends keyof FixedExpenseFormState>(key: K, value: FixedExpenseFormState[K]) => {
    setFixedExpenseForm((current) => ({ ...current, [key]: value }));
  };

  const handleEditFixedExpense = (expense: OfficeFixedExpense) => {
    setFixedExpenseForm({
      id: expense.id,
      name: expense.name,
      category: expense.category || defaultOfficeExpenseCategory,
      amount: Number(expense.amount || 0),
      dayOfMonth: normalizeDayOfMonth(expense.dayOfMonth),
      startYearMonth: expense.startYearMonth || yearMonth,
      endYearMonth: expense.endYearMonth || '',
      memo: expense.memo || '',
      isActive: expense.isActive !== false
    });
  };

  const handleSaveFixedExpense = async () => {
    const name = fixedExpenseForm.name.trim();
    const category = normalizeCategoryForType(fixedExpenseForm.category, fixedExpenseCategoryOptions, defaultOfficeExpenseCategory);
    const startYearMonth = String(fixedExpenseForm.startYearMonth || yearMonth).slice(0, 7);
    const endYearMonth = String(fixedExpenseForm.endYearMonth || '').slice(0, 7);

    if (!name) {
      toast.error('고정경비 항목명을 입력해주세요.');
      return;
    }
    if (fixedExpenseForm.amount <= 0) {
      toast.error('고정경비 금액을 입력해주세요.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(startYearMonth)) {
      toast.error('시작월을 선택해주세요.');
      return;
    }
    if (endYearMonth && endYearMonth < startYearMonth) {
      toast.error('종료월은 시작월보다 빠를 수 없습니다.');
      return;
    }

    setFixedExpenseSaving(true);
    try {
      await officeFixedExpenseService.saveExpense({
        id: fixedExpenseForm.id,
        name,
        category,
        amount: fixedExpenseForm.amount,
        dayOfMonth: normalizeDayOfMonth(fixedExpenseForm.dayOfMonth),
        startYearMonth,
        endYearMonth: endYearMonth || undefined,
        memo: fixedExpenseForm.memo.trim(),
        isActive: fixedExpenseForm.isActive
      });
      toast.success(fixedExpenseForm.id ? '사무실 고정경비를 수정했습니다.' : '사무실 고정경비를 추가했습니다.');
      resetFixedExpenseForm();
      await loadFixedExpenses();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] fixed expense save failed', error);
      toast.error('사무실 고정경비 저장에 실패했습니다.');
    } finally {
      setFixedExpenseSaving(false);
    }
  };

  const handleToggleFixedExpense = async (expense: OfficeFixedExpense) => {
    setFixedExpenseSaving(true);
    try {
      await officeFixedExpenseService.setExpenseActive(expense.id, expense.isActive === false);
      await loadFixedExpenses();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] fixed expense toggle failed', error);
      toast.error('사무실 고정경비 상태 변경에 실패했습니다.');
    } finally {
      setFixedExpenseSaving(false);
    }
  };

  const handleDeleteFixedExpense = async (expense: OfficeFixedExpense) => {
    const ok = window.confirm(`${expense.name} 고정경비를 비활성 처리할까요? 이미 생성된 월별 경비는 삭제되지 않습니다.`);
    if (!ok) return;

    setFixedExpenseSaving(true);
    try {
      await officeFixedExpenseService.deleteExpense(expense.id);
      if (fixedExpenseForm.id === expense.id) resetFixedExpenseForm();
      await loadFixedExpenses();
      toast.success('사무실 고정경비를 비활성 처리했습니다.');
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] fixed expense delete failed', error);
      toast.error('사무실 고정경비 비활성 처리에 실패했습니다.');
    } finally {
      setFixedExpenseSaving(false);
    }
  };

  const handleGenerateFixedExpenses = async () => {
    if (pendingFixedExpenses.length === 0) {
      toast.info('이번 달에 생성할 사무실 고정경비가 없습니다.');
      return;
    }

    setFixedExpenseGenerating(true);
    try {
      await Promise.all(pendingFixedExpenses.map((expense) => {
        const category = normalizeCategoryForType(expense.category, fixedExpenseCategoryOptions, defaultOfficeExpenseCategory);
        return teamExpenseLedgerService.saveClaim({
          id: buildGeneratedFixedClaimId(expense.id, yearMonth),
          yearMonth,
          date: buildFixedExpenseClaimDate(yearMonth, expense.dayOfMonth),
          claimType: 'officeExpense',
          payerTeamId: officeTeamId,
          payerTeamName: officeTeamName,
          chargeToTeamId: '',
          chargeToTeamName: '',
          siteId: '',
          siteName: '',
          cardLabel: '',
          category,
          description: expense.name,
          amount: expense.amount,
          status: 'charged',
          memo: expense.memo || '',
          sourceType: 'office_fixed_expense',
          sourceFixedExpenseId: expense.id,
          sourceFixedExpenseName: expense.name,
          generatedForYearMonth: yearMonth
        });
      }));
      toast.success(`사무실 고정경비 ${pendingFixedExpenses.length}건을 생성했습니다.`);
      await loadData();
    } catch (error) {
      console.error('[ExpenseClaimManagementPage] fixed expense generation failed', error);
      toast.error('사무실 고정경비 생성에 실패했습니다.');
    } finally {
      setFixedExpenseGenerating(false);
    }
  };

  const filteredClaims = useMemo(() => {
    const query = normalizeKey(searchText);

    return rawDocs.claims
      .filter((claim) => {
        if (selectedTeamId !== 'all' && !matchesTeam(claim, selectedFilterTeam)) return false;
        if (typeFilter !== 'all' && getEffectiveClaimType(claim) !== typeFilter) return false;
        if (!query) return true;

        return [
          claim.date,
          claim.payerTeamName,
          claim.chargeToTeamName,
          claim.siteName,
          claim.cardLabel,
          getCategoryLabel(claim.category, allCategoryOptions),
          claim.description,
          claim.memo,
          ...(claim.attachments ?? []).map((attachment) => attachment.name)
        ].some((value) => normalizeKey(value).includes(query));
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date), 'ko-KR'));
  }, [allCategoryOptions, rawDocs.claims, searchText, selectedFilterTeam, selectedTeamId, typeFilter]);

  const quickTotals = useMemo(() => {
    const scoped = rawDocs.claims.filter((claim) => selectedTeamId === 'all' || matchesTeam(claim, selectedFilterTeam));
    const teamChargeRows = scoped.filter((claim) => getEffectiveClaimType(claim) === 'teamCharge' && String(claim.chargeToTeamId ?? '').trim());

    return {
      total: scoped.reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      receivable: teamChargeRows
        .filter((claim) => selectedTeamId === 'all' || matchesTeam({ ...claim, chargeToTeamId: '', chargeToTeamName: '' }, selectedFilterTeam))
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      payable: teamChargeRows
        .filter((claim) => selectedTeamId === 'all' || matchesTeam({ ...claim, payerTeamId: '', payerTeamName: '' }, selectedFilterTeam))
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      other: scoped
        .filter((claim) => getEffectiveClaimType(claim) === 'otherExpense')
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0),
      office: scoped
        .filter((claim) => getEffectiveClaimType(claim) === 'officeExpense')
        .reduce((sum, claim) => sum + Number(claim.amount || 0), 0)
    };
  }, [rawDocs.claims, selectedFilterTeam, selectedTeamId]);

  const handleStandaloneYearMonthChange = (nextYearMonth: string) => {
    if (
      hasUnsavedChanges
      && !window.confirm('작성 중인 경비입력 내용이 있습니다. 저장하지 않고 조회월을 바꿀까요?')
    ) {
      return;
    }
    setYearMonth(nextYearMonth);
  };

  return (
    <div className={embedded ? 'min-h-0 w-full' : 'min-h-screen bg-slate-100 p-4 xl:p-6'}>
      <div className={embedded ? 'w-full min-w-0 space-y-3' : 'mx-auto max-w-[1900px] space-y-4'}>
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row lg:items-center lg:justify-between ${embedded ? 'gap-2 px-3 py-2' : 'gap-3 p-4'}`}>
          <div>
            <h1 className={embedded ? 'text-sm font-black text-slate-950' : 'text-xl font-black text-slate-950'}>경비 직접입력</h1>
            <p className={embedded ? 'hidden' : 'mt-1 text-sm font-medium text-slate-500'}>
              경비내역 원장과 분리된 후청구 등록, 수정, 목록, 삭제 화면입니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!embedded && (
              <div className="w-full min-w-[180px] sm:w-[180px]">
                <MonthNavigator
                  value={yearMonth}
                  onChange={handleStandaloneYearMonthChange}
                  disabled={loading}
                  ariaLabel="경비입력 조회월"
                />
              </div>
            )}
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['전체 후청구', quickTotals.total, 'bg-slate-900 text-white'],
            ['받을 후청구', quickTotals.receivable, 'bg-emerald-600 text-white'],
            ['내야 할 후청구', quickTotals.payable, 'bg-rose-600 text-white'],
            ['기타청구', quickTotals.other, 'bg-amber-500 text-white'],
            ['사무실경비', quickTotals.office, 'bg-sky-600 text-white']
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`rounded-xl border border-slate-200 px-4 py-3 shadow-sm ${tone}`}>
              <div className="text-xs font-black opacity-80">{label}</div>
              <div className="mt-1 text-xl font-black tabular-nums">
                {typeof value === 'number' ? formatCurrency(value) : value}
              </div>
            </div>
          ))}
        </div>

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <ClipboardList size={16} />
              </span>
              <div>
                <div className="text-sm font-black text-slate-900">사무실 고정경비</div>
                <div className="text-xs font-bold text-slate-500">
                  이번 달 대상 {dueFixedExpenses.length.toLocaleString('ko-KR')}건 · 미생성 {pendingFixedExpenses.length.toLocaleString('ko-KR')}건
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerateFixedExpenses}
              disabled={fixedExpenseGenerating || pendingFixedExpenses.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-black text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus size={16} />
              이번 달 생성
            </button>
          </div>

          <div className="grid gap-3 border-b border-slate-200 p-4 xl:grid-cols-[minmax(160px,1fr)_150px_150px_110px_150px_150px_minmax(180px,1fr)_auto]">
            <label>
              <span className={labelClass}>항목명</span>
              <input
                value={fixedExpenseForm.name}
                onChange={(event) => updateFixedExpenseForm('name', event.target.value)}
                className={inputClass}
                placeholder="프린터 렌탈료"
              />
            </label>
            <label>
              <span className={labelClass}>구분</span>
              <select
                value={fixedExpenseForm.category}
                onChange={(event) => updateFixedExpenseForm('category', event.target.value)}
                className={inputClass}
              >
                {fixedExpenseCategoryOptions.map((option) => (
                  <option key={`fixed-category-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>금액</span>
              <CurrencyInput
                value={fixedExpenseForm.amount}
                onChange={(value: number) => updateFixedExpenseForm('amount', value)}
                emptyWhenZero
                className={`${inputClass} text-right tabular-nums`}
                placeholder="0"
              />
            </label>
            <label>
              <span className={labelClass}>납부일</span>
              <input
                type="number"
                min={1}
                max={31}
                value={fixedExpenseForm.dayOfMonth}
                onChange={(event) => updateFixedExpenseForm('dayOfMonth', normalizeDayOfMonth(event.target.value))}
                className={`${inputClass} text-right tabular-nums`}
              />
            </label>
            <label>
              <span className={labelClass}>시작월</span>
              <input
                type="month"
                value={fixedExpenseForm.startYearMonth}
                onChange={(event) => updateFixedExpenseForm('startYearMonth', event.target.value)}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>종료월</span>
              <input
                type="month"
                value={fixedExpenseForm.endYearMonth}
                onChange={(event) => updateFixedExpenseForm('endYearMonth', event.target.value)}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>메모</span>
              <input
                value={fixedExpenseForm.memo}
                onChange={(event) => updateFixedExpenseForm('memo', event.target.value)}
                className={inputClass}
                placeholder="업체명, 결제수단"
              />
            </label>
            <div className="flex items-end gap-2">
              <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
                <input
                  type="checkbox"
                  checked={fixedExpenseForm.isActive}
                  onChange={(event) => updateFixedExpenseForm('isActive', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                활성
              </label>
              <button
                type="button"
                onClick={handleSaveFixedExpense}
                disabled={fixedExpenseSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save size={16} />
                {fixedExpenseForm.id ? '수정' : '추가'}
              </button>
              {fixedExpenseForm.id && (
                <button
                  type="button"
                  onClick={resetFixedExpenseForm}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
              )}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[920px] border-collapse text-xs">
              <thead>
                <tr className="bg-white text-slate-600">
                  <th className="border border-slate-200 px-2 py-2 text-left">항목</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">구분</th>
                  <th className="border border-slate-200 px-2 py-2 text-right">금액</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">납부일</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">기간</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">상태</th>
                  <th className="border border-slate-200 px-2 py-2 text-left">메모</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {fixedExpenses.length > 0 ? fixedExpenses.map((expense) => {
                  const due = isFixedExpenseDueForMonth(expense, yearMonth);
                  const generated = isFixedExpenseGenerated(expense);
                  const statusLabel = expense.isActive === false ? '비활성' : due ? generated ? '생성됨' : '미생성' : '기간 외';
                  const statusClass = expense.isActive === false
                    ? 'bg-slate-100 text-slate-500'
                    : due && generated
                      ? 'bg-emerald-50 text-emerald-700'
                      : due
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-50 text-slate-500';

                  return (
                    <tr key={expense.id} className={fixedExpenseForm.id === expense.id ? 'bg-sky-50/60' : 'hover:bg-slate-50'}>
                      <td className="border border-slate-200 px-2 py-2 font-black text-slate-900">{expense.name}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-600">{getCategoryLabel(expense.category, allCategoryOptions)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right font-black tabular-nums text-slate-900">{formatCurrency(expense.amount)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-bold tabular-nums">{expense.dayOfMonth}일</td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-600">
                        {expense.startYearMonth || '-'} ~ {expense.endYearMonth || '계속'}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-bold text-slate-500">{expense.memo || '-'}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleEditFixedExpense(expense)}
                            className="inline-flex h-8 w-8 items-center justify-center bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                            title="수정"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleFixedExpense(expense)}
                            disabled={fixedExpenseSaving}
                            className="inline-flex h-8 w-8 items-center justify-center border-l border-slate-200 bg-white text-slate-500 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40"
                            title={expense.isActive === false ? '활성' : '비활성'}
                          >
                            {expense.isActive === false ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFixedExpense(expense)}
                            disabled={fixedExpenseSaving || expense.isActive === false}
                            className="inline-flex h-8 w-8 items-center justify-center border-l border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="비활성"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="border border-slate-200 px-4 py-8 text-center font-bold text-slate-500">
                      {fixedExpenseLoading ? '사무실 고정경비를 불러오는 중입니다.' : '등록된 사무실 고정경비가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

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
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAttachmentInputChange}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                  <span className={labelClass}>{isStandaloneClaim ? '청구팀' : '사용팀'}</span>
                  {payerTeam && (
                    <span
                      className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: payerTeamColor }}
                    />
                  )}
                  <select
                    value={form.payerTeamId}
                    onChange={(event) => handlePayerTeamChange(event.target.value)}
                    disabled={isOfficeExpense}
                    className={inputClass}
                    style={payerTeam ? {
                      borderColor: hexToRgba(payerTeamColor, 0.35),
                      backgroundColor: hexToRgba(payerTeamColor, 0.05),
                      color: payerTeamColor,
                      paddingLeft: '2rem'
                    } : undefined}
                  >
                    <option value="">팀 선택</option>
                    {isOfficeExpense ? (
                      <option value={officeTeamId} style={{ color: getTeamColor(officeTeam) }}>
                        {officeTeamName}
                      </option>
                    ) : payerTeamOptions.map((team) => (
                      <option key={`payer-${getTeamId(team) || getTeamName(team)}`} value={getTeamId(team)} style={{ color: getTeamColor(team) }}>
                        {getTeamName(team)}
                      </option>
                    ))}
                  </select>
                </label>

                {!isStandaloneClaim && (
                  <>
                    <label>
                      <span className={labelClass}>현장 선택</span>
                      <select value={form.siteId} onChange={(event) => handleSiteSelect(event.target.value)} className={inputClass}>
                        <option value="">{attendedSiteOptions.length > 0 ? '현장 선택' : '출역 현장 없음'}</option>
                        {attendedSiteOptions.map((site) => (
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
                        {nonOfficeTeamOptions.map((team) => (
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
                  <span className={labelClass}>{isOfficeExpense ? '사무실경비 구분' : isOtherClaim ? '기타청구 구분' : '경비 구분'}</span>
                  <div className={isOtherClaim ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
                    {formCategoryOptions.map((option) => {
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

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-xs font-black text-slate-700">경비 구분 관리</div>
                      {categoryForm.id && (
                        <button
                          type="button"
                          onClick={resetCategoryForm}
                          className="text-xs font-black text-slate-500 hover:text-slate-900"
                        >
                          수정 취소
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                      <input
                        value={categoryForm.label}
                        onChange={(event) => setCategoryForm((current) => ({ ...current, label: event.target.value }))}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                        placeholder="구분명"
                      />
                      <select
                        value={categoryForm.scope}
                        onChange={(event) => setCategoryForm((current) => ({ ...current, scope: event.target.value as TeamExpenseCategoryScope }))}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                      >
                        <option value="teamCharge">후청구</option>
                        <option value="otherExpense">기타청구</option>
                        <option value="officeExpense">사무실경비</option>
                        <option value="both">공통</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleSaveCategory}
                        disabled={categorySaving}
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Save size={13} />
                        {categoryForm.id ? '수정' : '추가'}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activeExpenseCategories.map((category) => (
                        <span
                          key={category.id}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700"
                        >
                          <span>{category.label}</span>
                          <span className="text-slate-400">{getCategoryScopeLabel(category.scope)}</span>
                          <button
                            type="button"
                            onClick={() => handleEditCategory(category)}
                            className="ml-1 text-slate-400 hover:text-blue-600"
                            title="수정"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category)}
                            disabled={categorySaving}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                            title="삭제"
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
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
                    emptyWhenZero
                    className={`${inputClass} text-right tabular-nums`}
                    placeholder="금액 입력"
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                      <Paperclip size={14} />
                      사진 첨부
                      <span className="text-slate-400">
                        {form.attachments.length + pendingAttachments.length}/{MAX_EXPENSE_ATTACHMENTS}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-500">
                      영수증 사진을 선택한 뒤 Gemini 총금액 인식을 실행할 수 있습니다.
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void handleAnalyzeReceiptAmounts()}
                      disabled={saving || analyzingReceipts || pendingAttachments.length === 0}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:flex-none"
                    >
                      {analyzingReceipts ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {analyzingReceipts
                        ? `인식 중 ${receiptAnalysisProgress.current}/${receiptAnalysisProgress.total}`
                        : '총금액 인식'}
                    </button>
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={saving || analyzingReceipts || form.attachments.length + pendingAttachments.length >= MAX_EXPENSE_ATTACHMENTS}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:flex-none"
                    >
                      <UploadCloud size={14} />
                      사진 선택
                    </button>
                  </div>
                </div>

                {uploadProgress !== null && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-black text-slate-500">
                      <span>사진 업로드</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                {receiptAnalysisSummary && (
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${
                      receiptAnalysisSummary.needsReview || form.amount !== receiptAnalysisSummary.totalAmount
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {receiptAnalysisSummary.needsReview || form.amount !== receiptAnalysisSummary.totalAmount
                      ? <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                    <span>
                      Gemini가 사진 {receiptAnalysisSummary.analyzedImageCount}장 중 영수증 {receiptAnalysisSummary.receiptCount}건을 인식해 총 {formatCurrency(receiptAnalysisSummary.totalAmount)}원을 입력했습니다.
                      {form.amount !== receiptAnalysisSummary.totalAmount
                        ? ' 현재 금액은 인식 결과에서 직접 수정되었습니다.'
                        : ' 저장 전에 원본 영수증과 금액을 확인해주세요.'}
                    </span>
                  </div>
                )}

                {form.attachments.length + pendingAttachments.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {form.attachments.map((attachment) => (
                      <div key={attachment.id || attachment.fullPath} className="relative overflow-hidden rounded-lg border border-white bg-white shadow-sm">
                        {attachment.url ? (
                          <a href={attachment.url} target="_blank" rel="noreferrer" title={attachment.name}>
                            <img src={attachment.url} alt={attachment.name || '첨부 사진'} className="h-20 w-full object-cover" />
                          </a>
                        ) : (
                          <div className="flex h-20 w-full flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400">
                            <ImageIcon size={18} />
                            <span className="max-w-full truncate px-1 text-[10px] font-bold">{attachment.name}</span>
                          </div>
                        )}
                        <div className="truncate px-1.5 py-1 text-[10px] font-bold text-slate-500">
                          {attachment.name} {formatFileSize(attachment.size)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSavedAttachment(attachment)}
                          disabled={saving || analyzingReceipts}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/75 text-white disabled:bg-slate-400"
                          aria-label="첨부 사진 삭제"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {pendingAttachments.map((attachment) => (
                      <div key={attachment.id} className="relative overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
                        <img src={attachment.previewUrl} alt={attachment.file.name || '첨부 예정 사진'} className="h-20 w-full object-cover" />
                        <div className="truncate px-1.5 py-1 text-[10px] font-bold text-blue-600">
                          {attachment.file.name} {formatFileSize(attachment.file.size)}
                        </div>
                        <span className="absolute left-1 top-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                          신규
                        </span>
                        <button
                          type="button"
                          onClick={() => removePendingAttachment(attachment.id)}
                          disabled={saving || analyzingReceipts}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/75 text-white disabled:bg-slate-400"
                          aria-label="첨부 예정 사진 삭제"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                  form.claimType === 'officeExpense'
                    ? 'border-sky-200 bg-sky-50 text-sky-800'
                    : form.claimType === 'otherExpense'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}
              >
                {isStandaloneClaim ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                <span>
                  {form.claimType === 'officeExpense'
                    ? '사무실경비는 기타청구와 분리해 사무실 비용으로 별도 집계되며 현장과 결제수단은 저장하지 않습니다.'
                    : form.claimType === 'otherExpense'
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
                  disabled={analyzingReceipts}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw size={16} />
                  새 입력
                </button>
                <button
                  type="submit"
                  disabled={saving || analyzingReceipts}
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
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TeamExpenseClaimType | 'all')} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500">
                    <option value="all">전체 구분</option>
                    <option value="teamCharge">후청구</option>
                    <option value="otherExpense">기타청구</option>
                    <option value="officeExpense">사무실경비</option>
                  </select>
                </div>
              </div>
              <SupportTeamFilterTabs
                teams={teamOptions}
                selectedTeamId={selectedTeamId === 'all' ? '' : selectedTeamId}
                onChange={(teamId) => setSelectedTeamId(teamId || 'all')}
                disabled={loading}
                allLabel="전체 팀"
                className="mt-3"
              />
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
                    const claimType = getEffectiveClaimType(claim);
                    const isStandalone = claimType !== 'teamCharge';
                    const typeLabel = claimType === 'officeExpense' ? '사무실경비' : claimType === 'otherExpense' ? '기타청구' : '후청구';
                    const typeClass = claimType === 'officeExpense'
                      ? 'bg-sky-50 text-sky-700'
                      : claimType === 'otherExpense'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-indigo-50 text-indigo-700';

                    return (
                      <tr key={claim.id} className={`hover:bg-slate-50 ${form.id === claim.id ? 'bg-blue-50/60' : ''}`}>
                        <td className="border border-slate-200 px-2 py-2 text-center font-bold tabular-nums">{claim.date?.slice(5) || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${typeClass}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <TeamColorBadge name={claim.payerTeamName} color={payerColor} />
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {isStandalone ? <span className="font-bold text-slate-400">-</span> : <TeamColorBadge name={claim.chargeToTeamName} color={chargeToColor} />}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">{isStandalone ? '-' : claim.siteName || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2">
                          <div className="font-black text-slate-900">{claim.description}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <WalletCards size={12} />
                            <span>{getCategoryLabel(claim.category, allCategoryOptions)}</span>
                            {claim.memo ? <span className="truncate">· {claim.memo}</span> : null}
                          </div>
                          {(claim.attachments ?? []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(claim.attachments ?? []).map((attachment) => (
                                attachment.url ? (
                                  <a
                                    key={attachment.id || attachment.fullPath || attachment.url}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={attachment.name}
                                    className="inline-flex h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-white"
                                  >
                                    <img src={attachment.url} alt={attachment.name || '첨부 사진'} className="h-full w-full object-cover" />
                                  </a>
                                ) : (
                                  <span
                                    key={attachment.id || attachment.fullPath || attachment.name}
                                    title={attachment.name}
                                    className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-500"
                                  >
                                    <ImageIcon size={12} />
                                    {attachment.name || '첨부'}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-500">{isStandalone ? '-' : claim.cardLabel || '-'}</td>
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
