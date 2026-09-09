# Gold

Internal jewelry inventory and sales workspace for a family business in Ukraine. The UI is currently English.

## Scope

Task 1 provides the Next.js and authentication foundation. Task 2 adds the database and Row Level Security foundation. Tasks 3A–3C add inventory management and scanner lookup. Tasks 4A–4B add atomic sales and cashier/history UI. Task 5A adds configurable pricing-rule management and calculation without operational repricing. Returns, refunds, pricing integration, payments, receipts, analytics, registration, and hosting deployment are not included yet.

## Prerequisites

- Node.js 24 LTS or newer and npm.
- A Supabase project dedicated to this internal application.
- Git and access to this repository.

## Installation

```sh
git clone https://github.com/orkunoz/gold.git
cd gold
npm ci
```

Copy `.env.example` to `.env.local` and fill in both values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

Get the URL and public key from your Supabase project's Connect dialog or API settings. The requested `ANON_KEY` variable name is retained; it can contain the project's legacy anon key or its newer publishable key. Never use a service-role or secret key here. Both variables are intentionally public; `.env.local` is ignored by Git. Environment values are checked when creating a client, not during module import, so a build does not need live credentials. Restart the dev server after changing them. Configure them before building on a future hosting provider because Next.js bundles public variables at build time.

## Development

```sh
npm run dev
```

Open http://localhost:3000. Signed-out visitors are redirected to `/login`; signed-in visitors go to `/dashboard`.

## Supabase configuration

1. Enable the Email provider under Authentication > Sign In / Providers.
2. Disable **Allow new users to sign up** for this staff-only application. There is no public registration UI, but provider-level signup must also be disabled.
3. Under Authentication > Users, create the authorized staff accounts with email/password and confirmed email status. Give each person their own account. Invitation acceptance and password reset flows are outside Task 1.
4. Set Authentication > URL Configuration > Site URL to `http://localhost:3000` during local development. Update it to the actual HTTPS application URL when hosting is configured. This password-only sign-in flow does not need an OAuth callback route.
5. Keep anonymous sign-ins disabled. Task 2 database access also requires an active, linked `employees` row and is restricted by its role and assigned shop.

Supabase manages its own Auth storage. Application users are linked to Auth identities through `public.employees`. No direct PostgreSQL connection string is needed by the web application.

## Database setup

Task 2 migrations live in `supabase/migrations`; optional generic seed data lives in `supabase/seed.sql`. The schema uses one inventory row per physical jewelry piece. Barcodes are trimmed, non-empty, case-sensitive, and globally unique. Article numbers may repeat. Prices are stored values and are never calculated by this migration.

Install the Supabase CLI using its official installation instructions, authenticate it, and link this checkout to the existing Gold project. Do not commit database passwords, access tokens, service-role keys, or `.env.local`.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

After schema changes, regenerate the checked-in database types and review the diff:

```sh
supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

The generated `role` and `status` fields are narrowed to the documented TypeScript unions because PostgreSQL check constraints are not represented as enums by the generator.

For a fresh local Supabase stack, apply migrations and the seed with:

```sh
supabase start
supabase db reset
```

The optional seed creates a `Main Shop` with code `MAIN` and generic jewelry categories. It does not create Auth users or employees.

### Bootstrap the first owner

First create or identify the owner's confirmed account under **Authentication > Users**. Then run the following once in the Supabase SQL Editor, replacing only the placeholder UUID with that Auth user's UUID:

```sql
insert into public.shops (name, code)
values ('Main Shop', 'MAIN')
on conflict (code) do update set name = excluded.name
returning id;

insert into public.employees (auth_user_id, full_name, role, shop_id)
select
  'AUTH_USER_UUID'::uuid,
  'Owner',
  'owner',
  shop.id
