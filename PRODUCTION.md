# Production runbook

## Current deployment

- Application: `https://gold-kappa-ruddy.vercel.app`
- Vercel project: `gold`, team `zelta-digital`
- Source/deployment branch: GitHub `orkunoz/gold`, `main`
- Data/Auth: existing Supabase project

Vercel runs the Next.js application over HTTPS. Supabase PostgreSQL is the source of truth for inventory, sales, accounts, and audit history. GitHub is source-code history, not a business-data backup. `GET /api/health` verifies only that the Next.js process responds.

## Environment

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Browser publishable/anon key |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical HTTPS application origin |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Protected Auth account creation/reset |

Never expose, log, commit, or add a `NEXT_PUBLIC_` prefix to the service-role key. Rotate it if exposure is suspected.

## Release procedure

1. Confirm the intended repository, clean worktree, `main`, and exact commit.
2. Run `npm ci`, lint, typecheck, unit tests, and production build.
3. Authenticate/link Supabase CLI to the existing project.
4. Run migration parity, `supabase db push --dry-run --linked`, and database lint.
5. Review and apply only new forward migrations. Never edit or replay an applied migration.
6. Push `main` and separately verify GitHub CI and the Vercel deployment for that commit.
7. Verify `/api/health`, login, role restrictions, and changed workflows.

Database migrations are not applied by GitHub Actions or Vercel.

## Database safety and recovery

- Never run `supabase db reset` against production.
- Never production-seed or replay historical cleanup scripts.
- Preserve sales, sale items, inventory history, employee/shop references, and the restricted recovery archive.
- Use rollback-only SQL tests and unmistakably disposable records.
- Verify Supabase backup/PITR configuration in the provider dashboard and maintain a documented restore owner and isolated restore drill.

## Current acceptance checklist

### Authentication and Accounts

- [ ] Owner and Salesperson can sign in/out with username/password.
- [ ] Signed-out, inactive, and unlinked identities cannot access protected data.
- [ ] Owner can create one disposable username-based Salesperson account for a disposable shop.
- [ ] The disposable account can sign in only to its assigned shop.
- [ ] Owner can reset that disposable account password; the old password stops working and the new password works.
- [ ] Routine account creation cannot create another Owner or a second active Salesperson for a shop.
- [ ] Production Owner credentials are never changed for testing.

### Inventory and import

- [ ] Owner can add/edit/import; Salesperson remains read-only and shop-scoped.
- [ ] Status options are exactly `IN_STOCK`, `SOLD`, and `REMOVED`.
- [ ] Exact barcode scanning and article choice work with keyboard input.
- [ ] More than 50 identical article matches are paged explicitly.
- [ ] Original XLSX source-row references remain stable after blank rows.
- [ ] Blank mapped gram-price footer rows are visibly counted as skipped.
- [ ] Malformed nonblank optional gram price warns, stores null, and does not create a formula price.

### Checkout and reporting

- [ ] Discount defaults to 0 and accepts 0–100; no arbitrary final-price input exists.
- [ ] The database rejects cross-shop, unavailable, duplicate, missing-price, or extra-field sale requests atomically.
- [ ] Sale detail preserves list price, discount, sale price, category, and weight snapshots.
- [ ] Editing allowable current inventory fields cannot change historical category, sold weight, or sales metrics.
- [ ] Owner receives all/one-shop reporting; Salesperson receives only assigned-shop reporting.

### Responsive review

- [ ] Login, Dashboard, Inventory, Checkout, and Administration are usable at desktop, tablet, and mobile widths.
- [ ] Dense tables retain intentional horizontal scrolling; actions and inputs remain reachable and focus-visible.

## CI and checks

GitHub Actions runs Node 24 install, lint, typecheck, unit tests, and the webpack production build. Hosted migration parity, database lint, rollback SQL tests, live account acceptance, and Vercel deployment verification are explicit release checks and must be reported separately.

Returns/refunds, transfers, fiscal receipts, CRM, stocktaking, payroll, and generalized tenancy remain out of scope.
