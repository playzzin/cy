# Accommodation Billing Server Mutation Candidates

## Why This Exists

Accommodation billing save now avoids deleting every line item before recreating them. The remaining high-risk area is confirmation and confirmation-cancel flows because they update both accommodation billing documents and advance payment documents from the client.

Client-side code can order operations and attempt compensation, but it cannot guarantee a single atomic commit across all affected business objects when the current compatibility service calls are separate requests.

## Candidate 1: Confirm Billing And Post Advance Payment

Current client flow:

1. Read billing document and line items.
2. Calculate advance payment field deltas from line items.
3. Create or update the advance payment document.
4. Mark the accommodation billing document as `confirmed`.
5. Store `postedAdvancePaymentId`.
6. Write an audit log.

Risk:

- If the advance payment write succeeds and the billing update fails, the advance payment can be linked while the billing document remains draft.
- The client now attempts rollback for this specific failure window, but rollback is also a best-effort client request.

Server mutation target:

- `confirmAccommodationBillingAndPostAdvancePayment({ billingId, actor, operationId })`
- Run in one trusted backend mutation/transaction where possible.
- Validate the billing is still draft.
- Re-read active line items server-side.
- Upsert advance payment and billing status together.
- Emit audit log after commit or as an outbox event.

## Candidate 2: Cancel Confirmation And Reverse Advance Payment

Current client flow:

1. Read confirmed billing document.
2. Reset linked advance payment fields.
3. Mark billing document as `draft`.
4. Clear `confirmedAt` and `postedAdvancePaymentId`.
5. Write audit log.

Risk:

- If advance reset succeeds and billing update fails, the billing can remain confirmed while the advance payment has already been reversed.

Server mutation target:

- `cancelAccommodationBillingConfirmation({ billingId, reason, actor, operationId })`
- Validate the billing is currently confirmed.
- Validate linked advance payment still points to the same billing.
- Reverse advance payment and billing status in one backend-controlled operation.
- Require reason and store actor/time metadata in the billing log.

## Candidate 3: Billing Document And Line Item Upsert

Current client flow:

1. Update or create billing document.
2. Diff active line items by deterministic id.
3. Create missing line items.
4. Update changed or previously cancelled line items.
5. Soft-cancel active stale line items.

Risk:

- This is safer than delete-then-create because old line items remain if create/update fails.
- It is still not perfectly atomic because document update and line item writes are separate compatibility calls.

Server mutation target:

- `upsertAccommodationBillingDraft({ document, baseUpdatedAt, actor, operationId })`
- Reject confirmed documents unless the action is an explicit confirmation cancel.
- Apply document and line item diff in a backend transaction or batch.
- Return created/updated/cancelled line item ids for UI and audit.
