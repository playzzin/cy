import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type {
  WelfareAccountSnapshot,
  WelfareAdminPermission,
  WelfareAssetKind,
  WelfareAuditLog,
  WelfareCategory,
  WelfareGamePlay,
  WelfareLedgerPosting,
  WelfareLedgerTransaction,
  WelfareTransactionSource
} from '../types/welfareAssets';

export interface CreateWelfareLedgerTransactionInput {
  title: string;
  categoryId: string;
  categoryName: string;
  source: WelfareTransactionSource;
  businessDate: string;
  postings: WelfareLedgerPosting[];
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PlayWelfarePointGameInput {
  gameId: string;
  gameName: string;
  userId: string;
  userName: string;
  stake: number;
  dailyLimit?: number;
  selectedSide?: 'odd' | 'even';
  idempotencyKey?: string;
}

export interface OceanReelStageRuntimeConfig {
  stage: number;
  symbol: string;
  minMultiplier: number;
  maxMultiplier: number;
  oddsDenominator: number;
}

export interface OceanReelMissPatternRuntimeConfig {
  pattern: string;
  stages: number[];
  weight: number;
}

export interface PointRouletteSegmentRuntimeConfig {
  id: string;
  label: string;
  subLabel: string;
  multiplier: number;
  probability: number;
  color?: string;
}

export interface LadderOddEvenSideRuntimeConfig {
  id: 'odd' | 'even';
  label: string;
  multiplier: number;
  probability: number;
  color?: string;
}

export interface WelfareGameRuntimeConfig {
  gameId: string;
  type: 'roulette' | 'ocean_reel' | 'ladder_odd_even';
  algorithmVersion?: string;
  stake: number;
  dailyLimit: number;
  expectedReturnRate: number;
  hitRate: number;
  missRate: number;
  oceanReelStages?: OceanReelStageRuntimeConfig[];
  oceanReelMissPatterns?: OceanReelMissPatternRuntimeConfig[];
  pointRouletteSegments?: PointRouletteSegmentRuntimeConfig[];
  ladderOddEvenSides?: LadderOddEvenSideRuntimeConfig[];
}

export type SaveWelfareGameConfigInput =
  | {
      gameId: string;
      type: 'ocean_reel';
      stake: number;
      dailyLimit: number;
      oceanReelStages: OceanReelStageRuntimeConfig[];
      oceanReelMissPatterns: OceanReelMissPatternRuntimeConfig[];
    }
  | {
      gameId: string;
      type: 'roulette';
      stake: number;
      dailyLimit: number;
      pointRouletteSegments: PointRouletteSegmentRuntimeConfig[];
    }
  | {
      gameId: string;
      type: 'ladder_odd_even';
      stake: number;
      dailyLimit: number;
      ladderOddEvenSides: LadderOddEvenSideRuntimeConfig[];
    };

export interface UpsertWelfareCategoryInput {
  id?: string;
  name: string;
  assetKind: WelfareCategory['assetKind'];
  source: WelfareTransactionSource;
  direction: WelfareCategory['direction'];
  active?: boolean;
  expiresAfterDays?: number;
  approvalRequired?: boolean;
}

export interface WelfareDoubleEntryValidation {
  valid: boolean;
  errors: string[];
  totalsByAsset: Record<WelfareAssetKind, number>;
}

const assetKinds: WelfareAssetKind[] = ['cash', 'point'];

const asFiniteInteger = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
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

const normalizeDocId = (value: string): string => value.replace(/\//g, ':').slice(0, 1400);

export const validateWelfareDoubleEntry = (
  postings: WelfareLedgerPosting[]
): WelfareDoubleEntryValidation => {
  const totalsByAsset = assetKinds.reduce((acc, assetKind) => {
    acc[assetKind] = 0;
    return acc;
  }, {} as Record<WelfareAssetKind, number>);
  const errors: string[] = [];

  if (!Array.isArray(postings) || postings.length < 2) {
    errors.push('posting은 최소 2개 이상이어야 합니다.');
  }

  postings.forEach((posting, index) => {
    if (!posting.accountId) errors.push(`${index + 1}번째 posting의 accountId가 없습니다.`);
    if (!assetKinds.includes(posting.assetKind)) {
      errors.push(`${index + 1}번째 posting의 자산 구분이 올바르지 않습니다.`);
      return;
    }

    const amount = asFiniteInteger(posting.amount);
    if (amount === 0) errors.push(`${index + 1}번째 posting의 금액이 0입니다.`);
    totalsByAsset[posting.assetKind] += amount;
  });

  assetKinds.forEach((assetKind) => {
    if (totalsByAsset[assetKind] !== 0) {
      errors.push(`${assetKind === 'cash' ? '캐시' : '포인트'} posting 합계가 0이 아닙니다.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    totalsByAsset
  };
};

const mapLedgerTransaction = (id: string, data: Record<string, unknown>): WelfareLedgerTransaction => ({
  id,
  title: String(data.title ?? ''),
  categoryId: String(data.categoryId ?? ''),
  categoryName: String(data.categoryName ?? ''),
  source: String(data.source ?? 'manual_adjustment') as WelfareTransactionSource,
  status: String(data.status ?? 'posted') as WelfareLedgerTransaction['status'],
  businessDate: String(data.businessDate ?? ''),
  transactionAt: data.transactionAt as WelfareLedgerTransaction['transactionAt'],
  postings: Array.isArray(data.postings) ? data.postings as WelfareLedgerPosting[] : [],
  idempotencyKey: data.idempotencyKey ? String(data.idempotencyKey) : undefined,
  createdBy: String(data.createdBy ?? ''),
  createdByName: data.createdByName ? String(data.createdByName) : undefined,
  createdAt: data.createdAt as WelfareLedgerTransaction['createdAt'],
  updatedAt: data.updatedAt as WelfareLedgerTransaction['updatedAt'],
  metadata: data.metadata && typeof data.metadata === 'object'
    ? data.metadata as Record<string, unknown>
    : undefined
});

const mapAccountSnapshot = (id: string, data: Record<string, unknown>): WelfareAccountSnapshot => ({
  id,
  accountName: String(data.accountName ?? ''),
  accountScope: String(data.accountScope ?? 'system') as WelfareAccountSnapshot['accountScope'],
  assetKind: String(data.assetKind ?? 'point') as WelfareAssetKind,
  userId: data.userId ? String(data.userId) : undefined,
  userName: data.userName ? String(data.userName) : undefined,
  balance: asFiniteInteger(data.balance),
  ledgerCount: asFiniteInteger(data.ledgerCount),
  updatedAt: data.updatedAt as WelfareAccountSnapshot['updatedAt']
});

const mapCategory = (id: string, data: Record<string, unknown>): WelfareCategory => ({
  id,
  name: String(data.name ?? ''),
  assetKind: String(data.assetKind ?? 'both') as WelfareCategory['assetKind'],
  source: String(data.source ?? 'manual_adjustment') as WelfareTransactionSource,
  direction: String(data.direction ?? 'both') as WelfareCategory['direction'],
  active: data.active !== false,
  expiresAfterDays: data.expiresAfterDays ? asFiniteInteger(data.expiresAfterDays) : undefined,
  approvalRequired: Boolean(data.approvalRequired),
  createdAt: data.createdAt as WelfareCategory['createdAt'],
  updatedAt: data.updatedAt as WelfareCategory['updatedAt']
});

const mapAdminPermission = (id: string, data: Record<string, unknown>): WelfareAdminPermission => ({
  id: String(data.id ?? id) as WelfareAdminPermission['id'],
  grade: String(data.grade ?? id) as WelfareAdminPermission['grade'],
  label: String(data.label ?? id),
  roleAliases: Array.isArray(data.roleAliases) ? data.roleAliases.map(String) : [],
  ledger: data.ledger !== false,
  adjustCash: Boolean(data.adjustCash),
  adjustPoint: Boolean(data.adjustPoint),
  game: Boolean(data.game),
  bulk: Boolean(data.bulk),
  categories: Boolean(data.categories),
  permissions: Boolean(data.permissions),
  active: data.active !== false,
  updatedAt: data.updatedAt as WelfareAdminPermission['updatedAt']
});

const mapAuditLog = (id: string, data: Record<string, unknown>): WelfareAuditLog => ({
  id,
  action: String(data.action ?? ''),
  actorId: String(data.actorId ?? ''),
  actorName: String(data.actorName ?? ''),
  targetId: data.targetId ? String(data.targetId) : undefined,
  targetName: data.targetName ? String(data.targetName) : undefined,
  createdAt: data.createdAt as WelfareAuditLog['createdAt'],
  details: data.details && typeof data.details === 'object'
    ? data.details as Record<string, unknown>
    : undefined
});

const mapGamePlay = (id: string, data: Record<string, unknown>): WelfareGamePlay => ({
  id,
  gameId: String(data.gameId ?? ''),
  gameName: String(data.gameName ?? ''),
  userId: String(data.userId ?? ''),
  userName: String(data.userName ?? ''),
  businessDate: String(data.businessDate ?? ''),
  stake: asFiniteInteger(data.stake),
  reward: asFiniteInteger(data.reward),
  resultLabel: String(data.resultLabel ?? ''),
  ledgerTransactionId: String(data.ledgerTransactionId ?? ''),
  metadata: data.metadata && typeof data.metadata === 'object'
    ? data.metadata as Record<string, unknown>
    : undefined,
  createdAt: data.createdAt as WelfareGamePlay['createdAt']
});

const getDocsPreferServer = async <T>(queryRef: T) => {
  try {
    return await getDocsFromServer(queryRef as any);
  } catch {
    return getDocs(queryRef as any);
  }
};

const getDocPreferServer = async (path: string, id: string) => {
  const ref = doc(db, path, id);
  try {
    return await getDocFromServer(ref);
  } catch {
    return getDoc(ref);
  }
};

export const welfareAssetService = {
  async createLedgerTransaction(input: CreateWelfareLedgerTransactionInput): Promise<{ transactionId: string; reused?: boolean }> {
    const validation = validateWelfareDoubleEntry(input.postings);
    if (!validation.valid) {
      throw new Error(validation.errors.join('\n'));
    }

    const callable = httpsCallable<CreateWelfareLedgerTransactionInput, { transactionId: string; reused?: boolean }>(
      functions,
      'createWelfareLedgerTransaction'
    );
    const result = await callable(input);
    return result.data;
  },

  async upsertCategory(input: UpsertWelfareCategoryInput): Promise<{ categoryId: string }> {
    const callable = httpsCallable<UpsertWelfareCategoryInput, { categoryId: string }>(
      functions,
      'upsertWelfareCategory'
    );
    const result = await callable(input);
    return result.data;
  },

  async deleteCategory(categoryId: string): Promise<{ categoryId: string }> {
    const callable = httpsCallable<{ categoryId: string }, { categoryId: string }>(
      functions,
      'deleteWelfareCategory'
    );
    const result = await callable({ categoryId });
    return result.data;
  },

  async saveAdminPermissions(permissions: WelfareAdminPermission[]): Promise<{ count: number }> {
    const callable = httpsCallable<{ permissions: WelfareAdminPermission[] }, { count: number }>(
      functions,
      'saveWelfareAdminPermissions'
    );
    const result = await callable({ permissions });
    return result.data;
  },

  async seedDefaultMasters(): Promise<{ categories: number; permissions: number }> {
    const callable = httpsCallable<Record<string, never>, { categories: number; permissions: number }>(
      functions,
      'seedWelfareAssetMasters'
    );
    const result = await callable({});
    return result.data;
  },

  async playPointGame(input: PlayWelfarePointGameInput): Promise<{
    gamePlayId: string;
    transactionId: string;
    reward: number;
    resultLabel: string;
    remainingPlays: number;
    metadata?: Record<string, unknown>;
  }> {
    const callable = httpsCallable<PlayWelfarePointGameInput, {
      gamePlayId: string;
      transactionId: string;
      reward: number;
      resultLabel: string;
      remainingPlays: number;
      metadata?: Record<string, unknown>;
    }>(functions, 'playWelfarePointGame');
    const result = await callable(input);
    return result.data;
  },

  async getDailyGameUsageCounts(userId: string, businessDate: string, gameIds: string[]): Promise<Record<string, number>> {
    const uniqueGameIds = Array.from(new Set(gameIds.filter(Boolean)));
    const usageDocs = await Promise.all(uniqueGameIds.map(async (gameId) => {
      const usageId = normalizeDocId(`${userId}:${gameId}:${businessDate}`);
      const snap = await getDocPreferServer('welfare_game_daily_usage', usageId);
      return {
        gameId,
        count: snap.exists() ? asFiniteInteger((snap.data() as Record<string, unknown>).count) : 0
      };
    }));

    return usageDocs.reduce((acc, usage) => {
      acc[usage.gameId] = Math.max(usage.count, 0);
      return acc;
    }, {} as Record<string, number>);
  },

  async getGameRuntimeConfig(gameId: string): Promise<WelfareGameRuntimeConfig | null> {
    const callable = httpsCallable<{ gameId: string }, { config: WelfareGameRuntimeConfig | null }>(
      functions,
      'getWelfareGameConfig'
    );
    const result = await callable({ gameId });
    return result.data.config || null;
  },

  async saveGameRuntimeConfig(input: SaveWelfareGameConfigInput): Promise<WelfareGameRuntimeConfig> {
    const callable = httpsCallable<SaveWelfareGameConfigInput, { config: WelfareGameRuntimeConfig }>(
      functions,
      'saveWelfareGameConfig'
    );
    const result = await callable(input);
    return result.data.config;
  },

  async getRecentLedgerTransactions(limitCount = 100): Promise<WelfareLedgerTransaction[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_ledger_transactions'),
      orderBy('transactionAt', 'desc'),
      limit(limitCount)
    ));

    return snap.docs.map((row) => mapLedgerTransaction(row.id, row.data() as Record<string, unknown>));
  },

  async getUserLedgerTransactions(userId: string, limitCount = 100): Promise<WelfareLedgerTransaction[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_ledger_transactions'),
      where('participantUserIds', 'array-contains', userId),
      orderBy('transactionAt', 'desc'),
      limit(limitCount)
    ));

    return snap.docs.map((row) => mapLedgerTransaction(row.id, row.data() as Record<string, unknown>));
  },

  async getAccountSnapshots(limitCount = 200): Promise<WelfareAccountSnapshot[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_account_snapshots'),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    ));

    return snap.docs.map((row) => mapAccountSnapshot(row.id, row.data() as Record<string, unknown>));
  },

  async getUserAccountSnapshots(userIds: string[]): Promise<WelfareAccountSnapshot[]> {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const docs = await Promise.all(uniqueUserIds.flatMap((userId) => [
      getDocPreferServer('welfare_account_snapshots', `user:${userId}:cash`),
      getDocPreferServer('welfare_account_snapshots', `user:${userId}:point`)
    ]));

    return docs
      .filter((row) => row.exists())
      .map((row) => mapAccountSnapshot(row.id, row.data() as Record<string, unknown>));
  },

  async getActiveCategories(): Promise<WelfareCategory[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_categories'),
      where('active', '==', true)
    ));

    return snap.docs.map((row) => mapCategory(row.id, row.data() as Record<string, unknown>));
  },

  async getAdminPermissions(): Promise<WelfareAdminPermission[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_admin_permissions'),
      orderBy('gradeOrder', 'asc')
    ));

    return snap.docs.map((row) => mapAdminPermission(row.id, row.data() as Record<string, unknown>));
  },

  async getAuditLogs(limitCount = 50): Promise<WelfareAuditLog[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_audit_logs'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    ));

    return snap.docs.map((row) => mapAuditLog(row.id, row.data() as Record<string, unknown>));
  },

  async getLeaderboard(gameId: string, businessDate: string, limitCount = 20): Promise<WelfareGamePlay[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_game_plays'),
      where('gameId', '==', gameId),
      where('businessDate', '==', businessDate),
      orderBy('reward', 'desc'),
      limit(limitCount)
    ));

    return snap.docs.map((row) => mapGamePlay(row.id, row.data() as Record<string, unknown>));
  },

  async getGamePlaysForDate(businessDate: string, limitCount = 200): Promise<WelfareGamePlay[]> {
    const snap = await getDocsPreferServer(query(
      collection(db, 'welfare_game_plays'),
      where('businessDate', '==', businessDate),
      limit(limitCount)
    ));

    return snap.docs
      .map((row) => mapGamePlay(row.id, row.data() as Record<string, unknown>))
      .sort((left, right) => getTimestampMillis(right.createdAt) - getTimestampMillis(left.createdAt));
  }
};
