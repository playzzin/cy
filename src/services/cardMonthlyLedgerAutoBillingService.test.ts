import {
  assignCardLedgerOrphanDrafts,
  excludeProtectedOrphanCardRows,
  getCardIdsWithProtectedOrphanBillings,
  mergeCardLedgerWithPreservedManualLineItems,
  reconcileSavedCardLedgerBillings
} from './cardMonthlyLedgerAutoBillingService';
import type { CardBillingDocument } from '../types/cardBilling';

jest.mock('./cardBillingService', () => ({
  isPostedCardBillingStatus: (status: unknown) => (
    ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(status ?? '').trim().toUpperCase())
  ),
  cardBillingService: {
    replaceDraftBilling: jest.fn(),
    deleteDraftBillings: jest.fn()
  }
}));

interface TestRow {
  id: string;
  total: number;
}

const buildBilling = (patch: Partial<CardBillingDocument> = {}): CardBillingDocument => ({
  id: 'billing-row-1',
  yearMonth: '2026-07',
  cardId: 'card-1',
  cardLabel: '법인카드 (1234)',
  teamId: 'team-1',
  teamName: 'A팀',
  issuedToType: 'team',
  variableCost: 1000,
  totalAmount: 1000,
  status: 'DRAFT',
  lineItems: [],
  statementAttachmentPaths: [],
  ...patch
});

const buildNext = (row: TestRow): CardBillingDocument => buildBilling({
  id: `billing-${row.id}`,
  variableCost: row.total,
  totalAmount: row.total
});

