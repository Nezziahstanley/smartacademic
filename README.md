# 🎓 SMARTACADEMIC

**An Academic Early-Warning System that detects at-risk students *before* they fail.**

SMARTACADEMIC continuously monitors attendance, assessments, results, and GPA trends to classify every student as GREEN, YELLOW, ORANGE, or RED — and triggers timely interventions that connect students with academic support.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Demo Accounts](#-demo-accounts)
- [Architecture](#-architecture)
- [API Overview](#-api-overview)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Author](#-author)
- [License](#-license)

---

## ✨ Features

### For Administrators
- Full user management (admin, HOD, lecturer, student)
- Departments, programmes, courses, sessions, semesters
- Course registration, attendance, results management
- Live risk monitoring dashboard
- Intervention workflow
- Reports (PDF, CSV, Excel export)
- Audit logs and system settings

### For HODs
- Department-scoped dashboard
- Monitor students, lecturers, courses
- Track attendance and performance
- View at-risk students
- Create and assign interventions

### For Lecturers
- Manage assigned courses
- Record attendance per class session
- Create assessments (CA, tests, exams)
- Enter and edit scores
- View at-risk students in their courses
- Update intervention progress

### For Students
- Personal academic dashboard
- View registered courses
- Track attendance percentage
- View results and GPA/CGPA
- Academic status (risk level)
- Receive intervention notifications
- Access support resources

### Core Intelligence
- **Academic Engine** — auto-computes results, GPA, CGPA from raw scores
- **Risk Engine** — weighted scoring (attendance, CA, exam, failed courses, GPA decline) → 4-tier classification
- **Early Warning** — automatic notifications to staff when risk thresholds are crossed
- **Intervention Workflow** — detect → assign → notify → monitor → close

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS, Chart.js |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 14+ |
| Auth | JWT + bcrypt |
| Validation | express-validator |
| Security | helmet, CORS, express-rate-limit |
| Reports | pdfkit, json2csv, exceljs |
| Testing | Jest + Supertest |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pgAdmin (optional)

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd smartacademic
npm install