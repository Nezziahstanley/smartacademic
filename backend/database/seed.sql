-- ============================================================
-- SMARTACADEMIC — Seed Data (Reference Document)
-- ============================================================
-- NOTE: The actual seeding is performed by scripts/seed-db.js
--       because passwords must be hashed with bcrypt.
--       This file documents what gets inserted.
-- ============================================================

-- ---------- ROLES ----------
INSERT INTO roles (name, description) VALUES
  ('admin',    'System administrator — full access'),
  ('hod',      'Head of Department — department-scoped access'),
  ('lecturer', 'Lecturer — course-scoped access'),
  ('student',  'Student — self-only access')
ON CONFLICT (name) DO NOTHING;

-- ---------- DEPARTMENTS ----------
INSERT INTO departments (name, code) VALUES
  ('Computer Science',         'CSC'),
  ('Mathematics',              'MTH'),
  ('Physics',                  'PHY'),
  ('Electrical Engineering',   'EEE')
ON CONFLICT (name) DO NOTHING;

-- ---------- PROGRAMMES ----------
-- (department_id resolved at runtime by seed-db.js)
-- Computer Science:
--   ND Computer Science
--   B.Sc. Software Engineering
-- Mathematics:
--   B.Sc. Mathematics
-- Physics:
--   B.Sc. Physics
-- Electrical Engineering:
--   B.Eng. Electrical Engineering

-- ---------- USERS (passwords hashed at runtime) ----------
-- admin@smartacademic.edu         / Admin@123     (admin)
-- hod.csc@smartacademic.edu       / Hod@123       (hod, Computer Science)
-- lecturer.csc1@smartacademic.edu / Lect@123      (lecturer, Computer Science)
-- student.a@smartacademic.edu     / Student@123   (student, GREEN)
-- student.b@smartacademic.edu     / Student@123   (student, YELLOW)
-- student.c@smartacademic.edu     / Student@123   (student, ORANGE)
-- student.d@smartacademic.edu     / Student@123   (student, RED)

-- ---------- SESSIONS ----------
-- 2023/2024 (inactive)
-- 2024/2025 (active)

-- ---------- SEMESTERS ----------
-- First  (of 2024/2025) — active
-- Second (of 2024/2025) — inactive

-- ---------- COURSES ----------
-- The complete ND and HND curriculum for every FPU programme is
-- inserted by scripts/seed-fpu-curriculum.js, NOT this file.
-- See that script for the source of truth.

-- ---------- DEMO STUDENTS ----------
-- Student A: 2026/CSC/001   (GREEN  — good attendance, high scores)
-- Student B: 2026/CSC/002   (YELLOW — moderate)
-- Student C: 2026/CSC/003   (ORANGE — low attendance, failed 2)
-- Student D: 2026/CSC/004   (RED    — critical)