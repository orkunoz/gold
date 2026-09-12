# Gold / Zlata Jewelry — persistent development handoff

Last reviewed: 2026-09-12. This file describes the current implementation, not a roadmap from earlier milestones. Read it before changing code. Task 12 shipped in `555725a`; the subsequent cleanup milestone is documented below. Use `git log -1` for the current repository commit. No conversation memory or files outside this repository are required to understand the system.

## Project and deployment

- Gold jewelry-store management SaaS/web application for a Ukraine family jewelry business. Current deployment serves one business with several physical shops; it is not a generalized multi-tenant SaaS yet.
- UI brand: Zlata Jewelry. English operational UI; Ukrainian product data; UAH currency; grams for weight.
- Repository: https://github.com/orkunoz/gold ; default/deployment branch `main`.
- Production: https://gold-kappa-ruddy.vercel.app ; Vercel project `gold` in team `zelta-digital`.
- Next.js App Router 16.3.4, React 19.2.8, TypeScript 6.0.3, Tailwind 4.3.3, Node.js 24+, Supabase PostgreSQL/Auth and server-side RPC backend. Exact versions are pinned in package.json/package-lock.json.
- Production is live and used. Do not reinitialize it, seed it, reset it, or replay the historical cleanup.

## Business model and decisions that must not be reversed

- Exactly one active Owner account, with access across shops. One active Salesperson account per physical shop. Only `owner` and `salesperson` are operational roles; manager was migrated away.
- Salesperson access is restricted to their assigned active shop in PostgreSQL and server code, not just navigation. Owner can choose an operational shop at checkout and all/one shop for reporting.
- Only Owner manages/imports inventory, shops, categories through product entry, or accounts. Salesperson reads inventory and performs sales in their shop.
- Product categories come from imported/manual product data. Never restore a hardcoded category whitelist or an unknown-category rejection.
- Formula inventory price is the preferred list price. Cashier controls Discount %, never an arbitrary final price.
- Sales page is checkout-only for both roles. Do not restore Products/Sales Register tabs, historical tables or register filters there. Sold products are found through Inventory status filtering; dashboard/restricted sale details still expose history.
- Pricing management page/navigation is removed. Keep compatibility pricing backend until an explicitly approved safe cleanup.
- No reservation workflow. Operational statuses are only IN_STOCK, SOLD, REMOVED.
- Preserve barcode uniqueness, complete_sale atomicity and audit/history. Do not delete business records during routine work.

## Inventory model

One `inventory_items` row represents one physical item (not an article-level quantity). Current fields:

| Fields | Meaning / nullability |
| --- | --- |
| id | Required generated UUID primary key |
| shop_id | Nullable shop FK; NULL displays as Unassigned and cannot be checked out |
| status | Required text CHECK; default IN_STOCK; IN_STOCK/SOLD/REMOVED only |
| created_at, updated_at | Required database timestamps; update trigger maintains updated_at |
| created_by | Nullable employee FK |
| barcode | Nullable text; non-null values trimmed/nonempty and globally unique, case-sensitive; many NULL barcodes allowed |
| article_number | Nullable text; repeats are valid and never imply the same physical item |
| category_id | Nullable FK to product_categories; display name obtained by join |
| metal | Nullable text constrained to Gold or Silver |
| producer, size | Nullable text; size supports nonnumeric source values |
| gold_fineness | Nullable jewelry fineness, exposed as Fineness; XLSX header `Проба` |
| gold_color | Nullable legacy/manual product attribute retained |
| weight_grams | Nullable nonnegative numeric weight |
| price_per_gram | Nullable nonnegative numeric(14,2) |
| price | Nullable numeric(14,2), database trigger calculates round(weight_grams × price_per_gram, 2); NULL if either input is NULL |
| owner_price, selling_price | Nullable nonnegative legacy pricing compatibility inputs |
| discount | Nullable source/import text; informational, not checkout discount_percent |
| received_at, notes | Nullable received timestamp and notes |

