# Part 8.8 Audit Admin Denied Fix

Part 8.8 makes Audit Service RBAC monitoring consistent with the other backend services.

## What Changed

When an authenticated non-admin user tries to access an Audit Service admin endpoint, Audit Service now records:

- `action`: `audit.admin.denied`
- `service_name`: `audit-service`
- `status`: `blocked`
- `user_id`: current user ID
- `ip_address`: captured from request headers when available
- `details`: reason and attempted path

## Covered Endpoints

The shared `require_admin` dependency protects and logs denials for:

- `GET /audit/logs`
- `GET /audit/logs/{log_id}`
- `GET /audit/monitoring/summary`
- `GET /audit/security/overview`
- `GET /audit/security/charts`
- `GET /audit/security/user-risk`
- `GET /audit/security/user-risk/{user_id}`

Missing or invalid tokens still return `401` and do not create admin-denied events because no authenticated user is available.

## Monitoring Impact

`audit.admin.denied` is included in admin denied counters, security factors, and risk calculations because it follows the existing `*.admin.denied` convention.
