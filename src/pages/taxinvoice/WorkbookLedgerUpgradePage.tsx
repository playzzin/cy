import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Edit3,
  FilePlus2,
  FileText,
  Filter,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import AppIntroScreen from '../../components/common/AppIntroScreen';
import { accountDirectoryService, type AccountDirectory } from '../../services/accountDirectoryService';
import { teamService, type Team } from '../../services/teamService';
import { taxInvoiceListService } from '../../services/taxInvoiceListService';
import {
  createWorkbookLedgerService,
  type WorkbookLedgerEntry,
  type WorkbookLedgerTenant,
  type WorkbookTransactionType
} from '../../services/workbookLedgerService';
import type { TaxInvoiceIssue } from '../../types/taxInvoiceList';
import { calculateWorkbookTotalAmount, calculateWorkbookVatAmount } from '../../utils/workbookLedgerAmounts';
import { normalizeWorkbookNumber } from '../../utils/workbookLedgerParsing';
import { toast } from '../../utils/swal';
import {
  buildDefaultYearMonth,
  formatCurrency,
  getCategoryLabel,
  hexToRgba,
  normalizeColor,
  summarizeVehicleBillingCosts,
  useExpenseLedgerData
} from '../support/hooks/useExpenseLedgerData';

type ViewMode = 'all' | 'sales' | 'purchases' | 'receivable' | 'payable';
type SettlementStatus = 'all' | 'open' | 'partial' | 'settled' | 'overpaid';
type ModalType = 'salesImport' | 'purchaseImport' | 'manualEntry' | 'settlement' | 'paymentMapping' | null;
type ImportSourceType = 'taxInvoiceIssue' | 'expenseLedger';
type PaymentMappingStatus = 'linked' | 'auto' | 'ambiguous' | 'none';

interface WorkbookLedgerUpgradePageProps {
  tenantKey?: WorkbookLedgerTenant;
  companyLabel?: string;
}

interface ImportCandidate {
  sourceType: ImportSourceType;
  sourceId: string;
  sourceMonth: string;
  transactionType: WorkbookTransactionType;
  date: string;
  partnerName: string;
  siteName: string;
  description: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  teamName: string;
  note: string;
  statusLabel?: string;
  disabledReason?: string;
}

interface LedgerInvoiceRow {
  entry: WorkbookLedgerEntry;
  linkedPayments: WorkbookLedgerEntry[];
  directPaymentAmount: number;
  settledAmount: number;
  outstandingAmount: number;
  status: Exclude<SettlementStatus, 'all'>;
}

interface PaymentMatchCandidate {
  entry: WorkbookLedgerEntry;
  settledAmount: number;
  outstandingAmount: number;
  score: number;
  reasons: string[];
}

interface PaymentMappingSuggestion {
  status: PaymentMappingStatus;
  candidates: PaymentMatchCandidate[];
}

interface LedgerInvoiceRowsFilter {
  startDate?: string;
  endDate?: string;
  teamName?: string;
  partnerName?: string;
  keyword?: string;
}

interface ManualEntryDraft {
  transactionType: WorkbookTransactionType;
  date: string;
  partnerName: string;
  siteName: string;
  description: string;
  supplyAmount: string;
  taxAmount: string;
  totalAmount: string;
  teamName: string;
  note: string;
}

interface SettlementDraft {
  targetId: string;
  date: string;
  amount: string;
  note: string;
}

interface KbTransferPreviewRow {
  rowId: string;
  partnerName: string;
  siteName: string;
  bankCode: string;
  bankCodeDisplay: string;
  bankCodeNeedsFix: boolean;
  bankCodeReason: string;
  accountNumber: string;
  amount: number;
  receiverDisplay: string;
  memoDisplay: string;
}

const sourceLabels: Record<string, string> = {
  taxInvoiceIssue: '발행리스트',
  expenseLedger: '경비내역',
  manual: '수기',
  manualSettlement: '입금/지급'
};

const teamFallbackColors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be123c', '#4f46e5'];

const normalizeText = (value: unknown) => String(value ?? '').trim();

const normalizeKey = (value: unknown) => normalizeText(value).replace(/\s+/g, '').toLowerCase();

const normalizeBankName = (value: unknown) => normalizeText(value).toLowerCase().replace(/\s+/g, '');

const normalizePartnerMatchKey = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\(주\)|㈜|주식회사/g, '')
  .replace(/\s+/g, '')
  .replace(/[^0-9a-z가-힣]/g, '');

const KB_BANK_CODE_BY_NAME = new Map<string, string>([
  ['한국은행', '001'],
  ['산업은행', '002'], ['kdb', '002'],
  ['기업은행', '003'], ['기업', '003'], ['ibk', '003'], ['ibk기업은행', '003'], ['ibk기업', '003'],
  ['국민은행', '004'], ['국민', '004'], ['kb국민', '004'], ['kb국민은행', '004'], ['kb', '004'],
  ['수협은행', '007'], ['수협', '007'], ['sh수협', '007'],
  ['수출입은행', '008'],
  ['농협은행', '011'], ['nh농협은행', '011'], ['nh농협', '011'], ['농협', '011'],
  ['지역농협', '012'], ['농축협', '012'],
  ['우리은행', '020'], ['우리', '020'],
  ['sc제일은행', '023'], ['제일은행', '023'], ['sc', '023'],
  ['한국씨티은행', '027'], ['씨티은행', '027'], ['씨티', '027'],
  ['대구은행', '031'], ['im뱅크', '031'], ['dgb', '031'],
  ['부산은행', '032'], ['bnk부산', '032'],
  ['광주은행', '034'],
  ['제주은행', '035'],
  ['전북은행', '037'],
  ['경남은행', '039'], ['bnk경남', '039'],
  ['새마을금고', '045'], ['mg새마을', '045'], ['mg', '045'],
  ['신협', '048'],
  ['상호저축은행', '050'], ['저축은행', '050'],
  ['우체국', '071'], ['우체국예금', '071'],
  ['하나은행', '081'], ['keb하나', '081'], ['하나', '081'],
  ['신한은행', '088'], ['신한', '088'],
  ['케이뱅크', '089'], ['k뱅크', '089'],
  ['카카오뱅크', '090'], ['카카오', '090'],
  ['토스뱅크', '092'], ['토스', '092']
]);

const analyzeKbBank = (bankName: unknown) => {
  const normalized = normalizeBankName(bankName);
  const raw = normalizeText(bankName);
  if (!normalized) {
    return {
      code: '',
      display: raw || '(은행명없음)',
      needsFix: true,
      reason: '은행명이 비어있거나 형식이 올바르지 않습니다.'
    };
  }

  if (/^\d{3}$/.test(normalized)) {
    return {
      code: normalized,
      display: normalized,
      needsFix: false,
      reason: ''
    };
  }

  const candidates = Array.from(KB_BANK_CODE_BY_NAME.entries())
    .filter(([name]) => {
      const key = normalizeBankName(name);
      return key && (normalized.includes(key) || key.includes(normalized));
    })
    .map(([name, code]) => ({ name, code }));

  if (candidates.length === 1) {
    return {
      code: candidates[0].code,
      display: candidates[0].code,
      needsFix: false,
      reason: ''
    };
  }

  if (candidates.length > 1) {
    const ranked = candidates
      .map((candidate) => {
        const key = normalizeBankName(candidate.name);
        let score = 0;
        if (/은행|뱅크/.test(candidate.name)) score += 40;
        if (/저축은행/.test(candidate.name)) score -= 15;
        if (key === normalized) score += 50;
        else if (key.startsWith(normalized)) score += 20;
        else if (key.includes(normalized)) score += 10;
        return { ...candidate, score };
      })
      .sort((a, b) => b.score - a.score);

    if (ranked[0] && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
      return {
        code: ranked[0].code,
        display: ranked[0].code,
        needsFix: false,
        reason: ''
      };
    }

    return {
      code: '',
      display: raw || '(은행명없음)',
      needsFix: true,
      reason: `유사 후보 다수: ${ranked.slice(0, 4).map((item) => `${item.name}(${item.code})`).join(', ')}`
    };
  }

  return {
    code: '',
    display: raw || '(은행명없음)',
    needsFix: true,
    reason: '등록된 은행명/별칭과 일치하는 코드가 없습니다.'
  };
};

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const createClientSourceId = (prefix: string) => {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}:${randomId}`;
};

const buildSourceEntryId = (sourceType: string, sourceId: string) => {
  const safeSource = encodeURIComponent(sourceId).replace(/%/g, '').slice(0, 80);
  return `workbook-upgrade-${sourceType}-${hashText(sourceId)}-${safeSource}`;
};

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const monthEndDate = (yearMonth: string) => {
  const [rawYear, rawMonth] = yearMonth.split('-').map(Number);
  const year = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear();
  const month = Number.isFinite(rawMonth) ? rawMonth : new Date().getMonth() + 1;
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseAmount = (value: unknown) => {
  return normalizeWorkbookNumber(value, 0);
};

const fingerprint = (entry: Pick<WorkbookLedgerEntry, 'transactionType' | 'date' | 'partnerName' | 'siteName' | 'totalAmount' | 'teamName'>) => [
  entry.transactionType,
  normalizeText(entry.date),
  normalizeKey(entry.partnerName),
  normalizeKey(entry.siteName),
  Math.round(parseAmount(entry.totalAmount)),
  normalizeKey(entry.teamName)
].join('|');

const candidateFingerprint = (candidate: ImportCandidate) => fingerprint(candidate);

const buildSourceKey = (sourceType: string, sourceId: string) => `${sourceType}:${sourceId}`;

const hashColor = (value: string) => {
  const key = normalizeText(value);
  if (!key) return '#64748b';
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 2147483647;
  }
  return teamFallbackColors[hash % teamFallbackColors.length];
};

const getAppliedParts = (date: string, sourceMonth?: string) => {
  const base = normalizeText(date).slice(0, 7) || normalizeText(sourceMonth);
  const [year, month] = base.split('-').map(Number);
  return {
    appliedYear: Number.isFinite(year) ? year : null,
    appliedMonth: Number.isFinite(month) ? month : null
  };
};

const getEntryAppliedParts = (entry: WorkbookLedgerEntry) => {
  const derived = getAppliedParts(entry.date, entry.sourceMonth);
  return {
    appliedYear: entry.appliedYear ?? derived.appliedYear,
    appliedMonth: entry.appliedMonth ?? derived.appliedMonth
  };
};


const isSettlementViewMode = (viewMode: ViewMode) => viewMode === 'receivable' || viewMode === 'payable';

const isDateInRange = (date: unknown, startDate: string, endDate: string) => {
  const normalizedDate = normalizeText(date).slice(0, 10);
  if (!normalizedDate) return false;
  if (startDate && normalizedDate < startDate) return false;
  if (endDate && normalizedDate > endDate) return false;
  return true;
};

const isDateOnOrBefore = (date: unknown, cutoffDate: string) => {
  const normalizedDate = normalizeText(date).slice(0, 10);
  return Boolean(normalizedDate && cutoffDate && normalizedDate <= cutoffDate);
};

const isInvoiceEntry = (entry: WorkbookLedgerEntry) => parseAmount(entry.totalAmount) > 0;

const isNegativeInvoiceEntry = (entry: WorkbookLedgerEntry) => parseAmount(entry.totalAmount) < 0;

const isPaymentEntry = (entry: WorkbookLedgerEntry) => parseAmount(entry.paymentAmount) > 0;

const isStandalonePaymentEntry = (entry: WorkbookLedgerEntry) => isPaymentEntry(entry) && parseAmount(entry.totalAmount) <= 0;

const isUnmappedPaymentEntry = (entry: WorkbookLedgerEntry) => isStandalonePaymentEntry(entry) && !normalizeText(entry.matchedEntryId);

const sortLedgerEntriesByDate = (left: WorkbookLedgerEntry, right: WorkbookLedgerEntry) => {
  const dateCompare = normalizeText(left.date).localeCompare(normalizeText(right.date), 'ko-KR');
  if (dateCompare !== 0) return dateCompare;
  const createdCompare = normalizeText(left.createdAt).localeCompare(normalizeText(right.createdAt), 'ko-KR');
  if (createdCompare !== 0) return createdCompare;
  return normalizeText(left.id).localeCompare(normalizeText(right.id), 'ko-KR');
};

const getWorkbookEntryKey = (entry: Pick<WorkbookLedgerEntry, 'id' | 'date' | 'partnerName' | 'description'>) => (
  normalizeText(entry.id) || `${normalizeText(entry.date)}-${normalizeText(entry.partnerName)}-${normalizeText(entry.description)}`
);

const getSettlementStatus = (totalAmount: number, settledAmount: number): Exclude<SettlementStatus, 'all'> => {
  const outstandingAmount = totalAmount - settledAmount;
  if (settledAmount - totalAmount > 0) return 'overpaid';
  if (outstandingAmount <= 0) return 'settled';
  if (settledAmount > 0) return 'partial';
  return 'open';
};

const buildPaymentMatchCandidates = (
  invoiceRows: LedgerInvoiceRow[],
  paymentEntry: WorkbookLedgerEntry,
  options?: { relaxed?: boolean }
): PaymentMatchCandidate[] => {
  const paymentAmount = parseAmount(paymentEntry.paymentAmount);
  const paymentDate = normalizeText(paymentEntry.date);
  const partnerKey = normalizePartnerMatchKey(paymentEntry.partnerName);
  const normalizedSiteName = normalizeText(paymentEntry.siteName).toLowerCase();
  const normalizedTeamName = normalizeText(paymentEntry.teamName).toLowerCase();
  const paymentApplied = getEntryAppliedParts(paymentEntry);
  const relaxed = options?.relaxed ?? false;

  if (paymentAmount <= 0 || !partnerKey) return [];

  return invoiceRows
    .filter((row) => {
      const entry = row.entry;
      if (!entry.id || entry.id === paymentEntry.id) return false;
      if (entry.transactionType !== paymentEntry.transactionType) return false;
      if (normalizePartnerMatchKey(entry.partnerName) !== partnerKey) return false;
      if (paymentDate && normalizeText(entry.date) > paymentDate) return false;
      if (!relaxed && normalizedSiteName && normalizeText(entry.siteName).toLowerCase() !== normalizedSiteName) return false;
      if (!relaxed && normalizedTeamName && normalizeText(entry.teamName).toLowerCase() !== normalizedTeamName) return false;

      const invoiceApplied = getEntryAppliedParts(entry);
      if (!relaxed && paymentApplied.appliedYear !== null && invoiceApplied.appliedYear !== paymentApplied.appliedYear) return false;
      if (!relaxed && paymentApplied.appliedMonth !== null && invoiceApplied.appliedMonth !== paymentApplied.appliedMonth) return false;

      return true;
    })
    .map((row) => {
      const entry = row.entry;
      const outstandingAmount = Math.max(row.outstandingAmount, 0);
      const reasons: string[] = [];
      let score = 0;

      if (Math.abs(parseAmount(entry.totalAmount) - paymentAmount) < 0.5) {
        score += 1000;
        reasons.push('합계 일치');
      }

      if (Math.abs(outstandingAmount - paymentAmount) < 0.5) {
        score += 900;
        reasons.push('잔액 일치');
      }

      if (normalizedSiteName && normalizeText(entry.siteName).toLowerCase() === normalizedSiteName) {
        score += 120;
        reasons.push('현장 일치');
      }

      if (normalizedTeamName && normalizeText(entry.teamName).toLowerCase() === normalizedTeamName) {
        score += 40;
        reasons.push('팀 일치');
      }

      const invoiceApplied = getEntryAppliedParts(entry);
      if (paymentApplied.appliedYear !== null && invoiceApplied.appliedYear === paymentApplied.appliedYear) score += 30;
      if (paymentApplied.appliedMonth !== null && invoiceApplied.appliedMonth === paymentApplied.appliedMonth) {
        score += 80;
        reasons.push('적용월 일치');
      }

      if (paymentDate) {
        const invoiceDate = normalizeText(entry.date);
        const dayGap = invoiceDate
          ? Math.abs(new Date(paymentDate).getTime() - new Date(invoiceDate).getTime()) / 86400000
          : 3650;
        score += Math.max(0, 70 - Math.min(dayGap, 70));
      }

      if (outstandingAmount <= 0) score -= 300;

      return {
        entry,
        settledAmount: row.settledAmount,
        outstandingAmount,
        score,
        reasons: reasons.length > 0 ? reasons : ['거래처 일치']
      };
    })
    .sort((left, right) => {
      const scoreCompare = right.score - left.score;
      if (scoreCompare !== 0) return scoreCompare;
      const dateCompare = normalizeText(right.entry.date).localeCompare(normalizeText(left.entry.date), 'ko-KR');
      if (dateCompare !== 0) return dateCompare;
      return normalizeText(left.entry.id).localeCompare(normalizeText(right.entry.id), 'ko-KR');
    });
};

const getPaymentMappingSuggestion = (
  invoiceRows: LedgerInvoiceRow[],
  paymentEntry: WorkbookLedgerEntry
): PaymentMappingSuggestion => {
  if (normalizeText(paymentEntry.matchedEntryId)) {
    return { status: 'linked', candidates: [] };
  }

  const strictCandidates = buildPaymentMatchCandidates(invoiceRows, paymentEntry);
  const paymentAmount = parseAmount(paymentEntry.paymentAmount);
  const exactCandidates = strictCandidates.filter((candidate) => (
    Math.abs(parseAmount(candidate.entry.totalAmount) - paymentAmount) < 0.5 ||
    Math.abs(candidate.outstandingAmount - paymentAmount) < 0.5
  ));

  if (exactCandidates.length === 1) {
    return { status: 'auto', candidates: exactCandidates };
  }

  if (strictCandidates.length === 1) {
    return { status: 'auto', candidates: strictCandidates };
  }

  if (strictCandidates.length > 1) {
    return { status: 'ambiguous', candidates: strictCandidates };
  }

  const relaxedCandidates = buildPaymentMatchCandidates(invoiceRows, paymentEntry, { relaxed: true });
  if (relaxedCandidates.length > 0) {
    return { status: 'ambiguous', candidates: relaxedCandidates };
  }

  return { status: 'none', candidates: [] };
};

const getPaymentMappingStatusLabel = (status: PaymentMappingStatus) => {
  if (status === 'linked') return '연결됨';
  if (status === 'auto') return '자동추천';
  if (status === 'ambiguous') return '후보다수';
  return '후보없음';
};

const getPaymentMappingStatusClass = (status: PaymentMappingStatus) => {
  if (status === 'auto') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'ambiguous') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'linked') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const buildDuplicateGuards = (ledgerEntries: WorkbookLedgerEntry[]) => {
  const sourceKeys = new Set<string>();
  const fingerprints = new Set<string>();

  ledgerEntries.forEach((entry) => {
    const sourceType = normalizeText(entry.sourceType);
    const sourceId = normalizeText(entry.sourceId);
    if (sourceType && sourceId) sourceKeys.add(buildSourceKey(sourceType, sourceId));
    if (isInvoiceEntry(entry)) fingerprints.add(fingerprint(entry));
  });

  return { sourceKeys, fingerprints };
};

const buildCandidateEntry = (candidate: ImportCandidate, userId?: string): Omit<WorkbookLedgerEntry, 'createdAt' | 'updatedAt'> => {
  const applied = getAppliedParts(candidate.date, candidate.sourceMonth);
  return {
    id: buildSourceEntryId(candidate.sourceType, candidate.sourceId),
    transactionType: candidate.transactionType,
    date: candidate.date,
    partnerName: candidate.partnerName,
    siteName: candidate.siteName,
    description: candidate.description,
    manDays: null,
    supplyAmount: candidate.supplyAmount,
    taxAmount: candidate.taxAmount,
    totalAmount: candidate.totalAmount,
    paymentAmount: 0,
    appliedYear: applied.appliedYear,
    appliedMonth: applied.appliedMonth,
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId,
    sourceMonth: candidate.sourceMonth,
    note: candidate.note,
    teamName: candidate.teamName,
    createdBy: userId ?? '',
    updatedBy: userId ?? ''
  };
};

const getStatusLabel = (status: LedgerInvoiceRow['status']) => {
  if (status === 'settled') return '완료';
  if (status === 'partial') return '부분';
  if (status === 'overpaid') return '초과';
  return '미결';
};

const getStatusClass = (status: LedgerInvoiceRow['status']) => {
  if (status === 'settled') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'overpaid') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-white text-slate-600';
};

const createEmptyManualDraft = (): ManualEntryDraft => ({
  transactionType: '매출',
  date: todayString(),
  partnerName: '',
  siteName: '',
  description: '',
  supplyAmount: '',
  taxAmount: '',
  totalAmount: '',
  teamName: '',
  note: ''
});

const createEmptySettlementDraft = (): SettlementDraft => ({
  targetId: '',
  date: todayString(),
  amount: '',
  note: ''
});

const TeamBadge: React.FC<{ name?: string; color: string }> = ({ name, color }) => (
  <span
    className="inline-flex max-w-[160px] items-center gap-2 rounded-md border px-2 py-1 text-xs font-bold text-slate-800"
    style={{ backgroundColor: hexToRgba(color, 0.1), borderColor: hexToRgba(color, 0.28) }}
  >
    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
    <span className="truncate">{name || '팀 미지정'}</span>
  </span>
);

const MetricTile: React.FC<{
  label: string;
  value: number;
  tone: 'sales' | 'purchase' | 'receive' | 'payable' | 'settled' | 'neutral';
  icon: React.ReactNode;
}> = ({ label, value, tone, icon }) => {
  const toneClass = {
    sales: 'border-blue-200 bg-blue-50 text-blue-700',
    purchase: 'border-violet-200 bg-violet-50 text-violet-700',
    receive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    payable: 'border-rose-200 bg-rose-50 text-rose-700',
    settled: 'border-amber-200 bg-amber-50 text-amber-700',
    neutral: 'border-slate-200 bg-white text-slate-700'
  }[tone];

  return (
    <div className="min-h-[96px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${toneClass}`}>{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-black tabular-nums text-slate-950">{formatCurrency(value)}</div>
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-[180px] items-center justify-center border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-400">
    {label}
  </div>
);

const modalOverlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm';
const modalPanelClass = 'max-h-[92vh] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl';
const modalInputClass = 'mt-1.5 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const modalLabelClass = 'text-xs font-black uppercase tracking-normal text-slate-500';
const modalSectionClass = 'rounded-md border border-slate-200 bg-white p-4 shadow-sm';

const summarizeLedgerRows = (rows: LedgerInvoiceRow[]) => rows.reduce(
  (acc, row) => {
    const total = parseAmount(row.entry.totalAmount);
    const settled = row.settledAmount;
    if (row.entry.transactionType === '매출') {
      acc.sales += total;
      acc.receivable += row.outstandingAmount;
      acc.received += total > 0 ? Math.min(settled, total) : 0;
    } else {
      acc.purchases += total;
      acc.payable += row.outstandingAmount;
      acc.paid += total > 0 ? Math.min(settled, total) : 0;
    }
    if (row.status === 'overpaid') acc.overpaid += settled - total;
    return acc;
  },
  { sales: 0, purchases: 0, receivable: 0, payable: 0, received: 0, paid: 0, overpaid: 0 }
);

const buildLedgerInvoiceRows = (
  ledgerEntries: WorkbookLedgerEntry[],
  paymentsByInvoiceId: Map<string, WorkbookLedgerEntry[]>,
  paymentCutoffDate: string
): LedgerInvoiceRow[] => {
  const invoiceRows = ledgerEntries
    .filter(isInvoiceEntry)
    .map((entry) => {
      const linkedPayments = entry.id ? paymentsByInvoiceId.get(entry.id) ?? [] : [];
      const cutoffLinkedPayments = linkedPayments.filter((payment) => isDateOnOrBefore(payment.date, paymentCutoffDate));
      const directPaymentAmount = isDateOnOrBefore(entry.date, paymentCutoffDate)
        ? parseAmount(entry.paymentAmount)
        : 0;
      const linkedPaymentAmount = cutoffLinkedPayments.reduce((sum, payment) => sum + parseAmount(payment.paymentAmount), 0);
      const totalAmount = parseAmount(entry.totalAmount);
      const settledAmount = directPaymentAmount + linkedPaymentAmount;
      const outstandingAmount = Math.max(totalAmount - settledAmount, 0);

      return {
        entry,
        linkedPayments,
        directPaymentAmount,
        settledAmount,
        outstandingAmount,
        status: getSettlementStatus(totalAmount, settledAmount)
      };
    });

  const invoiceRowById = new Map<string, LedgerInvoiceRow>();
  const invoiceRowsByPartner = new Map<string, LedgerInvoiceRow[]>();

  invoiceRows.forEach((row) => {
    const id = normalizeText(row.entry.id);
    if (id) invoiceRowById.set(id, row);

    const partnerKey = normalizePartnerMatchKey(row.entry.partnerName);
    if (!partnerKey) return;

    const bucket = invoiceRowsByPartner.get(partnerKey) ?? [];
    bucket.push(row);
    invoiceRowsByPartner.set(partnerKey, bucket);
  });

  const applySettlementToRow = (row: LedgerInvoiceRow, amount: number) => {
    const totalAmount = parseAmount(row.entry.totalAmount);
    const outstandingBeforeApply = Math.max(totalAmount - row.settledAmount, 0);
    const appliedAmount = Math.min(outstandingBeforeApply, amount);
    if (appliedAmount <= 0) return;

    row.settledAmount += appliedAmount;
    row.outstandingAmount = Math.max(totalAmount - row.settledAmount, 0);
    row.status = getSettlementStatus(totalAmount, row.settledAmount);
  };

  const findLegacyMatchedRow = (settlementEntry: WorkbookLedgerEntry, exactAmount: number) => {
    const partnerKey = normalizePartnerMatchKey(settlementEntry.partnerName);
    if (!partnerKey) return null;

    const partnerRows = invoiceRowsByPartner.get(partnerKey) ?? [];
    if (!partnerRows.length) return null;

    const settlementDate = normalizeText(settlementEntry.date);
    const normalizedSiteName = normalizeText(settlementEntry.siteName).toLowerCase();
    const normalizedTeamName = normalizeText(settlementEntry.teamName).toLowerCase();
    const settlementApplied = getEntryAppliedParts(settlementEntry);

    const matchesBaseConditions = (row: LedgerInvoiceRow) => {
      if (settlementDate && normalizeText(row.entry.date) > settlementDate) return false;
      if (normalizedSiteName && normalizeText(row.entry.siteName).toLowerCase() !== normalizedSiteName) return false;
      if (normalizedTeamName && normalizeText(row.entry.teamName).toLowerCase() !== normalizedTeamName) return false;
      return true;
    };

    const resolveExactAmountCandidate = (rows: LedgerInvoiceRow[]) => {
      if (exactAmount <= 0) return null;

      const exactMatches = rows.filter((row) => (
        Math.abs(parseAmount(row.entry.totalAmount) - exactAmount) < 0.5 ||
        Math.abs(row.outstandingAmount - exactAmount) < 0.5
      ));
      return exactMatches.length === 1 ? exactMatches[0] : null;
    };

    const resolveUniqueOutstandingCandidate = (rows: LedgerInvoiceRow[]) => {
      const outstandingRows = rows.filter((row) => row.outstandingAmount > 0);
      return outstandingRows.length === 1 ? outstandingRows[0] : null;
    };

    const strictRows = partnerRows.filter((row) => {
      if (!matchesBaseConditions(row)) return false;

      const invoiceApplied = getEntryAppliedParts(row.entry);
      if (settlementApplied.appliedYear !== null && invoiceApplied.appliedYear !== settlementApplied.appliedYear) return false;
      if (settlementApplied.appliedMonth !== null && invoiceApplied.appliedMonth !== settlementApplied.appliedMonth) return false;
      return true;
    });

    if (strictRows.length === 1) return strictRows[0];

    const strictOutstanding = resolveUniqueOutstandingCandidate(strictRows);
    if (strictOutstanding) return strictOutstanding;

    const strictExact = resolveExactAmountCandidate(strictRows);
    if (strictExact) return strictExact;

    const relaxedRows = partnerRows.filter(matchesBaseConditions);
    if (relaxedRows.length === 1) return relaxedRows[0];

    const relaxedOutstanding = resolveUniqueOutstandingCandidate(relaxedRows);
    if (relaxedOutstanding) return relaxedOutstanding;

    return resolveExactAmountCandidate(relaxedRows);
  };

  const findDirectOffsetRow = (adjustmentEntry: WorkbookLedgerEntry) => {
    const exactAmount = Math.abs(parseAmount(adjustmentEntry.totalAmount));
    const partnerKey = normalizePartnerMatchKey(adjustmentEntry.partnerName);
    if (exactAmount <= 0 || !partnerKey) return null;

    const adjustmentDate = normalizeText(adjustmentEntry.date);
    const normalizedSiteName = normalizeText(adjustmentEntry.siteName).toLowerCase();
    const normalizedDescription = normalizeText(adjustmentEntry.description).toLowerCase();
    const normalizedTeamName = normalizeText(adjustmentEntry.teamName).toLowerCase();
    const adjustmentApplied = getEntryAppliedParts(adjustmentEntry);

    const candidates = (invoiceRowsByPartner.get(partnerKey) ?? []).filter((row) => {
      const entry = row.entry;
      if (Math.abs(parseAmount(entry.totalAmount) - exactAmount) >= 0.5) return false;
      if (adjustmentDate && normalizeText(entry.date) !== adjustmentDate) return false;
      if (normalizedSiteName && normalizeText(entry.siteName).toLowerCase() !== normalizedSiteName) return false;
      if (normalizedDescription && normalizeText(entry.description).toLowerCase() !== normalizedDescription) return false;
      if (normalizedTeamName && normalizeText(entry.teamName).toLowerCase() !== normalizedTeamName) return false;

      const invoiceApplied = getEntryAppliedParts(entry);
      if (adjustmentApplied.appliedYear !== null && invoiceApplied.appliedYear !== adjustmentApplied.appliedYear) return false;
      if (adjustmentApplied.appliedMonth !== null && invoiceApplied.appliedMonth !== adjustmentApplied.appliedMonth) return false;
      return true;
    });

    return candidates.length === 1 ? candidates[0] : null;
  };

  ledgerEntries
    .filter(isStandalonePaymentEntry)
    .filter((entry) => !normalizeText(entry.matchedEntryId))
    .filter((entry) => isDateOnOrBefore(entry.date, paymentCutoffDate))
    .sort(sortLedgerEntriesByDate)
    .forEach((paymentEntry) => {
      const paymentAmount = parseAmount(paymentEntry.paymentAmount);
      const matchedRow = findLegacyMatchedRow(paymentEntry, paymentAmount);
      if (matchedRow) applySettlementToRow(matchedRow, paymentAmount);
    });

  ledgerEntries
    .filter(isNegativeInvoiceEntry)
    .sort(sortLedgerEntriesByDate)
    .forEach((adjustmentEntry) => {
      const adjustmentAmount = Math.abs(parseAmount(adjustmentEntry.totalAmount));
      if (adjustmentAmount <= 0) return;

      const explicitTargetId = normalizeText(adjustmentEntry.matchedEntryId);
      const explicitTarget = explicitTargetId ? invoiceRowById.get(explicitTargetId) : null;
      if (explicitTarget) {
        applySettlementToRow(explicitTarget, adjustmentAmount);
        return;
      }

      const directOffsetRow = findDirectOffsetRow(adjustmentEntry);
      if (directOffsetRow) {
        applySettlementToRow(directOffsetRow, adjustmentAmount);
        return;
      }

      const legacyMatchedRow = findLegacyMatchedRow(adjustmentEntry, adjustmentAmount);
      if (legacyMatchedRow) applySettlementToRow(legacyMatchedRow, adjustmentAmount);
    });

  return invoiceRows.sort((a, b) => normalizeText(b.entry.date).localeCompare(normalizeText(a.entry.date), 'ko-KR'));
};

