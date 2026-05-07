# SecureOps Part 3.5 Frontend Products Integration

## What Was Integrated

Part 3.5 connects the existing frontend product pages to the completed Inventory Service while preserving the existing visual style.

- Admin products page now loads products from `GET /products`
- User products page now loads products from `GET /products`
- Product API helpers were added for create, update, stock update, delete, search, and filters
- Admin product actions now call the backend
- User product cards remain read-only
- Search and low-stock/category filters use backend data
- Backend errors are displayed as readable messages

No orders, files, reports, audit logs, security center backend integration, attack simulation backend, or new backend services were implemented.

## Admin Products Features

Admin route:

```text
/admin/products
```

Admin can:

- View live products
- Search by name or SKU
- Toggle low-stock filter
- Create product
- Edit product fields
- Update stock
- Delete product

Admin product actions use:

- `GET /products`
- `POST /products`
- `PATCH /products/{id}`
- `PATCH /products/{id}/stock`
- `DELETE /products/{id}`

## User Products Features

User route:

```text
/user/products
```

User can:

- View live products
- Search products
- Filter by category
- Filter by availability
- See stock status

User cannot see admin controls such as add, edit, stock update, or delete.

The `Request Product` button remains visual only for now. Clicking it shows:

```text
Product request feature will be available after Order Service integration.
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

## Expected RBAC Behavior

- Admin can create, update, update stock, and delete products.
- User can list and view products only.
- If the token is missing or invalid, protected routes redirect to login.
- If the backend returns `403`, the UI shows a friendly error message.

## Browser Test Flow

1. Login as admin:
   `admin@secureops.com` / `Admin@12345`
2. Open `/admin/products`.
3. Products load from the backend.
4. Add a product.
5. Try duplicate SKU and confirm the safe error appears.
6. Update stock.
7. Use search.
8. Use low-stock filter.
9. Delete a test product.
10. Logout.
11. Login as user:
    `user@secureops.com` / `User@12345`
12. Open `/user/products`.
13. Products load from the backend.
14. Search products.
15. Confirm admin controls are not visible.
16. Click `Request Product`.
17. Confirm the placeholder message appears.

## Run

```powershell
docker compose up --build
```

Open:

```text
http://localhost:8080
```
