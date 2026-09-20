# Gold / Zlata Jewelry — persistent development handoff

Last reviewed: 2026-09-12. This file describes the current implementation, not a roadmap from earlier milestones. Read it before changing code. Task 12 shipped in `555725a`; the subsequent cleanup milestone is documented below. Use `git log -1` for the current repository commit. No conversation memory or files outside this repository are required to understand the system.

## Project and deployment

- Gold jewelry-store management SaaS/web application for a Ukraine family jewelry business. Current deployment serves one business with several physical shops; it is not a generalized multi-tenant SaaS yet.
- UI brand: Zlata Jewelry. Ukrainian-default, English-selectable operational UI; Ukrainian/Unicode product data; UAH currency; grams for weight.
- Localization uses the lightweight in-repository dictionaries `locales/ua.json` and `locales/en.json` (never `uk.json`). `src/lib/i18n` provides shared lookup, interpolation, count-based `Intl.PluralRules` dictionary forms (one/few/many/other), and English missing-key fallback; server components read the `zlata-language` cookie through `getTranslations`, while client components use `I18nProvider`/`useI18n`. Ukrainian (`ua`, HTML language `uk`) is the first-visit default; the UA | EN controls on Login and authenticated navigation persist the preference in a one-year, site-wide SameSite=Lax cookie. Keep UI wording in the dictionaries and use translation keys in components rather than language conditionals.
- Dates and UAH displays use the selected locale while reporting boundaries remain Europe/Kyiv. Business data (shop/category/producer names, usernames, articles, barcodes, notes and free-text history values) is never translated. Known history field/source labels and status codes are translated only for display. PostgreSQL text, browser inputs, search and the XLSX parser preserve Ukrainian Unicode; only usernames and technical identifiers retain their existing restricted validation.
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
| metal | Nullable open text; arbitrary user/import values are allowed |
| producer, size | Nullable open text; arbitrary producer values are allowed and size supports nonnumeric source values |
| gold_fineness | Nullable jewelry fineness, exposed as Fineness; XLSX header `Проба` |
| gold_color | Nullable legacy/manual product attribute retained |
| weight_grams | Nullable nonnegative numeric weight |
| price_per_gram | Nullable nonnegative numeric(14,2) |
| price | Nullable numeric(14,2), database trigger calculates round(weight_grams × price_per_gram, 2); NULL if either input is NULL |
| owner_price, selling_price | Nullable nonnegative legacy pricing compatibility inputs |
| discount | Nullable source/import text; informational, not checkout discount_percent |
| received_at, notes | Nullable received timestamp and notes |

The list columns are exactly Nr, Product Category, Producer, Metal, Fineness, Size, Weight, Price per Gram, Article, Price (UAH), Notes, Status, Shop, Barcode. Database pagination is 50 items/page, newest first; row numbers continue across pages and the filtered result count is in the table footer. Filters include partial barcode/article, category, IN_STOCK/SOLD status and Owner shop; the general text Search filter is removed. Metal remains a field/column but is not a list filter; REMOVED remains operational but is not a selectable list filter. Inventory has no separate scanner panel; Sales checkout retains scanning. Salespeople cannot add/edit/import.

Manual add/edit allows an existing category or new category text directly; blank category is NULL. Add Product does not expose a Status field and creates products as IN_STOCK by default; Edit Product retains the status control for mutable products. Category resolution normalizes surrounding/repeated whitespace, matches case-insensitively, preserves spelling of the existing category, and safely handles concurrent creation. `Браслет` and `Браслет оф` are distinct.

