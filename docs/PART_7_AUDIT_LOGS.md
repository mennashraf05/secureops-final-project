# Part 7 Audit Logs

Part 7 implements the real Audit Logs Service backend and connects existing backend services to send critical security and business events.

## What Was Implemented

- Added a real `audit-service` with PostgreSQL persistence.
- Added an internal audit ingestion endpoint protected by `X-Internal-API-Key`.
- Added admin-only audit log viewing endpoints.
- Added shared best-effort audit client: `backend/shared/audit_client.py`.
- Connected Auth, Inventory, Orders, Reports, and Worker services to audit events.
- Verified audit failures do not break normal business flows.

## Audit Database Table

The `audit_logs` table stores:

- `id`
- `user_id`
- `action`
- `service_name`
- `ip_address`
- `status`
- `details`
- `created_at`

Supported audit status values:

- `success`
- `failure`
- `blocked`
- `info`

## Internal Audit Event Endpoint

`POST /audit/events`

This endpoint is service-to-service only and requires:

```text
X-Internal-API-Key: <INTERNAL_API_KEY>
```

Successful response:

```json
{
  "success": true,
  "message": "Audit event recorded successfully.",
  "data": {}
}
```

Missing or invalid internal API keys return `401`.

## Admin Audit Log Endpoints

`GET /audit/logs`

Admin only. Supports optional filters:

- `service_name`
- `action`
- `status`
- `user_id`
- `limit`

Logs are returned latest first.

`GET /audit/logs/{log_id}`

Admin only. Returns one audit log or `404` if missing.

## Logged Events

Current services send these events where applicable:

- `auth.login.success`
- `auth.login.failed`
- `auth.logout`
- `auth.unauthorized`
- `auth.admin.denied`
- `admin.action`
- `inventory.product.created`
- `inventory.product.updated`
- `inventory.product.deleted`
- `inventory.stock.updated`
- `inventory.stock.deducted`
- `inventory.stock.deduct.failed`
- `inventory.admin.denied`
- `orders.order.created`
- `orders.order.approved`
- `orders.order.rejected`
- `orders.ownership.denied`
- `orders.admin.denied`
- `reports.job.created`
- `reports.job.processing`
- `reports.job.completed`
- `reports.job.failed`
- `reports.admin.denied`

File upload and download events will be added later when File Service is implemented.

## Internal API Key Protection

Only backend services with `INTERNAL_API_KEY` can write audit events. Admin users read logs through JWT-protected routes. Normal users receive `403`, and missing or invalid JWTs receive `401`.

## PowerShell Backend Tests

```powershell
$envLines = Get-Content .env
$internalApiKey = ($envLines | Where-Object { $_ -match '^INTERNAL_API_KEY=' } | Select-Object -First 1) -replace '^INTERNAL_API_KEY=', ''

# First create $adminHeaders and $userHeaders using docs/AUTH_2FA_TEST_FLOW.md.
# /auth/login no longer returns access_token directly.

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'wrong-password' } | ConvertTo-Json)
} catch {
  "failed_login_status=$([int]$_.Exception.Response.StatusCode)"
}

Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/logout' -Headers $adminHeaders

# Recreate $adminHeaders with docs/AUTH_2FA_TEST_FLOW.md after logout.

$productBody = @{
  name = "Audit Demo Part 7"
  sku = "AUDIT-P7-001"
  category = "Security"
  description = "Part 7 audit demo product"
  price = 10
  quantity = 8
} | ConvertTo-Json
$product = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/products' -ContentType 'application/json' -Headers $adminHeaders -Body $productBody

$orderBody = @{ items = @(@{ product_id = $product.data.id; product_name = $product.data.name; product_sku = $product.data.sku; quantity = 1 }) } | ConvertTo-Json -Depth 5
$order = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/orders' -ContentType 'application/json' -Headers $userHeaders -Body $orderBody
Invoke-RestMethod -Method Patch -Uri "http://localhost:8080/orders/$($order.data.id)/approve" -Headers $adminHeaders

$report = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/reports/inventory' -Headers $adminHeaders
Start-Sleep -Seconds 5
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/reports/jobs/$($report.data.id)" -Headers $adminHeaders

$logs = Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/logs?limit=100' -Headers $adminHeaders
$logs.data | Select-Object id, service_name, action, status, user_id, created_at

try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/audit/logs' -Headers $userHeaders
} catch {
  "user_logs_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/audit/logs'
} catch {
  "missing_token_status=$([int]$_.Exception.Response.StatusCode)"
}

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/audit/events' -ContentType 'application/json' -Body (@{ action = 'manual.test'; service_name = 'manual'; status = 'info' } | ConvertTo-Json)
} catch {
  "missing_internal_key_status=$([int]$_.Exception.Response.StatusCode)"
}

Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/audit/events' -ContentType 'application/json' -Headers @{ 'X-Internal-API-Key' = $internalApiKey } -Body (@{ action = 'manual.test'; service_name = 'manual'; status = 'info'; details = 'manual audit event' } | ConvertTo-Json)
```

## Browser/API Demo Flow

1. Login as admin.
2. Perform a product create/update/delete action.
3. Login as a normal user.
4. Create an order.
5. Approve or reject the order as admin.
6. Generate a report and wait for worker completion.
7. Call `GET /audit/logs` with the admin token.
8. Confirm events from Auth, Inventory, Orders, Reports, and Worker are present.
9. Confirm normal users cannot call `GET /audit/logs`.
