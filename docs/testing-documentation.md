# Testing Documentation

**Project:** SMARTACADEMIC — Academic Early-Warning System  
**Institution:** Federal Polytechnic, Ugep  
**Version:** 1.0.0  
**Testing Tools:** Jest, Supertest, Node.js, manual browser testing

---

## 1. Introduction

This document describes the testing strategy, test cases, and results for SMARTACADEMIC. The system was tested at three levels:

1. **Unit testing** — pure functions (calculators, classifiers, exporters)
2. **Integration testing** — API endpoints against a running server
3. **Manual end-to-end testing** — full user journeys across all four roles

---

## 2. Testing Environment

| Component | Value |
|---|---|
| Node.js | 20.x LTS |
| Database | PostgreSQL 14+ (Neon Serverless) |
| Test runner | Jest 29.x |
| HTTP client | Supertest 7.x (plus native `fetch`) |
| OS | Windows 10/11 |
| Browsers tested | Chrome, Firefox, Edge |
| Devices tested | Desktop, tablet (simulated), mobile (375px–414px viewports) |

---

## 3. Test Strategy

### 3.1 Unit Testing

Focus: pure functions with deterministic outputs.

Covered:
- Grade calculator (`backend/utils/gradeCalculator.js`)
- GPA / CGPA calculator (`backend/utils/gpaCalculator.js`)
- Risk classifier (`backend/utils/riskClassifier.js`)
- CSV exporter (`backend/utils/csvExporter.js`)

### 3.2 Integration Testing

Focus: API endpoints against a running server, using real JWTs and real database.

Covered:
- Authentication (login, register, me)
- Role-based access (student cannot hit admin routes, etc.)
- Admin dashboard, users, students, lecturers, courses
- Risk list and recompute
- Audit log filtering
- Notifications

### 3.3 Manual End-to-End Testing

Focus: complete user journeys.

Covered:
- Student registers → admin approves → student logs in
- Student registers for courses → admin approves
- Lecturer records attendance → saves
- Lecturer creates assessment → enters scores → submits to HOD
- HOD approves → admin publishes → student sees result
- Admin recomputes risk → intervention auto-created
- Print ID cards (single and batch)

---

## 4. Unit Test Cases

**File:** `tests/unit.test.js`

### 4.1 gradeCalculator

| ID | Test | Input | Expected |
|---|---|---|---|
| U-GC-1 | A band | 75 | grade A, point 5.0 |
| U-GC-2 | B band | 65 | grade B, point 4.0 |
| U-GC-3 | C band | 55 | grade C, point 3.0 |
| U-GC-4 | D band | 47 | grade D, point 2.0 |
| U-GC-5 | E band | 42 | grade E, point 1.0 |
| U-GC-6 | F band | 30 | grade F, point 0.0 |
| U-GC-7 | 30/70 weighting | (30, 70) | total 58 |
| U-GC-8 | Non-integer totals | (25, 60) | total 49.5 |
| U-GC-9 | Pass determination | A, E, F | true, true, false |

### 4.2 gpaCalculator

| ID | Test | Input | Expected |
|---|---|---|---|
| U-GPA-1 | Weighted average | 3×5 + 3×4 + 2×3 | GPA 4.13 |
| U-GPA-2 | Empty array | [] | GPA 0 |
| U-GPA-3 | Failed course count | [A, F, F, C] | failed = 2 |
| U-GPA-4 | GPA decline | 4.0 → 3.0 → 2.5 | decline = 0.5 |

### 4.3 riskClassifier

| ID | Test | Input | Expected |
|---|---|---|---|
| U-RC-1 | Perfect student | att 95, CA 28, exam 65, 0 failed, 0 decline | GREEN, score < 25 |
| U-RC-2 | Struggling student | att 55, CA 15, exam 30, 2 failed, 0.5 decline | ORANGE or RED |
| U-RC-3 | Critical student | att 30, CA 10, exam 20, 4 failed, 1.2 decline | RED |

### 4.4 csvExporter

| ID | Test | Input | Expected |
|---|---|---|---|
| U-CSV-1 | Escape comma in field | `"Doe, John"` | wrapped in quotes |
| U-CSV-2 | Escape double quotes | `He said "hi"` | double-escaped |
| U-CSV-3 | Empty array | [] | empty string |

---

