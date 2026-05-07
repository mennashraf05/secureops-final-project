# SecureOps Part 4.5 Frontend Orders Integration

## What Was Integrated

Part 4.5 connects the existing frontend order views to the completed Order Service backend through Nginx:

- User product requests now call `POST /orders`.
- User My Orders now calls `GET /orders/my`.
- Admin Orders now calls `GET /orders` and `GET /orders?status=...`.
- Admin approve/reject actions call `PATCH /orders/{id}/approve` and `PATCH /orders/{id}/reject`.
- Existing JWT auth headers are reused from the shared frontend API client.

No frontend redesign was performed. The existing cards, tables, buttons, filters, spacing, colors, and layout patterns were preserved.

## Request Product Behavior

On `/user/products`, the existing Request Product button now creates a one-item order:

- `product_id` uses the selected product id.
- `product_name` uses the selected product name.
- `product_sku` uses the selected product SKU.
- `quantity` is fixed at `1`.

If the product quantity is `0`, the user sees:

```text
This product is currently out of stock.
```

Stock is not reduced in Part 4.5. Approval only changes order status.

## User My Orders Behavior

On `/user/orders`, users see only their own orders from `GET /orders/my`.

The page shows:

- Order id
- Product name
- Product SKU
- Quantity
- Status badge
- Created date
- Admin response when available
- Loading, error, empty, and refresh states

Users do not see approve or reject actions.

## Admin Orders Behavior

On `/admin/orders`, admins see all orders from `GET /orders`.

The page shows:

- Live order KPI counts
- Status filter for all, pending, approved, rejected
- Order id
- User id
- Product name
- Product SKU
- Quantity
- Status badge
- Created date
- Admin response
- Approve and reject actions for pending orders only

Reject requires an admin response reason, which is sent to the backend.

## Demo Accounts

User:

```text
user@secureops.com
User@12345
```

Admin:

```text
admin@secureops.com
Admin@12345
```

## Browser Test Flow

1. Login as user: `user@secureops.com` / `User@12345`.
2. Open `/user/products`.
3. Click Request Product on an in-stock product.
4. See `Product request submitted successfully.`
5. Open `/user/orders`.
6. See the new order with pending status.
7. Logout.
8. Login as admin: `admin@secureops.com` / `Admin@12345`.
9. Open `/admin/orders`.
10. See all orders.
11. Approve one pending order.
12. Reject another pending order with a reason.
13. Verify statuses update.
14. Logout and login as user again.
15. Open `/user/orders` and verify admin response/status is visible.
16. Confirm user cannot access `/admin/orders`.

## Not Included

Part 4.5 does not implement:

- File Service frontend work
- Reports
- RabbitMQ jobs
- Audit or Security Center backend integration
- Attack Simulation backend
- Automatic stock deduction
