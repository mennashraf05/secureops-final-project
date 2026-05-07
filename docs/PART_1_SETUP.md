# SecureOps Part 1 Setup

## Folder Structure

```text
secureops-app/
├── frontend/
├── backend/
│   ├── shared/
│   ├── auth-service/
│   ├── inventory-service/
│   ├── order-service/
│   ├── file-service/
│   ├── report-service/
│   ├── audit-service/
│   └── worker-service/
├── nginx/
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

The frontend remains a React, Vite, TypeScript, and Tailwind app inside `frontend/`.

## Containers

- `nginx`: public API Gateway and frontend proxy
- `frontend`: existing React/Vite app
- `auth-service`: FastAPI auth service foundation
- `inventory-service`: FastAPI inventory service foundation
- `order-service`: FastAPI order service foundation
- `file-service`: FastAPI file service foundation with storage folder
- `report-service`: FastAPI report service foundation
- `audit-service`: FastAPI audit/security service foundation
- `worker-service`: RabbitMQ connection worker template
- `postgres`: PostgreSQL 16 database
- `rabbitmq`: RabbitMQ with management UI

## Ports

- `8080`: Nginx public gateway
- `5433`: PostgreSQL local testing only, mapped to container port `5432`
- `15673`: RabbitMQ management demo port, mapped to container port `15672`

Backend services are only exposed inside the Docker network on port `8000`.

## Gateway Design

Only Nginx is public for the application because it gives the project a single controlled entry point. This keeps backend services private on the Docker network and allows gateway-level controls such as request routing, security headers, upload size limits, and rate limiting.

## RabbitMQ Credentials

RabbitMQ does not use `guest/guest`. The username and password come from `.env` through `RABBITMQ_USER` and `RABBITMQ_PASSWORD`, which avoids default credentials and makes the deployment easier to harden later.

## Part 2 Scope

Part 2 can begin implementing real application behavior, such as authentication models, JWT login, password hashing, role foundations, database migrations, and service-level API contracts. Part 1 intentionally stops at clean infrastructure, shared utilities, health checks, and container wiring.