## 5. Integration Test Cases

### 5.1 Authentication (`tests/integration.test.js`)

| ID | Test | Endpoint | Expected |
|---|---|---|---|
| I-AUTH-1 | Health check | `GET /api/health` | 200, success=true |
| I-AUTH-2 | Admin login | `POST /api/auth/login` | 200, JWT returned |
| I-AUTH-3 | HOD login | `POST /api/auth/login` | 200, JWT returned |
| I-AUTH-4 | Lecturer login | `POST /api/auth/login` | 200, JWT returned |
| I-AUTH-5 | Student login | `POST /api/auth/login` | 200, JWT returned |
| I-AUTH-6 | Unauth admin route | `GET /api/admin/users` (no token) | 401 |
| I-AUTH-7 | Student → admin route | `GET /api/admin/users` (student) | 403 |
| I-AUTH-8 | Validation rejects bad payload | `POST /api/auth/register` | 422 |

### 5.2 Admin (`tests/admin.test.js`)

| ID | Test | Endpoint | Expected |
|---|---|---|---|
| I-ADM-1 | Dashboard stats | `GET /api/admin/dashboard` | 200, stats present |
| I-ADM-2 | Paginated users | `GET /api/admin/users?limit=5` | 200, items array |
| I-ADM-3 | Students list | `GET /api/admin/students` | 200, items array |
| I-ADM-4 | Risk list | `GET /api/admin/risk` | 200, summary present |
| I-ADM-5 | Recompute risk | `POST /api/admin/risk/recompute` | 200, jobId returned |
| I-ADM-6 | Settings | `GET /api/admin/settings` | 200, array |
| I-ADM-7 | Audit logs | `GET /api/admin/audit-logs` | 200, items array |
| I-ADM-8 | Unknown route | `GET /api/admin/nope` | 404 |

### 5.3 HOD (`tests/hod.test.js`)

| ID | Test | Endpoint | Expected |
|---|---|---|---|
| I-HOD-1 | Department dashboard | `GET /api/hod/dashboard` | 200, department present |
| I-HOD-2 | Department students | `GET /api/hod/students` | 200, items array |
| I-HOD-3 | Department lecturers | `GET /api/hod/lecturers` | 200, array |
| I-HOD-4 | Department courses | `GET /api/hod/courses` | 200, array |
| I-HOD-5 | Attendance overview | `GET /api/hod/attendance` | 200, byCourse present |
| I-HOD-6 | Performance | `GET /api/hod/performance` | 200, byLevel present |
| I-HOD-7 | Risk list | `GET /api/hod/risk` | 200, array |
| I-HOD-8 | Student blocked | `GET /api/hod/dashboard` (student token) | 403 |

### 5.4 Lecturer (`tests/lecturer.test.js`)

| ID | Test | Endpoint | Expected |
|---|---|---|---|
| I-LEC-1 | Dashboard | `GET /api/lecturer/dashboard` | 200, courses array |
| I-LEC-2 | Own courses | `GET /api/lecturer/courses` | 200, array |
| I-LEC-3 | Own students | `GET /api/lecturer/students` | 200, array |
| I-LEC-4 | Own assessments | `GET /api/lecturer/assessments` | 200, array |
| I-LEC-5 | Own results | `GET /api/lecturer/results` | 200, array |
| I-LEC-6 | At-risk | `GET /api/lecturer/at-risk` | 200, array |
| I-LEC-7 | Admin blocked | `GET /api/lecturer/dashboard` (admin token) | 403 |

### 5.5 Student (`tests/student.test.js`)

| ID | Test | Endpoint | Expected |
|---|---|---|---|
| I-STU-1 | Dashboard | `GET /api/student/dashboard` | 200, summary present |
| I-STU-2 | Own profile | `GET /api/student/profile` | 200, matric present |
| I-STU-3 | Own courses | `GET /api/student/courses` | 200, array |
| I-STU-4 | Own attendance | `GET /api/student/attendance` | 200, byCourse present |
| I-STU-5 | Own results | `GET /api/student/results` | 200, array |
| I-STU-6 | GPA/CGPA | `GET /api/student/gpa-cgpa` | 200, summary present |
| I-STU-7 | Performance | `GET /api/student/performance` | 200, byCourse present |
| I-STU-8 | Academic status | `GET /api/student/academic-status` | 200, student present |
| I-STU-9 | Interventions | `GET /api/student/interventions` | 200, array |
| I-STU-10 | Lecturer blocked | `GET /api/student/dashboard` (lecturer token) | 403 |

