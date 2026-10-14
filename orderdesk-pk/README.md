# OrderDesk PK — Phase 1

Phase 1 covers: Supabase client/server setup, environment config,
registration, login, logout, and a protected `/dashboard` route.
Nothing beyond that (sidebar, stats, products, orders, etc.) is built yet —
that's Phase 2 onward.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project's URL and **anon/publishable** key (Project
Settings → API in the Supabase dashboard). Never put the `service_role` key
here — it's not used in this app.

## 3. Row Level Security

The app assumes your existing tables (`profiles`, `customers`, `products`,
`product_variants`, `orders`, `order_items`) already have RLS **enabled**,
so that every signed-in user only ever sees their own data. Nothing in this
codebase creates or alters tables — but if RLS policies aren't in place yet,
here's the policy Phase 1 needs on `profiles` (run this yourself in the
Supabase SQL editor if it isn't already there):

```sql
alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);
```

Tables used from Phase 3 onward (`customers`, `products`, `product_variants`,
`orders`, `order_items`) will need the equivalent `user_id = auth.uid()`
policies — those are covered when those tables' pages are wired up, since
`product_variants` and `order_items` scope through their parent row.

## 4. Email confirmation

By default, Supabase requires email confirmation before a session exists.
`RegisterForm` handles both cases:
- **Confirmation off** (Dashboard → Authentication → Providers → Email →
  disable "Confirm email"): the user is signed in and redirected straight
  to `/dashboard`.
- **Confirmation on**: the user sees a "check your email" message, and can
  log in once they've confirmed.

For local development, turning confirmation off is usually simplest.

## 5. Run it

```bash
npm run dev
```

- `/` — marketing landing page
- `/register` — create account (writes to `profiles`)
- `/login` — log in
- `/dashboard` — protected; redirects to `/login` if not authenticated
  (enforced in `middleware.js`, double-checked in `app/dashboard/layout.js`)

## What's built in Phase 1

| Area | File(s) |
|---|---|
| Supabase browser client | `lib/supabase/client.js` |
| Supabase server client | `lib/supabase/server.js` |
| Session refresh + route protection | `middleware.js` |
| Auth logic (signup/login/logout/reset) | `services/authService.js` |
| Auth state across the app | `context/AuthContext.jsx`, `hooks/useAuth.js` |
| Login / Register / Forgot password pages | `app/(auth)/*` |
| Auth forms | `components/auth/*` |
| Protected dashboard shell | `app/dashboard/layout.js`, `app/dashboard/page.js` |
| Marketing landing page | `app/(marketing)/page.js` |
| Shared UI primitives | `components/ui/*` |
| Currency/date/status constants | `lib/utils.js`, `lib/constants.js` |

## Next: Phase 2

Sidebar navigation, dashboard header polish, and real stats (total orders,
sales, customers, low stock) pulled from Supabase.
