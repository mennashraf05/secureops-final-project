# Part 7.5 Frontend Audit Logs

Part 7.5 connects the existing Admin Audit Logs page to the real Audit Logs Service through Nginx.

## What Was Integrated

- Added `frontend/src/api/audit.ts` for Audit Service calls.
- Added `frontend/src/types/audit.ts` for audit log TypeScript types.
- Updated `frontend/src/pages/admin/AuditLogs.tsx` to load real audit logs instead of mock data.
- Preserved the existing page structure, cards, filters, and table styling.

## Admin Audit Logs Page Behavior

The page now:

- Loads audit logs from `GET /audit/logs`.
- Uses a default limit of 50 logs.
- Shows loading, error, and empty states.
- Shows KPI cards for total, success, failure, blocked, and info logs.
- Displays log ID, time, service, action, user ID, IP address, status, and details.
- Shows JSON details in a small expandable view when possible.

## Available Filters

- Service: all, auth-service, inventory-service, order-service, report-service, worker-service, audit-service.
- Status: all, success, failure, blocked, info.
- Action: exact backend action query, such as `auth.login.success`.
- User ID: optional numeric filter.
- Limit: 20, 50, or 100 logs.

## Example Events

- `auth.login.success`
- `auth.login.failed`
- `auth.logout`
- `inventory.product.created`
- `orders.order.approved`
- `reports.job.completed`

## Browser Test Flow

1. Login as admin with `admin@secureops.com` and `Admin@12345`.
2. Open `/admin/audit-logs`.
3. Confirm real logs load from the backend.
4. Filter by service `auth-service`.
5. Filter by status `success`.
6. Generate a failed login attempt.
7. Refresh logs and confirm `auth.login.failed` appears.
8. Create or update a product.
9. Refresh logs and confirm an inventory event appears.
10. Generate a report.
11. Refresh logs and confirm reports and worker events appear.
12. Logout and login as a normal user.
13. Try opening `/admin/audit-logs`.
14. Confirm the normal user is blocked or redirected.
