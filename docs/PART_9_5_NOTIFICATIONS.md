# Part 9.5 Notifications

Part 9.5 connects the existing bell icon to real role-based notifications generated from audit events.

## What Was Implemented

- Added a `notifications` table in the Audit Service.
- Added notification schemas and service functions for creating, listing, counting, and marking notifications read.
- Added JWT-protected notification endpoints under `/audit/notifications`.
- Derived notifications from existing audit events instead of creating a new microservice.
- Connected the frontend topbar bell to live unread counts and a dropdown list.
- Kept notification failures isolated so audit logging and business flows continue if notification creation fails.

## Notification Model

Each notification stores:

- `user_id`: private user target, nullable
- `role_target`: `admin`, `user`, `all`, or null
- `title`
- `message`
- `category`: `order`, `report`, `security`, `audit`, `account`, or `system`
- `severity`: `info`, `success`, `warning`, or `critical`
- source metadata: service, action, and optional source id
- read state
- creation timestamp

## Visibility Rules

Admins can see:

- notifications targeted to `admin`
- `all` notifications
- global security/report/order/audit/system notifications

Users can see:

- notifications targeted to their own `user_id`
- notifications targeted to role `user` or `all`

Users cannot see admin-only security notifications or another user's private notifications.

## Events That Create Notifications

Order events:

- `orders.order.created` creates an admin notification: `New product request`
- `orders.order.approved` creates a private user notification: `Order approved`
- `orders.order.rejected` creates a private user notification: `Order rejected`

Report events:

- `reports.job.completed` creates an admin notification: `Report completed`
- `reports.job.failed` creates an admin notification: `Report failed`

Security-related events:

- `auth.login.failed`
- `auth.unauthorized`
- `*.admin.denied`
- `orders.ownership.denied`
- `reports.job.failed`
- `inventory.stock.deduct.failed`

These create admin security notifications. Duplicate throttling is not implemented in Part 9.5; notifications are generated from incoming audit events.

## Endpoints

All endpoints require JWT authentication.

- `GET /audit/notifications?limit=20&unread_only=false`
- `GET /audit/notifications/unread-count`
- `PATCH /audit/notifications/{notification_id}/read`
- `PATCH /audit/notifications/read-all`

Missing or invalid tokens return `401`.

## Browser Test Flow

1. Login as admin.
2. Open the dashboard.
3. Click the bell icon.
4. Confirm the dropdown opens.
5. Confirm unread badge appears when unread notifications exist.
6. Click a notification and confirm it is marked read.
7. Click `Mark all as read`.
8. Login as user.
9. Confirm the user sees only their own notifications.

## PowerShell Test Flow

```powershell
$adminLogin = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin@secureops.com'; password = 'Admin@12345' } | ConvertTo-Json)
# Complete the current 2FA flow, then set:
$adminHeaders = @{ Authorization = "Bearer <ADMIN_JWT>" }

Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/notifications' -Headers $adminHeaders
Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/notifications/unread-count' -Headers $adminHeaders

$notifications = Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/audit/notifications' -Headers $adminHeaders
$first = $notifications.data | Select-Object -First 1
if ($first) {
  Invoke-RestMethod -Method Patch -Uri "http://localhost:8080/audit/notifications/$($first.id)/read" -Headers $adminHeaders
}

Invoke-RestMethod -Method Patch -Uri 'http://localhost:8080/audit/notifications/read-all' -Headers $adminHeaders
```

Event checks:

1. Login as user and create an order.
2. Confirm admin receives `New product request`.
3. Approve or reject the order as admin.
4. Confirm the user receives `Order approved` or `Order rejected`.
5. Trigger a failed login.
6. Confirm admin receives a security notification.
7. Generate a report and wait for worker completion.
8. Confirm admin receives `Report completed`.

## Safety Notes

- No secrets are displayed.
- `.env` remains unmanaged by the frontend.
- Security/platform configuration remains read-only.
- Existing Audit Logs and Security Center behavior continue to use audit logs.
