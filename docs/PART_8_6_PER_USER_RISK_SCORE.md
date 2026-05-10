# Part 8.6 Per-User Risk Score

Part 8.6 adds per-user risk scoring derived from audit logs so admins can identify users or system actors associated with suspicious activity.

## What Was Implemented

- Added `GET /audit/security/user-risk`.
- Added `GET /audit/security/user-risk/{user_id}`.
- Added frontend API functions for user risk scores and details.
- Added a **Per-User Risk Scores** section to the existing Security Center page.

## Per-User Risk Calculation

Audit logs are grouped by `user_id`. Logs with `user_id = null` are grouped as:

- `user_id`: `null`
- `user_name`: `System / Unknown`
- `user_email`: `null`

Risk scoring uses the same audit-log-driven weights as the system risk score:

- `auth.login.failed`: +10
- `auth.unauthorized`: +15
- `*.admin.denied`: +25
- `orders.ownership.denied`: +30
- `reports.job.failed`: +15
- `inventory.stock.deduct.failed`: +20
- `status = failure`: +10
- `status = blocked`: +15

Each user's score is capped at 100.

Risk levels:

- `0-24`: Low
- `25-49`: Medium
- `50-74`: High
- `75-100`: Critical

## System-Wide vs Per-User Risk

The system-wide risk score reflects recent security pressure across the whole platform.

Per-user risk scores identify which users or system actors are associated with risky audit events.

## Browser Test Flow

1. Login as admin.
2. Open `/admin/security`.
3. Confirm **Per-User Risk Scores** appears.
4. Trigger a failed login or unauthorized access.
5. Refresh Security Center.
6. Confirm user risk scores update.

## PowerShell Test Flow

```powershell
$adminLogin = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'Admin@12345' } | ConvertTo-Json)
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.access_token)" }

Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/security/user-risk' -Headers $adminHeaders

$userLogin = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'user@secureops.com'; password = 'User@12345' } | ConvertTo-Json)
$userHeaders = @{ Authorization = "Bearer $($userLogin.access_token)" }
try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/audit/security/user-risk' -Headers $userHeaders
} catch {
  "user_user_risk_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'wrong-password' } | ConvertTo-Json)
} catch {
  "failed_login_status=$([int]$_.Exception.Response.StatusCode)"
}

Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/security/user-risk' -Headers $adminHeaders
```
