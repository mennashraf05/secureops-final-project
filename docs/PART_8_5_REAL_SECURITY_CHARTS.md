# Part 8.5 Real Security Charts

Part 8.5 connects the Security Center charts to audit-log-derived backend data.

## What Was Implemented

- Added `GET /audit/security/charts`.
- Added frontend `getSecurityCharts()`.
- Added chart TypeScript types.
- Updated the existing Security Center chart cards to use backend data.
- Kept the existing Security Center layout, cards, charts, spacing, and visual style.

## New Endpoint

`GET /audit/security/charts`

Admin only. Returns:

- `events_over_time`
- `risk_score_trend`
- `severity_breakdown`
- `status_distribution`

Normal users receive `403`. Missing or invalid tokens receive `401`.

## Chart Calculations

`events_over_time` groups recent audit logs by day and counts:

- success
- failure
- blocked
- info
- total

`risk_score_trend` groups recent audit logs by day and applies the Part 8 risk weights:

- `auth.login.failed`: +10
- `auth.unauthorized`: +15
- `*.admin.denied`: +25
- `orders.ownership.denied`: +30
- `reports.job.failed`: +15
- `inventory.stock.deduct.failed`: +20
- `status = failure`: +10
- `status = blocked`: +15

Each daily score is capped at 100.

`severity_breakdown` derives severity from audit logs:

- Low: info or normal low-impact events
- Medium: failed login or failure status
- High: unauthorized, admin denied, or blocked events
- Critical: ownership denied or stock deduction failed

`status_distribution` counts recent logs by audit status.

## PowerShell Test Flow

```powershell
# First create $adminHeaders and $userHeaders using docs/AUTH_2FA_TEST_FLOW.md.
# /auth/login no longer returns access_token directly.

$charts = Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/security/charts' -Headers $adminHeaders
$charts.data.events_over_time
$charts.data.risk_score_trend
$charts.data.severity_breakdown

try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/audit/security/charts' -Headers $userHeaders
} catch {
  "user_charts_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'wrong-password' } | ConvertTo-Json)
} catch {
  "failed_login_status=$([int]$_.Exception.Response.StatusCode)"
}

Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/security/charts' -Headers $adminHeaders
```

## Browser Test Flow

1. Login as admin.
2. Open `/admin/security`.
3. Confirm charts load real data.
4. Trigger a failed login.
5. Refresh `/admin/security`.
6. Confirm charts update.
