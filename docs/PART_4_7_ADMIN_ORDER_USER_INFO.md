# SecureOps Part 4.7 Admin Order User Info

## What Was Improved

Part 4.7 improves the Admin Orders page so admins can identify who submitted each order without relying only on a numeric `user_id`.

Order Service now stores user snapshot fields on each order:

- `user_id`
- `user_name`
- `user_email`

Admin Orders now displays the user name/email in the User column while still showing the numeric user id as supporting context.

## Why Snapshot User Fields

SecureOps is a distributed microservice project. Order Service should not depend on cross-service joins to Auth Service user tables for normal order listing.

Storing a small user snapshot on order creation keeps Admin Orders fast, simple, and demo-friendly:

- Admin can see who submitted a request.
- Old orders remain readable.
- Order records preserve the requester identity as it was known when the order was created.

## Fallback Behavior

Existing orders created before Part 4.7 may not have `user_name` or `user_email`.

Frontend fallback order:

1. Show `user_name` if available.
2. Show `user_email` if available.
3. Show `User #user_id` for old orders without snapshot fields.

## Local Database Note

`SQLAlchemy create_all()` does not alter existing tables. Part 4.7 includes a lightweight startup-safe column addition for local development:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_name VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
```

For a production deployment, this should become a formal migration.

## Verification Flow

1. Login as user.
2. Create a new product request from `/user/products`.
3. Login as admin.
4. Open `/admin/orders`.
5. Confirm the new order shows user information instead of only a numeric id.
6. Confirm older orders still render safely as `User #id` if no snapshot fields exist.

## Not Included

Part 4.7 does not implement:

- New services
- File Service
- Reports
- Audit Center
- Security Center
- Attack Simulation
- Frontend redesign