The list columns are exactly Nr, Product Category, Producer, Metal, Fineness, Size, Weight, Price per Gram, Article, Price (UAH), Notes, Status, Shop, Barcode. Database pagination is 50 items/page, newest first; row numbers continue across pages and the filtered result count is in the table footer. Filters include partial barcode/article, category, metal, status, text and Owner shop. Inventory has no separate scanner panel; Sales checkout retains scanning. Salespeople cannot add/edit/import.

Manual add/edit allows an existing category or new category text directly; blank category is NULL. Category resolution normalizes surrounding/repeated whitespace, matches case-insensitively, preserves spelling of the existing category, and safely handles concurrent creation. `Браслет` and `Браслет оф` are distinct.

`get_inventory_category_options()` aggregates categories referenced by accessible inventory in PostgreSQL (no full inventory download). It includes all statuses and is not narrowed by current list filters or the Owner's selected shop filter. Empty accessible inventory gives zero category options; unused master records do not appear. `get_sales_category_options()` uses accessible sale-line category snapshots and remains internal compatibility functionality.

### Authoritative pricing precedence

`get_effective_inventory_price(id)` requires active employee, authorized shop, active shop and existing product. Current order is:

1. Non-null formula `inventory_items.price` (INVENTORY_FORMULA).
2. Legacy `selling_price` (MANUAL), only if formula price is unavailable.
3. `calculate_selling_price(owner_price, shop_id, category_id)` using an active pricing rule, otherwise owner_price fallback.

No available source means NULL and checkout/completion reject the item. Never restore the older manual-first precedence. Inventory's Price column displays formula price; compatibility fallback can only differ for rows with missing formula inputs. Pricing rules do not mass-update inventory or completed sales. Source `discount` text does not alter formula/list price or the default checkout discount.

### Product history

`inventory_item_history` is append-only to application users, with item FK, field_name, old_value, new_value, changed_by_employee_id, changed_at, source, optional sale_id. Triggers log creation and changes to category, metal, producer, size, article, weight, gram price, inventory price/discount, status, shop, barcode, notes and legacy pricing fields. Sources include MANUAL_EDIT, XLSX_IMPORT, SALE, STATUS_CHANGE, SHOP_TRANSFER and SYSTEM. History rendering resolves display names and sale references. Owner-only bulk shop moves accept at most the current 50-row page, reject the whole selection if any product is SOLD, and use the normal SHOP_TRANSFER history path. Permanent deletion is an explicit destructive Owner workflow limited to IN_STOCK/REMOVED: it removes that product's history and sale lines, deletes now-empty sale headers, and recalculates retained sale totals without changing unrelated lines.

## XLSX import

Implementation: `src/lib/inventory/import`, `src/components/inventory-import.tsx`, `/api/inventory/import/{parse,validate,execute}`. Owner-only throughout; execute revalidates browser-submitted rows server-side and the database rechecks authorization.

