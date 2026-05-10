# Part 7.6 Audit IP Capture

Part 7.6 improves audit logs by capturing client IP addresses for audit events that originate from HTTP requests.

## What Changed

- Added `backend/shared/request_utils.py` with `get_client_ip(request)`.
- Request-based audit events now prefer `X-Forwarded-For`, then `X-Real-IP`, then `request.client.host`.
- Auth login success, login failure, logout, and authorization failures now include IP addresses.
- Inventory, Orders, and Reports request-based audit events use the shared helper.
- Worker/background audit events keep `ip_address` as `null` because they are not tied to a direct client request.
- The Admin Audit Logs page shows `Internal` for worker-service events with no IP address.

## Nginx Forwarded Headers

Nginx already forwards these proxy headers to backend services:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Expected Behavior

Request-based events such as `auth.login.success`, `auth.login.failed`, `auth.logout`, `inventory.product.created`, `orders.order.created`, and `reports.job.created` should show an IP address in audit logs.

Worker events such as `reports.job.completed` may show `Internal` in the frontend because they run in the background without an HTTP client request.
