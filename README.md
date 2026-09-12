# Gold / Zlata Jewelry

Production inventory, checkout, reporting, and account administration for one Ukrainian family jewelry business with several physical shops. The interface is English, product data may be Ukrainian, prices are UAH, and weight is grams.

Read `AGENTS.md` before changing the system. It contains current business decisions and production-safety requirements.

## Current business rules

- Roles are `owner` and `salesperson` only. There is one active Owner and at most one active Salesperson per shop.
- Owner manages inventory, XLSX import, shops, and login accounts. Salespeople have read-only inventory and checkout access for their assigned active shop.
- Inventory represents individual physical items. Status is `IN_STOCK`, `SOLD`, or `REMOVED`; there is no reservation workflow.
- Categories come from product data and are resolved case-insensitively after whitespace normalization.
- Formula price (`weight_grams × price_per_gram`) is authoritative when available. Legacy selling price, pricing rules, and owner price remain compatibility fallbacks only.
- Checkout accepts a Discount %, never an arbitrary final-price input. PostgreSQL calculates the sale price.
- Sales is checkout-only. Historical products are found through Inventory status or linked sale details.
- Historical category, weight, list price, discount, sale price, and product details come from immutable `sale_items` snapshots.

## Stack

- Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4
- Node.js 24+
- Supabase Auth, PostgreSQL, RLS, and hardened RPCs
- Vercel production deployment from GitHub `main`

## Local setup

```sh
git clone https://github.com/orkunoz/gold.git
cd gold
npm ci
```

Create ignored `.env.local` from `.env.example`. Obtain values securely from the existing Vercel/Supabase projects; never commit or print secrets.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET
```

The service-role key is server-only and used only for protected Owner account creation and password reset.

```sh
npm run dev
```

## Authentication and accounts

Staff enter username/password. The server normalizes the username and authenticates the deterministic internal Supabase identity `username@internal.local`. `employees.auth_user_id` is the authoritative unique application link. Passwords exist only in Supabase Auth.

The Owner creates a shop Salesperson directly under Administration → Accounts and can reset a selected account password. Routine creation cannot create another Owner. Inactive or unlinked Auth sessions cannot access business data.

## Inventory and XLSX import

Inventory is database-paginated at 50 rows with partial filters and a separate exact case-sensitive barcode scanner. Owners can add/edit/import; Salespeople cannot mutate inventory.

The importer accepts standard `.xlsx` files up to 5 MiB and 5,000 data rows. It supports worksheet selection, editable Ukrainian/English column mapping, preview, and database batches of 100. Browser rows are revalidated before execution.

If Price per Gram is mapped, blank cells in that column are clearly counted as skipped summary/footer rows. Nonblank malformed optional values produce a warning, are stored as null, and make formula price unavailable. Preview references retain the original worksheet row numbers even after blank rows are ignored.

New categories are accepted. Unknown shops are errors; `SOLD` can only be produced by checkout. Blank barcodes remain null, while non-null barcodes are globally unique.

## Checkout

Exact barcode lookup is attempted first, followed by exact article lookup. Repeated articles show physical-item choices in bounded pages of 50 with an explicit Load more action.

The cart is browser state. The client sends only inventory item IDs and discount percentages. `complete_sale` authenticates the employee, validates shop access, locks rows, resolves current authoritative prices, calculates discounted prices, snapshots the sale, and marks inventory `SOLD` atomically.

## Dashboard

Periods are Today, Last 7 days, This month, and Last 30 days using `Europe/Kyiv` boundaries. Owner can report across all/one active shop and sees current inventory valuation, status, trend, category, and shop reports. Salespeople see only revenue, items sold, gold weight sold, and recent sales for their assigned shop.

Historical metrics use `sale_items` snapshots, so later inventory changes cannot change past category or sold-weight reporting.

## Database changes

Migrations in `supabase/migrations` are ordered and immutable after application. Link the Supabase CLI to the existing project and use forward migrations only:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list --linked
supabase db push --dry-run --linked
supabase db lint --linked --level error
```

Never run a hosted reset, production seed, historical cleanup, or already-applied migration replay. SQL files under `supabase/tests` are rollback-only current-rule integration checks and require a suitably privileged linked database connection.

## Validation

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

See `PRODUCTION.md` for release and acceptance procedures.
