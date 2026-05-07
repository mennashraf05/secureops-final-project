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