Metal and Producer are open text fields in manual add/edit and XLSX import. Trim surrounding whitespace, store blank as NULL, preserve Unicode text exactly, and never reject or warn merely because a value is new. Both fields participate in Inventory text search and display without translation. Existing Gold/Silver values remain ordinary unchanged inventory values; new values require no separate setup.

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
- Every nonempty mapped Metal and Producer value is valid open text. Trim surrounding whitespace, preserve the remaining Unicode text exactly, and store blank as NULL. Never normalize these fields to a whitelist or emit Unknown Metal/Producer warnings.
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
- Current checkout does not display or submit Sale Notes. Payload to `complete_sale(p_shop_id, p_items, p_notes)` contains only inventory_item_id and discount_percent per item and leaves the compatibility notes parameter unset. Extra fields, including sale_price, are rejected. Missing discount defaults to 0 in SQL; 1–100 unique item UUIDs per sale. Historical sale notes remain stored and visible.
- Database authenticates active employee, validates active shop and salesperson assignment, locks item rows in UUID order with FOR UPDATE, checks all exist/belong to shop/are IN_STOCK, resolves authoritative current list price under lock, validates discounts, and calculates amounts itself.
- Atomically creates sales header, inserts sale_items snapshots, totals header, records SALE audit context and marks all items SOLD. Any failure rolls back. Unique sale_items.inventory_item_id plus row locks prevent double sale. Browser never supplies employee attribution or authoritative price.
- SOLD products are immutable for every role, including Owner. Product Detail and history remain viewable, but the UI exposes no edit/delete controls, the direct edit route redirects to Product Detail, server actions reject the mutation, and a database trigger rejects every UPDATE or DELETE after the item reaches SOLD. The checkout transition from IN_STOCK to SOLD remains allowed.
- Snapshots: list_price, discount_percent, sale_price, category_name, producer, size, article_number, weight_grams, price_per_gram, metal, barcode, notes. Sales stores employee/shop, sale number/date, total_list_price/total_sale_price and notes. Sale sequence may have gaps after rollback; do not reset it.
- Application grants deny direct sale mutation; ordinary inventory writes cannot create/reverse/change SOLD rows. Keep historical employee/shop references and snapshots intact.
- Confirmation includes sale identifier, date, count, total and link to read-only `/sales/[id]`. Dashboard recent-sales links still work. Historical register RPCs/query files remain, but shared Sales page does not render them.

## Dashboard

`get_dashboard_report(period, shop, start_date, end_date)` is a hardened aggregate RPC; the two-argument preset wrapper remains for compatibility. Periods: TODAY, LAST_7_DAYS, THIS_MONTH (default), LAST_30_DAYS, CUSTOM. Custom reporting accepts a single date or an inclusive start/end range. Date boundaries use Europe/Kyiv, including DST; the database converts the inclusive end date to exclusive next local midnight. Current stock metrics are independent of reporting period.

- Owner: All shops/one active shop selector; Revenue, Items sold, Gold weight sold; in-stock count/weight and Inventory value with missing-price count; daily revenue and physical-items-sold chart, category performance, shop performance for All shops, period-scoped recent sales.
- Salesperson: only assigned active shop; selectable preset/custom reporting period; Revenue, Items sold, Gold weight sold and period-scoped recent sales for that shop. No other-shop selector, inventory valuation, category/employee comparisons or cross-shop report. RPC rejects another shop ID even if UI is bypassed.
- Sales count and Average Sale KPI cards removed. Customer Value UI is labeled Inventory value; internal JSON key remains customer_value for compatibility.
- Shop revenue, category, and sold-weight reporting use immutable sale/sale-item snapshots rather than mutable inventory rows.
- Dashboard date inputs render only for Custom Range. The sales-over-time chart uses responsive capped-width bars and a point-local hover/focus/tap tooltip; it has no permanent summary panel.
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

Critical constraints: role/status CHECKs, nonnegative amounts, open-text metal/producer values, global non-null barcode uniqueness, unique normalized category names, normalized unique usernames, unique Auth linkage, active-Owner/salesperson partial indexes, required active shop validation, sale-number uniqueness, unique sold physical item, restrictive historical FKs. Removing status was a CHECK replacement, not enum surgery.

### Applied migrations

