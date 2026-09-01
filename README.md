# LRMS — Lecturer Record Management System

A single Next.js application (frontend + backend in one project, one deploy) for operating one institution's student registration, module-based teaching, attendance, continuous assessment, account oversight, and PDF reporting.

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript — one app serves both the UI (React pages) and the REST-style JSON API (Route Handlers under `src/app/api/**`), so there's no separate backend to run or deploy.
- **Styling:** Tailwind CSS v4
- **Data fetching:** TanStack Query
- **Forms & validation:** React Hook Form + Zod (client and server side)
- **Database:** Prisma ORM on PostgreSQL. Prisma's datasource `provider` is fixed at build time (it's not inferred from the URL scheme), so switching databases means editing `prisma/schema.prisma` too, not just `DATABASE_URL`
- **Auth:** One login page for super admins, administrators and lecturers; JWT stored in an httpOnly cookie, with route entry handled by `src/middleware.ts` and role/data access enforced by server pages and API handlers
- **PDF reports:** PDFKit
- **Dates:** Day.js

## Project Structure

```
prisma/
  schema.prisma        Data model (User, Invite, UserSession, AuditLog, Settings, Course, Module, Student, Attendance, Assessment, AssessmentMark)
  seed.ts               Full seed script (all three account roles + sample courses/modules/students/assessments/attendance)
  seed-credentials.ts    Credentials-only seed (used standalone by `npm run db:seed:creds`, and by seed.ts)
  clear.ts               Wipes academic/demo data while retaining accounts and operational history (used by `npm run db:clear`)
scripts/
  generate-getting-started-pdf.ts   Optional offline CLI to write the guide to public/getting-started-guide.pdf (used by `npm run docs:guide`); the app itself serves it dynamically from src/app/api/getting-started-guide
  generate-proposal-pdf.ts          Offline CLI to write the business proposal to the repository root (used by `npm run docs:proposal`); the super-admin dashboard also serves it dynamically from src/app/api/proposal
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

There is no in-app password-change or password-reset screen. Re-running
`db:seed:creds` after editing `.env` resets the three seeded accounts. Invite
links are only for new, not-yet-active accounts; an active account cannot use
the invite flow as a password reset.

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

`build` regenerates the Prisma client before compiling. The client is generated
code inside `node_modules`, so a host that restores `node_modules` from a build
cache would otherwise type-check against whichever schema was current when that
cache was written, and fail on fields added since.

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (regenerates the Prisma client, then type-checks + lints) |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database with one login per role plus sample courses/modules/students/assessments/attendance |
| `npm run db:seed:creds` | Seed (or update) the super admin, administrator and lecturer logins — no demo data |
| `npm run db:seed:all` | Alias for `npm run db:seed` |
| `npm run db:studio` | Open Prisma Studio to inspect the database |
| `npm run db:clear` | **Destructive.** Wipes courses, modules, students, attendance, assessments, marks and settings. User accounts remain, along with their invite, session and audit-log records. Use this to reset the academic demo data without losing logins. |
| `npm run docs:guide` | Optional: writes a static copy to `public/getting-started-guide.pdf` covering all three roles (optionally pass an institution name, e.g. `npm run docs:guide -- "My College"`). Not used by the app — Settings links to `/api/getting-started-guide`, which generates a role-specific one live. |
| `npm run docs:proposal` | Writes the business proposal PDF to the repository root. The super-admin dashboard links to `/api/proposal`, which generates the same document on demand. |

## Features

The application is three workspaces behind one login page. What you see is
decided by the account you sign in with, not by rows greyed out in a shared
menu. Academic data and institution settings belong to the deployment as a
whole; the current data model does not partition several colleges inside one
database.

### Super admin — operations

- **Dashboard** — how the product is actually used: returning admins, daily and monthly actives, phone/computer split, feature usage, onboarding health.
- **Users** — every administrator and lecturer. "Add administrator" creates an institution administrator and hands back a one-time invite link; each active row can be opened in a new tab exactly as its owner sees it (a view-as workspace labelled read-only), and every row can have its account status switched on or off.
- **Logs** — recorded system activity in a terminal, colour-coded by action family, filterable by free text, actor, action, and a from/to range down to the minute. Tail it live, expand an entry for its metadata, or replay the current page forwards in time at 0.5x–4x.

### Administrator — the institution's records

- **Dashboard** — students, courses, modules and lecturers, plus the setup gaps still open (modules with no lecturer, courses with no modules or students, invites not yet opened), each linking to the page that closes it.
- **Courses / Modules** — full CRUD with search; modules are linked to the courses that run them.
- **Students** — registration with unique registration numbers, search, filters and CRUD, plus configurable per-student PDF/text exports. Registration is the administrator's job; lecturers never register anyone.
- **Lecturers** — add a lecturer, tick the modules they teach, and copy the one-time invite link to send them. Edit assignments, issue a replacement invite while setup is pending, activate/deactivate access, or delete the account.
- **Reports** — attendance registers, assessment sheets, and a per-student report.
- **Settings** — institution name and logo, shown in the app and printed at the top of academic report PDFs.

### Lecturer — teaching

- **Dashboard** — their students, their modules, whether today's register is in, attendance per module, and who has fallen below their attendance bar.
- **Students** — read-only roll of everyone on a course that runs one of their modules.
- **Attendance** — select a module, the attending course(s) and a date; mark each active student Present/Absent; save (upserts, so re-saving edits rather than duplicates); then edit, move or delete an already-saved session from its history.
- **Assessments & Marks** — create an assessment against one of their modules and one or more of its courses, each marked out of its own total (100 by default), then enter or revisit marks per student. The list holds their own modules' assessments only. A student's result for a module is the average of the percentages they scored across its assessments, measured against the lecturer's pass mark.
- **Reports** — attendance registers with a signature column, assessment sheets that print each mark as a percentage and a PASS/REDO against the pass mark, and a per-student report over any range of dates or set of assessments.
- **Settings** — their own minimum attendance threshold and assessment pass mark, which their reports are measured against.

### Everywhere

- **Dark mode** — toggle in the sidebar, persisted to `localStorage`.
- **Getting Started guide** — a PDF generated on demand (`/api/getting-started-guide`; linked from administrator and lecturer Settings), written for the role of whoever asks for it, with the institution name pulled live from Settings. The offline script produces one combined guide for all roles.

## Keeping the documents honest

Everything that describes this system is generated from, or lives beside, the
code that implements it:

| Document | Source | Regenerate with |
| --- | --- | --- |
| `README.md` | hand-written | — |
| Getting Started guide (PDF) | `src/lib/services/guide.service.ts` | `npm run docs:guide` |
| Business proposal (PDF) | `src/lib/content/proposal.ts` | `npm run docs:proposal` |
| `plan.md` | the original brief, kept as history | — |

Before any commit that changes behaviour, these are checked against what the
code now does and corrected in the same change. See `AGENTS.md` for the working
rule.

## Notes

- JSON API responses use a consistent envelope: `{ success: true, data }` or `{ success: false, message }`. PDF-download endpoints return `application/pdf`, and the view-as endpoint redirects into the selected workspace.
- Client and server both validate input with the same Zod schemas.
- `pdfkit` is registered under `serverExternalPackages` in `next.config.ts` — required so its bundled font files resolve correctly at runtime; do not remove this without re-testing report generation.
