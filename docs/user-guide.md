
---

### `docs/user-guide.md`

```markdown
# User Guide

This guide explains how to use SMARTACADEMIC for each role.

---

## 1. General

### 1.1 Logging In

1. Open `/login.html`
2. Enter your email and password
3. You'll land on your role-specific dashboard

### 1.2 Forgot Password

1. On the login page, click **Forgot password?**
2. Enter your email
3. Check your inbox for the reset link

### 1.3 Notifications

Click the bell icon in the topbar to view notifications. Unread items are highlighted. Click any item to be taken to the relevant page.

### 1.4 Changing Your Profile

Click your name in the topbar → **My Profile**. From there you can update your name, phone, and photo, or change your password.

### 1.5 Mobile Use

All pages work on phones and tablets. On mobile:
- The sidebar collapses into a hamburger menu
- Tables scroll horizontally (look for "→ scroll →")
- Cards and forms stack vertically

---

## 2. For Students

### 2.1 Registering

1. Open `/register.html`
2. Select the **Student** tab
3. Fill in: full name, email, phone, department, programme, level, admission year, password
4. Your matric number is assigned automatically — you'll see it in the success message
5. Wait for admin approval. You'll receive an email and SMS

### 2.2 Logging In

Once approved, log in at `/login.html` with the email and password you registered with.

### 2.3 Registering for Courses

1. Sidebar → **My Courses**
2. Click **+ Register Course**
3. Pick courses from the modal (they're grouped by level)
4. Units are tracked against your minimum (15) and maximum (20 for ND / 18 for HND)
5. Click **Register Selected**

### 2.4 Viewing Your Attendance

Sidebar → **My Attendance**. See per-course attendance %, recent sessions, and your present/absent/excused totals.

### 2.5 Viewing Your Results

Sidebar → **My Results**. You'll see:
- GPA per semester with running CGPA
- Each published result with CA, exam, total, and grade

### 2.6 Checking Your Academic Status

Sidebar → **Academic Status**. This shows your current risk category and contributing factors.

| Category | Meaning |
|---|---|
| 🟢 GREEN | Good standing |
| 🟡 YELLOW | Needs attention |
| 🟠 ORANGE | High risk |
| 🔴 RED | Critical |

### 2.7 Interventions

Sidebar → **Interventions**. If staff have assigned you support actions, they show here with title, type, assignee, and status.

### 2.8 Your ID Card

Sidebar → **ID Card**. Your card includes:
- Name, matric, department, programme, level
- A QR code linking to a public verification page
- A print button

Print it on A4 or save as PDF.

### 2.9 Updating Your Profile

Sidebar → **Profile**. Update name, phone, photo, and password.

---

## 3. For Lecturers

### 3.1 Dashboard

Sidebar → **Dashboard**. Shows:
- Your courses
- Total students
- At-risk students in your courses
- Average attendance

### 3.2 Recording Attendance

1. Sidebar → **Attendance**
2. Select a course
3. Click **+ New Class Session** to create a session (date, times, topic)
4. Click **Record** on a session to open the roster
5. Mark each student present/absent/excused (or use **Mark all present**)
6. Save

### 3.3 Creating Assessments

1. Sidebar → **Assessments**
2. Click **+ New Assessment**
3. Choose type (assignment / test / CA / exam), title, max score, weight, due date

### 3.4 Entering Scores

1. In **Assessments**, click **Enter Scores** on an assessment
2. Fill in each student's score (leave blank to remove a score)
3. Use **Fill max / Fill zero / Clear all** for quick entry
4. Save

### 3.5 Submitting Results to Your HOD

1. Sidebar → **Results**
2. Review the status of each course (Draft / Submitted / Approved / Returned)
3. Select the courses you're ready to submit
4. Click **📤 Submit Selected to HOD**

Your HOD reviews and either approves or returns with a reason. You'll see the reason if returned.

### 3.6 Viewing At-Risk Students

Sidebar → **At-Risk Students**. Every at-risk student in your courses appears here. You can:
- **📝 Intervene** — create a direct intervention
- **⬆️ Report to HOD** — flag the student for the HOD to handle

### 3.7 Messaging Your Students

Sidebar → **Notifications** → **📢 Notify My Students**. This sends an in-app message to every student registered in your courses.

### 3.8 Reports

Sidebar → **Reports**. View course performance, attendance, and grade distribution. Export as CSV.

---

## 4. For HODs

### 4.1 Dashboard

Sidebar → **Dashboard**. Department-scoped KPIs, risk distribution, and high-risk students.

### 4.2 Students and Lecturers

Sidebar → **Students** — every student in your department with their risk category.  
Sidebar → **Lecturers** — every lecturer in your department with their course load.

### 4.3 Courses

Sidebar → **Courses**. Create, edit, and assign lecturers to courses. Only courses in your department appear here.

### 4.4 Approving Result Submissions

1. Sidebar → **Result Submissions**
2. Filter by status: Submitted / Approved / Returned
3. Click **View** to see all student results
4. Click **✓ Approve** to approve, or **↩ Return** to send back with a reason

You can select multiple courses and approve them in bulk.

### 4.5 Risk Monitoring

Sidebar → **Risk Monitoring**. Filter by category and level. Click **+ Intervene** on any student to create an intervention.

Students who already have an active intervention show a green **✓ Intervened** badge.

### 4.6 Interventions

Sidebar → **Interventions**. Two ways to create:
- **From a specific student**: use **+ Intervene** on the Risk Monitoring page
- **General**: click **+ New Intervention**, pick a student from the dropdown, then fill in details

Track status changes: Pending → In Progress → Completed → Closed.

### 4.7 Performance Analytics

Sidebar → **Performance**. Charts for GPA by level, top performers, and most-failed courses.

### 4.8 Submissions to Admin

Sidebar → **Submissions**. Propose new students, lecturers, or courses. Admin reviews and either approves or rejects with a reason.

### 4.9 Broadcast to Department

Sidebar → **Notifications** → **📢 Broadcast to Department**. Sends a message to every student and lecturer in your department.

---

## 5. For Admins

### 5.1 Dashboard

Sidebar → **Dashboard**. System-wide KPIs, attendance trend chart, risk distribution chart, and a snapshot of high-risk students.

Click **Open Risk Monitoring** to go to the full risk page.

### 5.2 Users

Sidebar → **Users**. Full CRUD over all accounts. You can:
- Create users directly
- Reset passwords
- Toggle active/inactive
- Delete users

Sidebar → **Pending Approvals** for self-registered students awaiting activation.

### 5.3 Departments, Programmes, Courses

All grouped pages let you expand a department to see its contents.

- **Departments** — schools and depts with HOD assignment
- **Programmes** — ND / HND programmes under departments
- **Courses** — courses per department, grouped by level
- **Sessions** / **Semesters** — academic calendar

### 5.4 Course Registration

Sidebar → **Course Registration**. Approve or drop registrations, grouped by department. Bulk-approve every pending registration in one department at once.

You can also **mark fees paid** for a student, which auto-approves all their pending registrations.

### 5.5 Attendance

Sidebar → **Attendance**. All attendance records grouped by department. Filter by date range, search by student or course, and export a CSV per department.

### 5.6 Results

Sidebar → **Results**. All results grouped by department → course → student. Filter by submission status or publish status.

### 5.7 Publishing Results

Sidebar → **Publish Results**. Only **HOD-approved** results appear here, grouped by department.

Per department:
- Click **📤 Publish All** to publish every approved result in one click
- Click **Unpublish** to hide results from students again

Bulk actions:
- Select multiple departments → **📤 Publish Selected Departments**
- Publishing 4+ departments at once requires typing `PUBLISH` to confirm

### 5.8 Risk Monitoring

Sidebar → **Risk Monitoring**. Full student risk list with filters. Two buttons at the top:
- **↻ Recompute Risk** — runs the risk engine over all students (shows progress)
- **🤝 Auto-Intervene High Risk** — creates interventions for all ORANGE/RED students without an open one

### 5.9 Interventions

Sidebar → **Interventions**. View, create, edit, and delete any intervention.

### 5.10 Notifications

Sidebar → **Notifications**. Broadcast to any role (admin, HOD, lecturer, student). You also see recent notifications sent across the system.

### 5.11 Reports

Sidebar → **Reports**. Risk distribution, departmental performance, and attendance report. Each is exportable as CSV, PDF, or Excel.

### 5.12 Audit Logs

Sidebar → **Audit Logs**. Every action taken in the system, with actor, module, record, and IP. Filter by module or search.

### 5.13 Settings

Sidebar → **Settings**. Configure:
- Institution info
- Academic session / semester
- Grading thresholds
- Attendance thresholds
- Risk weights and thresholds
- Notification toggles
- Advanced options

### 5.14 ID Cards

Sidebar → **Batch ID Cards**. Students grouped by department. Expand a department to see all cards with photos and QR codes. Print a single department or all at once.

### 5.15 Your Profile

Sidebar → **Profile**. Update name, phone, photo, password. Upload a profile picture that shows in the topbar.

---

## 6. Common Tasks

| Task | Who | Path |
|---|---|---|
| Register a student | Student | `/register.html` |
| Approve a pending student | Admin | `/admin/pending-users.html` |
| Register for courses | Student | `/student/my-courses.html` |
| Record attendance | Lecturer | `/lecturer/attendance.html` |
| Enter scores | Lecturer | `/lecturer/assessments.html` |
| Submit results to HOD | Lecturer | `/lecturer/results.html` |
| Approve results | HOD | `/hod/result-submissions.html` |
| Publish results | Admin | `/admin/publish-results.html` |
| Create an intervention | HOD/Lecturer | `/hod/interventions.html` |
| Recompute risk | Admin | `/admin/risk-monitoring.html` |
| Print a student ID card | Student | `/student/id-card.html` |
| Print batch ID cards | Admin | `/admin/id-cards-batch.html` |

---

## 7. Support

If something doesn't work:

1. Hard refresh the browser (Ctrl + Shift + R)
2. Check the browser console (F12) for errors
3. Contact the system administrator