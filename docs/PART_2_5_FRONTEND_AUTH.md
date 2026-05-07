# SecureOps Part 2.5 Frontend Auth Integration

## What Was Integrated

Part 2.5 connects the existing React, Vite, TypeScript, Tailwind frontend to the completed Auth Service.

- Login now calls `POST /auth/login`
- Register now calls `POST /auth/register`
- App load refreshes the current user with `GET /auth/me`
- Logout calls `POST /auth/logout` and clears local auth state
- Admin and user route groups are protected
- Admin routes require `role === "admin"`
- User routes require authentication; admin users are also allowed
- Sidebar remains role-based
- Auth errors are shown as readable UI messages

No inventory, orders, files, reports, security-center backend integration, or new backend services were added.

## Run

```powershell
docker compose up --build
```

Open:

```text
http://localhost:8080
```

The frontend API client uses relative URLs by default, so it works through Nginx. If needed later, set:

```text
VITE_API_BASE_URL=
```

## Demo Accounts

Admin:

```text
admin@secureops.com
Admin@12345
```

User:

```text
user@secureops.com
User@12345
```

## Browser Test Plan

1. Open `http://localhost:8080/login`.
2. Login as admin.
3. Expected: redirected to `/admin/dashboard`.
4. Logout from the topbar.
5. Login as user.
6. Expected: redirected to `/user/dashboard`.
7. Try a wrong password.
8. Expected: safe error message, no route change.
9. Login successfully and refresh the browser.
10. Expected: session persists and protected route remains visible.
11. Logout.
12. Expected: token is revoked by the backend and local auth state is cleared.
13. Open `/admin/dashboard` without login.
14. Expected: redirected to `/login`.
15. Login as normal user, then open `/admin/dashboard`.
16. Expected: redirected to `/user/dashboard`.

## Storage Note

For demo usability, the frontend stores:

- `secureops_token`
- `secureops_user`

These values are in `localStorage` only for the university project demo. A production deployment should use a stronger browser-token strategy, tighter cookie/session controls, and CSRF-aware flows where appropriate.
