# SecureOps Part 4 Order Service

## What Was Implemented

Part 4 implements only the Order Service backend for product requests:

- Order and order item database models
- Create order endpoint
- View own orders endpoint
- Admin list/filter all orders endpoint
- Ownership-based order access
- Admin approve/reject endpoints
- Local JWT verification compatible with Auth Service
- Safe validation and error responses

Files, reports, worker jobs, audit security center, attack simulation, and frontend integration are intentionally not implemented in Part 4.

## Endpoints

Health:

- `GET /orders/health`

Authenticated user/admin:

- `POST /orders`
- `GET /orders/my`
- `GET /orders/{order_id}`

Admin only:

- `GET /orders`
- `GET /orders?status=pending`
- `PATCH /orders/{order_id}/approve`
- `PATCH /orders/{order_id}/reject`

## Ownership-Based Access Control

Users can create orders and view only orders where `order.user_id` matches the `sub` claim in their JWT.

Admins can view all orders and approve or reject any order.

If a normal user tries to access another user's order, the service returns `403`.

## Validation Rules

- `OrderCreate.items` must contain at least one item.
- `product_id` is required and must be greater than `0`.
- `product_name` is required.
- `product_sku` is required.
- `quantity` must be greater than `0`.
- Reject request must include `admin_response`.
- Allowed statuses are `pending`, `approved`, and `rejected`.

## PowerShell Test Commands

Run:

```powershell
docker compose up --build
```

Login as admin:

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
```

Login as user:

```powershell
$userBody = @{
  email = "user@secureops.com"
  password = "User@12345"
} | ConvertTo-Json

$userLogin = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body $userBody

$userToken = $userLogin.access_token
```

Create order as user:

```powershell
$orderBody = @{
  items = @(
    @{
      product_id = 1
      product_name = "Secure Laptop"
      product_sku = "LAP-SEC-001"
      quantity = 1
    }
  )
} | ConvertTo-Json -Depth 5

$created = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/orders" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $userToken" } `
  -Body $orderBody

$orderId = $created.data.id
$created
```

Expected: `201`.

User views own orders:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/orders/my" `
  -Headers @{ Authorization = "Bearer $userToken" }
```

Expected: `200`.

User tries admin list:

```powershell
try {
  Invoke-RestMethod `
    -Method Get `
    -Uri "http://localhost:8080/orders" `
    -Headers @{ Authorization = "Bearer $userToken" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `403`.

Admin lists all orders:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/orders" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Expected: `200`.

User views own order by id:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/orders/$orderId" `
  -Headers @{ Authorization = "Bearer $userToken" }
```

Expected: `200`.

User tries another user's order:

Create another account through `/auth/register`, login as that account, create an order, then try to view that order with `$userToken`.

Expected: `403`.

User tries approve:

```powershell
try {
  Invoke-RestMethod `
    -Method Patch `
    -Uri "http://localhost:8080/orders/$orderId/approve" `
    -Headers @{ Authorization = "Bearer $userToken" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `403`.

Admin approves:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8080/orders/$orderId/approve" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Expected: `200` and `status = approved`.

Create another order for rejection:

```powershell
$secondCreated = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/orders" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $userToken" } `
  -Body $orderBody

$secondOrderId = $secondCreated.data.id
```

Admin rejects the second order:

```powershell
$rejectBody = @{
  admin_response = "Rejected for demo testing."
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8080/orders/$secondOrderId/reject" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -Body $rejectBody
```

Expected: `200` and `status = rejected`.

Invalid quantity:

```powershell
$badOrderBody = @{
  items = @(
    @{
      product_id = 1
      product_name = "Secure Laptop"
      product_sku = "LAP-SEC-001"
      quantity = 0
    }
  )
} | ConvertTo-Json -Depth 5

try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8080/orders" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $userToken" } `
    -Body $badOrderBody
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `422`.

Missing token:

```powershell
try {
  Invoke-RestMethod -Method Get -Uri "http://localhost:8080/orders/my"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`.

Invalid token:

```powershell
try {
  Invoke-RestMethod `
    -Method Get `
    -Uri "http://localhost:8080/orders/my" `
    -Headers @{ Authorization = "Bearer invalid.token.value" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`.

## Stock Behavior

Approving an order only changes order status in Part 4.

Future improvement: on approval, call Inventory Service or publish message to update stock.
