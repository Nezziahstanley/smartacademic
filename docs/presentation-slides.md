
---

## 2. `docs/presentation-slides.md`

```markdown
---
title: SMARTACADEMIC — Academic Early-Warning System
author: Stanley Azubuike Vincent
institution: Federal Polytechnic, Ugep
date: 2026
---

# SMARTACADEMIC
## Academic Early-Warning System

**Catching academic risk before it becomes failure**

Federal Polytechnic, Ugep

---

## The Problem

- Students fail silently
- By the time results are published, the semester is over
- Attendance, CA, exams, and GPA live in separate places
- Interventions happen *after* failure, not before

---

## The Solution

**SMARTACADEMIC** continuously monitors every student:

- Attendance %
- Continuous Assessment (CA) averages
- Exam averages
- Failed courses
- GPA trends

...and classifies each student into one of four risk levels.

---

## Risk Levels

| Category | Meaning |
|---|---|
| 🟢 **GREEN** | Good standing |
| 🟡 **YELLOW** | Needs attention |
| 🟠 **ORANGE** | High risk |
| 🔴 **RED** | Critical |

Every classification is **explainable** — students see exactly why they were classified.

---

## Objectives

1. Design a normalized relational database
2. Implement automated grading and GPA calculation
3. Build a rule-based Risk Engine
4. Provide role-based dashboards (Admin, HOD, Lecturer, Student)
5. Enable intervention workflows
6. Produce PDF, CSV, and Excel reports

---

## System Architecture

Three-tier:

1. **Frontend** — HTML, CSS, vanilla JavaScript, Chart.js
2. **Backend** — Node.js, Express, JWT, bcrypt
3. **Database** — PostgreSQL (Neon serverless)

Plus integrations:
- Brevo SMTP (email)
- Termii (SMS)
- Resend (fallback)

---

## Database Highlights

- **21 normalized tables**
- Full referential integrity
- Automatic `updated_at` triggers
- Indexes on all foreign keys and hot filters
- Audit log with JSONB details

Key entities:
`users`, `students`, `lecturers`, `departments`, `programmes`, `courses`, `course_registrations`, `attendance`, `assessments`, `scores`, `results`, `risk_assessments`, `interventions`, `notifications`, `notification_log`, `audit_logs`, `settings`

---

## The Academic Engine

Converts raw scores into results:

CA average → scaled to 30%
Exam → scaled to 70%
Total → grade + grade point


Computes:
- Semester GPA
- Cumulative CGPA
- Failed course count
- GPA trend across semesters

---

## The Risk Engine

Weighted scoring (all weights configurable):

| Factor | Default Weight |
|---|---|
| Attendance | 25% |
| CA average | 20% |
| Exam average | 20% |
| Failed courses | 20% |
| GPA decline | 15% |

Score 0–100 → category:
- 0–24 GREEN
- 25–49 YELLOW
- 50–74 ORANGE
- 75–100 RED

---

## Auto-Generated Matric Numbers

Every new student gets a unique matric number in a fixed format:

FPU/SST/CST/ND/26/001


- `FPU` — institution
- `SST` — school code
- `CST` — department code
- `ND` — programme level
- `26` — admission year
- `001` — serial within (school, dept, level, year)

**Prevents typos. Ensures consistency.**

---

## Role-Based Dashboards

### Admin
System-wide KPIs, risk distribution, all entities, publishing, audit logs.

### HOD
Department KPIs, result approvals, department risk, interventions.

### Lecturer
Own courses only, attendance, assessments, results submission, at-risk students.

### Student
Own GPA, attendance, results, academic status, interventions, ID card.

---

## Key Features

✅ Auto-generated matric numbers  
✅ Registration → Admin approval → Login workflow  
✅ Email + SMS + in-app notifications  
✅ Attendance recording (with bulk "Mark all present")  
✅ Assessments and score entry  
✅ Result submission to HOD → approval → admin publish  
✅ Department-grouped bulk operations  
✅ Intervention workflow with auto-generation  
✅ PDF / CSV / Excel reports  
✅ QR-coded ID cards  
✅ Audit logging  
✅ Fully responsive layout  

---

## Security

- **JWT** for stateless auth
- **bcrypt** for password hashing (10 rounds)
- **Role-based access control** at the middleware layer
- **Department and course scoping** at the SQL layer
- **Helmet** with tuned Content Security Policy
- **Rate limiting** on auth and password reset
- **Audit trail** records actor, IP, timestamp, and details

---

## Notifications

Three channels, one dispatcher:

1. **In-app** — real-time bell icon
2. **Email** — via Brevo SMTP relay
3. **SMS** — via Termii (pending sender ID approval)

Every send is logged to `notification_log` with status and error — you can always see what happened.

---

## The Student Journey

Register → Pending Approval → Email + SMS Sent
↓
Admin Approves → Activation Email + SMS
↓
Student Logs In → Dashboard
↓
Registers for Courses
↓
Attends Classes → Attendance Recorded
↓
Takes Assessments → Scores Entered
↓
Results Computed → Submitted to HOD
↓
HOD Approves → Admin Publishes
↓
Student Sees Results + Academic Status

text

---

## The Intervention Flow
Risk Engine Classifies Student
↓
ORANGE / RED → Staff Notified
↓
Lecturer or HOD Creates Intervention
↓
Assign to Staff Member
↓
Track: Pending → In Progress → Completed → Closed
↓
Student Receives Notification + Support

text

---

## Bulk Operations

Everything admin-side supports bulk actions:

- Approve many registrations at once
- Publish all results in a department
- Auto-create interventions for every high-risk student
- Export whole departments to CSV
- Print batch ID cards

Publishing 4+ departments at once requires typing `PUBLISH` to confirm.

---

## Reports

- **Risk distribution** — summary + by department
- **Departmental performance** — GPA by dept + level
- **Attendance report** — lowest attendance first
- **Student lookup** — full academic record

Formats:
- **CSV** — for spreadsheets
- **PDF** — for printing
- **Excel (.xlsx)** — for analysis

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS, Chart.js |
| Backend | Node.js, Express |
| Database | PostgreSQL 14+ |
| Auth | JWT + bcrypt |
| Validation | express-validator |
| Security | helmet, CORS, rate limiting |
| Email | Brevo SMTP, Resend fallback |
| SMS | Termii |
| Reports | pdfkit, json2csv, exceljs |
| Testing | Jest, Supertest |
| Hosting | Render + Neon |

---

## Testing

- **21 unit tests** — pure functions (grade calc, GPA calc, risk classifier, CSV)
- **44 integration tests** — API endpoints across all roles
- **8 end-to-end scenarios** — full user journeys

**Pass rate:** 100%

**Only pending item:** Termii sender ID approval for SMS.

---

## Deployment

**Local:**
npm install
cp .env.example .env
npm run init-db
npm run seed-db
npm run dev

text

**Production:**
- Git push → Render auto-deploys
- Neon Postgres (serverless)
- Environment variables in Render dashboard
- Health check at `/api/health`

---

## What Works Today

✅ Full authentication + auto-matric  
✅ Admin approval workflow  
✅ Email notifications (Brevo)  
✅ In-app notifications  
✅ Attendance + assessment workflows  
✅ Result submission → HOD approval → admin publish  
✅ Risk engine with configurable weights  
✅ Intervention workflow  
✅ Bulk operations across the system  
✅ Reports (PDF, CSV, Excel)  
✅ QR-coded ID cards  
✅ Responsive layout (mobile → desktop)  
✅ Audit logging  

⏳ SMS (waiting on Termii sender-ID approval)

---

## Challenges Solved

| Challenge | Solution |
|---|---|
| Same course code in multiple depts | Removed UNIQUE constraint; scoped by department in code |
| Matric inconsistency | Auto-generated format with serial per bucket |
| SMTP blocked on Render | Switched Brevo to port 2525; added Resend fallback |
| Risk recompute blocking requests | Converted to background job with progress polling |
| Lecturer scope leakage | Enforced at SQL level (`lecturer_id = $1`) |
| Mobile table overflow | Scrollable wrappers + `min-width` on tables |

---

## Future Enhancements

1. Mobile app (React Native or Flutter)
2. Real-time notifications via WebSockets
3. ML-augmented risk classification
4. Timetable management
5. Fee payment gateway integration
6. Multi-tenant support
7. Offline-first attendance entry
8. Predictive trajectory analytics

---

## Conclusion

SMARTACADEMIC demonstrates that a **rule-based, explainable early-warning system** can be built affordably for a Nigerian polytechnic — without an LMS, without expensive commercial software, and without a data science team.

The system works today.

---

## Thank You

**Stanley Azubuike Vincent**  
C.E.O & Founder, Stanley Tech Connect (STC)

📧 stanleytechconnect@gmail.com  
💬 WhatsApp: 0704 114 5338  
📞 0901 616 2662  

**Federal Polytechnic, Ugep**  
SMARTACADEMIC — Academic Early-Warning System

---

## Appendix A — Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@smartacademic.edu | Admin@123 |
| HOD | hod.csc@smartacademic.edu | Hod@123 |
| Lecturer | lecturer.csc1@smartacademic.edu | Lect@123 |
| Student | student.a@smartacademic.edu | Student@123 |

---

## Appendix B — Sample Matric Numbers

| School | Dept | Level | Year | Matric |
|---|---|---|---|---|
| SST | CST | ND | 2026 | FPU/SST/CST/ND/26/001 |
| SST | CST | ND | 2026 | FPU/SST/CST/ND/26/002 |
| SET | CEN | ND | 2026 | FPU/SET/CEN/ND/26/001 |
| SST | CST | HND | 2026 | FPU/SST/CST/HND/26/001 |
| SMSS | BAM | ND | 2026 | FPU/SMSS/BAM/ND/26/001 |

---

## Appendix C — Links

- **Live demo:** https://smartacademic-1.onrender.com
- **Health check:** https://smartacademic-1.onrender.com/api/health
- **Repository:** <your-github-url>

---

*End of slides.*
