# Chapter Three — System Analysis and Design

## 3.1 Introduction

This chapter describes the methodology used, the analysis of the existing system, the requirements, and the design of the SMARTACADEMIC system.

## 3.2 Research Methodology

The project used the **Structured System Analysis and Design Method (SSADM)** combined with **Agile** iteration for implementation. SSADM provided structure for requirements and data modelling; Agile allowed incremental development and continuous testing.

Data collection methods:

- **Interviews** with lecturers, HODs, and admin staff at FPU
- **Observation** of current result-processing workflows
- **Document analysis** of NBTE curriculum guides, FPU result sheets, and grading policies

## 3.3 Analysis of the Existing System

### 3.3.1 Current Workflow

1. Lecturer records attendance on paper
2. Lecturer enters CA and exam scores manually
3. Results compiled course-by-course
4. HOD reviews and signs
5. Exams office consolidates
6. Results published on notice boards
7. At-risk students identified (if at all) after publication

### 3.3.2 Weaknesses

- Attendance is unlinked from assessment
- No cross-semester GPA tracking at the student level
- No department-wide or institution-wide risk view
- Data is not queryable
- Reports must be produced by hand

## 3.4 Requirements Specification

### 3.4.1 Functional Requirements

**Admin**
- FR-A1: Manage all users (create, edit, deactivate, delete)
- FR-A2: Manage departments, programmes, courses, sessions, semesters
- FR-A3: Approve or reject pending registrations
- FR-A4: Approve/drop course registrations; mark fees paid
- FR-A5: Publish results by department (bulk)
- FR-A6: View risk across departments; recompute risk engine
- FR-A7: Manage interventions
- FR-A8: View audit logs
- FR-A9: Configure system settings

**HOD**
- FR-H1: View department-scoped dashboards
- FR-H2: Manage department courses and lecturer assignments
- FR-H3: Review and approve/reject result submissions from lecturers
- FR-H4: Monitor risk in the department
- FR-H5: Create interventions
- FR-H6: Propose new students/lecturers/courses for admin approval

**Lecturer**
- FR-L1: View only courses assigned to them
- FR-L2: Record attendance per class session
- FR-L3: Create assessments and enter scores
- FR-L4: Submit results to HOD (individually or in bulk)
- FR-L5: View at-risk students in their courses
- FR-L6: Create interventions or report to HOD

**Student**
- FR-S1: Register for courses within credit-unit limits
- FR-S2: View attendance, results, GPA/CGPA
- FR-S3: View academic risk status
- FR-S4: Receive and view interventions
- FR-S5: Print an ID card with QR verification

### 3.4.2 Non-Functional Requirements

- **Security:** JWT authentication, bcrypt hashing, role-based access, rate limiting
- **Performance:** Dashboard queries under 500ms for 1000+ students
- **Availability:** 99%+ uptime on managed PaaS
- **Usability:** Responsive down to 375px mobile width
- **Portability:** Runs on any Linux/Node.js host with PostgreSQL
- **Auditability:** All mutating actions logged

## 3.5 System Architecture

Three-tier architecture:

1. **Presentation Tier** — HTML/CSS/JS served statically, plus REST API calls
2. **Application Tier** — Node.js + Express with controllers, services, and middleware
3. **Data Tier** — PostgreSQL

Supporting services:
- **Engines:** academicEngine, riskEngine, assessmentEngine, attendanceEngine
- **Services:** emailService, smsService, notificationDispatcher, interventionService
- **Integrations:** Brevo (email), Resend (email fallback), Termii (SMS)

## 3.6 Database Design

### 3.6.1 Entity List

| Table | Purpose |
|---|---|
| `roles` | Role definitions |
| `users` | Base accounts (all roles) |
| `departments` | Schools / departments |
| `programmes` | ND / HND programmes |
| `lecturers` | Lecturer profiles |
| `students` | Student profiles |
| `sessions` | Academic sessions (e.g. 2024/2025) |
| `semesters` | First / Second semester within a session |
| `courses` | Course catalogue |
| `course_registrations` | Which student registered for which course |
| `class_sessions` | Individual class meetings |
| `attendance` | Attendance per student per class session |
| `assessments` | Assignments, tests, CA, exams per course |
| `scores` | Individual student scores per assessment |
| `results` | Final computed results per student per course |
| `risk_assessments` | Risk snapshots |
| `interventions` | Support actions |
| `notifications` | In-app notifications |
| `notification_log` | Email/SMS delivery audit |
| `audit_logs` | Immutable action log |
| `settings` | Configurable system values |

### 3.6.2 Key Relationships

- Users have one role; have one student OR lecturer profile
- Students belong to one department and one programme
- Courses belong to one department; optionally to one programme; optionally have a lecturer
- Course registrations link students to courses within a session+semester
- Class sessions belong to a course
- Attendance links class sessions to students
- Assessments belong to a course
- Scores link assessments to students
- Results link students to courses within a session+semester
- Risk assessments link students to sessions+semesters
- Interventions link students to staff (assignee)

## 3.7 Input / Output Design

### 3.7.1 Inputs

- Admin CRUD forms (users, departments, programmes, courses, sessions, semesters)
- Approval actions (pending users, registrations, submissions)
- HOD result approval / return
- Lecturer attendance, assessment, and score entry
- Student course registration

### 3.7.2 Outputs

- Dashboards per role
- Risk monitoring lists
- Attendance summaries
- GPA / CGPA summaries
- PDF / Excel / CSV reports
- Emails and SMS notifications
- In-app notifications
- QR-coded ID cards

## 3.8 Process Design

### 3.8.1 Risk Engine Process

1. Load weights and thresholds from settings
2. For each active student, gather:
   - Attendance %
   - CA average
   - Exam average
   - Failed course count
   - GPA and GPA decline
3. Compute weighted risk score (0–100)
4. Classify into GREEN / YELLOW / ORANGE / RED
5. Upsert into `risk_assessments`
6. Notify affected staff (HOD, lecturers, admin)

### 3.8.2 Result Submission Workflow

1. Lecturer enters scores in assessments
2. System computes CA (30%) + Exam (70%) = Total
3. Grades + grade points assigned
4. Lecturer submits → `submission_status = 'submitted'`
5. HOD approves → `submission_status = 'approved'`
6. Admin publishes → `is_published = TRUE`, students see it

### 3.8.3 Registration Workflow

1. Student self-registers → `users.is_active = FALSE`
2. Auto-generated matric assigned
3. Confirmation email + SMS dispatched
4. Admin reviews at `/admin/pending-users.html`
5. On approval → `is_active = TRUE`, activation email + SMS dispatched
6. Student logs in and registers for courses

## 3.9 Security Design

- Passwords hashed with bcrypt (10 rounds)
- JWT signed with a 64-byte secret
- Role-based middleware (`requireRole`, `requireDepartmentAccess`, `requireCourseAccess`)
- Rate limiting on `/api/auth/*` and password reset
- Helmet with a tuned Content Security Policy
- Audit log records user_id, IP, and details for every mutation
- Students, lecturers, and HODs see only their own scope

## 3.10 Choice of Development Tools

| Tool | Reason |
|---|---|
| VS Code | Free, first-class JS support |
| PostgreSQL + pgAdmin | Mature, free, supports advanced SQL |
| Node.js + Express | Simple, widely taught, huge ecosystem |
| Vanilla JS frontend | No build step, easy for evaluators to inspect |
| Chart.js | Lightweight, one-line inclusion |
| Postman / curl | API testing |
| Render | Free-tier PaaS with auto-deploy from Git |
| Neon | Serverless Postgres with generous free tier |