- Standard `.xlsx` only (not `.xls`), ZIP signature check, nonempty, maximum 5 MiB, maximum 5,000 data rows, maximum 100 columns in submitted rows. Cell text trimmed and capped at 2,000 characters; date cells converted to ISO. Uses read-excel-file.
- Worksheet selection; header detection examines first 20 rows; duplicate/empty headers get usable display labels. Mapping is editable and source-column-driven. No product column is required; an empty mapping can produce a sparse item using operational defaults.
- Current mapped fields: barcode, article_number, category, metal, fineness, producer, weight_grams, size, price_per_gram, discount, notes, shop, status. Missing/unmapped optional values become NULL; no invented attributes or legacy price values. Type 1 may contain Metal without Producer; Type 2 may contain Producer without Metal. `Ціна(грн)` is deliberately suggested as Do not import. `price` is derived from Weight × Price per Gram, never imported as a total price.
- `Виріб` and variants map to Product Category, not article or producer. `Виробник` maps to producer. Ukrainian/English header aliases normalize case, spaces and punctuation; `Ціна-грам` maps to price_per_gram.
- Target shop is selected from active accessible shops. A nonblank mapped Shop cell overrides target using case-insensitive normalized shop name/code matching. Unknown shop is a row error; do not silently create shops from XLSX.
- Blank/unmapped status defaults to IN_STOCK. English and Ukrainian aliases support IN_STOCK/SOLD/REMOVED. SOLD import is rejected: only complete_sale creates it. Unknown status warns and defaults to IN_STOCK. Removed reservation strings are no longer recognized aliases.
- Every nonempty mapped category is valid, including `Браслет оф`. Normalize whitespace and case matching; create new category via `resolve_product_category` during database import. Never emit Unknown Category merely because the category is new. Blank is NULL.
- Blank barcode is NULL; no generated barcodes. Repeated nonblank barcodes in candidate rows and existing database barcodes are errors; unique DB constraint resolves races. Article is independent, nullable and repeatable. Excel numeric cells already lose leading zeros; store barcode/article cells as text in source workbooks when zeros matter.
- Localized numbers accept decimal comma, whitespace/NBSP grouping and trailing грн/UAH/₴. Negative weight/gram price is an error. Malformed optional number warns and becomes NULL. Missing weight or gram price makes formula price NULL.
- CRITICAL footer rule: when Price per Gram is mapped, skip every row whose mapped cell is blank/whitespace/NULL, before duplicate counting and preview. This prevents totals rows becoming products. Numeric zero is not blank. If gram price is not mapped, sparse rows remain valid; do not make it globally required.
- Completely blank spreadsheet rows are removed. Preview has Ready/Warning/Error; non-error rows may import. SQL RPC accepts 1–100 rows atomically per batch. Execute uses 100-row batches; failed batch retries individually, reporting imported/skipped/duplicate/failed rows. Entire workbook import is not one transaction and is not globally idempotent for items with NULL barcodes.
- `parseImportedDate` exists with calendar checks, but date is not currently exposed as an XLSX mapping target.

## Sales / checkout

Implementation: `/sales`, `sales-checkout.tsx`, `lib/sales/{checkout,actions}.ts`, `/api/sales/lookup`.

- Exact trimmed barcode lookup in selected shop first, then exact article lookup in bounded pages of 50. Multiple article matches require selection of the physical item.
- Owner selects active shop; changing shop clears the local cart. Salesperson shop is fixed read-only. Lookup server and complete_sale reject other-shop requests.
- Successful lookup adds item, clears/refocuses scanner and shows no “added to current sale” success banner. Errors remain for not found, duplicate cart, SOLD, REMOVED, wrong shop, missing price and failures.
- Discount defaults to 0; decimal percentage accepted, 0–100. Item amount = list price × (1 − discount / 100), rounded to two decimals. Current Total sums these amounts and updates on add/remove/discount change. Final Sale Price input does not exist. Cart is local component state; simply adding/removing an item does not mutate inventory.
- Payload to `complete_sale(p_shop_id, p_items, p_notes)` contains only inventory_item_id and discount_percent per item. Extra fields, including sale_price, are rejected. Missing discount defaults to 0 in SQL. Notes max 5,000 characters; 1–100 unique item UUIDs per sale.
- Database authenticates active employee, validates active shop and salesperson assignment, locks item rows in UUID order with FOR UPDATE, checks all exist/belong to shop/are IN_STOCK, resolves authoritative current list price under lock, validates discounts, and calculates amounts itself.
- Atomically creates sales header, inserts sale_items snapshots, totals header, records SALE audit context and marks all items SOLD. Any failure rolls back. Unique sale_items.inventory_item_id plus row locks prevent double sale. Browser never supplies employee attribution or authoritative price.
- Snapshots: list_price, discount_percent, sale_price, category_name, producer, size, article_number, weight_grams, price_per_gram, metal, barcode, notes. Sales stores employee/shop, sale number/date, total_list_price/total_sale_price and notes. Sale sequence may have gaps after rollback; do not reset it.
- Application grants deny direct sale mutation; ordinary inventory writes cannot create/reverse/change SOLD rows. Keep historical employee/shop references and snapshots intact.
- Confirmation includes sale identifier, date, count, total and link to read-only `/sales/[id]`. Dashboard recent-sales links still work. Historical register RPCs/query files remain, but shared Sales page does not render them.

