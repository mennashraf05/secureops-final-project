# SecureOps

Secure Distributed Inventory & Risk Monitoring Platform

## 1. Project Overview

SecureOps is a distributed, security-focused inventory and risk monitoring platform for managing users, products, product requests, asynchronous reports, audit logs, security monitoring, and admin alerts.

The project demonstrates a practical microservices architecture with authentication, authorization, API gateway routing, message queue processing, centralized audit logging, operational dashboards, risk monitoring, and downloadable report generation.

SecureOps includes:

- Distributed FastAPI backend services.
- React/Vite frontend.
- Nginx API Gateway.
- PostgreSQL persistence.
- RabbitMQ message queue.
- Worker-based asynchronous report generation.
- JWT authentication with email verification and mandatory Authenticator App 2FA.
- Formal RBAC database tables.
- Admin and user workflows.
- Audit logs, Security Center, risk scoring, notifications, and rich downloadable reports.

## 2. Main Features

### Authentication and Identity

- User registration and login.
- JWT-based authentication.
- Password hashing with bcrypt.
- Email verification for new accounts.
- Mandatory Authenticator App 2FA.
- GitHub OAuth login.
- Forgot password flow with reset codes.
- Protected frontend routes for admin and user portals.
- Remember-me session support.

### Authorization and RBAC

- Admin and user roles.
- Formal RBAC tables:
  - `roles`
  - `permissions`
  - `user_roles`
  - `role_permissions`
- Existing `users.role` column is preserved for backward compatibility.
- Admin-only backend endpoints and frontend pages.
- User ownership checks for user-specific resources such as orders and notifications.
- Admin Users page for safe user management without exposing password hashes.

### Inventory

- Product listing.
- Admin product create, edit, delete, and stock update.
- Product search and filtering.
- Low-stock logic.
- Validation for required product fields.
- Validation against negative price and quantity.
- Duplicate SKU handling with safe errors.

### Orders

- User product request/order creation.
- User My Orders page.
- Admin order review.
- Approve/reject workflow.
- Stock deduction on approval.
- Admin order table includes user name and email snapshots.
- Ownership protection so users can only access their own orders.

### Reports

- Inventory Report.
- Low Stock Report.
- Security Report.
- Audit Report.
- RabbitMQ-backed asynchronous jobs.
- Worker-generated downloadable `.txt` report files.
- Rich report content based on real database summaries.
- Job tracking with pending, processing, completed, and failed statuses.

### Audit and Security

- Centralized audit logs for critical system actions.
- Failed login tracking.
- Unauthorized access and admin-denied event tracking.
- IP capture.
- Security Center.
- Realistic risk score.
- Per-user risk score.
- Security alerts.
- Real security charts.
- Dismissed security alerts.

### Notifications

- In-app notification bell.
- Role-aware admin and user notifications.
- Telegram admin notifications.
- Settings controls for accepting or rejecting Telegram admin notifications.
- Notification read/unread tracking.

### Settings

- Read-only platform and security configuration display.
- Local browser preferences for UI behavior.
- Secrets are hidden and not editable through the UI.
- Telegram notification settings are controlled safely.
- Secure File Vault with JWT-protected upload/download, encrypted private storage, and SHA-256 integrity verification.

### Gateway and Infrastructure

- Nginx API Gateway.
- Gateway routing to frontend and backend services.
- Rate limiting.
- Request size limit.
- Security headers.
- RabbitMQ Management UI restricted to localhost.
- Docker Compose orchestration.

## 3. Architecture

SecureOps uses a Docker Compose microservices architecture. The browser communicates through Nginx, which routes frontend and API traffic to the correct service. Backend services share PostgreSQL for persistence. Report jobs are queued through RabbitMQ and processed asynchronously by the Worker Service.

```text
Browser / React Frontend
        |
        v
Nginx API Gateway
        |
        +--> Auth Service
        +--> Inventory Service
        +--> Order Service
        +--> Report Service
        +--> Audit Service
        +--> File Service
        |
        +--> PostgreSQL
        +--> RabbitMQ --> Worker Service
```

### Service Responsibilities

- **Frontend**: React/Vite application for admin and user workflows.
- **Nginx**: API gateway, rate limiting, request size limit, security headers, and service routing.
- **Auth Service**: Users, login, JWT, email verification, 2FA, GitHub OAuth, forgot password, and RBAC.
- **Inventory Service**: Product catalog, admin product management, stock updates, and internal stock deduction.
- **Order Service**: User product requests, admin approval/rejection, order ownership, and stock deduction orchestration.
- **Report Service**: Report job creation, status tracking, and report download endpoint.
- **Worker Service**: RabbitMQ consumer that generates report files and updates job status.
- **Audit Service**: Audit log ingestion, security summaries, risk score, notifications, Security Center data, and settings.
- **File Service**: Secure File Vault upload/download, metadata persistence, encrypted storage, and integrity verification.
- **PostgreSQL**: Shared persistence for users, products, orders, jobs, audit logs, notifications, settings, and RBAC tables.
- **RabbitMQ**: Asynchronous report job queue.

