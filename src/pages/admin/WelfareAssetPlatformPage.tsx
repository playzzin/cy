import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Dice5,
  FileSpreadsheet,
  History,
  LockKeyhole,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Trophy,
  Upload,
  UserCog,
  Waves,
  WalletCards
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { userService, type UserData } from '../../services/userService';
import {
  validateWelfareDoubleEntry,
  welfareAssetService,
  type OceanReelMissPatternRuntimeConfig,
  type OceanReelStageRuntimeConfig,
  type PointRouletteSegmentRuntimeConfig,
  type WelfareGameRuntimeConfig
} from '../../services/welfareAssetService';
import logoFinished from '../../assets/logo_finished.png';
import oceanReelStageImage from '../../assets/welfare-game/ocean-reel-stage.png';
import coin100pImage from '../../assets/welfare-game/coin-100p.png';
import oceanPrizeSpritesImage from '../../assets/welfare-game/ocean-prize-sprites.png';
import type {
  WelfareAccountSnapshot,
  WelfareAdminPermission,
  WelfareAssetKind,
  WelfareAuditLog,
  WelfareBulkActionRow,
  WelfareCategory,
  WelfareGameConfig,
  WelfareGamePlay,
  WelfareLedgerPosting,
  WelfareLedgerTransaction
} from '../../types/welfareAssets';
import './WelfareAssetPlatformPage.css';

type AdminTab = 'dashboard' | 'ledger' | 'games' | 'bulk' | 'controls';
type GamePage = 'roulette' | 'ocean_reel';
type GamePanelMode = 'play' | 'settings';
type AdjustmentDirection = 'credit' | 'debit';
type CSSVariableProperties = React.CSSProperties & { [key: `--${string}`]: string | number };

interface AdjustmentDraft {
  employeeId: string;
  assetKind: WelfareAssetKind;
  direction: AdjustmentDirection;
  amount: string;
  categoryId: string;
  memo: string;
}

interface EmployeeAssetRow {
  id: string;
  name: string;
  team: string;
  role: string;
  cash: number;
  point: number;
  pointExpiresAt: string;
  dailyGamePlays: number;
}

interface AssetFlowRow {
  date: string;
  cashIn: number;
  cashOut: number;
  pointEarned: number;
  pointUsed: number;
}

interface LeaderboardRow {
  rank: number;
  name: string;
  team: string;
  score: number;
  reward: number;
}

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');

const formatNumber = (value: number) => value.toLocaleString('ko-KR');
const formatWon = (value: number) => `${formatNumber(value)}원`;
const formatPoint = (value: number) => `${formatNumber(value)}P`;
const formatMultiplier = (value: number) => `${Number.isFinite(value) ? Number(value.toFixed(2)) : 0}배`;
const toText = (value: unknown) => String(value ?? '').trim();

const buildBusinessDate = (date = new Date()) => {
  const koreanTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.toISOString().slice(0, 10);
};

const parseBusinessDate = (value: unknown): string => {
  const text = toText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return buildBusinessDate(date);
  return buildBusinessDate();
};

const getTimestampMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object') {
    const timestamp = value as { toMillis?: () => number; seconds?: number; toDate?: () => Date };
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  }
  return 0;
};

const formatTransactionTime = (value: unknown) => {
  const millis = getTimestampMillis(value);
  if (!millis) return '-';
  return new Date(millis).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const parseAmount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = parseAmount(value);
  const nextValue = parsed || fallback;
  return Math.min(Math.max(nextValue, min), max);
};

const clampIntegerIncludingZero = (value: unknown, fallback: number, min: number, max: number): number => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = parseAmount(value);
  return Math.min(Math.max(parsed, min), max);
};

const parseDecimal = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[,%\s]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = parseDecimal(value);
  const nextValue = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(nextValue, min), max);
};

const formatReturnRate = (value: number) => `${(Number.isFinite(value) ? value * 100 : 0).toFixed(1)}%`;

const getUserPostingAmount = (
  transaction: WelfareLedgerTransaction,
  assetKind: WelfareAssetKind
): number => transaction.postings
  .filter((posting) => posting.assetKind === assetKind && posting.accountScope === 'user')
  .reduce((sum, posting) => sum + posting.amount, 0);

const getParticipantNames = (transaction: WelfareLedgerTransaction): string => {
  const names = transaction.postings
    .filter((posting) => posting.accountScope === 'user')
    .map((posting) => posting.userName || posting.accountName)
    .filter(Boolean);
  return Array.from(new Set(names)).join(', ');
};

const sampleEmployees: EmployeeAssetRow[] = [
  { id: 'emp-001', name: '김도윤', team: '경영지원', role: '팀장', cash: 1280000, point: 184000, pointExpiresAt: '2026-12-31', dailyGamePlays: 1 },
  { id: 'emp-002', name: '이서연', team: '시공관리', role: '매니저', cash: 920000, point: 221500, pointExpiresAt: '2026-11-30', dailyGamePlays: 0 },
  { id: 'emp-003', name: '박민준', team: '현장운영', role: '파트장', cash: 610000, point: 143000, pointExpiresAt: '2026-10-31', dailyGamePlays: 2 },
  { id: 'emp-004', name: '최하린', team: '회계정산', role: '관리자', cash: 1540000, point: 318000, pointExpiresAt: '2027-01-31', dailyGamePlays: 0 },
  { id: 'emp-005', name: '정우진', team: '자재관리', role: '사원', cash: 430000, point: 96500, pointExpiresAt: '2026-09-30', dailyGamePlays: 1 }
];

const buildLinkedWorkersByUserId = (users: UserData[], workers: Worker[]) => {
  const workerById = new Map<string, Worker>();
  workers.forEach((worker) => {
    if (worker.id) workerById.set(String(worker.id), worker);
    if (worker.legacyId) workerById.set(String(worker.legacyId), worker);
  });

  const linkedWorkersByUserId = new Map<string, Worker[]>();
  users.forEach((user) => {
    const linked = new Map<string, Worker>();
    (user.linkedWorkerIds || []).forEach((workerId) => {
      const worker = workerById.get(String(workerId));
      if (worker?.id) linked.set(String(worker.id), worker);
    });

    workers.forEach((worker) => {
      if (worker.uid === user.uid && worker.id) linked.set(String(worker.id), worker);
    });

    linkedWorkersByUserId.set(user.uid, Array.from(linked.values()));
  });

  return linkedWorkersByUserId;
};

