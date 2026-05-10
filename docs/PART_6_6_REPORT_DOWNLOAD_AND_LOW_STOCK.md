# Part 6.6 Report Download And Low Stock Report

Part 6.6 adds downloadable report files and implements Low Stock Report generation. Security Report and Audit Report remain disabled until their backend modules are implemented.

## What Was Implemented

- Added `POST /reports/low-stock` for admin-only low-stock report job creation.
- Added `GET /reports/jobs/{job_id}/download` for admin-only report file download.
- Updated the worker to process both `inventory_report` and `low_stock_report`.
- Updated the Admin Reports page with a functional Low Stock Report button.
- Added a Download action for completed report jobs.
- Kept Security Report and Audit Report visible but disabled.

## Download Endpoint

`GET /reports/jobs/{job_id}/download` returns a completed report as a downloadable `.txt` file.

Rules:

- Admin only.
- Job must exist.
- Job status must be `completed`.
- Job must have a `result_path`.
- The file must exist under `/app/reports`.
- Path traversal is blocked by resolving the report path and requiring it to stay inside the reports directory.
- Safe download filenames are used:
  - `inventory_report_job_<id>.txt`
  - `low_stock_report_job_<id>.txt`

Pending, processing, failed, missing, or invalid report files return safe JSON errors without exposing internal paths or stack traces.

## Shared Docker Volume

The worker writes generated report files to `/app/reports`. The Report Service must read those files to serve downloads, so both services share the `worker-reports` Docker volume:

- `worker-service`: `worker-reports:/app/reports`
- `report-service`: `worker-reports:/app/reports:ro`

The Report Service mount is read-only because it only serves completed files.

## Low Stock Report Behavior

Low Stock Report jobs use type `low_stock_report`. The worker queries the shared PostgreSQL `products` table for products where `quantity <= 5` and writes:

- Report title
- Job ID
- Generated timestamp
- Completion status
- Low stock threshold
- Products that need restocking

If the products query fails, the worker marks the job as failed with a safe error message.

## Disabled Reports

Security Report remains disabled because the Security Center backend is not implemented in Part 6.6.

Audit Report remains disabled because Audit Logs are not implemented in Part 6.6.

## Browser Test Flow

1. Login as admin with `admin@secureops.com` and `Admin@12345`.
2. Open `/admin/reports`.
3. Generate Inventory Report.
4. Wait until completed.
5. Click Download.
6. Confirm the `.txt` file downloads.
7. Generate Low Stock Report.
8. Wait until completed.
9. Click Download.
10. Confirm the `.txt` file downloads.
11. Confirm Security and Audit report buttons are disabled and marked coming soon.
12. Confirm a normal user cannot access `/admin/reports`.

## PowerShell Tests

```powershell
# First create $adminHeaders and $userHeaders using docs/AUTH_2FA_TEST_FLOW.md.
# /auth/login no longer returns access_token directly.

$inventory = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/reports/inventory' -Headers $adminHeaders
$inventoryJobId = $inventory.data.id
Start-Sleep -Seconds 4
Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/reports/jobs/$inventoryJobId/download" -Headers $adminHeaders -OutFile "inventory_report_job_$inventoryJobId.txt"

$lowStock = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/reports/low-stock' -Headers $adminHeaders
$lowStockJobId = $lowStock.data.id
Start-Sleep -Seconds 4
Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/reports/jobs/$lowStockJobId/download" -Headers $adminHeaders -OutFile "low_stock_report_job_$lowStockJobId.txt"

$pending = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/reports/inventory' -Headers $adminHeaders
try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/reports/jobs/$($pending.data.id)/download" -Headers $adminHeaders
} catch {
  "pending_download_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/reports/jobs/999999/download' -Headers $adminHeaders
} catch {
  "missing_download_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/reports/low-stock' -Headers $userHeaders
} catch {
  "user_low_stock_status=$([int]$_.Exception.Response.StatusCode)"
}
```