## 4. Technology Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS.
- **Backend**: Python, FastAPI, SQLAlchemy, Pydantic.
- **Authentication**: JWT, bcrypt password hashing, Authenticator App TOTP, email codes, GitHub OAuth.
- **Database**: PostgreSQL.
- **Queue**: RabbitMQ.
- **Gateway**: Nginx.
- **Deployment**: Docker Compose.

## 5. Security Design

SecureOps is designed as a security-oriented platform and demo system.

Implemented security controls include:

- JWT authentication.
- bcrypt password hashing.
- Email verification.
- Mandatory Authenticator App 2FA.
- GitHub OAuth with verified email mapping.
- Formal RBAC tables.
- Admin-only endpoint protection.
- User ownership checks.
- Internal API key protection for service-to-service endpoints.
- Audit logging for critical actions.
- Safe error responses.
- Input validation hardening across backend and frontend.
- Rate limiting at the Nginx gateway.
- Security headers at the Nginx gateway.
- RabbitMQ Management UI limited to localhost.
- Secrets hidden from UI and reports.

Not yet implemented:

- HTTPS termination.
- Attack Simulation backend.
- Full Attack Simulation backend.

## 6. Report System

Reports are generated asynchronously.

1. An admin creates a report job through the Report Service.
2. The Report Service stores a pending job in PostgreSQL.
3. The Report Service publishes a RabbitMQ message.
4. The Worker Service consumes the message.
5. The Worker marks the job as processing.
6. The Worker generates a `.txt` report file.
7. The Worker marks the job as completed and stores `result_path`.
8. Admins download the report through the existing download endpoint.

Supported report types:

- `inventory_report`
- `low_stock_report`
- `security_report`
- `audit_report`

Reports contain professional summaries based on real database data where available. Generated report files do not include secrets, password hashes, JWTs, SMTP credentials, GitHub secrets, Telegram tokens, RabbitMQ passwords, database passwords, or internal API keys.

## 7. API Gateway Routes

Main routes through Nginx:

- `/auth/*` -> Auth Service
- `/products/*` -> Inventory Service
- `/orders/*` -> Order Service
- `/reports/*` -> Report Service
- `/audit/*` -> Audit Service
- `/security/*` -> Audit Service security endpoints
- `/files/*` -> File Service
- `/` -> React frontend

Health checks:

- `http://localhost:8080/auth/health`
- `http://localhost:8080/products/health`
- `http://localhost:8080/orders/health`
- `http://localhost:8080/files/health`
- `http://localhost:8080/reports/health`
- `http://localhost:8080/audit/health`

## 8. Running Locally

Create a local environment file from the placeholder example:

```bash
cp .env.example .env
```

