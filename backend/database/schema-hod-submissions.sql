-- ============================================================
-- SMARTACADEMIC — HOD Submissions
-- Allows HODs to propose new students, lecturers, or courses
-- that require admin approval before being created.
-- ============================================================

CREATE TABLE IF NOT EXISTS hod_submissions (
  id              SERIAL PRIMARY KEY,
  hod_user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id   INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL
                  CHECK (type IN ('student', 'lecturer', 'course')),
  status          VARCHAR(15) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  payload         JSONB NOT NULL,
  admin_notes     TEXT,
  reviewed_by     INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hod_submissions_status ON hod_submissions(status);
CREATE INDEX IF NOT EXISTS idx_hod_submissions_type   ON hod_submissions(type);
CREATE INDEX IF NOT EXISTS idx_hod_submissions_hod    ON hod_submissions(hod_user_id);