const buildWorkbookSummaryParityRows = (
  ledgerEntries: WorkbookLedgerEntry[],
  paymentsByInvoiceId: Map<string, WorkbookLedgerEntry[]>,
  paymentCutoffDate: string,
  filter: LedgerInvoiceRowsFilter = {}
): LedgerInvoiceRow[] => {
  const startDate = normalizeText(filter.startDate);
  const endDate = normalizeText(filter.endDate);
  const selectedTeam = normalizeText(filter.teamName);
  const selectedPartner = normalizeText(filter.partnerName);
  const keyword = normalizeKey(filter.keyword);

  const matchesCalculationFilter = (entry: WorkbookLedgerEntry) => {
    if (selectedTeam && selectedTeam !== 'all' && normalizeKey(entry.teamName) !== normalizeKey(selectedTeam)) return false;
    if (selectedPartner && selectedPartner !== 'all' && normalizeKey(entry.partnerName) !== normalizeKey(selectedPartner)) return false;
    if (!keyword) return true;
    return [
      entry.transactionType,
      entry.partnerName,
      entry.siteName,
      entry.description,
      entry.note,
      entry.teamName,
      entry.sourceType,
      entry.sourceId
    ].map(normalizeKey).join('|').includes(keyword);
  };

  const isRowInDateRange = (row: LedgerInvoiceRow) => {
    const issueDate = normalizeText(row.entry.date).slice(0, 10);
    if (!issueDate) return false;
    if (startDate && issueDate < startDate) return false;
    if (endDate && issueDate > endDate) return false;
    return true;
  };

  const resultRows: LedgerInvoiceRow[] = [];

  (['매출', '매입'] as WorkbookTransactionType[]).forEach((transactionType) => {
    const summaryInvoiceEntries = ledgerEntries
      .filter((entry) => entry.transactionType === transactionType)
      .filter((entry) => parseAmount(entry.totalAmount) !== 0)
      .filter(matchesCalculationFilter)
      .sort(sortLedgerEntriesByDate);
    const positiveInvoiceEntries = summaryInvoiceEntries.filter(isInvoiceEntry);
    const adjustmentInvoiceEntries = summaryInvoiceEntries.filter(isNegativeInvoiceEntry);

    const invoiceRows = positiveInvoiceEntries.map((entry): LedgerInvoiceRow => ({
      entry,
      linkedPayments: entry.id ? paymentsByInvoiceId.get(entry.id) ?? [] : [],
      directPaymentAmount: 0,
      settledAmount: 0,
      outstandingAmount: parseAmount(entry.totalAmount),
      status: 'open'
    }));
    const invoiceRowById = new Map<string, LedgerInvoiceRow>();
    const invoiceRowsByPartner = new Map<string, LedgerInvoiceRow[]>();
    invoiceRows.forEach((row) => {
      invoiceRowById.set(getWorkbookEntryKey(row.entry), row);
      const partnerKey = normalizePartnerMatchKey(row.entry.partnerName);
      if (!partnerKey) return;
      const bucket = invoiceRowsByPartner.get(partnerKey) ?? [];
      bucket.push(row);
      invoiceRowsByPartner.set(partnerKey, bucket);
    });

    const applySettlementToRow = (row: LedgerInvoiceRow, amount: number, options?: { direct?: boolean }) => {
      if (amount <= 0) return;
      const totalAmount = parseAmount(row.entry.totalAmount);
      const appliedAmount = Math.min(Math.max(totalAmount - row.settledAmount, 0), amount);
      if (appliedAmount <= 0) return;
      row.settledAmount += appliedAmount;
      if (options?.direct) row.directPaymentAmount += appliedAmount;
      row.outstandingAmount = Math.max(totalAmount - row.settledAmount, 0);
      row.status = getSettlementStatus(totalAmount, row.settledAmount);
    };

    const findLegacyMatchedRow = (settlementEntry: WorkbookLedgerEntry, exactAmount?: number) => {
      const partnerKey = normalizePartnerMatchKey(settlementEntry.partnerName);
      const partnerRows = partnerKey ? invoiceRowsByPartner.get(partnerKey) ?? [] : [];
      if (!partnerRows.length) return null;
      const settlementDate = normalizeText(settlementEntry.date);
      const normalizedSiteName = normalizeText(settlementEntry.siteName).toLowerCase();
      const normalizedTeamName = normalizeText(settlementEntry.teamName).toLowerCase();
      const settlementApplied = getEntryAppliedParts(settlementEntry);
      const matchesBase = (row: LedgerInvoiceRow) => {
        if (settlementDate && normalizeText(row.entry.date) > settlementDate) return false;
        if (normalizedSiteName && normalizeText(row.entry.siteName).toLowerCase() !== normalizedSiteName) return false;
        if (normalizedTeamName && normalizeText(row.entry.teamName).toLowerCase() !== normalizedTeamName) return false;
        return true;
      };
      const exact = (rows: LedgerInvoiceRow[]) => {
        if (!(exactAmount && exactAmount > 0)) return null;
        const matches = rows.filter((row) => (
          Math.abs(parseAmount(row.entry.totalAmount) - exactAmount) < 0.5 ||
          Math.abs(row.outstandingAmount - exactAmount) < 0.5
        ));
        return matches.length === 1 ? matches[0] : null;
      };
      const uniqueOutstanding = (rows: LedgerInvoiceRow[]) => {
        const matches = rows.filter((row) => row.outstandingAmount > 0);
        return matches.length === 1 ? matches[0] : null;
      };
      const strictRows = partnerRows.filter((row) => {
        if (!matchesBase(row)) return false;
        const invoiceApplied = getEntryAppliedParts(row.entry);
        if (settlementApplied.appliedYear !== null && invoiceApplied.appliedYear !== settlementApplied.appliedYear) return false;
        if (settlementApplied.appliedMonth !== null && invoiceApplied.appliedMonth !== settlementApplied.appliedMonth) return false;
        return true;
      });
      if (strictRows.length === 1) return strictRows[0];
      const strictOutstanding = uniqueOutstanding(strictRows);
      if (strictOutstanding) return strictOutstanding;
      const strictExact = exact(strictRows);
      if (strictExact) return strictExact;
      const relaxedRows = partnerRows.filter(matchesBase);
      if (relaxedRows.length === 1) return relaxedRows[0];
      const relaxedOutstanding = uniqueOutstanding(relaxedRows);
      if (relaxedOutstanding) return relaxedOutstanding;
      return exact(relaxedRows);
    };

    const findDirectOffsetRow = (adjustmentEntry: WorkbookLedgerEntry) => {
      const exactAmount = Math.abs(parseAmount(adjustmentEntry.totalAmount));
      const partnerKey = normalizePartnerMatchKey(adjustmentEntry.partnerName);
      if (exactAmount <= 0 || !partnerKey) return null;
      const adjustmentDate = normalizeText(adjustmentEntry.date);
      const normalizedSiteName = normalizeText(adjustmentEntry.siteName).toLowerCase();
      const normalizedDescription = normalizeText(adjustmentEntry.description).toLowerCase();
      const normalizedTeamName = normalizeText(adjustmentEntry.teamName).toLowerCase();
      const adjustmentApplied = getEntryAppliedParts(adjustmentEntry);
      const candidates = positiveInvoiceEntries.filter((invoiceEntry) => {
        if (normalizePartnerMatchKey(invoiceEntry.partnerName) !== partnerKey) return false;
        if (Math.abs(parseAmount(invoiceEntry.totalAmount) - exactAmount) >= 0.5) return false;
        if (adjustmentDate && normalizeText(invoiceEntry.date) !== adjustmentDate) return false;
        if (normalizedSiteName && normalizeText(invoiceEntry.siteName).toLowerCase() !== normalizedSiteName) return false;
        if (normalizedDescription && normalizeText(invoiceEntry.description).toLowerCase() !== normalizedDescription) return false;
        if (normalizedTeamName && normalizeText(invoiceEntry.teamName).toLowerCase() !== normalizedTeamName) return false;
        const invoiceApplied = getEntryAppliedParts(invoiceEntry);
        if (adjustmentApplied.appliedYear !== null && invoiceApplied.appliedYear !== adjustmentApplied.appliedYear) return false;
        if (adjustmentApplied.appliedMonth !== null && invoiceApplied.appliedMonth !== adjustmentApplied.appliedMonth) return false;
        return true;
      });
      return candidates.length === 1 ? invoiceRowById.get(getWorkbookEntryKey(candidates[0])) ?? null : null;
    };

    ledgerEntries
      .filter((entry) => entry.transactionType === transactionType)
      .filter(isPaymentEntry)
      .filter((entry) => isDateOnOrBefore(entry.date, paymentCutoffDate))
      .filter(matchesCalculationFilter)
      .sort(sortLedgerEntriesByDate)
      .forEach((paymentEntry) => {
        const paymentAmount = parseAmount(paymentEntry.paymentAmount);
        if (paymentAmount <= 0) return;
        const matchedEntryId = normalizeText(paymentEntry.matchedEntryId);
        if (matchedEntryId) {
          const matchedInvoice = invoiceRowById.get(matchedEntryId);
          if (matchedInvoice) applySettlementToRow(matchedInvoice, paymentAmount);
          return;
        }
        const selfInvoice = isInvoiceEntry(paymentEntry) ? invoiceRowById.get(getWorkbookEntryKey(paymentEntry)) : null;
        if (selfInvoice) {
          applySettlementToRow(selfInvoice, paymentAmount, { direct: true });
          return;
        }
        const legacyMatchedRow = findLegacyMatchedRow(paymentEntry, paymentAmount);
        if (legacyMatchedRow) applySettlementToRow(legacyMatchedRow, paymentAmount);
      });

    adjustmentInvoiceEntries.forEach((adjustmentEntry) => {
      const adjustmentAmount = Math.abs(parseAmount(adjustmentEntry.totalAmount));
      if (adjustmentAmount <= 0) return;
      const matchedEntryId = normalizeText(adjustmentEntry.matchedEntryId);
      if (matchedEntryId) {
        const matchedInvoice = invoiceRowById.get(matchedEntryId);
        if (matchedInvoice) applySettlementToRow(matchedInvoice, adjustmentAmount);
        return;
      }
      const directOffsetRow = findDirectOffsetRow(adjustmentEntry);
      if (directOffsetRow) {
        applySettlementToRow(directOffsetRow, adjustmentAmount);
        return;
      }
      const legacyMatchedRow = findLegacyMatchedRow(adjustmentEntry, adjustmentAmount);
      if (legacyMatchedRow) applySettlementToRow(legacyMatchedRow, adjustmentAmount);
    });

    const adjustmentRowsById = new Map<string, LedgerInvoiceRow>();
    adjustmentInvoiceEntries.forEach((entry) => {
      adjustmentRowsById.set(getWorkbookEntryKey(entry), {
        entry,
        linkedPayments: [],
        directPaymentAmount: 0,
        settledAmount: 0,
        outstandingAmount: 0,
        status: 'settled'
      });
    });
    resultRows.push(...summaryInvoiceEntries
      .map((entry) => {
        const entryId = getWorkbookEntryKey(entry);
        if (isInvoiceEntry(entry)) return invoiceRowById.get(entryId) ?? null;
        if (isNegativeInvoiceEntry(entry)) return adjustmentRowsById.get(entryId) ?? null;
        return null;
      })
      .filter((row): row is LedgerInvoiceRow => Boolean(row))
      .filter(isRowInDateRange));
  });

  return resultRows.sort((left, right) => {
    const dateCompare = normalizeText(right.entry.date).localeCompare(normalizeText(left.entry.date), 'ko-KR');
    if (dateCompare !== 0) return dateCompare;
    const partnerCompare = normalizeText(left.entry.partnerName).localeCompare(normalizeText(right.entry.partnerName), 'ko-KR', {
      numeric: true,
      sensitivity: 'base'
    });
    if (partnerCompare !== 0) return partnerCompare;
    return getWorkbookEntryKey(left.entry).localeCompare(getWorkbookEntryKey(right.entry), 'ko-KR');
  });
};