describe('reconcileSavedCardLedgerBillings', () => {
  it('upserts a deterministic DRAFT from the persisted row and replaces stale drafts', async () => {
    const replaceDraftBilling = jest.fn().mockResolvedValue(undefined);
    const row = { id: 'row-1', total: 5000 };

    const result = await reconcileSavedCardLedgerBillings([row], {
      getBillingDocumentsForRow: () => [buildBilling({ id: 'legacy-draft' })],
      buildBillingDocumentForRow: buildNext,
      replaceDraftBilling,
      deleteDraftBillings: jest.fn()
    });

    expect(replaceDraftBilling).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'billing-row-1', totalAmount: 5000, status: 'DRAFT' }),
      ['legacy-draft']
    );
    expect(result).toMatchObject({ upsertedCount: 1, deletedCount: 0, protectedCount: 0 });
  });

  it('is retry-safe because repeated saves replace the same document id instead of adding another billing', async () => {
    const replaceDraftBilling = jest.fn().mockResolvedValue(undefined);
    const row = { id: 'row-1', total: 5000 };
    const input = {
      getBillingDocumentsForRow: () => [buildBilling({ id: 'billing-row-1', totalAmount: 5000 })],
      buildBillingDocumentForRow: buildNext,
      replaceDraftBilling,
      deleteDraftBillings: jest.fn()
    };

    await reconcileSavedCardLedgerBillings([row], input);
    await reconcileSavedCardLedgerBillings([row], input);

    expect(replaceDraftBilling).toHaveBeenCalledTimes(2);
    expect(replaceDraftBilling.mock.calls.map(([billing]) => billing.id)).toEqual([
      'billing-row-1',
      'billing-row-1'
    ]);
    expect(replaceDraftBilling.mock.calls.map(([, staleIds]) => staleIds)).toEqual([[], []]);
  });

  it('removes only associated DRAFT documents when the persisted amount is zero', async () => {
    const deleteDraftBillings = jest.fn().mockResolvedValue(undefined);

    const result = await reconcileSavedCardLedgerBillings([{ id: 'row-1', total: 0 }], {
      getBillingDocumentsForRow: () => [
        buildBilling({ id: 'draft-1', status: 'DRAFT' }),
        buildBilling({ id: 'cancelled-1', status: 'CANCELLED' })
      ],
      buildBillingDocumentForRow: buildNext,
      replaceDraftBilling: jest.fn(),
      deleteDraftBillings
    });

    expect(deleteDraftBillings).toHaveBeenCalledWith(['draft-1']);
    expect(result).toMatchObject({ upsertedCount: 0, deletedCount: 1, protectedCount: 0 });
  });

  it('keeps manual adjustments when the persisted ledger amount becomes zero', async () => {
    const replaceDraftBilling = jest.fn().mockResolvedValue(undefined);
    const deleteDraftBillings = jest.fn();
    const manualLine = {
      id: 'manual-adjustment',
      label: '수기 조정',
      amount: 7000,
      sourceType: 'manual' as const
    };

    const result = await reconcileSavedCardLedgerBillings([{ id: 'row-1', total: 0 }], {
      getBillingDocumentsForRow: () => [
        buildBilling({
          id: 'billing-row-1',
          lineItems: [
            { id: 'ledger-line', label: '카드 대장', amount: 5000, sourceType: 'card_ledger' },
            manualLine
          ]
        }),
        buildBilling({
          id: 'legacy-orphan',
          lineItems: [{ id: 'manual-orphan', label: '추가 수기 조정', amount: 3000 }]
        })
      ],
      buildBillingDocumentForRow: (row, existing) => {
        const lineItems = existing?.lineItems ?? [];
        const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
        return {
          ...buildNext(row),
          lineItems,
          variableCost: totalAmount,
          totalAmount
        };
      },
      replaceDraftBilling,
      deleteDraftBillings
    });

    expect(replaceDraftBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'billing-row-1',
        totalAmount: 10_000,
        lineItems: [manualLine, expect.objectContaining({ id: 'manual-orphan' })]
      }),
      ['legacy-orphan']
    );
    expect(deleteDraftBillings).not.toHaveBeenCalled();
    expect(result).toMatchObject({ upsertedCount: 1, deletedCount: 0, missingTargetCount: 0 });
  });

  it.each(['CONFIRMED', 'PAID', 'OVERDUE'] as const)(
    'protects a %s billing from automatic replacement and deletion',
    async (status) => {
      const replaceDraftBilling = jest.fn();
      const deleteDraftBillings = jest.fn();

      const result = await reconcileSavedCardLedgerBillings([{ id: 'row-1', total: 5000 }], {
        getBillingDocumentsForRow: () => [buildBilling({ status })],
        buildBillingDocumentForRow: buildNext,
        replaceDraftBilling,
        deleteDraftBillings
      });

      expect(replaceDraftBilling).not.toHaveBeenCalled();
      expect(deleteDraftBillings).not.toHaveBeenCalled();
      expect(result.protectedCount).toBe(1);
    }
  );

  it('reports a missing target without mutating an existing draft', async () => {
    const replaceDraftBilling = jest.fn();
    const deleteDraftBillings = jest.fn();

    const result = await reconcileSavedCardLedgerBillings([{ id: 'row-1', total: 5000 }], {
      getBillingDocumentsForRow: () => [buildBilling()],
      buildBillingDocumentForRow: () => null,
      replaceDraftBilling,
      deleteDraftBillings
    });

    expect(replaceDraftBilling).not.toHaveBeenCalled();
    expect(deleteDraftBillings).not.toHaveBeenCalled();
    expect(result.missingTargetCount).toBe(1);
  });

  it('keeps processing other rows and reports a retry-safe partial failure', async () => {
    const replaceDraftBilling = jest.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce(undefined);

    const result = await reconcileSavedCardLedgerBillings([
      { id: 'row-1', total: 1000 },
      { id: 'row-2', total: 2000 }
    ], {
      getBillingDocumentsForRow: () => [],
      buildBillingDocumentForRow: buildNext,
      replaceDraftBilling,
      deleteDraftBillings: jest.fn()
    });

    expect(replaceDraftBilling).toHaveBeenCalledTimes(2);
    expect(result.upsertedCount).toBe(1);
    expect(result.failures).toEqual([{
      rowId: 'row-1',
      operation: 'upsert',
      message: 'network failed'
    }]);
  });

  it('stops later split rows in the same card scope when the prerequisite replacement fails', async () => {
    const replaceDraftBilling = jest.fn().mockRejectedValueOnce(new Error('first row failed'));

    const result = await reconcileSavedCardLedgerBillings([
      { id: 'card-1:row-1', total: 1000 },
      { id: 'card-1:row-2', total: 2000 },
      { id: 'card-2:row-1', total: 3000 }
    ], {
      getAtomicScopeKey: (row) => row.id.split(':')[0],
      getBillingDocumentsForRow: () => [],
      buildBillingDocumentForRow: buildNext,
      replaceDraftBilling,
      deleteDraftBillings: jest.fn()
    });

    expect(replaceDraftBilling).toHaveBeenCalledTimes(2);
    expect(replaceDraftBilling.mock.calls[0][0].id).toBe('billing-card-1:row-1');
    expect(replaceDraftBilling.mock.calls[1][0].id).toBe('billing-card-2:row-1');
    expect(result.failures).toEqual([
      { rowId: 'card-1:row-1', operation: 'upsert', message: 'first row failed' },
      { rowId: 'card-1:row-2', operation: 'upsert', message: 'card-billing-scope-prerequisite-failed' }
    ]);
    expect(result.upsertedCount).toBe(1);
  });
  it('passes the combined stale draft context so manual lines from every orphan can be preserved', async () => {
    const first = buildBilling({
      id: 'old-a',
      lineItems: [{ id: 'manual-a', label: '수기 A', amount: 100, sourceType: 'manual' }]
    });
    const second = buildBilling({
      id: 'old-b',
      lineItems: [{ id: 'manual-b', label: '수기 B', amount: 200, sourceType: 'manual' }]
    });
    const buildNext = jest.fn((_row: TestRow, existing?: CardBillingDocument) => buildBilling({
      id: 'next',
      lineItems: existing?.lineItems ?? []
    }));

    await reconcileSavedCardLedgerBillings([{ id: 'row-1', total: 3000 }], {
      getBillingDocumentsForRow: () => [first, second],
      buildBillingDocumentForRow: buildNext,
      replaceDraftBilling: jest.fn().mockResolvedValue(undefined),
      deleteDraftBillings: jest.fn()
    });

    expect(buildNext.mock.calls[0][1]?.lineItems).toEqual([
      first.lineItems[0],
      second.lineItems[0]
    ]);
  });
});