All migrations through `20260912235000_dynamic_inventory_metal.sql` matched hosted production after this hotfix. The Task 13 migrations add deletion-safe historical snapshots/unassigned semantics and retain the validation RPC signature without lint warnings. Never edit an already applied migration.

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
| 20260912230000 | Task 15 permanent product deletion and bulk inventory moves |
| 20260912233000 | Task 17 custom dashboard ranges, daily physical-item totals and simplified status summary |
| 20260912234000 | Task 19 database-enforced SOLD product immutability |
| 20260912235000 | Open-text inventory Metal and Producer values |

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

Localization completion: import API messages use the selected cookie locale; parsing/validation helpers accept a locale and retain English defaults for non-UI callers. Sale Detail, Product History, Inventory counts/selection and checkout are dictionary-backed. Dashboard distinguishes sold gold weight from current in-stock gold weight; Recent Sales links from the sale number. `20260913120000_unlimited_sale_notes.sql` removes only the database notes length guard and was applied to the linked production database on September 13, 2026.

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

Task 16 makes Inventory list filters URL-driven client transitions: dropdowns apply immediately, barcode/article/text fields debounce for 400 ms, pagination preserves filters, and only the existing table area shows a pending skeleton. Filtering/counting/pagination remain database-side. Protected navigation keeps Next.js `Link` prefetching and shows a small pending cue. Dashboard, Inventory, Administration, and Sales have route loading states. The current employee read now includes its assigned shop name so the protected layout no longer loads all active shops; Sales only loads shop options for Owners. Administration reads are request-cached and split by page so account/forms/home routes no longer fetch inventory rows or unrelated datasets.

Reliability follow-up (September 14): protected claims and current-employee reads remain request-scoped through React `cache`; the shared layout relies on the cached employee authorization result instead of making a second explicit `requireUser` call. Read-only Supabase operations use one bounded retry only for recognized transient transport/server failures and log sanitized operation/code/status diagnostics. Dashboard report and Owner profit reads run in parallel; profit and shop-option failures fall back without discarding the core report. Inventory category/location option failures fall back independently without discarding the paginated inventory result. Administration shop counts now use the Owner-authorized grouped `get_admin_shop_counts()` RPC instead of downloading employee and inventory row IDs. Trigram indexes support the existing contains filters for barcode/article, and a newest-first index supports inventory pagination.

Inventory mutation latency follow-up (September 14): Inventory Server Actions log safe correlated phase timings (`operation`, `phase`, `duration_ms`, `correlation_id`) for authorization, category/database RPC work (including transactional triggers/audit), revalidation policy, and total action time. Bulk actions return before the single client-side Inventory refresh; they do not also call `revalidatePath`. Add/edit/permanent-delete redirects read uncached Supabase data and no longer invalidate Inventory or Dashboard inside the action. Edit relies on the existing database/RLS/SOLD protections during the update and no longer performs a redundant status pre-read. The import Route Handler retains only targeted `/inventory` invalidation, which is deferred by Route Handler semantics.

Inventory defaults/sorting follow-up (September 14): opening Inventory without a `status` query defaults to `IN_STOCK`; explicit `status=ALL` and `status=SOLD` remain URL-backed. Sortable headers use database ordering before the existing 50-row range, persist `sort`/`direction` through filters and pagination, and default to Number ascending. Purchase Price remains Owner-only in both rendering and sort authorization. Stored location records stay unchanged; display helpers render Warehouse/Kamin/Horokhiv/Novovolynsk/Volodymyr as Склад/Камінь/Горохів/Нововолинськ/Володимир in UA while retaining the stored English names in EN across operational location displays, selectors, history, transfers, and transfer PDFs.

Dashboard/Administration localization follow-up (September 14): Shop Performance, Recent Sales, and Administration → Shops also pass stored location names through the display-only locale mapping. Dashboard Recent Sales no longer shows the Accounts/employee column; sale attribution remains stored and available on Sale Detail.

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

## Warehouse and transfer workflow (Task 20)