## Dashboard

`get_dashboard_report(period, shop)` is a hardened aggregate RPC. Periods: TODAY, LAST_7_DAYS, THIS_MONTH (default), LAST_30_DAYS. Date boundaries use Europe/Kyiv, including DST; end is exclusive next local midnight. Current stock metrics are independent of reporting period.

- Owner: All shops/one active shop selector; Revenue, Items sold, Gold weight sold; in-stock count/weight, Total value, missing-price count and status summary; daily revenue chart, category performance, shop performance for All shops, recent sales.
- Salesperson: only assigned active shop; selectable reporting period; Revenue, Items sold, Gold weight sold and recent sales for that shop. No other-shop selector, inventory valuation, category/employee comparisons or cross-shop report. RPC rejects another shop ID even if UI is bypassed.
- Sales count and Average Sale KPI cards removed. Customer Value UI renamed Total value; internal JSON key remains customer_value for compatibility.
- Shop revenue, category, and sold-weight reporting use immutable sale/sale-item snapshots rather than mutable inventory rows.
- Employee breakdown is intentionally absent. The Owner dashboard renders category and shop comparisons only; the empty Employee sales panel and `employees` response property were removed.

## Administration / Auth

- `employees.auth_user_id` is the authoritative unique Supabase Auth link. Employees contain role, shop, active flag, display name, internal email, nullable legacy username and timestamps. No password column.
- Username input trimmed/lowercased; 3–32 ASCII characters matching `^[a-z0-9][a-z0-9_-]{2,31}$`; deterministic internal email alias derived in signIn. Users enter username, not email. No public username lookup/enumeration endpoint; errors generic.
- Current operational usernames: admin (Owner, no shop), kamin → Kamin, horokhiv → Horokhiv, novovolynsk → Novovolynsk, volodymyr → Volodymyr. These are identifiers, not credentials; obtain passwords securely from the Owner. Legacy employees are inactive, not deleted. Active shop options last observed are these four locations; old shop identities can remain inactive.
- Auth session uses verified getClaims and Supabase SSR cookie refresh. Proxy checks active employee and locally signs out inactive/unlinked sessions to avoid login/dashboard loops. Protected pages and each mutation independently authorize. Authenticated responses are private/no-store.
- `/admin` is Owner-only. Shops support create/edit and permanent deletion with a confirmation dialog. The compatibility `is_active` field remains in the backend, but activation controls are not exposed. Permanent deletion sets current inventory and account assignments to NULL/Unassigned, deletes shop-scoped compatibility pricing rules, and preserves immutable sale shop snapshots.
- `/admin/employees` is labeled Accounts; creation still uses the legacy route `/admin/employees/invite` but is a direct Create Account form, not email invitation. Fields: username/password/confirmation/shop; role fixed salesperson; initial display name=username. Edit supports display name, role, active flag, shop. Auth identity/username are not editable in UI.
- Server action requires active Owner, validates username and password confirmation/6–72 character bounds, uses server-only Auth Admin createUser with confirmed internal email, then calls `admin_link_employee_account`. Existing exact matches support retry; conflicting identity/role/shop is rejected. If new Auth creation succeeds and linking fails, it attempts to remove only that newly created Auth user. Existing passwords are not changed by retry; use reset action.
- Password reset is an Owner-only server action using Auth Admin updateUserById, with confirmation UI and new-password validation. Permanent account deletion first authorizes against a hardened Owner RPC, then hard-deletes the Supabase Auth identity; the employee row cascades away while sale/audit actor snapshots remain. Existing password is never retrieved/displayed.
- Normal create flow cannot create extra Owners. Partial indexes enforce one active Owner and one active salesperson per shop; serialized last-active-Owner protection remains. Any future Owner replacement requires a controlled, tested transition, not deleting the old Owner first.
- Old employee_invitations table and preparation/finalization RPCs remain for database compatibility; the old invitation server action and user-facing invitation terminology are removed.

