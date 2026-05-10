# SecureOps Part 3 Inventory Service

## What Was Implemented

Part 3 implements only the Inventory Service product management foundation:

- Product database model
- Product create, list, view, update, stock update, and delete endpoints
- Local JWT verification using `JWT_SECRET` and `JWT_ALGORITHM`
- Admin RBAC for write operations
- User/admin access for read operations
- Product seed data on startup
- Safe validation and error responses

Orders, files, reports, worker jobs, audit/security center, attack simulation, and full frontend inventory integration are intentionally not implemented in Part 3.

## Endpoints

Public health:

- `GET /products/health`

Authenticated user/admin:

- `GET /products`
- `GET /products/{product_id}`

Admin only:

- `POST /products`
- `PATCH /products/{product_id}`
- `PATCH /products/{product_id}/stock`
- `DELETE /products/{product_id}`

## Query Parameters

`GET /products` supports:

- `search`: matches product name or SKU
- `category`: filters category
- `low_stock_only`: when `true`, returns products with `quantity <= 5`

Examples:

```text
/products?search=firewall
/products?low_stock_only=true
/products?category=Network
```

## Validation Rules

- `name` is required
- `sku` is required and unique
- `category` is required
- `price` must be greater than or equal to `0`
- `quantity` must be greater than or equal to `0`
- Product updates cannot change SKU in Part 3

## Demo Data

Seed products are created only if the products table is empty:

- Secure Laptop, `LAP-SEC-001`, Devices, `1200`, quantity `10`
- Network Firewall, `NET-FW-001`, Network, `850`, quantity `3`
- Encrypted USB Drive, `USB-ENC-001`, Storage, `60`, quantity `20`
- Security Camera, `CAM-SEC-001`, Surveillance, `150`, quantity `4`

## PowerShell Test Commands

Run the stack:

```powershell
docker compose up --build
```

Before running protected endpoint tests, obtain `$adminToken` and `$userToken` using the mandatory 2FA flow in `docs/AUTH_2FA_TEST_FLOW.md`. `/auth/login` no longer returns `access_token` directly.

List products as user:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/products" `
  -Headers @{ Authorization = "Bearer $userToken" }
```

Expected: `200`.

Create product as user:

```powershell
$productBody = @{
  name = "Secure Router"
  sku = "NET-RTR-001"
  category = "Network"
  description = "Managed secure router"
  price = 300
  quantity = 8
} | ConvertTo-Json

try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8080/products" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $userToken" } `
    -Body $productBody
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `403`.

Create product as admin:

```powershell
$created = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/products" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -Body $productBody

$productId = $created.data.id
$created
```

Expected: `201`.

Create product with negative price:

```powershell
$badBody = @{
  name = "Bad Product"
  sku = "BAD-NEG-001"
  category = "Test"
  price = -1
  quantity = 1
} | ConvertTo-Json

try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8080/products" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $adminToken" } `
    -Body $badBody
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `422` safe validation error.

Create duplicate SKU:

```powershell
try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8080/products" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $adminToken" } `
    -Body $productBody
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `400`.

Update stock as user:

```powershell
$stockBody = @{ quantity = 12 } | ConvertTo-Json

try {
  Invoke-RestMethod `
    -Method Patch `
    -Uri "http://localhost:8080/products/$productId/stock" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $userToken" } `
    -Body $stockBody
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `403`.

Update stock as admin:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8080/products/$productId/stock" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -Body $stockBody
```

Expected: `200`.

Search products:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/products?search=firewall" `
  -Headers @{ Authorization = "Bearer $userToken" }
```

Low stock products:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/products?low_stock_only=true" `
  -Headers @{ Authorization = "Bearer $userToken" }
```
