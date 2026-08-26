# Working notes for agents

`AGENTS.md` and `CLAUDE.md` are kept identical — edit one, copy it to the other.

## The standing rule: documents must describe the real system

**Before every commit, check the documents that describe this system against
what the code now does, correct them in the same commit, and regenerate any PDF
built from them. A commit that changes behaviour and leaves a document lying is
not finished.**

This project is sold and handed to people who read the documents rather than the
source. A guide that describes a screen that no longer exists, or a proposal
that promises a feature that moved, costs more than the missing feature would
have.

### What to check, and when

| Document | Lives in | Check it when you change… | Regenerate |
| --- | --- | --- | --- |
| `README.md` | repo root | routes, roles, scripts, data model, setup steps | — |
| Getting Started guide | `src/lib/services/guide.service.ts` | any screen, button, or workflow a user follows | `npm run docs:guide` |
| Business proposal | `src/lib/content/proposal.ts` | what the system does, who can do it, or what it costs to run | `npm run docs:proposal` |
| `plan.md` | repo root | never — it is the original brief, kept as history | — |
| `CLAUDE.md` / `AGENTS.md` | repo root | the way of working itself | — |

`next-steps.md` and `my-observations.md` are the owner's own notes. Read them,
never rewrite them.

Both PDFs are generated artifacts and are gitignored: the committed truth is the
TypeScript they are rendered from. Regenerate them anyway so the copy sitting in
the working directory is not stale.

### The check itself

1. Ask what a reader would now be told that is no longer true — a renamed page,
   a moved setting, a permission that changed hands, a field that is gone.
2. Grep the documents for the nouns you touched (`threshold`, `course`,
   `lecturer`, the page name) rather than trusting memory.
3. Fix the wording where it is wrong, and only there. These documents have a
   voice; match it instead of replacing it.
4. Regenerate the PDFs if their source changed, and confirm the command exits
   cleanly.
5. Commit the document changes with the behaviour change they describe, unless
   the documentation work is large enough to stand as its own commit.

## Commits

- One commit per shipped feature, not per file touched.
- The subject line says what the change does for the user, in the imperative.
- The body says what was wrong before and why this is the fix. Assume the reader
  is you, in a year, wondering why.
- No attribution trailers of any kind.
- Before committing: `npx tsc --noEmit`, then `npm run build`, then the document
  check above.

## The shape of the system

Three roles, three workspaces, one login page. Every account signs into an
application built for the job it does — this is deliberate, and hiding rows in a
shared menu is not an acceptable substitute for it.

- **Super admin** (`SUPER_ADMIN`) — operations. Dashboard of product usage,
  Users, Logs. Creates administrator accounts. Reads any account through
  read-only "view as". Owns no academic records.
- **Administrator** (`ADMIN`) — the institution's records. Courses, modules,
  students, lecturers, reports, institution settings. Takes no registers.
- **Lecturer** (`LECTURER`) — teaching. A read-only roll, attendance,
  assessments, reports, and their own attendance threshold and pass mark.

Load-bearing facts, each of which a document has got wrong before:

- A lecturer is assigned **modules**, never courses. Their courses and students
  are derived from those modules (`src/lib/scope.ts`).
- The attendance threshold and pass mark live **on the lecturer**, falling back
  to the institution defaults in `Settings` (`getSettingsFor`).
- Attendance is **Present or Absent**. There is no Late and no Excused.
- Assessments belong to a **module**, and each is marked out of its own total
  (100 by default). There is no shared per-module cap. A student's result is the
  **average of the percentages** they scored, over the assessments that carry a
  mark, and passing means that average reaching the pass mark (`src/lib/grading.ts`).
- An invited person only ever chooses a password; the administrator entered
  everything else.
- Page access is enforced server-side in `src/lib/guard.ts`. A hidden link is
  not access control.

## Conventions

- Server components guard the page; API routes guard the data. Both, always.
- Validation lives in `src/lib/validators` and is shared by client and server.
- Business logic lives in `src/lib/services`, not in route handlers.
- Comments explain why a thing is the way it is, not what the line does.
