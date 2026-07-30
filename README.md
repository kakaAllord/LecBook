# LRMS — Lecturer Record Management System

A single Next.js application (frontend + backend in one project, one deploy) that replaces a lecturer's paper record book with a digital system for student registration, attendance tracking, continuous assessment, and PDF reporting.

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript — one app serves both the UI (React pages) and the REST-style JSON API (Route Handlers under `src/app/api/**`), so there's no separate backend to run or deploy.
- **Styling:** Tailwind CSS v4
- **Data fetching:** TanStack Query
- **Forms & validation:** React Hook Form + Zod (client and server side)
- **Database:** Prisma ORM on SQLite by default (`prisma/dev.db`) — swap `DATABASE_URL` to a PostgreSQL connection string for production, no schema changes required
- **Auth:** Single-lecturer login, JWT stored in an httpOnly cookie, protected routes via `middleware.ts`
- **PDF reports:** PDFKit
- **Dates:** Day.js

## Project Structure

```
prisma/
  schema.prisma        Data model (User, Course, Student, Attendance, AssessmentType, Assessment, AssessmentMark)
  seed.ts               Seed script (lecturer login + sample courses/students/assessments/attendance)
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
DATABASE_URL="file:./dev.db"          # SQLite for local dev; use a postgres:// URL in production
JWT_SECRET="change-me-to-a-long-random-string"
INSTITUTION_NAME="Your Institution Name"   # Printed at the top of generated PDF reports
```

### 3. Set up the database

```bash
npm run db:migrate   # applies prisma/migrations and generates the Prisma client
npm run db:seed      # optional: seeds a lecturer account + sample data
```

The seed script creates a lecturer login:

- **Email:** `yosiamasterpiece@gmail.com`
- **Password:** `Passw0rd!`

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
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio to inspect the database |

## Features

- **Dashboard** — totals for students, courses, today's attendance, assessments, and quick navigation.
- **Courses** — full CRUD with search.
- **Students** — registration with unique registration numbers, search, filter by course/status, CRUD.
- **Attendance** — choose a course and date, mark Present/Absent/Late/Excused per student, save (upserts, so re-saving the same date edits rather than duplicates), and browse history by date range.
- **Assessment Types** — fully dynamic, nothing hardcoded (Quiz, Test, Assignment, Practical, etc. are just data); create/edit/delete your own.
- **Assessments & Marks** — create an assessment against a course + type, enter marks per student with automatic max-marks validation, edit later.
- **Reports** — generate a printable PDF for attendance (by course + date range, with per-student attendance %) or for a single assessment (marks, average, highest, lowest), with the institution name in the header.
- **Dark mode** — toggle in the sidebar, persisted to `localStorage`.

## Notes

- All API responses use a consistent envelope: `{ success: true, data }` or `{ success: false, message }`.
- Client and server both validate input with the same Zod schemas.
- `pdfkit` is registered under `serverExternalPackages` in `next.config.ts` — required so its bundled font files resolve correctly at runtime; do not remove this without re-testing report generation.