- `shops` remains the location table. `location_type` is `SHOP` or `WAREHOUSE`; the single active Warehouse holds stock but is excluded from checkout, salesperson assignment, shop selectors, and Shop Performance. Locations have an editable nullable address.
- Owner XLSX imports always land in the active Warehouse. The browser has no target selector, spreadsheet Shop/Status/Metal values are not authoritative, and the database rejects import when Warehouse is missing/inactive. Salespeople remain blocked at page, API, and RPC layers.
- Owner bulk moves are one-step atomic internal transfers of 1–50 same-source IN_STOCK/REMOVED physical items. Each move creates immutable `transfers`/`transfer_items` snapshots and a UA-default printable “Накладна переміщення”; history can regenerate it.
- Only `complete_sale` may transition a product to SOLD. Manual status controls omit SOLD, direct mutations are database-blocked, and existing SOLD rows remain immutable.
- Owner bulk price-per-gram changes and permanent deletes are atomic, current-page, 1–50 item operations. SOLD/ineligible selection rejects the whole request. Formula price/history triggers remain authoritative; deletion retains Task 15 footprint semantics.
- Metal database columns remain as unused legacy nullable compatibility columns to avoid disproportionate forward-migration risk. Current UI, search, import, checkout/sale presentation, reporting, and new transfer snapshots do not use Metal.
- Current product workflows also leave legacy `gold_fineness`, `notes`, `discount`, and received-date columns nullable and unused; checkout `discount_percent`, sale notes, and `sales.sold_at` remain authoritative and visible where appropriate.
- `inventory_items.purchase_price` is the Owner-only per-item acquisition total. Checkout snapshots it to `sale_items.purchase_price_snapshot`; historical Net Profit uses the snapshot and reports a missing-cost item count. Transfer snapshots may include purchase price because transfer history and PDF access are Owner-only.
- Transfer Note HTML is the canonical document design. The Owner-authorized Node download route renders that same shared React markup in headless Chromium with print backgrounds and returns a private A4 PDF named from the full transfer number. Browser printing hides all application chrome and repeats table headings across pages. PDF generation remains independent from transfer creation and continues to use immutable snapshots. The bulk transfer RPC locks the selection, creates snapshots, updates every inventory location, verifies the row result, and rolls the entire transaction back on failure.

## Created Date and rapid manual entry (September 15)

- Inventory Created Date is the existing immutable, database-generated `inventory_items.created_at` timestamp. It is displayed in Europe/Kyiv, is never client-controlled or editable, and its single-date Inventory filter converts the selected Kyiv calendar date to an inclusive UTC start and exclusive UTC end before querying. Created Date sorting is database-side before pagination and persists in the URL.
- Owner Add Product uses a client-side draft basket styled as temporary Inventory rows. Add to Basket performs no database write; drafts accumulate, support keyboard-accessible inline editing/removal, recalculate formula Price locally, and stay on the page after errors or completion. Useful category/producer/gram-price/location defaults remain between entries; new drafts default to the active Warehouse, Owner may select another active location, and products use the IN_STOCK default.
- Final Add Products performs one Server Action and one hardened `create_inventory_items_batch(jsonb)` RPC for 1–100 products. The RPC reauthorizes Owner access, validates each active location, resolves categories, checks barcode conflicts and required business fields, and inserts the whole batch in one transaction; any row failure rolls back every row. The action performs only required validation/database work, does not revalidate unrelated routes, redirect, or call `router.refresh`, and returns promptly with row-scoped errors or a success count.
- Product Category, Producer, and Size are Unicode-safe creatable lookups populated once per Add Product page load from existing accessible product data; they are never hardcoded and do not query per keystroke. Category, Producer, positive Weight, and positive Price per Gram are required in both draft UX and the atomic database RPC. Owner may select any active location, with the active Warehouse selected initially.
- Add Product barcode entry is always text and trims only surrounding whitespace, preserving leading zeroes. HID scanner Enter is consumed by the barcode field. Camera access begins only from the localized Scan button; the modal supports camera switching, native `BarcodeDetector` retail formats with ZXing fallback, localized failures, and stops every media track on success, close, cancellation, or unmount.
- The shared `CameraBarcodeScanner` control is used by Add Product, Inventory Barcode filtering, and Sales checkout; detection feeds each screen's existing input/filter/lookup path. Keep the response header restricted to `Permissions-Policy: camera=(self), microphone=(), geolocation=()` and never disable same-origin camera access or broaden it to `camera=*`.
- Manual Add Product draft baskets are locally persisted and must never be cleared until successful atomic database confirmation or explicit Owner Clear List confirmation.