Then start the stack:

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:8080
```

RabbitMQ Management UI:

```text
http://localhost:15673
```

The RabbitMQ Management UI is intended for localhost-only access.

## 9. Environment Variables

Use `.env.example` as the source of required variable names and placeholders. Do not commit real secrets.

Examples of values that must remain secret:

- JWT secret.
- Database password.
- RabbitMQ password.
- Internal API key.
- SMTP password.
- GitHub client secret.
- Telegram bot token.
- Telegram chat ID when sensitive.

The application expects `.env` locally, but `.env` should not be committed.

## 10. User Roles

SecureOps supports two primary user roles:

- `admin`
- `user`

Admins can:

- Manage users.
- Manage products.
- View and act on all orders.
- Generate and download reports.
- View audit logs.
- View Security Center and monitoring dashboards.
- Manage allowed settings and notification controls.

Users can:

- Browse available products.
- Submit product requests/orders.
- View their own orders.
- Update their own profile.
- Receive user-specific notifications.

RBAC is stored formally in `roles`, `permissions`, `user_roles`, and `role_permissions`. The older `users.role` column remains for compatibility with existing flows and JWT role claims.

## 11. Frontend Pages

Admin pages include:

- Dashboard / Operations & Security Command Center.
- Users.
- Products.
- Orders.
- Reports.
- Audit Logs.
- Security Center.
- Settings.
- Architecture.
- Secure File Vault.
- Attack Simulation placeholder/pending workflow.

User pages include:

- User Dashboard.
- Available Products.
- My Orders.
- My Files.
- Profile.

## 12. Documentation

Detailed implementation notes are stored in `docs/`. Key documents include:

- `docs/PART_2_AUTH.md`
- `docs/AUTH_2FA_TEST_FLOW.md`
- `docs/PART_3_INVENTORY.md`
- `docs/PART_4_ORDERS.md`
- `docs/PART_6_REPORTS_RABBITMQ_WORKER.md`
- `docs/PART_7_AUDIT_LOGS.md`
- `docs/PART_8_MONITORING_SECURITY_CENTER.md`
- `docs/PART_9_10_FORMAL_RBAC_TABLES.md`
- `docs/PART_9_11_RICH_REPORT_CONTENT.md`

These documents explain the incremental build history and verification flows.

## 13. Secure File Vault

The File Service implements a real secure file vault behind the Nginx gateway.

Security behavior:

- All vault endpoints except `/files/health` require a valid JWT bearer token.
- Normal users can list, download, verify, and delete only their own files.
- Admin users can access all secure files.
- Uploads validate extension and MIME type.
- Dangerous extensions are blocked, including `.exe`, `.php`, `.js`, `.bat`, `.sh`, `.cmd`, `.ps1`, `.msi`, `.dll`, `.jar`, `.py`, `.html`, and `.htm`.
- Double-extension bypasses such as `invoice.pdf.exe` are rejected.
- Path traversal names such as `../../evil.php` are rejected.
- Each file is encrypted with its own random Fernet file key before being written to the Docker volume.
- The per-file key is encrypted with the `MASTER_KEY` from `.env` and stored in PostgreSQL as `encrypted_file_key`.
- The master key is never stored in the database.
- Plaintext and encrypted SHA-256 hashes are stored in PostgreSQL.
- Download verifies encrypted-file integrity before decrypting and serving content.
- Manual integrity verification is available from the frontend and API.

Supported file types by default:

- `pdf`
- `txt`
- `csv`
- `png`
- `jpg`
- `jpeg`
- `docx`
- `xlsx`

Default upload settings in `.env.example`:

```env
FILE_MAX_UPLOAD_MB=10
FILE_ALLOWED_EXTENSIONS=pdf,txt,csv,png,jpg,jpeg,docx,xlsx
FILE_STORAGE_PATH=/app/file-service/storage/vault
FERNET_KEY=<placeholder-valid-fernet-key-needed>
MASTER_KEY=<placeholder-valid-fernet-key-needed>
```

Generate a valid Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Store that generated value in local `.env` as `MASTER_KEY`. Do not commit `.env`.

Docker storage:

- The `file-storage` Docker volume is mounted at `/app/file-service/storage`.
- Encrypted vault files are stored under `/app/file-service/storage/vault`.
- The frontend/public folder is never used for uploaded file storage.

API examples require a JWT:

```bash
TOKEN="paste-jwt-here"

curl http://localhost:8080/files/health

curl -H "Authorization: Bearer $TOKEN" \
  -F "file=@README.md;type=text/plain;filename=valid.txt" \
  http://localhost:8080/files/upload

curl -H "Authorization: Bearer $TOKEN" \
  -F "file=@README.md;type=application/octet-stream;filename=payload.exe" \
  http://localhost:8080/files/upload

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/files

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/files/1/download --output downloaded-file

curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/files/1/verify-integrity
```

Run the file-service tests:

```bash
docker compose exec file-service python -m pytest test_file_upload.py -q
```

## 14. Known Limitations and Pending Work

The following areas are intentionally not complete yet:

- HTTPS termination is not implemented.
- Attack Simulation backend is pending/coming soon.
- Production-grade database migrations are not fully separated from startup-safe local migration logic.

## 15. Safety Notes

- Do not commit `.env`.
- Do not expose real secrets in documentation, screenshots, reports, or frontend UI.
- Keep `.env.example` values as placeholders only.
- Downloaded reports are designed to summarize operational and security data without exposing secrets.
- Backend validation remains the source of truth for security validation.

## 16. Quick Verification

After starting the stack, verify:

```bash
curl http://localhost:8080/auth/health
curl http://localhost:8080/products/health
curl http://localhost:8080/orders/health
curl http://localhost:8080/reports/health
curl http://localhost:8080/audit/health
curl http://localhost:8080/files/health
```

Then test from the browser:

1. Open `http://localhost:8080`.
2. Login through the current Auth + 2FA flow.
3. Visit the Admin Dashboard.
4. Open Products, Orders, Reports, Audit Logs, Security Center, Settings, and Notifications.
5. Generate and download reports from `/admin/reports`.
6. Confirm normal users cannot access admin-only pages.

