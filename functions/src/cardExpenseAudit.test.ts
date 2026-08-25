import { strict as assert } from 'assert';
import * as admin from 'firebase-admin';
import { test } from 'node:test';

if (admin.apps.length === 0) admin.initializeApp({ projectId: 'demo-card-expense-audit' });

const loadAuditModule = () => import('./cardExpenseAudit');

const transaction = (id: string, patch: Record<string, unknown> = {}) => ({
    id,
    cardId: 'card-1',
    cardLabel: '현장카드 (1234)',
    date: '2026-08-10',
    yearMonth: '2026-08',
    merchant: '테스트상사',
    category: 'MATERIAL',
    amount: 120_000,
    ...patch,
});

test('card expense audit access is strict to CEO and DEV role values', async () => {
    const { hasStrictCardExpenseAuditAccess } = await loadAuditModule();
    assert.equal(hasStrictCardExpenseAuditAccess({ role: 'admin' }), false);
    assert.equal(hasStrictCardExpenseAuditAccess({ position: '대표' }), true);
    assert.equal(hasStrictCardExpenseAuditAccess({ additionalPositions: ['일반', 'DEV'] }), true);
    assert.equal(hasStrictCardExpenseAuditAccess({ erpRoleGroups: ['finance'] }), false);
});

test('policy normalization applies safe bounds and defaults', async () => {
    const { normalizeCardExpenseAuditPolicy } = await loadAuditModule();
    const policy = normalizeCardExpenseAuditPolicy({
        highAmountThreshold: -1,
        unusualAmountRatio: 100,
        geminiMaximumTransactions: 500,
        categoryLimits: { MEAL: 55_000 },
    });
    assert.equal(policy.highAmountThreshold, 500_000);
    assert.equal(policy.unusualAmountRatio, 20);
    assert.equal(policy.geminiMaximumTransactions, 100);
    assert.equal(policy.categoryLimits.MEAL, 55_000);
    assert.equal(policy.categoryLimits.FUEL, 300_000);
});

test('deterministic audit detects duplicates, split payments, missing receipts and assignment mismatch', async () => {
    const { evaluateCardExpenseTransactions, normalizeCardExpenseAuditPolicy } = await loadAuditModule();
    const findings = evaluateCardExpenseTransactions({
        yearMonth: '2026-08',
        transactions: [
            transaction('tx-1'),
            transaction('tx-2'),
        ],
        historicalTransactions: [],
        assignments: [],
        policy: {
            ...normalizeCardExpenseAuditPolicy({}),
            splitPaymentTotalThreshold: 200_000,
            receiptRequiredAmount: 100_000,
        },
    });

    assert.equal(findings.length, 2);
    const codes = new Set(findings[0].ruleHits.map((hit) => hit.code));
    assert.equal(codes.has('DUPLICATE_TRANSACTION'), true);
    assert.equal(codes.has('SPLIT_PAYMENT'), true);
    assert.equal(codes.has('MISSING_RECEIPT'), true);
    assert.equal(codes.has('ASSIGNMENT_MISMATCH'), true);
    assert.equal(findings[0].severity, 'CRITICAL');
});

test('historical baseline detects unusual amounts but preserves valid assignment', async () => {
    const { evaluateCardExpenseTransactions, normalizeCardExpenseAuditPolicy } = await loadAuditModule();
    const historicalTransactions = Array.from({ length: 6 }, (_, index) => transaction(`history-${index}`, {
        date: `2026-0${index + 1}-10`,
        yearMonth: `2026-0${index + 1}`,
        amount: 40_000,
        merchant: '기존자재상',
    }));
    const findings = evaluateCardExpenseTransactions({
        yearMonth: '2026-08',
        transactions: [transaction('tx-current', { amount: 180_000, merchant: '기존자재상', receiptAttachmentPaths: ['receipt.jpg'] })],
        historicalTransactions,
        assignments: [{
            id: 'assignment-1',
            cardId: 'card-1',
            assigneeName: '김테스트',
            startDate: '2026-01-01',
        }],
        policy: normalizeCardExpenseAuditPolicy({ unusualAmountMinimum: 100_000, unusualAmountRatio: 3 }),
    });

    assert.equal(findings.length, 1);
    const codes = new Set(findings[0].ruleHits.map((hit) => hit.code));
    assert.equal(codes.has('UNUSUAL_AMOUNT'), true);
    assert.equal(codes.has('ASSIGNMENT_MISMATCH'), false);
    assert.equal(findings[0].assignedTo, '김테스트');
});
