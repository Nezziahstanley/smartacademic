-- ============================================================
-- SMARTACADEMIC — PostgreSQL Database Schema
-- Version: 1.0
-- Author: SMARTACADEMIC Project
-- Description: Full schema for academic early-warning system
-- Run via: node scripts/init-db.js
-- ============================================================

-- ============================================================
-- 0. CLEAN SLATE (safe for dev only — comments out in prod)
-- ============================================================
DROP TABLE IF EXISTS audit_logs            CASCADE;
DROP TABLE IF EXISTS notifications         CASCADE;
DROP TABLE IF EXISTS interventions         CASCADE;
DROP TABLE IF EXISTS risk_assessments      CASCADE;
DROP TABLE IF EXISTS results               CASCADE;
DROP TABLE IF EXISTS scores                CASCADE;
DROP TABLE IF EXISTS assessments           CASCADE;
DROP TABLE IF EXISTS attendance            CASCADE;
DROP TABLE IF EXISTS class_sessions        CASCADE;
DROP TABLE IF EXISTS course_registrations  CASCADE;
DROP TABLE IF EXISTS courses               CASCADE;
DROP TABLE IF EXISTS semesters             CASCADE;
DROP TABLE IF EXISTS sessions              CASCADE;
DROP TABLE IF EXISTS settings              CASCADE;
DROP TABLE IF EXISTS students              CASCADE;
DROP TABLE IF EXISTS lecturers             CASCADE;
DROP TABLE IF EXISTS programmes            CASCADE;
DROP TABLE IF EXISTS departments           CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;
DROP TABLE IF EXISTS roles                 CASCADE;

-- Enable UUID generation if needed later (optional)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(20) UNIQUE NOT NULL
              CHECK (name IN ('admin','hod','lecturer','student')),
  description VARCHAR(150),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'System roles: admin, hod, lecturer, student';

-- ============================================================
-- 2. USERS  (base identity for every role)
-- ============================================================
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(150) UNIQUE NOT NULL,
  phone          VARCHAR(20),
  password_hash  TEXT NOT NULL,
  role_id        INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_pw BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email      ON users(LOWER(email));
CREATE INDEX idx_users_role       ON users(role_id);
CREATE INDEX idx_users_is_active  ON users(is_active);

COMMENT ON TABLE users IS 'Base account table for all roles';

-- ============================================================
-- 3. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) UNIQUE NOT NULL,
  code        VARCHAR(10) UNIQUE,
  hod_id      INT REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_hod ON departments(hod_id);

COMMENT ON TABLE departments IS 'Academic departments (e.g., Computer Science)';

-- ============================================================
-- 4. PROGRAMMES
-- ============================================================
CREATE TABLE programmes (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  code           VARCHAR(15)  UNIQUE,
  department_id  INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  duration_years INT NOT NULL DEFAULT 4,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, name)
);

CREATE INDEX idx_programmes_dept ON programmes(department_id);

COMMENT ON TABLE programmes IS 'Degree programmes under each department';