## Documents workspace and Added Products receipts (September 19)

- Owner navigation uses `/documents` as the common Documents workspace. Its URL-backed controls show either Transfer History or Added Products without rendering both tables. Existing transfer details, immutable snapshots, and Transfer Note PDFs remain available through their established routes and architecture.
- Every successful final manual Add Products submission creates exactly one immutable `added_product_documents` header and matching `added_product_document_items` snapshots in the same `create_inventory_items_batch(jsonb)` transaction as the inventory rows. The RPC returns both the created product count and document ID. Failed validation or insertion rolls back products, header, and all lines together; merely adding a local draft creates no document.
- Added Products snapshots contain the creation-time category, article, producer, size, weight, purchase price, price per gram, calculated price, status, location, barcode, and database product timestamp. Historical receipt views/PDFs read only these snapshots, never mutable inventory rows. Receipt tables are Owner-readable only and do not expose purchase costs to Salespeople.
- Added Products detail and PDF reuse the Transfer Note canonical styling/rendering family, with UA/EN labels, Europe/Kyiv timestamps, Zlata branding, repeated print headers, totals, and immutable document-number filenames.
- After confirmed atomic success, Add Product remains on the page, retains the returned document ID for its immediate Download PDF action, and only then clears the visible and locally persisted basket. Any failure or missing document ID preserves both copies of the basket.
- Purchase Price is confidential Owner information rendered only in Inventory/Product Details. Documents can be physically handed to salespeople: Added Products and Transfer histories, HTML, PDFs, totals, and document-facing query responses must never expose purchase cost, even though immutable database snapshots may retain it for integrity and internal accounting.
- Documents and their HTML/PDF routes are Owner-only in navigation, server authorization, RLS, and grants. Goods Receipts show exactly Nr, Product Category, Article, Producer, Size, Weight, Price per Gram, Price (UAH), Shop / Location, and Barcode; they omit Status and per-product Created Date because the batch header is authoritative.
- Document creator labels use the immutable username/account identifier rather than a role or mutable display name. Shared document metadata uses localized Created Date and Document Nr / № документа labels; download actions are native file links in both UA and EN.
- Goods Receipt barcodes are protected identification data: reserve sufficient printable width, never clip or truncate them, and allow exceptionally long values to wrap within the same logical product row. Empty optional Transfer Note addresses render nothing rather than a placeholder dash.

## ZLATA UI V2 Phase 1 (September 20)