const WorkbookLedgerUpgradePage: React.FC<WorkbookLedgerUpgradePageProps> = ({
  tenantKey = 'cheongyeon',
  companyLabel = '청연'
}) => {
  const { currentUser } = useAuth();
  const ledgerService = useMemo(() => createWorkbookLedgerService(tenantKey), [tenantKey]);
  const [ledgerStartDate, setLedgerStartDate] = useState(() => `${buildDefaultYearMonth()}-01`);
  const [ledgerEndDate, setLedgerEndDate] = useState(() => todayString());
  const [salesImportMonth, setSalesImportMonth] = useState(buildDefaultYearMonth());
  const [purchaseImportMonth, setPurchaseImportMonth] = useState(buildDefaultYearMonth());
  const [entries, setEntries] = useState<WorkbookLedgerEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [purchaseAccountsByName, setPurchaseAccountsByName] = useState<Map<string, AccountDirectory>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingKb, setDownloadingKb] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('receivable');
  const [statusFilter, setStatusFilter] = useState<SettlementStatus>('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedPartner, setSelectedPartner] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [taxIssues, setTaxIssues] = useState<TaxInvoiceIssue[]>([]);
  const [taxIssueLoading, setTaxIssueLoading] = useState(false);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [selectedSalesIds, setSelectedSalesIds] = useState<Set<string>>(new Set());
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [manualDraft, setManualDraft] = useState<ManualEntryDraft>(() => createEmptyManualDraft());
  const [settlementDraft, setSettlementDraft] = useState<SettlementDraft>(() => createEmptySettlementDraft());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [showUnmappedPayments, setShowUnmappedPayments] = useState(false);
  const [mappingPaymentId, setMappingPaymentId] = useState<string | null>(null);
  const [selectedMappingTargetId, setSelectedMappingTargetId] = useState('');
  const [manualMappingTargetId, setManualMappingTargetId] = useState('');
  const [selectedPayableRowIds, setSelectedPayableRowIds] = useState<Set<string>>(new Set());
  const [showKbPreview, setShowKbPreview] = useState(false);
  const [kbReceiverDisplay, setKbReceiverDisplay] = useState(() => normalizeText(companyLabel).slice(0, 10) || '청연');
  const [kbMemoSuffix, setKbMemoSuffix] = useState(' 미지급금');

  const expenseLedger = useExpenseLedgerData(purchaseImportMonth, 'all', 'posted');

  const normalizedLedgerDateRange = useMemo(() => {
    const startDate = normalizeText(ledgerStartDate);
    const endDate = normalizeText(ledgerEndDate);
    if (startDate && endDate && startDate > endDate) {
      return { startDate: endDate, endDate: startDate };
    }
    return { startDate, endDate };
  }, [ledgerEndDate, ledgerStartDate]);

  const todayCutoffDate = todayString();

  const closeModal = useCallback(() => {
    setModal(null);
    setEditingEntryId(null);
    setEditingSettlementId(null);
    setMappingPaymentId(null);
    setSelectedMappingTargetId('');
    setManualMappingTargetId('');
  }, []);

  const refreshLedger = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [nextEntries, nextTeams] = await Promise.all([
        ledgerService.getEntries({ force }),
        teamService.getTeams()
      ]);
      setEntries(nextEntries);
      setTeams(nextTeams);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] load failed', error);
      toast.error('매입매출 장부 데이터를 불러오지 못했습니다.');
    } finally {
      setLedgerLoaded(true);
      setLoading(false);
    }
  }, [ledgerService]);

  useEffect(() => {
    void refreshLedger(false);
  }, [refreshLedger]);

  useEffect(() => {
    let mounted = true;
    accountDirectoryService.getEntriesByCategory('purchase')
      .then((accounts) => {
        if (!mounted) return;
        const nextMap = new Map<string, AccountDirectory>();
        accounts.forEach((account) => {
          const exactKey = normalizeText(account.name);
          const matchKey = normalizePartnerMatchKey(account.name);
          if (exactKey) nextMap.set(exactKey, account);
          if (matchKey) nextMap.set(matchKey, account);
        });
        setPurchaseAccountsByName(nextMap);
      })
      .catch((error) => {
        console.error('[WorkbookLedgerUpgradePage] purchase account load failed', error);
        setPurchaseAccountsByName(new Map());
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (modal !== 'salesImport') return;
    let mounted = true;
    setTaxIssueLoading(true);
    taxInvoiceListService.getIssuesByMonth(salesImportMonth)
      .then((rows) => {
        if (mounted) {
          setTaxIssues(rows);
          setSelectedSalesIds(new Set());
        }
      })
      .catch((error) => {
        console.error('[WorkbookLedgerUpgradePage] tax issue load failed', error);
        toast.error('세금계산서 발행리스트를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (mounted) setTaxIssueLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [modal, salesImportMonth]);

  useEffect(() => {
    if (modal === 'purchaseImport') {
      setSelectedPurchaseIds(new Set());
    }
  }, [modal, purchaseImportMonth]);

  const teamColorByKey = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((team) => {
      const color = normalizeColor((team as any).color);
      [team.id, (team as any).legacyId, team.name].forEach((value) => {
        const key = normalizeKey(value);
        if (key) map.set(key, color);
      });
    });
    return map;
  }, [teams]);

  const getTeamColor = useCallback((name?: string) => (
    teamColorByKey.get(normalizeKey(name)) || hashColor(normalizeText(name))
  ), [teamColorByKey]);

  const duplicateGuards = useMemo(() => buildDuplicateGuards(entries), [entries]);
  const existingSourceKeys = duplicateGuards.sourceKeys;
  const existingFingerprints = duplicateGuards.fingerprints;

  const paymentEntries = useMemo(() => entries.filter((entry) => isPaymentEntry(entry)), [entries]);

  const paymentsByInvoiceId = useMemo(() => {
    const map = new Map<string, WorkbookLedgerEntry[]>();
    paymentEntries.forEach((entry) => {
      const targetId = normalizeText(entry.matchedEntryId);
      if (!targetId) return;
      const bucket = map.get(targetId) ?? [];
      bucket.push(entry);
      map.set(targetId, bucket);
    });
    return map;
  }, [paymentEntries]);

  const paymentById = useMemo(() => {
    const map = new Map<string, WorkbookLedgerEntry>();
    paymentEntries.forEach((entry) => {
      if (entry.id) map.set(entry.id, entry);
    });
    return map;
  }, [paymentEntries]);

  const currentInvoiceRows = useMemo<LedgerInvoiceRow[]>(
    () => buildLedgerInvoiceRows(entries, paymentsByInvoiceId, todayCutoffDate),
    [entries, paymentsByInvoiceId, todayCutoffDate]
  );

  const unmappedPaymentEntries = useMemo(() => (
    paymentEntries
      .filter(isUnmappedPaymentEntry)
      .slice()
      .sort((left, right) => {
        const dateCompare = normalizeText(left.date).localeCompare(normalizeText(right.date), 'ko-KR');
        if (dateCompare !== 0) return dateCompare;
        return normalizeText(left.id).localeCompare(normalizeText(right.id), 'ko-KR');
      })
  ), [paymentEntries]);

  const paymentMappingSuggestionsById = useMemo(() => {
    const nextMap = new Map<string, PaymentMappingSuggestion>();
    unmappedPaymentEntries.forEach((entry) => {
      const entryId = normalizeText(entry.id);
      if (!entryId) return;
      nextMap.set(entryId, getPaymentMappingSuggestion(currentInvoiceRows, entry));
    });
    return nextMap;
  }, [currentInvoiceRows, unmappedPaymentEntries]);

  const unmappedPaymentStats = useMemo(() => (
    unmappedPaymentEntries.reduce(
      (acc, entry) => {
        const entryId = normalizeText(entry.id);
        const status = entryId ? paymentMappingSuggestionsById.get(entryId)?.status : 'none';
        const bucket = status === 'auto' || status === 'ambiguous' || status === 'none' ? status : 'none';
        acc.count += 1;
        acc.amount += parseAmount(entry.paymentAmount);
        acc[bucket] += 1;
        return acc;
      },
      { count: 0, amount: 0, auto: 0, ambiguous: 0, none: 0 }
    )
  ), [paymentMappingSuggestionsById, unmappedPaymentEntries]);

  const mappingPaymentEntry = useMemo(() => (
    mappingPaymentId ? paymentById.get(mappingPaymentId) ?? null : null
  ), [mappingPaymentId, paymentById]);

  const mappingSuggestion = useMemo(() => (
    mappingPaymentId ? paymentMappingSuggestionsById.get(mappingPaymentId) ?? null : null
  ), [mappingPaymentId, paymentMappingSuggestionsById]);

  const mappingCandidates = useMemo(() => {
    if (!mappingPaymentEntry) return [];
    const suggestedCandidates = mappingSuggestion?.candidates ?? [];
    return (suggestedCandidates.length > 0
      ? suggestedCandidates
      : buildPaymentMatchCandidates(currentInvoiceRows, mappingPaymentEntry, { relaxed: true }))
      .slice(0, 30);
  }, [currentInvoiceRows, mappingPaymentEntry, mappingSuggestion]);

  const teamFilterOptions = useMemo(() => {
    const names = new Set<string>();
    teams.forEach((team) => {
      const name = normalizeText(team.name);
      if (name) names.add(name);
    });
    currentInvoiceRows.forEach((row) => {
      const name = normalizeText(row.entry.teamName);
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [currentInvoiceRows, teams]);

  const partnerFilterOptions = useMemo(() => {
    const names = new Set<string>();
    currentInvoiceRows.forEach((row) => {
      const name = normalizeText(row.entry.partnerName);
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [currentInvoiceRows]);

  const filterRowsBySearchRange = useCallback((rows: LedgerInvoiceRow[]) => {
    const keyword = normalizeKey(searchText);
    return rows.filter((row) => {
      const entry = row.entry;

      if (!isDateInRange(entry.date, normalizedLedgerDateRange.startDate, normalizedLedgerDateRange.endDate)) return false;
      if (selectedTeam !== 'all' && normalizeKey(entry.teamName) !== normalizeKey(selectedTeam)) return false;
      if (selectedPartner !== 'all' && normalizeKey(entry.partnerName) !== normalizeKey(selectedPartner)) return false;

      if (!keyword) return true;
      const haystack = [
        entry.transactionType,
        entry.partnerName,
        entry.siteName,
        entry.description,
        entry.note,
        entry.teamName,
        entry.sourceType,
        entry.sourceId
      ].map(normalizeKey).join('|');
      return haystack.includes(keyword);
    });
  }, [normalizedLedgerDateRange.endDate, normalizedLedgerDateRange.startDate, searchText, selectedPartner, selectedTeam]);

  const scopedLedgerFilter = useMemo<LedgerInvoiceRowsFilter>(() => ({
    startDate: normalizedLedgerDateRange.startDate,
    endDate: normalizedLedgerDateRange.endDate,
    teamName: selectedTeam,
    partnerName: selectedPartner,
    keyword: searchText
  }), [normalizedLedgerDateRange.endDate, normalizedLedgerDateRange.startDate, searchText, selectedPartner, selectedTeam]);

  const currentScopedInvoiceRows = useMemo(
    () => buildWorkbookSummaryParityRows(entries, paymentsByInvoiceId, todayCutoffDate, scopedLedgerFilter),
    [entries, paymentsByInvoiceId, scopedLedgerFilter, todayCutoffDate]
  );

  const settlementScopedInvoiceRows = useMemo(
    () => buildWorkbookSummaryParityRows(entries, paymentsByInvoiceId, normalizedLedgerDateRange.endDate || todayCutoffDate, scopedLedgerFilter),
    [entries, normalizedLedgerDateRange.endDate, paymentsByInvoiceId, scopedLedgerFilter, todayCutoffDate]
  );

  const scopedInvoiceRows = useMemo(
    () => (isSettlementViewMode(viewMode) ? settlementScopedInvoiceRows : currentScopedInvoiceRows),
    [currentScopedInvoiceRows, settlementScopedInvoiceRows, viewMode]
  );
  const invoiceRows = scopedInvoiceRows;

  const summary = useMemo(() => {
    const currentSummary = summarizeLedgerRows(currentScopedInvoiceRows);
    const settlementSummary = summarizeLedgerRows(settlementScopedInvoiceRows);
    return {
      ...currentSummary,
      receivable: settlementSummary.receivable,
      payable: settlementSummary.payable
    };
  }, [currentScopedInvoiceRows, settlementScopedInvoiceRows]);

  const viewModeStats = useMemo<Record<ViewMode, { count: number; amount: number }>>(() => {
    const salesRows = currentScopedInvoiceRows.filter((row) => row.entry.transactionType === '매출');
    const purchaseRows = currentScopedInvoiceRows.filter((row) => row.entry.transactionType === '매입');
    const receivableRows = settlementScopedInvoiceRows.filter((row) => row.entry.transactionType === '매출' && row.outstandingAmount > 0);
    const payableRows = settlementScopedInvoiceRows.filter((row) => row.entry.transactionType === '매입' && row.outstandingAmount > 0);
    return {
      all: {
        count: currentScopedInvoiceRows.length,
        amount: currentScopedInvoiceRows.reduce((sum, row) => sum + parseAmount(row.entry.totalAmount), 0)
      },
      sales: { count: salesRows.length, amount: summary.sales },
      purchases: { count: purchaseRows.length, amount: summary.purchases },
      receivable: { count: receivableRows.length, amount: summary.receivable },
      payable: { count: payableRows.length, amount: summary.payable }
    };
  }, [currentScopedInvoiceRows, settlementScopedInvoiceRows, summary]);

  const filteredInvoiceRows = useMemo(() => {
    return scopedInvoiceRows.filter((row) => {
      const entry = row.entry;
      if (viewMode === 'sales' && entry.transactionType !== '매출') return false;
      if (viewMode === 'purchases' && entry.transactionType !== '매입') return false;
      if (viewMode === 'receivable' && (entry.transactionType !== '매출' || row.outstandingAmount <= 0)) return false;
      if (viewMode === 'payable' && (entry.transactionType !== '매입' || row.outstandingAmount <= 0)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      return true;
    });
  }, [scopedInvoiceRows, statusFilter, viewMode]);

  const selectablePayableRows = useMemo(() => (
    filteredInvoiceRows.filter((row) => row.entry.transactionType === '매입' && row.outstandingAmount > 0 && normalizeText(row.entry.id))
  ), [filteredInvoiceRows]);

  const selectedPayableRows = useMemo(() => (
    selectablePayableRows.filter((row) => selectedPayableRowIds.has(normalizeText(row.entry.id)))
  ), [selectablePayableRows, selectedPayableRowIds]);

  const selectedPayableTotal = useMemo(() => (
    selectedPayableRows.reduce((sum, row) => sum + row.outstandingAmount, 0)
  ), [selectedPayableRows]);

  const selectablePayableIdSet = useMemo(() => new Set(
    selectablePayableRows.map((row) => normalizeText(row.entry.id)).filter(Boolean)
  ), [selectablePayableRows]);

  const allVisiblePayablesSelected = selectablePayableRows.length > 0
    && selectablePayableRows.every((row) => selectedPayableRowIds.has(normalizeText(row.entry.id)));

  const outstandingRows = useMemo(() => (
    scopedInvoiceRows.filter((row) => row.outstandingAmount > 0)
  ), [scopedInvoiceRows]);

  const paymentHistoryRows = useMemo(() => (
    paymentEntries
      .filter((entry) => {
        const paymentCutoffDate = isSettlementViewMode(viewMode)
          ? normalizedLedgerDateRange.endDate
          : todayCutoffDate;
        if (paymentCutoffDate && !isDateOnOrBefore(entry.date, paymentCutoffDate)) return false;
        if (selectedTeam !== 'all' && normalizeKey(entry.teamName) !== normalizeKey(selectedTeam)) return false;
        if (selectedPartner !== 'all' && normalizeKey(entry.partnerName) !== normalizeKey(selectedPartner)) return false;
        const keyword = normalizeKey(searchText);
        if (!keyword) return true;
        return [
          entry.transactionType,
          entry.partnerName,
          entry.siteName,
          entry.description,
          entry.note,
          entry.teamName
        ].map(normalizeKey).join('|').includes(keyword);
      })
      .slice()
      .sort((a, b) => normalizeText(b.date).localeCompare(normalizeText(a.date), 'ko-KR'))
      .slice(0, 80)
  ), [normalizedLedgerDateRange.endDate, paymentEntries, searchText, selectedPartner, selectedTeam, todayCutoffDate, viewMode]);

  const kbPreviewRows = useMemo<KbTransferPreviewRow[]>(() => (
    selectedPayableRows.map((row) => {
      const partnerName = normalizeText(row.entry.partnerName);
      const account = purchaseAccountsByName.get(partnerName)
        ?? purchaseAccountsByName.get(normalizePartnerMatchKey(partnerName));
      const analysis = analyzeKbBank(account?.bankName);
      return {
        rowId: normalizeText(row.entry.id),
        partnerName,
        siteName: normalizeText(row.entry.siteName),
        bankCode: analysis.code,
        bankCodeDisplay: analysis.display,
        bankCodeNeedsFix: analysis.needsFix,
        bankCodeReason: analysis.reason,
        accountNumber: normalizeText(account?.accountNumber),
        amount: row.outstandingAmount,
        receiverDisplay: normalizeText(kbReceiverDisplay).slice(0, 10),
        memoDisplay: `${partnerName}${kbMemoSuffix}`.slice(0, 14)
      };
    })
  ), [kbMemoSuffix, kbReceiverDisplay, purchaseAccountsByName, selectedPayableRows]);

  const kbMissingCount = useMemo(() => (
    kbPreviewRows.filter((row) => !row.bankCode || !row.accountNumber).length
  ), [kbPreviewRows]);

  const kbTransferTotal = useMemo(() => (
    kbPreviewRows.reduce((sum, row) => sum + row.amount, 0)
  ), [kbPreviewRows]);

  const salesCandidates = useMemo<ImportCandidate[]>(() => {
    return taxIssues.map((issue) => {
      const sourceId = normalizeText(issue.id) || `${issue.yearMonth || salesImportMonth}-${issue.no}`;
      const sourceMonth = normalizeText(issue.yearMonth) || salesImportMonth;
      const supplyAmount = parseAmount(issue.supplyAmount);
      const taxAmount = calculateWorkbookVatAmount(supplyAmount);
      const totalAmount = calculateWorkbookTotalAmount(supplyAmount);
      const date = normalizeText(issue.issueDate) || monthEndDate(sourceMonth);
      const siteName = normalizeText(issue.note) || normalizeText(issue.siteName) || normalizeText(issue.item);
      const candidate: ImportCandidate = {
        sourceType: 'taxInvoiceIssue',
        sourceId,
        sourceMonth,
        transactionType: '매출',
        date,
        partnerName: normalizeText(issue.recipient),
        siteName,
        description: normalizeText(issue.item) || '세금계산서 매출',
        supplyAmount,
        taxAmount,
        totalAmount,
        teamName: normalizeText(issue.teamName),
        note: normalizeText(issue.remark) || '세금계산서 발행리스트',
        statusLabel: String(issue.issueStatus ?? '')
      };

      const sourceKey = buildSourceKey(candidate.sourceType, candidate.sourceId);
      if (existingSourceKeys.has(sourceKey)) {
        candidate.disabledReason = '이미 가져옴';
      } else if (existingFingerprints.has(candidateFingerprint(candidate))) {
        candidate.disabledReason = '동일 거래 있음';
      } else if (!candidate.partnerName) {
        candidate.disabledReason = '거래처 없음';
      } else if (candidate.totalAmount <= 0) {
        candidate.disabledReason = '금액 없음';
      }
      return candidate;
    });
  }, [existingFingerprints, existingSourceKeys, salesImportMonth, taxIssues]);

  const purchaseCandidates = useMemo<ImportCandidate[]>(() => {
    const rows: ImportCandidate[] = [];
    const defaultDate = monthEndDate(purchaseImportMonth);
    const pushRow = (candidate: ImportCandidate) => {
      const sourceKey = buildSourceKey(candidate.sourceType, candidate.sourceId);
      if (existingSourceKeys.has(sourceKey)) {
        candidate.disabledReason = '이미 가져옴';
      } else if (existingFingerprints.has(candidateFingerprint(candidate))) {
        candidate.disabledReason = '동일 거래 있음';
      } else if (!candidate.partnerName) {
        candidate.disabledReason = '거래처 없음';
      } else if (candidate.totalAmount <= 0) {
        candidate.disabledReason = '금액 없음';
      }
      rows.push(candidate);
    };

    expenseLedger.rawDocs.accommodationDocs.forEach((doc) => {
      const totalAmount = (doc.lineItems ?? []).reduce((sum, item) => sum + parseAmount(item.amount), 0);
      const teamName = normalizeText(doc.teamName);
      pushRow({
        sourceType: 'expenseLedger',
        sourceId: `accommodation:${doc.id}`,
        sourceMonth: doc.yearMonth || purchaseImportMonth,
        transactionType: '매입',
        date: defaultDate,
        partnerName: '숙소비',
        siteName: normalizeText(doc.memo) || normalizeText(doc.issuedToWorkerName) || teamName,
        description: '숙소/공과금',
        supplyAmount: totalAmount,
        taxAmount: 0,
        totalAmount,
        teamName,
        note: '경비내역 숙소비'
      });
    });

    expenseLedger.rawDocs.vehicleDocs.forEach((doc) => {
      const breakdown = summarizeVehicleBillingCosts(doc);
      const teamName = normalizeText(doc.teamName || doc.assignedTeamName);
      pushRow({
        sourceType: 'expenseLedger',
        sourceId: `vehicle:${doc.id}`,
        sourceMonth: doc.yearMonth || purchaseImportMonth,
        transactionType: '매입',
        date: defaultDate,
        partnerName: '차량비',
        siteName: normalizeText(doc.vehiclePlate) || teamName,
        description: '차량 렌트/유지비',
        supplyAmount: breakdown.total,
        taxAmount: 0,
        totalAmount: breakdown.total,
        teamName,
        note: normalizeText(doc.memo) || '경비내역 차량비'
      });
    });

    expenseLedger.rawDocs.cardDocs.forEach((doc) => {
      const lineTotal = (doc.lineItems ?? []).reduce((sum, item) => sum + parseAmount(item.amount), 0);
      const totalAmount = lineTotal > 0 ? lineTotal : parseAmount(doc.totalAmount);
      const teamName = normalizeText(doc.teamName || doc.assignedTeamName);
      const labels = (doc.lineItems ?? []).map((item) => normalizeText(item.label)).filter(Boolean).slice(0, 3).join(', ');
      pushRow({
        sourceType: 'expenseLedger',
        sourceId: `card:${doc.id}`,
        sourceMonth: doc.yearMonth || purchaseImportMonth,
        transactionType: '매입',
        date: defaultDate,
        partnerName: '법인카드',
        siteName: normalizeText(doc.cardLabel) || teamName,
        description: labels || normalizeText(doc.memo) || '카드 사용분',
        supplyAmount: totalAmount,
        taxAmount: 0,
        totalAmount,
        teamName,
        note: normalizeText(doc.memo) || '경비내역 카드'
      });
    });

    expenseLedger.rawDocs.claims.forEach((claim) => {
      const isTeamCharge = claim.claimType === 'teamCharge' && normalizeText(claim.chargeToTeamName);
      const teamName = isTeamCharge ? normalizeText(claim.chargeToTeamName) : normalizeText(claim.payerTeamName);
      const partnerName = isTeamCharge
        ? normalizeText(claim.payerTeamName)
        : normalizeText(claim.cardLabel) || getCategoryLabel(claim.category);
      const totalAmount = parseAmount(claim.amount);
      pushRow({
        sourceType: 'expenseLedger',
        sourceId: `claim:${claim.id}:${isTeamCharge ? 'payable' : 'other'}`,
        sourceMonth: claim.yearMonth || purchaseImportMonth,
        transactionType: '매입',
        date: normalizeText(claim.date) || defaultDate,
        partnerName,
        siteName: normalizeText(claim.siteName),
        description: normalizeText(claim.description) || getCategoryLabel(claim.category),
        supplyAmount: totalAmount,
        taxAmount: 0,
        totalAmount,
        teamName,
        note: normalizeText(claim.memo) || '경비내역 후청구'
      });
    });

    return rows.sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko-KR') || a.partnerName.localeCompare(b.partnerName, 'ko-KR'));
  }, [expenseLedger.rawDocs, existingFingerprints, existingSourceKeys, purchaseImportMonth]);

  const selectedSalesCandidates = useMemo(() => (
    salesCandidates.filter((candidate) => selectedSalesIds.has(candidate.sourceId) && !candidate.disabledReason)
  ), [salesCandidates, selectedSalesIds]);

  const selectedPurchaseCandidates = useMemo(() => (
    purchaseCandidates.filter((candidate) => selectedPurchaseIds.has(candidate.sourceId) && !candidate.disabledReason)
  ), [purchaseCandidates, selectedPurchaseIds]);

  const toggleCandidate = (setSelected: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllCandidates = (
    candidates: ImportCandidate[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    const availableIds = candidates.filter((candidate) => !candidate.disabledReason).map((candidate) => candidate.sourceId);
    const allSelected = availableIds.length > 0 && availableIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      availableIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const importCandidates = async (candidates: ImportCandidate[], label: string) => {
    if (candidates.length === 0) {
      toast.warning('선택한 항목이 없습니다.');
      return;
    }
    setSaving(true);
    try {
      const latestEntries = await ledgerService.getEntries({ force: true });
      const latestGuards = buildDuplicateGuards(latestEntries);
      const freshCandidates = candidates.filter((candidate) => {
        const sourceKey = buildSourceKey(candidate.sourceType, candidate.sourceId);
        return !latestGuards.sourceKeys.has(sourceKey) && !latestGuards.fingerprints.has(candidateFingerprint(candidate));
      });

      if (freshCandidates.length === 0) {
        toast.warning('선택 항목이 이미 장부에 반영되어 있습니다.');
        setSelectedSalesIds(new Set());
        setSelectedPurchaseIds(new Set());
        await refreshLedger(true);
        return;
      }

      await ledgerService.addEntries(freshCandidates.map((candidate) => buildCandidateEntry(candidate, currentUser?.uid)));
      const skippedCount = candidates.length - freshCandidates.length;
      toast.success(
        skippedCount > 0
          ? `${label} ${freshCandidates.length.toLocaleString('ko-KR')}건을 가져왔습니다. 중복 ${skippedCount.toLocaleString('ko-KR')}건은 제외했습니다.`
          : `${label} ${freshCandidates.length.toLocaleString('ko-KR')}건을 가져왔습니다.`
      );
      setModal(null);
      setSelectedSalesIds(new Set());
      setSelectedPurchaseIds(new Set());
      await refreshLedger(true);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] import failed', error);
      toast.error(`${label} 가져오기에 실패했습니다.`);
    } finally {
      setSaving(false);
    }
  };

  const openManualEntry = (transactionType: WorkbookTransactionType = '매출') => {
    setEditingEntryId(null);
    setEditingSettlementId(null);
    setManualDraft({ ...createEmptyManualDraft(), transactionType });
    setModal('manualEntry');
  };

  const openEditManualEntry = (row: LedgerInvoiceRow) => {
    const entry = row.entry;
    if (!entry.id) return;
    setEditingSettlementId(null);
    setEditingEntryId(entry.id);
    setManualDraft({
      transactionType: entry.transactionType,
      date: normalizeText(entry.date),
      partnerName: normalizeText(entry.partnerName),
      siteName: normalizeText(entry.siteName),
      description: normalizeText(entry.description),
      supplyAmount: String(parseAmount(entry.supplyAmount)),
      taxAmount: String(parseAmount(entry.taxAmount)),
      totalAmount: String(parseAmount(entry.totalAmount)),
      teamName: normalizeText(entry.teamName),
      note: normalizeText(entry.note)
    });
    setModal('manualEntry');
  };

  const saveManualEntry = async () => {
    const supplyAmount = parseAmount(manualDraft.supplyAmount);
    const explicitTax = normalizeText(manualDraft.taxAmount);
    const taxAmount = explicitTax ? parseAmount(explicitTax) : manualDraft.transactionType === '매출' ? calculateWorkbookVatAmount(supplyAmount) : 0;
    const explicitTotal = normalizeText(manualDraft.totalAmount);
    const totalAmount = explicitTotal ? parseAmount(explicitTotal) : supplyAmount + taxAmount;

    if (!manualDraft.date || !manualDraft.partnerName || totalAmount <= 0) {
      toast.warning('일자, 거래처명, 금액을 확인해주세요.');
      return;
    }

    const applied = getAppliedParts(manualDraft.date);
    setSaving(true);
    try {
      const payload = {
        transactionType: manualDraft.transactionType,
        date: manualDraft.date,
        partnerName: manualDraft.partnerName,
        siteName: manualDraft.siteName,
        description: manualDraft.description || (manualDraft.transactionType === '매출' ? '수기 매출' : '수기 매입'),
        manDays: null,
        supplyAmount,
        taxAmount,
        totalAmount,
        appliedYear: applied.appliedYear,
        appliedMonth: applied.appliedMonth,
        note: manualDraft.note,
        teamName: manualDraft.teamName,
        updatedBy: currentUser?.uid ?? ''
      };

      if (editingEntryId) {
        await ledgerService.updateEntry(editingEntryId, payload);
        toast.success('거래를 수정했습니다.');
      } else {
        await ledgerService.addEntries([{
          ...payload,
          paymentAmount: 0,
          sourceType: 'manual',
          sourceId: createClientSourceId('manual'),
          sourceMonth: manualDraft.date.slice(0, 7),
          createdBy: currentUser?.uid ?? ''
        }]);
        toast.success('수기 거래를 등록했습니다.');
      }
      closeModal();
      await refreshLedger(true);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] manual save failed', error);
      toast.error(editingEntryId ? '거래 수정에 실패했습니다.' : '수기 거래 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openSettlement = (row?: LedgerInvoiceRow) => {
    setEditingEntryId(null);
    setEditingSettlementId(null);
    setSettlementDraft({
      targetId: row?.entry.id ?? '',
      date: todayString(),
      amount: row ? String(Math.round(row.outstandingAmount)) : '',
      note: ''
    });
    setModal('settlement');
  };

  const openEditSettlement = (entry: WorkbookLedgerEntry) => {
    if (!entry.id) return;
    setEditingEntryId(null);
    setEditingSettlementId(entry.id);
    setSettlementDraft({
      targetId: normalizeText(entry.matchedEntryId),
      date: normalizeText(entry.date) || todayString(),
      amount: String(parseAmount(entry.paymentAmount)),
      note: normalizeText(entry.note)
    });
    setModal('settlement');
  };

  const saveSettlement = async () => {
    const targetRow = invoiceRows.find((row) => row.entry.id === settlementDraft.targetId);
    const editingPayment = editingSettlementId ? paymentById.get(editingSettlementId) : null;
    const amount = parseAmount(settlementDraft.amount);
    if (!targetRow || !targetRow.entry.id) {
      toast.warning('입금/지급 대상 거래를 선택해주세요.');
      return;
    }
    if (!settlementDraft.date || amount <= 0) {
      toast.warning('일자와 금액을 확인해주세요.');
      return;
    }
    const existingPaymentAmount = editingPayment && normalizeText(editingPayment.matchedEntryId) === normalizeText(targetRow.entry.id)
      ? parseAmount(editingPayment.paymentAmount)
      : 0;
    const payableLimit = targetRow.outstandingAmount + existingPaymentAmount;
    if (amount > payableLimit) {
      const result = await Swal.fire({
        icon: 'warning',
        title: '잔액보다 큰 금액입니다',
        text: `현재 처리 가능 잔액은 ${formatCurrency(payableLimit)}원입니다. 그대로 저장할까요?`,
        showCancelButton: true,
        confirmButtonText: '저장',
        cancelButtonText: '취소'
      });
      if (!result.isConfirmed) return;
    }

    const target = targetRow.entry;
    const applied = getAppliedParts(settlementDraft.date);
    setSaving(true);
    try {
      const payload = {
        transactionType: target.transactionType,
        date: settlementDraft.date,
        partnerName: target.partnerName,
        siteName: target.siteName,
        description: target.transactionType === '매출' ? '입금' : '지급',
        manDays: null,
        supplyAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        paymentAmount: amount,
        appliedYear: applied.appliedYear,
        appliedMonth: applied.appliedMonth,
        matchedEntryId: target.id,
        note: settlementDraft.note,
        teamName: target.teamName,
        updatedBy: currentUser?.uid ?? ''
      };

      if (editingSettlementId) {
        await ledgerService.updateEntry(editingSettlementId, payload);
        toast.success(target.transactionType === '매출' ? '입금내역을 수정했습니다.' : '지급내역을 수정했습니다.');
      } else {
        await ledgerService.addEntries([{
          ...payload,
          sourceType: 'manualSettlement',
          sourceId: createClientSourceId(`settlement:${target.id}`),
          sourceMonth: settlementDraft.date.slice(0, 7),
          createdBy: currentUser?.uid ?? ''
        }]);
        toast.success(target.transactionType === '매출' ? '입금내역을 등록했습니다.' : '지급내역을 등록했습니다.');
      }
      closeModal();
      await refreshLedger(true);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] settlement save failed', error);
      toast.error(editingSettlementId ? '입금/지급 수정에 실패했습니다.' : '입금/지급 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteInvoiceRow = async (row: LedgerInvoiceRow) => {
    const entryId = normalizeText(row.entry.id);
    if (!entryId) return;
    const linkedPaymentIds = row.linkedPayments.map((entry) => normalizeText(entry.id)).filter(Boolean);
    const result = await Swal.fire({
      icon: 'warning',
      title: '거래를 삭제할까요?',
      text: linkedPaymentIds.length > 0
        ? `연결된 입금/지급내역 ${linkedPaymentIds.length.toLocaleString('ko-KR')}건도 함께 삭제됩니다.`
        : '삭제 후에는 목록과 집계에서 제외됩니다.',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const ids = [entryId, ...linkedPaymentIds];
      await ledgerService.softDeleteEntries(ids, currentUser?.uid ?? '');
      toast.success('거래를 삭제했습니다.');
      await refreshLedger(true);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] invoice delete failed', error);
      toast.error('거래 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSettlementEntry = async (entry: WorkbookLedgerEntry) => {
    const entryId = normalizeText(entry.id);
    if (!entryId) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: entry.transactionType === '매출' ? '입금내역을 삭제할까요?' : '지급내역을 삭제할까요?',
      text: '삭제 후 연결 거래의 잔액이 다시 계산됩니다.',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      await ledgerService.softDeleteEntry(entryId, currentUser?.uid ?? '');
      toast.success(entry.transactionType === '매출' ? '입금내역을 삭제했습니다.' : '지급내역을 삭제했습니다.');
      await refreshLedger(true);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] settlement delete failed', error);
      toast.error('입금/지급 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const togglePayableRowSelection = (rowId: string) => {
    const normalizedId = normalizeText(rowId);
    if (!normalizedId) return;
    setSelectedPayableRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedId)) next.delete(normalizedId);
      else next.add(normalizedId);
      return next;
    });
  };

  const toggleAllVisiblePayableSelection = () => {
    setSelectedPayableRowIds((prev) => {
      const next = new Set(prev);
      if (allVisiblePayablesSelected) {
        selectablePayableIdSet.forEach((id) => next.delete(id));
      } else {
        selectablePayableIdSet.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const validateKbDownloadContext = () => {
    if (viewMode !== 'payable') {
      Swal.fire('안내', '국민은행용 다운로드는 미지급금 탭에서만 가능합니다.', 'info');
      return false;
    }

    if (kbPreviewRows.length === 0) {
      Swal.fire('안내', '국민은행용으로 내보낼 미지급금 행을 먼저 선택하세요.', 'info');
      return false;
    }

    return true;
  };

  const openKbPreview = () => {
    if (!validateKbDownloadContext()) return;
    setShowKbPreview(true);
  };

  const downloadKbTransferExcel = async () => {
    if (!validateKbDownloadContext()) return;

    setDownloadingKb(true);
    try {
      const XLSX = await import('xlsx');
      const { saveAs } = await import('file-saver');
      const rows = kbPreviewRows.map((row) => [
        row.bankCode,
        row.accountNumber,
        Math.round(row.amount),
        row.receiverDisplay,
        row.memoDisplay
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([
        ['은행코드', '계좌번호', '이체금액', '받는분통장표시', '내통장메모'],
        ...rows
      ]);
      worksheet['!cols'] = [
        { wch: 10 },
        { wch: 24 },
        { wch: 14 },
        { wch: 20 },
        { wch: 28 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '국민은행용');
      const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([workbookBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      saveAs(blob, `미지급금_국민은행용_${new Date().toISOString().slice(0, 10)}.xlsx`);

      if (kbMissingCount > 0) {
        Swal.fire('완료', `다운로드 완료 (${kbPreviewRows.length.toLocaleString('ko-KR')}건)\n계좌 미매핑 ${kbMissingCount.toLocaleString('ko-KR')}건`, 'warning');
      } else {
        toast.success(`국민은행용 엑셀 ${kbPreviewRows.length.toLocaleString('ko-KR')}건을 다운로드했습니다.`);
      }
      setShowKbPreview(false);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] KB download failed', error);
      Swal.fire('오류', '국민은행용 다운로드에 실패했습니다.', 'error');
    } finally {
      setDownloadingKb(false);
    }
  };

  const selectedSettlementTarget = useMemo(() => (
    invoiceRows.find((row) => row.entry.id === settlementDraft.targetId) ?? null
  ), [invoiceRows, settlementDraft.targetId]);

  const settlementTargetOptions = useMemo(() => {
    if (!selectedSettlementTarget) return outstandingRows;
    if (outstandingRows.some((row) => row.entry.id === selectedSettlementTarget.entry.id)) return outstandingRows;
    return [selectedSettlementTarget, ...outstandingRows];
  }, [outstandingRows, selectedSettlementTarget]);

  const openPaymentMapping = useCallback((entry: WorkbookLedgerEntry) => {
    const paymentId = normalizeText(entry.id);
    if (!paymentId || !isStandalonePaymentEntry(entry)) {
      toast.warning('매핑할 입금/지급 행을 다시 선택해주세요.');
      return;
    }

    if (normalizeText(entry.matchedEntryId)) {
      toast.warning('이미 원본 거래에 연결된 입금/지급 행입니다.');
      return;
    }

    const suggestion = getPaymentMappingSuggestion(currentInvoiceRows, entry);
    const candidates = suggestion.candidates.length > 0
      ? suggestion.candidates
      : buildPaymentMatchCandidates(currentInvoiceRows, entry, { relaxed: true });

    setMappingPaymentId(paymentId);
    setSelectedMappingTargetId(normalizeText(candidates[0]?.entry.id));
    setManualMappingTargetId('');
    setEditingEntryId(null);
    setEditingSettlementId(null);
    setModal('paymentMapping');
  }, [currentInvoiceRows]);

  const savePaymentMapping = useCallback(async () => {
    if (!mappingPaymentEntry?.id) {
      toast.warning('매핑할 입금/지급 행을 다시 불러와주세요.');
      return;
    }

    const targetId = normalizeText(manualMappingTargetId) || normalizeText(selectedMappingTargetId);
    const targetRow = currentInvoiceRows.find((row) => normalizeText(row.entry.id) === targetId);
    if (!targetId || !targetRow || !targetRow.entry.id) {
      toast.warning('매핑할 원본 매출/매입 행을 선택하거나 ID를 입력해주세요.');
      return;
    }

    if (targetRow.entry.transactionType !== mappingPaymentEntry.transactionType) {
      toast.warning('입금/지급 행과 원본 거래의 구분이 다릅니다.');
      return;
    }

    const paymentAmount = parseAmount(mappingPaymentEntry.paymentAmount);
    if (paymentAmount > targetRow.outstandingAmount) {
      const result = await Swal.fire({
        icon: 'warning',
        title: '잔액보다 큰 금액입니다',
        text: `입금/지급액 ${formatCurrency(paymentAmount)}원이 원본 잔액 ${formatCurrency(targetRow.outstandingAmount)}원을 초과합니다. 그대로 매핑할까요?`,
        showCancelButton: true,
        confirmButtonText: '매핑',
        cancelButtonText: '취소'
      });
      if (!result.isConfirmed) return;
    }

    setSaving(true);
    try {
      await ledgerService.updateEntry(mappingPaymentEntry.id, {
        matchedEntryId: targetRow.entry.id,
        updatedBy: currentUser?.uid ?? ''
      });
      toast.success('입금/지급 내역을 원본 거래에 연결했습니다.');
      closeModal();
      await refreshLedger(true);
    } catch (error) {
      console.error('[WorkbookLedgerUpgradePage] payment mapping failed', error);
      toast.error('입금/지급 매핑 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [
    closeModal,
    currentUser?.uid,
    currentInvoiceRows,
    ledgerService,
    manualMappingTargetId,
    mappingPaymentEntry,
    refreshLedger,
    selectedMappingTargetId
  ]);

  const renderCandidateTable = (
    candidates: ImportCandidate[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    const availableCount = candidates.filter((candidate) => !candidate.disabledReason).length;
    const selectedCount = candidates.filter((candidate) => selected.has(candidate.sourceId) && !candidate.disabledReason).length;
    const allSelected = availableCount > 0 && selectedCount === availableCount;

    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-slate-900"
              checked={allSelected}
              onChange={() => toggleAllCandidates(candidates, selected, setSelected)}
            />
            전체 선택
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-blue-700">
              선택 {selectedCount.toLocaleString('ko-KR')}건
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600">
              가능 {availableCount.toLocaleString('ko-KR')}건
            </span>
          </div>
        </div>
        <div className="max-h-[56vh] overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm">
              <tr>
                <th className="w-10 border-b border-slate-200 px-3 py-2" />
                <th className="border-b border-slate-200 px-3 py-2 text-left">일자</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">거래처명</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">현장명</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">팀</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">내용</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">합계</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm font-bold text-slate-400">가져올 항목이 없습니다.</td>
                </tr>
              ) : candidates.map((candidate) => {
                const disabled = Boolean(candidate.disabledReason);
                const checked = selected.has(candidate.sourceId) && !disabled;
                const color = getTeamColor(candidate.teamName);
                return (
                  <tr
                    key={`${candidate.sourceType}:${candidate.sourceId}`}
                    className={`${checked ? 'bg-blue-50' : 'bg-white'} ${disabled ? 'opacity-55' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        disabled={disabled}
                        checked={checked}
                        onChange={() => toggleCandidate(setSelected, candidate.sourceId)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-700">{candidate.date}</td>
                    <td className="px-3 py-2 font-black text-slate-900">{candidate.partnerName || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{candidate.siteName || '-'}</td>
                    <td className="px-3 py-2"><TeamBadge name={candidate.teamName} color={color} /></td>
                    <td className="max-w-[260px] px-3 py-2 text-slate-600">
                      <div className="truncate" title={candidate.description}>{candidate.description || '-'}</div>
                      {candidate.note && <div className="mt-0.5 truncate text-xs text-slate-400">{candidate.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-black tabular-nums text-slate-900">{formatCurrency(candidate.totalAmount)}</td>
                    <td className="px-3 py-2 text-center">
                      {candidate.disabledReason ? (
                        <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                          {candidate.disabledReason}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                          가능
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading && !ledgerLoaded) {
    return <AppIntroScreen message={`${companyLabel} 매입매출 장부를 불러오는 중`} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-5 text-slate-900 xl:px-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <section className="border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-normal text-slate-950">{companyLabel} 매입매출 스마트 장부</h1>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                  <ShieldCheck size={14} />
                  중복 방지
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span>원장 기준: 전체 저장 데이터</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>발행일: {normalizedLedgerDateRange.startDate || '-'} ~ {normalizedLedgerDateRange.endDate || '-'}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>입금/지급: 매출·매입은 현재까지, 미수·미지급은 종료일 기준</span>
                <Link to="/payroll/workbook-ledger" className="text-blue-700 hover:underline">기존 장부</Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(event) => setLedgerStartDate(event.target.value)}
                  className="w-36 bg-transparent outline-none"
                  aria-label="검색시작일"
                />
              </label>
              <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={(event) => setLedgerEndDate(event.target.value)}
                  className="w-36 bg-transparent outline-none"
                  aria-label="검색종료일"
                />
              </label>
              <button
                type="button"
                onClick={() => refreshLedger(true)}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                새로고침
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricTile label="매출 합계" value={summary.sales} tone="sales" icon={<ArrowUpRight size={17} />} />
          <MetricTile label="매입 합계" value={summary.purchases} tone="purchase" icon={<ArrowDownToLine size={17} />} />
          <MetricTile label="미수금" value={summary.receivable} tone="receive" icon={<CircleDollarSign size={17} />} />
          <MetricTile label="미지급금" value={summary.payable} tone="payable" icon={<WalletCards size={17} />} />
          <MetricTile label="입금 완료" value={summary.received} tone="settled" icon={<Banknote size={17} />} />
          <MetricTile label="지급 완료" value={summary.paid} tone="neutral" icon={<CheckCircle2 size={17} />} />
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: '전체' },
                  { id: 'sales', label: '매출' },
                  { id: 'purchases', label: '매입' },
                  { id: 'receivable', label: '미수금' },
                  { id: 'payable', label: '미지급금' }
                ].map(({ id, label }) => {
                  const stat = viewModeStats[id as ViewMode];
                  return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setViewMode(id as ViewMode)}
                    className={`min-h-11 rounded-md px-3 py-1.5 text-left text-sm font-black transition-colors ${
                      viewMode === id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {label}
                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${viewMode === id ? 'bg-white/15 text-white' : 'bg-white text-slate-500'}`}>
                        {stat.count.toLocaleString('ko-KR')}건
                      </span>
                    </span>
                    <span className={`mt-0.5 block text-[11px] tabular-nums ${viewMode === id ? 'text-slate-200' : 'text-slate-400'}`}>
                      {formatCurrency(stat.amount)}
                    </span>
                  </button>
                  );
                })}
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setModal('salesImport')}
                  className="group flex min-h-[58px] items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 text-left shadow-sm transition-colors hover:bg-blue-100"
                >
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
                    <FileText size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-blue-900">매출 가져오기</span>
                    <span className="block truncate text-xs font-bold text-blue-600">발행리스트 선택</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setModal('purchaseImport')}
                  className="group flex min-h-[58px] items-center gap-3 rounded-md border border-violet-200 bg-violet-50 px-3 text-left shadow-sm transition-colors hover:bg-violet-100"
                >
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-violet-600 text-white shadow-sm">
                    <Landmark size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-violet-900">매입 가져오기</span>
                    <span className="block truncate text-xs font-bold text-violet-600">경비내역 선택</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openManualEntry('매출')}
                  className="group flex min-h-[58px] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                >
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                    <FilePlus2 size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-900">수기 거래</span>
                    <span className="block truncate text-xs font-bold text-slate-500">직접 등록</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openSettlement()}
                  className="group flex min-h-[58px] items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-left shadow-sm transition-colors hover:bg-emerald-100"
                >
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
                    <Plus size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-emerald-900">입금/지급</span>
                    <span className="block truncate text-xs font-bold text-emerald-600">잔액 처리</span>
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:grid-cols-[minmax(240px,1fr)_170px_190px_220px_150px]">
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
                <Search size={16} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="거래처, 현장, 팀 검색"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
              </label>
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
                <Filter size={16} />
                <select
                  value={selectedTeam}
                  onChange={(event) => setSelectedTeam(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none"
                >
                  <option value="all">전체 팀</option>
                  {teamFilterOptions.map((teamName) => (
                    <option key={teamName} value={teamName}>{teamName}</option>
                  ))}
                </select>
              </label>
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
                <Landmark size={16} />
                <select
                  value={selectedPartner}
                  onChange={(event) => setSelectedPartner(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none"
                >
                  <option value="all">전체 거래처</option>
                  {partnerFilterOptions.map((partnerName) => (
                    <option key={partnerName} value={partnerName}>{partnerName}</option>
                  ))}
                </select>
              </label>
              <div className="flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-500">
                발행일 기준 조회 · 잔액 기준 {normalizedLedgerDateRange.endDate || '-'}
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as SettlementStatus)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="all">전체 상태</option>
                <option value="open">미결</option>
                <option value="partial">부분</option>
                <option value="settled">완료</option>
                <option value="overpaid">초과</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-emerald-950">미매핑 입금/지급</span>
                  <span className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-black tabular-nums text-emerald-700">
                    {unmappedPaymentStats.count.toLocaleString('ko-KR')}건 · {formatCurrency(unmappedPaymentStats.amount)}원
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-emerald-800">
                  자동추천 {unmappedPaymentStats.auto.toLocaleString('ko-KR')}건 / 후보다수 {unmappedPaymentStats.ambiguous.toLocaleString('ko-KR')}건 / 후보없음 {unmappedPaymentStats.none.toLocaleString('ko-KR')}건
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnmappedPayments((prev) => !prev)}
                className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                disabled={loading}
              >
                {showUnmappedPayments ? '미매핑 닫기' : '미매핑 리스트'}
              </button>
            </div>

            {showUnmappedPayments && (
              <div className="border-b border-slate-200 bg-white">
                {unmappedPaymentEntries.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">매핑되지 않은 입금/지급 내역이 없습니다.</div>
                ) : (
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full min-w-[1180px] border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">상태</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">구분</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">일자</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">거래처명</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">현장/내용</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">팀</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-right">입금/지급</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left">추천 원본</th>
                          <th className="border-b border-slate-200 px-3 py-3 text-center">처리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unmappedPaymentEntries.map((entry) => {
                          const entryId = normalizeText(entry.id);
                          const suggestion = entryId ? paymentMappingSuggestionsById.get(entryId) : undefined;
                          const status = suggestion?.status ?? 'none';
                          const topCandidate = suggestion?.candidates[0];
                          const teamColor = getTeamColor(entry.teamName);

                          return (
                            <tr key={entryId || `${entry.date}-${entry.partnerName}-${entry.paymentAmount}`} className="bg-amber-50/35 hover:bg-amber-50" style={{ boxShadow: `inset 4px 0 0 ${teamColor}` }}>
                              <td className="whitespace-nowrap px-3 py-3">
                                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${getPaymentMappingStatusClass(status)}`}>
                                  {getPaymentMappingStatusLabel(status)}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-md px-2 py-1 text-xs font-black ${
                                  entry.transactionType === '매출' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                                }`}>
                                  {entry.transactionType}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-700">{entry.date || '-'}</td>
                              <td className="px-3 py-3 font-black text-slate-950">{entry.partnerName || '-'}</td>
                              <td className="max-w-[240px] px-3 py-3 text-slate-700">
                                <div className="truncate" title={entry.siteName}>{entry.siteName || '-'}</div>
                                <div className="mt-0.5 truncate text-xs text-slate-400" title={entry.description || entry.note}>
                                  {entry.description || entry.note || '-'}
                                </div>
                              </td>
                              <td className="px-3 py-3"><TeamBadge name={entry.teamName} color={teamColor} /></td>
                              <td className="px-3 py-3 text-right font-black tabular-nums text-emerald-700">{formatCurrency(entry.paymentAmount)}</td>
                              <td className="max-w-[300px] px-3 py-3 text-xs font-bold text-slate-500">
                                {topCandidate ? (
                                  <>
                                    <div className="truncate text-slate-700" title={`${topCandidate.entry.date} / ${topCandidate.entry.partnerName}`}>
                                      {topCandidate.entry.date} · {topCandidate.entry.partnerName || '-'}
                                    </div>
                                    <div className="mt-0.5 truncate" title={topCandidate.reasons.join(', ')}>
                                      잔액 {formatCurrency(topCandidate.outstandingAmount)}원 · {topCandidate.reasons.join(', ')}
                                    </div>
                                  </>
                                ) : '자동 후보 없음'}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => openPaymentMapping(entry)}
                                  disabled={saving || !entryId}
                                  className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                                >
                                  매핑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'payable' && (
              <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-sm font-black text-amber-900 shadow-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-amber-600"
                      checked={allVisiblePayablesSelected}
                      onChange={toggleAllVisiblePayableSelection}
                      disabled={selectablePayableRows.length === 0}
                    />
                    {allVisiblePayablesSelected ? '전체 해제' : '전체 선택'}
                  </label>
                  <span className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-black text-amber-900">
                    선택 {selectedPayableRows.length.toLocaleString('ko-KR')}건
                  </span>
                  <span className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-black text-amber-900">
                    합계 {formatCurrency(selectedPayableTotal)}원
                  </span>
                  {kbMissingCount > 0 && (
                    <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700">
                      계좌 확인 필요 {kbMissingCount.toLocaleString('ko-KR')}건
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openKbPreview}
                  disabled={selectedPayableRows.length === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-black text-slate-950 shadow-sm hover:bg-amber-400 disabled:opacity-50"
                >
                  <Download size={16} />
                  국민은행 다운받기
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm font-bold text-slate-500">
                <Loader2 className="mr-2 animate-spin" size={18} />
                장부를 불러오는 중
              </div>
            ) : filteredInvoiceRows.length === 0 ? (
              <EmptyState label="조건에 맞는 거래가 없습니다." />
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[1380px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm">
                    <tr>
                      {viewMode === 'payable' && <th className="border-b border-slate-200 px-3 py-3 text-center">선택</th>}
                      <th className="border-b border-slate-200 px-3 py-3 text-left">상태</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">구분</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">일자</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">거래처명</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">현장명</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">팀</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-right">공급가</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-right">부가세</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-right">합계</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-right">입금/지급</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-right">잔액</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">출처</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-center">처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoiceRows.map((row) => {
                      const entry = row.entry;
                      const teamColor = getTeamColor(entry.teamName);
                      const rowId = normalizeText(entry.id);
                      const canSelectPayable = viewMode === 'payable' && entry.transactionType === '매입' && row.outstandingAmount > 0 && rowId;
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50" style={{ boxShadow: `inset 4px 0 0 ${teamColor}` }}>
                          {viewMode === 'payable' && (
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-amber-600"
                                checked={Boolean(rowId && selectedPayableRowIds.has(rowId))}
                                disabled={!canSelectPayable}
                                onChange={() => togglePayableRowSelection(rowId)}
                              />
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${getStatusClass(row.status)}`}>
                              {getStatusLabel(row.status)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-md px-2 py-1 text-xs font-black ${
                              entry.transactionType === '매출' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                            }`}>
                              {entry.transactionType}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-700">{entry.date}</td>
                          <td className="px-3 py-3 font-black text-slate-950">{entry.partnerName}</td>
                          <td className="max-w-[190px] px-3 py-3 text-slate-700">
                            <div className="truncate" title={entry.siteName}>{entry.siteName || '-'}</div>
                            {entry.description && <div className="mt-0.5 truncate text-xs text-slate-400">{entry.description}</div>}
                          </td>
                          <td className="px-3 py-3"><TeamBadge name={entry.teamName} color={teamColor} /></td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(entry.supplyAmount)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(entry.taxAmount)}</td>
                          <td className="px-3 py-3 text-right font-black tabular-nums text-slate-950">{formatCurrency(entry.totalAmount)}</td>
                          <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">{formatCurrency(row.settledAmount)}</td>
                          <td className={`px-3 py-3 text-right font-black tabular-nums ${row.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {formatCurrency(row.outstandingAmount)}
                          </td>
                          <td className="px-3 py-3 text-xs font-bold text-slate-500">
                            {sourceLabels[normalizeText(entry.sourceType)] || '장부'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openSettlement(row)}
                                disabled={row.outstandingAmount <= 0 || saving}
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title={entry.transactionType === '매출' ? '입금 등록' : '지급 등록'}
                              >
                                <Plus size={13} />
                                {entry.transactionType === '매출' ? '입금' : '지급'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditManualEntry(row)}
                                disabled={saving}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                title="수정"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteInvoiceRow(row)}
                                disabled={saving}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-3">
            <section className="border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-black text-slate-950">입금/지급 내역</h2>
              </div>
              <div className="max-h-[380px] overflow-auto">
                {paymentHistoryRows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">등록된 내역이 없습니다.</div>
                ) : paymentHistoryRows.map((entry) => {
                  const target = invoiceRows.find((row) => row.entry.id === entry.matchedEntryId)?.entry;
                  const color = getTeamColor(entry.teamName);
                  return (
                    <div key={entry.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900">{entry.partnerName || target?.partnerName || '-'}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">{entry.date} · {entry.transactionType === '매출' ? '입금' : '지급'}</div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <div className="mr-1 text-right text-sm font-black tabular-nums text-emerald-700">{formatCurrency(entry.paymentAmount)}</div>
                          <button
                            type="button"
                            onClick={() => openEditSettlement(entry)}
                            disabled={saving || !entry.matchedEntryId}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            title="수정"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSettlementEntry(entry)}
                            disabled={saving}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                            title="삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 truncate text-xs text-slate-400">{entry.note || target?.siteName || '-'}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-black text-slate-950">팀별 미결 잔액</h2>
              </div>
              <div className="max-h-[340px] overflow-auto p-3">
                {teamFilterOptions.length === 0 ? (
                  <div className="px-2 py-8 text-center text-sm font-bold text-slate-400">팀 데이터가 없습니다.</div>
                ) : teamFilterOptions.map((teamName) => {
                  const color = getTeamColor(teamName);
                  const rows = invoiceRows.filter((row) => normalizeKey(row.entry.teamName) === normalizeKey(teamName));
                  const receivable = rows.filter((row) => row.entry.transactionType === '매출').reduce((sum, row) => sum + row.outstandingAmount, 0);
                  const payable = rows.filter((row) => row.entry.transactionType === '매입').reduce((sum, row) => sum + row.outstandingAmount, 0);
                  if (receivable <= 0 && payable <= 0) return null;
                  return (
                    <button
                      key={teamName}
                      type="button"
                      onClick={() => setSelectedTeam(teamName)}
                      className="mb-2 w-full border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                      style={{ boxShadow: `inset 4px 0 0 ${color}` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <TeamBadge name={teamName} color={color} />
                        <span className="text-xs font-bold text-slate-400">선택</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                        <div className="rounded-md bg-emerald-50 px-2 py-2 text-emerald-700">미수 {formatCurrency(receivable)}</div>
                        <div className="rounded-md bg-rose-50 px-2 py-2 text-rose-700">미지급 {formatCurrency(payable)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </div>

      {modal === 'salesImport' && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-6xl`}>
            <div className="flex flex-col gap-4 border-b border-blue-900/20 bg-slate-950 px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-blue-500 text-white shadow-sm">
                  <FileText size={21} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-black">매출 가져오기</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-blue-100">
                    <span className="rounded-md bg-white/10 px-2 py-1">공급받는자 → 거래처명</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">비고 → 현장명</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">팀 → 팀</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={salesImportMonth}
                  onChange={(event) => setSalesImportMonth(event.target.value)}
                  className="h-10 rounded-md border border-white/20 bg-white px-3 text-sm font-black text-slate-900 outline-none"
                />
                <Link to="/payroll/taxinvoice/issue-list" className="inline-flex h-10 items-center rounded-md border border-white/20 bg-white/10 px-3 text-sm font-black text-white hover:bg-white/15">
                  발행리스트 열기
                </Link>
                <button type="button" onClick={closeModal} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-5">
              {taxIssueLoading ? (
                <div className="flex h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-500">
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  발행리스트를 불러오는 중
                </div>
              ) : renderCandidateTable(salesCandidates, selectedSalesIds, setSelectedSalesIds)}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black text-slate-500">선택 합계</div>
                <div className="text-xl font-black tabular-nums text-blue-700">{formatCurrency(selectedSalesCandidates.reduce((sum, row) => sum + row.totalAmount, 0))}원</div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">취소</button>
                <button
                  type="button"
                  disabled={saving || selectedSalesCandidates.length === 0}
                  onClick={() => importCandidates(selectedSalesCandidates, '매출')}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  선택 매출 가져오기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'purchaseImport' && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-6xl`}>
            <div className="flex flex-col gap-4 border-b border-violet-900/20 bg-slate-950 px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-violet-500 text-white shadow-sm">
                  <Landmark size={21} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-black">매입 가져오기</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-violet-100">
                    <span className="rounded-md bg-white/10 px-2 py-1">확정 경비</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">월별 선택</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">중복 방지</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={purchaseImportMonth}
                  onChange={(event) => setPurchaseImportMonth(event.target.value)}
                  className="h-10 rounded-md border border-white/20 bg-white px-3 text-sm font-black text-slate-900 outline-none"
                />
                <Link to="/support/expense-ledger" className="inline-flex h-10 items-center rounded-md border border-white/20 bg-white/10 px-3 text-sm font-black text-white hover:bg-white/15">
                  경비내역 열기
                </Link>
                <button type="button" onClick={closeModal} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-5">
              {expenseLedger.loading ? (
                <div className="flex h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-500">
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  경비내역을 불러오는 중
                </div>
              ) : renderCandidateTable(purchaseCandidates, selectedPurchaseIds, setSelectedPurchaseIds)}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black text-slate-500">선택 합계</div>
                <div className="text-xl font-black tabular-nums text-violet-700">{formatCurrency(selectedPurchaseCandidates.reduce((sum, row) => sum + row.totalAmount, 0))}원</div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">취소</button>
                <button
                  type="button"
                  disabled={saving || selectedPurchaseCandidates.length === 0}
                  onClick={() => importCandidates(selectedPurchaseCandidates, '매입')}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-violet-600 px-5 text-sm font-black text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  선택 매입 가져오기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'manualEntry' && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-4xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-800">
                  <FilePlus2 size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">{editingEntryId ? '거래 수정' : '수기 거래 등록'}</h2>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">거래 기본정보와 금액을 한 번에 입력합니다.</div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-50 p-5">
              <div className="grid gap-4">
                <section className={modalSectionClass}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-900">기본 정보</h3>
                    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-1 text-sm font-black">
                      {(['매출', '매입'] as WorkbookTransactionType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setManualDraft((prev) => ({ ...prev, transactionType: type }))}
                          className={`h-9 rounded px-4 transition-colors ${
                            manualDraft.transactionType === type
                              ? type === '매출'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-violet-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={modalLabelClass}>
                      일자
                      <input type="date" value={manualDraft.date} onChange={(event) => setManualDraft((prev) => ({ ...prev, date: event.target.value }))} className={modalInputClass} />
                    </label>
                    <label className={modalLabelClass}>
                      거래처명
                      <input value={manualDraft.partnerName} onChange={(event) => setManualDraft((prev) => ({ ...prev, partnerName: event.target.value }))} className={modalInputClass} />
                    </label>
                    <label className={modalLabelClass}>
                      현장명
                      <input value={manualDraft.siteName} onChange={(event) => setManualDraft((prev) => ({ ...prev, siteName: event.target.value }))} className={modalInputClass} />
                    </label>
                    <label className={modalLabelClass}>
                      팀
                      <input list="workbook-upgrade-team-options" value={manualDraft.teamName} onChange={(event) => setManualDraft((prev) => ({ ...prev, teamName: event.target.value }))} className={modalInputClass} />
                    </label>
                    <label className={`${modalLabelClass} md:col-span-2`}>
                      내용
                      <input value={manualDraft.description} onChange={(event) => setManualDraft((prev) => ({ ...prev, description: event.target.value }))} className={modalInputClass} />
                    </label>
                  </div>
                </section>

                <section className={modalSectionClass}>
                  <h3 className="mb-3 text-sm font-black text-slate-900">금액 정보</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className={modalLabelClass}>
                      공급가
                      <input inputMode="numeric" value={manualDraft.supplyAmount} onChange={(event) => setManualDraft((prev) => ({ ...prev, supplyAmount: event.target.value }))} className={`${modalInputClass} text-right tabular-nums`} />
                    </label>
                    <label className={modalLabelClass}>
                      부가세
                      <input inputMode="numeric" value={manualDraft.taxAmount} onChange={(event) => setManualDraft((prev) => ({ ...prev, taxAmount: event.target.value }))} placeholder={manualDraft.transactionType === '매출' ? '자동 10%' : '0'} className={`${modalInputClass} text-right tabular-nums`} />
                    </label>
                    <label className={modalLabelClass}>
                      합계
                      <input inputMode="numeric" value={manualDraft.totalAmount} onChange={(event) => setManualDraft((prev) => ({ ...prev, totalAmount: event.target.value }))} placeholder="공급가 + 부가세" className={`${modalInputClass} text-right font-black tabular-nums`} />
                    </label>
                  </div>
                </section>

                <section className={modalSectionClass}>
                  <label className={modalLabelClass}>
                    비고
                    <input value={manualDraft.note} onChange={(event) => setManualDraft((prev) => ({ ...prev, note: event.target.value }))} className={modalInputClass} />
                  </label>
                </section>
              </div>
            </div>
            <datalist id="workbook-upgrade-team-options">
              {teamFilterOptions.map((teamName) => <option key={teamName} value={teamName} />)}
            </datalist>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button type="button" onClick={closeModal} className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">취소</button>
              <button type="button" disabled={saving} onClick={saveManualEntry} className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingEntryId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'settlement' && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-4xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
                  <Plus size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">{editingSettlementId ? '입금/지급 수정' : '입금/지급 등록'}</h2>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">미수금과 미지급금의 처리내역을 등록합니다.</div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-50 p-5">
              <div className="grid gap-4">
                <section className={modalSectionClass}>
                  <label className={modalLabelClass}>
                    대상 거래
                    <select
                      value={settlementDraft.targetId}
                      onChange={(event) => {
                        const target = invoiceRows.find((row) => row.entry.id === event.target.value);
                        setSettlementDraft((prev) => ({
                          ...prev,
                          targetId: event.target.value,
                          amount: target ? String(Math.round(target.outstandingAmount)) : prev.amount
                        }));
                      }}
                      className={modalInputClass}
                    >
                      <option value="">선택</option>
                      {settlementTargetOptions.map((row) => (
                        <option key={row.entry.id} value={row.entry.id}>
                          [{row.entry.transactionType}] {row.entry.date} · {row.entry.partnerName} · 잔액 {formatCurrency(row.outstandingAmount)}원
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedSettlementTarget && (
                    <div className="mt-4 grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800 md:grid-cols-3">
                      <div className="truncate">거래처: {selectedSettlementTarget.entry.partnerName}</div>
                      <div className="truncate">팀: {selectedSettlementTarget.entry.teamName || '-'}</div>
                      <div className="tabular-nums">잔액: {formatCurrency(selectedSettlementTarget.outstandingAmount)}원</div>
                    </div>
                  )}
                </section>

                <section className={modalSectionClass}>
                  <h3 className="mb-3 text-sm font-black text-slate-900">처리 정보</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={modalLabelClass}>
                      일자
                      <input type="date" value={settlementDraft.date} onChange={(event) => setSettlementDraft((prev) => ({ ...prev, date: event.target.value }))} className={modalInputClass} />
                    </label>
                    <label className={modalLabelClass}>
                      금액
                      <input inputMode="numeric" value={settlementDraft.amount} onChange={(event) => setSettlementDraft((prev) => ({ ...prev, amount: event.target.value }))} className={`${modalInputClass} text-right text-lg font-black tabular-nums`} />
                    </label>
                  </div>
                </section>

                <section className={modalSectionClass}>
                  <label className={modalLabelClass}>
                    비고
                    <input value={settlementDraft.note} onChange={(event) => setSettlementDraft((prev) => ({ ...prev, note: event.target.value }))} className={modalInputClass} />
                  </label>
                </section>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button type="button" onClick={closeModal} className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">취소</button>
              <button type="button" disabled={saving || !settlementDraft.targetId} onClick={saveSettlement} className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingSettlementId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'paymentMapping' && mappingPaymentEntry && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-5xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
                  <Banknote size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">{mappingPaymentEntry.transactionType === '매입' ? '지급' : '입금'} 매핑</h2>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">매핑되지 않은 입금/지급 내역을 원본 매출/매입 거래에 연결합니다.</div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-50 p-5">
              <div className="grid gap-4">
                <section className={modalSectionClass}>
                  <div className="grid gap-2 text-sm font-bold text-slate-700 md:grid-cols-4">
                    <div>
                      <div className="text-xs font-black text-slate-400">일자</div>
                      <div className="mt-1 text-slate-950">{mappingPaymentEntry.date || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-400">거래처</div>
                      <div className="mt-1 truncate text-slate-950">{mappingPaymentEntry.partnerName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-400">현장</div>
                      <div className="mt-1 truncate text-slate-950">{mappingPaymentEntry.siteName || '-'}</div>
                    </div>
                    <div className="text-right md:text-left">
                      <div className="text-xs font-black text-slate-400">금액</div>
                      <div className="mt-1 font-black tabular-nums text-emerald-700">{formatCurrency(mappingPaymentEntry.paymentAmount)}원</div>
                    </div>
                  </div>
                  {(mappingPaymentEntry.description || mappingPaymentEntry.note) && (
                    <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                      {mappingPaymentEntry.description || mappingPaymentEntry.note}
                    </div>
                  )}
                </section>

                <section className={modalSectionClass}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-slate-900">추천 원본 거래</h3>
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${getPaymentMappingStatusClass(mappingSuggestion?.status ?? 'none')}`}>
                      {getPaymentMappingStatusLabel(mappingSuggestion?.status ?? 'none')}
                    </span>
                  </div>
                  {mappingCandidates.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-bold text-slate-400">
                      자동 후보가 없습니다. 아래에 원본 행 ID를 직접 입력할 수 있습니다.
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-auto rounded-md border border-slate-200 bg-white">
                      {mappingCandidates.map((candidate) => {
                        const candidateId = normalizeText(candidate.entry.id);
                        const checked = candidateId && selectedMappingTargetId === candidateId && !normalizeText(manualMappingTargetId);
                        return (
                          <label
                            key={candidateId || `${candidate.entry.date}-${candidate.entry.partnerName}`}
                            className={`grid cursor-pointer grid-cols-[22px_minmax(0,1fr)_130px] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 ${
                              checked ? 'bg-emerald-50' : 'bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="payment-mapping-target"
                              className="mt-1 h-4 w-4 accent-emerald-600"
                              checked={Boolean(checked)}
                              onChange={() => {
                                setSelectedMappingTargetId(candidateId);
                                setManualMappingTargetId('');
                              }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-slate-950">
                                {candidate.entry.date} · {candidate.entry.partnerName || '-'}
                              </span>
                              <span className="mt-1 block truncate text-xs font-bold text-slate-500">
                                {candidate.entry.siteName || '-'} · 합계 {formatCurrency(candidate.entry.totalAmount)}원 · 잔액 {formatCurrency(candidate.outstandingAmount)}원
                              </span>
                              <span className="mt-1 block truncate text-xs font-bold text-emerald-700">
                                {candidate.reasons.join(', ')}
                              </span>
                            </span>
                            <span className="text-right text-xs font-black tabular-nums text-slate-500">
                              점수 {Math.round(candidate.score)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className={modalSectionClass}>
                  <label className={modalLabelClass}>
                    직접 매핑 ID
                    <input
                      value={manualMappingTargetId}
                      onChange={(event) => setManualMappingTargetId(event.target.value)}
                      placeholder="후보에 없으면 원본 매출/매입 행 ID 입력"
                      className={modalInputClass}
                    />
                  </label>
                </section>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button type="button" onClick={closeModal} className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">취소</button>
              <button type="button" disabled={saving || (!selectedMappingTargetId && !manualMappingTargetId)} onClick={savePaymentMapping} className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving && <Loader2 size={16} className="animate-spin" />}
                매핑 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {showKbPreview && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-6xl bg-slate-950 text-slate-100`}>
            <div className="border-b border-slate-700 bg-slate-950 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-amber-500 text-slate-950 shadow-sm">
                    <Download size={21} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-normal text-amber-300">KB Transfer Preview</div>
                    <h2 className="mt-1 text-xl font-black text-white">국민은행용 엑셀 미리보기</h2>
                    <div className="mt-1 text-xs font-bold text-slate-400">
                      미지급금 선택 {kbPreviewRows.length.toLocaleString('ko-KR')}건 · 총 이체금액 {formatCurrency(kbTransferTotal)}원
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKbPreview(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-normal text-slate-400">
                  받는분통장표시
                  <input
                    value={kbReceiverDisplay}
                    maxLength={10}
                    onChange={(event) => setKbReceiverDisplay(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </label>
                <label className="text-xs font-black uppercase tracking-normal text-slate-400">
                  내통장메모 규칙
                  <input
                    value={kbMemoSuffix}
                    onChange={(event) => setKbMemoSuffix(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    placeholder=" 미지급금"
                  />
                </label>
              </div>
            </div>

            <div className="max-h-[56vh] overflow-auto bg-slate-900 p-5">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800 text-xs text-slate-200 shadow-sm">
                  <tr>
                    <th className="border border-slate-700 px-3 py-2 text-left">A. 은행코드</th>
                    <th className="border border-slate-700 px-3 py-2 text-left">B. 계좌번호</th>
                    <th className="border border-slate-700 px-3 py-2 text-right">C. 이체금액</th>
                    <th className="border border-slate-700 px-3 py-2 text-left">D. 받는분통장표시</th>
                    <th className="border border-slate-700 px-3 py-2 text-left">E. 내통장메모</th>
                    <th className="border border-slate-700 px-3 py-2 text-left">거래처</th>
                  </tr>
                </thead>
                <tbody>
                  {kbPreviewRows.map((row, index) => (
                    <tr key={`${row.rowId}-${index}`} className={index % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-800/40'}>
                      <td className={`border border-slate-700 px-3 py-2 ${row.bankCode ? 'text-slate-100' : 'text-rose-300'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black">{row.bankCodeDisplay}</span>
                          {row.bankCodeNeedsFix && (
                            <span className="rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-[11px] font-black text-rose-200">
                              수정요망
                            </span>
                          )}
                        </div>
                        {row.bankCodeNeedsFix && row.bankCodeReason && (
                          <div className="mt-1 text-xs font-bold text-rose-300">{row.bankCodeReason}</div>
                        )}
                      </td>
                      <td className={`border border-slate-700 px-3 py-2 font-mono ${row.accountNumber ? 'text-slate-100' : 'text-rose-300'}`}>
                        {row.accountNumber || '계좌 없음'}
                      </td>
                      <td className="border border-slate-700 px-3 py-2 text-right font-black tabular-nums text-amber-300">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="border border-slate-700 px-3 py-2 font-bold text-slate-100">{row.receiverDisplay}</td>
                      <td className="border border-slate-700 px-3 py-2 font-bold text-slate-100">{row.memoDisplay}</td>
                      <td className="border border-slate-700 px-3 py-2 text-slate-300">
                        <div className="font-black text-slate-100">{row.partnerName || '-'}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{row.siteName || '-'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-700 bg-slate-950 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-bold text-slate-300">
                총 {kbPreviewRows.length.toLocaleString('ko-KR')}건 · 총 {formatCurrency(kbTransferTotal)}원
                {kbMissingCount > 0 && <span className="ml-2 text-rose-300">계좌 확인 필요 {kbMissingCount.toLocaleString('ko-KR')}건</span>}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKbPreview(false)}
                  className="h-11 rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-black text-slate-200 hover:bg-slate-800"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={downloadKbTransferExcel}
                  disabled={downloadingKb}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-amber-500 px-5 text-sm font-black text-slate-950 shadow-sm hover:bg-amber-400 disabled:opacity-50"
                >
                  {downloadingKb ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  엑셀 다운로드 ({kbPreviewRows.length.toLocaleString('ko-KR')})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkbookLedgerUpgradePage;
