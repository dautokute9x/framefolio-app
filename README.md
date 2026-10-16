# Framefolio — Single Photographer Client Gallery

A simplified, production-oriented photography client gallery web app inspired by premium gallery products such as Framevis, but scoped for **one photographer**.

> **Chạy miễn phí cho cá nhân/gia đình:** xem [docs/HUONG-DAN-MIEN-PHI.md](docs/HUONG-DAN-MIEN-PHI.md) (Vercel Hobby + Supabase Free + Cloudflare R2 10 GB).

## Stack

- **Next.js App Router**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Supabase Auth**
- **Supabase Postgres**
- **Supabase Storage**

## Included features

- Public portfolio homepage
- Admin login with Supabase Auth
- Desktop-first admin dashboard
- Create and edit albums/jobs
- Upload multiple photos directly to Storage
- Public and private albums
- Optional password-protected private albums
- Shareable private album links
- Mobile-first client gallery page
- Client photo selection flow
- Admin review page for selected photos
- Job statuses:
  - Draft
  - Sent
  - Client Selecting
  - Editing
  - Delivered
- Demo SQL seed + demo content seeder

## Not included

- Social feed
- Likes/follows
- Community features
- Payments
- Chat
- AI tools

---

## Project structure

```txt
app/
  (site)/            public pages with the site header: home, portfolio, login
  dashboard/         photographer area (albums, upload, selections)
  gallery/[slug]/    client gallery + "selected" page
  api/               albums (upload-url, photos), gallery (unlock, select, submit), health
components/          dashboard/, gallery/, marketing/, ui/ (shadcn)
lib/                 data access, auth, storage (Supabase/R2), env, helpers
supabase/
  config.toml        local Supabase for development and CI
  migrations/        0001_initial.sql, 0002_selection_workflow.sql, 0003_album_lifecycle.sql
scripts/dev/         demo data for local development only (never run in production)
tests/
  unit/              Vitest
  e2e/               Playwright (selection flow + security regressions)
docs/                setup guides
.github/workflows/   CI (lint, typecheck, tests, build, e2e) and Supabase keep-alive
```

---

## Database tables

This project uses the following tables exactly as requested:

- `users`
- `clients`
- `albums`
- `photos`
- `selections`
- `album_views`

### Data model overview

- `users` → photographer profile linked to `auth.users`
- `clients` → photographer-owned clients
- `albums` → a photography job/gallery
- `photos` → uploaded assets for an album
- `selections` → saved client picks
- `album_views` → gallery view tracking

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

