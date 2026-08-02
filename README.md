# LRMS — Lecturer Record Management System

A single Next.js application (frontend + backend in one project, one deploy) that replaces a lecturer's paper record book with a digital system for student registration, attendance tracking, continuous assessment, and PDF reporting.

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript — one app serves both the UI (React pages) and the REST-style JSON API (Route Handlers under `src/app/api/**`), so there's no separate backend to run or deploy.
- **Styling:** Tailwind CSS v4
- **Data fetching:** TanStack Query
- **Forms & validation:** React Hook Form + Zod (client and server side)
- **Database:** Prisma ORM on PostgreSQL. Prisma's datasource `provider` is fixed at build time (it's not inferred from the URL scheme), so switching databases means editing `prisma/schema.prisma` too, not just `DATABASE_URL`
- **Auth:** Single-lecturer login, JWT stored in an httpOnly cookie, protected routes via `middleware.ts`
- **PDF reports:** PDFKit
- **Dates:** Day.js

## Project Structure

```
prisma/
  schema.prisma        Data model (User, Settings, Course, Student, Attendance, AssessmentType, Assessment, AssessmentMark)
  seed.ts               Full seed script (lecturer login + sample courses/students/assessments/attendance)
  seed-credentials.ts    Credentials-only seed (used standalone by `npm run db:seed:creds`, and by seed.ts)
  clear.ts               Wipes everything except the User table (used by `npm run db:clear`)
scripts/
  generate-getting-started-pdf.ts   Optional offline CLI to write the guide to public/getting-started-guide.pdf (used by `npm run docs:guide`); the app itself serves it dynamically from src/app/api/getting-started-guide
src/
  app/
    api/                 Route Handlers = REST API (courses, students, attendance, assessments, reports, auth, dashboard)
    (app)/               Authenticated pages (Dashboard, Courses, Students, Attendance, Assessments, Reports) with sidebar layout
    login/                Public login page
  components/
    ui/                   Reusable UI primitives (Button, Input, Dialog, Table, Pagination, etc.)
    layout/               Sidebar, theme toggle
    attendance/           Attendance-specific widgets
  lib/
    services/             Business logic / data access per module (called from route handlers)
    validators/            Zod schemas shared by client forms and API validation
    prisma.ts, auth.ts, api-client.ts, pdf.ts, pagination.ts, api-response.ts
  types/                  Shared frontend TypeScript types
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

```
DATABASE_URL="postgresql://user:password@host:5432/dbname"
JWT_SECRET="change-me-to-a-long-random-string"
```

### 3. Set up the database

```bash
npm run db:migrate   # applies prisma/migrations and generates the Prisma client
npm run db:seed      # optional: seeds a lecturer account + sample demo data
```

Two narrower seed options are also available:

- `npm run db:seed:creds` — seeds (or updates) only the lecturer login, no demo data. Useful for a real/production database.
- `npm run db:seed:all` — same as `npm run db:seed` (full demo data), named explicitly for symmetry with `db:seed:creds`.

By default the seeded lecturer login is:

- **Email:** `lecturer@example.com`
- **Password:** `REDACTED_SEED_PASSWORD`

Override these before seeding by setting `SEED_LECTURER_EMAIL`, `SEED_LECTURER_PASSWORD`, and `SEED_LECTURER_NAME` env vars — recommended for any database that isn't a local throwaway. There is no in-app way to change credentials afterward by design — re-run `db:seed:creds` (with new env vars) or update the `User` row directly if needed.

### 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` (or the next available port) and sign in.

### 5. Build for production

```bash
npm run build
npm run start
```

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (type-checks + lints) |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database with a lecturer login plus sample courses/students/assessments/attendance |
| `npm run db:seed:creds` | Seed (or update) only the lecturer login — no demo data |
| `npm run db:seed:all` | Alias for `npm run db:seed` |
| `npm run db:studio` | Open Prisma Studio to inspect the database |
| `npm run db:clear` | **Destructive.** Wipes courses, students, attendance, assessments, marks and settings — leaves only the `User` table (login credentials) intact. Use this to reset a demo/training environment back to a blank slate without losing the login. |
| `npm run docs:guide` | Optional: writes a static copy to `public/getting-started-guide.pdf` (optionally pass an institution name, e.g. `npm run docs:guide -- "My College"`). Not used by the app — Settings links to `/api/getting-started-guide`, which generates it live. |

## Features

- **Dashboard** — totals for students, courses, today's attendance, assessments, and quick navigation.
- **Courses** — full CRUD with search.
- **Students** — registration with unique registration numbers, search, filter by course/status, CRUD.
- **Attendance** — choose a course and date, mark Present/Absent/Late/Excused per student, save (upserts, so re-saving the same date edits rather than duplicates), and browse history by date range.
- **Assessment Types** — fully dynamic, nothing hardcoded (Quiz, Test, Assignment, Practical, etc. are just data); create/edit/delete your own.
- **Assessments & Marks** — create an assessment against a course + type, enter marks per student with automatic max-marks validation, edit later.
- **Reports** — generate a printable PDF for attendance (by course + date range, with per-student attendance %) or for a single assessment (marks, average, highest, lowest), with the institution name in the header.
- **Settings** — set the Institution Name shown in the sidebar and printed at the top of every PDF report; stored in the database (not an env var), so it's editable from the UI. Also the place to (re)download the Getting Started guide.
- **Dark mode** — toggle in the sidebar, persisted to `localStorage`.
- **Getting Started guide** — a PDF generated on demand (`/api/getting-started-guide`, downloadable from the Settings page) walking through every feature from login to reports, with the institution name pulled live from Settings.

## Notes

- All API responses use a consistent envelope: `{ success: true, data }` or `{ success: false, message }`.
- Client and server both validate input with the same Zod schemas.
- `pdfkit` is registered under `serverExternalPackages` in `next.config.ts` — required so its bundled font files resolve correctly at runtime; do not remove this without re-testing report generation.
