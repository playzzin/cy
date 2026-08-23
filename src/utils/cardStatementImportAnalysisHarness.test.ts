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

  it('keeps ledger-only commit ids idempotent without creating a billing claim', () => {
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
    expect(retryCommit.transactionIds).toHaveLength(2);
    expect(retryCommit.results[0]).toMatchObject({
      status: 'committed',
      committedTransactionIds: [
        'card-statement__2026-07__card-team-a-1234__file-risk__0__tx-duplicate-a',
        'card-statement__2026-07__card-team-a-1234__file-risk__0__tx-duplicate-b',
      ],
    });
    expect(retryCommit.results[0].committedBillingId).toBeUndefined();
    expect(retryCommit.results[0].committedBillingLogId).toBeUndefined();
    expect(retryCommit.results[1].status).toBe('excluded');
  });

  it('reuses transaction ids when the same SHA-256 PDF is committed from another job', () => {
    const firstResults = buildCardStatementHarnessResults({
      jobId: 'job-first',
      fileId: 'file-first',
      sourceSha256: 'ABC123',
      yearMonth: '2026-07',
      gemini: kbCardStatementValidGeminiResponse,
      cards: kbCardStatementHarnessCards,
    });
    const secondResults = buildCardStatementHarnessResults({
      jobId: 'job-second',
      fileId: 'file-second',
      sourceSha256: 'abc123',
      yearMonth: '2026-07',
      gemini: kbCardStatementValidGeminiResponse,
      cards: kbCardStatementHarnessCards,
    }).map((result) => ({
      ...result,
      // Simulate unrelated files being processed before this PDF in the new job.
      resultIndex: result.resultIndex + 7,
    }));

    const firstCommit = commitCardStatementHarnessResults({
      operationId: 'card-statement-import:job-first:commit',
      yearMonth: '2026-07',
      results: firstResults,
    });
    const secondCommit = commitCardStatementHarnessResults({
      operationId: 'card-statement-import:job-second:commit',
      yearMonth: '2026-07',
      results: secondResults,
    }, firstCommit);

    expect(secondCommit.transactionIds).toEqual(firstCommit.transactionIds);
    expect(secondCommit.transactionIds).toHaveLength(2);
    expect(secondCommit.results[0].committedTransactionIds).toEqual(
      firstCommit.results[0].committedTransactionIds,
    );
  });

  it('keeps identical transaction indexes distinct across same-card blocks in one PDF', () => {
    const results = buildCardStatementHarnessResults({
      jobId: 'job-multi-block',
      fileId: 'file-multi-block',
      sourceSha256: 'same-sha',
      yearMonth: '2026-07',
      cards: kbCardStatementHarnessCards,
      gemini: {
        bankName: 'KB Kookmin Card',
        statementMonth: '2026-07',
        grandTotalAmount: 30000,
        cards: [
          {
            cardLast4: '5678',
            subtotalAmount: 10000,
            transactions: [{
              date: '2026-07-01',
              merchant: 'Fuel Station',
              amount: 10000,
              category: 'FUEL',
              confidence: 1,
            }],
          },
          {
            cardLast4: '5678',
            subtotalAmount: 20000,
            transactions: [{
              date: '2026-07-02',
              merchant: 'Toll Gate',
              amount: 20000,
              category: 'TOLL',
              confidence: 1,
            }],
          },
        ],
      },
    });

    const commit = commitCardStatementHarnessResults({
      operationId: 'card-statement-import:job-multi-block:commit',
      yearMonth: '2026-07',
      results,
    });

    expect(commit.transactionIds).toEqual([
      'card-statement__2026-07__card-office-5678__same-sha__0__tx_0000',
      'card-statement__2026-07__card-office-5678__same-sha__1__tx_0000',
    ]);
  });
});
