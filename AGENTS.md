# Gold — project handoff

## Start here

Read this file, README.md, package.json, and the existing source before changing anything. Preserve working functionality; do not reinitialize the application. This file preserves project context across computers and tasks; it is not a complete conversation transcript. Current user instructions take precedence.

## Product and stack

Gold is an internal jewelry inventory and sales web application for a family business in Ukraine. The UI is English for now. Stack: Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, and eventually PostgreSQL business tables. Repository: https://github.com/orkunoz/gold, default branch main.

## Completed as of 2026-09-08

Task 1 foundation was uploaded in commit 2bdc7c070fe68bd1145d5c2aca430ca6311c962c:
- Next.js application with strict TypeScript and pinned dependencies plus npm lockfile.
- Supabase browser/server clients and cookie-based session refresh.
- Email/password sign-in, current-session sign-out, and protected routes.
- /login and protected /dashboard, /inventory, /sales; navigation and placeholder pages.
- README with installation, environment setup, and manual Supabase configuration.
- Prior implementation session reported successful lint, typecheck, production build, and 14 unit tests. Live Supabase sign-in has NOT been verified.

No inventory functionality, sales functionality, roles, application database tables, migrations, or live hosting deployment exists in this milestone. GitHub upload is complete; it does not mean a live website exists.

## Scope and next work

The original Task 1 explicitly excluded database tables, inventory features, and sales features. Do not infer authorization to build the entire application from this handoff. Resume by inspecting the actual repository, checking setup and authentication, then agree the next milestone with the user. Schema and access-control design should precede business-data features.

Broader product discussions mentioned article numbers plus barcodes, barcode-first intake/lookup, gold fineness, gold color, weight, size, inventory, and sales. These are future requirements, not implemented features or a finalized schema. Pricing rules, employee permissions, and multi-shop behavior need specification before implementation.

## Architecture

See README.md for details. Server Components live under src/app. The (protected) route group and individual pages use authentication guards. src/lib/auth contains session verification and Server Actions. src/lib/supabase contains request-scoped clients and proxy/session refresh. src/proxy.ts connects the refresh logic. Future Server Actions and data operations need their own authorization; a protected layout alone is insufficient.

## Setup on another computer

Clone the repository and open the gold folder as the Codex project. Use Node.js 24 or newer and npm. Run npm ci. Copy .env.example to .env.local and configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the existing Supabase project. The user has reported creating a Supabase project; this repository does not include its credentials. Do not create a replacement project unnecessarily or commit .env.local, passwords, or service-role keys.

Follow README.md to configure staff-only email/password authentication and authorized test users. Run npm run lint, npm run typecheck, npm test, and npm run build. Use npm run dev for local testing. Verify login, session persistence, protected redirects, and logout against the real Supabase project once configured.

## Keep the handoff current

After meaningful milestones, update this file or linked project documentation with implemented behavior, decisions, checks performed, remaining work, and configuration needs. Distinguish proposed features from completed features and previous test results from checks performed in the current session.
