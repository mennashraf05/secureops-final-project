# SecureOps Part 2 Auth Service

## What Was Implemented

Part 2 implements only the Auth Service:

- User registration
- Login with bcrypt password verification
- JWT access tokens with expiration and unique `jti`
- Protected current-user route
- Admin-only RBAC route
- Logout by storing revoked token IDs
- `users` and `revoked_tokens` tables
- Idempotent seed users
- Safe HTTP errors
- Best-effort audit event calls to the audit service
- GitHub OAuth placeholder endpoints

Inventory, orders, files, reports, worker jobs, frontend integration, attack simulation, and full audit workflows are intentionally not implemented in Part 2.

## Endpoints

- `GET /auth/health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/admin-only`
- `GET /auth/oauth/github/login`
- `GET /auth/oauth/github/callback`

All examples below go through Nginx at `http://localhost:8080`.

## Demo Accounts

Admin:

- Email: `admin@secureops.com`
- Password: `Admin@12345`
- Role: `admin`

Normal user:

- Email: `user@secureops.com`
- Password: `User@12345`
- Role: `user`

Seed data is created on auth-service startup and is not duplicated if the users already exist.

## Run

```powershell
Copy-Item .env.example .env
docker compose up --build
```

If `.env` already exists, keep it and run:

```powershell
docker compose up --build
```

Invoke-WebRequest -UseBasicParsing http://localhost:8080/auth/health

## Register

```powershell
$body = @{
  name = "Demo Student"
  email = "student@secureops.com"
  password = "Student@12345"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/register" `
  -ContentType "application/json" `
  -Body $body
```

Expected: `201` with user data and no password hash.

## Login

```powershell
$loginBody = @{
  email = "user@secureops.com"
  password = "User@12345"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

$userToken = $login.access_token
$login
```

Expected: `200` with `access_token`, `token_type`, `expires_in`, and user info.

## Protected Route Without Token

```powershell
try {
  Invoke-RestMethod -Method Get -Uri "http://localhost:8080/auth/me"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`.

## Protected Route With Valid Token

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/auth/me" `
  -Headers @{ Authorization = "Bearer $userToken" }
```

Expected: `200` with the current user.

## Invalid Token

```powershell
try {
  Invoke-RestMethod `
    -Method Get `
    -Uri "http://localhost:8080/auth/me" `
    -Headers @{ Authorization = "Bearer invalid.token.value" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`.

## User Blocked From Admin Endpoint

```powershell
try {
  Invoke-RestMethod `
    -Method Get `
    -Uri "http://localhost:8080/auth/admin-only" `
    -Headers @{ Authorization = "Bearer $userToken" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `403`.

## Admin Allowed On Admin Endpoint

```powershell
$adminBody = @{
  email = "admin@secureops.com"
  password = "Admin@12345"
} | ConvertTo-Json

$adminLogin = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body $adminBody

$adminToken = $adminLogin.access_token

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/auth/admin-only" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Expected: `200`.

## Logout And Token Revocation

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/logout" `
  -Headers @{ Authorization = "Bearer $userToken" }
```

Expected: `200`.

Use the same token after logout:

```powershell
try {
  Invoke-RestMethod `
    -Method Get `
    -Uri "http://localhost:8080/auth/me" `
    -Headers @{ Authorization = "Bearer $userToken" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`.

## Verify Password Hashing In PostgreSQL

```powershell
docker exec -it secureops-postgres psql `
  -U secureops_user `
  -d secureops_db `
  -c "select email, password_hash from users;"
```

Expected: password hashes begin with a bcrypt prefix such as `$2b$`. Plain passwords must not appear.

## Audit Notes

The Auth Service sends best-effort audit events for successful login, failed login, logout, and blocked admin access to:

```text
http://audit-service:8000/audit/events
```

The current audit service is still a Part 1 template, so these calls are allowed to fail silently. Full audit persistence belongs in a later part.
