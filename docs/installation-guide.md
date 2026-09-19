
---

## C. `docs/installation-guide.md` and `docs/user-guide.md`

### `docs/installation-guide.md`

```markdown
# Installation Guide

This guide covers running SMARTACADEMIC locally and deploying it to production.

---

## 1. Prerequisites

- **Node.js** 18 LTS or newer
- **PostgreSQL** 14 or newer (or a hosted Postgres such as Neon)
- **Git**
- **npm**
- A modern browser for the UI

Optional, for notifications:
- Brevo account (transactional email)
- Resend account (email fallback)
- Termii account (SMS)

---

## 2. Local Setup

### 2.1 Clone the Repository

```bash
git clone <your-repo-url>
cd smartacademic

2.2 Install Dependencies
bash
npm install
2.3 Configure Environment
Copy the example env file:

bash
cp .env.example .env
Edit .env and set the values. Minimum required:

env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=smartacademic

JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=1d

CLIENT_URL=http://localhost:5000
Optional for email/SMS:

env
# Brevo (recommended)
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=xxxxxxx@smtp-brevo.com
EMAIL_PASSWORD=xsmtpsib-...
EMAIL_FROM_NAME=SMARTACADEMIC
EMAIL_FROM=your-verified-sender@example.com

# Resend (fallback)
RESEND_API_KEY=re_...
RESEND_FROM=SMARTACADEMIC <onboarding@resend.dev>

# Termii (SMS)
TERMII_API_KEY=...
TERMII_SENDER_ID=Termii
TERMII_CHANNEL=dnd
2.4 Create the Database
bash
npm run init-db
This creates the database (if missing) and applies schema.sql.

2.5 Seed Demo Data (Optional)
bash
npm run seed-db
Inserts departments, programmes, courses, demo users, and sample results.

2.6 Start the Server
bash
npm run dev
Then visit:

Frontend: http://localhost:5000

Health: http://localhost:5000/api/health

2.7 Demo Accounts
Role	Email	Password
Admin	admin@smartacademic.edu	Admin@123
HOD	hod.csc@smartacademic.edu	Hod@123
Lecturer	lecturer.csc1@smartacademic.edu	Lect@123
Student	student.a@smartacademic.edu	Student@123
3. Production Deployment (Render + Neon)
3.1 Create a Neon Database
https://console.neon.tech → sign up

Create a project

Copy the connection details: host, port, user, password, database

3.2 Create a Render Web Service
https://dashboard.render.com → New → Web Service

Connect your GitHub repo

Settings:

Environment: Node

Build Command: npm install

Start Command: npm start

Instance: Free (or paid)

3.3 Configure Render Environment Variables
In the Render dashboard → your service → Environment, add:

text
NODE_ENV=production
DB_HOST=<your-neon-host>
DB_PORT=5432
DB_USER=<neon-user>
DB_PASSWORD=<neon-password>
DB_NAME=<neon-db>

JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=1d

CLIENT_URL=https://your-service.onrender.com

BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Email
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=xxxxxxx@smtp-brevo.com
EMAIL_PASSWORD=xsmtpsib-...
EMAIL_FROM_NAME=SMARTACADEMIC
EMAIL_FROM=your-verified-sender@example.com

# Resend fallback (optional)
RESEND_API_KEY=re_...
RESEND_FROM=SMARTACADEMIC <onboarding@resend.dev>

# SMS (optional)
TERMII_API_KEY=...
TERMII_SENDER_ID=Termii
TERMII_CHANNEL=dnd
Note: Do not set PORT — Render injects its own.

3.4 Run Migrations
The following migrations must be run against the production database once:

bash
node scripts/add-result-submission-status.js
node scripts/add-notification-log.js
node scripts/add-fee-tracking.js
You can run these from your local machine if .env points at the production DB, or paste the SQL into Neon's SQL editor.

3.5 Deploy
Render auto-deploys on push, or you can click Manual Deploy → Clear build cache & deploy.

3.6 Verify
bash
curl https://your-service.onrender.com/api/health
Expected: {"success":true,...,"db":"connected"}

4. Post-Installation Configuration
4.1 Configure System Settings
Log in as admin → Settings. Configure:

Institution name, email, phone

Current session and semester

Grading thresholds

Attendance thresholds

Risk weights and thresholds

4.2 Request a Termii Sender ID (for SMS)
Termii dashboard → SMS Sender IDs → Request New

Fill in the form (name, company, use case)

Wait for approval (hours to days)

Update TERMII_SENDER_ID in .env and Render

4.3 Verify Your Email Sender
For Brevo:

Brevo → Senders, Domains & IPs → Senders

Add your-verified-sender@example.com

Click the verification link in your inbox

For Resend:

Resend → Domains → Add Domain

Add the DNS records to your registrar

Wait for verification (5–30 min)

5. Troubleshooting
Symptom	Cause	Fix
Port scan timeout on Render	PORT set manually	Remove PORT from Render env
[email] SMTP connection failed: Connection timeout	Port 587 blocked from Render	Change EMAIL_PORT to 2525
SENDER_ID_NOT_APPROVED on SMS	Sender ID not registered	Request one at Termii
Invalid phone in SMS logs	Stored phone missing prefix	Add 0 or +234 on the student's record
Login says "Account is deactivated"	User pending approval	Approve at /admin/pending-users.html
matric_no: Invalid value on register	Old validator still requires it	Deploy latest authRoutes.js
Tables look cramped on mobile	Stale CSS	Hard refresh (Ctrl+Shift+R)
Emails go to spam	New sending domain/IP	Mark as not-spam; use SPF/DKIM once domain verified
6. Backup and Restore
Backup (Postgres)
bash
pg_dump -h <host> -U <user> -d <dbname> > backup.sql
Restore
bash
psql -h <host> -U <user> -d <dbname> < backup.sql
Neon
Use the Neon dashboard → Backups for point-in-time recovery.