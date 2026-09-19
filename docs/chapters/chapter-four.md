# Chapter Four — System Implementation and Testing

## 4.1 Introduction

This chapter describes how the design from Chapter Three was implemented, the technology choices, key modules, and the testing performed.

## 4.2 Development Environment

| Component | Version / Tool |
|---|---|
| Operating System | Windows 10/11 |
| Node.js | 20.x LTS |
| PostgreSQL | 14+ (Neon Serverless) |
| Code Editor | VS Code |
| Version Control | Git + GitHub |
| Hosting (backend) | Render |
| Hosting (database) | Neon |
| Package Manager | npm |

## 4.3 Project Structure
smartacademic/
├── backend/
│ ├── config/ (env.js, db.js)
│ ├── controllers/ (authController, adminController, hodController, ...)
│ ├── database/ (schema.sql, seed.sql)
│ ├── middleware/ (auth.js, role.js, validate.js, errorHandler.js, rateLimiter.js)
│ ├── models/ (userModel, adminModel, academicModel, riskModel, settingsModel)
│ ├── routes/ (authRoutes, adminRoutes, hodRoutes, lecturerRoutes, studentRoutes)
│ ├── services/ (emailService, smsService, notificationDispatcher, riskEngine, ...)
│ └── utils/ (gradeCalculator, gpaCalculator, riskClassifier, matricGenerator, ...)
├── frontend/
│ ├── admin/ (dashboard.html, users.html, risk-monitoring.html, ...)
│ ├── hod/ (dashboard.html, result-submissions.html, ...)
│ ├── lecturer/ (dashboard.html, attendance.html, results.html, ...)
│ ├── student/ (dashboard.html, my-courses.html, id-card.html, ...)
│ ├── public/ (index.html, login.html, register.html, ...)
│ ├── css/ (layout, sidebar, topbar, dashboard, auth)
│ └── js/ (per-role scripts + shared helpers)
├── scripts/ (init-db.js, seed-db.js, migrations, ...)
├── tests/ (Jest + Supertest suites)
├── docs/ (this documentation)
├── server.js (Express entry point)
└── package.json


## 4.4 Database Implementation

The schema is defined in `backend/database/schema.sql`. All 21 tables are created in dependency order.

**Migrations** are stored in `scripts/`:
- `add-result-submission-status.js`
- `add-notification-log.js`
- `add-fee-tracking.js`
- `renumber-matrics.js`

**Seeding** is handled by `scripts/seed-db.js` (demo) and `scripts/seed-nbte-fpu.js` (production NBTE data).

## 4.5 Backend Implementation

### 4.5.1 Authentication

- `POST /api/auth/register` — creates user as inactive, auto-generates matric, dispatches confirmation
- `POST /api/auth/login` — issues JWT
- `GET /api/auth/me` — returns current user + role-specific profile
- `POST /api/auth/forgot-password` / `reset-password`

### 4.5.2 Academic Engine

`backend/services/academicEngine.js`

- Aggregates scores from `scores` into CA and Exam components
- Computes total score, grade, and grade point
- Upserts into `results`
- Computes GPA, CGPA, trend, failed courses

### 4.5.3 Risk Engine

`backend/services/riskEngine.js`

- Loads weights and thresholds from `settings`
- For every student, computes a weighted risk score
- Classifies into GREEN / YELLOW / ORANGE / RED
- Upserts into `risk_assessments`
- Exposes `assessAllStudents()` and `fullRecompute()`

The recompute endpoint runs as a background job so admins see progress rather than a hanging request.

### 4.5.4 Matric Generator

`backend/utils/matricGenerator.js`

Format: `FPU/<SCHOOL>/<DEPT>/<LEVEL>/<YY>/<NNN>`

Example: `FPU/SST/CST/ND/26/001`

- School codes: SET, SST, SES, SMSS
- Dept codes: CST, CEN, CIV, EEE, STA, AIT, ARC, BAM, PAD, ACC, LIS, HTM, etc.
- Level tags: ND or HND
- YY: last two digits of admission year
- NNN: sequential serial per (school, dept, level, year) bucket

### 4.5.5 Notification Dispatcher

`backend/services/notificationDispatcher.js`

- Sends email (SMTP + Brevo, with Resend fallback)
- Sends SMS (Termii)
- Creates in-app notifications
- Logs every attempt to `notification_log` with status and error

### 4.5.6 Services

- `emailService.js` — Nodemailer (Brevo SMTP, port 587/2525), Resend fallback
- `smsService.js` — Termii API with phone normalization
- `interventionService.js` — auto-creates interventions for RED/ORANGE students
- `notificationService.js` — centralized in-app notification creation

## 4.6 Frontend Implementation