describe('assignCardLedgerOrphanDrafts', () => {
  it('assigns an old-target marked ledger DRAFT to one positive owner for atomic replacement', () => {
    const orphan = buildBilling({
      id: 'card-1_old-team_team_none_2026-07',
      teamId: 'old-team',
      teamName: '기존팀',
      lineItems: [{
        id: 'old-ledger-line',
        label: '기존 자동 대장',
        amount: 5000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const assignments = assignCardLedgerOrphanDrafts({
      yearMonth: '2026-07',
      rows: [
        { id: 'new-row-zero', cardId: 'card-1', total: 0 },
        { id: 'new-row-positive', cardId: 'card-1', total: 5000 }
      ],
      billings: [orphan],
      claimedBillingIds: new Set(),
      fullyEligibleCardIds: new Set(['card-1']),
      isProtectedTarget: () => false
    });

    expect(assignments.get('new-row-positive')).toEqual([orphan]);
    expect(assignments.has('new-row-zero')).toBe(false);
  });

  it('preserves an unmarked deterministic-base manual DRAFT', () => {
    const manualBase = buildBilling({
      id: 'card-1_old-team_team_none_2026-07',
      teamId: 'old-team',
      teamName: '기존팀',
      lineItems: [{ id: 'manual', label: '수기 보정', amount: 5000, sourceType: 'manual' }]
    });

    const assignments = assignCardLedgerOrphanDrafts({
      yearMonth: '2026-07',
      rows: [{ id: 'new-row-positive', cardId: 'card-1', total: 5000 }],
      billings: [manualBase],
      claimedBillingIds: new Set(),
      fullyEligibleCardIds: new Set(['card-1']),
      isProtectedTarget: () => false
    });

    expect(assignments.size).toBe(0);
  });

  it('does not treat claimed split drafts, posted/manual drafts, or protected old targets as cleanup orphans', () => {
    const claimedSplit = buildBilling({
      id: 'billing-row-split__row_segment-1',
      lineItems: [{
        id: 'split',
        label: '분할 행',
        amount: 1000,
        sourceType: 'card_ledger',
        sourceSegmentId: 'segment-1'
      }]
    });
    const posted = buildBilling({ id: 'posted', status: 'CONFIRMED' });
    const manual = buildBilling({
      id: 'manual-draft',
      lineItems: [{ id: 'manual', label: '수동', amount: 1000, sourceType: 'manual' }]
    });
    const protectedOrphan = buildBilling({
      id: 'protected-orphan',
      teamId: 'confirmed-team',
      lineItems: [{
        id: 'old',
        label: '확정팀 기존 금액',
        amount: 1000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const assignments = assignCardLedgerOrphanDrafts({
      yearMonth: '2026-07',
      rows: [{ id: 'row-1', cardId: 'card-1', total: 5000 }],
      billings: [claimedSplit, posted, manual, protectedOrphan],
      claimedBillingIds: new Set([claimedSplit.id]),
      fullyEligibleCardIds: new Set(['card-1']),
      isProtectedTarget: (document) => document.teamId === 'confirmed-team'
    });

    expect(assignments.size).toBe(0);
  });

  it('skips orphan cleanup for a card that has any blocked row', () => {
    const orphan = buildBilling({
      id: 'old-row',
      lineItems: [{
        id: 'old',
        label: '기존 금액',
        amount: 1000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const assignments = assignCardLedgerOrphanDrafts({
      yearMonth: '2026-07',
      rows: [{ id: 'eligible-row', cardId: 'card-1', total: 5000 }],
      billings: [orphan],
      claimedBillingIds: new Set(),
      fullyEligibleCardIds: new Set(),
      isProtectedTarget: () => false
    });

    expect(assignments.size).toBe(0);
  });
});

describe('mergeCardLedgerWithPreservedManualLineItems', () => {
  it('preserves manual adjustments while replacing old ledger-owned lines', () => {
    const result = mergeCardLedgerWithPreservedManualLineItems(
      [{ id: 'ledger-new', label: '새 대장', amount: 2000, sourceType: 'card_ledger' }],
      [
        { id: 'ledger-old', label: '이전 대장', amount: 1000, sourceType: 'card_ledger' },
        { id: 'manual-1', label: '수기 보정', amount: 300, sourceType: 'manual' },
        { id: 'manual-unmarked', label: '구형 수기', amount: 100 }
      ]
    );

    expect(result).toEqual([
      { id: 'manual-1', label: '수기 보정', amount: 300, sourceType: 'manual' },
      { id: 'manual-unmarked', label: '구형 수기', amount: 100 },
      { id: 'ledger-new', label: '새 대장', amount: 2000, sourceType: 'card_ledger' }
    ]);
  });
});

describe('getCardIdsWithProtectedOrphanBillings', () => {
  it('blocks the whole card when an unclaimed old-target DRAFT belongs to a confirmed team', () => {
    const oldTargetDraft = buildBilling({
      id: 'card-1_old-team_team_none_2026-07',
      teamId: 'old-team',
      teamName: '확정된 기존팀',
      lineItems: [{
        id: 'old-line',
        label: '기존 대상 금액',
        amount: 5000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const blocked = getCardIdsWithProtectedOrphanBillings({
      yearMonth: '2026-07',
      billings: [oldTargetDraft],
      claimedBillingIds: new Set(),
      currentCardIds: new Set(['card-1']),
      isProtectedTarget: (document) => document.teamId === 'old-team'
    });

    expect(Array.from(blocked)).toEqual(['card-1']);

    const eligibleRows = excludeProtectedOrphanCardRows([
      { id: 'card-1:split-a', cardId: 'card-1' },
      { id: 'card-1:split-b', cardId: 'card-1' },
      { id: 'card-2:row', cardId: 'card-2' }
    ], blocked, (row) => row.cardId);
    expect(eligibleRows).toEqual([{ id: 'card-2:row', cardId: 'card-2' }]);
  });

  it('does not block a card for a claimed current-row draft or an unconfirmed old target', () => {
    const currentDraft = buildBilling({
      id: 'current-row',
      lineItems: [{
        id: 'current',
        label: '현재 금액',
        amount: 5000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'row-1'
      }]
    });
    const unconfirmedOrphan = buildBilling({
      id: 'old-row',
      teamId: 'old-team',
      lineItems: [{
        id: 'old',
        label: '이전 금액',
        amount: 5000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const blocked = getCardIdsWithProtectedOrphanBillings({
      yearMonth: '2026-07',
      billings: [currentDraft, unconfirmedOrphan],
      claimedBillingIds: new Set([currentDraft.id]),
      currentCardIds: new Set(['card-1']),
      isProtectedTarget: () => false
    });

    expect(blocked.size).toBe(0);
  });

  it('does not revive protection for an already cancelled old-target document', () => {
    const cancelledOrphan = buildBilling({
      id: 'card-1_old-team_team_none_2026-07',
      status: 'CANCELLED',
      teamId: 'old-team',
      lineItems: [{
        id: 'old',
        label: '취소된 이전 금액',
        amount: 5000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const blocked = getCardIdsWithProtectedOrphanBillings({
      yearMonth: '2026-07',
      billings: [cancelledOrphan],
      claimedBillingIds: new Set(),
      currentCardIds: new Set(['card-1']),
      isProtectedTarget: () => true
    });

    expect(blocked.size).toBe(0);
  });

  it('blocks an unclaimed auto-managed posted billing even when its old target lookup is unavailable', () => {
    const postedOrphan = buildBilling({
      id: 'posted-old-row',
      status: 'PAID',
      teamId: 'old-team',
      lineItems: [{
        id: 'old',
        label: '정산된 이전 금액',
        amount: 5000,
        sourceType: 'card_ledger',
        sourceLedgerRowId: 'old-row'
      }]
    });

    const blocked = getCardIdsWithProtectedOrphanBillings({
      yearMonth: '2026-07',
      billings: [postedOrphan],
      claimedBillingIds: new Set(),
      currentCardIds: new Set(['card-1']),
      isProtectedTarget: () => false
    });

    expect(Array.from(blocked)).toEqual(['card-1']);
  });
});
