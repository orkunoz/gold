# V1 production runbook

## Architecture and status

The production target is Vercel running the Next.js application over HTTPS, with Supabase providing Auth and PostgreSQL/RLS. GitHub is the source-code backup. Supabase/Postgres is the source of truth for business data after an Excel import; uploaded workbooks are not a database backup.

The repository is deployment-ready, but a live Vercel deployment is **not verified or claimed**. It still requires access to the business Vercel project, the final production URL, and production environment values. Real employee invitation delivery also remains a controlled manual acceptance test.

`GET /api/health` returns only `{ "status": "ok" }` with no-store caching. It proves the Next.js process responds; it intentionally reveals no configuration, identity, or database details.

## Production environment

Configure these values in Vercel for Production (and Preview only when preview deployments are intentionally allowed):

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon/publishable browser key |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical HTTPS application URL, no trailing slash |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase Auth Admin invitation call |

Never prefix the service-role variable with `NEXT_PUBLIC_`, pass it to Client Components, log it, or store it in Git. Rotate it immediately if it is ever exposed. The application imports it only from `src/lib/supabase/admin.ts`, which is guarded by `server-only`; employee invitation is its only use.

## Vercel deployment

1. Import `orkunoz/gold` into the intended business Vercel account.
2. Keep the detected Next.js framework and repository root. Use Node.js 24, `npm ci`, and the normal `npm run build` command.
3. Add all four environment variables above. Do not paste secrets into source files or build logs.
4. Deploy and record the resulting HTTPS production URL.
5. Set `NEXT_PUBLIC_APP_URL` to that exact origin and redeploy so invitation redirects use it.
6. In Supabase Authentication → URL Configuration, set **Site URL** to the production origin. Add the exact production login URL (`https://…/login`) to allowed redirect URLs. Add intentional Vercel preview URLs only if previews should use production Auth.
7. Keep public signup and anonymous sign-in disabled; keep the email provider enabled.
8. Enable leaked-password protection in Supabase Auth if the project plan supports it; the production security advisor currently reports it disabled.
9. Confirm `/api/health`, then execute the acceptance checklist below with controlled accounts/data.

Vercel's default domain and HTTPS are sufficient for V1. A custom domain can be attached in Vercel later; update both `NEXT_PUBLIC_APP_URL` and Supabase Auth URLs and redeploy after changing it.

## Database release and recovery

Before each database release, verify the linked project, inspect `supabase db push --dry-run`, run migration parity and database lint, then apply only new forward migrations. Never edit an already-applied migration or run `db reset`, destructive seed scripts, or ad-hoc cleanup against production.

Verify that database backups/PITR appropriate to the selected Supabase plan are enabled in the Supabase dashboard. This repository cannot prove that backups exist. Before the system becomes business-critical, document who owns restoration and perform a restoration drill into an isolated project. A GitHub checkout restores code and migrations, not live inventory or sales.

Task 3 acceptance rows `TEST-3A-001`, `TEST-3B-001`, and `TEST-3B-WARN` were previously documented as `REMOVED`. Confirm their identity before any cleanup; never delete rows that may be real data. Completed sales are immutable history and should not be deleted after a production smoke test. If a test sale is necessary, use one unmistakably labeled item and leave it `REMOVED` when no sale is completed, or record the test sale number when one is completed.

## Production acceptance checklist

Perform this after deployment with controlled Owner, manager, and salesperson accounts. Do not fabricate results.

### Authentication and administration

- [ ] Owner, manager, and salesperson can sign in and sign out.
- [ ] Protected routes redirect signed-out users.
- [ ] A user without an active linked employee cannot access business data.
- [ ] Owner creates a controlled test shop and safely deactivates it.
- [ ] Owner invites a controlled second email; the link returns to the production app and the Auth identity links to exactly one employee.
- [ ] Role/shop changes take effect; inactive employee loses operational access.
- [ ] Salesperson cannot open Administration or Pricing; manager cannot access another shop.

### Inventory, import, pricing, and scanning

- [ ] Import a realistic `.xlsx` sample; malformed file, missing/impossible date, duplicate barcode, and invalid shop cases fail safely.
- [ ] Blank imported manual price remains null; provided manual price remains an override.
- [ ] Manually create and edit one labeled test item; duplicate barcode is blocked.
- [ ] Inventory scan autofocus/Enter/exact match/not-found/whitespace and rapid repeated scans work with keyboard emulation.
- [ ] Create and deactivate a pricing rule; automatic price applies and manual override wins everywhere.

### Sale and reporting

- [ ] Scan one `IN_STOCK` item once into checkout; duplicate, `SOLD`, `RESERVED`, and `REMOVED` scans are rejected.
- [ ] Effective list price is correct; edit final price and complete exactly one sale.
- [ ] Item becomes `SOLD`; a second sale attempt is rejected; history/detail preserve list and final snapshots.
- [ ] Dashboard reflects revenue and reduced current stock.
- [ ] Changing a pricing rule does not change completed sale detail or historical revenue.

## Automated release checks

GitHub Actions runs install, lint, typecheck, unit tests, and production build without production secrets. Hosted database lint, parity, and rollback-safe SQL suites remain explicit release checks because CI must not hold production database credentials. Dependency audit findings should be reviewed rather than resolved with blind major upgrades.

The Task 8 audit found no high or critical npm vulnerabilities. Newer package versions are available, including major versions of development tooling, but no late V1 upgrade is justified without a separate compatibility pass. Supabase's security advisor warns that authenticated users can invoke the intentional `SECURITY DEFINER` RPC surface; these functions are the designed application interface and retain fixed search paths plus explicit active-employee, role, and shop authorization. Do not dismiss future advisor findings without reviewing each function.

## Deferred from V1

Returns/refunds, transfers, stocktaking, receipt/fiscal printing, customer records/CRM, loyalty, commissions/payroll, tax/accounting, and advanced analytics remain separate future milestones.