-- ============================================================
-- 5. LECTURERS  (profile for users with role=lecturer)
-- ============================================================
CREATE TABLE lecturers (
  id             SERIAL PRIMARY KEY,
  user_id        INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id       VARCHAR(30) UNIQUE NOT NULL,
  department_id  INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  title          VARCHAR(30),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lecturers_dept ON lecturers(department_id);

COMMENT ON TABLE lecturers IS 'Lecturer profiles linked to users';

-- ============================================================
-- 6. STUDENTS  (profile for users with role=student)
-- ============================================================
CREATE TABLE students (
  id             SERIAL PRIMARY KEY,
  user_id        INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matric_no      VARCHAR(30) UNIQUE NOT NULL,
  department_id  INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  programme_id   INT NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
  level          INT NOT NULL CHECK (level BETWEEN 100 AND 700),
  admission_year INT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_dept      ON students(department_id);
CREATE INDEX idx_students_programme ON students(programme_id);
CREATE INDEX idx_students_level     ON students(level);

COMMENT ON TABLE students IS 'Student profiles linked to users';

-- ============================================================
-- 7. SESSIONS  (academic sessions, e.g. 2024/2025)
-- ============================================================
CREATE TABLE sessions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(20) UNIQUE NOT NULL,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one session can be active at a time
CREATE UNIQUE INDEX idx_sessions_single_active
  ON sessions(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE sessions IS 'Academic sessions (e.g. 2024/2025)';

-- ============================================================
-- 8. SEMESTERS  (First / Second within a session)
-- ============================================================
CREATE TABLE semesters (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        VARCHAR(20) NOT NULL
              CHECK (name IN ('First','Second','Summer')),
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, name)
);

CREATE INDEX idx_semesters_session ON semesters(session_id);

-- Only one semester can be active at a time
CREATE UNIQUE INDEX idx_semesters_single_active
  ON semesters(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE semesters IS 'Semesters within a session';

-- ============================================================
-- 9. COURSES
-- ============================================================
CREATE TABLE courses (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(15) UNIQUE NOT NULL,
  title          VARCHAR(150) NOT NULL,
  units          INT NOT NULL CHECK (units BETWEEN 1 AND 6),
  department_id  INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  programme_id   INT REFERENCES programmes(id) ON DELETE SET NULL,
  level          INT NOT NULL CHECK (level BETWEEN 100 AND 700),
  semester_name  VARCHAR(20) NOT NULL
                 CHECK (semester_name IN ('First','Second','Summer')),
  lecturer_id    INT REFERENCES lecturers(id) ON DELETE SET NULL,
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_dept     ON courses(department_id);
CREATE INDEX idx_courses_lecturer ON courses(lecturer_id);
CREATE INDEX idx_courses_level    ON courses(level);

COMMENT ON TABLE courses IS 'Course catalogue';

-- ============================================================
-- 10. COURSE REGISTRATIONS
-- ============================================================
CREATE TABLE course_registrations (
  id           SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  course_id    INT NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
  session_id   INT NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  semester_id  INT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  status       VARCHAR(15) NOT NULL DEFAULT 'registered'
               CHECK (status IN ('registered','approved','dropped')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id, session_id, semester_id)
);

CREATE INDEX idx_reg_student  ON course_registrations(student_id);
CREATE INDEX idx_reg_course   ON course_registrations(course_id);
CREATE INDEX idx_reg_session  ON course_registrations(session_id, semester_id);

COMMENT ON TABLE course_registrations IS 'Courses each student has registered for';

-- ============================================================
-- 11. CLASS SESSIONS  (a specific class meeting)
-- ============================================================
CREATE TABLE class_sessions (
  id           SERIAL PRIMARY KEY,
  course_id    INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time   TIME,
  end_time     TIME,
  topic        VARCHAR(200),
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, session_date, start_time)
);

CREATE INDEX idx_class_sessions_course ON class_sessions(course_id);
CREATE INDEX idx_class_sessions_date   ON class_sessions(session_date);

COMMENT ON TABLE class_sessions IS 'Individual class meetings for attendance';

-- ============================================================
-- 12. ATTENDANCE
-- ============================================================
CREATE TABLE attendance (
  id                SERIAL PRIMARY KEY,
  class_session_id  INT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id        INT NOT NULL REFERENCES students(id)       ON DELETE CASCADE,
  status            VARCHAR(10) NOT NULL
                    CHECK (status IN ('present','absent','excused')),
  remarks           VARCHAR(200),
  recorded_by       INT REFERENCES users(id) ON DELETE SET NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_session_id, student_id)
);

CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_status  ON attendance(status);
CREATE INDEX idx_attendance_session ON attendance(class_session_id);

COMMENT ON TABLE attendance IS 'Attendance record per student per class session';

-- ============================================================
-- 13. ASSESSMENTS  (assignment / test / CA / exam)
-- ============================================================
CREATE TABLE assessments (
  id           SERIAL PRIMARY KEY,
  course_id    INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id   INT REFERENCES sessions(id)  ON DELETE SET NULL,
  semester_id  INT REFERENCES semesters(id) ON DELETE SET NULL,
  type         VARCHAR(20) NOT NULL
               CHECK (type IN ('assignment','test','ca','exam')),
  title        VARCHAR(120) NOT NULL,
  max_score    INT NOT NULL CHECK (max_score > 0),
  weight       INT NOT NULL DEFAULT 0 CHECK (weight >= 0),
  due_date     DATE,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_course ON assessments(course_id);
CREATE INDEX idx_assessments_type   ON assessments(type);

COMMENT ON TABLE assessments IS 'Assignments, tests, CA, exams for a course';

-- ============================================================
-- 14. SCORES
-- ============================================================
CREATE TABLE scores (
  id             SERIAL PRIMARY KEY,
  assessment_id  INT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id     INT NOT NULL REFERENCES students(id)    ON DELETE CASCADE,
  score          NUMERIC(6,2) NOT NULL CHECK (score >= 0),
  entered_by     INT REFERENCES users(id) ON DELETE SET NULL,
  entered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, student_id)
);

CREATE INDEX idx_scores_student    ON scores(student_id);
CREATE INDEX idx_scores_assessment ON scores(assessment_id);

COMMENT ON TABLE scores IS 'Individual student scores per assessment';

-- ============================================================
-- 15. RESULTS  (computed per student per course per semester)
-- ============================================================
CREATE TABLE results (
  id           SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  course_id    INT NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
  session_id   INT NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  semester_id  INT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  ca_score     NUMERIC(5,2) DEFAULT 0,
  exam_score   NUMERIC(5,2) DEFAULT 0,
  total_score  NUMERIC(5,2) DEFAULT 0,
  grade        VARCHAR(2),
  grade_point  NUMERIC(3,2),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id, session_id, semester_id)
);

CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_course  ON results(course_id);
CREATE INDEX idx_results_session ON results(session_id, semester_id);

COMMENT ON TABLE results IS 'Final computed results per student per course';

-- ============================================================
-- 16. RISK ASSESSMENTS  (output of Risk Engine)
-- ============================================================
CREATE TABLE risk_assessments (
  id                SERIAL PRIMARY KEY,
  student_id        INT NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  session_id        INT NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  semester_id       INT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  risk_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_category     VARCHAR(10) NOT NULL
                    CHECK (risk_category IN ('GREEN','YELLOW','ORANGE','RED')),
  attendance_pct    NUMERIC(5,2) DEFAULT 0,
  ca_avg            NUMERIC(5,2) DEFAULT 0,
  exam_avg          NUMERIC(5,2) DEFAULT 0,
  failed_courses    INT DEFAULT 0,
  gpa               NUMERIC(3,2) DEFAULT 0,
  cgpa              NUMERIC(3,2) DEFAULT 0,
  gpa_decline       NUMERIC(3,2) DEFAULT 0,
  factors           TEXT,
  assessed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_student  ON risk_assessments(student_id);
CREATE INDEX idx_risk_category ON risk_assessments(risk_category);
CREATE INDEX idx_risk_date     ON risk_assessments(assessed_at);

COMMENT ON TABLE risk_assessments IS 'Risk snapshots produced by the Risk Engine';

-- ============================================================
-- 17. INTERVENTIONS
-- ============================================================
CREATE TABLE interventions (
  id                  SERIAL PRIMARY KEY,
  student_id          INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  risk_assessment_id  INT REFERENCES risk_assessments(id) ON DELETE SET NULL,
  type                VARCHAR(50) NOT NULL
                      CHECK (type IN (
                        'academic_counselling',
                        'tutorial_recommendation',
                        'lecturer_meeting',
                        'hod_meeting',
                        'attendance_improvement',
                        'study_support',
                        'course_advisory',
                        'other'
                      )),
  title               VARCHAR(150) NOT NULL,
  description         TEXT,
  assigned_to         INT REFERENCES users(id) ON DELETE SET NULL,
  priority            VARCHAR(10) NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high','critical')),
  status              VARCHAR(20) NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending','In Progress','Completed','Closed')),
  notes               TEXT,
  due_date            DATE,
  completed_at        TIMESTAMPTZ,
  created_by          INT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interventions_student  ON interventions(student_id);
CREATE INDEX idx_interventions_assigned ON interventions(assigned_to);
CREATE INDEX idx_interventions_status   ON interventions(status);

COMMENT ON TABLE interventions IS 'Interventions created for at-risk students';

-- ============================================================
-- 18. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(150) NOT NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(30) NOT NULL DEFAULT 'system'
              CHECK (type IN (
                'risk_alert','attendance_alert','result','intervention',
                'announcement','system'
              )),
  related_id  INT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user     ON notifications(user_id);
CREATE INDEX idx_notifications_is_read  ON notifications(is_read);
CREATE INDEX idx_notifications_created  ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'Per-user notifications';

-- ============================================================
-- 19. AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id                SERIAL PRIMARY KEY,
  user_id           INT REFERENCES users(id) ON DELETE SET NULL,
  action            VARCHAR(100) NOT NULL,
  module            VARCHAR(50)  NOT NULL,
  affected_record   VARCHAR(100),
  details           JSONB,
  ip_address        VARCHAR(45),
  user_agent        VARCHAR(255),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_module ON audit_logs(module);
CREATE INDEX idx_audit_date   ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Immutable activity log for compliance';

-- ============================================================
-- 20. SETTINGS  (key/value configuration)
-- ============================================================
CREATE TABLE settings (
  key         VARCHAR(60) PRIMARY KEY,
  value       TEXT NOT NULL,
  category    VARCHAR(30) NOT NULL DEFAULT 'general',
  description VARCHAR(200),
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE settings IS 'Configurable system settings (grading, thresholds, etc.)';

-- ============================================================
-- 21. TRIGGER — auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'users','departments','programmes','lecturers','students',
      'sessions','semesters','courses','assessments','scores',
      'interventions','settings'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- 22. DEFAULT SETTINGS ROWS
-- ============================================================
INSERT INTO settings (key, value, category, description) VALUES
  ('institution_name',        'SMARTACADEMIC University',       'general',      'Name of the institution'),
  ('institution_email',       'info@smartacademic.edu',         'general',      'Contact email'),
  ('current_session_id',      '',                                'academic',     'Active session ID'),
  ('current_semester_id',     '',                                'academic',     'Active semester ID'),
  ('attendance_threshold',    '75',                              'attendance',   'Minimum attendance % required'),
  ('attendance_warning',      '70',                              'attendance',   'Attendance % that triggers a warning'),
  ('ca_threshold',            '50',                              'assessment',   'Minimum CA average %'),
  ('exam_threshold',          '40',                              'assessment',   'Minimum exam average %'),
  ('risk_weight_attendance',  '25',                              'risk',         'Weight (%) for attendance in risk score'),
  ('risk_weight_ca',          '20',                              'risk',         'Weight (%) for CA in risk score'),
  ('risk_weight_exam',        '20',                              'risk',         'Weight (%) for exam in risk score'),
  ('risk_weight_failed',      '20',                              'risk',         'Weight (%) for failed courses'),
  ('risk_weight_gpa_decline', '15',                              'risk',         'Weight (%) for GPA decline'),
  ('risk_yellow_min',         '25',                              'risk',         'Min score for YELLOW'),
  ('risk_orange_min',         '50',                              'risk',         'Min score for ORANGE'),
  ('risk_red_min',            '75',                              'risk',         'Min score for RED')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 23. GRADING SCALE (used by result engine — informational)
-- ============================================================
-- A  : 70-100 → 5.0
-- B  : 60-69  → 4.0
-- C  : 50-59  → 3.0
-- D  : 45-49  → 2.0
-- E  : 40-44  → 1.0
-- F  : 0-39   → 0.0

-- ============================================================
-- END OF SCHEMA
-- ============================================================