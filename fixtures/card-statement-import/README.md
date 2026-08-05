# Card Statement Import PDF Fixtures

Place sanitized KB card statement sample PDFs here when they become available.

Rules:
- Do not commit real customer, employee, card number, or billing data.
- Redact card numbers except last4, holder names, merchants, and amounts unless the data is synthetic.
- Prefer one PDF per scenario:
  - `valid-2026-07.pdf`
  - `month-mismatch-2026-06.pdf`
  - `duplicate-last4.pdf`
  - `subtotal-mismatch.pdf`

The current automated tests do not read PDFs. They use mock Gemini responses in:

`src/utils/fixtures/cardStatementImportFixtures.ts`

When sanitized PDFs are added, wire an emulator or integration test that:
1. Uploads one fixture PDF to a test Storage path.
2. Starts a card statement import job.
3. Runs the Gemini analysis path against the PDF.
4. Compares normalized results with the existing mock-response expectations.
