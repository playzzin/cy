import type { TeamSettlementDocument } from '../types/teamSettlement';
import { repairLegacyScopedCardBillingDuplicates } from './teamSettlementBillingSnapshot';

const buildDocument = (overrides: Partial<TeamSettlementDocument> = {}): TeamSettlementDocument => ({
  yearMonth: '2026-07',
  teamId: 'team-1',
  teamName: '테스트팀',
  sales: [],
  purchases: [],
  deductions: [],
  additions: [],
  summary: { prevCarryover: 0, deposit: 0 },
  sourceSnapshot: {
    version: 1,
    capturedAt: '2026-08-12T03:07:53.000Z',
    dailyReports: [],
    totals: {
      sales: 1000,
      purchases: 100,
      deductions: 495,
      additions: 20,
      net: 425
    }
  },
  confirmedAt: null,
  updatedAt: '2026-08-12T03:07:53.000Z',
  ...overrides
});

describe('repairLegacyScopedCardBillingDuplicates', () => {
  it('removes only equal legacy whole-card totals when row-scoped drafts exist', () => {
    const document = buildDocument({
      deductions: [
        { id: 'card_billing:2026-07:card-a-legacy', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-A)', amount: 100 },
        { id: 'card_billing:2026-07:card-a__row_team-a', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-A)', amount: 100 },
        { id: 'card_billing:2026-07:card-b-legacy', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-B)', amount: 60 },
        { id: 'card_billing:2026-07:card-b__row_first', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-B)', amount: 20 },
        { id: 'card_billing:2026-07:card-b__row_second', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-B)', amount: 40 },
        { id: 'card_billing:2026-07:card-c-legacy', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-C)', amount: 50 },
        { id: 'card_billing:2026-07:card-c__row_team-c', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-C)', amount: 45 },
        { id: 'vehicle_billing:2026-07:vehicle-1', source: 'auto', origin: 'vehicle_billing', category: '차량비', amount: 80 },
        { id: 'manual-1', source: 'manual', origin: 'manual', category: '수기 조정', amount: 10 }
      ]
    });

    const result = repairLegacyScopedCardBillingDuplicates(document);

    expect(result.repaired).toBe(true);
    expect(result.removedCount).toBe(2);
    expect(result.removedAmount).toBe(160);
    expect(result.document.deductions.map((item) => item.id)).toEqual([
      'card_billing:2026-07:card-a__row_team-a',
      'card_billing:2026-07:card-b__row_first',
      'card_billing:2026-07:card-b__row_second',
      'card_billing:2026-07:card-c-legacy',
      'card_billing:2026-07:card-c__row_team-c',
      'vehicle_billing:2026-07:vehicle-1',
      'manual-1'
    ]);
    expect(result.document.sourceSnapshot?.totals).toEqual({
      sales: 1000,
      purchases: 100,
      deductions: 335,
      additions: 20,
      net: 585
    });
  });

  it('never changes a confirmed historical settlement', () => {
    const document = buildDocument({
      confirmedAt: '2026-08-13T00:00:00.000Z',
      deductions: [
        { id: 'card_billing:2026-07:card-a-legacy', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-A)', amount: 100 },
        { id: 'card_billing:2026-07:card-a__row_team-a', source: 'auto', origin: 'card_billing', category: '카드비 (본팀-A)', amount: 100 }
      ]
    });

    const result = repairLegacyScopedCardBillingDuplicates(document);

    expect(result.repaired).toBe(false);
    expect(result.document).toBe(document);
  });
});
