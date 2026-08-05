import type {
  CardStatementHarnessCardMaster,
  CardStatementHarnessGeminiResponse,
} from '../cardStatementImportAnalysisHarness';

export const kbCardStatementHarnessCards: CardStatementHarnessCardMaster[] = [
  {
    id: 'card-office-5678',
    name: 'Office KB Card',
    last4: '5678',
  },
  {
    id: 'card-team-a-1234',
    name: 'Team A KB Card',
    last4: '1234',
  },
  {
    id: 'card-team-b-1234',
    name: 'Team B KB Card',
    last4: '1234',
  },
];

export const kbCardStatementValidGeminiResponse: CardStatementHarnessGeminiResponse = {
  bankName: 'KB Kookmin Card',
  statementMonth: '2026-07',
  grandTotalAmount: 30000,
  warnings: [],
  cards: [
    {
      cardLast4: '5678',
      cardName: 'Office KB Card',
      holderName: 'Office',
      subtotalAmount: 30000,
      warnings: [],
      confidence: 0.98,
      transactions: [
        {
          id: 'tx-a',
          date: '2026-07-03',
          merchant: 'Fuel Station',
          amount: 10000,
          category: 'FUEL',
          confidence: 0.95,
        },
        {
          id: 'tx-b',
          date: '2026-07-05',
          merchant: 'Toll Gate',
          amount: 20000,
          category: 'TOLL',
          confidence: 0.94,
        },
      ],
    },
  ],
};

export const kbCardStatementRiskGeminiResponse: CardStatementHarnessGeminiResponse = {
  bankName: 'KB Kookmin Card',
  statementMonth: '2026-06',
  grandTotalAmount: 56000,
  warnings: ['gemini warning: low scan confidence on page 2'],
  cards: [
    {
      cardLast4: '1234',
      cardName: 'Duplicate Last4 Card',
      holderName: 'Team',
      subtotalAmount: 50000,
      warnings: [],
      confidence: 0.86,
      transactions: [
        {
          id: 'tx-duplicate-a',
          date: '2026-07-01',
          merchant: 'Material Store',
          amount: 20000,
          category: 'MATERIAL',
          confidence: 0.9,
        },
        {
          id: 'tx-duplicate-b',
          date: '2026-07-02',
          merchant: 'Meal Shop',
          amount: 29000,
          category: 'MEAL',
          confidence: 0.89,
        },
      ],
    },
    {
      cardLast4: '5678',
      cardName: 'Office KB Card',
      holderName: 'Office',
      subtotalAmount: 5000,
      warnings: [],
      confidence: 0.93,
      transactions: [
        {
          id: 'tx-office-a',
          date: '2026-07-04',
          merchant: 'Parking',
          amount: 5000,
          category: 'OTHER',
          confidence: 0.91,
        },
      ],
    },
  ],
};
