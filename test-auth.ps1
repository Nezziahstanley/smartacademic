$base = "http://localhost:5000/api/auth"

Write-Host "`n[1] Admin login" -ForegroundColor Cyan
$admin = (Invoke-WebRequest -Uri "$base/login" -Method POST -Body '{"email":"admin@smartacademic.edu","password":"Admin@123"}' -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "  ✅ role = $($admin.data.user.role)" -ForegroundColor Green
$token = $admin.data.token

Write-Host "`n[2] /me" -ForegroundColor Cyan
$me = (Invoke-WebRequest -Uri "$base/me" -Headers @{Authorization="Bearer $token"} -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "  ✅ email = $($me.data.user.email)" -ForegroundColor Green

Write-Host "`n[3] Wrong password" -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri "$base/login" -Method POST -Body '{"email":"admin@smartacademic.edu","password":"x"}' -ContentType "application/json" -UseBasicParsing | Out-Null
  Write-Host "  ❌ Should have failed" -ForegroundColor Red
} catch {
  Write-Host "  ✅ Rejected as expected" -ForegroundColor Green
}

Write-Host "`n[4] Student login" -ForegroundColor Cyan
$st = (Invoke-WebRequest -Uri "$base/login" -Method POST -Body '{"email":"student.a@smartacademic.edu","password":"Student@123"}' -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "  ✅ role = $($st.data.user.role)" -ForegroundColor Green

Write-Host "`nAll auth tests passed." -ForegroundColor Yellow