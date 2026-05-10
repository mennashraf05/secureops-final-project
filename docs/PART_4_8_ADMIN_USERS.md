# Part 4.8 - Admin Users

Part 4.8 adds an admin-only Users page and safe Auth Service endpoints for reviewing, creating, and deleting registered platform users.

## What Was Implemented

- Added `GET /auth/users` to the Auth Service.
- Added `POST /auth/users` for creating normal user or admin accounts.
- Added `DELETE /auth/users/{user_id}` for deleting normal user or admin accounts.
- Added a frontend `getUsers()` API function using the existing authenticated request helper.
- Added the admin route `/admin/users`.
- Added a Users link to the admin sidebar.
- Added a User Management page using the existing admin cards, filters, badges, table style, and form controls.

No user editing, account activation changes, File Service, Reports, Audit backend, Security Center backend, or Attack Simulation backend were implemented.

## Backend Endpoint

```text
GET /auth/users
```

```text
POST /auth/users
```

Request body:

```json
{
  "name": "Operations Admin",
  "email": "ops.admin@secureops.com",
  "password": "StrongPass123",
  "role": "admin"
}
```

```text
DELETE /auth/users/{user_id}
```

Admins can delete normal users or other admins. The current logged-in admin cannot delete their own account.

Successful admin response:

```json
{
  "success": true,
  "message": "Users retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "SecureOps Admin",
      "email": "admin@secureops.com",
      "role": "admin",
      "is_active": true,
      "created_at": "2026-05-07T..."
    }
  ]
}
```

`password_hash` is never returned by the endpoint or shown in the frontend.

## RBAC Behavior

- Valid admin JWT: `200 OK`
- Valid normal user JWT: `403 Forbidden`
- Missing or invalid JWT: `401 Unauthorized`

The endpoint uses the existing Auth Service JWT dependencies and `require_admin` RBAC guard.

## Frontend Route

```text
/admin/users
```

The page shows:

- Total Users
- Admin Users
- Normal Users
- Active Users
- Search by name or email
- Role filter for all, admin, and user
- Users table with ID, name, email, role, status, and created date
- Create user form for normal user or admin accounts
- Delete action for normal users and other admins

## Browser Test Flow

1. Login as admin:
   - Email: `admin@secureops.com`
   - Password: `Admin@12345`
2. Open `/admin/users`.
3. Confirm all users are displayed.
4. Search by email.
5. Filter admin and user roles.
6. Logout.
7. Login as normal user:
   - Email: `user@secureops.com`
   - Password: `User@12345`
8. Try opening `/admin/users`.
9. Confirm the user is blocked or redirected.

## PowerShell Backend Tests

Admin token should return users:

```powershell
$adminLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "admin@secureops.com"; password = "Admin@12345" } | ConvertTo-Json)

Invoke-RestMethod -Method Get -Uri "http://localhost:8080/auth/users" `
  -Headers @{ Authorization = "Bearer $($adminLogin.access_token)" }
```

Normal user token should return `403`:

```powershell
$userLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "user@secureops.com"; password = "User@12345" } | ConvertTo-Json)

Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/auth/users" `
  -Headers @{ Authorization = "Bearer $($userLogin.access_token)" }
```

Missing token should return `401`:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Get -Uri "http://localhost:8080/auth/users"
```
