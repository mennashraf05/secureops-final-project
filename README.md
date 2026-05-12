# SecureOps

SecureOps - Secure Distributed Inventory & Risk Monitoring Platform

## Part 1 Foundation

Part 1 creates the clean project foundation only:

- Docker Compose setup for Nginx, frontend, FastAPI services, PostgreSQL, RabbitMQ, and worker service
- Shared backend utilities for configuration, database sessions, safe errors, and standard responses
- Minimal FastAPI templates with health checks
- RabbitMQ worker connection template
- Nginx API Gateway routing with basic security headers and rate limiting
- Setup documentation in `docs/PART_1_SETUP.md`

No authentication, inventory, orders, file upload, reports, audit workflows, or frontend integration are implemented yet.

## Run

```bash
cp .env.example .env
docker compose up --build
```

## Health Checks

Test through Nginx:

- http://localhost:8080/auth/health
- http://localhost:8080/products/health
- http://localhost:8080/orders/health
- http://localhost:8080/files/health
- http://localhost:8080/reports/health
- http://localhost:8080/audit/health

Frontend:

- http://localhost:8080

RabbitMQ management:

- http://localhost:15673

## Part 2 Auth

Part 2 implements the Auth Service only. See `docs/PART_2_AUTH.md` for endpoints, demo accounts, and PowerShell test commands.

## Part 2.5 Frontend Auth

Part 2.5 connects the existing React frontend to the Auth Service. See `docs/PART_2_5_FRONTEND_AUTH.md` for browser test steps.

## Part 3 Inventory

Part 3 implements the Inventory Service product management API. See `docs/PART_3_INVENTORY.md` for endpoints, RBAC rules, and PowerShell test commands.

## Part 3.5 Frontend Products

Part 3.5 connects the existing frontend product pages to the Inventory Service. See `docs/PART_3_5_FRONTEND_PRODUCTS.md` for browser test steps.

## Part 4 Orders

Part 4 implements the Order Service backend for product requests. See `docs/PART_4_ORDERS.md` for endpoints, RBAC rules, and PowerShell test commands.
## Part 4.5 Frontend Orders

Part 4.5 connects the existing frontend order pages to the Order Service. Users can submit real product requests from the User Products page, view their own orders in My Orders, and admins can view, approve, or reject orders from the Admin Orders page. See `docs/PART_4_5_FRONTEND_ORDERS.md` for browser test steps.

## Part 4.6 Stock Deduction on Approval

Part 4.6 adds automatic stock deduction when an admin approves an order. Stock is deducted only after approval, not when the order is created or rejected. The Order Service communicates with the Inventory Service using an internal API key for service-to-service security. See `docs/PART_4_6_STOCK_DEDUCTION.md` for implementation details and tests.

## Part 4.7 Admin Order User Info

Part 4.7 improves the Admin Orders page by showing user information instead of only numeric user IDs. Orders now store user snapshot fields such as `user_name` and `user_email`, with fallback handling for older orders. See `docs/PART_4_7_ADMIN_ORDER_USER_INFO.md` for details.

## Part 4.8 Admin Users

Part 4.8 adds an admin-only Users page and Auth Service endpoints for viewing, creating, and deleting registered users safely without exposing password hashes. See `docs/PART_4_8_ADMIN_USERS.md` for details.

## Part 6 Reports + RabbitMQ + Worker

Part 6 implements asynchronous report generation using the Report Service, RabbitMQ, Worker Service, and PostgreSQL job tracking. Admins can create inventory report jobs, RabbitMQ queues the jobs, and the Worker Service consumes them and marks jobs as completed. See `docs/PART_6_REPORTS_RABBITMQ_WORKER.md` for endpoints, worker behavior, and PowerShell test commands.

## Part 6.5 Frontend Reports

Part 6.5 connects the Admin Reports page to the Report Service. Admins can create inventory report jobs, view job statuses, and verify worker completion through the UI. See `docs/PART_6_5_FRONTEND_REPORTS.md` for browser test steps.

## Part 6.6 Report Download + Low Stock Report

Part 6.6 adds downloadable report files and implements Low Stock Report generation. Security and Audit report buttons remain disabled until their backend modules are implemented. See `docs/PART_6_6_REPORT_DOWNLOAD_AND_LOW_STOCK.md` for test steps.

## Part 7 Audit Logs

Part 7 implements a real Audit Logs Service. Critical actions from Auth, Inventory, Orders, Reports, and Worker are recorded through an internal API key protected endpoint, and admins can view audit logs securely. See `docs/PART_7_AUDIT_LOGS.md` for backend test steps.

## Part 7.5 Frontend Audit Logs

Part 7.5 connects the Admin Audit Logs page to the Audit Service. Admins can view centralized audit events from Auth, Inventory, Orders, Reports, and Worker with filters for service, status, action, user, and limit. See `docs/PART_7_5_FRONTEND_AUDIT_LOGS.md` for browser test steps.

