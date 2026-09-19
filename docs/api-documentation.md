# API Documentation

**Base URL:** `https://smartacademic-1.onrender.com/api`
**Auth:** JWT in `Authorization: Bearer <token>` header
**Response format:** JSON

Standard success response:
```json
{ "success": true, "data": { ... }, "message": "optional" }

Standard error response:

{ "success": false, "error": "message", "details": "optional" }

Health
Method	Path	Auth	Purpose
GET	/health	none	Service + DB health check
Auth (/auth)
Method	Path	Auth	Purpose
POST	/register	none	Register student or lecturer (auto-generates matric)
POST	/login	none	Login; returns JWT
GET	/me	user	Current user + role-specific profile
POST	/logout	user	Client-side logout
POST	/forgot-password	none	Request reset link
POST	/reset-password	none	Reset with token
POST	/invite	admin	Send email invitation
POST	/accept-invite	none	Complete invited registration
GET	/departments	none	Public department list (for register form)
GET	/programmes?department_id=N	none	Programmes for a department
Admin (/admin)
Dashboard & Users
Method	Path	Purpose
GET	/dashboard	Stats, high-risk, attendance trend
GET	/users	Paginated user list
GET	/users/:id	Single user
POST	/users	Create user
PUT	/users/:id	Update user
POST	/users/:id/toggle-active	Activate / deactivate
POST	/users/:id/reset-password	Force password reset
DELETE	/users/:id	Delete user
GET	/roles	List roles
Academic Entities
Method	Path	Purpose
GET	/departments	Departments (with counts)
GET	/departments/overview	Departments with aggregate stats
GET	/departments/hod-candidates	HOD users for assignment
GET	/departments/:id	One department
POST	/departments	Create
PUT	/departments/:id	Update
DELETE	/departments/:id	Delete
GET	/programmes	Programmes
POST	/programmes	Create
PUT	/programmes/:id	Update
DELETE	/programmes/:id	Delete
GET	/students	Students
POST	/students	Create (auto-matric)
PUT	/students/:id	Update
DELETE	/students/:id	Delete
GET	/lecturers	Lecturers
POST	/lecturers	Create
PUT	/lecturers/:id	Update
DELETE	/lecturers/:id	Delete
GET	/courses	Courses
POST	/courses	Create
PUT	/courses/:id	Update
DELETE	/courses/:id	Delete
GET	/sessions	Sessions
POST	/sessions	Create
PUT	/sessions/:id	Update
DELETE	/sessions/:id	Delete
GET	/semesters	Semesters
POST	/semesters	Create
PUT	/semesters/:id	Update
DELETE	/semesters/:id	Delete
Registrations & Fees
Method	Path	Purpose
GET	/registrations	Registrations (with filters)
POST	/registrations/:id/approve	Approve one
POST	/registrations/:id/drop	Drop one
POST	/registrations/bulk-approve	Bulk approve (per-row result)
POST	/registrations/bulk-drop	Bulk drop (per-row result)
DELETE	/registrations/:id	Hard delete
POST	/students/:id/mark-fees-paid	Mark fees + auto-approve
POST	/students/:id/mark-fees-unpaid	Reverse
Attendance, Results, Risk
Method	Path	Purpose
GET	/attendance	Attendance records + summary
GET	/results	Result list
PUT	/results/:id	Update scores
POST	/results/:id/publish	Publish one
DELETE	/results/:id	Delete
DELETE	/results/:id/safe	Policy-aware delete (blocked if published)
GET	/risk	Risk assessments
GET	/risk/:id	Single risk
GET	/risk/student/:studentId/history	History for one student
POST	/risk/recompute	Start background recompute
GET	/risk/recompute-status/:jobId	Poll job status
Interventions, Settings, Audit, Reports
Method	Path	Purpose
GET	/interventions	List with filters
POST	/interventions	Create
PUT	/interventions/:id	Update
DELETE	/interventions/:id	Delete
GET	/interventions/staff	Staff candidates
GET	/interventions/students	Student candidates
POST	/interventions/auto-create	Auto-generate for high risk
GET	/settings	All settings
POST	/settings	Update one
POST	/settings/bulk	Bulk update
DELETE	/settings/:key	Remove
GET	/audit-logs	Logs (paginated, filterable)
GET	/audit-logs/modules	Distinct modules
GET	/reports/student/:studentId	Student report
GET	/reports/attendance	Attendance report
GET	/reports/risk	Risk distribution
GET	/reports/performance	Departmental performance
GET	/reports/export/:type?format=csv|pdf|excel	Export report
Publish (Department Grouped)
Method	Path	Purpose
GET	/publish/result-submissions	Grouped by department
POST	/publish/department/:departmentId	Publish one dept
POST	/publish/departments-bulk	Publish many depts
POST	/unpublish/department/:departmentId	Unpublish one dept
Import & Approvals
Method	Path	Purpose
GET	/students/import/template	CSV template
POST	/students/import	Bulk import students
GET	/pending-users	Pending registrations
POST	/pending-users/:id/approve	Approve pending
POST	/pending-users/:id/reject	Reject pending
HOD Submissions
Method	Path	Purpose
GET	/submissions	All HOD submissions
POST	/submissions/:id/approve	Approve (creates record)
POST	/submissions/:id/reject	Reject with note
Profile
Method	Path	Purpose
PUT	/profile	Update own name/phone
POST	/change-password	Change own password
POST	/profile/photo	Upload photo (data URL)
DELETE	/profile/photo	Remove photo
HOD (/hod)
Method	Path	Purpose
GET	/dashboard	Department KPIs, high-risk
GET	/students	Department students
GET	/students/:id	One student detail
GET	/lecturers	Department lecturers
GET	/courses	Department courses
POST	/courses	Create course in department
PUT	/courses/:id	Update
DELETE	/courses/:id	Delete
POST	/courses/:courseId/assign-lecturer	Assign lecturer
GET	/attendance	Attendance overview
GET	/performance	Performance analytics
GET	/risk	Risk list (scoped, with intervention info)
GET	/interventions	Department interventions
POST	/interventions	Create intervention
PUT	/interventions/:id	Update
GET	/interventions/staff	Staff candidates
GET	/interventions/students	Student picker
POST	/submissions	Propose student/lecturer/course
GET	/submissions	Own submissions
GET	/result-submissions	Courses with submitted results
GET	/result-submissions/:courseId	Course detail
POST	/result-submissions/:courseId/approve	Approve
POST	/result-submissions/:courseId/return	Return with reason
POST	/result-submissions/approve-bulk	Bulk approve
POST	/result-submissions/return-bulk	Bulk return
PUT	/profile	Update own
POST	/change-password	Change password
POST	/profile/photo	Upload
DELETE	/profile/photo	Remove
Lecturer (/lecturer)
Method	Path	Purpose
GET	/dashboard	Courses, at-risk, attendance
GET	/courses	Own courses only
GET	/students	Students in own courses
GET	/student/:id	Scoped detail
GET	/class-sessions?course_id=N	Own class sessions
POST	/class-sessions	Create
GET	/attendance/:classSessionId	Roster for a session
POST	/attendance/:classSessionId	Save attendance
GET	/attendance-summary/:courseId	Per-student summary
GET	/assessments	Own assessments
POST	/assessments	Create
DELETE	/assessments/:id	Delete
GET	/assessments/:id/scores	Score entry form
POST	/assessments/:id/scores	Save scores
GET	/results	Own course results
GET	/results/:courseId/detail	Per-student detail
GET	/at-risk	At-risk in own courses
POST	/at-risk/:studentId/intervene	Create intervention
POST	/at-risk/:studentId/report-to-hod	Flag to HOD
GET	/interventions	Assigned to me
PUT	/interventions/:id	Update
GET	/reports/course-performance	Analytics
GET	/reports/attendance	Attendance report
GET	/reports/grade-distribution	Grade distribution
GET	/reports/student-averages	Averages
POST	/broadcast-students	Message all students
POST	/results/submit/:courseId	Submit to HOD
POST	/results/submit-bulk	Bulk submit
PUT	/profile	Update
POST	/change-password	Change
POST	/profile/photo	Upload
DELETE	/profile/photo	Remove
Student (/student)
Method	Path	Purpose
GET	/dashboard	Summary, recent results, interventions
GET	/profile	Own profile
PUT	/profile	Update name/phone
POST	/change-password	Change
POST	/upload-photo	Upload photo
GET	/courses	Registered courses
GET	/available-courses	Courses open for registration
GET	/my-registrations	Registered + unit totals
POST	/register-course	Register one
POST	/drop-course/:id	Drop
GET	/attendance	Per-course + recent sessions
GET	/results	Published results
GET	/gpa-cgpa	GPA/CGPA + trend
GET	/performance	Per-course averages
GET	/academic-status	Risk category + factors
GET	/interventions	Assigned interventions
Notifications (/notifications)
Method	Path	Purpose
GET	/	Own notifications
POST	/read-all	Mark all read
POST	/:id/read	Mark one read
POST	/create	Admin — create for user
POST	/broadcast	Admin — role-based
POST	/broadcast-department	HOD — department
GET	/all	Admin — all recent
Public
Method	Path	Purpose
GET	/public/verify/:matric	Verify a student by matric (QR ID card)
Status Codes
Code	Meaning
200	OK
201	Created
400	Bad request
401	Not authenticated
403	Not authorized
404	Not found
409	Conflict (duplicate)
422	Validation error
500	Server error