- The protected application shell uses compact horizontal navigation with the authenticated username/account popover, UA/EN control, explicit Light/Dark toggle, and a separate polished Sell CTA. Light is the default when no `zlata-theme` local preference exists; OS color scheme is intentionally ignored.
- Checkout moved from `/sales` to `/sell` without changing checkout logic, RPC payloads, shop restrictions, or sale atomicity. `/sales` is completed-sales history, while existing immutable sale details remain at `/sales/[id]`.
- Completed Sales history uses direct RLS-protected `sales`/`sale_items` reads, forces salesperson shop scope in server code, excludes Warehouse from Owner filter options, and shows Sale ID, date, shop, salesperson, item count, weight, and total.
- Dashboard uses one URL-backed period/shop source of truth. Presets are Today, Last 7 Days, Last 30 Days, This Month, Last Month, All Time, and Custom Range. Custom dates are inclusive Europe/Kyiv calendar dates with an exclusive next-local-midnight query boundary; future custom dates are rejected.
- Owner Dashboard consolidates Revenue, aggregate Net Profit, Items Sold, Weight Sold, item-count sales activity, current Inventory summary, selling-shop performance with aggregate revenue sparklines, category performance, and compact period/shop-scoped Recent Sales. Inventory remains a current all-active-location snapshot including Warehouse and does not follow period or selected selling shop.
- Migration `20260920120000_ui_v2_reporting.sql` replaces only the existing reporting functions, preserves both dashboard RPC signatures and grants, adds Last Month/All Time and adaptive day/month buckets, enforces selling-shop authorization, excludes Warehouse from Shop Performance, and returns aggregate profit only. It was applied to linked production; migration history matched and linked database lint returned no errors.
- Phase 1 validation: clean lint, typecheck, 292 tests across 52 files, and successful webpack production build. No new npm dependency was added.

## ZLATA UI V2.1 Light refinement (September 20)

- Light mode now uses self-hosted `next/font` Manrope for functional UI and DM Serif Display for editorial page titles, with Cyrillic-capable functional typography and graceful serif fallback for Ukrainian display text. Semantic tokens provide cleaner ivory, near-white, charcoal, muted, gold, success, danger, border, focus, and selection roles while preserving the existing dark-theme mechanism.
- Shared `PageHeading`, `Button`, accessible info-tooltip, table classes, metric count-up, and route-skeleton patterns unify Dashboard, Inventory, Sell, Sales, Documents, and Administration without changing their workflows or permissions. Header/account styling includes a truthful avatar trigger; Sell remains the sole premium gold action.
- Dashboard filters remain the single URL-backed global reporting source but now live in the Statistics header. Inventory remains an all-active-location current snapshot. Revenue, Net Profit, and inventory value receive reduced-motion-aware count-up presentation; chart bars have a one-time restrained entrance.
- Shop Performance moved its current-stock explanation into a keyboard-accessible tooltip. The prior invisible Kamin trend was a one-point SVG rendering issue, not an authorization or reporting-calculation defect: the Phase 1 RPC returns active shop buckets, and a single SVG polyline point has no visible segment. V2.1 renders a meaningful dot for one nonzero point, a sparkline for multiple points, and an em dash for empty/zero data; no RPC, migration, or production data changed.
- Dashboard summary, Inventory operational, Sell cart, Sales history, Documents, and Administration lists now share typography, separators, hover/selection behavior, numeric alignment, overflow behavior, and compact/dense variants. Inventory bulk actions use the shared semantic control variants; transient bulk success uses a toast-style status while serious errors remain alerts and destructive confirmation remains a dialog.
- V2.1 validation: browser-rendered Light review at mobile and desktop breakpoints; clean lint and typecheck; 296 tests across 53 files; successful webpack production build. No npm dependency, migration, RPC, or business-data change was added.

## ZLATA UI V2.1.1 dashboard and table polish (September 20)

- Shared semantic table alignment now keeps quantitative and monetary headers on the same right edge as their tabular-numeral values across Dashboard, Inventory, Sales, Documents, document detail, checkout/import/draft tables, and printable transfer/added-product tables; identifiers and dates retain their prior semantic alignment.
- Dashboard filtered KPI reporting still uses the existing Kyiv-aware reporting RPC inputs. The apparent stale Revenue/Net Profit defect was in the count-up presentation state when a new server value was zero, not in the RPCs; the shared primitive now renders every changed target immediately and animates nonzero targets. Items Sold and Weight Sold reuse that same reduced-motion-aware 650 ms primitive.
- Sales Activity tooltips use visible chart/card overflow plus near-edge anchoring, preserving the current bar animation while keeping first, last, and near-boundary tooltips inside the chart width. Shop Performance is ordered Shop, Items Sold, Weight Sold, Revenue, In-stock Weight, Trend.
- Owner Inventory by Location combines active RLS-visible location records with the existing Owner-only grouped `get_admin_shop_counts()` aggregate. It includes Warehouse, excludes inactive locations, uses only current IN_STOCK counts, performs no row download or per-location query, and is independent of Dashboard shop/period filters. No migration or RPC change was needed.
- V2.1.1 validation: clean lint and typecheck; 302 tests across 55 files; successful webpack production build. Protected desktop/mobile browser acceptance was blocked in this checkout because local Supabase public environment variables are not configured; the browser showed the expected environment error before any authenticated screen rendered. No production data, migration, RPC, dependency, push, or deployment change was made.

