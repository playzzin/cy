import {
  applyCardStatementHarnessReview,
  buildCardStatementHarnessResults,
  commitCardStatementHarnessResults,
} from './cardStatementImportAnalysisHarness';
import {
  kbCardStatementHarnessCards,
  kbCardStatementRiskGeminiResponse,
  kbCardStatementValidGeminiResponse,
} from './fixtures/cardStatementImportFixtures';

const buildValidResults = () => buildCardStatementHarnessResults({
  jobId: 'job-valid',
  fileId: 'file-valid',
  fileIndex: 0,
  yearMonth: '2026-07',
  gemini: kbCardStatementValidGeminiResponse,
  cards: kbCardStatementHarnessCards,
});

const buildRiskResults = () => buildCardStatementHarnessResults({
  jobId: 'job-risk',
  fileId: 'file-risk',
  fileIndex: 0,
  yearMonth: '2026-07',
  gemini: kbCardStatementRiskGeminiResponse,
  cards: kbCardStatementHarnessCards,
});

describe('card statement import analysis harness', () => {
  it('flags a statement month mismatch from the Gemini response', () => {
    const results = buildRiskResults();

    expect(results[0].warnings).toEqual(expect.arrayContaining([
      'statement month mismatch: selected 2026-07, pdf 2026-06',
    ]));
    expect(results[1].warnings).toEqual(expect.arrayContaining([
      'statement month mismatch: selected 2026-07, pdf 2026-06',
    ]));
  });

  it('requires review when multiple card masters share the same last4', () => {
    const [duplicateLast4Result] = buildRiskResults();

    expect(duplicateLast4Result.cardLast4).toBe('1234');
    expect(duplicateLast4Result.status).toBe('needs_review');
    expect(duplicateLast4Result.matchedCardId).toBeNull();
    expect(duplicateLast4Result.warnings.join('\n')).toContain('duplicate card last4 1234');
  });

  it('flags card subtotal and statement grand total mismatches', () => {
    const [mismatchedSubtotalResult, matchedOfficeResult] = buildRiskResults();

    expect(mismatchedSubtotalResult.warnings).toEqual(expect.arrayContaining([
      'transaction subtotal mismatch: transactions 49000, card subtotal 50000',
      'grand total mismatch: card subtotals 55000, statement total 56000',
    ]));
    expect(matchedOfficeResult.warnings).toEqual(expect.arrayContaining([
      'grand total mismatch: card subtotals 55000, statement total 56000',
    ]));
  });

  it('supports manual matching after automatic duplicate-last4 review', () => {
    const [duplicateLast4Result] = buildRiskResults();

    const reviewed = applyCardStatementHarnessReview(
      duplicateLast4Result,
      { matchedCardId: 'card-team-a-1234' },
      kbCardStatementHarnessCards,
    );

    expect(reviewed.status).toBe('matched');
    expect(reviewed.matchedCardId).toBe('card-team-a-1234');
    expect(reviewed.matchedCardLabel).toBe('Team A KB Card (1234)');
    expect(reviewed.matchConfidence).toBe(1);
  });

  it('supports excluding a result from commit candidates', () => {
    const [result] = buildValidResults();

    const excluded = applyCardStatementHarnessReview(
      result,
      { exclude: true, exclusionReason: 'not this month' },
      kbCardStatementHarnessCards,
    );

    expect(excluded.status).toBe('excluded');
    expect(excluded.matchedCardId).toBeNull();
    expect(excluded.exclusionReason).toBe('not this month');
  });

  it('keeps ledger commit ids idempotent across retry runs', () => {
    const [duplicateLast4Result, officeResult] = buildRiskResults();
    const manuallyMatched = applyCardStatementHarnessReview(
      duplicateLast4Result,
      { matchedCardId: 'card-team-a-1234' },
      kbCardStatementHarnessCards,
    );
    const excluded = applyCardStatementHarnessReview(
      officeResult,
      { exclude: true, exclusionReason: 'covered by another file' },
      kbCardStatementHarnessCards,
    );
    const results = [manuallyMatched, excluded];

    const firstCommit = commitCardStatementHarnessResults({
      operationId: 'card-statement-import:job-risk:commit',
      yearMonth: '2026-07',
      results,
    });
    const retryCommit = commitCardStatementHarnessResults({
      operationId: 'card-statement-import:job-risk:commit',
      yearMonth: '2026-07',
      results: firstCommit.results,
    }, firstCommit);

    expect(retryCommit.transactionIds).toEqual(firstCommit.transactionIds);
    expect(retryCommit.billingLogIds).toEqual(firstCommit.billingLogIds);
    expect(retryCommit.billingLineItemIds).toEqual(firstCommit.billingLineItemIds);
    expect(retryCommit.transactionIds).toHaveLength(2);
    expect(retryCommit.billingLogIds).toHaveLength(1);
    expect(Object.values(retryCommit.billingLineItemIds)[0]).toHaveLength(2);
    expect(retryCommit.results[0]).toMatchObject({
      status: 'committed',
      committedBillingId: 'card-billing__2026-07__card-team-a-1234',
      committedBillingLogId: 'card-statement-import-billing-log__card-statement-import_job-risk_commit__card-billing_2026-07_card-team-a-1234',
      committedTransactionIds: [
        'card-statement__2026-07__card-team-a-1234__file-risk__0__tx-duplicate-a',
        'card-statement__2026-07__card-team-a-1234__file-risk__0__tx-duplicate-b',
      ],
    });
    expect(retryCommit.results[1].status).toBe('excluded');
  });
});
