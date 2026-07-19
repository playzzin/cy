# Card Statement Import Testing

This test structure raises confidence in KB card billing PDF analysis without requiring real PDFs in the repository.

## Current Automated Coverage

Run only this suite:

```bash
npm run test:card-statement-import
```

The suite uses mock Gemini responses from:

```text
src/utils/fixtures/cardStatementImportFixtures.ts
```

Covered scenarios:
- Statement month mismatch between selected ledger month and analyzed PDF month.
- Duplicate card last4 candidates requiring manual review.
- Transaction subtotal mismatch at card level.
- Statement grand total mismatch across cards.
- Manual matching from `needs_review` to `matched`.
- Excluding a result so it is not committed.
- Ledger commit idempotency: deterministic transaction IDs, billing line item IDs, and billing log IDs remain stable across retry runs.

Primary test file:

```text
src/utils/cardStatementImportAnalysisHarness.test.ts
```

Pure harness used by the test:

```text
src/utils/cardStatementImportAnalysisHarness.ts
```

The harness intentionally has no Firebase, Storage, callable, or Gemini network dependency. It models the stable invariants that must hold after a Gemini response is normalized and reviewed.

## Adding Sanitized Sample PDFs Later

Put sanitized PDF fixtures under:

```text
fixtures/card-statement-import/sample-pdfs/
```

Keep real financial data out of git. Use synthetic PDFs or redact:
- card numbers except last4,
- names,
- merchants,
- account identifiers,
- any private memo or billing metadata.

Recommended future fixture names:
- `valid-2026-07.pdf`
- `month-mismatch-2026-06.pdf`
- `duplicate-last4.pdf`
- `subtotal-mismatch.pdf`

## Future Integration Test Path

When sample PDFs are available, add an emulator-backed integration suite that:

1. Seeds test cards with both unique and duplicate `last4` values.
2. Uploads a fixture PDF to a test Storage path.
3. Creates an import job and starts analysis.
4. Waits for file/result snapshots.
5. Asserts the same invariants covered by the mock harness.
6. Runs commit twice and verifies no duplicate billing logs, line items, or transactions are created.

Until that integration suite exists, `npm run test:card-statement-import` is the fast regression suite for Gemini response normalization and commit idempotency.