## ZLATA V2.1.1 production acceptance follow-up (September 20)

- The shared Statistics count-up now begins at raw numeric zero for every presentation, interpolates only from the numeric server target, cancels stale animation frames, and uses one fixed 650 ms duration for Revenue, Net Profit, Items Sold, and Weight Sold. Reporting-input keys remount all four metrics together for every newly presented filter result, including an unchanged numeric result. Reduced motion resolves directly to the exact target.
- The prior Weight Sold artifact was presentation state/formatting, not a reporting or unit-conversion defect: the primitive initially held the final/previous display value and formatted eased integer-weight frames with up to three locale decimals, so a value near 25 could appear as `24,999` in Ukrainian formatting. Integer raw weight targets now render integer animation frames while fractional targets retain up to three decimals; no formatted string is parsed and raw `25` is never scaled.
- Inventory by Location remains the same current all-active-location IN_STOCK distribution, independent of Dashboard filters. Selling locations are sorted by current count descending with localized-name tie ordering. Warehouse is always last and uses restrained neutral text/progress styling. The former two-column cards and denominator copy were replaced with compact single-column rows showing name, percentage, thin progress, and item count.
- Follow-up validation: clean lint and typecheck; 307 tests across 57 files; successful webpack production build; isolated Light-mode acceptance review at 1440×900 and 390×844 confirmed aligned labels, no horizontal overflow, compact rows, gold selling-location bars, neutral Warehouse treatment, and exact final Statistics values. No migration, RPC, dependency, production-data, push, or deployment change was made.

## ZLATA V2.2 dark visual system (September 20)

- Dark Mode now resolves the established Stone and Amber utility palette through runtime semantic variables instead of compile-time literal colors. This fixes the prior dark-on-dark labels, Light card/control remnants, bright separators, and inconsistent table/header states without changing the approved Light values or component structure.
- Shared dark styling covers page/surface elevation, header logo treatment, controls and placeholders, disabled states, buttons, status/feedback colors, tables and selected rows, charts, progress bars, loading skeletons, popovers, dialogs, and tooltips. The Sell action remains the restrained premium gold treatment, while Warehouse remains neutral.
- Transfer Notes and Goods Receipts remain explicitly Light in app previews, browser print, and generated PDF HTML. Theme initialization and `zlata-theme` persistence remain exactly Light/Dark with Light as the default and no System mode.
- V2.2 validation: clean lint and typecheck; 311 tests across 58 files; successful webpack production build; representative Light/Dark acceptance at 1440×900 and 390×844 confirmed readable hierarchy, dark-compatible overlays and controls, preserved printable documents, and no page-level mobile overflow. No migration, RPC, dependency, production-data, push, or deployment change was made.

## ZLATA V2.3 dashboard and document polish (September 20)