const buildEmployeeRowsFromUsers = (
  users: UserData[],
  workers: Worker[],
  snapshots: WelfareAccountSnapshot[]
): EmployeeAssetRow[] => {
  const linkedWorkersByUserId = buildLinkedWorkersByUserId(users, workers);
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

  return users
    .map((user): EmployeeAssetRow => {
      const linkedWorkers = linkedWorkersByUserId.get(user.uid) || [];
      const primaryWorker = linkedWorkers[0];
      const cashSnapshot = snapshotsById.get(`user:${user.uid}:cash`);
      const pointSnapshot = snapshotsById.get(`user:${user.uid}:point`);
      const name = toText(primaryWorker?.name)
        || toText(user.displayName)
        || toText(user.email)
        || user.uid;

      return {
        id: user.uid,
        name,
        team: toText(primaryWorker?.teamName) || toText(user.department) || '미배정',
        role: toText(user.position) || toText(primaryWorker?.role) || toText(user.role) || '일반',
        cash: cashSnapshot?.balance ?? 0,
        point: pointSnapshot?.balance ?? 0,
        pointExpiresAt: '정책별',
        dailyGamePlays: 0
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'));
};

const assetFlow: AssetFlowRow[] = [
  { date: '05.07', cashIn: 520, cashOut: 180, pointEarned: 880, pointUsed: 240 },
  { date: '05.08', cashIn: 610, cashOut: 260, pointEarned: 930, pointUsed: 310 },
  { date: '05.09', cashIn: 460, cashOut: 210, pointEarned: 760, pointUsed: 280 },
  { date: '05.10', cashIn: 740, cashOut: 330, pointEarned: 1010, pointUsed: 420 },
  { date: '05.11', cashIn: 680, cashOut: 290, pointEarned: 970, pointUsed: 390 },
  { date: '05.12', cashIn: 810, cashOut: 360, pointEarned: 1180, pointUsed: 470 },
  { date: '05.13', cashIn: 930, cashOut: 410, pointEarned: 1260, pointUsed: 510 }
];

const buildAssetFlowFromTransactions = (
  transactions: WelfareLedgerTransaction[],
  fallback: AssetFlowRow[]
): AssetFlowRow[] => {
  if (transactions.length === 0) return fallback.map((row) => ({ ...row, cashIn: 0, cashOut: 0, pointEarned: 0, pointUsed: 0 }));

  const dateKeys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return buildBusinessDate(date);
  });
  const rows = new Map<string, AssetFlowRow>();
  dateKeys.forEach((dateKey) => {
    rows.set(dateKey, {
      date: dateKey.slice(5).replace('-', '.'),
      cashIn: 0,
      cashOut: 0,
      pointEarned: 0,
      pointUsed: 0
    });
  });

  transactions.forEach((transaction) => {
    const dateKey = parseBusinessDate(transaction.businessDate || transaction.transactionAt);
    const row = rows.get(dateKey);
    if (!row) return;

    const cashAmount = getUserPostingAmount(transaction, 'cash') / 1000;
    const pointAmount = getUserPostingAmount(transaction, 'point') / 1000;
    if (cashAmount >= 0) row.cashIn += cashAmount;
    else row.cashOut += Math.abs(cashAmount);
    if (pointAmount >= 0) row.pointEarned += pointAmount;
    else row.pointUsed += Math.abs(pointAmount);
  });

  return dateKeys.map((dateKey) => rows.get(dateKey) as AssetFlowRow);
};

const gameStats = [
  { name: '릴게임', plays: 184, reward: 460000 },
  { name: '해양 릴게임', plays: 139, reward: 312000 }
];

const leaderboardRows: LeaderboardRow[] = [
  { rank: 1, name: '최하린', team: '회계정산', score: 9820, reward: 85000 },
  { rank: 2, name: '이서연', team: '시공관리', score: 9210, reward: 72000 },
  { rank: 3, name: '김도윤', team: '경영지원', score: 8770, reward: 65000 },
  { rank: 4, name: '박민준', team: '현장운영', score: 8010, reward: 52000 }
];

const defaultCategories: WelfareCategory[] = [
  { id: 'birthday', name: '생일 축하', assetKind: 'point', source: 'manual_adjustment', direction: 'credit', active: true, expiresAfterDays: 365 },
  { id: 'top-performer', name: '우수 사원', assetKind: 'both', source: 'manual_adjustment', direction: 'credit', active: true, approvalRequired: true },
  { id: 'store', name: '사내 매점 이용', assetKind: 'point', source: 'store_purchase', direction: 'debit', active: true },
  { id: 'payroll-sync', name: '급여 정산 연동', assetKind: 'cash', source: 'payroll_sync', direction: 'both', active: true },
  { id: 'cash-credit', name: '캐시/크레딧 수동 조정', assetKind: 'cash', source: 'manual_adjustment', direction: 'both', active: true },
  { id: 'point-adjustment', name: '포인트 수동 조정', assetKind: 'point', source: 'manual_adjustment', direction: 'both', active: true, expiresAfterDays: 365 },
  { id: 'expiry', name: '포인트 소멸', assetKind: 'point', source: 'point_expiry', direction: 'debit', active: true }
];

const defaultAdminPermissions: WelfareAdminPermission[] = [
  {
    id: 'viewer',
    grade: 'viewer',
    label: '조회자',
    roleAliases: ['viewer', 'user', '일반'],
    ledger: true,
    adjustCash: false,
    adjustPoint: false,
    game: false,
    bulk: false,
    categories: false,
    permissions: false,
    active: true
  },
  {
    id: 'operator',
    grade: 'operator',
    label: '운영자',
    roleAliases: ['operator', 'manager', '매니저', '운영자'],
    ledger: true,
    adjustCash: false,
    adjustPoint: true,
    game: true,
    bulk: false,
    categories: false,
    permissions: false,
    active: true
  },
  {
    id: 'asset_manager',
    grade: 'asset_manager',
    label: '자산 관리자',
    roleAliases: ['asset_manager', '자산관리자', '자산 관리자', '정산관리자', '정산 관리자'],
    ledger: true,
    adjustCash: true,
    adjustPoint: true,
    game: true,
    bulk: true,
    categories: true,
    permissions: false,
    active: true
  },
  {
    id: 'super_admin',
    grade: 'super_admin',
    label: '최고 관리자',
    roleAliases: ['super_admin', 'admin', 'administrator', 'owner', '관리자', '사장', '실장'],
    ledger: true,
    adjustCash: true,
    adjustPoint: true,
    game: true,
    bulk: true,
    categories: true,
    permissions: true,
    active: true
  }
];

const isCategoryEligible = (
  category: WelfareCategory,
  assetKind: WelfareAssetKind,
  direction: AdjustmentDirection
): boolean => category.active
  && (category.assetKind === 'both' || category.assetKind === assetKind)
  && (category.direction === 'both' || category.direction === direction);

const getAssetLabel = (assetKind: WelfareCategory['assetKind']) => {
  if (assetKind === 'both') return '공통';
  return assetKind === 'cash' ? '캐시/크레딧' : '포인트';
};

const getSourceLabel = (source: WelfareCategory['source']) => ({
  manual_adjustment: '수동',
  bulk_action: '일괄',
  payroll_sync: '급여',
  game_play: '게임',
  store_purchase: '매점',
  point_expiry: '소멸',
  refund: '환급'
}[source] || source);

const getDirectionLabel = (direction: WelfareCategory['direction']) => ({
  credit: '지급',
  debit: '회수',
  both: '지급/회수'
}[direction]);

const getAuditActionLabel = (action: string) => ({
  CREATE_WELFARE_LEDGER: '원장 생성',
  UPSERT_WELFARE_CATEGORY: '항목 저장',
  DELETE_WELFARE_CATEGORY: '항목 비활성화',
  SAVE_WELFARE_ADMIN_PERMISSIONS: '권한 저장',
  SEED_WELFARE_ASSET_MASTERS: '기본 마스터 동기화',
  SAVE_WELFARE_GAME_CONFIG: '게임 확률 저장',
  PLAY_WELFARE_POINT_GAME: '포인트 게임'
}[action] || action);

const gameConfigs: WelfareGameConfig[] = [
  { id: 'point-roulette', name: '포인트 룰렛', type: 'roulette', assetKind: 'point', stake: 100, dailyLimit: 3, active: true, expectedReturnRate: 0.74 },
  { id: 'ocean-reel', name: '해양 릴게임', type: 'ocean_reel', assetKind: 'point', stake: 100, dailyLimit: 0, active: true, expectedReturnRate: 0.7 },
];

const oceanReelAlgorithmVersion = 'ocean-reel-v3-cumulative-probability';

const oceanReelStages = [
  { stage: 1, symbol: '해파리', payout: '5배', multiplierText: '5배', oddsText: '10분의 1', minMultiplier: 5, maxMultiplier: 5, oddsDenominator: 10, color: '#06b6d4', spritePosition: '0% 0%' },
  { stage: 2, symbol: '물고기', payout: '10배', multiplierText: '10배', oddsText: '100분의 1', minMultiplier: 10, maxMultiplier: 10, oddsDenominator: 100, color: '#2563eb', spritePosition: '100% 0%' },
  { stage: 3, symbol: '상어', payout: '30~50배', multiplierText: '30~50배', oddsText: '1,000분의 1', minMultiplier: 30, maxMultiplier: 50, oddsDenominator: 1000, color: '#7c3aed', spritePosition: '0% 100%' },
  { stage: 4, symbol: '고래', payout: '100~1000배', multiplierText: '100~1000배', oddsText: '10,000분의 1', minMultiplier: 100, maxMultiplier: 1000, oddsDenominator: 10000, color: '#f59e0b', spritePosition: '100% 100%' }
];

const defaultOceanReelMissPatterns: OceanReelMissPatternRuntimeConfig[] = [
  { pattern: '1-2-3', stages: [1, 2, 3], weight: 18 },
  { pattern: '2-3-1', stages: [2, 3, 1], weight: 16 },
  { pattern: '4-2-1', stages: [4, 2, 1], weight: 12 },
  { pattern: '1-3-4', stages: [1, 3, 4], weight: 12 },
  { pattern: '3-1-2', stages: [3, 1, 2], weight: 12 },
  { pattern: '2-4-3', stages: [2, 4, 3], weight: 10 },
  { pattern: '4-1-3', stages: [4, 1, 3], weight: 8 },
  { pattern: '3-2-4', stages: [3, 2, 4], weight: 6 },
  { pattern: '1-4-2', stages: [1, 4, 2], weight: 4 },
  { pattern: '4-3-2', stages: [4, 3, 2], weight: 2 }
];

const oceanReelSpinStages = [...oceanReelStages, ...oceanReelStages];

const fallingCoinDrops = [
  { id: 'coin-1', left: '8%', delay: '-1.2s', duration: '4.5s', resultDuration: '3.2s', drift: '38px', size: '58px', opacity: '0.72' },
  { id: 'coin-2', left: '22%', delay: '-2.4s', duration: '5.2s', resultDuration: '3.6s', drift: '-26px', size: '46px', opacity: '0.62' },
  { id: 'coin-3', left: '45%', delay: '-0.7s', duration: '4.8s', resultDuration: '3.1s', drift: '18px', size: '72px', opacity: '0.82' },
  { id: 'coin-4', left: '66%', delay: '-3.1s', duration: '5.6s', resultDuration: '3.9s', drift: '-42px', size: '52px', opacity: '0.66' },
  { id: 'coin-5', left: '82%', delay: '-1.8s', duration: '4.9s', resultDuration: '3.3s', drift: '30px', size: '64px', opacity: '0.76' },
  { id: 'coin-6', left: '93%', delay: '-3.9s', duration: '6s', resultDuration: '4s', drift: '-58px', size: '42px', opacity: '0.58' }
];

const reelColumnStyles: CSSVariableProperties[] = [
  { '--reel-duration': '980ms', '--reel-delay': '0ms' },
  { '--reel-duration': '1060ms', '--reel-delay': '80ms' },
  { '--reel-duration': '1140ms', '--reel-delay': '160ms' }
];

type ReelPhase = 'idle' | 'spinning' | 'revealed';
type RoulettePhase = 'idle' | 'spinning' | 'revealed';

const defaultPointRouletteSegments: PointRouletteSegmentRuntimeConfig[] = [
  { id: 'miss-1', label: 'MISS', subLabel: '다음 기회', multiplier: 0, probability: 0.27, color: '#1e293b' },
  { id: 'base-1', label: '원금', subLabel: '원금 보전', multiplier: 1, probability: 0.15, color: '#0891b2' },
  { id: 'bonus', label: '2배', subLabel: '2배', multiplier: 2, probability: 0.12, color: '#16a34a' },
  { id: 'miss-2', label: 'MISS', subLabel: '다음 기회', multiplier: 0, probability: 0.27, color: '#334155' },
  { id: 'jackpot', label: '5배', subLabel: '5배', multiplier: 5, probability: 0.04, color: '#f59e0b' },
  { id: 'base-2', label: '원금', subLabel: '원금 보전', multiplier: 1, probability: 0.15, color: '#2563eb' }
];

const getPointRouletteSegmentDisplay = (
  segment: Pick<PointRouletteSegmentRuntimeConfig, 'label' | 'subLabel' | 'multiplier'>,
  stake: number
): { label: string; subLabel: string; reward: number } => {
  const multiplier = Number.isFinite(segment.multiplier) ? Math.max(segment.multiplier, 0) : 0;
  const reward = Math.trunc(Math.max(stake, 0) * multiplier);
  if (multiplier <= 0) {
    return {
      label: 'MISS',
      subLabel: segment.subLabel || '다음 기회',
      reward: 0
    };
  }

  return {
    label: formatPoint(reward),
    subLabel: multiplier === 1 ? '원금 보전' : formatMultiplier(multiplier),
    reward
  };
};

const getPointRouletteResultLabel = (reward: number, fallbackLabel = 'MISS'): string => (
  reward > 0 ? formatPoint(reward) : fallbackLabel || 'MISS'
);

const getRouletteSegmentIndex = (resultLabel: string, segments: PointRouletteSegmentRuntimeConfig[], stake: number): number => {
  const matchingIndex = segments.findIndex((segment) => {
    const display = getPointRouletteSegmentDisplay(segment, stake);
    return segment.label === resultLabel || display.label === resultLabel;
  });
  if (matchingIndex >= 0) return matchingIndex;
  if (resultLabel.includes('5배') || resultLabel.includes('잭팟')) return 4;
  if (resultLabel.includes('2배') || resultLabel.includes('보너스')) return 2;
  if (resultLabel.includes('원금')) return 1;
  return 0;
};

const getNextRouletteRotation = (currentRotation: number, segmentIndex: number, segmentCount: number): number => {
  const rouletteSliceAngle = 360 / Math.max(segmentCount, 1);
  const segmentCenter = segmentIndex * rouletteSliceAngle + rouletteSliceAngle / 2;
  const targetModulo = 360 - segmentCenter;
  const baseRotation = Math.ceil(currentRotation / 360) * 360 + 1440 + targetModulo;
  return baseRotation <= currentRotation + 720 ? baseRotation + 1080 : baseRotation;
};

interface ReelGameResult {
  label: string;
  reward: number;
  stake: number;
  multiplier: number;
  finalStage: number;
  finalSymbol: string;
  attempts: number;
  settledBy: string;
  hit: boolean;
  reelStops: number[];
  algorithmVersion: string;
  hitRate: number;
  missRate: number;
}

interface PointRouletteResult {
  label: string;
  reward: number;
  stake: number;
  multiplier: number;
  segmentIndex: number;
  algorithmVersion: string;
  hitRate: number;
  missRate: number;
  expectedReturnRate: number;
}

type OceanReelStage = typeof oceanReelStages[number];

interface OceanReelSettingDraft {
  stage: number;
  symbol: string;
  oddsDenominator: string;
  minMultiplier: string;
  maxMultiplier: string;
}

interface OceanReelMissPatternDraft {
  pattern: string;
  stages: number[];
  weight: string;
}

interface PointRouletteSettingDraft {
  id: string;
  label: string;
  subLabel: string;
  color?: string;
  multiplier: string;
  probabilityPercent: string;
}

interface GameRuleSettingDraft {
  stake: string;
  dailyLimit: string;
}

const getOceanReelStage = (stageNumber: number): OceanReelStage => (
  oceanReelStages.find((stage) => stage.stage === stageNumber) || oceanReelStages[0]
);

const formatOceanPayout = (stage: Pick<OceanReelStageRuntimeConfig, 'minMultiplier' | 'maxMultiplier'>): string => (
  stage.minMultiplier === stage.maxMultiplier
    ? `${formatNumber(stage.minMultiplier)}배`
    : `${formatNumber(stage.minMultiplier)}~${formatNumber(stage.maxMultiplier)}배`
);

const createOceanReelSettingsDraft = (config?: WelfareGameRuntimeConfig | null): OceanReelSettingDraft[] => (
  oceanReelStages.map((stage) => {
    const loadedStage = config?.oceanReelStages?.find((item) => item.stage === stage.stage);
    return {
      stage: stage.stage,
      symbol: stage.symbol,
      oddsDenominator: String(loadedStage?.oddsDenominator ?? stage.oddsDenominator),
      minMultiplier: String(loadedStage?.minMultiplier ?? stage.minMultiplier),
      maxMultiplier: String(loadedStage?.maxMultiplier ?? stage.maxMultiplier)
    };
  })
);

const createOceanMissPatternDraft = (config?: WelfareGameRuntimeConfig | null): OceanReelMissPatternDraft[] => (
  defaultOceanReelMissPatterns.map((pattern) => {
    const loadedPattern = config?.oceanReelMissPatterns?.find((item) => item.pattern === pattern.pattern);
    return {
      pattern: pattern.pattern,
      stages: pattern.stages,
      weight: String(loadedPattern?.weight ?? pattern.weight)
    };
  })
);

const createPointRouletteSettingsDraft = (config?: WelfareGameRuntimeConfig | null): PointRouletteSettingDraft[] => (
  defaultPointRouletteSegments.map((segment) => {
    const loadedSegment = config?.pointRouletteSegments?.find((item) => item.id === segment.id);
    const probabilityPercent = ((loadedSegment?.probability ?? segment.probability) * 100).toFixed(2).replace(/\.?0+$/, '') || '0';
    return {
      id: segment.id,
      label: loadedSegment?.label ?? segment.label,
      subLabel: loadedSegment?.subLabel ?? segment.subLabel,
      color: loadedSegment?.color ?? segment.color,
      multiplier: String(loadedSegment?.multiplier ?? segment.multiplier),
      probabilityPercent
    };
  })
);

const createDefaultGameRuleSettings = (): Record<string, GameRuleSettingDraft> => (
  gameConfigs.reduce((acc, game) => {
    acc[game.id] = {
      stake: String(game.stake),
      dailyLimit: String(game.dailyLimit)
    };
    return acc;
  }, {} as Record<string, GameRuleSettingDraft>)
);

const createGameRuleSettingDraft = (gameId: string, config?: WelfareGameRuntimeConfig | null): GameRuleSettingDraft => {
  const fallback = gameConfigs.find((game) => game.id === gameId) || gameConfigs[0];
  return {
    stake: String(config?.stake ?? fallback.stake),
    dailyLimit: String(config?.dailyLimit ?? fallback.dailyLimit)
  };
};

const normalizeOceanReelSettings = (settings: OceanReelSettingDraft[]): OceanReelStageRuntimeConfig[] => (
  oceanReelStages.map((stage) => {
    const draft = settings.find((item) => item.stage === stage.stage);
    const minMultiplier = clampInteger(draft?.minMultiplier, stage.minMultiplier, 1, 10000);
    const maxMultiplier = clampInteger(draft?.maxMultiplier, stage.maxMultiplier, 1, 10000);
    return {
      stage: stage.stage,
      symbol: stage.symbol,
      oddsDenominator: clampInteger(draft?.oddsDenominator, stage.oddsDenominator, 1, 10000000),
      minMultiplier: Math.min(minMultiplier, maxMultiplier),
      maxMultiplier: Math.max(minMultiplier, maxMultiplier)
    };
  })
);

const normalizeOceanMissPatternSettings = (settings: OceanReelMissPatternDraft[]): OceanReelMissPatternRuntimeConfig[] => {
  const patterns = defaultOceanReelMissPatterns.map((pattern) => {
    const draft = settings.find((item) => item.pattern === pattern.pattern);
    return {
      pattern: pattern.pattern,
      stages: pattern.stages,
      weight: clampInteger(draft?.weight, pattern.weight, 0, 1000000)
    };
  });
  const totalWeight = patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
  return totalWeight > 0 ? patterns : defaultOceanReelMissPatterns;
};

const normalizePointRouletteSettings = (settings: PointRouletteSettingDraft[]): PointRouletteSegmentRuntimeConfig[] => (
  defaultPointRouletteSegments.map((segment) => {
    const draft = settings.find((item) => item.id === segment.id);
    return {
      id: segment.id,
      label: draft?.label || segment.label,
      subLabel: draft?.subLabel || segment.subLabel,
      color: draft?.color || segment.color,
      multiplier: Math.trunc(clampNumber(draft?.multiplier, segment.multiplier, 0, 10000)),
      probability: clampNumber(draft?.probabilityPercent, segment.probability * 100, 0, 100) / 100
    };
  })
);

const normalizeGameRuleSettings = (
  settings: Record<string, GameRuleSettingDraft>
): Record<string, { stake: number; dailyLimit: number }> => (
  gameConfigs.reduce((acc, game) => {
    const draft = settings[game.id];
    acc[game.id] = {
      stake: clampInteger(draft?.stake, game.stake, 1, 1000000),
      dailyLimit: clampIntegerIncludingZero(draft?.dailyLimit, game.dailyLimit, 0, 10000)
    };
    return acc;
  }, {} as Record<string, { stake: number; dailyLimit: number }>)
);

const calculateOceanReturnRate = (settings: OceanReelStageRuntimeConfig[]): number => (
  settings.reduce((sum, stage) => {
    const averageMultiplier = (stage.minMultiplier + stage.maxMultiplier) / 2;
    return sum + (averageMultiplier / Math.max(stage.oddsDenominator, 1));
  }, 0)
);

const calculateOceanHitRate = (settings: OceanReelStageRuntimeConfig[]): number => (
  settings.reduce((sum, stage) => sum + (1 / Math.max(stage.oddsDenominator, 1)), 0)
);

const calculatePointRouletteReturnRate = (settings: PointRouletteSegmentRuntimeConfig[]): number => (
  settings.reduce((sum, segment) => sum + (segment.probability * segment.multiplier), 0)
);

const calculatePointRouletteHitRate = (settings: PointRouletteSegmentRuntimeConfig[]): number => (
  settings.reduce((sum, segment) => sum + (segment.multiplier > 0 ? segment.probability : 0), 0)
);

const readOceanReelStops = (metadata: Record<string, unknown>, fallbackStage: number): number[] => {
  const rawStops = metadata.reelStops;
  if (Array.isArray(rawStops)) {
    const parsedStops = rawStops
      .map((stop) => {
        if (typeof stop === 'object' && stop !== null) return parseAmount((stop as { stage?: unknown }).stage);
        return parseAmount(stop);
      })
      .filter((stage) => oceanReelStages.some((item) => item.stage === stage));
    if (parsedStops.length >= 3) return parsedStops.slice(0, 3);
  }

  if (fallbackStage > 0) return [fallbackStage, fallbackStage, fallbackStage];
  return [1, 2, 4];
};

const buildPostings = (
  user: EmployeeAssetRow,
  cashAmount: number,
  pointAmount: number,
  memo: string
): WelfareLedgerPosting[] => {
  const postings: WelfareLedgerPosting[] = [];

  if (cashAmount !== 0) {
    postings.push(
      {
        accountId: `user:${user.id}:cash`,
        accountName: `${user.name} 캐시`,
        accountScope: 'user',
        assetKind: 'cash',
        userId: user.id,
        userName: user.name,
        amount: cashAmount,
        memo
      },
      {
        accountId: 'company:cash_pool',
        accountName: '전사 캐시 풀',
        accountScope: 'company',
        assetKind: 'cash',
        amount: -cashAmount,
        memo
      }
    );
  }

  if (pointAmount !== 0) {
    postings.push(
      {
        accountId: `user:${user.id}:point`,
        accountName: `${user.name} 포인트`,
        accountScope: 'user',
        assetKind: 'point',
        userId: user.id,
        userName: user.name,
        amount: pointAmount,
        memo
      },
      {
        accountId: 'company:point_pool',
        accountName: '전사 포인트 풀',
        accountScope: 'company',
        assetKind: 'point',
        amount: -pointAmount,
        memo
      }
    );
  }

  return postings;
};

const getReelResultMessage = (result: ReelGameResult): string => {
  if (!result.hit || result.reward <= 0) {
    return `미당첨 · 차감 ${formatPoint(result.stake)} · 릴 숫자 ${result.reelStops.join('-')}`;
  }
  const net = result.reward - result.stake;
  const base = `${result.finalStage}단계 ${result.finalSymbol} ${formatMultiplier(result.multiplier)} 정산 · 차감 ${formatPoint(result.stake)} · 보상 ${formatPoint(result.reward)}`;
  if (net > 0) return `${base} · 순이익 +${formatPoint(net)}`;
  if (net === 0) return `${base} · 원금 보전`;
  return `${base} · 손실 ${formatPoint(Math.abs(net))}`;
};

const normalizeComparable = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');

const isBuiltInAdminRole = (value: unknown) => [
  'admin',
  'super_admin',
  'administrator',
  'owner',
  '관리자',
  '사장',
  '실장'
].includes(normalizeComparable(value));

const resolveAdminAccess = (
  currentUserProfile: UserData | undefined,
  permissions: WelfareAdminPermission[]
): WelfareAdminPermission => {
  const superAdmin = defaultAdminPermissions.find((row) => row.id === 'super_admin') as WelfareAdminPermission;
  const viewer = defaultAdminPermissions.find((row) => row.id === 'viewer') as WelfareAdminPermission;
  const roleValues = [
    currentUserProfile?.role,
    currentUserProfile?.position,
    ...(currentUserProfile?.additionalPositions || [])
  ].filter(Boolean);

  if (roleValues.some(isBuiltInAdminRole)) return superAdmin;

  const roleSet = new Set(roleValues.map(normalizeComparable));
  return permissions.find((row) => {
    if (row.active === false) return false;
    return [row.id, row.grade, row.label, ...row.roleAliases].some((alias) => roleSet.has(normalizeComparable(alias)));
  }) || viewer;
};

const createClientRequestId = (prefix: string) => {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${randomId}`;
};

const formatWelfareActionError = (error: unknown) => {
  const firebaseError = error as { code?: string; message?: string };
  const code = String(firebaseError?.code || '').toLowerCase();
  const message = String(firebaseError?.message || '');

  if (code.includes('functions/not-found') || code.includes('not-found')) {
    return '복지 자산 Functions가 아직 배포되지 않았습니다. functions 배포 후 다시 시도해 주세요.';
  }
  if (code.includes('permission-denied')) {
    return '포인트/캐시 지급 권한이 없습니다. 권한/항목 탭에서 현재 계정 역할을 확인해 주세요.';
  }
  if (code.includes('failed-precondition')) {
    return message || '잔액 또는 복식 원장 조건을 만족하지 못해 처리하지 않았습니다.';
  }
  if (code.includes('resource-exhausted')) {
    return message || '오늘 허용된 게임 실행 횟수를 모두 사용했습니다.';
  }
  if (code.includes('unauthenticated')) {
    return '로그인 세션이 만료되었습니다. 다시 로그인 후 시도해 주세요.';
  }

  return message || '지급/회수 처리에 실패했습니다.';
};

const readSettled = <T,>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  errors: string[]
): T => {
  if (result.status === 'fulfilled') return result.value;
  const message = result.reason instanceof Error ? result.reason.message : String(result.reason ?? '알 수 없는 오류');
  errors.push(`${label}: ${message}`);
  return fallback;
};

const WelfareAssetPlatformPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [accountSnapshots, setAccountSnapshots] = useState<WelfareAccountSnapshot[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<WelfareLedgerTransaction[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<WelfareAdminPermission[]>(defaultAdminPermissions);
  const [auditLogs, setAuditLogs] = useState<WelfareAuditLog[]>([]);
  const [gamePlays, setGamePlays] = useState<WelfareGamePlay[]>([]);
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState<WelfareAssetKind | 'all'>('all');
  const [gamePage, setGamePage] = useState<GamePage>('roulette');
  const [gamePanelMode, setGamePanelMode] = useState<GamePanelMode>('play');
  const [gameRuleSettings, setGameRuleSettings] = useState<Record<string, GameRuleSettingDraft>>(() => createDefaultGameRuleSettings());
  const [pointRouletteSettings, setPointRouletteSettings] = useState<PointRouletteSettingDraft[]>(() => createPointRouletteSettingsDraft());
  const [oceanReelSettings, setOceanReelSettings] = useState<OceanReelSettingDraft[]>(() => createOceanReelSettingsDraft());
  const [oceanMissPatternSettings, setOceanMissPatternSettings] = useState<OceanReelMissPatternDraft[]>(() => createOceanMissPatternDraft());
  const [gameConfigLoading, setGameConfigLoading] = useState(false);
  const [gameConfigSaving, setGameConfigSaving] = useState(false);
  const [categories, setCategories] = useState<WelfareCategory[]>(defaultCategories);
  const [categoryDraft, setCategoryDraft] = useState({
    name: '',
    assetKind: 'point' as WelfareCategory['assetKind'],
    source: 'manual_adjustment' as WelfareCategory['source'],
    direction: 'both' as WelfareCategory['direction'],
    expiresAfterDays: '365',
    approvalRequired: false
  });
  const [categorySaving, setCategorySaving] = useState(false);
  const [bulkRows, setBulkRows] = useState<WelfareBulkActionRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState('사용자 DB 기본 지급안');
  const [bulkFileUploaded, setBulkFileUploaded] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft>({
    employeeId: '',
    assetKind: 'point',
    direction: 'credit',
    amount: '',
    categoryId: '',
    memo: ''
  });
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [masterSyncing, setMasterSyncing] = useState(false);
  const [roulettePointBalance, setRoulettePointBalance] = useState(0);
  const [roulettePlays, setRoulettePlays] = useState(0);
  const [dailyGameUsageCounts, setDailyGameUsageCounts] = useState<Record<string, number>>({});
  const [roulettePhase, setRoulettePhase] = useState<ReelPhase>('idle');
  const [pointRoulettePlays, setPointRoulettePlays] = useState(0);
  const [pointRoulettePhase, setPointRoulettePhase] = useState<RoulettePhase>('idle');
  const [pointRouletteRotation, setPointRouletteRotation] = useState(0);
  const [lastPointRouletteResult, setLastPointRouletteResult] = useState<PointRouletteResult | null>(null);
  const [gameSubmitting, setGameSubmitting] = useState(false);
  const [lastGameResult, setLastGameResult] = useState<ReelGameResult | null>(null);
  const adjustmentSubmitKeyRef = useRef<string | null>(null);
  const bulkSubmitKeyRef = useRef<string | null>(null);
  const rouletteRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointRouletteRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUserAssetData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const todayKey = buildBusinessDate();
      const [
        usersResult,
        workersResult,
        transactionsResult,
        categoriesResult,
        permissionsResult,
        auditLogsResult,
        gamePlaysResult,
        dailyUsageResult
      ] = await Promise.allSettled([
        userService.getAllUsers(),
        manpowerService.getWorkers(true),
        welfareAssetService.getRecentLedgerTransactions(200),
        welfareAssetService.getActiveCategories(),
        welfareAssetService.getAdminPermissions(),
        welfareAssetService.getAuditLogs(50),
        welfareAssetService.getGamePlaysForDate(todayKey, 200),
        currentUser?.uid
          ? welfareAssetService.getDailyGameUsageCounts(currentUser.uid, todayKey, gameConfigs.map((game) => game.id))
          : Promise.resolve({} as Record<string, number>)
      ]);
      const loadErrors: string[] = [];
      const loadedUsers = readSettled(usersResult, [] as UserData[], '사용자 DB', loadErrors);
      const loadedWorkers = readSettled(workersResult, [] as Worker[], '작업자 DB', loadErrors);
      const loadedTransactions = readSettled(transactionsResult, [] as WelfareLedgerTransaction[], '복지 원장', loadErrors);
      const loadedCategories = readSettled(categoriesResult, [] as WelfareCategory[], '복지 항목', loadErrors);
      const loadedPermissions = readSettled(permissionsResult, [] as WelfareAdminPermission[], '복지 권한', loadErrors);
      const loadedAuditLogs = readSettled(auditLogsResult, [] as WelfareAuditLog[], '감사 로그', loadErrors);
      const loadedGamePlays = readSettled(gamePlaysResult, [] as WelfareGamePlay[], '게임 기록', loadErrors);
      const loadedDailyUsageCounts = readSettled(dailyUsageResult, {} as Record<string, number>, '게임 참여 횟수', loadErrors);

      const snapshotUserIds = Array.from(new Set([
        ...loadedUsers.map((user) => user.uid),
        currentUser?.uid
      ].filter(Boolean) as string[]));
      const snapshotsResult = await Promise.allSettled([
        welfareAssetService.getUserAccountSnapshots(snapshotUserIds)
      ]);
      const loadedSnapshots = readSettled(
        snapshotsResult[0],
        [] as WelfareAccountSnapshot[],
        '자산 잔액',
        loadErrors
      );

      setUsers(loadedUsers);
      setWorkers(loadedWorkers);
      setAccountSnapshots(loadedSnapshots);
      setLedgerTransactions(loadedTransactions);
      setCategories(loadedCategories.length > 0 ? loadedCategories : defaultCategories);
      setAdminPermissions(loadedPermissions.length > 0 ? loadedPermissions : defaultAdminPermissions);
      setAuditLogs(loadedAuditLogs);
      setGamePlays(loadedGamePlays);
      setDailyGameUsageCounts(loadedDailyUsageCounts);
      if (loadErrors.length > 0) {
        setDataError(`일부 데이터를 불러오지 못했습니다. ${loadErrors.slice(0, 3).join(' / ')}`);
      }
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to load user asset data', error);
      setDataError(error instanceof Error ? error.message : '사용자 자산 데이터를 불러오지 못했습니다.');
    } finally {
      setLoadingData(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    void loadUserAssetData();
  }, [loadUserAssetData]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let active = true;
    setGameConfigLoading(true);
    Promise.allSettled([
      welfareAssetService.getGameRuntimeConfig('point-roulette'),
      welfareAssetService.getGameRuntimeConfig('ocean-reel')
    ])
      .then(([pointResult, oceanResult]) => {
        if (!active) return;
        if (pointResult.status === 'fulfilled' && pointResult.value) {
          setPointRouletteSettings(createPointRouletteSettingsDraft(pointResult.value));
          setGameRuleSettings((prev) => ({
            ...prev,
            'point-roulette': createGameRuleSettingDraft('point-roulette', pointResult.value)
          }));
        }
        if (oceanResult.status === 'fulfilled' && oceanResult.value) {
          setOceanReelSettings(createOceanReelSettingsDraft(oceanResult.value));
          setOceanMissPatternSettings(createOceanMissPatternDraft(oceanResult.value));
          setGameRuleSettings((prev) => ({
            ...prev,
            'ocean-reel': createGameRuleSettingDraft('ocean-reel', oceanResult.value)
          }));
        }
      })
      .catch((error) => {
        console.warn('[WelfareAssetPlatformPage] failed to load game config', error);
      })
      .finally(() => {
        if (active) setGameConfigLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.uid]);

  const employeeRows = useMemo(
    () => buildEmployeeRowsFromUsers(users, workers, accountSnapshots),
    [accountSnapshots, users, workers]
  );
  const employeeById = useMemo(() => new Map(employeeRows.map((employee) => [employee.id, employee])), [employeeRows]);
  const employeeLookup = useMemo(() => {
    const lookup = new Map<string, EmployeeAssetRow>();
    employeeRows.forEach((employee) => {
      [employee.id, employee.name, `${employee.name}${employee.team}`].forEach((key) => {
        const normalized = normalizeComparable(key);
        if (normalized && !lookup.has(normalized)) lookup.set(normalized, employee);
      });
    });
    return lookup;
  }, [employeeRows]);
  const currentUserProfile = useMemo(
    () => users.find((user) => user.uid === currentUser?.uid),
    [currentUser?.uid, users]
  );
  const currentAdminAccess = useMemo(
    () => resolveAdminAccess(currentUserProfile, adminPermissions),
    [adminPermissions, currentUserProfile]
  );
  const accountSnapshotById = useMemo(
    () => new Map(accountSnapshots.map((snapshot) => [snapshot.id, snapshot])),
    [accountSnapshots]
  );
  const roulettePlayer = useMemo<EmployeeAssetRow | null>(() => {
    if (!currentUser?.uid) return null;
    const employee = employeeById.get(currentUser.uid);
    if (employee) return employee;

    return {
      id: currentUser.uid,
      name: toText(currentUserProfile?.displayName) || toText(currentUser.displayName) || toText(currentUser.email) || currentUser.uid,
      team: toText(currentUserProfile?.department) || '미배정',
      role: toText(currentUserProfile?.position) || toText(currentUserProfile?.role) || '일반',
      cash: accountSnapshotById.get(`user:${currentUser.uid}:cash`)?.balance ?? 0,
      point: accountSnapshotById.get(`user:${currentUser.uid}:point`)?.balance ?? 0,
      pointExpiresAt: '정책별',
      dailyGamePlays: 0
    };
  }, [accountSnapshotById, currentUser, currentUserProfile, employeeById]);

  const displayedEmployees = employeeRows;
  const displayedTransactions = ledgerTransactions;
  const todayBusinessDate = buildBusinessDate();
  const resolveBulkEmployee = useCallback((row: WelfareBulkActionRow) => (
    employeeById.get(row.employeeId)
    || employeeLookup.get(normalizeComparable(row.employeeId))
    || employeeLookup.get(normalizeComparable(row.employeeName))
  ), [employeeById, employeeLookup]);
  const assetFlowData = useMemo(
    () => buildAssetFlowFromTransactions(displayedTransactions, assetFlow),
    [displayedTransactions]
  );
  const adjustmentCategories = useMemo(
    () => categories.filter((category) => isCategoryEligible(category, adjustmentDraft.assetKind, adjustmentDraft.direction)),
    [adjustmentDraft.assetKind, adjustmentDraft.direction, categories]
  );

  useEffect(() => {
    setAdjustmentDraft((prev) => ({
      ...prev,
      employeeId: prev.employeeId || employeeRows[0]?.id || '',
      categoryId: adjustmentCategories.some((category) => category.id === prev.categoryId)
        ? prev.categoryId
        : adjustmentCategories[0]?.id || ''
    }));
  }, [adjustmentCategories, employeeRows]);

  useEffect(() => {
    if (bulkFileUploaded) return;

    if (employeeRows.length === 0) {
      setBulkRows([]);
      return;
    }

    setBulkRows(employeeRows.slice(0, 30).map((employee): WelfareBulkActionRow => ({
      id: `user-db-${employee.id}`,
      employeeId: employee.id,
      employeeName: employee.name,
      assetKind: 'point',
      amount: 0,
      categoryId: categories.find((category) => isCategoryEligible(category, 'point', 'credit'))?.id,
      categoryName: categories.find((category) => isCategoryEligible(category, 'point', 'credit'))?.name || '일괄 지급',
      memo: `${employee.team} / ${employee.role}`,
      validationStatus: 'warning',
      validationMessage: '지급/회수 금액 입력 필요'
    })));
  }, [bulkFileUploaded, categories, employeeRows]);

  const totals = useMemo(() => {
    const cash = displayedEmployees.reduce((sum, row) => sum + row.cash, 0);
    const point = displayedEmployees.reduce((sum, row) => sum + row.point, 0);
    const todayTransactions = displayedTransactions.filter((row) => row.businessDate === todayBusinessDate);
    const todayCashDelta = todayTransactions.reduce((sum, row) => sum + getUserPostingAmount(row, 'cash'), 0);
    const todayPointDelta = todayTransactions.reduce((sum, row) => sum + getUserPostingAmount(row, 'point'), 0);
    const invalidTransactionCount = displayedTransactions.filter((row) => !validateWelfareDoubleEntry(row.postings).valid).length;
    return { cash, point, todayCashDelta, todayPointDelta, invalidTransactionCount };
  }, [displayedEmployees, displayedTransactions, todayBusinessDate]);

  const filteredTransactions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return displayedTransactions.filter((transaction) => {
      const matchesText = !normalized
        || transaction.title.toLowerCase().includes(normalized)
        || transaction.categoryName.toLowerCase().includes(normalized)
        || getParticipantNames(transaction).toLowerCase().includes(normalized);
      const matchesAsset = assetFilter === 'all'
        || transaction.postings.some((posting) => posting.assetKind === assetFilter);
      return matchesText && matchesAsset;
    });
  }, [assetFilter, displayedTransactions, search]);

  const assetMix = useMemo(() => [
    { name: '캐시', value: totals.cash, color: '#2563eb' },
    { name: '포인트', value: totals.point, color: '#16a34a' }
  ], [totals.cash, totals.point]);

  const gameStats = useMemo(() => gameConfigs.map((game) => {
    const plays = gamePlays.filter((play) => play.gameId === game.id);
    return {
      name: game.name.replace('포인트 ', ''),
      plays: plays.length,
      reward: plays.reduce((sum, play) => sum + play.reward, 0)
    };
  }), [gamePlays]);

  const displayedLeaderboardRows = useMemo(() => {
    const employeeByUserId = new Map(displayedEmployees.map((employee) => [employee.id, employee]));
    const byUser = new Map<string, { name: string; team: string; score: number; reward: number }>();
    gamePlays.forEach((play) => {
      const employee = employeeByUserId.get(play.userId);
      const current = byUser.get(play.userId) || {
        name: employee?.name || play.userName || play.userId,
        team: employee?.team || '미배정',
        score: 0,
        reward: 0
      };
      current.score += play.reward;
      current.reward += play.reward;
      byUser.set(play.userId, current);
    });

    return Array.from(byUser.values())
      .sort((left, right) => right.reward - left.reward)
      .slice(0, 10)
      .map((row, index): LeaderboardRow => ({
        rank: index + 1,
        ...row
      }));
  }, [displayedEmployees, gamePlays]);

  const normalizedGameRuleSettings = useMemo(
    () => normalizeGameRuleSettings(gameRuleSettings),
    [gameRuleSettings]
  );
  const normalizedPointRouletteSettings = useMemo(
    () => normalizePointRouletteSettings(pointRouletteSettings),
    [pointRouletteSettings]
  );
  const pointRouletteExpectedReturnRate = useMemo(
    () => calculatePointRouletteReturnRate(normalizedPointRouletteSettings),
    [normalizedPointRouletteSettings]
  );
  const pointRouletteHitRate = useMemo(
    () => calculatePointRouletteHitRate(normalizedPointRouletteSettings),
    [normalizedPointRouletteSettings]
  );
  const pointRouletteMissRate = Math.max(0, 1 - pointRouletteHitRate);
  const pointRouletteProbabilityTotal = normalizedPointRouletteSettings.reduce((sum, segment) => sum + segment.probability, 0);
  const pointRouletteConfigError = Math.abs(pointRouletteProbabilityTotal - 1) > 0.0001
    ? `포인트 룰렛 확률 합계가 100%가 되어야 합니다. 현재 ${formatReturnRate(pointRouletteProbabilityTotal)}입니다.`
    : '';
  const pointRouletteSliceAngle = 360 / Math.max(normalizedPointRouletteSettings.length, 1);
  const pointRouletteWheelBackground = `conic-gradient(${normalizedPointRouletteSettings
    .map((segment, index) => `${segment.color || '#64748b'} ${index * pointRouletteSliceAngle}deg ${(index + 1) * pointRouletteSliceAngle}deg`)
    .join(', ')})`;
  const normalizedOceanReelSettings = useMemo(
    () => normalizeOceanReelSettings(oceanReelSettings),
    [oceanReelSettings]
  );
  const normalizedOceanMissPatternSettings = useMemo(
    () => normalizeOceanMissPatternSettings(oceanMissPatternSettings),
    [oceanMissPatternSettings]
  );
  const oceanExpectedReturnRate = useMemo(
    () => calculateOceanReturnRate(normalizedOceanReelSettings),
    [normalizedOceanReelSettings]
  );
  const oceanHitRate = useMemo(
    () => calculateOceanHitRate(normalizedOceanReelSettings),
    [normalizedOceanReelSettings]
  );
  const oceanMissRate = Math.max(0, 1 - oceanHitRate);
  const oceanMissPatternTotalWeight = normalizedOceanMissPatternSettings.reduce((sum, pattern) => sum + pattern.weight, 0);
  const oceanConfigError = oceanHitRate >= 1
    ? '당첨 확률 합계가 100% 이상입니다. 확률 분모를 키워서 미당첨 구간을 남겨야 합니다.'
    : oceanMissPatternTotalWeight <= 0
      ? '미일치 조합 가중치를 최소 1개 이상 입력해야 합니다.'
      : '';
  const configuredGameConfigs = useMemo(() => gameConfigs.map((game) => ({
    ...game,
    ...(normalizedGameRuleSettings[game.id] || { stake: game.stake, dailyLimit: game.dailyLimit }),
    expectedReturnRate: game.type === 'ocean_reel' ? oceanExpectedReturnRate : pointRouletteExpectedReturnRate
  })), [normalizedGameRuleSettings, oceanExpectedReturnRate, pointRouletteExpectedReturnRate]);
  const pointRoulette = configuredGameConfigs.find((game) => game.type === 'roulette') || configuredGameConfigs[0];
  const roulette = configuredGameConfigs.find((game) => game.type === 'ocean_reel') || configuredGameConfigs[0];
  const pointRouletteStake = pointRoulette.stake;
  const rouletteStake = roulette.stake;
  const pointRouletteLimitReached = pointRoulette.dailyLimit > 0 && pointRoulettePlays >= pointRoulette.dailyLimit;
  const rouletteLimitReached = roulette.dailyLimit > 0 && roulettePlays >= roulette.dailyLimit;
  const pointRouletteLimitLabel = pointRoulette.dailyLimit > 0 ? `일 ${pointRoulette.dailyLimit}회` : '횟수 제한 없음';
  const rouletteLimitLabel = roulette.dailyLimit > 0 ? `일 ${roulette.dailyLimit}회` : '횟수 제한 없음';
  const pointRouletteNetChange = lastPointRouletteResult ? lastPointRouletteResult.reward - lastPointRouletteResult.stake : null;
  const rouletteNetChange = lastGameResult ? lastGameResult.reward - lastGameResult.stake : null;
  const winningOceanStage = lastGameResult?.hit ? getOceanReelStage(lastGameResult.finalStage) : null;
  const canPlayPointRoulette = Boolean(roulettePlayer)
    && pointRoulette.active
    && !gameSubmitting
    && pointRoulettePhase !== 'spinning'
    && pointRouletteStake > 0
    && pointRouletteStake <= roulettePointBalance
    && !pointRouletteLimitReached;
  const canPlayRoulette = Boolean(roulettePlayer)
    && roulette.active
    && !gameSubmitting
    && roulettePhase !== 'spinning'
    && rouletteStake > 0
    && rouletteStake <= roulettePointBalance
    && !rouletteLimitReached;
  const pointRouletteDisabledReason = !currentUser?.uid
    ? '로그인 후 플레이할 수 있습니다.'
    : !roulettePlayer
      ? '플레이어 정보를 불러오는 중입니다.'
      : pointRouletteLimitReached
        ? '오늘 룰렛 참여 횟수를 모두 사용했습니다.'
        : pointRouletteStake > roulettePointBalance
          ? '사용 가능한 포인트가 부족합니다.'
          : '';
  const rouletteDisabledReason = !currentUser?.uid
    ? '로그인 후 플레이할 수 있습니다.'
    : !roulettePlayer
      ? '플레이어 정보를 불러오는 중입니다.'
      : rouletteLimitReached
        ? '오늘 릴게임 참여 횟수를 모두 사용했습니다.'
        : rouletteStake > roulettePointBalance
            ? '사용 가능한 포인트가 부족합니다.'
            : '';
  const selectedAdjustmentEmployee = employeeById.get(adjustmentDraft.employeeId);
  const selectedAdjustmentCategory = categories.find((category) => category.id === adjustmentDraft.categoryId);
  const signedAdjustmentAmount = Math.abs(parseAmount(adjustmentDraft.amount))
    * (adjustmentDraft.direction === 'credit' ? 1 : -1);
  const canSubmitAdjustment = Boolean(selectedAdjustmentEmployee)
    && Boolean(selectedAdjustmentCategory)
    && Boolean(selectedAdjustmentCategory && isCategoryEligible(selectedAdjustmentCategory, adjustmentDraft.assetKind, adjustmentDraft.direction))
    && signedAdjustmentAmount !== 0
    && (adjustmentDraft.assetKind === 'cash' ? currentAdminAccess.adjustCash : currentAdminAccess.adjustPoint);
  const canSubmitBulk = currentAdminAccess.bulk;

  useEffect(() => {
    const countRecordedPlays = (gameId: string) => gamePlays.filter((play) => (
      play.userId === roulettePlayer?.id
      && play.gameId === gameId
      && play.businessDate === todayBusinessDate
    )).length;
    const readUsageCount = (gameId: string, fallback: number) => (
      Object.prototype.hasOwnProperty.call(dailyGameUsageCounts, gameId)
        ? dailyGameUsageCounts[gameId]
        : fallback
    );

    setRoulettePointBalance(roulettePlayer?.point ?? 0);
    setPointRoulettePlays(readUsageCount(pointRoulette.id, countRecordedPlays(pointRoulette.id)));
    setRoulettePlays(readUsageCount(roulette.id, countRecordedPlays(roulette.id)));
  }, [dailyGameUsageCounts, gamePlays, pointRoulette.id, roulette.id, roulettePlayer?.id, roulettePlayer?.point, todayBusinessDate]);

  useEffect(() => {
    setLastPointRouletteResult(null);
    setPointRoulettePhase('idle');
    setLastGameResult(null);
    setRoulettePhase('idle');
  }, [roulettePlayer?.id]);

  useEffect(() => () => {
    if (rouletteRevealTimerRef.current) {
      clearTimeout(rouletteRevealTimerRef.current);
    }
    if (pointRouletteRevealTimerRef.current) {
      clearTimeout(pointRouletteRevealTimerRef.current);
    }
  }, []);

  const tooltipStyle = {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 8,
    color: darkMode ? '#e2e8f0' : '#0f172a'
  };

  const validateBulkRows = useCallback((rows: WelfareBulkActionRow[]) => rows.map((row): WelfareBulkActionRow => {
    const employee = resolveBulkEmployee(row);
    const amount = parseAmount(row.amount);
    const direction: AdjustmentDirection = amount >= 0 ? 'credit' : 'debit';
    const category = categories.find((item) => (
      (row.categoryId && item.id === row.categoryId)
      || (!row.categoryId && item.name === row.categoryName)
    ));

    if (!employee) {
      return { ...row, validationStatus: 'error', validationMessage: '사용자 DB에 없는 직원' };
    }
    if (!amount) {
      return { ...row, validationStatus: 'warning', validationMessage: '금액 입력 필요' };
    }
    if (!category || !isCategoryEligible(category, row.assetKind, direction)) {
      return { ...row, validationStatus: 'error', validationMessage: '자산/방향에 맞는 항목 필요' };
    }

    return {
      ...row,
      employeeId: employee.id,
      employeeName: employee.name,
      amount,
      categoryId: category.id,
      categoryName: category.name,
      validationStatus: 'ready',
      validationMessage: amount > 0 ? '지급 준비 완료' : '회수 준비 완료'
    };
  }), [categories, resolveBulkEmployee]);

  const addCategory = async () => {
    const name = categoryDraft.name.trim();
    if (!name) return;
    if (!currentAdminAccess.categories) {
      setActionMessage({ tone: 'error', text: '항목 관리 권한이 없습니다.' });
      return;
    }

    setCategorySaving(true);
    setActionMessage(null);
    try {
      const input = {
        name,
        assetKind: categoryDraft.assetKind,
        source: categoryDraft.source,
        direction: categoryDraft.direction,
        active: true,
        expiresAfterDays: categoryDraft.assetKind === 'cash' ? undefined : Number(categoryDraft.expiresAfterDays) || undefined,
        approvalRequired: categoryDraft.approvalRequired
      };
      const result = await welfareAssetService.upsertCategory(input);
      setCategories((prev) => [
        ...prev.filter((category) => category.id !== result.categoryId),
        { id: result.categoryId, ...input }
      ]);
      setCategoryDraft({
        name: '',
        assetKind: 'point',
        source: 'manual_adjustment',
        direction: 'both',
        expiresAfterDays: '365',
        approvalRequired: false
      });
      setActionMessage({ tone: 'success', text: '항목을 Firestore 마스터에 저장했습니다.' });
      void loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to save category', error);
      setActionMessage({ tone: 'error', text: error instanceof Error ? error.message : '항목 저장에 실패했습니다.' });
    } finally {
      setCategorySaving(false);
    }
  };

  const handleBulkFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkFileUploaded(true);
    setBulkFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      const parsed = rows.slice(0, 50).map((row, index): WelfareBulkActionRow => {
        const employeeName = String(row['성명'] || row['이름'] || row['employeeName'] || '').trim();
        const employeeId = String(row['직원ID'] || row['employeeId'] || `row-${index + 1}`).trim();
        const assetKindRaw = String(row['자산'] || row['assetKind'] || 'point').toLowerCase();
        const assetKind: WelfareAssetKind = assetKindRaw.includes('cash') || assetKindRaw.includes('캐시') ? 'cash' : 'point';
        const amount = Number(String(row['금액'] || row['amount'] || 0).replace(/,/g, ''));
        const categoryName = String(row['항목'] || row['categoryName'] || '일괄 지급').trim();
        return {
          id: `upload-${index}`,
          employeeId,
          employeeName: employeeName || '(이름 없음)',
          assetKind,
          amount: Number.isFinite(amount) ? Math.trunc(amount) : 0,
          categoryId: categories.find((category) => category.name === categoryName)?.id,
          categoryName,
          memo: String(row['메모'] || row['memo'] || '').trim(),
          validationStatus: 'warning',
          validationMessage: '검증 대기'
        };
      });
      if (parsed.length > 0) setBulkRows(validateBulkRows(parsed));
    } catch (error) {
      console.error('[WelfareAssetPlatform] Failed to parse bulk file', error);
      setBulkRows((prev) => prev.map((row) => ({
        ...row,
        validationStatus: row.validationStatus === 'ready' ? 'warning' : row.validationStatus,
        validationMessage: '파일 파싱 실패, 샘플 데이터 유지'
      })));
    }
  };

  const updateBulkRow = (rowId: string, updates: Partial<WelfareBulkActionRow>) => {
    setBulkRows((prev) => validateBulkRows(prev.map((row) => (
      row.id === rowId ? { ...row, ...updates } : row
    ))));
  };

  const submitAdjustment = async () => {
    if (adjustmentSubmitKeyRef.current) return;
    if (!selectedAdjustmentEmployee || !selectedAdjustmentCategory || signedAdjustmentAmount === 0) return;
    if (!canSubmitAdjustment) {
      setActionMessage({ tone: 'error', text: '해당 자산을 지급/회수할 권한이 없습니다.' });
      return;
    }

    const requestKey = createClientRequestId('manual-adjustment');
    adjustmentSubmitKeyRef.current = requestKey;
    setAdjustmentSubmitting(true);
    setActionMessage(null);
    try {
      const postings = buildPostings(
        selectedAdjustmentEmployee,
        adjustmentDraft.assetKind === 'cash' ? signedAdjustmentAmount : 0,
        adjustmentDraft.assetKind === 'point' ? signedAdjustmentAmount : 0,
        adjustmentDraft.memo.trim() || `${selectedAdjustmentCategory.name} ${adjustmentDraft.direction === 'credit' ? '지급' : '회수'}`
      );

      await welfareAssetService.createLedgerTransaction({
        title: `${selectedAdjustmentCategory.name} ${getAssetLabel(adjustmentDraft.assetKind)} ${adjustmentDraft.direction === 'credit' ? '지급' : '회수'}`,
        categoryId: selectedAdjustmentCategory.id,
        categoryName: selectedAdjustmentCategory.name,
        source: selectedAdjustmentCategory.source,
        businessDate: buildBusinessDate(),
        postings,
        idempotencyKey: requestKey,
        metadata: {
          mode: 'single',
          requestKey,
          direction: adjustmentDraft.direction,
          assetKind: adjustmentDraft.assetKind
        }
      });

      setAdjustmentDraft((prev) => ({ ...prev, amount: '', memo: '' }));
      setActionMessage({ tone: 'success', text: '지급/회수 거래를 원장에 반영했습니다.' });
      await loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to submit adjustment', error);
      setActionMessage({ tone: 'error', text: formatWelfareActionError(error) });
    } finally {
      adjustmentSubmitKeyRef.current = null;
      setAdjustmentSubmitting(false);
    }
  };

  const submitBulkRows = async () => {
    if (bulkSubmitKeyRef.current) return;
    if (!canSubmitBulk) {
      setActionMessage({ tone: 'error', text: '일괄 지급/회수 권한이 없습니다.' });
      return;
    }

    const validated = validateBulkRows(bulkRows);
    setBulkRows(validated);
    const readyRows = validated.filter((row) => row.validationStatus === 'ready');
    if (readyRows.length === 0) {
      setActionMessage({ tone: 'error', text: '처리 가능한 일괄 지급/회수 행이 없습니다.' });
      return;
    }

    const postings = readyRows.flatMap((row) => {
      const employee = resolveBulkEmployee(row);
      if (!employee) return [];
      const amount = parseAmount(row.amount);
      return buildPostings(
        employee,
        row.assetKind === 'cash' ? amount : 0,
        row.assetKind === 'point' ? amount : 0,
        row.memo || row.categoryName
      );
    });

    const validation = validateWelfareDoubleEntry(postings);
    if (!validation.valid) {
      setActionMessage({ tone: 'error', text: validation.errors.join('\n') });
      return;
    }

    const requestKey = createClientRequestId('bulk-adjustment');
    bulkSubmitKeyRef.current = requestKey;
    setBulkSubmitting(true);
    setActionMessage(null);
    try {
      const categoryNames = Array.from(new Set(readyRows.map((row) => row.categoryName)));
      await welfareAssetService.createLedgerTransaction({
        title: `일괄 지급/회수 ${readyRows.length}건`,
        categoryId: categoryNames.length === 1 ? readyRows[0].categoryId || 'bulk-action' : 'bulk-mixed',
        categoryName: categoryNames.length === 1 ? categoryNames[0] : '일괄 지급/회수',
        source: 'bulk_action',
        businessDate: buildBusinessDate(),
        postings,
        idempotencyKey: requestKey,
        metadata: {
          requestKey,
          fileName: bulkFileName,
          rowCount: readyRows.length,
          rows: readyRows.map((row) => ({
            employeeId: row.employeeId,
            assetKind: row.assetKind,
            amount: parseAmount(row.amount),
            categoryName: row.categoryName
          }))
        }
      });

      setActionMessage({ tone: 'success', text: `${readyRows.length}건을 원장에 반영했습니다.` });
      setBulkRows((prev) => prev.map((row) => (
        row.validationStatus === 'ready'
          ? { ...row, amount: 0, validationStatus: 'warning', validationMessage: '처리 완료, 다음 금액 입력 가능' }
          : row
      )));
      await loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to submit bulk rows', error);
      setActionMessage({ tone: 'error', text: formatWelfareActionError(error) });
    } finally {
      bulkSubmitKeyRef.current = null;
      setBulkSubmitting(false);
    }
  };

  const deleteCategory = async (category: WelfareCategory) => {
    if (!currentAdminAccess.categories) {
      setActionMessage({ tone: 'error', text: '항목 관리 권한이 없습니다.' });
      return;
    }

    setCategorySaving(true);
    setActionMessage(null);
    try {
      await welfareAssetService.deleteCategory(category.id);
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
      setActionMessage({ tone: 'success', text: '항목을 비활성화했습니다.' });
      void loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to delete category', error);
      setActionMessage({ tone: 'error', text: error instanceof Error ? error.message : '항목 삭제에 실패했습니다.' });
    } finally {
      setCategorySaving(false);
    }
  };

  const updatePermissionRow = (
    grade: WelfareAdminPermission['grade'],
    updates: Partial<WelfareAdminPermission>
  ) => {
    setAdminPermissions((prev) => prev.map((row) => (
      row.grade === grade ? { ...row, ...updates } : row
    )));
  };

  const savePermissions = async () => {
    if (!currentAdminAccess.permissions) {
      setActionMessage({ tone: 'error', text: '권한 마스터 저장 권한이 없습니다.' });
      return;
    }

    setPermissionSaving(true);
    setActionMessage(null);
    try {
      await welfareAssetService.saveAdminPermissions(adminPermissions);
      setActionMessage({ tone: 'success', text: '권한 마스터를 Firestore에 저장했습니다.' });
      await loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to save permissions', error);
      setActionMessage({ tone: 'error', text: error instanceof Error ? error.message : '권한 저장에 실패했습니다.' });
    } finally {
      setPermissionSaving(false);
    }
  };

  const syncDefaultMasters = async () => {
    if (!currentAdminAccess.permissions) {
      setActionMessage({ tone: 'error', text: '기본 마스터 동기화 권한이 없습니다.' });
      return;
    }

    setMasterSyncing(true);
    setActionMessage(null);
    try {
      const result = await welfareAssetService.seedDefaultMasters();
      setActionMessage({ tone: 'success', text: `항목 ${result.categories}건, 권한 ${result.permissions}건을 동기화했습니다.` });
      await loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to sync masters', error);
      setActionMessage({ tone: 'error', text: error instanceof Error ? error.message : '기본 마스터 동기화에 실패했습니다.' });
    } finally {
      setMasterSyncing(false);
    }
  };

  const updateOceanReelSetting = (
    stageNumber: number,
    field: keyof Pick<OceanReelSettingDraft, 'oddsDenominator' | 'minMultiplier' | 'maxMultiplier'>,
    value: string
  ) => {
    setOceanReelSettings((prev) => prev.map((row) => (
      row.stage === stageNumber ? { ...row, [field]: value.replace(/[^\d]/g, '') } : row
    )));
  };

  const updateOceanMissPatternSetting = (pattern: string, value: string) => {
    setOceanMissPatternSettings((prev) => prev.map((row) => (
      row.pattern === pattern ? { ...row, weight: value.replace(/[^\d]/g, '') } : row
    )));
  };

  const updatePointRouletteSetting = (
    segmentId: string,
    field: keyof Pick<PointRouletteSettingDraft, 'multiplier' | 'probabilityPercent'>,
    value: string
  ) => {
    setPointRouletteSettings((prev) => prev.map((row) => (
      row.id === segmentId ? { ...row, [field]: value.replace(/[^\d.]/g, '') } : row
    )));
  };

  const updateGameRuleSetting = (
    gameId: string,
    field: keyof GameRuleSettingDraft,
    value: string
  ) => {
    setGameRuleSettings((prev) => ({
      ...prev,
      [gameId]: {
        ...(prev[gameId] || createGameRuleSettingDraft(gameId)),
        [field]: value.replace(/[^\d]/g, '')
      }
    }));
  };

  const savePointRouletteSettings = async () => {
    if (!currentAdminAccess.game) {
      setActionMessage({ tone: 'error', text: '게임 설정 저장 권한이 없습니다.' });
      return;
    }
    if (pointRouletteConfigError) {
      setActionMessage({ tone: 'error', text: pointRouletteConfigError });
      return;
    }

    setGameConfigSaving(true);
    setActionMessage(null);
    try {
      const config = await welfareAssetService.saveGameRuntimeConfig({
        gameId: 'point-roulette',
        type: 'roulette',
        ...(normalizedGameRuleSettings['point-roulette'] || { stake: pointRoulette.stake, dailyLimit: pointRoulette.dailyLimit }),
        pointRouletteSegments: normalizedPointRouletteSettings
      });
      setPointRouletteSettings(createPointRouletteSettingsDraft(config));
      setGameRuleSettings((prev) => ({
        ...prev,
        'point-roulette': createGameRuleSettingDraft('point-roulette', config)
      }));
      setActionMessage({ tone: 'success', text: `포인트 룰렛 설정을 저장했습니다. 당첨 ${formatReturnRate(config.hitRate)} · 미당첨 ${formatReturnRate(config.missRate)} · 환급률 ${formatReturnRate(config.expectedReturnRate)}` });
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to save point roulette config', error);
      setActionMessage({ tone: 'error', text: formatWelfareActionError(error) });
    } finally {
      setGameConfigSaving(false);
    }
  };

  const saveOceanReelSettings = async () => {
    if (!currentAdminAccess.game) {
      setActionMessage({ tone: 'error', text: '게임 설정 저장 권한이 없습니다.' });
      return;
    }
    if (oceanConfigError) {
      setActionMessage({ tone: 'error', text: oceanConfigError });
      return;
    }

    setGameConfigSaving(true);
    setActionMessage(null);
    try {
      const config = await welfareAssetService.saveGameRuntimeConfig({
        gameId: 'ocean-reel',
        type: 'ocean_reel',
        ...(normalizedGameRuleSettings['ocean-reel'] || { stake: roulette.stake, dailyLimit: roulette.dailyLimit }),
        oceanReelStages: normalizedOceanReelSettings,
        oceanReelMissPatterns: normalizedOceanMissPatternSettings
      });
      setOceanReelSettings(createOceanReelSettingsDraft(config));
      setOceanMissPatternSettings(createOceanMissPatternDraft(config));
      setGameRuleSettings((prev) => ({
        ...prev,
        'ocean-reel': createGameRuleSettingDraft('ocean-reel', config)
      }));
      setActionMessage({ tone: 'success', text: `해양 릴게임 설정을 저장했습니다. 당첨 ${formatReturnRate(config.hitRate)} · 미당첨 ${formatReturnRate(config.missRate)} · 환급률 ${formatReturnRate(config.expectedReturnRate)}` });
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to save game config', error);
      setActionMessage({ tone: 'error', text: formatWelfareActionError(error) });
    } finally {
      setGameConfigSaving(false);
    }
  };

  const playRouletteGame = async () => {
    if (!currentUser?.uid || !roulettePlayer) {
      setActionMessage({ tone: 'error', text: '해양 릴게임은 현재 로그인한 사용자 계정으로만 실행할 수 있습니다.' });
      return;
    }
    if (!canPlayRoulette) {
      setActionMessage({ tone: 'error', text: rouletteDisabledReason || '해양 릴게임을 실행할 수 없습니다.' });
      return;
    }

    setGameSubmitting(true);
    setRoulettePhase('spinning');
    setLastGameResult(null);
    setActionMessage(null);
    if (rouletteRevealTimerRef.current) {
      clearTimeout(rouletteRevealTimerRef.current);
      rouletteRevealTimerRef.current = null;
    }
    try {
      const result = await welfareAssetService.playPointGame({
        gameId: roulette.id,
        gameName: roulette.name,
        userId: currentUser.uid,
        userName: roulettePlayer.name,
        stake: rouletteStake,
        dailyLimit: roulette.dailyLimit,
        idempotencyKey: createClientRequestId('point-game')
      });
      const metadata = result.metadata || {};
      const finalStage = parseAmount(metadata.finalStage);
      const settledStake = parseAmount(metadata.unitStake) || rouletteStake;
      const multiplier = settledStake > 0 ? result.reward / settledStake : 0;
      const hit = metadata.hit === true || (result.reward > 0 && finalStage > 0);
      const algorithmVersion = String(metadata.algorithmVersion || '');
      const serverHitRate = typeof metadata.hitRate === 'number' ? metadata.hitRate : 0;
      const serverMissRate = typeof metadata.missRate === 'number' ? metadata.missRate : 0;
      const nextResult: ReelGameResult = {
        label: result.resultLabel,
        reward: result.reward,
        stake: settledStake,
        multiplier,
        finalStage,
        finalSymbol: String(metadata.finalSymbol || result.resultLabel.split(' ')[0] || '정산'),
        attempts: parseAmount(metadata.attempts) || 1,
        settledBy: String(metadata.settledBy || ''),
        hit,
        reelStops: readOceanReelStops(metadata, finalStage),
        algorithmVersion,
        hitRate: serverHitRate,
        missRate: serverMissRate
      };
      const nextRoulettePlayCount = roulette.dailyLimit > 0 && Number.isFinite(result.remainingPlays) && result.remainingPlays >= 0
        ? Math.max(roulette.dailyLimit - result.remainingPlays, roulettePlays + 1)
        : roulettePlays + 1;
      setRoulettePointBalance((prev) => prev - settledStake + result.reward);
      setRoulettePlays(nextRoulettePlayCount);
      setDailyGameUsageCounts((prev) => ({
        ...prev,
        [roulette.id]: Math.max(prev[roulette.id] ?? 0, nextRoulettePlayCount)
      }));
      setActionMessage({ tone: 'info', text: '릴이 멈추는 중입니다.' });
      rouletteRevealTimerRef.current = setTimeout(() => {
        setLastGameResult(nextResult);
        setRoulettePhase('revealed');
        const versionWarning = algorithmVersion !== oceanReelAlgorithmVersion
          ? ' · 구버전 Functions 호출 중'
          : '';
        setActionMessage({
          tone: algorithmVersion !== oceanReelAlgorithmVersion ? 'error' : nextResult.reward >= nextResult.stake ? 'success' : 'info',
          text: `${getReelResultMessage(nextResult)} · 오늘 ${nextRoulettePlayCount}회 참여${versionWarning}`
        });
        rouletteRevealTimerRef.current = null;
      }, 1350);
      void loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to play point game', error);
      setRoulettePhase('idle');
      setActionMessage({ tone: 'error', text: formatWelfareActionError(error) });
    } finally {
      setGameSubmitting(false);
    }
  };

  const playPointRoulette = async () => {
    if (!currentUser?.uid || !roulettePlayer) {
      setActionMessage({ tone: 'error', text: '포인트 룰렛은 현재 로그인한 사용자 계정으로만 실행할 수 있습니다.' });
      return;
    }
    if (!canPlayPointRoulette) {
      setActionMessage({ tone: 'error', text: pointRouletteDisabledReason || '포인트 룰렛을 실행할 수 없습니다.' });
      return;
    }

    setGameSubmitting(true);
    setPointRoulettePhase('spinning');
    setLastPointRouletteResult(null);
    setActionMessage(null);
    if (pointRouletteRevealTimerRef.current) {
      clearTimeout(pointRouletteRevealTimerRef.current);
      pointRouletteRevealTimerRef.current = null;
    }

    try {
      const result = await welfareAssetService.playPointGame({
        gameId: pointRoulette.id,
        gameName: pointRoulette.name,
        userId: currentUser.uid,
        userName: roulettePlayer.name,
        stake: pointRouletteStake,
        dailyLimit: pointRoulette.dailyLimit,
        idempotencyKey: createClientRequestId('point-roulette')
      });
      const metadata = result.metadata || {};
      const settledStake = parseAmount(metadata.unitStake) || pointRouletteStake;
      const multiplier = settledStake > 0 ? result.reward / settledStake : 0;
      const segmentIndex = typeof metadata.segmentIndex === 'number'
        ? metadata.segmentIndex
        : getRouletteSegmentIndex(result.resultLabel, normalizedPointRouletteSettings, settledStake);
      const resultLabel = getPointRouletteResultLabel(result.reward, String(metadata.segmentLabel || result.resultLabel || 'MISS'));
      const nextResult: PointRouletteResult = {
        label: resultLabel,
        reward: result.reward,
        stake: settledStake,
        multiplier,
        segmentIndex,
        algorithmVersion: String(metadata.algorithmVersion || ''),
        hitRate: typeof metadata.hitRate === 'number' ? metadata.hitRate : pointRouletteHitRate,
        missRate: typeof metadata.missRate === 'number' ? metadata.missRate : pointRouletteMissRate,
        expectedReturnRate: typeof metadata.expectedReturnRate === 'number' ? metadata.expectedReturnRate : pointRouletteExpectedReturnRate
      };

      setPointRouletteRotation((prev) => getNextRouletteRotation(prev, segmentIndex, normalizedPointRouletteSettings.length));
      const nextPointRoulettePlayCount = pointRoulette.dailyLimit > 0 && Number.isFinite(result.remainingPlays) && result.remainingPlays >= 0
        ? Math.max(pointRoulette.dailyLimit - result.remainingPlays, pointRoulettePlays + 1)
        : pointRoulettePlays + 1;
      setRoulettePointBalance((prev) => prev - settledStake + result.reward);
      setPointRoulettePlays(nextPointRoulettePlayCount);
      setDailyGameUsageCounts((prev) => ({
        ...prev,
        [pointRoulette.id]: Math.max(prev[pointRoulette.id] ?? 0, nextPointRoulettePlayCount)
      }));
      setActionMessage({ tone: 'info', text: '룰렛이 회전하고 있습니다.' });
      pointRouletteRevealTimerRef.current = setTimeout(() => {
        setLastPointRouletteResult(nextResult);
        setPointRoulettePhase('revealed');
        setActionMessage({
          tone: nextResult.reward >= nextResult.stake ? 'success' : 'info',
          text: `${nextResult.label} · 차감 ${formatPoint(nextResult.stake)} · 보상 ${formatPoint(nextResult.reward)}`
        });
        pointRouletteRevealTimerRef.current = null;
      }, 2300);
      void loadUserAssetData();
    } catch (error) {
      console.error('[WelfareAssetPlatformPage] failed to play point roulette', error);
      setPointRoulettePhase('idle');
      setActionMessage({ tone: 'error', text: formatWelfareActionError(error) });
    } finally {
      setGameSubmitting(false);
    }
  };

  const renderTabButton = (tab: AdminTab, label: string, Icon: LucideIcon) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors',
        activeTab === tab
          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  const renderMetricCard = (
    label: string,
    value: string,
    subValue: string,
    Icon: LucideIcon,
    tone: string
  ) => (
    <div className="min-h-[132px] rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <span className={cx('inline-flex h-9 w-9 items-center justify-center rounded-md', tone)}>
          <Icon size={18} className="text-white" />
        </span>
      </div>
      <div className="mt-4 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{value}</div>
      <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{subValue}</div>
    </div>
  );

  return (
    <div className={cx(darkMode && 'dark')}>
      <main className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-[1800px] space-y-5 p-4 xl:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-950 dark:text-white">복지 자산 관리</h1>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                  Double-Entry Active
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                캐시, 포인트, 게임 보상, 일괄 정산을 하나의 감사 가능한 원장 흐름으로 관리합니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                {darkMode ? '라이트' : '다크'}
              </button>
              <button
                type="button"
                onClick={loadUserAssetData}
                disabled={loadingData}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw size={16} className={loadingData ? 'animate-spin' : ''} />
                동기화
              </button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700">
                <Upload size={16} />
                엑셀 업로드
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFileChange} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {renderTabButton('dashboard', '대시보드', WalletCards)}
            {renderTabButton('ledger', '원장', History)}
            {renderTabButton('games', '게임', Waves)}
            {renderTabButton('bulk', '일괄 처리', FileSpreadsheet)}
            {renderTabButton('controls', '권한/항목', UserCog)}
          </div>

          {(loadingData || dataError) && (
            <div className={cx(
              'rounded-md border px-4 py-3 text-sm font-bold',
              dataError
                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
                : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300'
            )}>
              {dataError || '사용자 DB와 자산 원장을 불러오는 중입니다.'}
            </div>
          )}

          {actionMessage && (
            <div className={cx(
              'rounded-md border px-4 py-3 text-sm font-bold whitespace-pre-line',
              actionMessage.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : actionMessage.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
                  : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300'
            )}>
              {actionMessage.text}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <section className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {renderMetricCard('전사 캐시 보유', formatWon(totals.cash), `금일 ${formatWon(totals.todayCashDelta)} 변동`, CircleDollarSign, 'bg-blue-600')}
                {renderMetricCard('전사 포인트 보유', formatPoint(totals.point), `금일 ${formatPoint(totals.todayPointDelta)} 변동`, Coins, 'bg-emerald-600')}
                {renderMetricCard('활성 게임', `${gameConfigs.filter((game) => game.active).length}개`, `오늘 ${formatNumber(gameStats.reduce((sum, row) => sum + row.plays, 0))}회 참여`, Trophy, 'bg-amber-500')}
                {renderMetricCard('검증 실패', `${totals.invalidTransactionCount}건`, 'posting 합계 기준 검증', ShieldCheck, 'bg-slate-700')}
                {renderMetricCard('소멸 예정 포인트', formatPoint(96500), '30일 이내 만료 대상', AlertTriangle, 'bg-rose-600')}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-black text-slate-950 dark:text-white">7일 자산 변동</h2>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">단위: 천원 / 천P</span>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={assetFlowData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="date" stroke={darkMode ? '#94a3b8' : '#64748b'} tickLine={false} />
                        <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Area type="monotone" dataKey="cashIn" name="캐시 증가" stroke="#2563eb" fill="#2563eb" fillOpacity={0.14} />
                        <Area type="monotone" dataKey="cashOut" name="캐시 감소" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="pointEarned" name="포인트 적립" stroke="#16a34a" fill="#16a34a" fillOpacity={0.14} />
                        <Area type="monotone" dataKey="pointUsed" name="포인트 차감" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-4 text-base font-black text-slate-950 dark:text-white">자산 구성</h2>
                    <div className="h-[138px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={assetMix} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={3}>
                            {assetMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name)]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      {assetMix.map((item) => (
                        <div key={item.name} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name} {formatNumber(item.value)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-4 text-base font-black text-slate-950 dark:text-white">인기 게임</h2>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gameStats} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="name" stroke={darkMode ? '#94a3b8' : '#64748b'} tickLine={false} />
                          <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="plays" name="참여" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
                <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <h2 className="text-base font-black text-slate-950 dark:text-white">구성원 자산 현황</h2>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{displayedEmployees.length}명</span>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left">구성원</th>
                          <th className="px-4 py-3 text-left">팀</th>
                          <th className="px-4 py-3 text-right">캐시</th>
                          <th className="px-4 py-3 text-right">포인트</th>
                          <th className="px-4 py-3 text-left">만료일</th>
                          <th className="px-4 py-3 text-right">게임</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayedEmployees.map((employee) => (
                          <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{employee.name}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{employee.team}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{formatWon(employee.cash)}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{formatPoint(employee.point)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{employee.pointExpiresAt}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{employee.dailyGamePlays}/3</td>
                          </tr>
                        ))}
                        {displayedEmployees.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                              사용자 DB에 표시할 구성원이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-500" />
                    <h2 className="text-base font-black text-slate-950 dark:text-white">정합성 체크</h2>
                  </div>
                  <div className="space-y-3">
                    {displayedTransactions.slice(0, 4).map((transaction) => {
                      const validation = validateWelfareDoubleEntry(transaction.postings);
                      return (
                        <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-900 dark:text-white">{transaction.title}</div>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{transaction.categoryName}</div>
                          </div>
                          <span className={cx(
                            'inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-black',
                            validation.valid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          )}>
                            {validation.valid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            {validation.valid ? '정상' : '오류'}
                          </span>
                        </div>
                      );
                    })}
                    {displayedTransactions.length === 0 && (
                      <div className="rounded-md border border-dashed border-slate-300 px-3 py-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        아직 자산 원장 기록이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'ledger' && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <label className="relative min-w-[260px] flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="사용자, 항목, 원장명 검색"
                    />
                  </label>
                  <select
                    value={assetFilter}
                    onChange={(event) => setAssetFilter(event.target.value as WelfareAssetKind | 'all')}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <option value="all">전체 자산</option>
                    <option value="cash">캐시</option>
                    <option value="point">포인트</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Plus size={16} />
                  수동 조정
                </button>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-950 dark:text-white">포인트/캐시(크레딧) 지급·회수</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                      모든 처리는 복식 posting으로 원장과 감사 로그에 동시에 기록됩니다.
                    </p>
                  </div>
                  <span className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    현재 권한: {currentAdminAccess.label}
                  </span>
                </div>
                <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.1fr)_160px_160px_minmax(180px,0.9fr)_160px_minmax(220px,1fr)_140px]">
                  <select
                    value={adjustmentDraft.employeeId}
                    onChange={(event) => setAdjustmentDraft((prev) => ({ ...prev, employeeId: event.target.value }))}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {displayedEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.team}
                      </option>
                    ))}
                  </select>
                  <select
                    value={adjustmentDraft.assetKind}
                    onChange={(event) => setAdjustmentDraft((prev) => ({ ...prev, assetKind: event.target.value as WelfareAssetKind }))}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="point">포인트</option>
                    <option value="cash">캐시/크레딧</option>
                  </select>
                  <select
                    value={adjustmentDraft.direction}
                    onChange={(event) => setAdjustmentDraft((prev) => ({ ...prev, direction: event.target.value as AdjustmentDirection }))}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="credit">지급(+)</option>
                    <option value="debit">회수(-)</option>
                  </select>
                  <select
                    value={adjustmentDraft.categoryId}
                    onChange={(event) => setAdjustmentDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {adjustmentCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <input
                    value={adjustmentDraft.amount}
                    onChange={(event) => setAdjustmentDraft((prev) => ({ ...prev, amount: event.target.value }))}
                    inputMode="numeric"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-right text-sm font-black tabular-nums outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="금액"
                  />
                  <input
                    value={adjustmentDraft.memo}
                    onChange={(event) => setAdjustmentDraft((prev) => ({ ...prev, memo: event.target.value }))}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="메모"
                  />
                  <button
                    type="button"
                    onClick={submitAdjustment}
                    disabled={!canSubmitAdjustment || adjustmentSubmitting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    <ShieldCheck size={16} />
                    반영
                  </button>
                </div>
                {selectedAdjustmentEmployee && (
                  <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                    현재 잔액: 캐시/크레딧 {formatWon(selectedAdjustmentEmployee.cash)} · 포인트 {formatPoint(selectedAdjustmentEmployee.point)}
                    <span className="mx-2">·</span>
                    원장 1건 안에 사용자 계정과 시스템 풀 계정 posting 2줄이 기록됩니다.
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-auto">
                  <table className="w-full min-w-[1120px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">일시</th>
                        <th className="px-4 py-3 text-left">원장</th>
                        <th className="px-4 py-3 text-left">사용자</th>
                        <th className="px-4 py-3 text-left">항목</th>
                        <th className="px-4 py-3 text-right">캐시</th>
                        <th className="px-4 py-3 text-right">포인트</th>
                        <th className="px-4 py-3 text-left">작성자</th>
                        <th className="px-4 py-3 text-left">검증</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTransactions.map((transaction) => {
                        const cashAmount = getUserPostingAmount(transaction, 'cash');
                        const pointAmount = getUserPostingAmount(transaction, 'point');
                        const validation = validateWelfareDoubleEntry(transaction.postings);
                        return (
                          <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTransactionTime(transaction.transactionAt)}</td>
                            <td className="px-4 py-3">
                              <div className="font-black text-slate-900 dark:text-white">{transaction.title}</div>
                              <div className="text-xs font-bold text-slate-500">{transaction.id}</div>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{getParticipantNames(transaction) || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {transaction.categoryName}
                              </span>
                            </td>
                            <td className={cx('px-4 py-3 text-right font-black tabular-nums', cashAmount >= 0 ? 'text-blue-600' : 'text-rose-600')}>
                              {cashAmount === 0 ? '-' : formatWon(cashAmount)}
                            </td>
                            <td className={cx('px-4 py-3 text-right font-black tabular-nums', pointAmount >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                              {pointAmount === 0 ? '-' : formatPoint(pointAmount)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{transaction.createdByName}</td>
                            <td className="px-4 py-3">
                              <span className={cx(
                                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black',
                                validation.valid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              )}>
                                {validation.valid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                {validation.valid ? 'posted' : 'blocked'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                            조건에 맞는 자산 원장 기록이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'games' && (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {configuredGameConfigs.map((game) => {
                    const nextPage = game.type === 'ocean_reel' ? 'ocean_reel' : 'roulette';
                    const displayReturnRate = game.type === 'ocean_reel'
                      ? oceanExpectedReturnRate
                      : pointRouletteExpectedReturnRate;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => {
                          setGamePage(nextPage);
                          setGamePanelMode('play');
                        }}
                        className={cx(
                          'rounded-md border bg-white p-4 text-left shadow-sm transition-colors dark:bg-slate-900',
                          gamePage === nextPage
                            ? 'border-violet-400 ring-2 ring-violet-100 dark:border-violet-500 dark:ring-violet-950'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cx(
                            'inline-flex h-10 w-10 items-center justify-center rounded-md text-white',
                            game.type === 'ocean_reel' ? 'bg-cyan-600' : 'bg-violet-600'
                          )}>
                            {game.type === 'ocean_reel' ? <Waves size={18} /> : <Dice5 size={18} />}
                          </span>
                          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            {game.active ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">{game.name}</h2>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <div className="rounded-md border border-slate-200 p-2 dark:border-slate-800">기본 {formatPoint(game.stake)}</div>
                          <div className="rounded-md border border-slate-200 p-2 dark:border-slate-800">{game.dailyLimit > 0 ? `일 ${game.dailyLimit}회` : '횟수 제한 없음'}</div>
                          <div className="rounded-md border border-slate-200 p-2 dark:border-slate-800">환급률 {formatReturnRate(displayReturnRate)}</div>
                          <div className="rounded-md border border-slate-200 p-2 dark:border-slate-800">원장 반영</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setGamePanelMode('play')}
                    className={cx(
                      'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition-colors',
                      gamePanelMode === 'play'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    <Play size={15} />
                    플레이
                  </button>
                  <button
                    type="button"
                    onClick={() => setGamePanelMode('settings')}
                    className={cx(
                      'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition-colors',
                      gamePanelMode === 'settings'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    <SlidersHorizontal size={15} />
                    확률/환급률
                  </button>
                </div>

                {gamePanelMode === 'play' && gamePage === 'roulette' && (
                  <div className="welfare-roulette-panel rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-5 2xl:grid-cols-[minmax(280px,0.92fr)_minmax(0,1fr)]">
                      <div className="flex flex-col items-center justify-center">
                        <div className="welfare-roulette-machine" aria-label="포인트 룰렛 휠">
                          <div className="welfare-roulette-pointer" />
                          <div
                            className={cx(
                              'welfare-roulette-wheel',
                              pointRoulettePhase === 'spinning' && 'is-spinning',
                              pointRoulettePhase === 'revealed' && 'is-revealed'
                            )}
                            style={{
                              '--roulette-angle': `${pointRouletteRotation}deg`,
                              background: pointRouletteWheelBackground
                            } as CSSVariableProperties}
                          >
                            {normalizedPointRouletteSettings.map((segment, index) => {
                              const angle = index * pointRouletteSliceAngle + pointRouletteSliceAngle / 2;
                              const display = getPointRouletteSegmentDisplay(segment, pointRouletteStake);
                              return (
                                <div
                                  key={segment.id}
                                  className="welfare-roulette-label"
                                  style={{ transform: `rotate(${angle}deg) translateY(-104px) rotate(${-angle}deg)` }}
                                >
                                  <span>{display.label}</span>
                                  <small>{display.subLabel}</small>
                                </div>
                              );
                            })}
                          </div>
                          <div className="welfare-roulette-hub" aria-label={`${formatPoint(pointRouletteStake)} 기준 포인트`}>
                            <span>{formatPoint(pointRouletteStake)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col rounded-md border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-xs font-black text-violet-600 dark:text-violet-300">POINT ROULETTE</div>
                            <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">포인트 룰렛</h2>
                            <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                              {roulettePlayer?.name || '로그인 사용자'} · 사용 가능 {formatPoint(roulettePointBalance)} · 오늘 {pointRoulettePlays}회 참여 · {pointRouletteLimitLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={playPointRoulette}
                            disabled={!canPlayPointRoulette}
                            className="inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                          >
                            <Play size={16} className={gameSubmitting && gamePage === 'roulette' ? 'animate-spin' : ''} />
                            {gameSubmitting && gamePage === 'roulette' ? '회전 중' : '룰렛 돌리기'}
                          </button>
                        </div>

                        <div className={cx(
                          'relative mt-5 overflow-hidden rounded-md border px-4 py-4',
                          pointRoulettePhase === 'spinning'
                            ? 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100'
                            : lastPointRouletteResult
                              ? lastPointRouletteResult.reward >= lastPointRouletteResult.stake
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                                : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100'
                              : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                        )}>
                          {lastPointRouletteResult && lastPointRouletteResult.reward >= lastPointRouletteResult.stake && <div className="welfare-prize-glow" aria-hidden="true" />}
                          <div className="relative z-[1] flex items-start gap-3">
                            <div className="welfare-result-coin welfare-dynamic-coin shrink-0" aria-label={`${formatPoint(pointRouletteStake)} 동전`}>
                              <span>{lastPointRouletteResult ? getPointRouletteResultLabel(lastPointRouletteResult.reward, lastPointRouletteResult.label) : formatPoint(pointRouletteStake)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black opacity-75">
                                {pointRoulettePhase === 'spinning' ? '룰렛 회전 중' : lastPointRouletteResult ? '결과' : 'READY'}
                              </div>
                              {pointRoulettePhase === 'spinning' ? (
                                <div className="mt-1 text-lg font-black">{formatPoint(pointRouletteStake)}가 차감되고 룰렛이 돌아가고 있습니다.</div>
                              ) : lastPointRouletteResult ? (
                                <div className="mt-1">
                                  <div className="text-lg font-black">
                                    {getPointRouletteResultLabel(lastPointRouletteResult.reward, lastPointRouletteResult.label)} {formatMultiplier(lastPointRouletteResult.multiplier)} 정산
                                  </div>
                                  <div className="mt-1 text-sm font-bold opacity-90">
                                    차감 {formatPoint(lastPointRouletteResult.stake)} · 보상 {formatPoint(lastPointRouletteResult.reward)} · 손익 {pointRouletteNetChange !== null && pointRouletteNetChange > 0 ? '+' : ''}{pointRouletteNetChange === null ? '-' : formatPoint(pointRouletteNetChange)}
                                  </div>
                                  <div className="mt-1 text-xs font-black opacity-75">
                                    서버 확률 당첨 {formatReturnRate(lastPointRouletteResult.hitRate)} · 미당첨 {formatReturnRate(lastPointRouletteResult.missRate)} · 환급률 {formatReturnRate(lastPointRouletteResult.expectedReturnRate)}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-lg font-black">{formatPoint(pointRouletteStake)}를 걸고 룰렛 결과를 확인합니다.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-4">
                          <div className="rounded-md border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400">1회 차감</div>
                            <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">{formatPoint(Math.max(pointRouletteStake, 0))}</div>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400">오늘 참여</div>
                            <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">{pointRoulettePlays}회</div>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400">최근 보상</div>
                            <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                              {lastPointRouletteResult ? formatPoint(lastPointRouletteResult.reward) : '-'}
                            </div>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400">순손익</div>
                            <div className={cx(
                              'mt-2 text-xl font-black tabular-nums',
                              pointRouletteNetChange === null
                                ? 'text-slate-950 dark:text-white'
                                : pointRouletteNetChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            )}>
                              {pointRouletteNetChange === null ? '-' : formatPoint(pointRouletteNetChange)}
                            </div>
                          </div>
                        </div>

                        {!canPlayPointRoulette && pointRouletteDisabledReason && (
                          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            {pointRouletteDisabledReason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {gamePanelMode === 'play' && gamePage === 'ocean_reel' && (
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
                  <div
                    className="welfare-game-stage p-4 md:p-5"
                    style={{
                      backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.2), rgba(2, 6, 23, 0.05)), url(${oceanReelStageImage})`
                    }}
                  >
                    <div className="welfare-coin-layer" aria-hidden="true">
                      {fallingCoinDrops.map((coin) => (
                        <img
                          key={coin.id}
                          src={coin100pImage}
                          alt=""
                          className={cx('welfare-coin-drop', Boolean(winningOceanStage) && roulettePhase === 'revealed' && 'is-result')}
                          style={{
                            '--coin-left': coin.left,
                            '--coin-delay': coin.delay,
                            '--coin-duration': winningOceanStage && roulettePhase === 'revealed' ? coin.resultDuration : coin.duration,
                            '--coin-drift': coin.drift,
                            '--coin-size': coin.size,
                            '--coin-opacity': coin.opacity
                          } as CSSVariableProperties}
                        />
                      ))}
                    </div>
                    <div className="welfare-ocean-scenic-space" aria-hidden="true">
                      {winningOceanStage && roulettePhase === 'revealed' && (
                        <div className="welfare-ocean-win-scene">
                          <div
                            className="welfare-ocean-win-sprite"
                            style={{
                              backgroundImage: `url(${oceanPrizeSpritesImage})`,
                              backgroundPosition: winningOceanStage.spritePosition
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="welfare-ocean-control-deck">
                    <div className="flex flex-col items-center justify-end">
                      <div className="welfare-arcade-shell welfare-arcade-shell--compact p-3 md:p-4 text-white">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-black text-cyan-300">OCEAN REEL</div>
                            <div className="mt-1 text-sm font-black text-white">{formatPoint(rouletteStake)}씩 차감</div>
                          </div>
                          <div className="flex h-12 w-24 items-center justify-center rounded-md bg-white px-2">
                            <img src={logoFinished} alt="청연ENG" className="max-h-10 w-full object-contain" />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
                          {Array.from({ length: 3 }).map((_, column) => {
                            const resultStage = lastGameResult ? getOceanReelStage(lastGameResult.reelStops[column]) : null;
                            const displayStage = resultStage || oceanReelStages[(roulettePlays + column) % oceanReelStages.length];
                            return (
                              <div key={`reel-${column}`} className="welfare-reel-cell">
                                {roulettePhase === 'spinning' ? (
                                  <div className="welfare-reel-strip" style={reelColumnStyles[column]}>
                                    {oceanReelSpinStages.map((stage, index) => (
                                      <div key={`spin-${column}-${stage.stage}-${index}`} className="welfare-reel-face">
                                        <div className="welfare-reel-token text-center">
                                          <div
                                            className="welfare-reel-prize-sprite"
                                            style={{
                                              backgroundImage: `url(${oceanPrizeSpritesImage})`,
                                              backgroundPosition: stage.spritePosition
                                            }}
                                          />
                                          <div className="welfare-stage-badge" style={{ backgroundColor: stage.color }}>
                                            {stage.stage}
                                          </div>
                                          <div className="mt-2 text-sm font-black">{stage.symbol}</div>
                                          <div className="mt-1 text-xs font-black text-cyan-200">{stage.payout}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="welfare-reel-face welfare-reel-result">
                                    <div className={cx('welfare-reel-token text-center', lastGameResult?.hit && 'is-hit')}>
                                      <div
                                        className="welfare-reel-prize-sprite"
                                        style={{
                                          backgroundImage: `url(${oceanPrizeSpritesImage})`,
                                          backgroundPosition: displayStage.spritePosition
                                        }}
                                      />
                                      <div
                                        className="welfare-stage-badge"
                                        style={{ backgroundColor: displayStage.color }}
                                      >
                                        {displayStage.stage}
                                      </div>
                                      <div className="mt-2 text-base font-black">{displayStage.symbol}</div>
                                      <div className="mt-1 text-xs font-black text-cyan-200">{displayStage.payout}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5 text-center text-xs font-black text-cyan-100">
                          {roulettePhase === 'spinning'
                            ? '릴이 한 바퀴 회전하고 있습니다.'
                            : lastGameResult
                              ? lastGameResult.hit
                                ? `${lastGameResult.finalStage}단계 ${lastGameResult.finalSymbol} 이벤트 당첨`
                                : `미당첨 · 릴 숫자 ${lastGameResult.reelStops.join('-')} 미일치`
                              : '이벤트가 발생할 때만 단계별 배당이 정산됩니다.'}
                        </div>
                      </div>
                    </div>

                    <div className="welfare-ocean-event-panel relative z-[2] flex flex-col rounded-md border border-white/15 bg-slate-950/70 p-3 text-white shadow-xl backdrop-blur md:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-base font-black text-white">해양 릴게임</h2>
                          <div className="mt-1 text-sm font-bold text-cyan-100/80">
                            {roulettePlayer?.name || '로그인 사용자'} · 사용 가능 {formatPoint(roulettePointBalance)} · 오늘 {roulettePlays}회 참여 · {rouletteLimitLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={playRouletteGame}
                          disabled={!canPlayRoulette}
                          className="inline-flex h-9 min-w-[136px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-violet-600 px-3 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                        >
                          <Play size={16} className={gameSubmitting ? 'animate-spin' : ''} />
                          {gameSubmitting ? '한 바퀴 회전 중' : '한 바퀴 돌리기'}
                        </button>
                      </div>

                      <div className={cx(
                        'relative mt-3 overflow-hidden rounded-md border px-3 py-3',
                        roulettePhase === 'spinning'
                          ? 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100'
                          : lastGameResult
                            ? lastGameResult.reward >= lastGameResult.stake
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100'
                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      )}>
                        {lastGameResult?.hit && <div className="welfare-prize-glow" aria-hidden="true" />}
                        <div className="relative z-[1] flex items-start gap-3">
                          {winningOceanStage ? (
                            <div
                              className="welfare-result-prize-sprite shrink-0"
                              style={{
                                backgroundImage: `url(${oceanPrizeSpritesImage})`,
                                backgroundPosition: winningOceanStage.spritePosition
                              }}
                            />
                          ) : (
                            <img src={coin100pImage} alt="100점 동전" className="welfare-result-coin shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-black opacity-75">
                              {roulettePhase === 'spinning' ? '릴 회전 중' : lastGameResult ? lastGameResult.hit ? '이벤트 당첨' : '미당첨' : 'READY'}
                            </div>
                            {roulettePhase === 'spinning' ? (
                              <div className="mt-1 text-lg font-black">{formatPoint(rouletteStake)}가 차감되고 릴이 한 바퀴 돌고 있습니다.</div>
                            ) : lastGameResult ? (
                              <div className="mt-1">
                                <div className="text-lg font-black">
                                  {lastGameResult.hit
                                    ? `${lastGameResult.finalStage}단계 ${lastGameResult.finalSymbol} ${formatMultiplier(lastGameResult.multiplier)} 정산`
                                    : `릴 숫자 ${lastGameResult.reelStops.join('-')} 미일치`}
                                </div>
                                <div className="mt-1 text-sm font-bold opacity-90">
                                  차감 {formatPoint(lastGameResult.stake)} → 보상 {formatPoint(lastGameResult.reward)} · 순손익 {rouletteNetChange !== null && rouletteNetChange > 0 ? '+' : ''}{rouletteNetChange === null ? '-' : formatPoint(rouletteNetChange)}
                                </div>
                                <div className="mt-1 text-xs font-black opacity-75">
                                  {lastGameResult.algorithmVersion === oceanReelAlgorithmVersion
                                    ? `서버 확률 당첨 ${formatReturnRate(lastGameResult.hitRate)} · 미당첨 ${formatReturnRate(lastGameResult.missRate)}`
                                    : '구버전 Functions가 호출되어 새 확률 판정이 적용되지 않았습니다.'}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 text-lg font-black">1회 {formatPoint(rouletteStake)}로 한 바퀴 릴을 시작합니다.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border border-white/15 bg-white/10 p-3">
                          <div className="text-xs font-black text-cyan-100/75">1회 차감</div>
                          <div className="mt-1 text-lg font-black text-white">{formatPoint(Math.max(rouletteStake, 0))}</div>
                        </div>
                        <div className="rounded-md border border-white/15 bg-white/10 p-3">
                          <div className="text-xs font-black text-cyan-100/75">오늘 참여</div>
                          <div className="mt-1 text-lg font-black text-white">{roulettePlays}회</div>
                        </div>
                        <div className="rounded-md border border-white/15 bg-white/10 p-3">
                          <div className="text-xs font-black text-cyan-100/75">최종 단계</div>
                          <div className="mt-1 truncate text-lg font-black text-white">
                            {lastGameResult ? lastGameResult.hit ? `${lastGameResult.finalStage}단계` : '미일치' : '-'}
                          </div>
                        </div>
                        <div className="rounded-md border border-white/15 bg-white/10 p-3">
                          <div className="text-xs font-black text-cyan-100/75">순손익</div>
                          <div className={cx(
                            'mt-1 text-lg font-black tabular-nums',
                            rouletteNetChange === null
                              ? 'text-white'
                              : rouletteNetChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          )}>
                            {rouletteNetChange === null ? '-' : formatPoint(rouletteNetChange)}
                          </div>
                        </div>
                      </div>

                      {!canPlayRoulette && rouletteDisabledReason && (
                        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          {rouletteDisabledReason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
                )}

                {gamePanelMode === 'settings' && gamePage === 'ocean_reel' && (
                  <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-xs font-black text-cyan-600 dark:text-cyan-300">OCEAN REEL CONFIG</div>
                        <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">해양 릴게임 확률/환급률</h2>
                        <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                          당첨 {formatReturnRate(oceanHitRate)} · 미당첨 {formatReturnRate(oceanMissRate)} · 환급률 {formatReturnRate(oceanExpectedReturnRate)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={saveOceanReelSettings}
                        disabled={!currentAdminAccess.game || gameConfigSaving || Boolean(oceanConfigError)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 text-sm font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        <ShieldCheck size={16} className={gameConfigSaving ? 'animate-spin' : ''} />
                        {gameConfigSaving ? '저장 중' : '설정 저장'}
                      </button>
                    </div>
                    {oceanConfigError && (
                      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                        {oceanConfigError}
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        기본 차감 포인트
                        <input
                          value={gameRuleSettings['ocean-reel']?.stake ?? String(roulette.stake)}
                          onChange={(event) => updateGameRuleSetting('ocean-reel', 'stake', event.target.value)}
                          inputMode="numeric"
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black tabular-nums outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                      <label className="block rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        일일 횟수 제한
                        <input
                          value={gameRuleSettings['ocean-reel']?.dailyLimit ?? String(roulette.dailyLimit)}
                          onChange={(event) => updateGameRuleSetting('ocean-reel', 'dailyLimit', event.target.value)}
                          inputMode="numeric"
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black tabular-nums outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <span className="mt-1 block text-[11px] font-bold text-slate-400">0이면 횟수 제한 없음</span>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {normalizedOceanReelSettings.map((setting) => {
                        const visualStage = getOceanReelStage(setting.stage);
                        const draft = oceanReelSettings.find((item) => item.stage === setting.stage);
                        return (
                          <div key={setting.stage} className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="welfare-stage-badge" style={{ backgroundColor: visualStage.color }}>
                                  {setting.stage}
                                </span>
                                <div>
                                  <div className="font-black text-slate-950 dark:text-white">{setting.symbol}</div>
                                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatOceanPayout(setting)}</div>
                                </div>
                              </div>
                              <div
                                className="welfare-reel-prize-sprite"
                                style={{
                                  backgroundImage: `url(${oceanPrizeSpritesImage})`,
                                  backgroundPosition: visualStage.spritePosition
                                }}
                              />
                            </div>
                            <label className="mt-3 block text-xs font-black text-slate-500 dark:text-slate-400">
                              확률 분모
                              <input
                                value={draft?.oddsDenominator ?? ''}
                                onChange={(event) => updateOceanReelSetting(setting.stage, 'oddsDenominator', event.target.value)}
                                inputMode="numeric"
                                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black tabular-nums outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900"
                              />
                            </label>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <label className="block text-xs font-black text-slate-500 dark:text-slate-400">
                                최소 배당
                                <input
                                  value={draft?.minMultiplier ?? ''}
                                  onChange={(event) => updateOceanReelSetting(setting.stage, 'minMultiplier', event.target.value)}
                                  inputMode="numeric"
                                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black tabular-nums outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900"
                                />
                              </label>
                              <label className="block text-xs font-black text-slate-500 dark:text-slate-400">
                                최대 배당
                                <input
                                  value={draft?.maxMultiplier ?? ''}
                                  onChange={(event) => updateOceanReelSetting(setting.stage, 'maxMultiplier', event.target.value)}
                                  inputMode="numeric"
                                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black tabular-nums outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900"
                                />
                              </label>
                            </div>
                            <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                              {formatNumber(setting.oddsDenominator)}분의 1 · 당첨 {formatReturnRate(1 / setting.oddsDenominator)} · 기대 {formatReturnRate((setting.minMultiplier + setting.maxMultiplier) / 2 / setting.oddsDenominator)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <div className="text-sm font-black text-slate-950 dark:text-white">미일치 조합 가중치</div>
                          <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                            미당첨 {formatReturnRate(oceanMissRate)} 안에서 조합별 노출 비율을 나눕니다.
                          </div>
                        </div>
                        <div className="text-xs font-black text-slate-500 dark:text-slate-400">
                          총 가중치 {formatNumber(oceanMissPatternTotalWeight)}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {normalizedOceanMissPatternSettings.map((pattern) => {
                          const draft = oceanMissPatternSettings.find((item) => item.pattern === pattern.pattern);
                          const share = oceanMissPatternTotalWeight > 0 ? pattern.weight / oceanMissPatternTotalWeight : 0;
                          return (
                            <label key={pattern.pattern} className="grid grid-cols-[1fr_96px] items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs font-black text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                              <span>
                                <span className="block text-sm text-slate-950 dark:text-white">{pattern.pattern}</span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400">노출 {formatReturnRate(share)}</span>
                              </span>
                              <input
                                value={draft?.weight ?? ''}
                                onChange={(event) => updateOceanMissPatternSetting(pattern.pattern, event.target.value)}
                                inputMode="numeric"
                                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-right text-sm font-black tabular-nums outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                                aria-label={`${pattern.pattern} 미일치 가중치`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {gamePanelMode === 'settings' && gamePage === 'roulette' && (
                  <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Dice5 size={18} className="text-violet-600" />
                          <h2 className="text-lg font-black text-slate-950 dark:text-white">포인트 룰렛 확률/환급률</h2>
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                          확률 합계 {formatReturnRate(pointRouletteProbabilityTotal)} · 당첨 {formatReturnRate(pointRouletteHitRate)} · 미당첨 {formatReturnRate(pointRouletteMissRate)} · 환급률 {formatReturnRate(pointRouletteExpectedReturnRate)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={savePointRouletteSettings}
                        disabled={!currentAdminAccess.game || gameConfigSaving || Boolean(pointRouletteConfigError)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        <ShieldCheck size={16} className={gameConfigSaving ? 'animate-spin' : ''} />
                        {gameConfigSaving ? '저장 중' : '설정 저장'}
                      </button>
                    </div>

                    {pointRouletteConfigError && (
                      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                        {pointRouletteConfigError}
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        기본 차감 포인트
                        <input
                          value={gameRuleSettings['point-roulette']?.stake ?? String(pointRoulette.stake)}
                          onChange={(event) => updateGameRuleSetting('point-roulette', 'stake', event.target.value)}
                          inputMode="numeric"
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black tabular-nums outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                      <label className="block rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        일일 횟수 제한
                        <input
                          value={gameRuleSettings['point-roulette']?.dailyLimit ?? String(pointRoulette.dailyLimit)}
                          onChange={(event) => updateGameRuleSetting('point-roulette', 'dailyLimit', event.target.value)}
                          inputMode="numeric"
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black tabular-nums outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <span className="mt-1 block text-[11px] font-bold text-slate-400">0이면 횟수 제한 없음</span>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="text-xs font-black text-slate-500 dark:text-slate-400">확률 합계</div>
                        <div className="mt-1 text-xl font-black text-slate-950 dark:text-white">{formatReturnRate(pointRouletteProbabilityTotal)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="text-xs font-black text-slate-500 dark:text-slate-400">당첨 확률</div>
                        <div className="mt-1 text-xl font-black text-emerald-600">{formatReturnRate(pointRouletteHitRate)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="text-xs font-black text-slate-500 dark:text-slate-400">미당첨 확률</div>
                        <div className="mt-1 text-xl font-black text-rose-600">{formatReturnRate(pointRouletteMissRate)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="text-xs font-black text-slate-500 dark:text-slate-400">예상 환급률</div>
                        <div className="mt-1 text-xl font-black text-violet-600">{formatReturnRate(pointRouletteExpectedReturnRate)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {normalizedPointRouletteSettings.map((segment) => {
                        const draft = pointRouletteSettings.find((item) => item.id === segment.id);
                        const display = getPointRouletteSegmentDisplay(segment, pointRouletteStake);
                        return (
                        <div key={segment.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-3 w-3 rounded-sm" style={{ backgroundColor: segment.color }} />
                            <span className="font-black text-slate-950 dark:text-white">{display.label}</span>
                          </div>
                          <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{display.subLabel}</div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="block text-xs font-black text-slate-500 dark:text-slate-400">
                              배당
                              <input
                                value={draft?.multiplier ?? ''}
                                onChange={(event) => updatePointRouletteSetting(segment.id, 'multiplier', event.target.value)}
                                inputMode="decimal"
                                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black tabular-nums outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950"
                              />
                            </label>
                            <label className="block text-xs font-black text-slate-500 dark:text-slate-400">
                              확률 %
                              <input
                                value={draft?.probabilityPercent ?? ''}
                                onChange={(event) => updatePointRouletteSetting(segment.id, 'probabilityPercent', event.target.value)}
                                inputMode="decimal"
                                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-black tabular-nums outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950"
                              />
                            </label>
                          </div>
                          <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                            당첨 {formatReturnRate(segment.probability)} · 보상 {formatPoint(display.reward)} · 환급 기여 {formatReturnRate(segment.probability * segment.multiplier)}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    {gamePage === 'ocean_reel' ? <Waves size={18} className="text-cyan-600" /> : <Dice5 size={18} className="text-violet-600" />}
                    <h2 className="text-base font-black text-slate-950 dark:text-white">게임 방법</h2>
                  </div>
                  {gamePage === 'ocean_reel' ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {normalizedOceanReelSettings.map((setting) => {
                          const visualStage = getOceanReelStage(setting.stage);
                          return (
                            <div key={setting.stage} className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                              <div className="flex items-center gap-2">
                                <span className="welfare-stage-badge" style={{ backgroundColor: visualStage.color }}>{setting.stage}</span>
                                <div>
                                  <div className="font-black text-slate-950 dark:text-white">{setting.symbol}</div>
                                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatNumber(setting.oddsDenominator)}분의 1</div>
                                </div>
                              </div>
                              <div className="mt-3 text-sm font-black text-cyan-700 dark:text-cyan-300">{formatOceanPayout(setting)}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        한 번 누르면 릴은 한 바퀴만 돌고, 이벤트가 발생한 경우에만 같은 숫자 3개로 멈춥니다. 현재 미당첨 확률은 {formatReturnRate(oceanMissRate)}이며 미당첨은 1-2-3, 2-3-1, 4-2-1 같은 미일치 조합으로 표시됩니다.
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {normalizedOceanMissPatternSettings.map((pattern) => {
                          const share = oceanMissPatternTotalWeight > 0 ? pattern.weight / oceanMissPatternTotalWeight : 0;
                          return (
                            <div key={pattern.pattern} className="rounded-md border border-slate-200 bg-white p-3 text-sm font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                              <div>{pattern.pattern}</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">미당첨 내 {formatReturnRate(share)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        현재 설정은 당첨 {formatReturnRate(pointRouletteHitRate)}, 미당첨 {formatReturnRate(pointRouletteMissRate)}, 예상 환급률 {formatReturnRate(pointRouletteExpectedReturnRate)}입니다. 확률 합계는 100%가 되어야 저장됩니다.
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {normalizedPointRouletteSettings.map((segment) => {
                          const display = getPointRouletteSegmentDisplay(segment, pointRouletteStake);
                          return (
                            <div key={segment.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-3 w-3 rounded-sm" style={{ backgroundColor: segment.color }} />
                                <span className="font-black text-slate-950 dark:text-white">{display.label}</span>
                              </div>
                              <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{display.subLabel}</div>
                              <div className="mt-3 text-xs font-black text-slate-500 dark:text-slate-400">
                                확률 {formatReturnRate(segment.probability)} · 배당 {formatMultiplier(segment.multiplier)} · 보상 {formatPoint(display.reward)} · 환급 기여 {formatReturnRate(segment.probability * segment.multiplier)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" />
                  <h2 className="text-base font-black text-slate-950 dark:text-white">실시간 순위표</h2>
                </div>
                <div className="space-y-3">
                  {displayedLeaderboardRows.map((row) => (
                    <div key={row.rank} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-3 dark:border-slate-800">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                          {row.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-900 dark:text-white">{row.name}</div>
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{row.team} · {formatNumber(row.score)}점</div>
                        </div>
                      </div>
                      <div className="text-right text-sm font-black text-emerald-600">{formatPoint(row.reward)}</div>
                    </div>
                  ))}
                  {displayedLeaderboardRows.length === 0 && (
                    <div className="rounded-md border border-dashed border-slate-300 px-3 py-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      오늘 게임 참여 기록이 없습니다.
                    </div>
                  )}
                </div>
              </aside>
            </section>
          )}

          {activeTab === 'bulk' && (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-4">
                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-black text-slate-950 dark:text-white">일괄 지급/회수</h2>
                      <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{bulkFileName} · {bulkRows.length}행</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                        <Upload size={16} />
                        파일 선택
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFileChange} />
                      </label>
                      <button
                        type="button"
                        onClick={submitBulkRows}
                        disabled={!canSubmitBulk || bulkSubmitting}
                        className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        <ShieldCheck size={16} className={bulkSubmitting ? 'animate-spin' : ''} />
                        원장 반영
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="overflow-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left">직원</th>
                          <th className="px-4 py-3 text-left">자산</th>
                          <th className="px-4 py-3 text-right">금액</th>
                          <th className="px-4 py-3 text-left">항목</th>
                          <th className="px-4 py-3 text-left">메모</th>
                          <th className="px-4 py-3 text-left">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bulkRows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-3">
                              <div className="font-black text-slate-900 dark:text-white">{row.employeeName}</div>
                              <div className="text-xs font-bold text-slate-500">{row.employeeId}</div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={row.assetKind}
                                onChange={(event) => updateBulkRow(row.id, { assetKind: event.target.value as WelfareAssetKind })}
                                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-black outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                              >
                                <option value="point">포인트</option>
                                <option value="cash">캐시/크레딧</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={row.amount === 0 ? '' : String(row.amount)}
                                onChange={(event) => updateBulkRow(row.id, { amount: event.target.value })}
                                inputMode="numeric"
                                className={cx(
                                  'h-9 w-32 rounded-md border border-slate-200 bg-white px-2 text-right text-sm font-black tabular-nums outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950',
                                  parseAmount(row.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                )}
                                placeholder="+지급 / -회수"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={row.categoryId || ''}
                                onChange={(event) => {
                                  const nextCategory = categories.find((category) => category.id === event.target.value);
                                  updateBulkRow(row.id, {
                                    categoryId: nextCategory?.id,
                                    categoryName: nextCategory?.name || row.categoryName
                                  });
                                }}
                                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-black outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                              >
                                <option value="">항목 선택</option>
                                {categories
                                  .filter((category) => isCategoryEligible(category, row.assetKind, parseAmount(row.amount) < 0 ? 'debit' : 'credit'))
                                  .map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                  ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.memo || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={cx(
                                'rounded-md px-2 py-1 text-xs font-black',
                                row.validationStatus === 'ready'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : row.validationStatus === 'warning'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              )}>
                                {row.validationMessage}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-2">
                  <LockKeyhole size={18} className="text-blue-500" />
                  <h2 className="text-base font-black text-slate-950 dark:text-white">감사 로그</h2>
                </div>
                <div className="space-y-3">
                  {auditLogs.map((row) => (
                    <div key={row.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-slate-900 dark:text-white">{getAuditActionLabel(row.action)}</span>
                        <span className={cx(
                          'rounded-md px-2 py-1 text-xs font-black',
                          row.action.includes('PERMISSION') || row.action.includes('LEDGER')
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : row.action.includes('SEED')
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        )}>
                          audit
                        </span>
                      </div>
                      <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        {row.actorName} · {row.targetName || row.targetId || '-'} · {formatTransactionTime(row.createdAt)}
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="rounded-md border border-dashed border-slate-300 px-3 py-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      아직 복지 자산 감사 로그가 없습니다.
                    </div>
                  )}
                </div>
              </aside>
            </section>
          )}

          {activeTab === 'controls' && (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 size={18} className="text-slate-500" />
                    <h2 className="text-base font-black text-slate-950 dark:text-white">적립/차감 항목</h2>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1fr)_120px_130px_120px_110px_96px_96px]">
                    <input
                      value={categoryDraft.name}
                      onChange={(event) => setCategoryDraft((prev) => ({ ...prev, name: event.target.value }))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="항목명"
                    />
                    <select
                      value={categoryDraft.assetKind}
                      onChange={(event) => setCategoryDraft((prev) => ({ ...prev, assetKind: event.target.value as WelfareAssetKind | 'both' }))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="point">포인트</option>
                      <option value="cash">캐시</option>
                      <option value="both">공통</option>
                    </select>
                    <select
                      value={categoryDraft.direction}
                      onChange={(event) => setCategoryDraft((prev) => ({ ...prev, direction: event.target.value as WelfareCategory['direction'] }))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="both">지급/회수</option>
                      <option value="credit">지급</option>
                      <option value="debit">회수</option>
                    </select>
                    <select
                      value={categoryDraft.source}
                      onChange={(event) => setCategoryDraft((prev) => ({ ...prev, source: event.target.value as WelfareCategory['source'] }))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="manual_adjustment">수동</option>
                      <option value="bulk_action">일괄</option>
                      <option value="payroll_sync">급여</option>
                      <option value="game_play">게임</option>
                      <option value="store_purchase">매점</option>
                      <option value="point_expiry">소멸</option>
                      <option value="refund">환급</option>
                    </select>
                    <input
                      value={categoryDraft.expiresAfterDays}
                      onChange={(event) => setCategoryDraft((prev) => ({ ...prev, expiresAfterDays: event.target.value }))}
                      inputMode="numeric"
                      disabled={categoryDraft.assetKind === 'cash'}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="만료일"
                    />
                    <label className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-black text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={categoryDraft.approvalRequired}
                        onChange={(event) => setCategoryDraft((prev) => ({ ...prev, approvalRequired: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      승인
                    </label>
                    <button
                      type="button"
                      onClick={addCategory}
                      disabled={!currentAdminAccess.categories || categorySaving}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      <Plus size={16} />
                      추가
                    </button>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">항목</th>
                        <th className="px-4 py-3 text-left">자산</th>
                        <th className="px-4 py-3 text-left">소스</th>
                        <th className="px-4 py-3 text-left">방향</th>
                        <th className="px-4 py-3 text-center">승인</th>
                        <th className="px-4 py-3 text-right">만료</th>
                        <th className="px-4 py-3 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {categories.map((category) => (
                        <tr key={category.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{category.name}</td>
                          <td className="px-4 py-3">{getAssetLabel(category.assetKind)}</td>
                          <td className="px-4 py-3">{getSourceLabel(category.source)}</td>
                          <td className="px-4 py-3">{getDirectionLabel(category.direction)}</td>
                          <td className="px-4 py-3 text-center">{category.approvalRequired ? '필요' : '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{category.expiresAfterDays ? `${category.expiresAfterDays}일` : '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void deleteCategory(category)}
                              disabled={!currentAdminAccess.categories || categorySaving}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-rose-950"
                              aria-label={`${category.name} 삭제`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={18} className="text-slate-500" />
                      <h2 className="text-base font-black text-slate-950 dark:text-white">권한 매트릭스</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={syncDefaultMasters}
                        disabled={!currentAdminAccess.permissions || masterSyncing}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <RefreshCw size={14} className={masterSyncing ? 'animate-spin' : ''} />
                        기본 마스터 동기화
                      </button>
                      <button
                        type="button"
                        onClick={savePermissions}
                        disabled={!currentAdminAccess.permissions || permissionSaving}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        <ShieldCheck size={14} />
                        권한 저장
                      </button>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">등급</th>
                          <th className="px-3 py-2 text-left">연동 역할</th>
                          <th className="px-3 py-2 text-center">원장</th>
                          <th className="px-3 py-2 text-center">캐시/크레딧</th>
                          <th className="px-3 py-2 text-center">포인트</th>
                          <th className="px-3 py-2 text-center">게임</th>
                          <th className="px-3 py-2 text-center">Bulk</th>
                          <th className="px-3 py-2 text-center">항목</th>
                          <th className="px-3 py-2 text-center">권한</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {adminPermissions.map((row) => (
                          <tr key={row.grade}>
                            <td className="px-3 py-2 font-black">{row.label}</td>
                            <td className="px-3 py-2">
                              <input
                                value={row.roleAliases.join(', ')}
                                onChange={(event) => updatePermissionRow(row.grade, {
                                  roleAliases: event.target.value.split(',').map((value) => value.trim()).filter(Boolean)
                                })}
                                disabled={!currentAdminAccess.permissions}
                                className="h-8 w-48 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-blue-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950"
                              />
                            </td>
                            {(['ledger', 'adjustCash', 'adjustPoint', 'game', 'bulk', 'categories', 'permissions'] as const).map((key) => (
                              <td key={`${row.grade}-${key}`} className="px-3 py-2 text-center">
                                <label className={cx(
                                  'inline-flex h-7 w-7 items-center justify-center rounded-md',
                                  row[key] ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                )}>
                                  <input
                                    type="checkbox"
                                    checked={row[key]}
                                    onChange={(event) => updatePermissionRow(row.grade, { [key]: event.target.checked })}
                                    disabled={!currentAdminAccess.permissions}
                                    className="sr-only"
                                  />
                                  {row[key] ? <CheckCircle2 size={14} /> : '-'}
                                </label>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-500" />
                    <h2 className="text-base font-black text-slate-950 dark:text-white">API 연동 포인트</h2>
                  </div>
                  <div className="grid gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">급여/정산 모듈: payroll_sync source</div>
                    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">게임 보상: idempotencyKey + daily usage lock</div>
                    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">잔액 검증: 원장 posting 총합 기준</div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default WelfareAssetPlatformPage;
