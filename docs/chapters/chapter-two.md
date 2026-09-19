# Chapter Two — Literature Review

## 2.1 Introduction

This chapter reviews existing work on academic early-warning systems, learning analytics, and related technologies, and identifies the gaps that SMARTACADEMIC addresses.

## 2.2 Academic Early-Warning Systems (EWS)

Early-warning systems originated in credit-risk modelling but have been adapted to education. Most modern EWS share a common architecture:

1. **Data Collection** — attendance, assessments, results, engagement metrics
2. **Feature Engineering** — derived metrics such as attendance %, CA average, GPA
3. **Classification** — rule-based, statistical, or machine-learning models
4. **Alerting** — notification to student and/or staff
5. **Intervention** — a process for acting on the alert

The field is often referred to as **Learning Analytics** or **Academic Analytics**.

## 2.3 Existing Systems — A Survey

### 2.3.1 Course Signals (Purdue University)

Course Signals was one of the first widely deployed EWS. It combined four factors:
- Performance (grade so far)
- Effort (engagement with online material)
- Prior academic history
- Student characteristics

Strengths: simple interface (traffic-light signals), proven impact on retention.  
Weaknesses: required integration with an LMS, tuned for a single institution, not designed for a Nigerian polytechnic model.

### 2.3.2 Degree Compass (Austin Peay State University)

Course recommendation system built on predictive analytics. Recommends courses that maximize student success likelihood.

Not directly comparable to SMARTACADEMIC (recommendation vs. early warning) but demonstrates that rule-based and statistical models can support academic decisions.

### 2.3.3 Open Academic Analytics Initiative (OAAI)

An open-source framework based on Sakai LMS. Required heavy data engineering and did not ship a ready-made dashboard.

### 2.3.4 Commercial Platforms

- **Blackboard Predict** — powerful but expensive
- **Starfish** — retention-focused, US-centric
- **Ellucian** — enterprise-focused, integration-heavy

All are priced beyond the reach of most Nigerian polytechnics, and none ship with NBTE-compliant grading out of the box.

## 2.4 Risk Classification Approaches

Three broad approaches:

### 2.4.1 Rule-Based Classification

Fixed weights assigned to attendance, CA, exam, failed courses, and GPA decline. The score determines the category.

**Advantages:** transparent, explainable, easy to tune, no training data required.  
**Disadvantages:** weights must be set manually; may not capture complex interactions.

### 2.4.2 Statistical / Machine Learning

Logistic regression, decision trees, random forests, and neural networks trained on historical pass/fail labels.

**Advantages:** potentially more accurate; learns interactions automatically.  
**Disadvantages:** requires labeled data (which new institutions don't have); black-box explanations are hard to justify to students.

### 2.4.3 Hybrid

Rule-based features fed to a model. The model adjusts category boundaries based on historical outcomes.

**SMARTACADEMIC uses rule-based classification** because:
- It is explainable — every student can see exactly why they were classified
- Weights and thresholds are configurable in the Settings page
- No labeled training data is required
- It matches the institution's existing grading and attendance policies

## 2.5 Similar Tools in the Nigerian Context

A review of Nigerian polytechnic and university systems reveals:

- Most institutions still rely on paper and spreadsheets
- A few universities have student portals (course registration, result checking) but not risk-based analytics
- No widely deployed system combines attendance + CA + exam + GPA into a live risk score

SMARTACADEMIC is, to our knowledge, one of the first systems designed specifically for the **NBTE-compliant ND/HND model**, with all four role types (Admin, HOD, Lecturer, Student) supported.

## 2.6 Technology Review

### 2.6.1 Backend

- **Node.js + Express** — non-blocking I/O, mature ecosystem, easy for teams familiar with JavaScript
- **PostgreSQL** — ACID-compliant, supports complex joins and window functions used by the risk engine

### 2.6.2 Frontend

- **Vanilla HTML/CSS/JS** — no build step required, easier for students to modify, fast load times
- **Chart.js** for visualizations — small footprint, no framework dependency

### 2.6.3 Auth

- **JWT** — stateless, scales horizontally
- **bcrypt** — proven password hashing

### 2.6.4 Third-Party Integrations

- **Nodemailer (SMTP)** — email delivery
- **Brevo SMTP relay** — reliable transactional delivery
- **Resend** — HTTPS fallback when SMTP is blocked
- **Termii** — Nigerian SMS gateway

## 2.7 Summary and Gap

Existing systems have three gaps SMARTACADEMIC fills:

1. **No Nigerian polytechnic EWS exists** that respects NBTE structure and ND/HND distinctions.
2. **Existing EWS tools assume LMS integration**, which most Nigerian polytechnics don't have.
3. **Commercial platforms are prohibitively expensive** and not locally maintained.

SMARTACADEMIC is designed to run on cheap infrastructure (a single VPS or PaaS), requires no LMS, and can be adopted by any polytechnic with minimal configuration.