## Database and security architecture

Important public tables: shops, employees, product_categories, inventory_items, inventory_item_history, sales, sale_items, pricing_rules, employee_invitations. See `src/lib/database.types.ts` and forward migrations for exact schema; types narrow text CHECK values to role/status unions.

Important entry points/helpers:

- `is_active_employee`, `is_owner`, `can_access_shop`, `require_owner_employee`, `validate_admin_employee` for authorization.
- `resolve_product_category`, `get_inventory_category_options`, `get_sales_category_options`, `import_inventory_items`.
- `get_effective_inventory_price`, `get_effective_inventory_prices`, `calculate_selling_price`.
- `complete_sale`, `get_dashboard_report`, legacy `get_sales_register` and sold-product register/aggregate helpers (inspect migration definitions before use).
- `admin_create_shop`, `admin_update_shop`, `admin_set_shop_active`, `admin_update_employee`, `admin_link_employee_account`; legacy invitation RPCs.
- Inventory formula, updated_at, SOLD-transition and history triggers.

RLS is enabled on business tables. Requests normally use the user's Supabase session. Hardened SECURITY DEFINER RPCs set search_path and explicitly enforce identity/role/shop, including functions running with row_security off. Do not assume RLS alone protects a definer function. Anonymous access is denied; authenticated direct shop/employee writes are revoked in favor of Owner RPCs; pricing rule management is Owner-only; history is read-only to app users. Server service-role client is limited to protected Auth account operations, never generic inventory/sales requests.

Critical constraints: role/status CHECKs, nonnegative amounts, allowed metals, global non-null barcode uniqueness, unique normalized category names, normalized unique usernames, unique Auth linkage, active-Owner/salesperson partial indexes, required active shop validation, sale-number uniqueness, unique sold physical item, restrictive historical FKs. Removing status was a CHECK replacement, not enum surgery.

### Applied migrations

All 22 migrations through `20260912203000_task13_lint_cleanup.sql` matched hosted production after Task 13. The Task 13 migrations add deletion-safe historical snapshots/unassigned semantics and retain the validation RPC signature without lint warnings. Never edit an already applied migration.

| Version | Purpose |
| --- | --- |
| 20260908190000 | Inventory foundation, roles, shops, RLS |
| 20260909120000 | Atomic sales transaction |
| 20260909120100 | Protected SOLD transitions |
| 20260909150000 | Pricing rules foundation |
| 20260909160000 | Secure pricing calculation |
| 20260909170000 | Operational effective pricing |
| 20260909180000 | Dashboard reporting |
| 20260909190000 | Owner administration |
| 20260909200000 | Serialized Owner protection |
| 20260909210000 | Invitation finalization validation |
| 20260910110000 | Sales register backend |
| 20260910130000 | Flexible nullable inventory model |
| 20260910150000 | Formula price, audit, discounts, snapshots |
| 20260910160000 | Audit display hardening |
| 20260910170000 | Formula price checkout integration |
| 20260910180000 | Two roles and shop names |
| 20260910190000 | Dynamic categories, authoritative discounts, account uniqueness |
| 20260910210000 | Usernames, three-state inventory, dashboard periods, account link |
| 20260910220000 | Account-link integrity and shop revenue fix |
| 20260912150000 | Historical dashboard category/weight snapshot reporting |
| 20260912200000 | Account/shop deletion, unassigned current records, immutable actor/shop snapshots |
| 20260912203000 | Task 13 validation-function lint cleanup |
| 20260912220000 | Task 14 fineness import/audit and recent-sale category summaries |

### Production data safety / completed cleanup

The Owner explicitly authorized one clean start on September 10 before importing real products. It cleared 132 inventory rows, one sale, one sale line and 136 audit entries from operational tables AFTER preserving full records in restricted `production_recovery.task12_before_import`. Schema/table access was revoked from public/anon/authenticated. This is a private recovery archive, not an app table. That one-time data operation is not replayed by migrations. Accounts/shops/schema were retained, legacy employees deactivated.

