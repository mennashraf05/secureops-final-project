# Part 6 - Reports, RabbitMQ, and Worker

Part 6 implements asynchronous backend report generation for SecureOps using the Report Service, RabbitMQ, Worker Service, and PostgreSQL job tracking.

No frontend Reports integration, File Service, Audit Logs, Security Center, Attack Simulation, Risk Score, or HTTPS work was implemented.

## What Was Implemented

- Report Service job tracking table: `jobs`
- Admin-only JWT/RBAC protection inside Report Service
- RabbitMQ producer in Report Service
- Worker Service RabbitMQ consumer
- Simulated inventory report generation
- Worker report output volume at `/app/reports`

## Report Service Endpoints

All report endpoints are admin-only except health checks.

```text
GET /reports/health
```

```text
POST /reports/inventory
```

Creates a `pending` `inventory_report` job and publishes a RabbitMQ message.

```text
GET /reports/jobs
GET /reports/jobs?status=pending
GET /reports/jobs?status=processing
GET /reports/jobs?status=completed
GET /reports/jobs?status=failed
```

Lists report jobs, optionally filtered by status.

```text
GET /reports/jobs/{job_id}
```

Returns one job or `404` if it does not exist.

## RabbitMQ

Queue name:

```text
report_jobs
```

The queue is durable and messages are published as persistent JSON messages:

```json
{
  "job_id": 1,
  "type": "inventory_report",
  "requested_by": 1
}
```

If publishing fails, the Report Service marks the job as `failed` and returns a safe error response.

## Worker Behavior

The Worker Service:

- Retries RabbitMQ connection while RabbitMQ starts.
- Declares the durable `report_jobs` queue.
- Consumes one job at a time.
- Updates job status from `pending` to `processing`.
- Generates a simulated inventory report file:

```text
/app/reports/inventory_report_job_<job_id>.txt
```

- Updates the job to `completed` with `result_path` and `completed_at`.
- Marks failed jobs as `failed` with a safe `error_message`.
- Acknowledges messages safely so one bad job does not crash the worker or loop forever.

The Worker duplicates the small `Job` SQLAlchemy model locally because `report-service` is not a Python package name that can be imported cleanly. Both definitions point to the same PostgreSQL `jobs` table and columns.

## Job Statuses

- `pending`
- `processing`
- `completed`
- `failed`

## Job Types

Implemented in Part 6:

- `inventory_report`

Future extension:

- `orders_report`

## Why This Demonstrates Async Processing

The admin request returns after the Report Service creates and queues a job. The actual report generation happens later in the Worker Service. The admin checks progress through job status endpoints, proving that the request/response API is decoupled from background processing.

## PowerShell Test Flow

Login as admin and save token:

```powershell
$adminLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "admin@secureops.com"; password = "Admin@12345" } | ConvertTo-Json)

$adminHeaders = @{ Authorization = "Bearer $($adminLogin.access_token)" }
```

Login as normal user and save token:

```powershell
$userLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "user@secureops.com"; password = "User@12345" } | ConvertTo-Json)

$userHeaders = @{ Authorization = "Bearer $($userLogin.access_token)" }
```

Normal user should be rejected:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://localhost:8080/reports/inventory" `
  -Headers $userHeaders
```

Expected: `403`

Admin creates an inventory report:

```powershell
$job = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/reports/inventory" `
  -Headers $adminHeaders

$job.data
$jobId = $job.data.id
```

Expected initial status: `pending`

Wait a few seconds, then check the job:

```powershell
Start-Sleep -Seconds 5
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/reports/jobs/$jobId" `
  -Headers $adminHeaders
```

Expected status: `completed`

List all jobs:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/reports/jobs" `
  -Headers $adminHeaders
```

Missing token should return `401`:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/reports/jobs"
```

Invalid token should return `401`:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/reports/jobs" `
  -Headers @{ Authorization = "Bearer invalid.token.value" }
```