### 5.6 Risk Engine (`tests/risk.test.js`)

| ID | Test | Endpoint | Expected |
|---|---|---|---|
| I-RISK-1 | Recompute runs | `POST /api/admin/risk/recompute` | 200, job started |
| I-RISK-2 | Job status polling | `GET /api/admin/risk/recompute-status/:jobId` | 200, progress present |
| I-RISK-3 | Risk list ordered | `GET /api/admin/risk` | 200, categories valid |

---

## 6. Manual End-to-End Test Scenarios

### 6.1 Scenario 1 — Student Registration and Approval

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open `/register.html` in incognito | Student tab active, no matric field, info box visible |
| 2 | Fill in name, email, phone, dept, programme, level, year, password | Form accepts input |
| 3 | Submit | Success message with auto-generated matric (e.g. `FPU/SST/CST/ND/26/001`) |
| 4 | Check inbox | Registration email arrives within 1 min |
| 5 | Check `notification_log` | `email/sent` and `inapp/sent` rows |
| 6 | Admin logs in → Pending Approvals | New student appears in list |
| 7 | Admin clicks **Approve** | Success toast; row disappears |
| 8 | Check student inbox | Activation email arrives |
| 9 | Check `notification_log` | Second `email/sent` row |
| 10 | Student logs in | Lands on dashboard |

**Result:** PASS

### 6.2 Scenario 2 — Full Result Lifecycle

| Step | Action | Expected Result |
|---|---|---|
| 1 | Lecturer logs in | Dashboard shows own courses |
| 2 | Lecturer creates assessment for CSC301 | Assessment appears in list |
| 3 | Lecturer enters scores for 5 students | Scores saved |
| 4 | Lecturer repeats for exam | Exam scores saved |
| 5 | Lecturer opens Results | Course CSC301 shows Draft |
| 6 | Lecturer selects and submits | Status changes to Submitted |
| 7 | HOD logs in → Result Submissions | Course appears with lecturer name |
| 8 | HOD views detail | Sees all 5 students with CA, exam, total, grade |
| 9 | HOD clicks **Approve** | Success; status = Approved |
| 10 | Admin logs in → Publish Results | Department with course visible |
| 11 | Admin clicks **Publish All** | Status = Published |
| 12 | Student logs in → My Results | Sees CSC301 result |
| 13 | Check notification_log | Result-published notification sent |

**Result:** PASS

### 6.3 Scenario 3 — Risk Engine and Intervention

| Step | Action | Expected Result |
|---|---|---|
| 1 | Admin → Risk Monitoring | Risk summary cards show counts |
| 2 | Click **Recompute Risk** | Progress modal; completes |
| 3 | View risk list | Students shown with categories |
| 4 | Click **Details** on a RED student | Modal with factors |
| 5 | Click **Intervene** | Modal with student context |
| 6 | Create intervention | Toast confirms |
| 7 | Close; list refreshes | Student shows **✓ Intervened** badge |
| 8 | Admin → Auto-Intervene High Risk | Bulk interventions created |
| 9 | Student logs in → Interventions | Assigned intervention appears |

**Result:** PASS

### 6.4 Scenario 4 — Course Registration Workflow

| Step | Action | Expected Result |
|---|---|---|
| 1 | Student logs in → My Courses | Empty initially |
| 2 | Click **+ Register Course** | Modal with available courses |
| 3 | Select 3 courses | Units counter updates |
| 4 | Click **Register Selected** | Success toast; 3 rows appear |
| 5 | Attempt to register beyond 20 units | Error: credit limit exceeded |
| 6 | Admin → Course Registration | Registered rows pending, grouped by dept |
| 7 | Click **Approve All (CS)** | All CS rows approved |
| 8 | Student → My Courses | Status shows approved |

**Result:** PASS

### 6.5 Scenario 5 — Department-Grouped Bulk Operations

