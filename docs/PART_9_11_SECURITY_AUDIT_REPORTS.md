# Part 9.11 Security And Audit Reports

Part 9.11 enables Security Report and Audit Report generation through the existing Report Service, RabbitMQ queue, Worker Service, and downloadable report files.

## What Was Implemented

- Added admin-only report endpoints:
  - `POST /reports/security`
  - `POST /reports/audit`
- Added supported job types:
  - `security_report`
  - `audit_report`
- Updated the Worker Service to generate `.txt` files for both report types.
- Enabled the Admin Reports page buttons for Security and Audit reports.
- Kept existing Inventory Report, Low Stock Report, status filters, job table, and download behavior intact.

## New Endpoints

`POST /reports/security`

Creates a pending `security_report` job and publishes it to the `report_jobs` RabbitMQ queue.

`POST /reports/audit`

Creates a pending `audit_report` job and publishes it to the `report_jobs` RabbitMQ queue.

Both endpoints require admin authentication.

## Worker Behavior

The worker consumes jobs from `report_jobs` and transitions:

`pending -> processing -> completed`

If generation fails, the job is marked `failed` with a safe error message.

## Generated Files

- `security_report_job_<job_id>.txt`
- `audit_report_job_<job_id>.txt`

Files are written to the existing shared reports volume and downloaded through:

`GET /reports/jobs/{job_id}/download`

## Security Report Contents

The Security Report summarizes suspicious activity and risk indicators from `audit_logs`, including:

- Generated timestamp
- Job ID
- Requested by user ID
- Risk score summary
- Failed login count
- Unauthorized access count
- Admin denied count
- Top risk factors
- Recent security events
- Note: `This report is generated from Audit Service security events.`

## Audit Report Contents

The Audit Report summarizes centralized audit activity, including:

- Generated timestamp
- Job ID
- Requested by user ID
- Total audit logs
- Count by status: `success`, `failure`, `blocked`, `info`
- Count by service
- Recent audit events
- Note: `This report is generated from centralized Audit Logs.`

## Audit Events

Report Service records:

- `reports.security.created`
- `reports.audit.created`
- `reports.job.created`
- `reports.job.failed` when RabbitMQ publish fails

Worker Service continues to record:

- `reports.job.processing`
- `reports.job.completed`
- `reports.job.failed`

## Browser Test Flow

1. Login as admin.
2. Open `/admin/reports`.
3. Click `Generate Security Report`.
4. Confirm the job appears in the jobs table.
5. Wait for completed status.
6. Download the report.
7. Click `Generate Audit Report`.
8. Confirm the job appears and completes.
9. Download the report.

## PowerShell Test Flow

1. Login as admin through the current auth and 2FA flow.
2. `POST /reports/security`.
3. Confirm the response job has `type = security_report`.
4. Wait 5 seconds.
5. `GET /reports/jobs/{job_id}`.
6. Confirm `status = completed`.
7. `GET /reports/jobs/{job_id}/download`.
8. Confirm the file contains `SecureOps Security Report`.
9. `POST /reports/audit`.
10. Confirm the response job has `type = audit_report`.
11. Wait 5 seconds.
12. Confirm completed status and download.
13. Confirm the file contains `SecureOps Audit Report`.
14. Confirm normal user requests to `POST /reports/security` and `POST /reports/audit` return `403`.
