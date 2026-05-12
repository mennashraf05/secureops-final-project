# Part 9.10 Formal RBAC Tables

Part 9.10 adds formal RBAC database tables while preserving the existing `users.role` column for backward compatibility. Existing JWTs, admin checks, frontend pages, and service APIs continue to use the simple `admin` / `user` role shape, but the Auth Service now has normalized role and permission storage.

## Why Formal RBAC Was Added

SecureOps already enforced RBAC through `users.role`, but formal database tables make access control easier to audit, extend, and verify. The new tables support explicit role assignment and role-permission mapping without removing the existing compatibility field.

## Tables

- `roles`: role names such as `admin` and `user`.
- `permissions`: permission names such as `users:read`, `products:write`, and `audit:read`.
- `user_roles`: many-to-many user-to-role mapping with a unique `(user_id, role_id)` constraint.
- `role_permissions`: many-to-many role-to-permission mapping with a unique `(role_id, permission_id)` constraint.

## Backward Compatibility

- `users.role` remains in place and is not removed.
- JWTs still include a single `role` claim of `admin` or `user`.
- Token role selection prefers `user_roles`; if no formal role exists, it falls back to `users.role`.
- If a user has multiple roles and one is `admin`, the JWT role claim is `admin`.

## Seed And Backfill

Startup creates the new RBAC tables with `Base.metadata.create_all`.

The Auth Service seeds:

- Roles: `admin`, `user`
- Admin permissions:
  - `users:read`
  - `users:create`
  - `users:delete`
  - `products:read`
  - `products:write`
  - `orders:read`
  - `orders:approve`
  - `reports:read`
  - `reports:create`
  - `audit:read`
  - `security:read`
  - `settings:read`
- User permissions:
  - `products:read`
  - `orders:create`
  - `orders:read_own`
  - `profile:read`
  - `profile:update`

Admin receives admin and user permissions. User receives user permissions only.

Existing users are backfilled idempotently:

- `users.role = admin` gets the `admin` role.
- `users.role = user` gets the `user` role.
- Missing or unknown roles default safely to `user`.

## New User Behavior

- Registered users keep `users.role = user` and receive the formal `user` role.
- GitHub OAuth-created users keep `users.role = user` and receive the formal `user` role.
- Admin-created users keep the selected `users.role` value and receive the matching formal role.
- User deletion removes related auth codes and user-role mappings before deleting the user.

## RBAC Checks

`require_admin` now passes when the authenticated user has the formal `admin` role, with fallback compatibility for the JWT role claim and `users.role`. Normal users continue to be denied from admin-only endpoints.

Helper functions are available in the Auth Service:

- `user_role_names(user)`
- `effective_user_role(user)`
- `user_has_role(user, role_name)`
- `user_has_permission(db, user, permission_name)`

## Test Flow

PowerShell verification:

1. Login as admin through the current 2FA flow.
2. `GET /auth/users`.
3. Confirm admin/user roles still appear and `roles` is included.
4. Login as a normal user.
5. Normal user tries `GET /audit/logs` and receives `403`.
6. Admin accesses `GET /audit/logs` successfully.
7. Check DB tables exist:
   - `roles`
   - `permissions`
   - `user_roles`
   - `role_permissions`
8. Confirm the existing admin has the `admin` role.
9. Confirm a GitHub-created user has the `user` role.

Optional psql checks:

```sql
SELECT * FROM roles;
SELECT * FROM permissions;
SELECT * FROM user_roles;
SELECT * FROM role_permissions;
```

Safety notes:

- `users.role` is intentionally preserved.
- `password_hash` is never exposed in API responses.
- Secrets remain in `.env` and are not returned by RBAC endpoints.
