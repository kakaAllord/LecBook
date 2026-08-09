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
  schema.prisma        Data model (User, Invite, UserSession, AuditLog, Settings, Course, Module, Student, Attendance, Assessment, AssessmentMark)
  seed.ts               Full seed script (lecturer login + sample courses/students/assessments/attendance)
  seed-credentials.ts    Credentials-only seed (used standalone by `npm run db:seed:creds`, and by seed.ts)
  clear.ts               Wipes everything except the User table (used by `npm run db:clear`)
scripts/
  generate-getting-started-pdf.ts   Optional offline CLI to write the guide to public/getting-started-guide.pdf (used by `npm run docs:guide`); the app itself serves it dynamically from src/app/api/getting-started-guide
src/
  app/
    api/                 Route Handlers = REST API (courses, students, attendance, assessments, reports, auth, dashboard)
    (app)/               Authenticated pages, one navigation per role, with sidebar layout
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
npm run db:seed      # optional: seeds the three account tiers + sample demo data
```

Two narrower seed options are also available:

- `npm run db:seed:creds` — seeds (or updates) only the logins, no demo data. Useful for a real/production database.
- `npm run db:seed:all` — same as `npm run db:seed` (full demo data), named explicitly for symmetry with `db:seed:creds`.

The seed creates one account per role: a **super admin** (the developer/operator),
an **administrator** (who registers students and adds lecturers), and a
**lecturer**.

Credentials are never hardcoded in the repository. Set them before seeding with
the `SEED_SUPERADMIN_*`, `SEED_ADMIN_*` and `SEED_LECTURER_*` variables in `.env`
— see `.env.example` for the full list. **Leave a password unset and the seed
generates a random one and prints it once**, so a fresh clone never inherits a
password that is public in git history.

Your own local logins are recorded in `CREDENTIALS.local.md`, which is untracked.

There is no in-app way to change credentials by design — re-run `db:seed:creds`
after editing `.env`, or have the person reset their own password through an
invite link.

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

The application is three workspaces behind one login. What you see is decided by
the account you sign in with, not by rows greyed out in a shared menu.

### Super admin — operations

- **Dashboard** — how the product is actually used: returning admins, daily and monthly actives, phone/computer split, feature usage, onboarding health.
- **Users** — every administrator and lecturer, with two actions each: open their account in a new tab exactly as they see it ("view as", read-only), or switch their access on and off.
- **Logs** — the full activity trail in a terminal, colour-coded by action family, filterable by actor, action, and a from/to range down to the minute. Tail it live, or replay the selection forwards in time at 0.5x–4x.

### Administrator — the institution's records

- **Dashboard** — students, courses, modules and lecturers, plus the setup gaps still open (modules with no lecturer, courses with no students, invites not yet opened), each linking to the page that closes it.
- **Courses / Modules** — full CRUD with search; modules are linked to the courses that run them.
- **Students** — registration with unique registration numbers, search, filters, CRUD. Registration is the administrator's job; lecturers never register anyone.
- **Lecturers** — add a lecturer, tick the modules they teach, and copy the one-time invite link to send them. Activate or deactivate accounts.
- **Reports** — attendance registers, assessment sheets, and a per-student report.
- **Settings** — institution name and logo, printed at the top of every PDF.

### Lecturer — teaching

- **Dashboard** — their students, their modules, whether today's register is in, attendance per module, and who has fallen below their attendance bar.
- **Students** — read-only roll of everyone on a course that runs one of their modules.
- **Attendance** — mark Present/Absent per student for a module and date, save (upserts, so re-saving edits rather than duplicates), and correct an already-saved session that was filed against the wrong module, date or course.
- **Assessments & Marks** — create an assessment against a module (with the marks still available out of the module cap shown before you commit), then enter marks per student.
- **Reports** — attendance registers with a signature column, assessment sheets, and a per-student report over any range of dates or set of assessments.
- **Settings** — their own minimum attendance threshold and assessment pass mark, which their reports are measured against.

### Everywhere

- **Dark mode** — toggle in the sidebar, persisted to `localStorage`.
- **Getting Started guide** — a PDF generated on demand (`/api/getting-started-guide`, downloadable from Settings), with the institution name pulled live from Settings.

## Notes

- All API responses use a consistent envelope: `{ success: true, data }` or `{ success: false, message }`.
- Client and server both validate input with the same Zod schemas.
- `pdfkit` is registered under `serverExternalPackages` in `next.config.ts` — required so its bundled font files resolve correctly at runtime; do not remove this without re-testing report generation.
