# Chapter One — Introduction

## 1.1 Background of the Study

Academic institutions in Nigeria face a persistent challenge: identifying students at risk of academic failure *before* that failure occurs. Traditionally, intervention only happens after poor results have been published — by which time a full semester has been lost, and reversing the damage is difficult or impossible.

Federal Polytechnic, Ugep (FPU) runs multiple ND and HND programmes across four schools:
- School of Engineering and Technology (SET)
- School of Science and Technology (SST)
- School of Environmental Studies (SES)
- School of Management and Social Sciences (SMSS)

Each department manages its own students, lecturers, and courses, but until now there has been no unified system that continuously monitors student performance and flags risk in real time.

SMARTACADEMIC is an **Academic Early-Warning System** designed to solve this problem. It continuously monitors attendance, Continuous Assessment (CA) scores, examination results, and GPA trends for every student, and classifies each one into one of four risk categories:

- **GREEN** — Good standing
- **YELLOW** — Needs attention
- **ORANGE** — High risk
- **RED** — Critical

Once a student enters a risk category, staff are notified and interventions are initiated — counselling, tutorials, meetings, and study support — so that support reaches the student *before* failure, not after.

## 1.2 Statement of the Problem

Current academic monitoring at Federal Polytechnic, Ugep relies on:

- Scattered spreadsheets for attendance
- Manual score entry into individual lecturer notebooks
- Physical result sheets passed between lecturers, HODs, and the exams office
- No mechanism to combine attendance, CA, exam, and GPA data into a single view
- No early warning — at-risk students are only discovered after results are compiled

This produces three major problems:

1. **Late detection.** By the time a student's cumulative record reveals a problem, remediation is no longer possible within the semester.
2. **Data fragmentation.** Attendance, assessment, and result data live in separate systems or on paper. Cross-analysis requires manual work.
3. **Reactive interventions.** Counselling and support only happen *after* failure, when the student has already lost a semester.

## 1.3 Aim and Objectives

**Aim:**  
To design and implement a web-based Academic Early-Warning System that continuously monitors student performance and enables timely intervention.

**Specific Objectives:**

1. To design a normalized relational database that integrates students, lecturers, courses, sessions, attendance, assessments, results, and risk assessments.
2. To implement an automated grading and GPA computation engine that converts raw scores into grades, grade points, GPA, and CGPA.
3. To develop a rule-based Risk Engine that classifies students into GREEN, YELLOW, ORANGE, and RED categories based on weighted factors.
4. To build role-based dashboards for Admin, HOD, Lecturer, and Student users.
5. To implement an Intervention Workflow that connects at-risk students to academic support.
6. To produce reports (PDF, CSV, Excel) for decision-making and record-keeping.

## 1.4 Significance of the Study

- **Students** receive early warnings and support instead of failing silently.
- **Lecturers** identify at-risk students in their own courses without manual cross-checking.
- **HODs** see department-wide analytics and can allocate academic resources where they're needed.
- **Admins** gain a system-wide view of institutional health and can enforce consistent standards.
- **The institution** reduces attrition, improves graduation rates, and generates auditable records.

## 1.5 Scope of the Study

SMARTACADEMIC covers:

- All four schools at Federal Polytechnic, Ugep
- Both ND and HND programmes
- Attendance, CA, exams, results, GPA, risk, and interventions

The system does **not** cover:

- Fee payments or financial records (beyond a flag for fee-paid/unpaid status)
- Hostel allocation
- Library management
- Timetable scheduling
- Learning Management System (LMS) features

## 1.6 Limitations

- SMS delivery depends on Termii's sender-ID approval and network coverage.
- Email delivery depends on internet access and (for some deployments) third-party relay services.
- The Risk Engine uses configurable weights and thresholds; institutions may need to tune these.
- The system is designed for a single institution; multi-tenant support is out of scope.

## 1.7 Definition of Terms

| Term | Definition |
|---|---|
| **Early Warning** | The process of detecting an at-risk student before academic failure. |
| **Risk Category** | One of GREEN, YELLOW, ORANGE, or RED assigned to a student. |
| **Intervention** | Any action taken by staff to help an at-risk student. |
| **CA Score** | Continuous Assessment mark (usually out of 30). |
| **Exam Score** | Examination mark (usually out of 70). |
| **GPA** | Grade Point Average for a single semester. |
| **CGPA** | Cumulative Grade Point Average across all semesters. |
| **ND / HND** | National Diploma / Higher National Diploma. |
| **NBTE** | National Board for Technical Education. |