The app is no longer empty: September 12 live verification observed the newer import (65 inventory items: 64 in stock and one sold) and a September 11 sale. Treat these as real/current business data. Counts can change. NEVER repeat cleanup, run demo seed/remove scripts, reset hosted Supabase, or erase/recalculate history as part of onboarding/testing. `scripts/seed-demo-data.sql` and `remove-demo-data.sql` are historical manual utilities, not startup tasks. The recovery archive is not permission for future deletion.

## New-computer setup and deployment

1. Clone orkunoz/gold, check out main, fetch/pull normally, inspect git status and this file. Do not depend on the former computer's absolute paths or untracked helper scripts.
2. Install Node.js 24+, Git, and optionally authenticated GitHub/Supabase CLIs. Run npm ci.
3. Create ignored `.env.local` using the existing production project's configuration or a deliberately chosen development environment. Obtain secret values securely from project owners/provider settings, never from Git or this document.
4. Required/configured environment variable NAMES ONLY: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The first three are public configuration; the last is server-only and required for account creation/reset. Never prefix a secret with NEXT_PUBLIC_, print it, commit it, or return it to the browser.
5. Supabase Auth uses email/password internally, confirmed internal identities, public signup disabled, anonymous sign-in disabled, canonical production Site URL. Hosted minimum password length was 6; never lower security policy to accommodate requested credentials. Provision Auth via Admin API, never plaintext DB fields.
6. Authenticate Supabase CLI and link to the EXISTING project using provider project settings (local `.temp` linkage is not portable). Run `supabase migration list --linked` and `supabase db lint --linked --level error` as appropriate. Use forward migrations and `supabase db push --linked` only for approved schema changes. Do not run hosted reset.
7. `npm run dev` for local development. Production script is `next build --webpack`; webpack was selected after a local Turbopack build-port restriction. Do not silently assume this is a project-code build defect.
8. Quality gates: npm ci, npm run lint, npm run typecheck, npm test, npm run build. GitHub Actions `.github/workflows/ci.yml` runs these on pushes and PRs using Node 24. Vercel Git integration builds/deploys main; CI and Vercel status are separate. Database migrations are not applied by that workflow.
9. After pushing, inspect Vercel deployment status for the commit and live app. Do not claim live deployment based solely on git push. `/api/health` is available for non-secret health information.

Assets are portable: `public/zlata-logo.png` is the supplied logo, used via next/image in login/header and metadata icon links. No dependency on the original Desktop file. Cream/brown/gold theme is in globals.css; navigation and serif headings are branded. Keep tables dense, keyboard labels/focus states visible, and responsive horizontal table scrolling.

## Current state, evidence and exact next work

Completed/deployed: Task 11 category/pricing/role simplification and footer rule; Task 12 username accounts, requested four shop assignments, old-account deactivation, one-time archived cleanup, three statuses, simplified dashboard, checkout-only Sales, Zlata logo/theme and inactive-session redirect fix. Vercel deployment for functional commit 555725a reported success. New account credentials and RPC access were verified without storing secrets.

Task 13 validation on September 12: npm ci (0 vulnerabilities), clean lint/typecheck, 100 passing unit/static UI tests across 16 files, and successful webpack production build. The linked existing Gold project is `xxkqpduwueefpgmnjhgn`. Each Task 13 migration was dry-run separately with no seeds/roles, both were applied, all 22 migrations matched afterward, and final DB lint found no issues. Docker-dependent rollback SQL suites, including the new Task 13 suite, were explicitly deferred by the Owner and were not run; do not imply they passed.

Live acceptance completed September 12: Owner login/dashboard; Kamin login, assigned-shop dashboard/checkout, missing Administration navigation and direct /admin redirect; Volodymyr login and inventory; categories include Браслет оф; status options have only three states; checkout formula 38,320 UAH with 10% discount became 34,488 UAH; successful add cleared/refocused scanner without success banner. No final-price input or Sales Register. Test cart removed and signed out, with no completed test sale or persistent product mutation.

