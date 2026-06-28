# Menu Refactor Plan

## Decision

- Do not create new position menus for team lead, foreman, or worker.
- Keep the existing team lead, foreman, and worker menus managed by their real position IDs in the integrated menu system.
- Remove the duplicate legacy menu IDs `teamLead`, `foreman`, `general` and their `pos_*` sites.
- Seed only the newly implemented office pages into the `사무실 메뉴`.
- After cleanup, keep the office menu editable through the integrated menu manager.

## New Page Routes

| Route | Purpose |
| --- | --- |
| `/office/dashboard` | Office operations dashboard |
| `/office/request-center` | Unified request approval center |
| `/office/daily-review` | Daily report review hub |
| `/office/worker-documents` | Worker account/document hub |
| `/office/communications` | Notice/message hub |
| `/office/payroll-check` | Payroll pre-check hub |
| `/office/audit-log` | Audit/log hub |
| `/team/requests` | Team request hub |
| `/worker/home` | Worker home hub |

## Menu Setup

Menu placement rules:

- Office menu: office routes above.
- Team lead, foreman, worker menus: do not add duplicate role menus; use the existing real position menus only.
- Team lead menu: `/team/requests` only if the admin chooses to add it later.
- Worker/foreman menu: `/worker/home` only if the admin chooses to add it later.

No code should automatically create `pos_teamLead`, `pos_foreman`, or `pos_general` from this plan.
