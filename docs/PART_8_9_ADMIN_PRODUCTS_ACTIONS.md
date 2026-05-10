# Part 8.9 Admin Products Actions

Part 8.9 completes the existing Admin Products page actions without redesigning the inventory UI.

## Add Product Behavior

Admins can click **Add Product** on `/admin/products` to open the existing product form panel. The form submits to the real Inventory Service endpoint:

- `POST /products`

On success, the form closes, the products list refreshes, KPI cards update from the refreshed data, and the page shows:

- `Product added successfully.`

## Delete Product Behavior

Each product row includes a delete action. Before deletion, the browser asks:

- `Are you sure you want to delete this product?`

After confirmation, the page calls:

- `DELETE /products/{id}`

The row action shows a deleting state while the request is in progress. On success, the products list refreshes, KPI cards update, and the page shows:

- `Product deleted successfully.`

## Validation Rules

The Admin Products form validates before submitting:

- Name is required.
- SKU is required.
- Category is required.
- Price must be a valid number greater than or equal to `0`.
- Quantity must be a valid number greater than or equal to `0`.
- Description is optional.

Backend errors are shown as readable messages from the Inventory Service response.

## RBAC Behavior

Product creation, update, stock update, and deletion remain protected by Inventory Service admin RBAC. Normal users use `/user/products` and do not receive admin add/delete controls.

## Audit Events

Inventory Service continues to emit audit events for product lifecycle actions:

- `inventory.product.created`
- `inventory.product.updated`
- `inventory.stock.updated`
- `inventory.product.deleted`

Audit failures are best-effort and do not block the main product operation.

## Browser Test Flow

1. Login as admin.
2. Open `/admin/products`.
3. Click **Add Product**.
4. Add a new product with valid data.
5. Confirm the product appears in the table/list.
6. Confirm KPI total products increased.
7. Delete the new product.
8. Confirm the product disappears.
9. Open `/admin/audit-logs`.
10. Confirm `inventory.product.created` and `inventory.product.deleted` appear.
11. Login as a normal user.
12. Open `/user/products`.
13. Confirm the user cannot see Add/Delete controls.