Cleanup implementation completed locally after Task 12:

1. Removed the intentionally empty Owner Employee sales panel and response typing.
2. Added unit/rollback SQL coverage for username account creation, safe retry, password reset action behavior, role/shop restrictions, three statuses, checkout payloads, reporting periods, and immutable historical snapshots.
3. Removed obsolete Sales Register client helpers/tests while retaining database compatibility RPCs.
4. Updated README, production runbook, environment comments, account labels, and current tests to current business rules.
5. Article choices now load bounded pages of 50 and explicitly show progress/Load more instead of silently truncating.
6. XLSX parser preserves original worksheet row references after blank-row removal. Blank mapped gram-price footer rows are counted separately in preview/results. Malformed nonblank optional gram price warns and stores NULL with an explicit no-formula-price explanation.
7. Applied the forward migration so dashboard historical category and weight reporting uses immutable `sale_items.category_name` and `sale_items.weight_grams` snapshots.
8. Login was visually reviewed at 390×844, 768×1024 and 1440×900; responsive spacing/actions were strengthened in protected layouts and Administration source. Protected live visual/account acceptance remains externally blocked until safe authenticated access is provided.

Task 14 exposes nullable `gold_fineness` as Fineness after Metal across inventory UI and maps `Проба`/Fineness during XLSX import. Administration lists have no filters, account actions say Edit, and shop activation controls are hidden. Salesperson Dashboard and Sales no longer repeat their assigned shop/identity. Existing multi-item checkout remains authoritative and atomic; recent sales now return one sale row with item count and a category-count summary. Shared employee/shop reads are request-cached, and layout/Sales/salesperson Dashboard no longer fetch inventory category options unnecessarily.

Task 16 makes Inventory list filters URL-driven client transitions: dropdowns apply immediately, barcode/article/text fields debounce for 400 ms, pagination preserves filters, and only the existing table area shows a pending skeleton. Filtering/counting/pagination remain database-side. Protected navigation keeps Next.js `Link` prefetching and shows a small pending cue. Dashboard, Inventory, Administration, and Sales have route loading states. The current employee read now includes its assigned shop name so the protected layout no longer loads all active shops; Sales only loads shop options for Owners. Administration reads are request-cached and split by page so account/forms/home routes no longer fetch inventory rows or unrelated datasets. The shop administration count screen still reads accessible in-stock `shop_id` values because there is no grouped count endpoint; this is a remaining scale-sensitive round trip.

Task 13 implements permanent Owner-confirmed account/shop deletion, Auth-user cascade deletion, immutable sale/audit actor/shop labels, Unassigned current products/accounts, exact inventory field ordering, real XLSX mapping with `Ціна(грн)` ignored, and simplified Dashboard/Inventory/Sales/Administration UI. Do not call Task 13 fully live until Vercel deploys its commit and authenticated production acceptance confirms the destructive dialogs and representative responsive layouts. Recovery archive and controlled setup helper scripts are not app migrations.

## Navigation for future development

- src/app/(protected): dashboard, inventory, sales, admin pages.
- src/lib/inventory and import: queries, manual validation/actions, parsing/mapping/revalidation/batching.
- src/lib/sales: cart arithmetic, RPC payload, completion and history queries.
- src/lib/dashboard: report model and RPC wrapper.
- src/lib/admin: Owner authorization, account/shop actions and validation.
- src/lib/auth and src/lib/supabase: login, SSR sessions, proxy and server-only Admin client.
- src/lib/pricing: compatibility resolvers, retained rules code; no public management page.
- supabase/migrations: ordered authoritative schema evolution; supabase/tests: review fixture currency before use.

Keep this file current after meaningful milestones. Record actual completed work, test evidence and remaining limitations; never secrets or initial passwords. Preserve unrelated user changes and report proposed versus applied/deployed work accurately.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
