# Hisab

A mobile-first PWA for personal finance + shared expenses between friends — iOS-style UI, works offline, syncs with Supabase.

**Live:** https://hisab-theta-nine.vercel.app
**Backend:** Supabase project `hisab` (`ukqrrrigektwovzxnoyu`, ap-southeast-1)
**Local dev backend:** `npx supabase start` → API on `127.0.0.1:56321`, Mailpit on `127.0.0.1:56324`, Studio on `127.0.0.1:56323`

## Features

- **Weekly pay & bonuses** — log pay per week, auto computes "left to spend"
- **Bills** — weekly/monthly/yearly recurring bills, mark paid per period
- **Set aside %** — automatic savings carve-out from each week's pay
- **Transactions** — expense/income/lent/borrowed, auto-categorized (petrol → Transport, biryani → Food…), optional place & counterparty for records/tax
- **Weekly reports** — spending by category, who you paid / received from, where
- **Friends & groups** — add friends by username, create groups, log shared activities (e.g. "Biryani"), equal or custom splits, partial payments ("Umar paid 50 of 100"), admin-only edit/delete with admin transfer
- **Offline-first** — everything reads/writes locally (IndexedDB) and syncs when back online; realtime updates across group members
- **PWA** — installable to home screen, iOS-style UI (bottom tab bar, bottom sheets, dark theme)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** → paste & run `supabase/schema.sql`
3. **Authentication → Providers** → enable Email (magic link is on by default)
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (dev) / your Vercel domain (prod)
   - Redirect URLs: add `<your-domain>/auth/callback` and `http://localhost:3000/auth/callback`
5. Copy **Project URL** and **anon key** from Settings → API

### 2. Local dev

```bash
cp env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev
```

### 3. Deploy to Vercel

```bash
npm i -g vercel && vercel
```

Or import the repo in the Vercel dashboard. Add the two env vars in
**Project Settings → Environment Variables**, then redeploy.

For a custom domain: **Settings → Domains** → add it, update DNS, then add
`<domain>/auth/callback` to Supabase redirect URLs and set Site URL to it.

## How offline works

- All reads come from IndexedDB (Dexie) — instant and offline-safe
- Every write is applied locally, queued in an `outbox` table, and replayed to
  Supabase in order when connectivity returns
- A service worker caches the app shell so the app opens with no connection
- Group data also updates live via Supabase Realtime

## Stack

Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres + Auth + Realtime) · Dexie.js · custom service worker