### 4.6.1 Shared Layout

Every dashboard page uses:
- `js/sidebar.js` — role-based menu injection, active link, logout
- `js/topbar.js` — auth guard, user hydration, notification bell, profile menu
- `js/admin/crud-shared.js` — `$`, `api`, `esc`, `initials`, `openModal`, `toast`

### 4.6.2 Role-Based Dashboards

Each role has a distinct dashboard:
- **Admin** — system-wide KPIs, risk distribution, attendance trend
- **HOD** — department KPIs, department performance, high-risk students
- **Lecturer** — courses, at-risk students, attendance summary
- **Student** — GPA/CGPA, attendance, risk status, interventions

### 4.6.3 Department-Grouped Views (Admin)

Students, Lecturers, Courses, Course Registration, Attendance, Results, and ID Cards are grouped by department using a reusable accordion component (`js/admin/accordion.js`). State is persisted to `localStorage` per page.

### 4.6.4 Responsive Layout

All pages use CSS grid and scrollable `.table-wrap` containers. Sidebar becomes off-canvas below 900px. Tables remain readable on 375px-wide phones by scrolling horizontally with a "→ scroll →" hint.

## 4.7 Testing

### 4.7.1 Testing Strategy

- **Unit tests** for pure utility functions (grade calculator, GPA calculator, risk classifier, CSV exporter)
- **Integration tests** using Jest + Supertest against the running API
- **Manual end-to-end tests** across all four roles

### 4.7.2 Tools

- Jest — test runner
- Supertest — HTTP-level API testing
- Manual browser testing — Chrome, Firefox, mobile simulator

### 4.7.3 Test Suites

| File | Coverage |
|---|---|
| `tests/unit.test.js` | Grade calc, GPA calc, risk classifier, CSV export |
| `tests/integration.test.js` | Login, role access, dashboard endpoints |
| `tests/admin.test.js` | Admin dashboard, users, risk, audit, settings |
| `tests/hod.test.js` | HOD dashboard, students, courses, risk |
| `tests/lecturer.test.js` | Lecturer dashboard, courses, at-risk |
| `tests/student.test.js` | Student dashboard, profile, results, interventions |
| `tests/risk.test.js` | Risk recompute and ordering |

### 4.7.4 Sample Test Cases

| ID | Description | Expected Result |
|---|---|---|
| T1 | Login with valid admin credentials | 200 + JWT |
| T2 | Login with invalid password | 401 |
| T3 | Student accesses admin route | 403 |
| T4 | Register new student | 201 + pending=true + matric |
| T5 | Admin approves pending student | 200 + email dispatched |
| T6 | Register course with credit limit exceeded | 400 |
| T7 | Lecturer submits results | 200 + HOD notified |
| T8 | HOD approves submitted results | 200 + lecturer notified |
| T9 | Admin publishes approved results | 200 + students notified |
| T10 | Risk engine recompute | Completes; counts returned |
| T11 | Export attendance CSV | Valid CSV downloaded |
| T12 | Student prints ID card | Renders with QR |

### 4.7.5 Running Tests

```bash
npm test
npm run test:unit

4.8 Deployment

4.8.1 Local

npm install
cp .env.example .env   # fill in real values
npm run init-db
npm run seed-db
npm run dev

4.8.2 Production (Render + Neon)
Push repo to GitHub

Create Neon Postgres project; copy connection details

Create Render Web Service pointing at the repo

Add environment variables (see installation guide)

Deploy; Render builds and starts automatically

4.8.3 Environment Variables
See docs/installation-guide.md for the complete list.

4.9 Results and Discussion
The system was deployed and tested with:

4 schools

12+ departments

14 programmes

~220 courses

Multiple demo students per department

Observations:

Risk recompute for ~500 students completes in under 15 seconds

Result publishing per department completes in under 3 seconds

Email delivery through Brevo succeeds reliably on port 2525 from Render

SMS delivery is pending Termii sender-ID approval

Attendance, assessment, and result workflows operate end-to-end

Responsive layout works down to 375px mobile width

4.10 Challenges Encountered
Challenge	Resolution
Same course code in multiple departments	Removed UNIQUE constraint on courses.code; added department-scoped uniqueness by application logic
Matric number inconsistency	Auto-generated using school + dept + level + year + serial
SMTP blocked from Render	Switched Brevo to port 2525; added Resend HTTPS fallback
Termii sender ID not approved	Requires Termii dashboard action; documented as pending
Session caching of static files	Added cache-busting on deploy + hard-refresh guidance
Lecturer scope leakage	Enforced lecturer_id filter at SQL level
Risk recompute blocking the HTTP request	Converted to background job with progress polling
