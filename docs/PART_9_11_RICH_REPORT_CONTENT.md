# Part 9.11 Rich Report Content

Part 9.11 upgrades generated report files from simple simulated output to professional reports containing real inventory, low-stock, security, and audit summaries generated asynchronously by the Worker Service.

## What Changed

- `inventory_report` now reads product data and includes executive inventory summaries.
- `low_stock_report` now lists low-stock/out-of-stock products with suggested actions.
- `security_report` summarizes security events from centralized audit logs.
- `audit_report` summarizes audit log volume, status distribution, services, actions, and recent events.
- Worker report generation uses read-only SQL queries and safe fallbacks when optional tables are unavailable.

## Supported Report Types

- `inventory_report`
- `low_stock_report`
- `security_report`
- `audit_report`

## Asynchronous Flow

1. Report Service creates a pending job.
2. RabbitMQ queues the job message.
3. Worker Service marks the job as processing.
4. Worker Service reads PostgreSQL summaries and writes a `.txt` report.
5. Worker Service marks the job completed and stores `result_path`.
6. Admin downloads the file through `GET /reports/jobs/{job_id}/download`.

## Report Contents

Inventory reports include:

- Report metadata
- Executive summary
- Total products
- Low stock and out-of-stock counts
- Total inventory value
- Average product price
- Total stock units
- Product details
- Recommendations
- System flow

Low-stock reports include:

- Report metadata
- Low stock count
- Out-of-stock count
- Affected categories
- Product details
- Suggested actions
- Recommendations

Security reports include:

- Report metadata
- Failed logins
- Unauthorized attempts
- Admin denied events
- Ownership denied events
- Blocked event counts
- Risk indicators
- Recent security events
- Recommendations

Audit reports include:

- Report metadata
- Total audit logs
- Count by status
- Events by service
- Top actions
- Recent audit events
- Compliance notes

## Security Notes

- Reports never include password hashes.
- Reports never include JWT tokens.
- Reports never include SMTP, GitHub, Telegram, RabbitMQ, or internal API secrets.
- Audit `details` are summarized and sensitive-looking values are redacted.
- If a data source is unavailable, the report states: `Data source unavailable in this environment.`

## Browser Test Flow

1. Open `/admin/reports`.
2. Generate each report type.
3. Confirm each job appears.
4. Confirm each job becomes completed.
5. Download each report.
6. Confirm the content is rich and readable.

## PowerShell Test Flow

1. Login as admin through the current auth and 2FA flow.
2. Create an inventory report job and wait for completion.
3. Download the report and confirm it contains `Executive Summary`, `Total Products`, `Low Stock Items`, and `Product Details`.
4. Create a low stock report job and confirm it contains `Summary` and `Low Stock Product Details`.
5. Create a security report job and confirm it contains `Failed Logins`, `Unauthorized Attempts`, and `Recent Security Events`.
6. Create an audit report job and confirm it contains `Audit Summary`, `Events by Service`, `Top Actions`, and `Recent Audit Events`.