- The Owner Dashboard now follows the approved compact editorial composition: a 1.85:1 Statistics/Inventory top row, four balanced KPI tiles, a chart that flexes to the remaining card height, full-width Shop Performance, and balanced lower comparison cards. Recent Sales has no subtitle, Dashboard-only tables use tighter density, and reporting/filter semantics remain unchanged.
- Inventory remains a current all-location snapshot independent of reporting filters. Selling locations retain count-descending/localized-name ordering in a responsive two-column grid, with Warehouse always last, full-width, and neutral.
- Desktop header order is Logo, page navigation, flexible space, Sell, Language, Theme, Account. Narrow layouts keep the utility cluster usable and make the page navigation horizontally scrollable without a visible scrollbar; the avatar-only account trigger retains its accessible username label.
- Shared account/calendar popover surfaces use restrained 140–160 ms open/close motion and inherit the global reduced-motion override. The skip link is off-screen until keyboard focus. The Shop Performance info tooltip is portaled to viewport coordinates so table/card overflow cannot clip it.
- Transfer Note and Goods Receipt canonical HTML/PDF markup now uses approximately 13 px headers, 12 px row text, 13 px summaries, content-driven location height, and compact spacing. A4 rendering preserves complete wrapping barcodes, readable Ukrainian headers, Light document styling, and existing confidentiality rules.
- V2.3 validation: clean lint and typecheck; 316 tests across 59 files; successful webpack production build; representative Light/Dark browser review at 1440×900 and 390×844; tooltip, account popover, skip-link behavior, and responsive header review; and rendered A4 visual inspection for both canonical PDFs.
- No migration, RPC, dependency, permission, reporting-semantic, business-data, push, or deployment change was added.

## ZLATA V2.4 responsive shell and detail refinement (September 21)

- Header and protected main content now use the same `zl-app-container` width/gutters; the skip link and its dedicated styles were removed. Dashboard removed the Shop Performance View All action and Inventory Current badge, while Sale IDs stay on one line inside horizontally scrollable tables.
- Shared custom popovers now remain mounted through a real 160 ms open/close transition with reduced-motion coverage. The current-stock tooltip remains portaled and uses a top-level stacking layer.
- Sale Detail is centered by the shared shell, removes Notes, normalizes negative zero, adds compact SOLD semantics, balances the summary/final total, and displays category, article, producer, size, weight, barcode, list price, discount, sale price, and SOLD from immutable `sale_items` snapshots. Purchase price is not selected or rendered.
- Documents history uses linked Transfer/Document identifiers, Created By immediately after Created Date, and PDF-only actions. Transfer terminology is localized as Transfer Nr / № переміщення.
- Transfer Note and Goods Receipt use content-aware column widths, safe wrapping, protected barcodes, and table-only font reduction for unusually long combinations. Long-value A4 fixtures were rendered as one page each and visually checked with no overlap or clipping.
- V2.4 validation: clean lint and typecheck; 321 tests across 60 files; successful webpack production build; single-page A4 visual review for both long-value document families. Protected Light/Dark browser acceptance could not be performed because this checkout has no Supabase public environment configuration and production opened at login.
- No migration, RPC, dependency, permission, reporting-semantic, production-data, push, or deployment change was added.

## ZLATA V2.4 production acceptance follow-up (September 21)

- Sell barcode and exact-article lookup now restrict database results and candidate counts to the existing authoritative sellable state, `IN_STOCK`, while preserving shop/role scope. The cart independently rejects every non-`IN_STOCK` item, and the unchanged `complete_sale` transaction still locks rows and rechecks shop plus `IN_STOCK` status before any sale mutation.
- Dashboard Recent Sales presents at most the newest five records from the existing period/shop-filtered report. The existing Sales link remains, and a pointer-transparent Light/Dark semantic fade appears only when the report contains more than five matches.
- Transfer Notes and Goods Receipts use document-specific EN/UA currency-bearing headers and locale-formatted numeric-only price cells. Explicit semantic colgroups prioritize narrow number/size/weight fields, flexible word-wrapped category/producer fields, protected one-line numeric prices, safe article wrapping, and complete barcode preservation.
- Focused long-value A4 fixtures for Transfer Note and Goods Receipt were rendered in EN and UA as one page each and visually inspected with no overlap, clipping, lost barcode digits, character-by-character headers, or unreadable prices. No migration, RPC, dependency, permission, reporting-semantic, snapshot, production-data, push, or deployment change was needed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
