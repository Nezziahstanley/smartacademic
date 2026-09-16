<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Assessments — Lecturer</title>
  <link rel="stylesheet" href="/css/layout.css" />
  <link rel="stylesheet" href="/css/sidebar.css" />
  <link rel="stylesheet" href="/css/topbar.css" />
  <link rel="stylesheet" href="/css/dashboard.css" />
</head>
<body>
  <div class="app-shell">
    <div id="sidebarSlot"></div>
    <div class="main">
      <div id="topbarSlot"></div>
      <main class="page">
        <div class="page-header">
          <div><h1>Assessments</h1><p>Assignments, tests, CA, and exams.</p></div>
          <div class="page-actions"><button class="btn btn-primary" id="btnNew">+ New Assessment</button></div>
        </div>

        <div class="filters">
          <select class="select" id="courseFilter" style="max-width:320px;"><option value="">All courses</option></select>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Course</th><th>Type</th><th>Title</th><th>Max</th><th>Weight</th><th>Scored</th><th style="text-align:right;">Actions</th></tr></thead>
            <tbody id="tbody"><tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr></tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
  <div id="modalRoot"></div>
  <script src="/js/sidebar.js"></script>
  <script src="/js/topbar.js"></script>
  <script src="/js/admin/crud-shared.js"></script>
  <script src="/js/lecturer/assessments.js"></script>
</body>
</html>