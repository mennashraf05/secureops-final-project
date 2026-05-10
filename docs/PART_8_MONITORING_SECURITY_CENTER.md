# Part 8 Monitoring Dashboard + Security Center

Part 8 connects the admin monitoring and security dashboards to real backend data from audit logs, users, products, orders, and report jobs.

## What Was Implemented

- Added `GET /audit/monitoring/summary`.
- Added `GET /audit/security/overview`.
- Added dynamic risk score calculation from recent audit logs.
- Added derived security alerts from audit events.
- Updated the Admin Dashboard to show real monitoring KPIs.
- Updated the Security Center to show real risk score, risk factors, alerts, and recent security events.

## Monitoring Summary Endpoint

`GET /audit/monitoring/summary`

Admin only. Returns:

- User, product, order, report job, and audit log counts.
- Failed login count.
- Unauthorized attempt count.
- Admin denied attempt count.
- Worker completed job count.
- Risk score and risk level.

## Security Overview Endpoint

`GET /audit/security/overview`

Admin only. Returns:

- `risk_score`
- `risk_level`
- `risk_factors`
- `alerts`
- `recent_security_events`
- failed login, unauthorized, and admin denied counts

## Risk Score Formula

Recent security audit logs are scored with these weights:

- `auth.login.failed`: +10
- `auth.unauthorized`: +15
- `*.admin.denied`: +25
- `orders.ownership.denied`: +30
- `status = blocked`: +15
- `status = failure`: +10
- `reports.job.failed`: +15
- `inventory.stock.deduct.failed`: +20

The total score is capped at 100.

Risk levels:

- `0-24`: Low
- `25-49`: Medium
- `50-74`: High
- `75-100`: Critical

## Alert Derivation

Alerts are derived dynamically from audit logs. No new alerts table is required in Part 8.

Examples:

- Failed login detected
- Unauthorized access attempt
- Admin endpoint denied
- Ownership violation attempt
- Report job failed
- Stock deduction failed

## Frontend Pages Updated

- `/admin/dashboard`
- `/admin/security`

Charts remain visually consistent with the existing UI; summary cards and tables now use live backend values.

## PowerShell Tests

```powershell
$adminLogin = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'Admin@12345' } | ConvertTo-Json)
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.access_token)" }

Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/monitoring/summary' -Headers $adminHeaders
Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/security/overview' -Headers $adminHeaders

$userLogin = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'user@secureops.com'; password = 'User@12345' } | ConvertTo-Json)
$userHeaders = @{ Authorization = "Bearer $($userLogin.access_token)" }
try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/audit/monitoring/summary' -Headers $userHeaders
} catch {
  "user_summary_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'wrong-password' } | ConvertTo-Json)
} catch {
  "failed_login_status=$([int]$_.Exception.Response.StatusCode)"
}

Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/security/overview' -Headers $adminHeaders
```

## Browser Test Flow

1. Login as admin.
2. Open `/admin/dashboard`.
3. Confirm KPIs load from backend.
4. Open `/admin/security`.
5. Confirm risk score and alerts load from backend.
6. Trigger a failed login.
7. Refresh `/admin/security`.
8. Confirm security data changes.
9. Login as user and confirm user cannot access admin pages.