Required values:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
ALBUM_COOKIE_SECRET=replace-with-a-long-random-secret
ALLOW_SIGNUP=false
```

### Notes

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is used in the browser/client app.
- `SUPABASE_SERVICE_ROLE_KEY` is **server only**. Never expose it to the browser.
- `ALBUM_COOKIE_SECRET` signs password-access cookies for locked galleries.
- `ALLOW_SIGNUP=true` shows the sign-up form. Only the **first** account becomes the photographer; turn it off afterwards.

---

## Setup instructions

## 1) Create a Supabase project

Create a new Supabase project from the dashboard.

## 2) Enable Auth

Under **Authentication**:

- Enable **Email** provider
- For local testing, you can disable email confirmation or confirm seeded users manually

## 3) Run SQL migration

Open the Supabase SQL editor and run, in order:

- `supabase/migrations/0001_initial.sql`
- `supabase/migrations/0002_selection_workflow.sql` (previews, selection limit, client submit, single-admin sign-up, photo ordering)
- `supabase/migrations/0003_album_lifecycle.sql` (archive, link expiry, drag-and-drop photo order; stops keeping visitor IPs)
- (local development only) `scripts/dev/seed.sql`

This creates:

- enums
- tables
- indexes
- RLS policies
- auth profile trigger
- private storage bucket
- storage policies

## 4) Install dependencies

```bash
npm install
```

## 5) Configure environment variables

Create `.env.local` using the values from `.env.example`.

## 6) Start the app

```bash
npm run dev
```

App URL:

```txt
http://localhost:3000
```

---

## Local development and tests

```bash
npx supabase start            # local Supabase (Docker); applies supabase/migrations
# copy the printed API URL / keys into .env.local
npm run seed:demo             # demo photographer, albums and photos
npm run dev
npm run lint && npm run typecheck && npm run test:unit
npm run build && npm run test:e2e   # Playwright, needs the seeded local Supabase
```

CI runs the same steps on every pull request (`.github/workflows/ci.yml`).

## Demo seed data

After the schema exists and env vars are configured, run:

```bash
npm run seed:demo
```

This does all of the following:

- ensures a demo Supabase auth user exists
- links/creates the public `users` profile
- creates two demo clients
- creates:
  - one public album
  - one private password-protected album
- uploads demo SVG photos to Storage
- inserts photo records
- sets album cover photos
- inserts sample selections
- inserts sample album views

### Demo credentials

Admin login:

```txt
demo@framefolio.local
Demo123!
```

Private gallery password:

```txt
client123
```

The seed script also prints the private share link in the terminal.

---

## Security model

### Admin dashboard

- Authenticated with Supabase Auth
- Admin data is protected by RLS
- Dashboard pages require a signed-in photographer profile

### Storage

- Storage bucket is **private**
- Browser upload is allowed only for authenticated owners
- Assets are previewed using **signed URLs**

### Private galleries

- Private galleries require a valid `share` token in the URL
- If album password is set, gallery also requires password unlock
- Password access is stored in a signed `httpOnly` cookie

### Client selections

- Selection session is stored in an `httpOnly` cookie
- Selections are persisted into the `selections` table
- Admin can review all submitted picks on the selection review page

---

## Main routes

### Public

- `/` → homepage
- `/portfolio` → public portfolio
- `/login` → admin login / sign up

### Admin

- `/dashboard`
- `/dashboard/albums/new`
- `/dashboard/albums/[albumId]/edit`
- `/dashboard/albums/[albumId]/upload`
- `/dashboard/albums/[albumId]/selections`

### Client gallery

- `/gallery/[slug]`
- `/gallery/[slug]/selected`

---

## Upload flow

Photos are stored in Supabase Storage (default) or Cloudflare R2 (`STORAGE_DRIVER=r2`).
Each photo row remembers its backend in `photos.storage_bucket` (`albums` or `r2`), so
switching later keeps older photos working.

1. Admin opens album upload page
2. Browser asks `POST /api/albums/[albumId]/upload-url` for storage paths (and, for R2, presigned PUT URLs), then uploads the original + a 2048px preview directly to storage
3. App calls `POST /api/albums/[albumId]/photos`
4. API stores metadata in the `photos` table
5. Signed preview URLs are returned for immediate UI refresh

---

## Deploy instructions

## Deploy to Vercel

1. Push this project to GitHub
2. Import the repo into Vercel
3. Add the same environment variables from `.env.local`
4. Deploy

### Production checklist

- Set a strong `ALBUM_COOKIE_SECRET`
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- Ensure your Supabase site URL / redirect URLs are configured
- Confirm email auth behavior for production
- Replace demo SVGs with real images
- Add a custom domain if desired

---

## Recommended Supabase settings

### Auth redirect URLs

Add your local and production URLs, for example:

```txt
http://localhost:3000
https://your-domain.com
```

### Storage

This app expects a private bucket named:

```txt
albums
```

The migration creates it automatically.

---

## Demo content included

SVG placeholder assets are included in:

```txt
scripts/dev/demo-assets/
```

These are used by the seed script so the app can open with realistic demo galleries immediately.

---

## Important implementation notes

- Dashboard is optimized for desktop management
- Client gallery is optimized mobile-first
- Portfolio only lists public albums
- Private galleries are delivered through share links
- Optional password layer is supported for private albums
- This starter keeps the scope intentionally small and focused for one photographer

---

## Suggested next improvements

- drag-and-drop sorting
- deliver/final export workflow
- favorite flags / color labels
- download package delivery
- watermark presets
- per-client branded gallery theme

---

## Client selection workflow (v1.1)

1. Photographer uploads photos. The browser creates a 2048px JPEG preview per photo; clients only ever receive the preview, never the original.
2. Photographer optionally sets **Max photos the client can select** (e.g. a 30-photo package) and sends the share link (+ password).
3. Client opens the link on the phone, taps ♥ to pick (or opens a photo full-screen and picks there), filters "Đã chọn", and presses **Gửi lựa chọn** with name + note.
4. The album moves to **Editing** and the selection is locked. The photographer sees each client's picks, note and submit time on *Review selections*, and can copy the file names (or a Lightroom filter string). **Mở lại cho khách chọn** unlocks it again.
