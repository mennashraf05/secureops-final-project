# Part 8.10 Dismiss Security Alerts

Part 8.10 adds realistic Security Center alert dismissal while keeping audit logs immutable.

## Audit Logs Stay Immutable

Audit logs are compliance and forensic records. They are not deleted or modified when an admin dismisses a Security Center alert.

The Audit Logs page continues to show the original event, such as:

- `auth.login.failed`
- `auth.unauthorized`
- `audit.admin.denied`
- `inventory.admin.denied`
- `orders.ownership.denied`

## Dismissed Alerts Table

Audit Service now creates a separate table:

- `dismissed_security_alerts`

Fields:

- `id`
- `audit_log_id`
- `dismissed_by`
- `reason`
- `created_at`

This table tracks which audit-log-derived alerts have been reviewed and dismissed.

## Dismiss Endpoint

Admins can dismiss an alert with:

- `POST /audit/security/alerts/{audit_log_id}/dismiss`

Optional body:

```json
{
  "reason": "Reviewed by admin"
}
```

The endpoint verifies the audit log exists, records the dismissal, and returns:

```json
{
  "success": true,
  "message": "Security alert dismissed successfully.",
  "data": {
    "id": 1,
    "audit_log_id": 42,
    "dismissed_by": 1,
    "reason": "Reviewed by admin",
    "created_at": "..."
  }
}
```

Authenticated non-admin users receive `403`. Missing or invalid tokens receive `401`.

## Security Center Behavior

`GET /audit/security/overview` still derives active security signals from audit logs, but excludes audit log IDs present in `dismissed_security_alerts`.

After dismissal, the event is removed from active Security Center views:

- Security Alerts
- Recent Security Events
- Risk Factors
- Security Center risk score and counters
- Security Center charts
- Per-user risk scores

Audit Logs remain based on the original immutable audit log history, so the original event is still available for compliance and forensic review.

## Dismissal Is Audited

Every successful dismissal records a new audit event:

- `action`: `security.alert.dismissed`
- `service_name`: `audit-service`
- `status`: `success`
- `user_id`: current admin user ID
- `details`: dismissed audit log ID and reason

This matches SOC/SIEM behavior: alerts can be acknowledged after review, but evidence remains preserved.

## Browser Test Flow

1. Login as admin.
2. Open `/admin/security`.
3. Confirm alerts appear.
4. Click **Dismiss** on one alert.
5. Confirm the alert disappears from Security Center.
6. Open `/admin/audit-logs`.
7. Confirm the original event still exists.
8. Confirm `security.alert.dismissed` appears in audit logs.
9. Login as a normal user.
10. Confirm the user cannot dismiss alerts.
