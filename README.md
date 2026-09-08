# Gold

Internal jewelry inventory and sales workspace for a family business in Ukraine. The UI is currently English.

## Scope

Task 1 only: Next.js foundation, email/password sign-in and sign-out, protected navigation, and placeholder Dashboard, Inventory, and Sales pages. No inventory or sales functionality, database tables, migrations, registration, or hosting deployment is included.

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
5. Keep anonymous sign-ins disabled. All authenticated users in this dedicated project have access to the placeholder workspace; role-based permissions are not implemented yet.

Supabase manages its own Auth storage. Do not create application database tables for this task. PostgreSQL business tables and row-level security policies must be designed before future data features are added. No direct PostgreSQL connection string is needed now.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

The unit tests mock Supabase and cover authentication actions, route redirects, and cookie propagation. They do not replace a live Supabase integration check.

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
- `src/proxy.ts` and `src/lib/supabase/proxy.ts`: refresh sessions, preserve updated cookies on redirects, and prevent caching of auth responses.
- `src/lib/auth/session.ts`: cached-per-request verified claims and reusable `requireUser` guard. Both layout and pages guard access; future server actions and data access must independently authorize requests.
- `src/lib/auth/actions.ts`: validated sign-in and current-session sign-out Server Actions. Passwords are never logged or returned to the client.
- `src/components`: login form, navigation, sign-out control, and shared placeholder view.
- `src/app/globals.css`: Tailwind CSS and small global accessibility defaults.
- Root configuration files: TypeScript strict mode, ESLint, Next.js, PostCSS, environment example, and dependency lockfile.

TypeScript 6 and ESLint 9 are pinned to the versions supported by the current Next.js ESLint plugins. ESLint 9 produces an upstream end-of-support notice; move to ESLint 10 when those plugins support it. Dependencies are pinned and locked for reproducible installation.

Authentication uses verified `getClaims()` rather than trusting `getSession()`. Claims validate the signed token; immediate server-side revocation checks are not performed on every page request. Supabase's JWT expiry and refresh settings govern session lifetime. Sign-out affects the current browser session.

## Reference guidance

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

GitHub stores the source. A live deployment and hosting configuration are separate work, outside this task.
