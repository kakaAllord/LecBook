> **Historical document.** This is the original build brief, kept for the record.
> It describes an MVP on a Vite + Express stack with course-level attendance; the
> system that was actually built is a single Next.js application with three role
> workspaces and module-level teaching. For what the system does today, read
> `README.md`; do not treat anything below as current.

# Build a Lecturer Record Management System (MVP)

Build a full-stack web application called **Lecturer Record Management System (LRMS)**.

## Goal

Replace a lecturer's paper record book with a simple digital system for:

* Student registration
* Attendance tracking
* Continuous Assessment management
* PDF report generation

This is an MVP. Prioritize functionality, clean architecture, and good UX over unnecessary features.

---

## Tech Stack

Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* React Hook Form
* Zod

Backend

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL (SQLite fallback for development)

Libraries

* JWT Authentication
* bcrypt
* PDFKit (or jsPDF)
* Day.js

---

## Architecture

```
Frontend
 ├── Dashboard
 ├── Students
 ├── Courses
 ├── Attendance
 ├── Assessments
 └── Reports

Backend
 ├── Auth
 ├── Courses
 ├── Students
 ├── Attendance
 ├── Assessments
 └── Reports
```

Use REST APIs.

Separate:

* controllers
* routes
* services
* prisma
* middleware

Use reusable React components.

---

## Authentication

Single lecturer login.

JWT authentication.

Protected routes.

---

# Database

## User

```
id
name
email
password
createdAt
```

---

## Course

```
id
name
level
semester
academicYear
```

Example

Electrical Engineering

Level 5

Semester II

2026

---

## Student

```
id
registrationNumber
fullName
gender
phone
courseId
status
createdAt
```

Status

Active

Inactive

---

## Attendance

```
id
studentId
date
status
remarks
```

Status

Present

Absent

Late

Excused

---

## AssessmentType

Dynamic.

```
id
name
maxMarks
description
```

Examples

Quiz

Test

Assignment

Practical

Lab

Presentation

Project

Nothing should be hardcoded.

Users can create new assessment types.

---

## Assessment

Represents one assessment event.

```
id
courseId
assessmentTypeId
title
date
```

Example

Quiz 1

Practical 2

Assignment 4

---

## AssessmentMark

```
id
assessmentId
studentId
marks
remarks
```

---

# Features

## Dashboard

Show

Total students

Courses

Today's attendance

Assessments

Quick navigation cards.

---

## Course Management

CRUD

Create

Edit

Delete

Search

---

## Student Management

Register students.

Fields

Registration Number

Full Name

Gender

Phone

Course

Status

Search

Edit

Delete

Filter by course.

---

## Attendance

Workflow

Choose course

↓

System loads students

↓

Mark

Present

Absent

Late

Excused

↓

Save

Prevent duplicate attendance for same course/date.

Attendance history page.

Edit attendance.

---

## Assessment Types

Create

Edit

Delete

Examples

Quiz

Assignment

Presentation

Practical

Users may add unlimited assessment types.

---

## Assessment Records

Workflow

Choose course

↓

Choose assessment type

↓

Create assessment

↓

Load students

↓

Enter marks

↓

Save

Editable later.

---

## Reports

Generate PDF

Attendance report

Contains

Course

Date range

Student list

Attendance percentage

Generate Assessment PDF

Contains

Assessment

Marks

Average

Highest

Lowest

Total

Include institution name at top.

Use clean printable formatting.

---

## UI

Modern

Minimal

Responsive

Sidebar navigation

Cards

Tables

Dialogs

Forms

Pagination

Search bars

Loading indicators

Toast notifications

Empty states

Confirmation dialogs before deletion.

---

## Validation

Client and server validation.

No duplicate registration numbers.

Marks cannot exceed maxMarks.

Required fields validated.

---

## API

Implement complete CRUD.

Return consistent JSON.

```
{
  success: true,
  data: ...
}
```

Errors

```
{
  success: false,
  message: ""
}
```

---

## Code Quality

Use TypeScript everywhere.

Reusable components.

Environment variables.

Proper folder structure.

Meaningful comments only where necessary.

Avoid duplicated code.

---

## Bonus

Dashboard charts

Attendance percentage

Average marks

Search everything

Dark mode

CSV export

Seed database

---

## Deliverables

1. Complete source code.
2. Prisma schema.
3. SQL migrations.
4. API routes.
5. Responsive frontend.
6. PDF generation.
7. Seed data.
8. README with setup instructions.
9. Docker support (optional).
10. Production-ready project structure.

Focus on producing a working MVP first. Build incrementally with clean commits, ensuring every feature is functional before moving to the next. Avoid placeholder implementations where practical.