## Part 8 Monitoring Dashboard + Security Center

Part 8 connects monitoring and security dashboards to real backend data from audit logs, users, products, orders, and report jobs. It calculates a risk score, derives security alerts, and displays real security events for admins. See `docs/PART_8_MONITORING_SECURITY_CENTER.md` for test steps.

## Part 8.5 Real Security Charts

Part 8.5 connects the Security Center charts to real audit-log-derived backend data, including events over time, risk score trends, severity breakdown, and status distribution. See `docs/PART_8_5_REAL_SECURITY_CHARTS.md` for test steps.

## Part 8.6 Per-User Risk Score

Part 8.6 adds per-user risk scoring derived from audit logs so admins can identify users or system actors associated with suspicious activity. See `docs/PART_8_6_PER_USER_RISK_SCORE.md` for test steps.

## Part 9 Email Verification + Mandatory 2FA

Part 9 adds email verification for new accounts, email setup links for admin-created accounts, and mandatory two-factor authentication for all users. `/auth/login` validates email/password and starts the 2FA step; JWT tokens are issued only after `/auth/2fa/verify` succeeds. See `docs/AUTH_2FA_TEST_FLOW.md` for the updated PowerShell login commands.

## Part 9.2 Dashboard Quick Actions

Part 9.2 connects Admin Dashboard quick action buttons to the correct admin workflows while keeping unfinished File Integrity and Attack Simulation actions clearly marked as coming soon. See `docs/PART_9_2_DASHBOARD_QUICK_ACTIONS.md` for browser test steps.

## Part 9.3 Rate Limiting + RabbitMQ Hardening

Part 9.3 refines API Gateway rate limiting, adds stricter limits for authentication and 2FA endpoints, returns HTTP 429 for rate-limited requests, and restricts RabbitMQ Management UI to localhost using custom credentials. See `docs/PART_9_3_RATE_LIMITING_RABBITMQ_HARDENING.md` for verification steps.

## Part 9.4 Settings Page

Part 9.4 replaces placeholder settings with realistic configuration display and safe editable local UI preferences without exposing secrets. See `docs/PART_9_4_SETTINGS_PAGE.md` for browser test steps.

## Part 9.5 Notifications

Part 9.5 connects the bell icon to real role-based notifications. Admins receive security, report, and product request alerts, while users receive their own order/account notifications. See `docs/PART_9_5_NOTIFICATIONS.md` for test steps.

## Part 9.6 GitHub OAuth

Part 9.6 implements real GitHub OAuth login using a GitHub OAuth App. Users can continue with GitHub, the Auth Service exchanges the OAuth code, maps the verified GitHub email to a local user, issues a JWT, and records OAuth audit events. See `docs/PART_9_6_GITHUB_OAUTH.md` for setup and test steps.

## Part 9.7 Telegram Admin Notifications

Part 9.7 sends important admin alerts to Telegram and adds a Settings control so admins can accept or reject Telegram notifications. Telegram secrets remain in `.env` and are never displayed in the UI. See `docs/PART_9_7_TELEGRAM_ADMIN_NOTIFICATIONS.md` for setup and test steps.

## Part 9.8 Remember Me + Forgot Password

Part 9.8 makes the login Remember me option functional and adds a secure forgot-password flow using email reset codes. Password reset does not bypass mandatory 2FA. See `docs/PART_9_8_REMEMBER_ME_FORGOT_PASSWORD.md` for setup and test steps.

## Part 9.9 Input Validation Hardening

Part 9.9 reviews and strengthens input validation across Auth, Inventory, Orders, Reports, Audit, Settings, Notifications, and frontend forms. Backend schemas remain the source of truth for security validation. See `docs/PART_9_9_INPUT_VALIDATION_HARDENING.md` for details.

## Part 9.10 Formal RBAC Tables

Part 9.10 adds formal RBAC database tables for roles, permissions, user-role mapping, and role-permission mapping while preserving the existing users.role field for compatibility. See `docs/PART_9_10_FORMAL_RBAC_TABLES.md` for details.

## Part 9.11 Security and Audit Reports

Part 9.11 enables Security Report and Audit Report generation through the existing Report Service, RabbitMQ queue, Worker Service, and downloadable report files. Security reports summarize suspicious activity and risk indicators, while audit reports summarize centralized audit events. See `docs/PART_9_11_SECURITY_AUDIT_REPORTS.md` for details.

## Part 9.11 Rich Report Content

Part 9.11 upgrades generated report files from simple simulated output to professional reports containing real inventory, low-stock, security, and audit summaries generated asynchronously by the Worker Service. See `docs/PART_9_11_RICH_REPORT_CONTENT.md` for details.