| Step | Action | Expected Result |
|---|---|---|
| 1 | Admin → Students | Accordion of departments with counts |
| 2 | Expand Computer Science | Students table loads |
| 3 | Click **+ Add** | Modal has no matric field; info box visible |
| 4 | Fill and submit | Toast shows auto-generated matric |
| 5 | Admin → Lecturers | Same accordion |
| 6 | Admin → Courses | Accordion with level sub-grouping |
| 7 | Admin → Attendance | Accordion; each shows % |
| 8 | Click **Export** on one dept | CSV downloads with that dept's data |
| 9 | Admin → Results | Accordion by dept; course rows expanded |

**Result:** PASS

### 6.6 Scenario 6 — ID Card and QR Verification

| Step | Action | Expected Result |
|---|---|---|
| 1 | Student → ID Card | Card with photo/initials, QR code |
| 2 | Click **Print Card** | Print dialog; card on A4 |
| 3 | Scan QR with phone | Opens `/verify.html?matric=...` |
| 4 | Verification page loads | Shows student details |
| 5 | Admin → Batch ID Cards | Accordion; expand CS |
| 6 | Click **Print** on CS | 2 cards per A4 row |
| 7 | Click **Print All** | Every student's card |

**Result:** PASS

### 6.7 Scenario 7 — Responsive Layout

| Viewport | Check | Expected |
|---|---|---|
| 1280px | All pages | No horizontal page scroll |
| 768px | Sidebar | Collapses to hamburger |
| 768px | Tables | Horizontal scroll with hint |
| 375px | Forms | Stack vertically |
| 375px | Buttons | Full width |
| 375px | Modals | Fit viewport |

**Result:** PASS

### 6.8 Scenario 8 — Audit and Logging

| Step | Action | Expected Result |
|---|---|---|
| 1 | Admin approves a registration | Audit row: `approve_registration` |
| 2 | Admin → Audit Logs | Entry visible with timestamp, IP |
| 3 | Lecturer submits results | Audit row: `submit_results` |
| 4 | HOD approves | Audit row: `approve_results` |
| 5 | Admin publishes | Audit row: `publish_department` |

**Result:** PASS

---

## 7. Test Results Summary

| Category | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Unit tests | 21 | 21 | 0 | 0 |
| Integration tests (auth) | 8 | 8 | 0 | 0 |
| Integration tests (admin) | 8 | 8 | 0 | 0 |
| Integration tests (HOD) | 8 | 8 | 0 | 0 |
| Integration tests (lecturer) | 7 | 7 | 0 | 0 |
| Integration tests (student) | 10 | 10 | 0 | 0 |
| Integration tests (risk) | 3 | 3 | 0 | 0 |
| Manual end-to-end | 8 scenarios | 8 | 0 | 0 |

**Total pass rate:** 100% (excluding SMS, which is pending Termii sender-ID approval).

---

## 8. How to Run the Tests

### 8.1 Prerequisites

- Server running on `http://localhost:5000` (or set `TEST_BASE_URL`)
- Database seeded with demo data (`npm run seed-db`)

### 8.2 Run All Tests

```bash
npm test

8.3 Run Unit Tests Only
bash
npm run test:unit
8.4 Run in Watch Mode
bash
npm run test:watch
8.5 Manual API Testing
powershell
$body = '{"email":"admin@smartacademic.edu","password":"Admin@123"}'
$resp = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$token = ($resp.Content | ConvertFrom-Json).data.token
$headers = @{ Authorization = "Bearer $token" }
Invoke-WebRequest -Uri "http://localhost:5000/api/admin/dashboard" `
  -Headers $headers -UseBasicParsing | Select-Object -ExpandProperty Content
9. Known Limitations
Area	Issue	Status
SMS delivery	Termii sender ID not yet approved	Pending account action
Email fallback (Resend)	Free tier restricted to signup email	Not a blocker — Brevo SMTP works
Multi-instance rate limiting	In-memory store per instance	Documented; single-instance deployment
Password reset tokens	Stored in memory, lost on restart	Documented; acceptable for current scale
Recompute job store	In memory; not durable across restarts	Documented; jobs auto-expire after 10 min
10. Conclusion
SMARTACADEMIC has been tested at the unit, integration, and end-to-end levels. All tests pass. The system correctly enforces role-based access, generates matric numbers, dispatches notifications, computes risk, and produces reports.

The only incomplete feature is SMS delivery, which is blocked at the Termii account level rather than in the application code. Email notifications via Brevo SMTP work reliably in production.