from public.shops as shop
where shop.code = 'MAIN';
```

This privileged bootstrap is intentionally performed through the SQL Editor: before the first `employees` owner row exists, no application user is authorized to administer employee records. Additional employees can later be added by an owner-facing administrative workflow.

### Authorization model

- Owners can read and administer shops, employees, categories, and all inventory.
- Managers can read, create, and update inventory belonging to their assigned shop. Moving an item to another shop is rejected by RLS. Managers cannot administer shops, employees, or categories.
- Salespeople can read inventory for their assigned shop and their own employee record, but cannot write inventory or administrative records.
- Active managers and salespeople can read their assigned shop and active employees can read categories.
- Unauthenticated and inactive users have no application-table access.
- Only owners can delete inventory records. Normal business workflows must change status to `SOLD` or `REMOVED`, not delete rows.
- `SOLD` is protected history: ordinary authenticated inserts and updates cannot create, modify, or reverse a sold inventory row. Only the atomic `complete_sale` RPC may set it.

RLS helpers use hardened, schema-qualified functions to look up the current active employee without recursive policies. Authorization remains enforced in PostgreSQL; protected pages alone are not a data-access boundary.

After applying the migration, verify with separate owner, manager, and salesperson test accounts. Confirm that each role can perform only the operations above, that a manager cannot access another shop, and that anonymous API requests return no rows.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

The unit tests mock Supabase and cover authentication actions, route redirects, and cookie propagation. They do not replace a live Supabase integration check.

## Inventory workflow

Open `/inventory` to view accessible inventory in pages of 50, newest first. Filter by partial barcode, article number, category, status, free text, and—for owners—shop. The separate scanner field receives focus and performs exact barcode lookup on Enter.

Owners and managers see manual add/edit controls. Managers remain restricted to their assigned shop by both Server Action checks and PostgreSQL RLS. Salespeople have read-only inventory access. Duplicate barcodes and invalid or negative numeric values produce safe form errors. Normal removal is represented by the `REMOVED` status; the UI does not expose deletion.

Prices are displayed in UAH and remain manually entered stored values. Task 3A does not derive prices from weight or any other rule.

## Barcode scanner workflow

The Inventory page includes a prominent, automatically focused **Scan barcode** field for USB scanners that type a barcode and send Enter. Enter performs a case-sensitive exact barcode lookup through the authenticated Supabase session and existing RLS policies; the partial barcode filter remains separate. Surrounding whitespace is trimmed, and empty scans are ignored.

A match opens the complete product detail view without changing its inventory status. `SOLD` and `REMOVED` items display prominent warnings. A scanned result includes **Scan another item**, which returns directly to the focused scanner field. Missing scans display **Barcode not found** in place and reselect the field so staff can immediately scan again. Camera scanning and scan-history database tables are not included.

## Excel inventory import

Owners and managers can open **Import inventory** from `/inventory`. The guided flow is Upload → Sheet → Map → Preview → Results:

1. Upload a standard `.xlsx` file no larger than 5 MB.
2. Select a worksheet when the workbook contains multiple sheets.
3. Review and edit the detected header mapping. Barcode is the only required imported column.
4. Select the target shop. Managers are locked to their assigned shop; owners may choose any accessible active shop.
5. Validate and review every row before importing valid rows in batches of 100.

The importer recognizes common English and Ukrainian headers, including `Артикул`, `Штрихкод`, `Штрих-код`, `Код`, `Виріб`, `Проба`, `Колір`, `Вага`, `Розмір`, `Ціна`, `Ціна грн`, `Примітка`, and `Дата`. Mappings always remain editable.

Rows with missing or duplicate barcodes, existing database barcodes, malformed or negative numbers, invalid dates, or invalid shops are not imported. Unknown categories are imported without a category and shown as warnings; categories are never automatically created. Existing products are never overwritten. New items default to `IN_STOCK` and record the importing employee in `created_by`.

Workbook formulas are not calculated and macros are not executed. Uploaded data is parsed on the server and validated again immediately before insertion; the browser preview is not trusted. Only `.xlsx` is supported. Inventory results are paginated at 50 rows per page.

## Sales database and transaction

Task 4A adds permanent `sales` headers and `sale_items` price snapshots. Each physical inventory item can appear in `sale_items` only once. Foreign keys use restrictive deletion behavior, values have non-negative constraints, and authenticated clients receive read-only table grants governed by shop-scoped RLS. Owners may read all sales; managers and salespeople may read sales for their assigned shop. Ordinary clients cannot insert, update, or delete sales history.

Sales are created only through the authenticated `complete_sale(p_shop_id, p_items, p_notes)` RPC. Each JSON item contains exactly an `inventory_item_id` and final `sale_price`; the database resolves the active employee from `auth.uid()`, verifies role and active-shop access, rejects duplicate/missing/wrong-shop/non-`IN_STOCK` items, and locks inventory rows in deterministic UUID order. It generates the sale number, snapshots `selling_price` or fallback `owner_price`, calculates totals, inserts all history rows, and marks every item `SOLD` in one transaction. Any error rolls back the sale, line items, and all status changes.

Example typed RPC payload for future server-side UI work:

```ts
await supabase.rpc("complete_sale", {
  p_shop_id: shopId,
  p_items: [
    { inventory_item_id: inventoryItemId, sale_price: 3500 },
  ],
  p_notes: null,
})
```

Do not send employee IDs, sale numbers, list prices, totals, or target statuses; the database derives them. Task 4A intentionally includes no Sales page implementation, checkout, returns/refunds, discounts, formulas, payments, receipts, transfers, or analytics.

`supabase/tests/complete_sale.sql` is a rollback-only integration verification intended for a migration-capable connection with an existing active owner. It covers owner, manager, and salesperson success; one- and multi-item totals; historical list-price snapshots; status changes; requested validation failures; duplicate-sale protection; atomic rollback; and direct-write privilege restrictions. It restores the sale-number sequence and rolls back all test rows.

## Cashier checkout

Open `/sales` for the scanner-first checkout. The page shows the current employee and shop, a focused exact-barcode field, the client-only current cart, editable final prices, a client-side total, optional notes up to 5000 characters, and the completion control. Owners may choose among accessible active shops; managers and salespeople are locked to their assigned shop. Changing an owner’s shop clears the unfinished cart to avoid mixing stock.

USB scanners can type a barcode and send Enter. Only exact, RLS-accessible `IN_STOCK` products enter the cart. `SOLD`, `RESERVED`, and `REMOVED` items show specific warnings; duplicate scans do not duplicate a physical item. Each line shows product details, its database-resolved effective list price and source, an editable non-negative final price with two-decimal validation, and a remove action. Removing or editing a line changes only browser state and never writes a price back to inventory.

**Complete Sale** is disabled for an empty cart and guarded against double submission. The server sends only the shop, item IDs/final prices, and optional notes to `complete_sale`; it never inserts sales rows or marks inventory `SOLD` directly. The RPC remains authoritative for authorization, availability, price snapshots, totals, locking, and atomic writes. Failure keeps the cart and states that no partial sale was created. Success clears the cart and shows the generated sale number, time, item count, authoritative total, and links to begin again or view the read-only detail.

Recent RLS-accessible sales appear below checkout in pages of 25. `/sales/[id]` shows the immutable header, notes, totals, employee/shop, and item-level barcode/article/category/weight plus list and final price snapshots. There are no edit or delete actions. Task 4B does not add formulas, discounts, returns/refunds, payments, receipts, transfers, customers, analytics, camera scanning, or persistent draft carts.

## Pricing rules foundation

Owners have a **Pricing** navigation item and Owner-only `/pricing` management pages. Rules support `FIXED_AMOUNT` (owner price plus a configured UAH amount) and `PERCENTAGE` (owner price plus a configured percentage), with Global, Shop, Category, or Shop + Category scope. Resolution selects exactly one active/current rule in this order: Shop + Category, Shop, Category, Global; higher priority wins within a scope, followed deterministically by newest creation time and ID.

`calculate_selling_price(owner_price, shop_id, category_id)` performs PostgreSQL numeric arithmetic and rounds to two decimals. Null owner price returns null; no matching rule returns owner price unchanged. When a shop is supplied, the function requires the current employee to have access to that shop and requires the shop to exist and be active. Managers and salespeople therefore cannot probe another shop's pricing through the `SECURITY DEFINER` function. Rules can have optional start/end times and are retired with `is_active=false`, never deletion. Only Owners can read or mutate the rule table; active employees use the hardened calculation function without direct rule visibility. The original `created_by` attribution cannot be changed after insertion.

The create/edit form validates scope, values, priority, dates, and notes server-side and includes an informational price preview. There is no repricing trigger or mass inventory update.

Operational pricing uses one precedence everywhere: a non-null `inventory_items.selling_price` is a **manual override**, otherwise the current pricing rule is calculated dynamically, otherwise `owner_price` is the fallback. A blank manual override therefore enables automatic pricing. Inventory lists use one batched authenticated pricing RPC per page; item details and exact barcode checkout use the single-item helper. Inventory pages show the effective customer price and source, and item details also show the underlying calculated rule price. Excel imports preserve provided selling prices as manual overrides and keep blanks null.

Checkout defaults the editable final sale price to the effective price. If both manual and owner prices are null, checkout leaves the final price blank and requires the cashier to enter one. At completion, `complete_sale` recalculates the effective list price inside its existing atomic transaction after row locking, so `sale_items.list_price` reflects current rules at completion time rather than trusting the browser. Completed snapshots are never recalculated when rules later change.

With your Supabase configuration in place, verify:

- Visiting `/`, `/dashboard`, `/inventory`, or `/sales` while signed out redirects to `/login`.
- Invalid credentials show a generic error without revealing whether an account exists.
- Valid credentials redirect to `/dashboard`; reloading retains the session.
- Visiting `/login` while signed in redirects to `/dashboard`.
- Navigation opens each placeholder page, with the active page indicated.
- Sign out returns to `/login`; directly revisiting a protected URL requires authentication.
- An expired session refreshes when possible, or redirects to login when no longer valid.

## Architecture and files

- `src/app`: App Router, root layout, login, and `(protected)` route group. Pages are Server Components; protected pages are dynamically rendered.
- `src/lib/supabase/client.ts`: browser client factory using `@supabase/ssr`, ready for future Client Components.
- `src/lib/supabase/server.ts`: request-scoped server client using Next.js cookies.
- `src/lib/database.types.ts`: generated TypeScript representation of the public database schema, including sales tables and `complete_sale`.
- `supabase/migrations`: versioned PostgreSQL schema, constraints, indexes, triggers, and RLS policies.
- `supabase/seed.sql`: optional idempotent development seed for the first shop and generic categories.
- `src/proxy.ts` and `src/lib/supabase/proxy.ts`: refresh sessions, preserve updated cookies on redirects, and prevent caching of auth responses.
- `src/lib/auth/session.ts`: cached-per-request verified claims and reusable `requireUser` guard. Both layout and pages guard access; future server actions and data access must independently authorize requests.
- `src/lib/auth/actions.ts`: validated sign-in and current-session sign-out Server Actions. Passwords are never logged or returned to the client.
- `src/lib/inventory`: typed inventory queries, Server Actions, validation, formatting, and shared constants. All database calls use the current user's cookie-backed Supabase client.
- `src/lib/inventory/import`: server-side workbook parsing, header suggestions, row validation, duplicate checks, and bounded batching.
- `src/lib/sales`: client-state checkout rules, the sole sale-completion Server Action, and RLS-backed history/detail queries.
- `src/app/api/inventory/import`: authenticated parse, preview, and execution endpoints. They use the current employee's RLS-restricted Supabase session and never use a service-role key.
- `src/app/api/sales/lookup`: authenticated, exact, shop-scoped inventory lookup for checkout scanning; it performs no writes.
- `src/components`: login form, navigation, sign-out control, and shared placeholder view.
- `src/app/globals.css`: Tailwind CSS and small global accessibility defaults.
- Root configuration files: TypeScript strict mode, ESLint, Next.js, PostCSS, environment example, and dependency lockfile.

TypeScript 6 and ESLint 9 are pinned to the versions supported by the current Next.js ESLint plugins. ESLint 9 produces an upstream end-of-support notice; move to ESLint 10 when those plugins support it. Dependencies are pinned and locked for reproducible installation.

Authentication uses verified `getClaims()` rather than trusting `getSession()`. Claims validate the signed token; immediate server-side revocation checks are not performed on every page request. Supabase's JWT expiry and refresh settings govern session lifetime. Sign-out affects the current browser session.

## Reference guidance

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

GitHub stores the source. A live deployment and hosting configuration are separate work, outside this task.
